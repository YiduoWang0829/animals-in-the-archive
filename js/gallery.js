// The gallery and the painting space.
//
// A dark room with a spotlit, gilded frame. The painting is a relief built from
// its depth map, seen through a window cut in the wall. The visitor walks in
// across the floor and looks back at you. Several painted animals wake up, step
// out of their places (the ground behind them was repainted offline) and come
// to the front of the picture. On "yes" the camera passes through the frame and
// the picture becomes a space: you can look around and zoom (mouse, head or
// hands), and the animals keep living there: they wander, run, follow you,
// and come when you call them.
//
// The visitor is an "actor": either a 2D Character (drawing / storybook) or a
// 3D animated animal. Both expose the same small interface (see character.js).

import * as THREE from '../vendor/three-0.170.0/build/three.module.js';
import { Character } from './character.js';
import { wrapLines } from './util.js';

const PAINT_VERT = /* glsl */`
  uniform sampler2D uDepthTex;
  uniform float uDepth, uEdge;
  varying vec2 vUv;
  varying float vD;
  void main() {
    vUv = uv;
    float d = texture2D(uDepthTex, uv).r;
    vD = d;
    vec3 p = position;
    // in the gallery the picture's edges stay on the picture plane (no gap at the frame)
    float edge = smoothstep(0.0, 0.06, min(min(uv.x, 1.0 - uv.x), min(uv.y, 1.0 - uv.y)));
    p.z -= (1.0 - d) * uDepth * mix(1.0, edge, uEdge);   // far things sink back behind the picture plane
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  }
`;
const PAINT_FRAG = /* glsl */`
  uniform sampler2D uMap, uDepthTex;
  uniform float uTime, uWind, uBright, uFill;
  varying vec2 vUv;
  varying float vD;
  void main() {
    vec2 st = vUv;
    // Where the depth jumps (a near figure against far land), the relief is a steep
    // stretched skirt. Paint it with what lies behind: step from here towards the far side
    // of the jump and take the colour there. Figures keep a clean edge instead of a smear.
    if (uFill > 0.0) {
      float e = 0.004;
      vec2 gd = vec2(texture2D(uDepthTex, vUv + vec2(e, 0.0)).r - texture2D(uDepthTex, vUv - vec2(e, 0.0)).r,
                     texture2D(uDepthTex, vUv + vec2(0.0, e)).r - texture2D(uDepthTex, vUv - vec2(0.0, e)).r) / (2.0 * e);
      float steep = smoothstep(4.0, 10.0, length(gd)) * uFill;
      if (steep > 0.0) st -= normalize(gd) * 0.022 * steep;
    }
    float far = 1.0 - vD;
    // the picture breathes: distant foliage and sky sway a little
    st.x += sin(uTime * 1.1 + vUv.y * 18.0 + vUv.x * 9.0) * 0.0011 * far * smoothstep(0.3, 1.0, vUv.y) * uWind;
    st.y += cos(uTime * 0.9 + vUv.x * 14.0) * 0.0007 * far * smoothstep(0.4, 1.0, vUv.y) * uWind;
    vec3 c = texture2D(uMap, st).rgb;
    float v = 1.0 - length((vUv - 0.5) * vec2(0.9, 1.1)) * 0.35;  // soft spotlight falloff
    gl_FragColor = vec4(c * uBright * v, 1.0);
    #include <colorspace_fragment>
  }
`;

const loadImg = url => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
const ease = t => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
const rand = (a, b) => a + Math.random() * (b - a);

export class Gallery {
  // opts: { work, workText, visitor (actor), hosts: [{host, meta}], onFrame }
  constructor(container, opts) {
    this.container = container;
    this.o = opts;
    this.clock = new THREE.Clock();
    this.tweens = [];
    this.parallax = new THREE.Vector2();      // from head tracking or the mouse, -1..1
    this.view = { yaw: 0, pitch: 0, zoom: 0, ty: 0, tp: 0, tz: 0, px: 0, py: 0, tpx: 0, tpy: 0 };   // inside: look around, zoom, pan
    this.inside = false;
    this.hosts = [];
  }

  async init() {
    const { work } = this.o;
    const r = this.renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    r.setPixelRatio(Math.min(devicePixelRatio, 1.5));   // smoother on laptops and phones
    r.outputColorSpace = THREE.SRGBColorSpace;
    r.toneMapping = THREE.ACESFilmicToneMapping; r.toneMappingExposure = 1.0;
    Object.assign(r.domElement.style, { width: '100%', height: '100%', display: 'block' });
    this.container.appendChild(r.domElement);

    const scene = this.scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0b0a09);
    scene.fog = new THREE.Fog(0x0b0a09, 7, 16);
    const cam = this.camera = new THREE.PerspectiveCamera(40, 1, 0.02, 60);
    this.camBase = new THREE.Vector3(0, 1.25, 5.4);
    this.camLook = new THREE.Vector3(0, 1.18, 0);
    cam.position.copy(this.camBase);

    // ---- painting --------------------------------------------------------
    const [W, H] = work.size;
    this.W = W; this.H = H;
    const pw = this.pw = work.realWidth, ph = this.ph = pw * H / W;
    const cy = this.cy = ph / 2 + 0.36;           // hung low, with three steps up to it
    this.bottom = cy - ph / 2;
    const [img, depthImg] = await Promise.all([loadImg(work.hd), loadImg(work.depth)]);
    // the painting lives on a canvas so walked-away animals can be painted out
    const plate = this.plate = document.createElement('canvas');
    plate.width = img.width; plate.height = img.height;
    this.plateCtx = plate.getContext('2d');
    this.plateCtx.drawImage(img, 0, 0);
    const map = this.map = new THREE.CanvasTexture(plate);
    map.colorSpace = THREE.SRGBColorSpace; map.anisotropy = 8;
    // the depth lives on a canvas too, so the ground can be smoothed where an animal got up
    const dcan = this.depthCanvas = document.createElement('canvas');
    dcan.width = depthImg.width; dcan.height = depthImg.height;
    this.depthCtx = dcan.getContext('2d', { willReadFrequently: true });
    this.depthCtx.drawImage(depthImg, 0, 0);
    const depth = this.depthTex = new THREE.CanvasTexture(dcan);
    this.depthImg = dcan;
    this.paintU = {
      uMap: { value: map }, uDepthTex: { value: depth },
      uDepth: { value: pw * 0.16 }, uEdge: { value: 1 }, uFill: { value: 0 }, uTime: { value: 0 }, uWind: { value: 0 }, uBright: { value: 1.0 },
    };
    this.paintGroup = new THREE.Group();
    this.paintGroup.position.set(0, cy, 0);
    const segX = 220, segY = Math.round(220 * ph / pw);
    const painting = new THREE.Mesh(new THREE.PlaneGeometry(pw, ph, segX, segY),
      new THREE.ShaderMaterial({ uniforms: this.paintU, vertexShader: PAINT_VERT, fragmentShader: PAINT_FRAG }));
    painting.position.z = -0.03;
    this.paintGroup.add(painting);
    scene.add(this.paintGroup);
    const box = new THREE.Mesh(new THREE.BoxGeometry(pw * 3, ph * 3, 12),
      new THREE.MeshBasicMaterial({ color: 0x050404, side: THREE.BackSide }));
    box.position.z = -6.02;
    this.paintGroup.add(box);

    // ---- room ----------------------------------------------------------
    const wallMat = new THREE.MeshStandardMaterial({ color: work.wall, roughness: 0.95 });
    const shape = new THREE.Shape();
    shape.moveTo(-9, 0); shape.lineTo(9, 0); shape.lineTo(9, 6); shape.lineTo(-9, 6); shape.lineTo(-9, 0);
    const hole = new THREE.Path();
    hole.moveTo(-pw / 2, this.bottom); hole.lineTo(pw / 2, this.bottom); hole.lineTo(pw / 2, this.bottom + ph);
    hole.lineTo(-pw / 2, this.bottom + ph); hole.lineTo(-pw / 2, this.bottom);
    shape.holes.push(hole);
    this.wall = new THREE.Mesh(new THREE.ShapeGeometry(shape), wallMat);
    scene.add(this.wall);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(18, 12),
      new THREE.MeshStandardMaterial({ color: 0x1c1915, roughness: 0.42, metalness: 0.15 }));
    floor.rotation.x = -Math.PI / 2; floor.position.z = 6;
    scene.add(floor);
    const skirting = new THREE.Mesh(new THREE.BoxGeometry(18, 0.12, 0.03),
      new THREE.MeshStandardMaterial({ color: 0x141210, roughness: 0.7 }));
    skirting.position.set(0, 0.06, 0.015); scene.add(skirting);
    // three stone steps up to the frame: the visitor climbs them and walks in
    const stone = new THREE.MeshStandardMaterial({ color: 0x2c2823, roughness: 0.85 });
    for (let k = 1; k <= 3; k++) {
      const h = 0.12 * k, step = new THREE.Mesh(new THREE.BoxGeometry(pw + 0.5 - k * 0.08, h, 0.18), stone);
      step.position.set(0, h / 2, 0.18 * (3 - k) + 0.09); scene.add(step);
    }

    const gold = new THREE.MeshStandardMaterial({ color: 0x9a7740, metalness: 0.85, roughness: 0.32 });
    const liner = new THREE.MeshStandardMaterial({ color: 0x2b2116, metalness: 0.3, roughness: 0.6 });
    const fw = 0.1, fd = 0.07;
    const bar = (w, h, x, y, mat, d = fd, z = d / 2) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); scene.add(m); return m;
    };
    bar(pw + fw * 2, fw, 0, this.bottom - fw / 2, gold);
    bar(pw + fw * 2, fw, 0, this.bottom + ph + fw / 2, gold);
    bar(fw, ph, -pw / 2 - fw / 2, cy, gold);
    bar(fw, ph, pw / 2 + fw / 2, cy, gold);
    const lw = 0.02;
    bar(pw, lw, 0, this.bottom + lw / 2, liner, 0.03, 0.015);
    bar(pw, lw, 0, this.bottom + ph - lw / 2, liner, 0.03, 0.015);
    bar(lw, ph, -pw / 2 + lw / 2, cy, liner, 0.03, 0.015);
    bar(lw, ph, pw / 2 - lw / 2, cy, liner, 0.03, 0.015);
    this.frameRect = new THREE.Vector4(-pw / 2, pw / 2, this.bottom, this.bottom + ph);

    // wall label
    await document.fonts.ready;
    const lc = document.createElement('canvas'); lc.width = 520; lc.height = 300;
    const g = lc.getContext('2d');
    g.fillStyle = '#ebe5d9'; g.fillRect(0, 0, 520, 300);
    g.fillStyle = '#6b6357'; g.font = '400 18px "IBM Plex Mono", monospace'; g.fillText(work.accession, 30, 46);
    g.fillStyle = '#1d1a16'; g.font = 'italic 400 34px "Cormorant Garamond", "Songti SC", "Noto Serif SC", "AppleMyungjo", "Noto Serif KR", Georgia, serif';
    wrapText(g, this.o.workText.title, 30, 100, 460, 38);
    g.font = '400 20px Inter, "PingFang SC", "Apple SD Gothic Neo", sans-serif'; g.fillStyle = '#3a342c';
    g.fillText(`${this.o.workText.artist}`.slice(0, 44), 30, 232); g.fillText(this.o.workText.date, 30, 262);
    const labelTex = new THREE.CanvasTexture(lc); labelTex.colorSpace = THREE.SRGBColorSpace;
    const label = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.196), new THREE.MeshStandardMaterial({ map: labelTex, roughness: 0.8 }));
    label.position.set(pw / 2 + 0.42, Math.min(1.25, cy), 0.012); scene.add(label);
    this.labelX = pw / 2 + 0.42;

    // lights (also light the 3D animals)
    scene.add(new THREE.HemisphereLight(0xfff1df, 0x16120e, 0.55));
    const spot = new THREE.SpotLight(0xffe6c4, 70, 12, 0.5, 0.65, 1.6);
    spot.position.set(0, 4.6, 3.0); spot.target.position.set(0, cy, 0);
    scene.add(spot, spot.target);
    const floorSpot = new THREE.SpotLight(0xfff0dc, 30, 10, 0.6, 0.8, 1.5);
    floorSpot.position.set(-1.0, 4.8, 3.2); floorSpot.target.position.set(-0.8, 0, 1.6);
    scene.add(floorSpot, floorSpot.target);
    this.keyLight = new THREE.DirectionalLight(0xfff2e0, 0.0);  // used inside the painting
    this.keyLight.position.set(1, 3, 4); scene.add(this.keyLight);

    // ---- the other paintings of the collection, on the same wall ----------------
    // (flat: only the chosen one is opened up as a relief). Click one to walk over to it.
    this.sides = [];
    for (const { work: ow, text, side } of this.o.others || []) {
      const oimg = await loadImg(ow.image);
      const tex = new THREE.Texture(oimg); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4; tex.needsUpdate = true;
      const w2 = ow.realWidth * 0.92, h2 = w2 * ow.size[1] / ow.size[0];
      const x = side * (pw / 2 + 1.25 + w2 / 2), y = this.bottom + ph / 2 + 0.05;
      const pic = new THREE.Mesh(new THREE.PlaneGeometry(w2, h2), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9 }));
      pic.position.set(x, y, 0.03); scene.add(pic);
      const fr = (w, h, px, py) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.06), gold); m.position.set(px, py, 0.04); scene.add(m); };
      const f2 = 0.08;
      fr(w2 + f2 * 2, f2, x, y + h2 / 2 + f2 / 2); fr(w2 + f2 * 2, f2, x, y - h2 / 2 - f2 / 2);
      fr(f2, h2, x - w2 / 2 - f2 / 2, y); fr(f2, h2, x + w2 / 2 + f2 / 2, y);
      // a small title plate underneath
      const tc = document.createElement('canvas'); tc.width = 512; tc.height = 120;
      const tg = tc.getContext('2d'); tg.fillStyle = '#ebe5d9'; tg.fillRect(0, 0, 512, 120);
      tg.fillStyle = '#1d1a16'; tg.font = 'italic 400 34px "Cormorant Garamond", "Songti SC", "Noto Serif SC", "AppleMyungjo", "Noto Serif KR", Georgia, serif'; tg.textAlign = 'center';
      tg.fillText(text.title.length > 30 ? text.title.slice(0, 29) + '…' : text.title, 256, 54, 480);
      tg.font = '400 20px Inter, "PingFang SC", "Apple SD Gothic Neo", sans-serif'; tg.fillStyle = '#3a342c'; tg.fillText(`${text.artist.split(' and ')[0]}, ${text.date}`, 256, 92, 480);
      const tt = new THREE.CanvasTexture(tc); tt.colorSpace = THREE.SRGBColorSpace;
      const plate = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.1), new THREE.MeshStandardMaterial({ map: tt, roughness: 0.8 }));
      plate.position.set(x, y - h2 / 2 - f2 - 0.12, 0.012); scene.add(plate);
      const lamp = new THREE.SpotLight(0xffe6c4, 26, 9, 0.45, 0.7, 1.6);
      lamp.position.set(x, 4.4, 2.6); lamp.target.position.set(x, y, 0); scene.add(lamp, lamp.target);
      this.sides.push({ mesh: pic, id: ow.id, side, x });
    }

    // ---- visitor ------------------------------------------------------------
    const v = this.visitor = this.o.visitor;
    v.addTo(scene);
    v.setPaint?.(work.style, this.frameRect, 0.0);
    v.setSpot?.(new THREE.Vector3(-0.8, 0, 1.6));
    this.from = this.o.from || -1;                  // which side it comes in from
    v.position.set(this.from * 3.0, 0, 1.75);
    v.setDir(-this.from, true);

    // ---- painted animals ------------------------------------------------------
    for (const { host, meta } of this.o.hosts) {
      const sprite = await loadImg(host.sprite);
      const [bx0, by0, bx1, by1] = meta.box;
      const hh = (by1 - by0) / H * ph;
      const a = new Character(sprite, { height: hh, headSide: host.faces });
      a.shadow.visible = false;
      this.paintGroup.add(a.group); this.paintGroup.add(a.shadow);
      const homeUV = [(bx0 + bx1) / 2 / W, 1 - by1 / H];
      const home = this.paintPoint(homeUV[0], homeUV[1], 0.004);
      a.position.copy(home);
      a.setDir(host.faces === 'right' ? 1 : -1, true);
      a.mesh.renderOrder = 3;
      // one that never leaves its place speaks from the painting itself: a flat cut-out laid
      // over the relief would show a double outline, so only the painting is drawn
      // until it wakes, the painted animal is only the painting itself (a cut-out laid over the
      // relief would show a double outline, and a completed body would cover its neighbours)
      a.mesh.visible = false;
      this.hosts.push({ actor: a, host, meta, home, homeUV, awake: false, away: false, next: rand(2, 5), patch: null, sprite });
    }

    // ---- loop --------------------------------------------------------------
    this.onResize = () => {
      const w = this.container.clientWidth, hgt = this.container.clientHeight;
      r.setSize(w, hgt, false); cam.aspect = w / hgt; cam.updateProjectionMatrix();
      const need = (pw + 1.6) / 2 / Math.tan(THREE.MathUtils.degToRad(cam.fov / 2)) / cam.aspect;
      if (!this.inside) this.camBase.z = Math.max(5.4, Math.min(need + 0.5, 9));
    };
    this.ro = new ResizeObserver(this.onResize); this.ro.observe(this.container); this.onResize();
    r.setAnimationLoop(() => this.tick());
  }

  // painting-local point for uv (u right, v up), on the relief surface
  paintPoint(u, v, lift = 0) {
    const img = this.depthImg;
    if (!this._ddata) {
      const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
      const x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(img, 0, 0);
      this._ddata = x.getImageData(0, 0, img.width, img.height).data;
    }
    const x = Math.min(img.width - 1, Math.max(0, Math.round(u * img.width)));
    const y = Math.min(img.height - 1, Math.max(0, Math.round((1 - v) * img.height)));
    const d = this._ddata[(y * img.width + x) * 4] / 255;
    return new THREE.Vector3((u - 0.5) * this.pw, (v - 0.5) * this.ph, -0.03 - (1 - d) * this.paintU.uDepth.value + lift);
  }

  // paint the ground back where an animal stood (one texture upload, no stutter)
  async revealGround(h) {
    if (h.host.inPlace || h.away) return;
    h.away = true;
    const patch = await loadImg(h.host.patch);
    const [x0, y0, x1, y1] = h.meta.patchBox || h.meta.box, s = this.plate.width / this.W;
    this.plateCtx.drawImage(patch, x0 * s, y0 * s, (x1 - x0) * s, (y1 - y0) * s);
    this.map.needsUpdate = true;
    this.flattenDepth(h);
  }
  // where the animal lay, the relief still had its shape: let the ground close over it.
  // Inside the animal's outline the depth is filled in from the ground around it
  // (diffusion from the edge inwards, then smoothed), so no bump or pit is left.
  flattenDepth(h) {
    const dc = this.depthCanvas, s = dc.width / this.W, [x0, y0, x1, y1] = h.meta.box, pad = 4;
    // only where the animal was actually painted (a completed, hidden part lies over its neighbours)
    const [px0, py0, px1, py1] = h.meta.patchBox || h.meta.box;
    const X0 = Math.max(0, Math.floor(px0 * s) - pad), Y0 = Math.max(0, Math.floor(py0 * s) - pad);
    const X1 = Math.min(dc.width, Math.ceil(px1 * s) + pad), Y1 = Math.min(dc.height, Math.ceil(py1 * s) + pad);
    const w = X1 - X0, hh = Y1 - Y0;
    if (w < 3 || hh < 3) return;
    const id = this.depthCtx.getImageData(X0, Y0, w, hh), d = id.data;
    const mc = document.createElement('canvas'); mc.width = w; mc.height = hh;
    const mx = mc.getContext('2d', { willReadFrequently: true });
    mx.drawImage(h.sprite, x0 * s - X0, y0 * s - Y0, (x1 - x0) * s, (y1 - y0) * s);
    const ma = mx.getImageData(0, 0, w, hh).data;
    const N = w * hh, val = new Float32Array(N), known = new Uint8Array(N), hole = new Uint8Array(N);
    for (let i = 0; i < N; i++) {
      // the outline, grown by a pixel (the sprite's soft edge counts as animal)
      let inside = ma[i * 4 + 3] > 12;
      if (!inside) { const x = i % w, y = (i / w) | 0;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const xx = x + dx, yy = y + dy;
          if (xx >= 0 && yy >= 0 && xx < w && yy < hh && ma[(yy * w + xx) * 4 + 3] > 12) { inside = true; break; } } }
      hole[i] = inside ? 1 : 0; known[i] = inside ? 0 : 1; val[i] = d[i * 4];
    }
    // fill from the edge inwards
    for (let pass = 0, left = 1; left && pass < 400; pass++) {
      left = 0; const next = [];
      for (let i = 0; i < N; i++) {
        if (known[i]) continue;
        const x = i % w, y = (i / w) | 0; let sum = 0, n = 0;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]]) {
          const xx = x + dx, yy = y + dy;
          if (xx < 0 || yy < 0 || xx >= w || yy >= hh) continue;
          const j = yy * w + xx; if (known[j]) { sum += val[j]; n++; }
        }
        if (n) next.push([i, sum / n]); else left++;
      }
      for (const [i, v] of next) { val[i] = v; known[i] = 1; }
      if (!next.length) break;
    }
    // smooth the filled area so it reads as soft ground
    for (let it = 0; it < 6; it++) {
      const tmp = val.slice();
      for (let i = 0; i < N; i++) {
        if (!hole[i]) continue;
        const x = i % w, y = (i / w) | 0; let sum = 0, n = 0;
        for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
          const xx = x + dx, yy = y + dy;
          if (xx >= 0 && yy >= 0 && xx < w && yy < hh) { sum += tmp[yy * w + xx]; n++; }
        }
        val[i] = sum / n;
      }
    }
    for (let i = 0; i < N; i++) if (hole[i]) d[i * 4] = d[i * 4 + 1] = d[i * 4 + 2] = Math.round(val[i]);
    this.depthCtx.putImageData(id, X0, Y0);
    this.depthTex.needsUpdate = true;
    this._ddata = null;                          // footholds read the new ground
  }

  tween(dur, fn) { return new Promise(res => this.tweens.push({ t: 0, dur, fn, res })); }
  wait(sec) { return this.tween(sec, () => {}); }

  tick() {
    const dt = Math.min(0.05, this.clock.getDelta());
    this.simT = (this.simT || 0) + dt;
    this.step(dt, this.simT);
    this.renderer.render(this.scene, this.camera);
    this.o.onFrame?.(this);
  }
  // advance without animation frames (testing only)
  advance(seconds, fps = 60) {
    for (let i = 0; i < seconds * fps; i++) { this.simT = (this.simT || 0) + 1 / fps; this.step(1 / fps, this.simT); }
    this.renderer.render(this.scene, this.camera);
    this.o.onFrame?.(this);
  }

  step(dt, t) {
    this.paintU.uTime.value = t;
    for (const tw of [...this.tweens]) {
      tw.t = Math.min(1, tw.t + dt / tw.dur); tw.fn(ease(tw.t), tw.t);
      if (tw.t >= 1) { this.tweens.splice(this.tweens.indexOf(tw), 1); tw.res(); }
    }
    if (this.inside) {
      // lit like the painting, not by the gallery spot
      const p = new THREE.Vector3();
      for (const a of [this.visitor, ...this.hosts.map(h => h.actor)]) { a.group.getWorldPosition(p); a.setSpot?.(p); }
      this.liveInside(dt);
      this.followYou();
    }
    // where the visitor looks. While it talks with a painted animal: at that animal (the
    // one speaking to it, or the one it is answering), whatever else is going on. When you
    // ask it something, or when you move your head or raise a hand: at you. Otherwise at
    // whoever spoke last. The eyes travel smoothly from one to the next.
    const v = this.visitor, talk = this.talking() ? this.convo : null;
    // (a painted animal can speak before it steps out of its place: look at it there too)
    const hostTop = i => (typeof i === 'number' && this.hosts[i]) ? this.hosts[i].actor.topWorld() : null;
    const other = talk ? (talk.speaker === 'visitor' ? talk.listener : talk.speaker) : null;
    let look = null, body = false;
    if (!v.target) {
      if (v.attending) look = this.youPoint();
      else if (talk && hostTop(other)) { look = hostTop(other); body = true; }
      else if (this.userGaze?.active) look = this.youPoint();
      else if (this.gazeHost != null) look = hostTop(this.gazeHost);
    }
    if (v.aimChain) {
      if (look && v.aimChain.length) {             // a neck to turn: the eyes glide to the new target
        this.gazeS ??= (v.lastLook || look).clone();
        this.gazeS.lerp(look, 1 - Math.exp(-dt * 4.5));
        v.gazeAt = this.gazeS;
      } else {                                     // the body turns itself (eased): aim it at the real target
        v.gazeAt = look; this.gazeS = null;
      }
      v.gazeBody = body;
      v.gazeIsYou = !!look && !body && (v.attending || !!this.userGaze?.active);
    } else if (body && this.inside) {
      // a flat figure turns its whole body to whoever it is talking with
      const hp = this.hosts[other].actor.position, d = hp.x - v.position.x;
      if (Math.abs(d) > 0.05) v.setDir(Math.sign(d));
    }
    this.visitor.update(dt, t);
    for (const h of this.hosts) h.actor.update(dt, t);
    this._dt = dt;
    this.updateCamera();
  }

  // inside, the visitor drifts to where you are (your head, or a resting hand), a short
  // unhurried walk at a time; never while someone is walking up to it
  followYou() {
    const u = this.userGaze, v = this.visitor;
    if (!this.inside || this.locked || !this.follow || !u?.active || u.gesture || v.target) return;
    if (this.hosts.some(h => h.meeting || h.called || h.rising)) return;
    const now = performance.now();
    if (now - (this.lastFollow || 0) < 1800) return;
    const lim = this.pw / 2 - this.widthOf(v) / 2 - 0.05;
    const want = THREE.MathUtils.clamp((u.x - 0.5) * this.pw * 0.85, -lim, lim);
    if (Math.abs(want - v.position.x) < 0.14) return;
    this.lastFollow = now;
    const x = v.position.x + THREE.MathUtils.clamp(want - v.position.x, -0.32, 0.32);
    v.walkTo(this.spot(x, v.position.z, v), 0.2);
  }
  // two animals are talking right now (a line is on screen, or was a moment ago)
  talking() { const c = this.convo; return !!c && performance.now() - c.t < c.dur + 2500; }
  // a point in front of the screen where the person is (their head or hand, if tracked)
  youPoint() {
    const c = this.camera, u = this.userGaze, g = c.position.clone();
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(c.quaternion), up = new THREE.Vector3(0, 1, 0).applyQuaternion(c.quaternion);
    if (u) g.addScaledVector(right, (u.x - 0.5) * 2.6).addScaledVector(up, (0.5 - u.y) * 1.2);
    return g;
  }

  updateCamera() {
    const ease = rate => 1 - Math.exp(-(this._dt || 1 / 60) * rate);
    const cam = this.camera, px = this.parallax, v = this.view;
    if (this.follow && !this.inside) {                 // walking up to the picture: follow behind
      const vp = this.visitor.position;
      this.camBase.set(vp.x * 0.5, vp.y + 0.85, vp.z + 2.3);
      this.camLook.set(vp.x * 0.5, vp.y + 0.55, vp.z - 1.2);
    }
    if (!this.inside) {
      const k = this.follow ? 0 : 0.12;          // the painting stays still on the wall
      cam.position.x += (this.camBase.x + px.x * k - cam.position.x) * 0.08;
      cam.position.y += (this.camBase.y + px.y * k * 0.5 - cam.position.y) * 0.08;
      cam.position.z += (this.camBase.z - cam.position.z) * 0.08;
      cam.lookAt(this.camLook);
      return;
    }
    // inside: a follow camera. It stays with your animal, just behind and above it,
    // looking where it looks. Zoom = closer to the animal; looking around = orbiting it.
    if (!this.follow) {                      // the walk-in zoom: scripted camera move
      cam.position.lerp(this.camBase, 0.12); cam.lookAt(this.camLook); return;
    }
    v.yaw += (v.ty - v.yaw) * ease(6); v.pitch += (v.tp - v.pitch) * ease(6); v.zoom += (v.tz - v.zoom) * ease(5);
    v.px += (v.tpx - v.px) * ease(6); v.py += (v.tpy - v.py) * ease(6);
    const vis = this.visitor, T = new THREE.Vector3();
    vis.group.getWorldPosition(T);
    T.y += vis.height * 0.55;
    T.x += v.px; T.y += v.py;                      // where you have moved the view to
    // zoomed out past the follow view: blend into a straight-on view of the whole painting
    const wide = THREE.MathUtils.smoothstep(-v.zoom, 0.3, 1.0);
    const panned = Math.hypot(v.px, v.py) > 0.03;
    const base = Math.max(vis.height * 3.6, (this.viewDist || 2) * 0.6);
    let D = THREE.MathUtils.clamp(base * (1 - Math.max(v.zoom, -0.3)), vis.height * 2.0, base * 1.3);
    // in a conversation, frame both: aim between your animal and the one talking with it,
    // and step back just enough to see the two of them
    const gh = typeof this.gazeHost === 'number' ? this.hosts[this.gazeHost] : null;
    let pairW = 0;
    if (gh && gh.awake && !gh.host.inPlace) {
      const hp = gh.actor.group.getWorldPosition(new THREE.Vector3());
      const dx = hp.x - T.x;
      if (Math.abs(dx) < 1.6) {
        pairW = 1;
        const tanV = Math.tan(THREE.MathUtils.degToRad(cam.fov / 2));
        const need = (Math.abs(dx) / 2 + this.widthOf(gh.actor) / 2 + this.widthOf(vis) / 2 + 0.08) / (tanV * cam.aspect) + Math.abs(hp.z - T.z) * 0.5;
        this.pairT = (this.pairT || T.clone()).lerp(new THREE.Vector3(T.x + dx * 0.5, T.y + (hp.y + gh.actor.height * 0.5 - T.y) * 0.3, (T.z + hp.z) / 2), ease(2.6));
        this.pairD = THREE.MathUtils.lerp(this.pairD || D, Math.max(D, Math.min(need, base * 1.7)), ease(2.6));
      }
    }
    this.pairK = THREE.MathUtils.lerp(this.pairK || 0, pairW, ease(1.8));
    if (this.pairK > 0.01 && this.pairT) { T.lerp(this.pairT, this.pairK); D = THREE.MathUtils.lerp(D, this.pairD, this.pairK); }
    // The camera's direction comes from the view angles (not from aiming at the animal),
    // so moving it never changes where it points. It sits behind and above your animal,
    // which stays in the middle of the view.
    // near the bottom of the picture look more level, or the foot of the picture would
    // push the view up and the animal out of it
    const low = THREE.MathUtils.smoothstep(T.y - (this.paintGroup.position.y - this.ph / 2), 0.15, 0.6);
    const pitch = THREE.MathUtils.clamp(0.02 + 0.1 * low + v.pitch, 0.0, 0.3);   // steeper would look past the picture's foot
    const yaw = THREE.MathUtils.clamp(v.yaw, -0.4, 0.4);
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(-pitch, yaw, 0, 'YXZ'));
    const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(q);
    const want = T.clone().addScaledVector(fwd, -D);
    want.x += px.x * 0.04; want.y += px.y * 0.03;                     // a touch of head parallax
    if (wide > 0) {                                // the whole picture, face on, centred where you panned
      const pc = this.paintGroup.getWorldPosition(new THREE.Vector3());
      const tanV = Math.tan(THREE.MathUtils.degToRad(cam.fov / 2));
      const fit = Math.max(this.ph / 2 / tanV, this.pw / 2 / (tanV * cam.aspect)) * 1.12;
      const full = new THREE.Vector3(pc.x + v.px * (1 - wide), pc.y + v.py * (1 - wide), pc.z - 0.03 + fit);
      want.lerp(full, wide);
      q.slerp(new THREE.Quaternion(), wide);
    }
    // catch up faster when the animal nears the edge of the view
    const off = Math.max(Math.abs(T.clone().project(cam).x), 0);
    // time-based easing: the same soft glide at any frame rate (faster only when the
    // animal is about to leave the frame)
    cam.position.lerp(want, ease(3.2 + 16 * THREE.MathUtils.smoothstep(off, 0.45, 0.9)));
    cam.quaternion.slerp(q, ease(3.6));
    if (wide < 0.02) this.keepFrameOut();          // (only the whole-picture view shows the frame's edge)
    // if the picture's edge holds the camera back so far that your animal drifts out of
    // view, the orbit gives way (the view swings back behind the animal)
    const sx = T.clone().project(cam).x;
    if (Math.abs(sx) > 0.55 && !panned && wide === 0) { v.ty *= 0.9; v.yaw *= 0.9; }
    // the same when the foot of the picture lifts the view so far that the animal's feet
    // would leave it: come closer instead (a smaller view fits the strip of ground)
    const feet = vis.group.getWorldPosition(new THREE.Vector3()).project(cam).y;
    if (feet < -0.8 && !panned && wide === 0) { const k = (feet + 0.8) * -0.25; v.tz = Math.min(0.6, v.tz + k); v.zoom = Math.min(0.6, v.zoom + k); v.ty *= 0.92; v.yaw *= 0.92; if (this.pairD) this.pairD *= 0.97; }
  }

  // Final guarantee that the black beyond the picture never shows: cast rays through the
  // four corners of the view onto the picture plane (where the relief's edges lie) and,
  // if any lands outside the picture, slide the camera back in; if the view is wider than
  // the picture, move closer. Translating keeps the camera's direction, so it doesn't jolt.
  keepFrameOut() {
    const cam = this.camera, pg = this.paintGroup;
    if (!this._kf) this._kf = { ray: new THREE.Raycaster(), plane: new THREE.Plane(new THREE.Vector3(0, 0, 1), 0), hit: new THREE.Vector3(), ndc: new THREE.Vector2(), fwd: new THREE.Vector3() };
    const K = this._kf, mx = this.pw / 2 * 0.97, my = this.ph / 2 * 0.97;   // the scans have a thin paper margin
    const pz = pg.position.z - 0.03; K.plane.constant = -pz;
    for (let it = 0; it < 4; it++) {
      cam.updateMatrixWorld(true);
      let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity, miss = false;
      for (const [nx, ny] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
        K.ndc.set(nx, ny); K.ray.setFromCamera(K.ndc, cam);
        if (!K.ray.ray.intersectPlane(K.plane, K.hit)) { miss = true; break; }
        const lx = K.hit.x - pg.position.x, ly = K.hit.y - pg.position.y;
        x0 = Math.min(x0, lx); x1 = Math.max(x1, lx); y0 = Math.min(y0, ly); y1 = Math.max(y1, ly);
      }
      if (miss) { cam.position.z = Math.max(pz + 0.2, cam.position.z - 0.08); continue; }
      const tooWide = Math.max((x1 - x0) / (2 * mx), (y1 - y0) / (2 * my));
      if (tooWide > 1) {                       // move closer until the view fits
        const d = cam.position.z - pz;
        cam.position.z = Math.max(pz + 0.2, cam.position.z - Math.min(0.5, d * (1 - 1 / tooWide) * 1.05));
        continue;
      }
      let sx = 0, sy = 0;
      if (x0 < -mx) sx = -mx - x0; else if (x1 > mx) sx = mx - x1;
      if (y0 < -my) sy = -my - y0; else if (y1 > my) sy = my - y1;
      if (!sx && !sy) break;
      cam.position.x += THREE.MathUtils.clamp(sx, -0.5, 0.5); cam.position.y += THREE.MathUtils.clamp(sy, -0.5, 0.5);
    }
  }

  // ---- VR-style controls inside the painting (mouse drag, wheel, head, hands)
  // orbit around your animal (relative, e.g. a mouse drag) …
  look(dx, dy) {
    if (!this.inside || this.locked) return;
    this.view.ty = THREE.MathUtils.clamp(this.view.ty - dx * 3.2, -0.6, 0.6);
    this.view.tp = THREE.MathUtils.clamp(this.view.tp + dy * 2.4, -0.12, 0.45);
  }
  // … or directly to an angle (e.g. where your open hand is)
  lookTo(yaw, pitch) {
    if (!this.inside || this.locked) return;
    this.view.ty = THREE.MathUtils.clamp(yaw, -0.6, 0.6); this.view.tp = THREE.MathUtils.clamp(pitch, -0.12, 0.45);
  }
  orbitBy(d) { if (this.inside && !this.locked) this.view.ty = THREE.MathUtils.clamp(this.view.ty + d, -0.65, 0.65); }
  zoomTo(z) { if (this.inside && !this.locked) this.view.tz = THREE.MathUtils.clamp(z, -0.3, 0.45); }
  // zoom: closer to your animal (up to 0.45), or out, all the way to the whole painting (-1)
  zoomBy(d) {
    if (!this.inside || this.locked) return;
    this.view.tz = THREE.MathUtils.clamp(this.view.tz + d, -1, 0.45);
  }
  // move the view across the picture (a pinched hand dragging, or the mouse); in picture units
  panBy(dx, dy) {
    if (!this.inside || this.locked) return;
    const v = this.view;
    v.tpx = THREE.MathUtils.clamp(v.tpx + dx, -this.pw / 2, this.pw / 2);
    v.tpy = THREE.MathUtils.clamp(v.tpy + dy, -this.ph / 2, this.ph / 2);
  }

  // screen position (CSS px) of a world point, for speech bubbles
  project(p) {
    const v = p.clone().project(this.camera);
    const rc = this.renderer.domElement.getBoundingClientRect();
    return { x: rc.left + (v.x + 1) / 2 * rc.width, y: rc.top + (1 - v.y) / 2 * rc.height, behind: v.z > 1 || v.z < -1 };
  }
  anchor(who) { return (who === 'visitor' ? this.visitor : this.hosts[who].actor).topWorld(); }

  visitorAt(nx, ny) {
    const ray = new THREE.Raycaster(); ray.setFromCamera(new THREE.Vector2(nx, ny), this.camera);
    return ray.intersectObject(this.visitor.group, true).length > 0;
  }
  // which painted animal is under a screen point (normalised -1..1)?
  hostAt(nx, ny) {
    const ray = new THREE.Raycaster(); ray.setFromCamera(new THREE.Vector2(nx, ny), this.camera);
    const hits = ray.intersectObjects(this.hosts.filter(h => h.awake).map(h => h.actor.mesh), false);
    return hits.length ? this.hosts.findIndex(h => h.actor.mesh === hits[0].object) : -1;
  }

  // ---- the gallery tour: just the visitor and you ----------------------------
  async walkIn() { const f = this.from; await this.visitor.walkTo([new THREE.Vector3(f * 1.9, 0, 1.5), new THREE.Vector3(f * 1.0, 0, 1.25)], 0.55); }
  // one of the other paintings on the wall, under a screen point (or null)
  sideAt(nx, ny) {
    if (this.inside || !this.sides?.length) return null;
    const ray = new THREE.Raycaster(); ray.setFromCamera(new THREE.Vector2(nx, ny), this.camera);
    const hit = ray.intersectObjects(this.sides.map(s => s.mesh), false)[0];
    return hit ? this.sides.find(s => s.mesh === hit.object) : null;
  }
  // walk off towards another painting on the wall; the view turns with it
  async leaveToward(side) {
    const v = this.visitor; v.face?.(null); v.attend?.(false);
    this.follow = false;
    const from = this.camBase.clone(), look = this.camLook.clone();
    v.walkTo(new THREE.Vector3(side * 3.4, 0, 1.45), 0.75);
    await this.tween(1.3, e => {
      this.camBase.set(from.x + side * 1.9 * e, from.y, from.z);
      this.camLook.set(look.x + side * 2.1 * e, look.y, look.z);
    });
  }
  // stand and face a direction (null = free), or face you
  async goTo(points, speed = 0.48) { this.visitor.face?.(null); await this.visitor.walkTo(points, speed); }
  async toLabel() {
    await this.goTo([new THREE.Vector3(this.labelX - 0.25, 0, 0.9), new THREE.Vector3(this.labelX - 0.05, 0, 0.62)]);
    this.visitor.face?.(Math.PI); this.visitor.setDir(1);
    await this.wait(0.35);
  }
  async toPainting() {
    await this.goTo([new THREE.Vector3(this.labelX * 0.5, 0, 1.0), new THREE.Vector3(0.05, 0, 1.05)]);
    this.visitor.face?.(Math.PI);
    await this.wait(0.5);
  }
  talkToYou(on) { this.visitor.face?.(null); this.visitor.attend?.(on); }

  // inside: the painted animals were only paint; they freeze, then all look at the visitor
  async startle() {
    const vp = this.visitor.position;
    for (const h of this.hosts) {
      h.actor.setDir(Math.sign(vp.x - h.actor.position.x) || 1);
      h.actor.nod(1);
    }
    await this.wait(0.8);
  }
  // one painted animal steps out of its place and joins the visitor
  wakeHost(i) {
    const h = this.hosts[i];
    if (h.awake) return;
    h.awake = true;
    if (h.host.inPlace) return;                     // too big to leave: it talks from where it is
    // the whole animal fades in over its painted self while the ground behind is painted back,
    // then it gets up (it has been lying or standing still for centuries) and steps out
    const a = h.actor; a.mesh.visible = true; a.uniforms.uOpacity.value = 0;
    this.tween(0.45, e => { a.uniforms.uOpacity.value = e; });
    this.wait(0.3).then(() => this.revealGround(h));
    h.actor.standUp?.();
    h.rising = true;
    this.wait(1.15).then(() => {
      h.rising = false;
      h.actor.ground = (x, z) => this.groundY(z);
      h.actor.shadow.visible = true;
      h.actor.walkTo(this.spot(h.actor.position.x, h.actor.position.z + 0.1, h.actor), 0.26);
    });
  }
  async hostsRefuse() {}

  // ---- step into the picture ------------------------------------------------
  async enter() {
    const v = this.visitor;
    v.face?.(null); v.attend?.(false);
    // one continuous walk: to the steps, up them, across the frame
    this.follow = true;
    const x = -0.1;
    await v.walkTo([new THREE.Vector3(x, 0, 0.8), new THREE.Vector3(x, 0, 0.56), new THREE.Vector3(x, 0.12, 0.45),
      new THREE.Vector3(x, 0.24, 0.27), new THREE.Vector3(x, 0.36, 0.09), new THREE.Vector3(x, this.bottom, 0.0)], 0.3);
    // keep walking: into the picture, while the view opens up
    this.paintGroup.attach(v.group); this.paintGroup.attach(v.shadow);
    v.ground = (px, pz) => this.groundY(pz);
    this.inside = true; this.follow = false;
    const depth0 = this.paintU.uDepth.value, depth1 = this.pw * 0.38;
    const camFrom = this.camera.position.clone(), lookFrom = this.camLook.clone();
    const vf = THREE.MathUtils.degToRad(this.camera.fov / 2);
    // overscan: the picture slightly overfills the screen
    const dist = Math.min(this.ph / 2 / Math.tan(vf), this.pw / 2 / (Math.tan(vf) * this.camera.aspect)) * 0.76;
    this.maxZoom = dist * 0.72; this.viewDist = dist;
    const recede = dist + 0.3;
    const camTo = new THREE.Vector3(0, this.cy, dist - recede - 0.03), lookTo = new THREE.Vector3(0, this.cy, -recede);
    // in proportion with the painted animals: each one, with its real-life height, says how big
    // a metre is in this picture; the visitor takes its own real height on that scale
    const h0 = v.height, vr = this.o.visitorRealH || 0.8;
    const est = this.hosts.filter(h => h.host.realH).map(h => h.actor.height * vr / h.host.realH).sort((p, q) => p - q);
    const mid = est.length ? est[Math.floor(est.length / 2)] : this.ph * 0.12;
    const h1 = THREE.MathUtils.clamp(mid, this.ph * 0.045, this.ph * 0.42);
    // keep walking forward, into the depth of the picture (away from you)
    // the deepest place the painting lets you reach (measured on the relief as it will be inside)
    const keep = this.paintU.uDepth.value, hNow = v.height; this.paintU.uDepth.value = depth1; v.setHeight(h1);
    let inside = null;
    for (const tx of [-0.1, 0.1, -0.3, 0.3, -0.5, 0.5]) {
      const sp = this.spot(tx, -0.3, v);
      if (!inside || sp.z < inside.z - 0.03) inside = sp;
    }
    this.paintU.uDepth.value = keep; v.setHeight(hNow);
    v.walkTo(inside, 0.22);
    this.keyLight.intensity = 0;
    await this.tween(3.6, e => {
      this.paintU.uDepth.value = depth0 + (depth1 - depth0) * e; this.paintU.uFill.value = e;
      this.camBase.lerpVectors(camFrom, camTo, e);
      this.camLook.lerpVectors(lookFrom, lookTo, e);
      this.paintGroup.position.z = -e * recede;
      v.setHeight(h0 + (h1 - h0) * e);
      this.keyLight.intensity = e * 1.6;
      for (const h of this.hosts) if (!h.awake) h.actor.position.z = this.paintPoint(h.homeUV[0], h.homeUV[1], 0.004).z;
    });
    v.setPaintAll?.(1);
    this.paintU.uWind.value = 1;             // inside, the picture breathes
    this.follow = true;                      // from now on the view keeps the visitor in sight
    this.lastLook = -99;
    await this.wait(1.5);
  }

  // depth of the painted surface (the relief) at a point of the picture, in local units
  surfaceZ(x, y) {
    const u = THREE.MathUtils.clamp(x / this.pw + 0.5, 0, 1), v = THREE.MathUtils.clamp(y / this.ph + 0.5, 0, 1);
    return this.paintPoint(u, v).z;
  }
  // a spot where a figure of width w and height h can stand at x, as deep as `zWant`
  // but always in front of whatever is painted there (never inside the relief)
  spot(x, zWant, a) {
    const w = this.widthOf(a), h = a.height;
    x = THREE.MathUtils.clamp(x, -this.pw / 2 + w / 2 + 0.04, this.pw / 2 - w / 2 - 0.04);
    let z = zWant;
    for (let pass = 0; pass < 3; pass++) {
      const y = this.groundY(z);
      let front = -1e9;
      for (const fx of [-0.45, 0, 0.45]) for (const fy of [0.05, 0.5, 0.95]) front = Math.max(front, this.surfaceZ(x + fx * w, y + fy * h));
      z = Math.max(z, front + 0.05);
    }
    z = Math.min(z, 0.45);
    return new THREE.Vector3(x, this.groundY(z), z);
  }

  // a believable "ground" inside the picture: further back is higher up
  groundY(z) { const [g0, rise] = this.o.work.ground || [0.2, 0.22]; return -this.ph / 2 + this.ph * g0 + (0.4 - z) * rise; }
  randomGround() {
    const z = rand(-this.paintU.uDepth.value * 0.55, 0.4);
    return new THREE.Vector3(rand(-this.pw / 2 + 0.25, this.pw / 2 - 0.25), this.groundY(z), z);
  }

  // inside: the painted animals stay near the visitor, in a loose half-circle.
  // Each keeps at least its own width (plus a margin) from the others and stands at
  // its own depth, so two flat figures never overlap or flicker.
  widthOf(a) { return a.aspect ? a.aspect * a.height : (a.length || 1) * a.height; }
  liveInside(dt) {
    const v = this.visitor, vp = v.position;
    const hs = this.hosts.filter(h => h.awake && !h.host.inPlace);
    // only re-form when the visitor has actually gone somewhere new (calm, no milling about)
    const settled = this.formAnchor && vp.distanceTo(this.formAnchor) < 0.35 && hs.every(h => h.placed);
    if (!settled) this.formAnchor = vp.clone();
    let side = 1, reachL = this.widthOf(v) / 2, reachR = this.widthOf(v) / 2;
    hs.forEach((h, k) => {
      const a = h.actor, w = this.widthOf(a);
      if (h.called || h.meeting || h.rising) return;
      if (settled) { if (!a.target && !a.attending) a.setDir(Math.sign(vp.x - a.position.x) || 1); return; }
      // alternate right / left of the visitor, further out each time, a step back each time
      let tx;
      if (side > 0) { tx = vp.x + reachR + 0.08 + w / 2; reachR += w + 0.08; }
      else { tx = vp.x - reachL - 0.08 - w / 2; reachL += w + 0.08; }
      side = -side;
      // side by side on the same ground, just a little in front of / behind in turn (no floating)
      const tz = THREE.MathUtils.clamp(vp.z + (k % 2 ? 0.07 : -0.07), -this.paintU.uDepth.value * 0.6, 0.42);
      tx = THREE.MathUtils.clamp(tx, -this.pw / 2 + w / 2, this.pw / 2 - w / 2);
      const target = this.spot(tx, tz, a);
      const d = target.distanceTo(a.position);
      if (d > 0.12 && (!a.target || a.target.distanceTo(target) > 0.18)) { h.placed = false; a.walkTo(target, d > 0.9 ? 0.45 : 0.26).then(() => { h.placed = true; }); }
      else if (!a.target) h.placed = true;
      if (!a.target) a.setDir(Math.sign(vp.x - a.position.x) || 1);
    });
    // personal space: if two figures overlap at nearly the same depth, the painted one
    // steps aside (and a little back), so no two flat figures ever share a spot
    const crowd = [v, ...this.hosts.filter(h => h.awake && !h.host.inPlace).map(h => h.actor)];
    for (let i = 0; i < crowd.length; i++) for (let j = i + 1; j < crowd.length; j++) {
      const A = crowd[i], B = crowd[j], wa = this.widthOf(A), wb = this.widthOf(B);
      const ov = Math.min(A.position.x + wa / 2, B.position.x + wb / 2) - Math.max(A.position.x - wa / 2, B.position.x - wb / 2);
      if (ov <= 0.1 * Math.min(wa, wb) || Math.abs(A.position.z - B.position.z) > 0.14) continue;
      // who steps aside: never the visitor, never the one on its way to talk; otherwise the later one
      const busy = a => a === v || this.hosts.some(h => h.actor === a && (h.meeting || h.called));
      let mover = busy(B) && !busy(A) ? A : B;
      if (mover === v) mover = A === v ? B : A;                   // the visitor itself never gets shoved
      const still = mover === A ? B : A;
      const wm = this.widthOf(mover), sgn = Math.sign(mover.position.x - still.position.x) || 1;
      const push = (A.target || B.target) ? 0.05 : 0.02;          // someone walking past: make room quickly
      const zMin = -this.paintU.uDepth.value * 0.6, cx = x => THREE.MathUtils.clamp(x, -this.pw / 2 + wm / 2, this.pw / 2 - wm / 2);
      // it makes room by walking (legs moving), never by sliding: a step aside and a little back
      const room = (this.widthOf(still) + wm) / 2 + 0.06;
      const goal = this.spot(cx(still.position.x + sgn * room), Math.max(zMin, mover.position.z - 0.05), mover);
      if (!mover.target || mover.target.distanceTo(goal) > 0.1) {
        const h = this.hosts.find(x => x.actor === mover);
        if (h) h.placed = false;
        mover.walkTo(goal, 0.3).then(() => { if (h) h.placed = true; });
      }
    }
    // nobody ever stands outside the picture
    // (all walk targets are already kept inside the picture by spot(); nobody is moved by hand)
    // draw order follows depth: nearer figures are drawn last (no flicker)
    const all = [v, ...this.hosts.map(h => h.actor)];
    const wp = new THREE.Vector3();
    all.map(a => { a.group.getWorldPosition(wp); return [a, wp.z]; }).sort((x, y) => x[1] - y[1])
      .forEach(([a], i) => a.group.traverse(o => { if (o.isMesh) o.renderOrder = 10 + i; }));
  }
  // wait for walkers to arrive, but never for ever: after a while they simply stop where
  // they are (a blocked path must not hold up the conversation)
  async arrive(walks, actors, sec = 7) {
    let late = false;
    await Promise.race([Promise.all(walks), this.wait(sec).then(() => { late = true; })]);
    if (late) actors.forEach(a => a.stop?.());
  }
  // before talking, the visitor and a painted animal walk towards each other
  async meet(i) {
    const h = this.hosts[i];
    if (!h || !h.awake) return;
    if (h.host.inPlace) {                        // it stays in the painting: the visitor walks over to it
      const v = this.visitor, a = h.actor, side = Math.sign(v.position.x - a.position.x) || 1;
      const x = a.position.x + side * (this.widthOf(a) / 2 + this.widthOf(v) / 2 + 0.04);
      const goal = this.spot(x, Math.max(a.position.z + 0.06, v.position.z - 0.25), v);
      if (goal.distanceTo(v.position) > 0.2) await this.arrive([v.walkTo(goal, 0.3)], [v], 9);
      v.setDir?.(-side);
      return;
    }
    const v = this.visitor, a = h.actor, vp = v.position.clone();
    const side = Math.sign(a.position.x - vp.x) || 1, gap = (this.widthOf(v) + this.widthOf(a)) / 2 + 0.1;
    for (let k = 0; h.rising && k < 30; k++) await this.wait(0.1);      // let it finish getting up
    const dx = Math.abs(a.position.x - vp.x);
    // near enough to talk (not nose to nose): just turn to each other
    if (dx > gap * 0.85 && dx < gap * 2.2 && Math.abs(a.position.z - vp.z) < 0.22) {
      a.setDir(-side); v.setDir?.(side); return;
    }
    // the visitor stays where it is and turns; the painted animal comes over, unhurried
    const aT = this.spot(vp.x + side * gap * 1.15, vp.z - 0.04, a);
    h.meeting = true;
    await this.arrive([a.walkTo(aT, 0.26)], [a], 9);
    a.lastFlip = -9; a.setDir(-side); v.setDir(side);
    h.meeting = false;
    this.formAnchor = v.position.clone();       // everyone else stays where they are
  }

  // a painted animal leads the visitor somewhere close by ("follow me")
  async lead(i) {
    const h = this.hosts[i];
    if (!h || h.host.inPlace) return;
    const vp = this.visitor.position;
    const z = THREE.MathUtils.clamp(vp.z - 0.35, -this.paintU.uDepth.value * 0.5, 0.4);
    const x = THREE.MathUtils.clamp(vp.x + (vp.x > 0 ? -0.5 : 0.5), -this.pw / 2 + 0.25, this.pw / 2 - 0.25);
    h.called = true;
    const dest = this.spot(x, z, h.actor);
    const go = h.actor.walkTo(dest, 0.35);
    await this.wait(0.7);
    const follow = this.spot(dest.x + (vp.x > x ? 1 : -1) * (this.widthOf(h.actor) + this.widthOf(this.visitor)) / 2 * 1.2, dest.z + 0.08, this.visitor);
    await this.arrive([go, this.visitor.walkTo(follow, 0.35)], [h.actor, this.visitor]);
    h.actor.setDir(Math.sign(this.visitor.position.x - h.actor.position.x) || 1);
    h.called = false;
  }
  // everyone (or one) turns to face you, the person in front of the screen
  attendAll(on, only = null) {
    for (const a of [this.visitor, ...this.hosts.filter(h => h.awake).map(h => h.actor)]) {
      if (only && a !== only) continue;
      a.attend?.(on);
    }
  }
  actorOf(who) { return who === 'visitor' ? this.visitor : this.hosts[who]?.actor; }

  // walk the visitor to a screen point (mouse click or pinch in the air)
  walkVisitorToScreen(nx, ny) {
    if (!this.inside || this.locked) return;
    const ray = new THREE.Raycaster();
    ray.setFromCamera(new THREE.Vector2(nx, ny), this.camera);
    const gy = this.paintGroup.position.y + this.groundY(0.2);
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -gy);
    const hit = new THREE.Vector3();
    if (!ray.ray.intersectPlane(plane, hit)) return;
    const local = this.paintGroup.worldToLocal(hit.clone());
    local.x = THREE.MathUtils.clamp(local.x, -this.pw / 2 + 0.2, this.pw / 2 - 0.2);
    local.z = THREE.MathUtils.clamp(local.z, -this.paintU.uDepth.value * 0.6, 0.45);
    const dest = this.spot(local.x, local.z, this.visitor);
    this.visitor.walkTo(dest, 0.32);                // a calm walk, never a dash
  }
  // call a painted animal: it comes to the visitor
  async callHost(i) {
    const h = this.hosts[i];
    if (!h || h.host.inPlace) { h?.actor.nod(2); return; }
    h.called = true;
    const vp0 = this.visitor.position;
    const p = this.spot(vp0.x + (vp0.x > 0 ? -1 : 1) * (this.widthOf(this.visitor) + this.widthOf(h.actor)) / 2 * 1.2, vp0.z, h.actor);
    await h.actor.walkTo(p, 0.8, { run: true });
    h.actor.setDir(Math.sign(this.visitor.position.x - p.x) || 1);
    h.actor.nod(2);
    this.visitor.setDir(Math.sign(p.x - this.visitor.position.x) || 1);
    h.called = false;
  }

  screenshot() { this.renderer.render(this.scene, this.camera); return this.renderer.domElement.toDataURL('image/png'); }

  dispose() {
    this.renderer.setAnimationLoop(null);
    this.ro?.disconnect();
    this.visitor?.dispose(); this.hosts.forEach(h => h.actor.dispose());
    this.scene.traverse(o => { o.geometry?.dispose?.(); if (o.material) [].concat(o.material).forEach(m => { m.map?.dispose?.(); m.dispose?.(); }); });
    this.renderer.dispose(); this.renderer.domElement.remove();
  }
}

function wrapText(g, text, x, y, maxW, lh) {
  for (const line of wrapLines(g, text, maxW)) { g.fillText(line, x, y); y += lh; }
}

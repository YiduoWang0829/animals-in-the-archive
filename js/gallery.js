// The gallery and the painting space.
//
// A dark room: wall, floor, a spotlit gilded frame. The painting is a relief
// built from its depth map, seen through a window cut in the wall, so even in
// the gallery it has a little depth. The visitor animal walks in across the
// floor, looks back at you, and stops below the picture. A painted animal comes
// alive in the picture. On "yes" the visitor climbs into the frame, the camera
// passes through it, the relief deepens, and the screen holds only the painting,
// now a space you are standing in.

import * as THREE from 'three';
import { Character } from './character.js';

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
  uniform sampler2D uMap, uPatch;
  uniform vec4 uPatchRect;                 // u0, v0, u1, v1
  uniform float uAway, uTime, uWind, uBright;
  varying vec2 vUv;
  varying float vD;
  void main() {
    vec2 st = vUv;
    float far = 1.0 - vD;
    // the picture breathes: distant foliage and sky sway a little
    st.x += sin(uTime * 1.1 + vUv.y * 18.0 + vUv.x * 9.0) * 0.0011 * far * smoothstep(0.3, 1.0, vUv.y) * uWind;
    st.y += cos(uTime * 0.9 + vUv.x * 14.0) * 0.0007 * far * smoothstep(0.4, 1.0, vUv.y) * uWind;
    vec3 c = texture2D(uMap, st).rgb;
    if (uAway > 0.0 && st.x > uPatchRect.x && st.x < uPatchRect.z && st.y > uPatchRect.y && st.y < uPatchRect.w) {
      vec2 q = (st - uPatchRect.xy) / (uPatchRect.zw - uPatchRect.xy);
      c = mix(c, texture2D(uPatch, q).rgb, uAway);
    }
    float v = 1.0 - length((vUv - 0.5) * vec2(0.9, 1.1)) * 0.35;  // soft spotlight falloff
    gl_FragColor = vec4(c * uBright * v, 1.0);
    #include <colorspace_fragment>
  }
`;

const loadTex = (loader, url) => new Promise((res, rej) => loader.load(url, res, undefined, rej));
const loadImg = url => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
const ease = t => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;

export class Gallery {
  constructor(container, opts) {
    this.container = container;
    this.o = opts;            // { work, workText, visitorImage, visitorHead, visitorLit, visitorGait, host, hostMeta, onFrame }
    this.clock = new THREE.Clock();
    this.tweens = [];
    this.parallax = new THREE.Vector2();      // from head tracking or the mouse, -1..1
    this.inside = false;
  }

  async init() {
    const { work } = this.o;
    const r = this.renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    r.setPixelRatio(Math.min(devicePixelRatio, 2));
    r.outputColorSpace = THREE.SRGBColorSpace;
    r.toneMapping = THREE.ACESFilmicToneMapping; r.toneMappingExposure = 1.0;
    r.shadowMap.enabled = false;
    Object.assign(r.domElement.style, { width: '100%', height: '100%', display: 'block' });
    this.container.appendChild(r.domElement);

    const scene = this.scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0b0a09);
    scene.fog = new THREE.Fog(0x0b0a09, 7, 16);
    const cam = this.camera = new THREE.PerspectiveCamera(40, 1, 0.02, 60);
    this.camBase = new THREE.Vector3(0, 1.25, 5.4);
    this.camLook = new THREE.Vector3(0, 1.18, 0);
    cam.position.copy(this.camBase);

    // ---- painting geometry ------------------------------------------------
    const [W, H] = work.size;
    const pw = this.pw = work.realWidth, ph = this.ph = pw * H / W;
    const cy = this.cy = Math.max(1.5, ph / 2 + 0.62);
    this.bottom = cy - ph / 2;
    const tl = new THREE.TextureLoader();
    const [map, depth] = await Promise.all([loadTex(tl, work.hd), loadTex(tl, work.depth)]);
    map.colorSpace = THREE.SRGBColorSpace; map.anisotropy = 8;
    this.depthImg = depth.image;
    this.paintU = {
      uMap: { value: map }, uDepthTex: { value: depth }, uPatch: { value: null },
      uPatchRect: { value: new THREE.Vector4(2, 2, 2, 2) }, uAway: { value: 0 },
      uDepth: { value: pw * 0.16 }, uEdge: { value: 1 }, uTime: { value: 0 }, uWind: { value: 1 }, uBright: { value: 1.0 },
    };
    const segX = 220, segY = Math.round(220 * ph / pw);
    this.paintGroup = new THREE.Group();
    this.paintGroup.position.set(0, cy, 0);
    const painting = new THREE.Mesh(new THREE.PlaneGeometry(pw, ph, segX, segY),
      new THREE.ShaderMaterial({ uniforms: this.paintU, vertexShader: PAINT_VERT, fragmentShader: PAINT_FRAG }));
    painting.position.z = -0.03;
    this.paintGroup.add(painting);
    scene.add(this.paintGroup);
    // black box behind the window so the relief's edges disappear into darkness
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

    // gilded frame
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
    g.fillStyle = '#1d1a16'; g.font = 'italic 400 34px "Cormorant Garamond", Georgia, serif';
    wrapText(g, this.o.workText.title, 30, 100, 460, 38);
    g.font = '400 20px Inter, sans-serif'; g.fillStyle = '#3a342c';
    g.fillText(`${this.o.workText.artist}`.slice(0, 44), 30, 232); g.fillText(this.o.workText.date, 30, 262);
    const labelTex = new THREE.CanvasTexture(lc); labelTex.colorSpace = THREE.SRGBColorSpace;
    const label = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.196), new THREE.MeshStandardMaterial({ map: labelTex, roughness: 0.8 }));
    label.position.set(pw / 2 + 0.42, 1.25, 0.012); scene.add(label);

    // lights
    scene.add(new THREE.HemisphereLight(0xfff1df, 0x16120e, 0.35));
    const spot = new THREE.SpotLight(0xffe6c4, 70, 12, 0.5, 0.65, 1.6);
    spot.position.set(0, 4.6, 3.0); spot.target.position.set(0, cy, 0);
    scene.add(spot, spot.target);
    const floorSpot = new THREE.SpotLight(0xfff0dc, 26, 10, 0.55, 0.8, 1.5);
    floorSpot.position.set(-1.0, 4.8, 3.2); floorSpot.target.position.set(-0.8, 0, 1.6);
    scene.add(floorSpot, floorSpot.target);

    // ---- characters --------------------------------------------------------
    const v = this.visitor = new Character(this.o.visitorImage, {
      height: 0.55, headSide: this.o.visitorHead, lit: this.o.visitorLit, gait: this.o.visitorGait,
    }).addTo(scene);
    v.setPaint(work.style, this.frameRect, 0.0);
    v.uniforms.uSpot.value.set(-0.8, 0, 1.6);
    v.position.set(-4.6, 0, 1.8);
    v.setDir(1, true);

    const hm = this.o.hostMeta, host = this.o.host;
    const sprite = await loadImg(host.sprite);
    const [bx0, by0, bx1, by1] = hm.box;
    const hh = (by1 - by0) / H * ph;
    const h = this.host = new Character(sprite, { height: hh, headSide: host.faces });
    h.uniforms.uLight.value = 1.0;
    h.uniforms.uSpot.value.set(0, 0, 0);
    h.shadow.visible = false;
    this.paintGroup.add(h.group);                      // painting-local coordinates from here on
    this.hostHome = this.paintPoint((bx0 + bx1) / 2 / W, 1 - by1 / H, 0.004);
    h.position.copy(this.hostHome);
    h.setDir(host.faces === 'right' ? 1 : -1, true);
    if (!host.inPlace) {
      const patch = await loadTex(tl, host.patch); patch.colorSpace = THREE.SRGBColorSpace;
      this.paintU.uPatch.value = patch;
      this.paintU.uPatchRect.value.set(bx0 / W, 1 - by1 / H, bx1 / W, 1 - by0 / H);
    }
    h.mesh.renderOrder = 3;

    // ---- loop --------------------------------------------------------------
    this.onResize = () => {
      const w = this.container.clientWidth, hgt = this.container.clientHeight;
      r.setSize(w, hgt, false); cam.aspect = w / hgt; cam.updateProjectionMatrix();
      // keep the whole picture in view on narrow screens
      const need = (pw + 1.6) / 2 / Math.tan(THREE.MathUtils.degToRad(cam.fov / 2)) / cam.aspect;
      if (!this.inside) this.camBase.z = Math.max(5.4, Math.min(need + 0.5, 9));
    };
    this.ro = new ResizeObserver(this.onResize); this.ro.observe(this.container); this.onResize();
    r.setAnimationLoop(() => this.tick());
  }

  // painting-local point (group space) for uv (u right, v up) at the relief surface
  paintPoint(u, v, lift = 0) {
    const img = this.depthImg;
    if (!this._dctx) {
      const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
      this._dctx = c.getContext('2d', { willReadFrequently: true }); this._dctx.drawImage(img, 0, 0);
      this._ddata = this._dctx.getImageData(0, 0, img.width, img.height).data;
    }
    const x = Math.min(img.width - 1, Math.max(0, Math.round(u * img.width)));
    const y = Math.min(img.height - 1, Math.max(0, Math.round((1 - v) * img.height)));
    const d = this._ddata[(y * img.width + x) * 4] / 255;
    return new THREE.Vector3((u - 0.5) * this.pw, (v - 0.5) * this.ph, -0.03 - (1 - d) * this.paintU.uDepth.value + lift);
  }

  tween(dur, fn) {
    return new Promise(res => this.tweens.push({ t: 0, dur, fn, res }));
  }

  tick() {
    const dt = Math.min(0.05, this.clock.getDelta());
    this.simT = (this.simT || 0) + dt;
    this.step(dt, this.simT);
    this.renderer.render(this.scene, this.camera);
    this.o.onFrame?.(this);
  }

  // advance the simulation by fixed steps without waiting for animation frames
  // (used for testing; real visitors are driven by tick())
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
    if (this.inside) {      // inside the picture: lit like the painting, not by the gallery spot
      for (const c of [this.visitor, this.host]) c.mesh.getWorldPosition(c.uniforms.uSpot.value);
    }
    this.visitor.update(dt, t);
    this.host.update(dt, t);
    // head-coupled parallax: move your head (or the mouse) and the room shifts
    const cam = this.camera, px = this.parallax;
    const k = this.inside ? 0.16 : 0.55;
    cam.position.x += (this.camBase.x + px.x * k - cam.position.x) * 0.08;
    cam.position.y += (this.camBase.y + px.y * k * 0.5 - cam.position.y) * 0.08;
    cam.position.z += (this.camBase.z - cam.position.z) * 0.08;
    cam.lookAt(this.camLook);
  }

  // screen position (CSS px) of a world point, for speech bubbles
  project(p) {
    const v = p.clone().project(this.camera);
    const rc = this.renderer.domElement.getBoundingClientRect();
    return { x: rc.left + (v.x + 1) / 2 * rc.width, y: rc.top + (1 - v.y) / 2 * rc.height, behind: v.z > 1 };
  }
  anchor(who) {
    const c = who === 'host' ? this.host : this.visitor;
    const p = new THREE.Vector3(); c.mesh.getWorldPosition(p);
    const s = new THREE.Vector3(); c.mesh.getWorldScale(s);
    return p.add(new THREE.Vector3(0, Math.abs(s.y) * 1.02, 0));
  }

  // ---- choreography --------------------------------------------------------
  async walkIn() {
    const v = this.visitor;
    await v.walkTo(new THREE.Vector3(-1.35, 0, 1.25), 0.75);
  }
  // turn toward the viewer: a 3/4 turn of the body, a nod and a little hop
  async lookBack(side = 1) {
    const v = this.visitor;
    v.setDir(side);
    await this.tween(0.5, e => { v.mesh.rotation.y = e * 0.55 * -side; });
    v.nod(2); v.hopOnce(0.06);
    await this.tween(1.1, () => {});
  }
  async faceAway() {
    const v = this.visitor;
    await this.tween(0.4, e => { v.mesh.rotation.y = (1 - e) * v.mesh.rotation.y; });
    v.mesh.rotation.y = 0;
  }
  async approach() {
    await this.faceAway();
    await this.visitor.walkTo(new THREE.Vector3(-0.35, 0, 0.55), 0.7);
    this.visitor.setDir(1);
  }
  // the painted animal comes alive: shakes itself, turns, steps to the front of the picture
  async wakeHost() {
    const h = this.host, hostOpts = this.o.host;
    h.hopOnce(0.04 * h.height / 0.3);
    await this.tween(0.5, () => {});
    h.nod(2);
    if (hostOpts.inPlace) {
      // too big to leave its place: it lifts its head and stamps
      h.uniforms.uWalk.value = 0.25;
      await this.tween(1.0, (e) => { h.uniforms.uPhase.value = e * Math.PI * 2; });
      h.uniforms.uWalk.value = 0;
      return;
    }
    // reveal the ground it was painted on, and walk to the front edge of the picture
    this.tween(1.2, e => { this.paintU.uAway.value = e; });
    const front = this.paintPoint(0.5 + (this.hostHome.x / this.pw) * 0.6, 0.06, 0);
    front.z = 0.02;                                   // at the picture plane, facing the visitor
    front.x = THREE.MathUtils.clamp(this.hostHome.x * 0.5 + 0.25, -this.pw / 2 + h.height, this.pw / 2 - h.height);
    await h.walkTo(front, 0.45);
    h.setDir(-1);
  }
  async hostRefuses() {
    const h = this.host;
    h.setDir(h.dir * -1);
    await this.tween(1.2, e => { h.uniforms.uLight.value = 1 - e * 0.25; });
    this.visitor.setDir(-1);
    await this.lookBack(-1);
  }

  // climb into the picture and pass through the frame
  async enter() {
    const v = this.visitor, h = this.host;
    await this.faceAway();
    v.setDir(1);
    // hop up onto the frame's lower edge
    const from = v.position.clone(), to = new THREE.Vector3(-0.2, this.bottom + 0.005, 0.03);
    v.shadow.visible = false;
    await this.tween(0.75, (e, raw) => {
      v.position.lerpVectors(from, to, raw);
      v.position.y += Math.sin(raw * Math.PI) * 0.35;
    });
    // step in: the relief opens up and the camera follows through the frame
    this.paintGroup.attach(v.group);
    this.inside = true;
    const depth0 = this.paintU.uDepth.value, depth1 = this.pw * 0.38;
    const camFrom = this.camBase.clone(), lookFrom = this.camLook.clone();
    // fill the screen with the picture: fit whichever side is tighter
    const vf = THREE.MathUtils.degToRad(this.camera.fov / 2);
    // overscan: the picture slightly overfills the screen, so moving your head never shows its edges
    const dist = Math.min(this.ph / 2 / Math.tan(vf), this.pw / 2 / (Math.tan(vf) * this.camera.aspect)) * 0.8;
    const recede = dist + 0.3;                           // the picture moves back so the camera passes the frame
    const camTo = new THREE.Vector3(0, this.cy, dist - recede - 0.03), lookTo = new THREE.Vector3(0, this.cy, -recede);
    const inside = this.paintPoint(0.42, 0.1, 0); inside.z += 0.3;
    const h0 = v.height, h1 = Math.max(0.12, Math.min(this.host.height * 1.1, this.ph * 0.28));
    v.walkTo(inside, 0.5);
    await this.tween(3.4, e => {
      this.paintU.uDepth.value = depth0 + (depth1 - depth0) * e;
      this.paintU.uEdge.value = 1 - e * 0.6;
      this.camBase.lerpVectors(camFrom, camTo, e);
      this.camLook.lerpVectors(lookFrom, lookTo, e);
      this.paintGroup.position.z = -e * recede;
      v.setHeight(h0 + (h1 - h0) * e);                   // takes the scale of the painted animals
    });
    v.uniforms.uPaintAll.value = 1;
    // both animals come forward and meet
    if (!this.o.host.inPlace) {
      const meet = new THREE.Vector3(0.16, -this.ph / 2 + this.ph * 0.24, 0.55);
      v.walkTo(new THREE.Vector3(-0.2, meet.y, 0.6), 0.45);
      await h.walkTo(meet, 0.4);
      h.setDir(-1); v.setDir(1);
    } else {
      await v.walkTo(new THREE.Vector3(-this.pw * 0.18, -this.ph / 2 + this.ph * 0.24, 0.6), 0.45);
    }
  }

  // inside the painting: walk the visitor to a point on screen (mouse or finger)
  walkVisitorToScreen(nx, ny) {
    if (!this.inside) return;
    const ray = new THREE.Raycaster();
    ray.setFromCamera(new THREE.Vector2(nx, ny), this.camera);
    // a ground plane inside the picture, just above its lower edge
    const gy = this.paintGroup.position.y - this.ph / 2 + this.ph * 0.08;
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -gy);
    const hit = new THREE.Vector3();
    if (!ray.ray.intersectPlane(plane, hit)) return;
    const local = this.paintGroup.worldToLocal(hit.clone());
    local.x = THREE.MathUtils.clamp(local.x, -this.pw / 2 + 0.2, this.pw / 2 - 0.2);
    local.z = THREE.MathUtils.clamp(local.z, -this.paintU.uDepth.value * 0.7, 0.8);
    this.visitor.walkTo(local, 0.55);
  }

  screenshot() { this.renderer.render(this.scene, this.camera); return this.renderer.domElement.toDataURL('image/png'); }

  dispose() {
    this.renderer.setAnimationLoop(null);
    this.ro?.disconnect();
    this.visitor?.dispose(); this.host?.dispose();
    this.scene.traverse(o => { o.geometry?.dispose?.(); if (o.material) [].concat(o.material).forEach(m => { m.map?.dispose?.(); m.dispose?.(); }); });
    this.renderer.dispose(); this.renderer.domElement.remove();
  }
}

function wrapText(g, text, x, y, maxW, lh) {
  let line = '';
  for (const w of text.split(' ')) {
    const test = line ? line + ' ' + w : w;
    if (g.measureText(test).width > maxW && line) { g.fillText(line, x, y); y += lh; line = w; } else line = test;
  }
  g.fillText(line, x, y);
}

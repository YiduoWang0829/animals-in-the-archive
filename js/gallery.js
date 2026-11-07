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
  uniform sampler2D uMap;
  uniform float uTime, uWind, uBright;
  varying vec2 vUv;
  varying float vD;
  void main() {
    vec2 st = vUv;
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
    this.view = { yaw: 0, pitch: 0, zoom: 0, ty: 0, tp: 0, tz: 0 };   // inside: look around + zoom
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
    const depth = new THREE.Texture(depthImg); depth.needsUpdate = true;
    this.depthImg = depthImg;
    this.paintU = {
      uMap: { value: map }, uDepthTex: { value: depth },
      uDepth: { value: pw * 0.16 }, uEdge: { value: 1 }, uTime: { value: 0 }, uWind: { value: 0 }, uBright: { value: 1.0 },
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
    g.fillStyle = '#1d1a16'; g.font = 'italic 400 34px "Cormorant Garamond", Georgia, serif';
    wrapText(g, this.o.workText.title, 30, 100, 460, 38);
    g.font = '400 20px Inter, sans-serif'; g.fillStyle = '#3a342c';
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

    // ---- visitor ------------------------------------------------------------
    const v = this.visitor = this.o.visitor;
    v.addTo(scene);
    v.setPaint?.(work.style, this.frameRect, 0.0);
    v.setSpot?.(new THREE.Vector3(-0.8, 0, 1.6));
    v.position.set(-3.0, 0, 1.75);
    v.setDir(1, true);

    // ---- painted animals ------------------------------------------------------
    for (const { host, meta } of this.o.hosts) {
      const sprite = await loadImg(host.sprite);
      const [bx0, by0, bx1, by1] = meta.box;
      const hh = (by1 - by0) / H * ph;
      const a = new Character(sprite, { height: hh, headSide: host.faces });
      a.shadow.visible = false;
      this.paintGroup.add(a.group); this.paintGroup.add(a.shadow);
      const home = this.paintPoint((bx0 + bx1) / 2 / W, 1 - by1 / H, 0.004);
      a.position.copy(home);
      a.setDir(host.faces === 'right' ? 1 : -1, true);
      a.mesh.renderOrder = 3;
      this.hosts.push({ actor: a, host, meta, home, awake: false, away: false, next: rand(2, 5), patch: null });
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
    const [x0, y0, x1, y1] = h.meta.box, s = this.plate.width / this.W;
    this.plateCtx.drawImage(patch, x0 * s, y0 * s, (x1 - x0) * s, (y1 - y0) * s);
    this.map.needsUpdate = true;
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
    }
    // where the visitor looks: at you when you move your head or raise a hand, or when it
    // talks to you; otherwise at whoever is speaking. The point follows your head/hand.
    const v = this.visitor;
    if (v.aimChain) {
      const c = this.camera, u = this.userGaze;
      const atYou = v.attending || (u && u.active);
      if (atYou && !v.target) {
        const g = c.position.clone();
        const right = new THREE.Vector3(1, 0, 0).applyQuaternion(c.quaternion), up = new THREE.Vector3(0, 1, 0).applyQuaternion(c.quaternion);
        if (u) g.addScaledVector(right, (u.x - 0.5) * 2.6).addScaledVector(up, (0.5 - u.y) * 1.2);
        v.gazeAt = g;
      } else if (!v.target && this.gazeHost != null && this.hosts[this.gazeHost]?.awake) v.gazeAt = this.hosts[this.gazeHost].actor.topWorld();
      else v.gazeAt = null;
    }
    this.visitor.update(dt, t);
    for (const h of this.hosts) h.actor.update(dt, t);
    this.updateCamera();
  }

  updateCamera() {
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
    v.yaw += (v.ty - v.yaw) * 0.1; v.pitch += (v.tp - v.pitch) * 0.1; v.zoom += (v.tz - v.zoom) * 0.1;
    const vis = this.visitor, T = new THREE.Vector3();
    vis.group.getWorldPosition(T);
    T.y += vis.height * 0.55;
    const base = Math.max(vis.height * 4.2, (this.viewDist || 2) * 0.72);
    const D = THREE.MathUtils.clamp(base * (1 - v.zoom), vis.height * 3.0, base * 1.3);
    const pitch = 0.16 + v.pitch;
    const want = new THREE.Vector3(T.x + Math.sin(v.yaw) * Math.cos(pitch) * D, T.y + Math.sin(pitch) * D, T.z + Math.cos(v.yaw) * Math.cos(pitch) * D);
    // keep the picture's edges out of view
    const planeZ = this.paintGroup.position.z, dPlane = Math.max(0.2, want.z - planeZ);
    const halfH = Math.tan(THREE.MathUtils.degToRad(cam.fov / 2)) * dPlane, halfW = halfH * cam.aspect;
    const cx = this.paintGroup.position.x, cy = this.paintGroup.position.y;
    want.x = THREE.MathUtils.clamp(want.x, cx - Math.max(0, this.pw / 2 * 0.92 - halfW), cx + Math.max(0, this.pw / 2 * 0.92 - halfW));
    want.y = THREE.MathUtils.clamp(want.y, cy - Math.max(0, this.ph / 2 * 0.92 - halfH), cy + Math.max(0, this.ph / 2 * 0.92 - halfH));
    want.x += px.x * 0.04; want.y += px.y * 0.03;                     // a touch of head parallax
    cam.position.lerp(want, 0.08);
    this.lookAtPt = (this.lookAtPt || T.clone()).lerp(new THREE.Vector3(T.x, T.y, T.z - 0.15), 0.12);
    cam.lookAt(this.lookAtPt);
  }

  // ---- VR-style controls inside the painting (mouse drag, wheel, head, hands)
  // orbit around your animal (relative, e.g. a mouse drag) …
  look(dx, dy) {
    if (!this.inside) return;
    this.view.ty = THREE.MathUtils.clamp(this.view.ty - dx * 3.2, -0.6, 0.6);
    this.view.tp = THREE.MathUtils.clamp(this.view.tp + dy * 2.4, -0.12, 0.45);
  }
  // … or directly to an angle (e.g. where your open hand is)
  lookTo(yaw, pitch) {
    if (!this.inside) return;
    this.view.ty = THREE.MathUtils.clamp(yaw, -0.6, 0.6); this.view.tp = THREE.MathUtils.clamp(pitch, -0.12, 0.45);
  }
  orbitBy(d) { if (this.inside) this.view.ty = THREE.MathUtils.clamp(this.view.ty + d, -0.65, 0.65); }
  zoomTo(z) { if (this.inside) this.view.tz = THREE.MathUtils.clamp(z, -0.3, 0.45); }
  zoomBy(d) {
    if (!this.inside) return;
    this.view.tz = THREE.MathUtils.clamp(this.view.tz + d, -0.3, 0.45);
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
  async walkIn() { await this.visitor.walkTo([new THREE.Vector3(-1.9, 0, 1.5), new THREE.Vector3(-1.0, 0, 1.25)], 0.32); }
  // stand and face a direction (null = free), or face you
  async goTo(points, speed = 0.32) { this.visitor.face?.(null); await this.visitor.walkTo(points, speed); }
  async toLabel() {
    await this.goTo([new THREE.Vector3(this.labelX - 0.25, 0, 0.9), new THREE.Vector3(this.labelX - 0.05, 0, 0.62)]);
    this.visitor.face?.(Math.PI); this.visitor.setDir(1);
    await this.wait(0.8);
  }
  async toPainting() {
    await this.goTo([new THREE.Vector3(this.labelX * 0.5, 0, 1.0), new THREE.Vector3(0.05, 0, 1.05)]);
    this.visitor.face?.(Math.PI);
    await this.wait(1.2);
  }
  talkToYou(on) { this.visitor.face?.(null); this.visitor.attend?.(on); }

  // inside: the painted animals were only paint; they freeze, then all look at the visitor
  async startle() {
    const vp = this.visitor.position;
    for (const h of this.hosts) {
      h.actor.hopOnce(0.05 * h.actor.height / 0.3);
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
    this.revealGround(h);
    h.actor.ground = (x, z) => this.groundY(z);
    h.actor.shadow.visible = true;
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
    const h0 = v.height, ref = this.hosts.find(h => !h.host.inPlace)?.actor.height ?? this.ph * 0.15;
    const h1 = Math.max(0.1, Math.min(Math.max(ref * 0.9, this.ph * 0.1), this.ph * 0.15));   // the size of the painted animals
    // keep walking forward, into the depth of the picture (away from you)
    const inside = new THREE.Vector3(-0.1, this.groundY(-0.22), -0.22);
    v.walkTo(inside, 0.22);
    this.keyLight.intensity = 0;
    await this.tween(3.6, e => {
      this.paintU.uDepth.value = depth0 + (depth1 - depth0) * e;
      this.camBase.lerpVectors(camFrom, camTo, e);
      this.camLook.lerpVectors(lookFrom, lookTo, e);
      this.paintGroup.position.z = -e * recede;
      v.setHeight(h0 + (h1 - h0) * e);
      this.keyLight.intensity = e * 1.6;
    });
    v.setPaintAll?.(1);
    this.paintU.uWind.value = 1;             // inside, the picture breathes
    this.follow = true;                      // from now on the view keeps the visitor in sight
    this.lastLook = -99;
    await this.wait(1.5);
  }

  // a believable "ground" inside the picture: further back is higher up
  groundY(z) { return -this.ph / 2 + this.ph * 0.22 + (0.4 - z) * 0.22; }
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
      if (h.called || h.meeting) return;
      if (settled) { if (!a.target && !a.attending) a.setDir(Math.sign(vp.x - a.position.x) || 1); return; }
      // alternate right / left of the visitor, further out each time, a step back each time
      let tx;
      if (side > 0) { tx = vp.x + reachR + 0.08 + w / 2; reachR += w + 0.08; }
      else { tx = vp.x - reachL - 0.08 - w / 2; reachL += w + 0.08; }
      side = -side;
      const tz = THREE.MathUtils.clamp(vp.z - 0.1 - k * 0.12, -this.paintU.uDepth.value * 0.6, 0.42);
      tx = THREE.MathUtils.clamp(tx, -this.pw / 2 + w / 2, this.pw / 2 - w / 2);
      const target = new THREE.Vector3(tx, this.groundY(tz), tz);
      const d = target.distanceTo(a.position);
      if (d > 0.12 && (!a.target || a.target.distanceTo(target) > 0.18)) { h.placed = false; a.walkTo(target, d > 0.7 ? 0.9 : 0.4, { run: d > 0.7 }).then(() => { h.placed = true; }); }
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
      const mover = B, sgn = Math.sign(B.position.x - A.position.x) || 1;
      mover.position.x = THREE.MathUtils.clamp(mover.position.x + sgn * Math.min(ov, 0.02), -this.pw / 2 + wb / 2, this.pw / 2 - wb / 2);
      mover.position.z = Math.max(-this.paintU.uDepth.value * 0.6, mover.position.z - 0.006);
      mover.position.y = this.groundY(mover.position.z);
      if (mover.target) { mover.target.x += sgn * Math.min(ov, 0.02); }
    }
    // draw order follows depth: nearer figures are drawn last (no flicker)
    const all = [v, ...this.hosts.map(h => h.actor)];
    const wp = new THREE.Vector3();
    all.map(a => { a.group.getWorldPosition(wp); return [a, wp.z]; }).sort((x, y) => x[1] - y[1])
      .forEach(([a], i) => a.group.traverse(o => { if (o.isMesh) o.renderOrder = 10 + i; }));
  }
  // before talking, the visitor and a painted animal walk towards each other
  async meet(i) {
    const h = this.hosts[i];
    if (!h || !h.awake || h.host.inPlace) return;
    const v = this.visitor, a = h.actor, vp = v.position.clone();
    const side = Math.sign(a.position.x - vp.x) || 1, gap = (this.widthOf(v) + this.widthOf(a)) / 2 + 0.1;
    const mid = vp.clone().lerp(a.position, 0.35);
    const vT = new THREE.Vector3(mid.x - side * gap * 0.5, 0, THREE.MathUtils.clamp(mid.z, -this.paintU.uDepth.value * 0.5, 0.42));
    vT.y = this.groundY(vT.z);
    const aT = new THREE.Vector3(vT.x + side * gap, 0, vT.z - 0.04); aT.y = this.groundY(aT.z);
    h.meeting = true;
    await Promise.all([v.walkTo(vT, 0.35), a.walkTo(aT, 0.35)]);
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
    const dest = new THREE.Vector3(x, this.groundY(z), z);
    const go = h.actor.walkTo(dest, 0.35);
    await this.wait(0.7);
    const follow = dest.clone(); follow.x += vp.x > x ? 0.3 : -0.3; follow.z += 0.12; follow.y = this.groundY(follow.z);
    await Promise.all([go, this.visitor.walkTo(follow, 0.35)]);
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
    if (!this.inside) return;
    const ray = new THREE.Raycaster();
    ray.setFromCamera(new THREE.Vector2(nx, ny), this.camera);
    const gy = this.paintGroup.position.y + this.groundY(0.2);
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -gy);
    const hit = new THREE.Vector3();
    if (!ray.ray.intersectPlane(plane, hit)) return;
    const local = this.paintGroup.worldToLocal(hit.clone());
    local.x = THREE.MathUtils.clamp(local.x, -this.pw / 2 + 0.2, this.pw / 2 - 0.2);
    local.z = THREE.MathUtils.clamp(local.z, -this.paintU.uDepth.value * 0.6, 0.45);
    local.y = this.groundY(local.z);
    this.visitor.walkTo(local, 0.55, { run: local.distanceTo(this.visitor.position) > 0.8 });
  }
  // call a painted animal: it comes to the visitor
  async callHost(i) {
    const h = this.hosts[i];
    if (!h || h.host.inPlace) { h?.actor.nod(2); return; }
    h.called = true;
    const p = this.visitor.position.clone();
    p.x += p.x > 0 ? -0.3 : 0.3; p.y = this.groundY(p.z);
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
  let line = '';
  for (const w of text.split(' ')) {
    const test = line ? line + ' ' + w : w;
    if (g.measureText(test).width > maxW && line) { g.fillText(line, x, y); y += lh; line = w; } else line = test;
  }
  g.fillText(line, x, y);
}

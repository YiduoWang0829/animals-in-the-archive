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
    r.setPixelRatio(Math.min(devicePixelRatio, 2));
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
    const cy = this.cy = Math.max(1.5, ph / 2 + 0.62);
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
      uDepth: { value: pw * 0.16 }, uEdge: { value: 1 }, uTime: { value: 0 }, uWind: { value: 1 }, uBright: { value: 1.0 },
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
    v.position.set(-4.6, 0, 1.8);
    v.setDir(1, true);

    // ---- painted animals ------------------------------------------------------
    for (const { host, meta } of this.o.hosts) {
      const sprite = await loadImg(host.sprite);
      const [bx0, by0, bx1, by1] = meta.box;
      const hh = (by1 - by0) / H * ph;
      const a = new Character(sprite, { height: hh, headSide: host.faces });
      a.shadow.visible = false;
      this.paintGroup.add(a.group);
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

  // paint the ground back where an animal stood (fades in over ~1 s)
  async revealGround(h) {
    if (h.host.inPlace || h.away) return;
    h.away = true;
    const patch = await loadImg(h.host.patch);
    const [x0, y0, x1, y1] = h.meta.box, s = this.plate.width / this.W;
    for (let i = 1; i <= 10; i++) {
      await this.tween(0.1, () => {});
      this.plateCtx.globalAlpha = 0.35;
      this.plateCtx.drawImage(patch, x0 * s, y0 * s, (x1 - x0) * s, (y1 - y0) * s);
      this.plateCtx.globalAlpha = 1;
      this.map.needsUpdate = true;
    }
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
    this.visitor.update(dt, t);
    for (const h of this.hosts) h.actor.update(dt, t);
    this.updateCamera();
  }

  updateCamera() {
    const cam = this.camera, px = this.parallax, v = this.view;
    if (!this.inside) {
      const k = 0.55;
      cam.position.x += (this.camBase.x + px.x * k - cam.position.x) * 0.08;
      cam.position.y += (this.camBase.y + px.y * k * 0.5 - cam.position.y) * 0.08;
      cam.position.z += (this.camBase.z - cam.position.z) * 0.08;
      cam.lookAt(this.camLook);
      return;
    }
    // inside: zoom moves you into the picture; looking around pans across it.
    // The pan is limited so the edge of the painting never comes into view.
    v.zoom += (v.tz - v.zoom) * 0.08;
    const D = Math.max(0.2, this.viewDist - v.zoom);          // distance to the picture plane
    const halfH = Math.tan(THREE.MathUtils.degToRad(cam.fov / 2)) * D, halfW = halfH * cam.aspect;
    const maxX = Math.max(0, this.pw / 2 * 0.97 - halfW), maxY = Math.max(0, this.ph / 2 * 0.97 - halfH);
    v.ty = THREE.MathUtils.clamp(v.ty, -maxX, maxX); v.tp = THREE.MathUtils.clamp(v.tp, -maxY, maxY);
    v.yaw += (v.ty - v.yaw) * 0.08; v.pitch += (v.tp - v.pitch) * 0.08;
    const pos = this.camBase.clone();
    pos.x += v.yaw + px.x * 0.1 * (maxX > 0.05 ? 1 : 0.4);
    pos.y += v.pitch + px.y * 0.05;
    pos.z -= v.zoom;
    cam.position.lerp(pos, 0.15);
    // a slight turn toward where you are looking gives the depth its parallax
    const look = new THREE.Vector3(pos.x + v.yaw * 0.25, pos.y + v.pitch * 0.25, pos.z - 1);
    cam.lookAt(look);
  }

  // ---- VR-style controls inside the painting (mouse drag, wheel, head, hands)
  look(dx, dy) {                       // pan across the picture (metres-ish units)
    if (!this.inside) return;
    this.view.ty += dx * 1.6; this.view.tp += dy * 1.6;
  }
  zoomBy(d) {
    if (!this.inside) return;
    this.view.tz = THREE.MathUtils.clamp(this.view.tz + d, -0.25, this.maxZoom || 1);
  }

  // screen position (CSS px) of a world point, for speech bubbles
  project(p) {
    const v = p.clone().project(this.camera);
    const rc = this.renderer.domElement.getBoundingClientRect();
    return { x: rc.left + (v.x + 1) / 2 * rc.width, y: rc.top + (1 - v.y) / 2 * rc.height, behind: v.z > 1 || v.z < -1 };
  }
  anchor(who) { return (who === 'visitor' ? this.visitor : this.hosts[who].actor).topWorld(); }

  // which painted animal is under a screen point (normalised -1..1)?
  hostAt(nx, ny) {
    const ray = new THREE.Raycaster(); ray.setFromCamera(new THREE.Vector2(nx, ny), this.camera);
    const hits = ray.intersectObjects(this.hosts.filter(h => h.awake).map(h => h.actor.mesh), false);
    return hits.length ? this.hosts.findIndex(h => h.actor.mesh === hits[0].object) : -1;
  }

  // ---- choreography (gallery) ---------------------------------------------
  async walkIn() { await this.visitor.walkTo(new THREE.Vector3(-1.35, 0, 1.25), 0.75); }
  // turn toward the viewer, nod and a little hop
  async lookBack(side = 1) {
    const v = this.visitor;
    v.setDir(side);
    await this.tween(0.5, e => v.lookTurn(e * 0.55 * -side));
    v.nod(2); v.hopOnce(0.06);
    await this.wait(1.1);
  }
  async faceAway() {
    const v = this.visitor, a0 = v.lookAngle;
    await this.tween(0.4, e => v.lookTurn((1 - e) * a0));
  }
  async approach() {
    await this.faceAway();
    await this.visitor.walkTo(new THREE.Vector3(-0.35, 0, 0.55), 0.7);
    this.visitor.setDir(1);
  }

  // a painted animal comes alive and steps to the front of the picture (slot -1..1 spreads them)
  async wakeHost(i, slot = 0) {
    const h = this.hosts[i], a = h.actor;
    h.awake = true;
    a.hopOnce(0.04 * a.height / 0.3);
    await this.wait(0.45);
    a.nod(2);
    if (h.host.inPlace) {                       // too big to leave: it lifts its head and stamps
      a.uniforms.uWalk.value = 0.25;
      await this.tween(1.0, e => { a.uniforms.uPhase.value = e * Math.PI * 2; });
      a.uniforms.uWalk.value = 0;
      return;
    }
    this.revealGround(h);
    const front = this.paintPoint(0.5, 0.06, 0);
    front.z = 0.02;
    front.x = THREE.MathUtils.clamp(0.15 + slot * this.pw * 0.22, -this.pw / 2 + a.height, this.pw / 2 - a.height);
    await a.walkTo(front, 0.45, { run: Math.random() < 0.4 });
    a.setDir(-1);
  }
  async hostsRefuse() {
    for (const h of this.hosts.filter(h => h.awake)) { h.actor.setDir(h.actor.dir * -1); h.actor.setLight(0.8); }
    this.visitor.setDir(-1);
    await this.lookBack(-1);
  }

  // ---- step into the picture ------------------------------------------------
  async enter() {
    const v = this.visitor;
    await this.faceAway();
    v.setDir(1);
    const from = v.position.clone(), to = new THREE.Vector3(-0.2, this.bottom + 0.005, 0.03);
    v.shadow.visible = false;
    await this.tween(0.75, (e, raw) => {
      v.position.lerpVectors(from, to, raw);
      v.position.y += Math.sin(raw * Math.PI) * 0.35;
    });
    this.paintGroup.attach(v.group);
    this.inside = true;
    const depth0 = this.paintU.uDepth.value, depth1 = this.pw * 0.38;
    const camFrom = this.camBase.clone(), lookFrom = this.camLook.clone();
    const vf = THREE.MathUtils.degToRad(this.camera.fov / 2);
    // overscan: the picture slightly overfills the screen
    const dist = Math.min(this.ph / 2 / Math.tan(vf), this.pw / 2 / (Math.tan(vf) * this.camera.aspect)) * 0.76;
    this.maxZoom = dist * 0.72; this.viewDist = dist;
    const recede = dist + 0.3;
    const camTo = new THREE.Vector3(0, this.cy, dist - recede - 0.03), lookTo = new THREE.Vector3(0, this.cy, -recede);
    const inside = this.paintPoint(0.42, 0.1, 0); inside.z += 0.3;
    const h0 = v.height, ref = this.hosts.find(h => !h.host.inPlace)?.actor.height ?? this.ph * 0.15;
    const h1 = Math.max(0.1, Math.min(ref * 0.85, this.ph * 0.17));
    v.walkTo(inside, 0.5);
    this.keyLight.intensity = 0;
    await this.tween(3.4, e => {
      this.paintU.uDepth.value = depth0 + (depth1 - depth0) * e;
      this.paintU.uEdge.value = 1 - e * 0.6;
      this.camBase.lerpVectors(camFrom, camTo, e);
      this.camLook.lerpVectors(lookFrom, lookTo, e);
      this.paintGroup.position.z = -e * recede;
      v.setHeight(h0 + (h1 - h0) * e);
      this.keyLight.intensity = e * 1.6;
    });
    v.setPaintAll?.(1);
    this.camera.position.copy(this.camBase);
    // everyone awake gathers near the visitor
    const meetY = this.groundY(0.32);
    v.walkTo(new THREE.Vector3(-0.2, meetY, 0.36), 0.45);
    for (const [k, h] of this.hosts.entries()) {
      if (!h.awake || h.host.inPlace) continue;
      h.actor.walkTo(new THREE.Vector3(0.12 + k * 0.22, this.groundY(0.3 - k * 0.12), 0.3 - k * 0.12), 0.45);
      h.next = rand(3, 6);
    }
    await this.wait(2.5);
  }

  // a believable "ground" inside the picture: further back is higher up
  groundY(z) { return -this.ph / 2 + this.ph * 0.12 + (0.4 - z) * 0.22; }
  randomGround() {
    const z = rand(-this.paintU.uDepth.value * 0.55, 0.4);
    return new THREE.Vector3(rand(-this.pw / 2 + 0.25, this.pw / 2 - 0.25), this.groundY(z), z);
  }

  // inside: the animals keep living. They wander, run, follow the visitor or rest.
  liveInside(dt) {
    for (const h of this.hosts) {
      if (!h.awake || h.host.inPlace || h.called) continue;
      h.next -= dt;
      if (h.next > 0 || h.actor.target) continue;
      const roll = Math.random();
      if (roll < 0.35) {                              // follow the visitor
        const p = this.visitor.position.clone(); p.x += rand(-0.35, 0.35); p.z = THREE.MathUtils.clamp(p.z + rand(-0.15, 0.1), -0.5, 0.45);
        p.y = this.groundY(p.z);
        h.actor.walkTo(p, 0.4);
      } else if (roll < 0.75) {                       // wander, sometimes at a run
        const run = Math.random() < 0.35;
        h.actor.walkTo(this.randomGround(), run ? 0.9 : 0.35, { run });
        if (run) this.o.onEvent?.('run', this.hosts.indexOf(h));
      } else {                                         // rest: look around, nod
        h.actor.setDir(Math.random() < 0.5 ? -1 : 1); h.actor.nod(1);
      }
      h.next = rand(3.5, 8);
    }
  }

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
    h.called = false; h.next = rand(4, 7);
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

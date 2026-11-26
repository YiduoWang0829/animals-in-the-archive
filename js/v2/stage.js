// The stage, version 2: nobody walks. The visitor is a still 3D figure; the camera does the
// moving. Same interface as the old Gallery (app.js drives the story through it).
//
//   hall   the chosen painting on a dark wall under its own light, the wall label beside it,
//          the visitor standing in front in its own natural colours
//   enter  the camera flies into the picture; behind the title card the painting is replaced
//          by its 3D world, seen from the painter's eye, so it still looks flat. Then it opens:
//          the picture unfolds into depth and the visitor rises out of the ground, re-made in
//          the painting's manner.
//   inside the view is the visitor's own: it depends on how tall the animal is and on the
//          painted space. A giraffe looks down on the picture from above, a cat looks up at it
//          from the grass, a bird sees it from the air. Whoever speaks, the view turns to them.

import * as THREE from '../../vendor/three-0.170.0/build/three.module.js';
import { PaintingWorld, FOV } from './world.js';
import { stylise, natural } from './figure.js';
import { KIND, isBird, kindName } from './ecology.js';
import { LANG } from '../strings.js';

const ease = t => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
const loadImg = url => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
const sleep = ms => new Promise(r => setTimeout(r, ms));

export class Stage {
  // opts: { work, workText, visitorGeo, visitorKind, visitorRealH, hosts: [{ host, part }], onFrame }
  constructor(container, opts) {
    this.c = container; this.o = opts;
    this.renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(this.renderer.domElement);
    this.camera = new THREE.PerspectiveCamera(45, 1, 0.01, 200);
    this.hall = new THREE.Scene(); this.worldScene = new THREE.Scene();
    this.scene = this.hall;
    this.parallax = new THREE.Vector2();
    this.inside = false; this.entering = false; this.locked = false;
    this.hosts = []; this.partner = null; this.convo = null; this.gazeHost = null; this.userGaze = null;
    this.pw = 1; this.ph = 1;
    this.tween = null;
    this.clock = new THREE.Clock();
    this._resize = () => this.resize();
    addEventListener('resize', this._resize);
  }

  async init() {
    const { work, workText } = this.o;
    await this.buildHall(work, workText);
    // the painted world is prepared while the visitor is still in the hall
    this.world = new PaintingWorld({ image: work.hd || work.image, depth: work.depth, parts: work.parts || [], partBase: 'assets/paintings/v2/parts/' });
    this.worldReady = this.world.init(innerWidth < 700 ? 150000 : 260000).then(() => this.buildWorld());
    this.resize();
    this.camera.position.set(0.3, 1.25, 7.5); this.look = new THREE.Vector3(0, 1.3, 0);
    this.camera.lookAt(this.look);
    this.running = true;
    const loop = () => { if (!this.running) return; this.raf = requestAnimationFrame(loop); this.tick(); };
    loop();
  }

  // ------------------------------------------------------------ hall
  async buildHall(work, text) {
    const s = this.hall;
    s.background = new THREE.Color(0x14110f);
    s.fog = new THREE.Fog(0x14110f, 9, 22);
    const img = await loadImg(work.image);
    const A = img.width / img.height;
    const pw = A >= 1 ? Math.min(2.6, 1.7 * A) : 1.7 * A, ph = pw / A;
    this.paintSize = [pw, ph];
    const tex = new THREE.Texture(img); tex.colorSpace = THREE.SRGBColorSpace; tex.needsUpdate = true; tex.anisotropy = 8;
    const wall = new THREE.Mesh(new THREE.PlaneGeometry(30, 8), new THREE.MeshStandardMaterial({ color: 0x2b2622, roughness: 0.95 }));
    wall.position.set(0, 4, 0); s.add(wall);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(30, 20), new THREE.MeshStandardMaterial({ color: 0x1c1815, roughness: 0.6, metalness: 0.1 }));
    floor.rotation.x = -Math.PI / 2; floor.position.z = 10; s.add(floor);
    this.paintGroup = new THREE.Group(); this.paintGroup.position.set(0, 1.55, 0.06); s.add(this.paintGroup);
    const frameW = 0.09;
    const frame = new THREE.Mesh(new THREE.BoxGeometry(pw + frameW * 2, ph + frameW * 2, 0.06), new THREE.MeshStandardMaterial({ color: 0x6b5233, roughness: 0.45, metalness: 0.55 }));
    frame.position.z = -0.01; this.paintGroup.add(frame);
    const canvas = new THREE.Mesh(new THREE.PlaneGeometry(pw, ph), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.8 }));
    canvas.position.z = 0.022; this.paintGroup.add(canvas);
    this.canvasMesh = canvas;
    // the wall label
    const lc = document.createElement('canvas'); lc.width = 640; lc.height = 400;
    const g = lc.getContext('2d');
    g.fillStyle = '#efe9dc'; g.fillRect(0, 0, 640, 400);
    g.fillStyle = '#1d1a17'; g.font = 'italic 600 40px "Cormorant Garamond", Georgia, serif';
    wrap(g, text.title, 36, 70, 568, 44, 3);
    g.font = '28px "Cormorant Garamond", Georgia, serif'; g.fillStyle = '#3b352e';
    g.fillText(`${text.artist}`.slice(0, 44), 36, 250); g.fillText(`${text.date}`.slice(0, 44), 36, 290);
    g.font = '18px Inter, system-ui, sans-serif'; g.fillStyle = '#6b6258';
    g.fillText(`${(text.collection || '').slice(0, 58)}`, 36, 350);
    const lt = new THREE.CanvasTexture(lc); lt.colorSpace = THREE.SRGBColorSpace;
    const label = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.26), new THREE.MeshStandardMaterial({ map: lt, roughness: 0.9 }));
    label.position.set(pw / 2 + 0.55, 1.2, 0.03); s.add(label);
    this.label = label;
    // light
    s.add(new THREE.HemisphereLight(0xfff1dd, 0x1a1410, 1.1));
    const vlight = new THREE.PointLight(0xffe2c0, 6, 6, 1.5); vlight.position.set(0.4, 1.6, 2.6); s.add(vlight);
    const spot = new THREE.SpotLight(0xffe6c4, 60, 12, 0.55, 0.6, 1.6);
    spot.position.set(0, 5.5, 4.2); spot.target = this.paintGroup; s.add(spot, spot.target);
    const ls = new THREE.SpotLight(0xffe6c4, 8, 6, 0.4, 0.8, 1.6);
    ls.position.set(label.position.x, 3.5, 2.5); ls.target = label; s.add(ls);
    const fill = new THREE.DirectionalLight(0xffffff, 0.6); fill.position.set(-3, 4, 6); s.add(fill);
    // the visitor, in front of the painting. A rigged 3D animal is the real model, with its
    // own textures and its own walk; a drawing or storybook animal stands as a solid figure.
    const H = this.hallHeight();
    if (this.o.visitorGlb) {
      const { loadAnimal3D } = await import('../animal3d.js');
      const a = await loadAnimal3D(this.o.visitorGlb, { height: 1, look: this.o.visitorLook || 'real' });
      a.setHeight(H * 1.35);
      a.addTo(s);
      a.group.position.set(-1.9, 0, 1.3);
      a.play?.('idle');
      this.actor = a;
      this.hallFig = a.group;
      this.visitor = this.actorProxy(a);
      return;
    }
    if (this.o.visitorImage) {
      // a drawing or a storybook animal: exactly the picture that was chosen, walking on its legs
      const { Character } = await import('../character.js');
      const ch = new Character(this.o.visitorImage, { height: H, headSide: this.o.visitorHeadSide || 'right', gait: this.o.visitorGait });
      ch.addTo(s);
      ch.group.position.set(-2.5, 0, 1.3);
      ch.isChar = true;
      this.actor = ch;
      this.hallFig = ch.group;
      this.visitor = this.actorProxy(ch);
      return;
    }
    this.hallFig = natural(this.o.visitorGeo);
    this.hallFig.scale.setScalar(H);
    this.hallFig.position.set(-0.35, 0, 1.15);
    this.hallFig.rotation.y = -Math.PI * 0.7;           // three-quarter view, looking towards you and the picture
    s.add(this.hallFig);
    const sh = new THREE.Mesh(new THREE.CircleGeometry(0.5, 32), new THREE.MeshBasicMaterial({ color: 0, transparent: true, opacity: 0.35, depthWrite: false }));
    sh.rotation.x = -Math.PI / 2; sh.position.set(-0.35, 0.002, 1.15); sh.scale.set(H * 0.9, H * 0.5, 1); s.add(sh);
    this.visitor = this.makeVisitorProxy(this.hallFig, H);
  }
  hallHeight() { return Math.max(0.22, Math.min(1.45, this.o.visitorRealH * 0.55)); }
  get spotX() { return -0.35; }

  makeVisitorProxy(fig, h) {
    const st = this;
    return {
      group: fig, mesh: fig.children[0], height: h, calm: true, target: null, attending: false,
      get position() { return fig.position; },
      nod() { st.pulse(fig); }, gesture() { st.pulse(fig); return true; },
      setDir() {}, face() {}, walkTo() { return Promise.resolve(); }, stop() {},
      topWorld() { return fig.position.clone().add(new THREE.Vector3(0, fig.scale.y * 1.08, 0)); },
    };
  }
  // the real 3D animal in the hall: it walks, stands, looks at you
  actorProxy(a) {
    return {
      group: a.group, mesh: a.mesh, height: a._h, calm: true, get target() { return a.target; }, attending: false,
      get position() { return a.group.position; },
      nod: () => a.nod?.(1), gesture: () => { a.nod?.(2); return true; },
      setDir: d => a.setDir?.(d), face: (...x) => a.face?.(...x), walkTo: (...x) => a.walkTo(...x), stop: () => a.stop(),
      attend: on => a.attend?.(on), topWorld: () => a.topWorld(),
    };
  }
  // the only "movement" a figure makes: a tiny breath-like swell when it speaks
  pulse(obj) { obj.userData.pulse = performance.now(); }

  // ------------------------------------------------------------ the painted world
  buildWorld() {
    const s = this.worldScene, w = this.world, o = this.o;
    s.background = new THREE.Color(o.work.palette?.[0]?.c || '#0c0a09').multiplyScalar(0.5);
    s.add(w.group);
    // around the world: the same painting, blurred and dimmed, on a dome (no empty edges)
    {
      const src = w.sourceImage, c = document.createElement('canvas'); c.width = 512; c.height = 256;
      const g = c.getContext('2d'); g.filter = 'blur(14px) brightness(0.55) saturate(1.1)';
      g.drawImage(src, -40, -40, 592, 336); g.filter = 'none';
      const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
      const dome = new THREE.Mesh(new THREE.SphereGeometry(70, 48, 24), new THREE.MeshBasicMaterial({ map: tex, side: THREE.BackSide, depthWrite: false }));
      dome.rotation.y = Math.PI / 2; dome.renderOrder = -1; s.add(dome);
      // the painted ground continues under the world
      const fc = document.createElement('canvas'); fc.width = fc.height = 64;
      const fg = fc.getContext('2d'); fg.filter = 'blur(6px) brightness(0.7)'; fg.drawImage(src, 0, src.height * 0.82, src.width, src.height * 0.18, -8, -8, 80, 80);
      const ft = new THREE.CanvasTexture(fc); ft.colorSpace = THREE.SRGBColorSpace;
      const low = w.pointAt(0.5, 0.985);
      const floor = new THREE.Mesh(new THREE.CircleGeometry(60, 48), new THREE.MeshBasicMaterial({ map: ft }));
      floor.rotation.x = -Math.PI / 2; floor.position.y = low.y - 0.02; s.add(floor);
    }
    // painted animals: where they stand, how tall they are in this world
    const hostAnchors = o.hosts.map(({ part }) => w.partAnchor(part));
    // scale: how many world units is one metre here (from the painted animals' real size)
    const per = o.hosts.map(({ host }, i) => hostAnchors[i].height / Math.max(0.1, (KIND[host.kind] || {}).h || host.realH || 0.8)).filter(v => v > 0 && isFinite(v)).sort((a, b) => a - b);
    const spot = w.groundSpot(o.hosts.map(({ part }) => [(part.box[0] + part.box[2]) / 2, part.box[3]]));
    const D = -spot.point.z;
    let unitsPerM = per.length ? per[Math.floor(per.length / 2)] : (2 * w.tanY * D) / 3.2;
    let vh = o.visitorRealH * unitsPerM;
    vh = Math.max(D * 0.06, Math.min(D * 0.55, vh));           // never a speck, never bigger than the picture
    this.vh = vh; this.vSpot = spot;
    // the visitor, re-made in the painting's manner. A rigged animal keeps its body and its
    // walk (it is brought in from the hall on entering and re-painted there); a 2D one is
    // inflated into a solid figure in the painting's manner.
    this.live3d = !!(this.actor && !this.actor.isChar);
    if (this.live3d) this.fig = new THREE.Group();
    else this.fig = stylise(o.visitorGeo, o.work.look || 'oil', o.work.palette), this.fig.scale.setScalar(vh);
    this.fig.position.copy(spot.point);
    if (!this.live3d) s.add(this.fig);
    // it faces the first painted animal, or into the picture
    const faceTo = hostAnchors[0]?.foot || new THREE.Vector3(spot.point.x * 0.3, spot.point.y, spot.point.z - 3);
    this.fig.rotation.y = Math.atan2(faceTo.x - spot.point.x, faceTo.z - spot.point.z);
    if (o.visitorGeo.userData.flat) {
      // a drawn animal is a profile: turn its broad side to the painter's eye (three-quarter)
      const b = new THREE.Vector3(-spot.point.x, 0, -spot.point.z).normalize();
      this.fig.rotation.y = Math.atan2(-b.z, b.x) + (faceTo.x > spot.point.x ? 0.4 : -0.4);
    }
    this.figYaw = this.fig.rotation.y;
    // light from the painting's own light: warm key, palette fill
    for (const m of allMaterials(this.fig)) if (m.uniforms?.uLightDir) m.uniforms.uLightDir.value.set(-0.6, 0.9, 0.5).normalize();
    // the painted animals (they stay where they were painted)
    this.hosts = o.hosts.map(({ host, part }, i) => {
      const anchor = hostAnchors[i];
      const actor = { awake: false, target: null, attending: false, setDir() {}, nod: () => this.flash(i), mesh: null, height: anchor.height,
        topWorld: () => anchor.head.clone().add(new THREE.Vector3(0, anchor.height * 0.12, 0)) };
      return { host, part, anchor, actor, awake: false, partIndex: (o.work.parts || []).indexOf(part) };
    });
    this.profile = this.viewProfile();
    // visitor proxy now points at the painted-world figure
    this.insideVisitor = this.live3d ? null : this.makeVisitorProxy(this.fig, vh);
  }

  // how this animal sees this painting
  viewProfile() {
    const kind = this.o.visitorKind, realH = this.o.visitorRealH, st = this.o.work.stats || {};
    const P = this.fig.position.clone(), vh = this.vh;
    const tallest = this.hosts.reduce((m, h) => Math.max(m, h.anchor.height), 0);
    const flying = isBird(kind) && !['rooster', 'duck', 'peacock'].includes(kind);
    let mode = flying ? 'aerial' : realH >= 2 ? 'above' : realH <= 0.5 ? 'below' : 'level';
    // the room in the picture changes it too: a crowded close-up (no sky) keeps a tall animal's
    // eye lower; a wide landscape with a high horizon lifts every eye a little
    const open = (st.sky || 0) > 0.12 || (st.horizon || 0.5) < 0.35;
    const back = P.clone().setY(P.y).normalize().negate();         // from the figure back towards the painter's eye
    back.y = 0; back.normalize();
    let camPos, target;
    const fwd = back.clone().negate();
    if (mode === 'aerial') {
      camPos = P.clone().addScaledVector(back, vh * 6).add(new THREE.Vector3(0, vh * 7 + 1.2, 0));
      target = P.clone().addScaledVector(fwd, vh * 6);
    } else if (mode === 'above') {
      camPos = P.clone().addScaledVector(back, vh * 0.9).add(new THREE.Vector3(0, vh * (open ? 1.45 : 1.2), 0));
      target = P.clone().addScaledVector(fwd, vh * 1.6).add(new THREE.Vector3(0, -vh * 0.05, 0));
    } else if (mode === 'below') {
      // low in the grass, behind it: the world towers over it, and it stays in the foreground
      camPos = P.clone().addScaledVector(back, vh * 3.6).add(new THREE.Vector3(0, vh * 0.32, 0));
      const up = Math.min(vh * 2.1, Math.max(vh * 1.5, tallest * 0.6));
      target = P.clone().addScaledVector(fwd, vh * 2.5).add(new THREE.Vector3(0, up, 0));
    } else {
      camPos = P.clone().addScaledVector(back, vh * 2.3).add(new THREE.Vector3(0, vh * (open ? 1.05 : 0.9), 0));
      target = P.clone().addScaledVector(fwd, vh * 2).add(new THREE.Vector3(0, vh * 0.55, 0));
    }
    const pitch = Math.atan2(target.y - camPos.y, Math.hypot(target.x - camPos.x, target.z - camPos.z)) * 180 / Math.PI;
    const name = kindName(kind, LANG);
    const words = LANG === 'zh'
      ? { aerial: `${name}的视角：从空中俯瞰`, above: `${name}的视角：俯视`, below: `${name}的视角：仰望`, level: `${name}的视角：平视` }
      : { aerial: `A ${name}’s view: from the air`, above: `A ${name}’s view: looking down`, below: `A ${name}’s view: looking up`, level: `A ${name}’s view: eye to eye` };
    return { mode, camPos, target, pitch, caption: words[mode], P, camOff: camPos.clone().sub(P), tgtOff: target.clone().sub(P) };
  }

  // ------------------------------------------------------------ frame
  resize() {
    const w = this.c.clientWidth || innerWidth, h = this.c.clientHeight || innerHeight;
    this.renderer.setSize(w, h, false);
    this.renderer.domElement.style.width = '100%'; this.renderer.domElement.style.height = '100%';
    this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
    if (this.inside && this.world) this.fitPictureFov();
  }
  fitPictureFov() {
    // the painter's eye: the painting fills the screen like it filled the frame
    const A = this.world.aspect, sA = this.camera.aspect;
    const tanY = Math.tan(THREE.MathUtils.degToRad(FOV / 2));
    this.pictureFov = sA < A ? THREE.MathUtils.radToDeg(2 * Math.atan(tanY * A / sA)) : FOV;
  }

  tick() {
    const dt = Math.min(0.05, this.clock.getDelta()), t = this.clock.elapsedTime;
    if (this.tween) this.stepTween();
    if (this.inside && this.world?.uniforms) this.stepInside(dt, t);
    else if (!this.tween) {
      // in the hall: the room leans a little with your head / the mouse
      const base = this.hallView || { pos: this.camera.position.clone(), look: this.look.clone() };
      this.hallView = base;
      const p = base.pos.clone().add(new THREE.Vector3(this.parallax.x * 0.25, this.parallax.y * 0.12, 0));
      this.camera.position.lerp(p, 0.06); this.camera.lookAt(base.look);
    }
    if (this.actor && (!this.inside || this.live3d)) this.actor.update(dt, t);
    if (this.live3d && this.inside) this.actor.updateStyle?.(this.renderer);
    for (const f of [this.actor ? null : this.hallFig, this.fig]) {
      if (!f?.userData.pulse) continue;
      const k = (performance.now() - f.userData.pulse) / 600;
      const base = f === this.fig ? this.vh : this.hallHeight();
      f.scale.setScalar(base * (1 + (k < 1 ? Math.sin(k * Math.PI) * 0.025 : 0)));
      if (k >= 1) f.userData.pulse = 0;
    }
    if (this.world?.uniforms) this.world.update(t, this.renderer);
    const pts = this.fig?.userData.points;
    if (pts) pts.material.uniforms.uScale.value = this.vh * this.renderer.domElement.height * 0.5 / 520;
    this.renderer.render(this.scene, this.camera);
    this.o.onFrame?.(this);
  }

  camTo(pos, look, sec = 2, fov = null) {
    return new Promise(res => {
      this.tween?.done();
      this.tween = { p0: this.camera.position.clone(), l0: (this.look || new THREE.Vector3()).clone(), p1: pos.clone(), l1: look.clone(),
        f0: this.camera.fov, f1: fov ?? this.camera.fov, t0: performance.now(), ms: sec * 1000, done: res };
    });
  }
  stepTween() {
    const tw = this.tween, k = Math.min(1, (performance.now() - tw.t0) / tw.ms), e = ease(k);
    this.camera.position.lerpVectors(tw.p0, tw.p1, e);
    this.look = tw.l0.clone().lerp(tw.l1, e);
    this.camera.fov = tw.f0 + (tw.f1 - tw.f0) * e; this.camera.updateProjectionMatrix();
    this.camera.lookAt(this.look);
    if (k >= 1) { this.tween = null; if (!this.inside) this.hallView = { pos: tw.p1.clone(), look: tw.l1.clone() }; tw.done(); }
  }

  // ------------------------------------------------------------ the hall story (camera only)
  async walkIn() {
    if (this.actor) {
      const a = this.actor, h = this.hallHeight();
      this.camTo(new THREE.Vector3(-0.6, Math.max(0.7, h), 3.6), new THREE.Vector3(-1.2, h * 0.5, 1.2), 3.5);
      await a.walkTo([new THREE.Vector3(-1.6, 0, 1.35), new THREE.Vector3(this.spotX, 0, 1.15)], 0.5);
      // it stops and looks straight at the label (no turning round first), and the camera comes round to its face
      const l = this.label.position, v = a.group.position;
      a.face?.(Math.atan2(l.x - v.x, l.z - v.z), true);
      await this.labelView(1.8);
      return;
    }
    const v = this.hallFig.position;
    await this.camTo(new THREE.Vector3(v.x + 0.9, Math.max(0.6, this.hallHeight() * 0.9), v.z + 2.6), new THREE.Vector3(v.x, this.hallHeight() * 0.55, v.z), 2.6);
  }
  talkToYou() {}
  labelView(sec) {
    // from the front and to the right: its face and the label, never its back
    const l = this.label.position, v = this.hallFig.position, h = this.hallHeight();
    return this.camTo(new THREE.Vector3(l.x + 0.55, Math.max(1.0, l.y + 0.3), 2.4), new THREE.Vector3((v.x + l.x) / 2, (h * 0.9 + l.y) / 2 + 0.1, 0.6), sec);
  }
  async toLabel() {
    // it is already looking at the label: it just reads it out, without turning about
    if (this.actor) return;
    await this.labelView(2.2);
  }
  async lookBack() {
    this.actor?.face?.(-0.6, true);                   // done reading, it turns the short way (past you, never its back) and says hello
    const v = this.hallFig.position, h = this.hallHeight();
    await this.camTo(new THREE.Vector3(v.x + 0.7, h * 0.95 + 0.3, v.z + 1.8), new THREE.Vector3(v.x, h * 0.95, v.z), 1.8);
  }
  async toPainting() {}
  async leaveToward() {}
  sideAt() { return null; }

  async enter() {
    this.entering = true;
    // into the frame
    const [pw, ph] = this.paintSize, A = pw / ph;
    const vfov = this.camera.fov, tanY = Math.tan(THREE.MathUtils.degToRad(vfov / 2));
    const dist = Math.max(ph / 2 / tanY, pw / 2 / (tanY * this.camera.aspect)) * 1.0;
    const pc = this.paintGroup.position;
    // you watch it from the side: it turns to the picture, walks straight up to it, steps up onto the
    // painted ground at the foot of the frame and, a little smaller with every step (going into
    // the depth), passes through the picture plane and is gone into the painting
    // you stand square in front of the picture; it turns and walks towards it, and while it is
    // still walking the dark closes in round the picture (it does not climb into the frame)
    this.walkedIn = Promise.resolve();
    if (this.actor) {
      const a = this.actor;
      a.face?.(null);
      this.camTo(new THREE.Vector3(pc.x, Math.max(1.1, pc.y), pc.z + dist * 1.45), pc.clone(), 1.1);
      this.walkedIn = sleep(1200);                    // the dark starts here, mid-walk
      const walk = Promise.race([a.walkTo(new THREE.Vector3(pc.x, 0, 0.45), 0.45), sleep(7000)]);
      await this.walkedIn; await walk;
    }
    await this.camTo(new THREE.Vector3(pc.x, pc.y, pc.z + dist + 0.02), pc.clone(), 2.6);
    await this.worldReady;
    // behind the title card: the same picture, now as its 3D world seen from the painter's eye
    this.scene = this.worldScene;
    this.fitPictureFov();
    this.camera.fov = this.pictureFov; this.camera.updateProjectionMatrix();
    this.camera.position.set(0, 0, 0); this.look = new THREE.Vector3(0, 0, -10); this.camera.lookAt(this.look);
    this.world.setFlat(1);
    if (this.actor) { this.actor.stop?.(); this.actor.group.removeFromParent(); this.actor.shadow?.removeFromParent(); }
    if (this.live3d) {
      const a = this.actor, { styleActor } = await import('./livestyle.js');
      styleActor(a, this.o.work.look || 'oil', this.o.work.palette, { coat: this.world.mode || 'splat', size: this.vh * 0.045 });
      a.setHeight(this.vh);
      a.group.position.copy(this.fig.position);
      a.yaw = this.figYaw; a.inner.rotation.y = a.yaw; a.face?.(null);
      const gy = this.fig.position.y; a.ground = () => gy;
      a.addTo(this.worldScene);
      this.fig = a.group;
      this.insideVisitor = this.actorProxy(a);
    }
    this.fig.visible = false;
    this.inside = true;
    this.visitor = this.insideVisitor;
    this.entering = false;
    this.unfold();
  }

  // the picture opens up into depth, then the view goes to the visitor's eye
  async unfold() {
    await sleep(1500);
    const t0 = performance.now(), ms = 3400;
    await new Promise(res => {
      const step = () => {
        const k = Math.min(1, (performance.now() - t0) / ms), e = ease(k);
        this.world.setFlat(1 - e);
        if (k < 1) requestAnimationFrame(step); else res();
      };
      step();
    });
    // the visitor rises out of the paint, already painted like everything around it
    this.fig.visible = true;
    const t1 = performance.now();
    if (!this.live3d) this.risingUntil = t1 + 1800;
    const pr = this.profile;
    this.showCaption(pr.caption);
    await this.camTo(pr.camPos, pr.target, 3.2, 50);
    this.orbit = { yaw: 0, zoom: 1, pitch: 0 };
  }

  showCaption(text) {
    let el = document.getElementById('view-caption');
    if (!el) { el = document.createElement('div'); el.id = 'view-caption'; el.className = 'view-caption'; this.c.parentElement.appendChild(el); }
    el.innerHTML = `<span class="dot"></span>${text}<span class="sep">·</span><button data-v2-mode="splat" aria-pressed="${this.world.mode === 'splat'}">Gaussian splats</button><button data-v2-mode="points" aria-pressed="${this.world.mode === 'points'}">Point cloud</button>`;
    el.hidden = false;
    el.onclick = e => {
      const b = e.target.closest('[data-v2-mode]'); if (!b) return;
      this.world.setMode(b.dataset.v2Mode);
      if (this.live3d) this.actor?.setCoat?.(b.dataset.v2Mode);
      el.querySelectorAll('[data-v2-mode]').forEach(x => x.setAttribute('aria-pressed', x === b));
    };
  }

  // ------------------------------------------------------------ inside: the view follows the talk
  stepInside(dt, t) {
    if (this.risingUntil) {
      const k = 1 - Math.max(0, (this.risingUntil - performance.now()) / 1800);
      this.fig.scale.set(this.vh, this.vh * ease(Math.max(0.02, k)), this.vh);
      if (k >= 1) this.risingUntil = 0;
    }
    // painted animals: the one speaking glows and comes forward a little
    const sp = this.convo && performance.now() - this.convo.t < this.convo.dur + 600 ? this.convo.speaker : null;
    this.hosts.forEach((h, i) => {
      const want = !h.awake ? 0 : sp === i ? 1 : h.flashUntil > performance.now() ? 0.8 : 0.12;
      h.glow = (h.glow || 0) + (want - (h.glow || 0)) * Math.min(1, dt * 4);
      this.world.glow(h.partIndex, h.glow * 0.9);
      this.world.lift(h.partIndex, h.awake ? h.glow : 0);
    });
    if (this.tween || !this.orbit || !this.profile) return;
    // the visitor's view, turned a little towards whoever is speaking, and steered by you
    const pr = this.profile, P = this.fig.position.clone();
    let target = P.clone().add(pr.tgtOff);
    const who = sp ?? (this.partner ?? null);
    if (typeof who === 'number' && this.hosts[who]) target.lerp(this.hosts[who].anchor.center, 0.45);
    else if (sp === 'visitor') target.lerp(this.fig.position.clone().add(new THREE.Vector3(0, this.vh * 0.7, 0)), 0.3);
    const off = pr.camOff.clone();
    off.applyAxisAngle(new THREE.Vector3(0, 1, 0), this.orbit.yaw + this.parallax.x * 0.04);
    off.multiplyScalar(this.orbit.zoom);
    off.y += this.orbit.pitch * this.vh;
    const cam = P.clone().add(off);
    const tgt = P.clone().add(target.clone().sub(P).applyAxisAngle(new THREE.Vector3(0, 1, 0), this.orbit.yaw));
    this.camera.position.lerp(cam, Math.min(1, dt * 2.2));
    this.look = (this.look || tgt.clone()).lerp(tgt, Math.min(1, dt * 1.6));
    this.camera.lookAt(this.look);
  }
  look_(dx, dy) { if (!this.orbit) return; this.orbit.yaw += dx; this.orbit.pitch = Math.max(-1.2, Math.min(3, this.orbit.pitch + dy)); }
  zoomBy(d) { if (this.orbit) this.orbit.zoom = Math.max(0.35, Math.min(3.2, this.orbit.zoom * (1 - d))); }
  panBy(dx, dy) { if (this.orbit) { this.orbit.yaw += dx * 2.2; this.orbit.pitch = Math.max(-1.2, Math.min(3, this.orbit.pitch + dy * 2)); } }

  // ------------------------------------------------------------ the conversation hooks
  project(p) { const v = p.clone().project(this.camera); return { x: (v.x + 1) / 2 * innerWidth, y: (1 - v.y) / 2 * innerHeight, z: v.z }; }
  anchor(who) {
    if (who === 'visitor') return this.visitor.topWorld();
    const h = this.hosts[who];
    return h ? h.actor.topWorld() : this.visitor.topWorld();
  }
  actorOf(who) { return who === 'visitor' ? this.visitor : this.hosts[who]?.actor; }
  attendAll() {}
  talking() { return !!(this.convo && performance.now() - this.convo.t < this.convo.dur); }
  flash(i) { const h = this.hosts[i]; if (h) h.flashUntil = performance.now() + 900; }
  async startle() { this.hosts.forEach((h, i) => { h.awake = true; this.flash(i); }); await sleep(900); this.hosts.forEach(h => { h.awake = false; }); }
  wakeHost(i) { const h = this.hosts[i]; if (!h) return; h.awake = true; h.actor.awake = true; this.flash(i); }
  async meet(i) {
    this.partner = i;
    const h = this.hosts[i]; if (!h || !this.inside) return sleep(300);
    const P = this.fig.position, foot = h.anchor.foot;
    const d = new THREE.Vector3(foot.x - P.x, 0, foot.z - P.z), dist = d.length();
    const yaw = Math.atan2(d.x, d.z);
    if (dist > this.vh * 1.4) {
      // a few steps towards it (never into it), on the ground where it stands
      const step = Math.min(dist - this.vh * 1.2, this.vh * 2.2);
      const goal = P.clone().addScaledVector(d.normalize(), step);
      if (this.live3d) { this.actor.face?.(null); await Promise.race([this.actor.walkTo(goal, 0.6), sleep(6000)]); }
      else await this.glide(goal, yaw);
    }
    if (this.live3d) this.actor.face?.(yaw, true); else this.fig.rotation.y = yaw + (this.o.visitorGeo.userData.flat ? -Math.PI / 2 * Math.sign(Math.sin(yaw) || 1) + 0.4 : 0);
    await sleep(400);
  }
  // the restyled 2D figure steps along: a small bob for each stride
  glide(goal, yaw) {
    const P0 = this.fig.position.clone(), t0 = performance.now(), ms = Math.max(800, P0.distanceTo(goal) / this.vh * 700);
    return new Promise(res => {
      const f = () => {
        const k = Math.min(1, (performance.now() - t0) / ms);
        this.fig.position.lerpVectors(P0, goal, k);
        this.fig.position.y = P0.y + (goal.y - P0.y) * k + Math.abs(Math.sin(k * Math.PI * 6)) * this.vh * 0.04;
        if (k < 1) requestAnimationFrame(f); else { this.fig.position.y = goal.y; res(); }
      };
      f();
    });
  }
  async lead(i) { await this.meet(i); }
  callHost(i) { this.flash(i); this.partner = i; }
  walkVisitorToScreen() {}
  visitorAt(nx, ny) {
    const s = this.project(this.visitor.topWorld()), b = this.project(this.visitor.group.position);
    const x = (nx + 1) / 2 * innerWidth, y = (1 - ny) / 2 * innerHeight;
    return Math.abs(x - (s.x + b.x) / 2) < Math.max(40, Math.abs(b.y - s.y) * 0.6) && y > s.y - 20 && y < b.y + 20;
  }
  hostAt(nx, ny) {
    const x = (nx + 1) / 2 * innerWidth, y = (1 - ny) / 2 * innerHeight;
    let best = -1, bd = 90;
    this.hosts.forEach((h, i) => { if (!h.awake) return; const p = this.project(h.anchor.center); const d = Math.hypot(p.x - x, p.y - y); if (d < bd) { bd = d; best = i; } });
    return best;
  }
  screenshot() { this.renderer.render(this.scene, this.camera); return this.renderer.domElement.toDataURL('image/jpeg', 0.9); }
  dispose() {
    this.running = false; cancelAnimationFrame(this.raf);
    removeEventListener('resize', this._resize);
    document.getElementById('view-caption')?.remove();
    this.world?.dispose();
    for (const s of [this.hall, this.worldScene]) s.traverse(o => { o.geometry?.dispose?.(); [].concat(o.material || []).forEach(m => { m.map?.dispose?.(); m.dispose?.(); }); });
    this.renderer.dispose(); this.renderer.domElement.remove();
  }
}

function allMaterials(obj) { const out = []; obj.traverse(o => { if (o.material) out.push(...[].concat(o.material)); }); return out; }
function wrap(g, text, x, y, maxW, lh, maxLines) {
  const words = String(text).split(/\s+/); let line = '', n = 0;
  for (const w of words) {
    const test = line ? line + ' ' + w : w;
    if (g.measureText(test).width > maxW && line) { g.fillText(line, x, y); y += lh; line = w; if (++n >= maxLines - 1) { line = words.slice(words.indexOf(w)).join(' '); break; } }
    else line = test;
  }
  if (g.measureText(line).width > maxW) { while (g.measureText(line + '…').width > maxW) line = line.slice(0, -1); line += '…'; }
  g.fillText(line, x, y);
}

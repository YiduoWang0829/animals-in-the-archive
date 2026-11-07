// A 3D animal (rigged glTF with its own animation clips) as a gallery "actor".
// It walks, gallops and idles with the model's real animations, turns smoothly
// towards where it is going, and can be repainted in the painting's manner:
//   style 'storybook' → soft toon shading + ink outline (a children's-book look)
//   painting styles   → eden (oil glaze), durer (engraved hatching), marc (prism)
// The repainting only applies inside the picture frame, like the 2D characters.
//
// Models: Quaternius "Ultimate Animated Animals" (CC0), see CREDITS.md.

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';

const STYLE_ID = { eden: 1, durer: 2, marc: 3, storybook: 4 };

// GLSL injected into the standard material: repaint after lighting
const PAINT_HEAD = /* glsl */`
  uniform float uPaintStyle, uPaintAll, uWallZ;
  uniform vec4 uFrame;
  varying vec3 vWorldP;
  float lumA(vec3 c) { return dot(c, vec3(0.3, 0.59, 0.11)); }
  vec3 paintIt(vec3 c, float style, vec2 sc) {
    float l = lumA(c);
    if (style < 1.5) {                         // Flemish oil: amber varnish, deep warm shadows
      c = mix(vec3(l), c, 1.1) * vec3(1.06, 0.96, 0.78);
      return mix(vec3(0.12, 0.09, 0.05), c, 0.65 + 0.35 * l);
    } else if (style < 2.5) {                  // engraving: tone becomes line
      float t = pow(l, 0.8);
      float a = abs(fract((sc.x + sc.y) / 4.5) - 0.5) * 2.0;
      float b = abs(fract((sc.x - sc.y) / 5.2) - 0.5) * 2.0;
      float ink = step(0.3 + t * 0.7, a);
      ink = max(ink, step(0.42 + t * 1.2, b) * step(t, 0.5));
      return mix(vec3(0.88, 0.84, 0.75), vec3(0.11, 0.09, 0.08), ink);
    } else if (style < 3.5) {                  // Marc: flattened prismatic planes
      float warm = c.r - c.b;
      vec3 k = l > 0.7 ? vec3(0.93) : (warm > 0.12 && l > 0.25) ? (l > 0.45 ? vec3(0.88, 0.42, 0.16) : vec3(0.7, 0.17, 0.12))
             : l < 0.18 ? vec3(0.09, 0.12, 0.43) : l < 0.35 ? vec3(0.17, 0.26, 0.7) : vec3(0.36, 0.47, 0.82);
      return mix(k, c, 0.15);
    }
    // storybook: three soft tone bands, pale wash, warm paper light
    float band = smoothstep(0.18, 0.24, l) * 0.45 + smoothstep(0.45, 0.52, l) * 0.35 + 0.2;
    vec3 base = mix(c / max(l, 0.05) * 0.5, vec3(0.96, 0.93, 0.86), 0.38);
    return base * (0.55 + band * 0.6);
  }
`;

function stylise(material, uniforms) {
  material.onBeforeCompile = shader => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWorldP;')
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvWorldP = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\n' + PAINT_HEAD)
      .replace('#include <dithering_fragment>', `#include <dithering_fragment>
        float insideF = step(uFrame.x, vWorldP.x) * step(vWorldP.x, uFrame.y) *
                        step(uFrame.z, vWorldP.y) * step(vWorldP.y, uFrame.w) * step(vWorldP.z, uWallZ);
        float p = max(insideF, uPaintAll);
        if (uPaintStyle > 0.5 && p > 0.0) gl_FragColor.rgb = mix(gl_FragColor.rgb, paintIt(gl_FragColor.rgb, uPaintStyle, gl_FragCoord.xy), p);`);
  };
  material.customProgramCacheKey = () => 'paint3d';
}

// soft outline: the back faces of the body, pushed out along the normal
function outlineMaterial(uniforms) {
  const m = new THREE.MeshBasicMaterial({ color: 0x2a211b, side: THREE.BackSide });
  m.onBeforeCompile = shader => {
    shader.uniforms.uOutline = uniforms.uOutline;
    // push the back faces outwards in screen space: a constant, thin ink line
    shader.vertexShader = 'uniform float uOutline;\n' + shader.vertexShader.replace('#include <project_vertex>',
      '#include <project_vertex>\nvec2 nd = (projectionMatrix * vec4(transformedNormal, 0.0)).xy;\n' +
      'if (dot(nd, nd) > 0.0) gl_Position.xy += normalize(nd) * uOutline * gl_Position.w;');
  };
  m.customProgramCacheKey = () => 'outline3d';
  return m;
}

let shadowTex = null;
function blobShadow() {
  if (!shadowTex) {
    const c = document.createElement('canvas'); c.width = c.height = 128;
    const g = c.getContext('2d'); const gr = g.createRadialGradient(64, 64, 4, 64, 64, 62);
    gr.addColorStop(0, 'rgba(0,0,0,0.55)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 128, 128); shadowTex = new THREE.CanvasTexture(c);
  }
  const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false }));
  m.rotation.x = -Math.PI / 2;
  return m;
}

const clipName = c => c.name.split('|').pop();

export async function loadAnimal3D(url, opts = {}) {
  const gltf = await new GLTFLoader().loadAsync(url);
  return new Animal3D(gltf, opts);
}

export class Animal3D {
  constructor(gltf, { height = 0.55, look = 'real' } = {}) {
    this.root = gltf.scene;
    this.group = new THREE.Group();
    this.inner = new THREE.Group();            // turns to face the walking direction
    this.group.add(this.inner);
    this.inner.add(this.root);
    this.uniforms = {
      uPaintStyle: { value: look === 'storybook' ? STYLE_ID.storybook : 0 }, uPaintAll: { value: look === 'storybook' ? 1 : 0 },
      uWallZ: { value: -1e9 }, uFrame: { value: new THREE.Vector4(1e9, -1e9, 1e9, -1e9) }, uOutline: { value: 0 },
    };
    this.look = look;
    const outlines = [];
    this.root.traverse(o => {
      if (!o.isMesh) return;
      o.castShadow = false;
      // smooth the faceted low-poly shading so the animal reads as a soft body
      const g = o.geometry;
      g.deleteAttribute('normal');
      o.geometry = mergeVertices(g, 1e-4);
      o.geometry.computeVertexNormals();
      const mats = [].concat(o.material).map(m => {
        const n = m.clone(); n.flatShading = false; n.roughness = 0.82; n.metalness = 0;
        stylise(n, this.uniforms); return n;
      });
      o.material = Array.isArray(o.material) ? mats : mats[0];
      if (o.isSkinnedMesh) outlines.push(o);
      this.mesh ??= o;
    });
    // ink outline for the storybook look
    for (const o of outlines) {
      const line = new THREE.SkinnedMesh(o.geometry, outlineMaterial(this.uniforms));
      line.bind(o.skeleton, o.bindMatrix);
      line.visible = look === 'storybook';
      o.parent.add(line);
      (this.outlines ||= []).push(line);
    }
    // normalise size: the model's height becomes `height` metres, feet at y = 0
    this.root.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(this.root);
    const s = 1 / (box.max.y - box.min.y);
    this.root.scale.setScalar(s);
    this.root.position.y = -box.min.y * s;
    this.length = (box.max.z - box.min.z) * s;
    this.uniforms.uOutline.value = 0.0035;        // outline thickness (fraction of the screen)
    // neck and head bones, with the direction each one "faces" in the rest pose
    // (the model faces +z), so the head can be aimed at a point anatomically
    const byName = n => { let b = null; this.root.traverse(o => { if (!b && o.isBone && o.name === n) b = o; }); return b; };
    this.head = byName('Head');
    this.neck = ['Neck2', 'Neck3', 'Neck'].map(byName).filter(Boolean);
    this.aimChain = [...this.neck.map(b => ({ b, share: 0.3, limit: 0.35 })), ...(this.head ? [{ b: this.head, share: 1, limit: 0.75 }] : [])];
    this.root.updateMatrixWorld(true);
    const qw = new THREE.Quaternion();
    for (const c of this.aimChain) c.fwd = new THREE.Vector3(0, 0, 1).applyQuaternion(c.b.getWorldQuaternion(qw).invert());

    // animations
    this.mixer = new THREE.AnimationMixer(this.root);
    this.clips = {};
    for (const c of gltf.animations) { const n = clipName(c); if (!this.clips[n]) this.clips[n] = c; }
    const pick = (...names) => names.map(n => this.clips[n]).find(Boolean);
    this.anim = {
      idle: pick('Idle'), idle2: pick('Idle_2', 'Idle_Headlow', 'Idle_2_HeadLow'), eat: pick('Eating', 'Idle_Eating'),
      walk: pick('Walk'), run: pick('Gallop', 'Run'), jump: pick('Gallop_Jump', 'Jump_toIdle', 'Jump_ToIdle', 'Run_Jump'),
    };
    this.actions = {};
    for (const [k, c] of Object.entries(this.anim)) if (c) this.actions[k] = this.mixer.clipAction(c);
    this.current = null;
    // measure how far one cycle of each gait carries the animal (in body heights),
    // so playback speed can match ground speed: the feet plant instead of sliding
    this.stride = { walk: this.measureStride(this.anim.walk) || { len: 0.9, dur: 1 }, run: this.measureStride(this.anim.run) || { len: 2.2, dur: 1 } };
    this.play('idle', 0);

    this.shadow = blobShadow();
    this.dir = 1; this.yaw = Math.PI / 2; this.lookA = 0;
    this.target = null; this.speed = 0.7; this.running = false;
    this.hop = 0; this.hopT = -1; this.idleT = 3 + Math.random() * 4;
    this.setHeight(height);
  }

  measureStride(clip) {
    if (!clip) return 0;
    let foot = null;
    this.root.traverse(o => { if (!foot && /^FrontLowerLeg\.?L(_end)?$/.test(o.name) && (o.name.endsWith('_end') || !o.children.length)) foot = o; });
    if (!foot) return 0;
    const act = this.mixer.clipAction(clip); act.reset().play();
    const p = new THREE.Vector3(); let zMin = 1e9, zMax = -1e9;
    for (let i = 0; i <= 24; i++) {
      this.mixer.setTime(clip.duration * i / 24);
      this.root.updateMatrixWorld(true);
      foot.getWorldPosition(p); this.inner.worldToLocal(p);
      zMin = Math.min(zMin, p.z); zMax = Math.max(zMax, p.z);
    }
    act.stop(); this.mixer.setTime(0);
    // one cycle = one full stance per foot: the body travels about the foot's sweep
    return { len: (zMax - zMin), dur: clip.duration };
  }

  play(name, fade = 0.3) {
    const a = this.actions[name] || this.actions.idle;
    if (!a || this.current === a) return;
    a.reset().fadeIn(fade).play();
    if (this.current) this.current.fadeOut(fade);
    this.current = a;
  }

  // ---- actor interface (shared with character.js) ----
  get position() { return this.group.position; }
  get height() { return this._h; }
  setHeight(h) { this._h = h; this.inner.scale.setScalar(h); this.shadow.scale.set(h * this.length * 0.9, h * 0.6, 1); }
  addTo(scene) { scene.add(this.group); scene.add(this.shadow); return this; }
  setDir(d) { this.dir = d; }
  // turn to face the person in front of the screen (+z), slightly towards where they are
  attend(on) { this.attending = on; }
  lookTurn(a) { this.lookA = a; }
  get lookAngle() { return this.lookA; }
  setPaint(style, frameRect, wallZ) {
    if (this.look !== 'storybook') this.uniforms.uPaintStyle.value = STYLE_ID[style] || 0;
    this.paintStyle = style;
    if (frameRect) this.uniforms.uFrame.value.copy(frameRect);
    if (wallZ !== undefined) this.uniforms.uWallZ.value = wallZ;
  }
  // once inside the painting, take on its manner (unless shown as a storybook figure)
  setPaintAll(v) { if (this.look !== 'storybook') this.uniforms.uPaintAll.value = v; }
  setSpot() {}
  setLight() {}
  topWorld() {
    const p = new THREE.Vector3(); this.group.getWorldPosition(p);
    const s = new THREE.Vector3(); this.group.getWorldScale(s);
    return p.add(new THREE.Vector3(0, this._h * s.y * 1.05, 0));
  }
  // walk to a point, or along several points without stopping in between
  walkTo(target, speed = 0.7, { run = false } = {}) {
    const pts = Array.isArray(target) ? target.map(p => p.clone()) : [target.clone()];
    this._arrive?.();                         // a new order replaces the old one
    this.target = pts.shift(); this.path = pts;
    this.speed = run ? Math.max(speed, 1.1) : speed; this.running = run;
    const dx = this.target.x - this.group.position.x;
    if (Math.abs(dx) > 0.02) this.dir = Math.sign(dx);
    return new Promise(res => { this._arrive = res; });
  }
  // face a fixed direction while standing (yaw: 0 = towards you, PI = towards the wall)
  face(yaw) { this.faceYaw = yaw; }
  stop() { this.target = null; this._arrive?.(); this._arrive = null; }
  hopOnce(h = 0.1) { this.hopT = 0; this.hopH = h; }
  nod(times = 2) { this.nodT = 0; this.nodN = times; }

  update(dt, t) {
    const p = this.group.position;
    let moving = false, heading = null;
    // ground speed follows the animation: at most ~1.5× the gait's natural pace, so
    // the hooves and paws stay planted. A walk that is asked to go much faster gallops.
    const natW = this.stride.walk.len * this._h / this.stride.walk.dur, natR = this.stride.run.len * this._h / this.stride.run.dur;
    if (this.target) {
      const running = this.running || this.speed > natW * 2.4;
      this.gaitRun = running;
      // a normal pace: about two of its own animation strides per second of travel
      this.effSpeed = Math.min(this.speed, (running ? natR * 1.6 : natW * 2.3));
    }
    if (this.target) {
      const d = this.target.clone().sub(p), dist = d.length(), step = this.effSpeed * dt;
      if (dist <= step) {
        p.copy(this.target);
        if (this.path?.length) { this.target = this.path.shift(); moving = true; heading = this.lastHeading; }
        else { this.target = null; this._arrive?.(); this._arrive = null; }
      } else { heading = Math.atan2(d.x, d.z); this.lastHeading = heading; p.addScaledVector(d.normalize(), step); moving = true; }
    }
    // only settle into idle after a moment of standing still (no hitch between two walks)
    this.stillT = moving ? 0 : (this.stillT || 0) + dt;
    // animation follows what the animal is doing; speed matches the stride
    if (moving || this.stillT < 0.18) {
      if (moving) {
        this.play(this.gaitRun ? 'run' : 'walk', 0.3);
        this.current.timeScale = THREE.MathUtils.clamp(this.effSpeed / (this.gaitRun ? natR : natW) * 0.78, 0.6, 1.8);
      }
    } else {
      this.idleT -= dt;
      if (this.idleT < 0) {                  // now and then: graze or look around
        this.play(Math.random() < 0.5 ? 'eat' : 'idle2', 0.4);
        setTimeout(() => { if (!this.target) this.play('idle', 0.5); }, 2600);
        this.idleT = 5 + Math.random() * 6;
      } else if (this.current === this.actions.walk || this.current === this.actions.run) this.play('idle', 0.3);
      if (this.current) this.current.timeScale = 1;
    }
    this.mixer.update(dt);
    // facing: travel heading while moving, else side-on (dir), plus a turn towards the viewer
    let want = (heading ?? (this.dir > 0 ? Math.PI / 2 : -Math.PI / 2)) + this.lookA * 1.8 * this.dir;
    if (!moving && this.faceYaw !== undefined && this.faceYaw !== null) want = this.faceYaw;
    if (!moving && this.gazeAt) {
      const lp = this.group.parent ? this.group.parent.worldToLocal(this.gazeAt.clone()) : this.gazeAt;
      const toward = Math.atan2(lp.x - p.x, lp.z - p.z);
      let off = toward - this.yaw; off = Math.atan2(Math.sin(off), Math.cos(off));
      // like a real animal: the body turns only until the head can reach (≤ ~50°)
      if (Math.abs(off) > 0.85) want = this.yaw + off - Math.sign(off) * 0.85; else want = this.yaw;
    }
    let dy = want - this.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
    this.yaw += dy * Math.min(1, dt * 6);
    this.inner.rotation.y = this.yaw;
    // hop arc
    if (this.hopT >= 0) {
      this.hopT += dt * 2.4; this.hop = Math.sin(Math.min(1, this.hopT) * Math.PI) * this.hopH;
      if (this.hopT >= 1) { this.hopT = -1; this.hop = 0; }
    }
    this.inner.position.y = this.hop;
    // head: aim at the look target on top of the animation, then nod
    this.aimW += ((this.gazeAt ? 1 : 0) - (this.aimW || 0)) * Math.min(1, dt * 5);
    if (this.aimW > 0.01 && this.aimChain.length) this.aim(this.gazeAt || this.lastLook, this.aimW);
    if (this.gazeAt) this.lastLook = this.gazeAt.clone();
    if (this.nodT !== undefined && this.head) {
      this.nodT += dt * 4;
      this.tilt(this.head, Math.sin(this.nodT * Math.PI) * 0.3);
      if (this.nodT >= this.nodN) this.nodT = undefined;
    }
    this.shadow.position.set(p.x, (this.ground ? this.ground(p.x, p.z) : p.y) + 0.004, p.z + 0.02);
    this.shadow.material.opacity = 1 - Math.min(0.7, this.hop * 3);
  }

  // rotate neck and head bones (in world space) so the face points at `target`,
  // each bone taking a share of the turn and never past its natural limit
  aim(target, weight) {
    if (!target) return;
    this.group.updateMatrixWorld(true);
    const hp = new THREE.Vector3(), q = new THREE.Quaternion(), pq = new THREE.Quaternion(), id = new THREE.Quaternion();
    this.head.getWorldPosition(hp);
    const want = target.clone().sub(hp).normalize();
    for (const c of this.aimChain) {
      c.b.getWorldQuaternion(q);
      const f = c.fwd.clone().applyQuaternion(q);
      const r = new THREE.Quaternion().setFromUnitVectors(f, want);
      const ang = 2 * Math.acos(Math.min(1, Math.abs(r.w)));
      const k = Math.min(c.share, ang > 1e-4 ? c.limit / ang : 1) * weight;
      r.copy(id).slerp(r, k);
      c.b.parent.getWorldQuaternion(pq);
      c.b.quaternion.copy(pq.invert().multiply(r.multiply(q)));
      c.b.updateMatrixWorld(true);
    }
  }
  // tip a bone forward/back around its own sideways axis (a real nod)
  tilt(b, angle) {
    const q = new THREE.Quaternion(), pq = new THREE.Quaternion();
    b.getWorldQuaternion(q);
    const rest = this.aimChain.find(c => c.b === b)?.fwd || new THREE.Vector3(0, 0, 1);
    const fwd = rest.clone().applyQuaternion(q).normalize();
    const side = new THREE.Vector3().crossVectors(fwd, new THREE.Vector3(0, 1, 0)).normalize();
    const r = new THREE.Quaternion().setFromAxisAngle(side, angle);
    b.parent.getWorldQuaternion(pq);
    b.quaternion.copy(pq.invert().multiply(r.multiply(q)));
  }

  dispose() {
    this.mixer.stopAllAction();
    this.group.removeFromParent(); this.shadow.removeFromParent();
    this.root.traverse(o => { if (o.isMesh) { o.geometry.dispose(); [].concat(o.material).forEach(m => m.dispose()); } });
  }
}

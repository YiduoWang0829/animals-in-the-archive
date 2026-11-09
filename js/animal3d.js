// A 3D animal (rigged glTF with its own animation clips) as a gallery "actor".
// It walks, gallops and idles with the model's real animations, turns smoothly
// towards where it is going, and can be repainted in the painting's manner:
//   style 'storybook' → soft toon shading + ink outline (a children's-book look)
//   painting styles   → eden (oil glaze), durer (engraved hatching), marc (prism)
// The repainting only applies inside the picture frame, like the 2D characters.
//
// Models: Quaternius "Ultimate Animated Animals" (CC0), see CREDITS.md.

import * as THREE from '../vendor/three-0.170.0/build/three.module.js';
import { GLTFLoader } from '../vendor/three-0.170.0/examples/jsm/loaders/GLTFLoader.js';
import { mergeVertices } from '../vendor/three-0.170.0/examples/jsm/utils/BufferGeometryUtils.js';

const STYLE_ID = { eden: 1, hicks: 1, durer: 2, marc: 3, storybook: 4 };

// GLSL injected into the standard material: repaint after lighting
const PAINT_HEAD = /* glsl */`
  uniform float uPaintStyle, uPaintAll, uWallZ, uHatchF;
  uniform vec3 uAnchor;
  float gRim = 0.0;
  uniform vec4 uFrame;
  varying vec3 vWorldP;
  float lumA(vec3 c) { return dot(c, vec3(0.3, 0.59, 0.11)); }
  float engLine(float u, float w) {           // 1 on an engraved line of relative width w, antialiased
    if (w <= 0.0) return 0.0;
    float d = abs(fract(u) - 0.5) * 2.0, fw = fwidth(u) * 2.0;
    float line = smoothstep(1.0 - w - fw, 1.0 - w + fw, d);     // d = 1 at the line's centre
    return mix(line, clamp(w, 0.0, 1.0), smoothstep(0.5, 1.0, fw));   // too fine to draw: average tone
  }
  vec3 paintIt(vec3 c, float style, vec2 sc) {
    float l = lumA(c);
    if (style < 1.5) {                         // Flemish oil: amber varnish, deep warm shadows
      c = mix(vec3(l), c, 1.1) * vec3(1.06, 0.96, 0.78);
      return mix(vec3(0.12, 0.09, 0.05), c, 0.65 + 0.35 * l);
    } else if (style < 2.5) {                  // engraving: tone becomes cut line
      // Lines are fixed to the animal in space (not to the screen), so they travel with it
      // like a burin's lines on a form instead of shimmering. Light areas: thin, sparse
      // strokes; mid-tones: thicker; shadows: a cross-hatch; deepest: a third set.
      float t = smoothstep(0.2, 0.62, l);  // the body's real (sRGB) range in the low gallery light
      vec3 P = (vWorldP - uAnchor) * uHatchF;    // anchored to the animal, so they move with it
      float u1 = P.y * 0.82 + P.x * 0.45 + P.z * 0.36;
      float u2 = P.y * 0.55 - P.x * 0.62 + P.z * 0.55;
      float u3 = P.x * 0.7 + P.z * 0.7;
      float ink = engLine(u1, (1.0 - t) * 0.42 + 0.08);
      ink = max(ink, engLine(u2 * 1.08, (0.42 - t) * 0.6));
      ink = max(ink, engLine(u3 * 1.2, (0.22 - t) * 1.2));
      ink = max(ink, smoothstep(0.62, 0.8, gRim));      // the engraver's contour
      return mix(vec3(0.8, 0.75, 0.63), vec3(0.1, 0.085, 0.07), ink * 0.92);
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
        gRim = 1.0 - abs(normalize(normal).z);
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

// Some clips carry "root motion": the whole body travels forward during the cycle and
// jumps back when it loops. Here the actor moves itself, so on the root and hip bones the
// steady drift is taken out (the sway and bob stay).
function stripRootMotion(clip) {
  for (const tr of clip.tracks) {
    if (!/\.position$/.test(tr.name) || !/(root|^cg|hips|pelvis|armature)/i.test(tr.name.split('.')[0].replace(/^.*\//, ''))) continue;
    const v = tr.values, t = tr.times, n = t.length, T = t[n - 1] - t[0];
    if (n < 3 || T <= 0) continue;
    for (let k = 0; k < 3; k++) {
      const d = v[(n - 1) * 3 + k] - v[k];
      for (let i = 0; i < n; i++) v[i * 3 + k] -= d * (t[i] - t[0]) / T;
    }
  }
  return clip;
}

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
      uPaintStyle: { value: look === 'storybook' ? STYLE_ID.storybook : 0 }, uPaintAll: { value: look === 'storybook' ? 1 : 0 }, uHatchF: { value: 200 }, uAnchor: { value: new THREE.Vector3() },
      uWallZ: { value: -1e9 }, uFrame: { value: new THREE.Vector4(1e9, -1e9, 1e9, -1e9) }, uOutline: { value: 0 },
    };
    this.look = look;
    const outlines = [];
    this.root.traverse(o => {
      if (!o.isMesh) return;
      o.castShadow = false;
      // a realistic, textured model keeps its own normals (recomputing them would show
      // the UV seams); a faceted low-poly one is smoothed so it reads as a soft body
      const textured = [].concat(o.material).some(m => m.map);
      if (!textured) {
        const g = o.geometry;
        g.deleteAttribute('normal');
        o.geometry = mergeVertices(g, 1e-4);
        o.geometry.computeVertexNormals();
      }
      o.frustumCulled = false;                    // skinned bounds lag behind the pose
      const mats = [].concat(o.material).map(m => {
        const n = m.clone(); n.flatShading = false; n.roughness = textured ? 0.9 : 0.82; n.metalness = 0;
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
    // stand the animal up and face it forward (+z). Models come authored in every way
    // (sideways, nose-up); the bones say where the head, the hips and the feet are.
    const allBones = []; this.root.traverse(o => { if (o.isBone) allBones.push(o); });
    const isHead = b => /head/i.test(b.name) && !/(nub|end|correct|be_head|ponytail|ik|dyn)/i.test(b.name);
    const isBack = b => /(pelvis|hips)/i.test(b.name);
    const isFoot = b => /(ankle|foot|toe|hoof|hand|digit|metatars|paw)/i.test(b.name) && !/(nub|end|twist|correct|ik|dyn)/i.test(b.name);
    const headB = allBones.find(isHead), backB = allBones.find(isBack) || allBones.find(b => /spine|^cg/i.test(b.name)) || allBones.find(b => /^tail/i.test(b.name));
    const feet = allBones.filter(isFoot);
    // measure in a real pose (the first frame of its idle or walk): some rigs keep a rest
    // pose turned differently from how every animation holds the body
    const poseMixer = new THREE.AnimationMixer(this.root);
    const poseClip = gltf.animations.find(c => /^walk$/i.test(clipName(c))) || gltf.animations.find(c => /walk/i.test(clipName(c))) || gltf.animations.find(c => /idle|stand|breath/i.test(clipName(c))) || gltf.animations[0];
    if (poseClip) { poseMixer.clipAction(poseClip).play(); poseMixer.setTime(0); }
    this.root.updateMatrixWorld(true);
    const wp = b => b.getWorldPosition(new THREE.Vector3());
    if (headB && backB) {
      const fwd = wp(headB).sub(wp(backB));
      let up = new THREE.Vector3(0, 1, 0);
      if (feet.length >= 2) {                     // up: from the feet towards the hips
        const fa = feet.reduce((acc, f) => acc.add(wp(f)), new THREE.Vector3()).multiplyScalar(1 / feet.length);
        up = wp(backB).sub(fa);
      }
      // up comes first (feet → hips); forward is the head direction made level with it, so a
      // head held higher than the hips never tips the whole body nose-up or tail-up
      up.normalize(); fwd.addScaledVector(up, -fwd.dot(up)).normalize();
      if (up.lengthSq() > 0.5) {
        const right = new THREE.Vector3().crossVectors(up, fwd);
        const basis = new THREE.Matrix4().makeBasis(right, up, fwd);
        const q = new THREE.Quaternion().setFromRotationMatrix(basis).invert();
        if (q.angleTo(new THREE.Quaternion()) > 0.3) this.root.quaternion.premultiply(q);
      }
    }
    // normalise size: the model's height becomes `height` metres, feet at y = 0, centred.
    // The bounds come from the skinned (posed) vertices, not the raw mesh, since a rig can
    // sit away from the mesh's own origin.
    this.root.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(this.root, true);
    const s = 1 / (box.max.y - box.min.y);
    this.root.scale.multiplyScalar(s);
    this.root.position.set(-(box.min.x + box.max.x) / 2 * s, -box.min.y * s, -(box.min.z + box.max.z) / 2 * s);
    this.length = (box.max.z - box.min.z) * s;
    poseMixer.stopAllAction(); poseMixer.uncacheRoot(this.root);
    this.uniforms.uOutline.value = 0.0035;        // outline thickness (fraction of the screen)
    // neck and head bones, with the direction each one "faces" in the rest pose
    // (the model faces +z), so the head can be aimed at a point anatomically
    // bones are found by name pattern: "Head", "Head_023", "Neck2", "Neck1_021" …
    const bones = allBones;
    const byName = n => bones.find(b => b.name === n) || null;
    this.head = byName('Head') || bones.find(isHead) || null;
    const necks = bones.filter(b => /neck/i.test(b.name) && !/(fix|off|correct|end|nub|ik)/i.test(b.name));
    this.neck = byName('Neck2') ? ['Neck2', 'Neck3', 'Neck'].map(byName).filter(Boolean) : necks.slice(-2).reverse();
    this.feet = feet; this.backBone = backB;
    this.aimChain = [...this.neck.map(b => ({ b, share: 0.25, limit: 0.16 })), ...(this.head ? [{ b: this.head, share: 1, limit: 0.5 }] : [])];
    this.root.updateMatrixWorld(true);
    const qw = new THREE.Quaternion();
    for (const c of this.aimChain) c.fwd = new THREE.Vector3(0, 0, 1).applyQuaternion(c.b.getWorldQuaternion(qw).invert());

    // animations
    this.mixer = new THREE.AnimationMixer(this.root);
    this.clips = {};
    for (const c of gltf.animations) { const n = clipName(c); if (!this.clips[n]) this.clips[n] = c; }
    // how far a walk or run carries the body in one cycle (its own root motion), measured
    // before that motion is taken out: the honest pace for the feet
    this.travel = {};
    for (const k of ['Walk', 'Gallop', 'Run']) {
      const c = this.clips[k]; if (!c || !this.backBone) continue;
      const act = this.mixer.clipAction(c); act.reset().play();
      const p = t => { this.mixer.setTime(t); this.root.updateMatrixWorld(true); return this.inner.worldToLocal(this.backBone.getWorldPosition(new THREE.Vector3())); };
      const d = p(c.duration - 1e-3).sub(p(0)); act.stop(); this.mixer.setTime(0);
      this.travel[k] = Math.hypot(d.x, d.z);
    }
    for (const c of Object.values(this.clips)) stripRootMotion(c);
    // a clip that holds the body some other way than the walk does (a different root
    // orientation in the file) would flip the animal over: leave it out
    if (this.clips.Walk && this.head) {
      const probe = c => {
        const act = this.mixer.clipAction(c); act.reset().play(); this.mixer.setTime(0.05); this.root.updateMatrixWorld(true);
        const h = this.inner.worldToLocal(this.head.getWorldPosition(new THREE.Vector3()));
        const fy = feet.length ? Math.min(...feet.map(f => this.inner.worldToLocal(f.getWorldPosition(new THREE.Vector3())).y)) : 0;
        act.stop(); this.mixer.setTime(0); return { h, fy };
      };
      const ref = probe(this.clips.Walk);
      for (const k of Object.keys(this.clips)) {
        if (k === 'Walk' || /^Sleep/.test(k)) continue;
        const p = probe(this.clips[k]);
        const flipped = p.fy > 0.3 || p.h.z * ref.h.z < 0 || Math.abs(p.h.x) > 0.5;
        if (flipped || (!/^(Eating|Call|Shake)$/.test(k) && p.h.distanceTo(ref.h) > 0.6)) delete this.clips[k];
      }
    }
    // a model without a standing clip holds a still frame of its walk; without a walk, it trots
    if (!this.clips.Walk && (this.clips.Gallop || this.clips.Run)) this.clips.Walk = this.clips.Gallop || this.clips.Run;
    if (!this.clips.Idle && this.clips.Walk) this.clips.Idle = THREE.AnimationUtils.subclip(this.clips.Walk, 'Idle', 0, 1, 30);
    const pick = (...names) => names.map(n => this.clips[n]).find(Boolean);
    this.anim = {
      idle: pick('Idle'), idle2: pick('Idle_2', 'Idle_Headlow', 'Idle_2_HeadLow'), eat: pick('Eating', 'Idle_Eating'),
      walk: pick('Walk'), run: pick('Gallop', 'Run'), jump: pick('Gallop_Jump', 'Jump_toIdle', 'Jump_ToIdle', 'Run_Jump'),
      shake: pick('Shake'), call: pick('Call'), sleepEnd: pick('Sleep_End'),
    };
    this.actions = {};
    for (const [k, c] of Object.entries(this.anim)) if (c) this.actions[k] = this.mixer.clipAction(c);
    this.current = null;
    // measure how far one cycle of each gait carries the animal (in body heights),
    // so playback speed can match ground speed: the feet plant instead of sliding
    const fromTravel = k => this.travel[k] > 0.08 ? { len: this.travel[k], dur: this.clips[k].duration } : null;
    // a foot sweep that is implausibly short (an odd foot bone) falls back to body length
    const sane = (m, k, clip) => m && m.len > 0.3 ? m : clip ? { len: this.length * k, dur: clip.duration } : null;
    this.stride = {
      walk: fromTravel('Walk') || sane(this.measureStride(this.anim.walk), 0.6, this.anim.walk) || { len: 0.9, dur: 1 },
      run: fromTravel('Gallop') || fromTravel('Run') || sane(this.measureStride(this.anim.run), 1.3, this.anim.run) || { len: 2.2, dur: 1 },
    };
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
    if (!foot && this.feet?.length) {
      this.root.updateMatrixWorld(true);
      const P = o => this.inner.worldToLocal(o.getWorldPosition(new THREE.Vector3()));
      foot = [...this.feet].sort((a, b) => P(b).z - P(a).z)[0];
    }
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
  setHeight(h) { this._h = h; this.inner.scale.setScalar(h); if (this.uniforms) this.uniforms.uHatchF.value = 52 / Math.max(0.05, h); this.shadow.scale.set(h * this.length * 0.9, h * 0.6, 1); }
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
  // a one-off movement from the model's own clips (a head shake, a call), then back to idle
  gesture(name) {
    const a = this.actions[name];
    if (!a || this.target) return false;
    a.setLoop(THREE.LoopOnce, 1); a.clampWhenFinished = false;
    this.current = null; this.play(name, 0.25);
    clearTimeout(this._gT);
    this._gT = setTimeout(() => { if (this.current === a && !this.target) this.play('idle', 0.45); }, Math.max(300, a.getClip().duration * 1000 - 400));
    return true;
  }
  nod(times = 2) { this.nodT = 0; this.nodN = times; }

  update(dt, t) {
    if (this.uniforms) this.group.getWorldPosition(this.uniforms.uAnchor.value);
    const p = this.group.position;
    let moving = false, heading = null;
    // ground speed follows the animation: at most ~1.5× the gait's natural pace, so
    // the hooves and paws stay planted. A walk that is asked to go much faster gallops.
    const natW = this.stride.walk.len * this._h / this.stride.walk.dur, natR = this.stride.run.len * this._h / this.stride.run.dur;
    if (this.target) {
      const running = false;                    // they always walk: calm, never a dash
      this.gaitRun = running;
      // a normal pace: about two of its own animation strides per second of travel
      this.effSpeed = Math.min(this.speed, natW * 1.5);
    }
    if (this.target) {
      const d = this.target.clone().sub(p), dist = d.length(), step = this.effSpeed * dt;
      if (dist <= step) {
        p.copy(this.target);
        if (this.path?.length) { this.target = this.path.shift(); moving = true; heading = this.lastHeading; }
        else { this.target = null; this._arrive?.(); this._arrive = null; }
      } else {
        heading = Math.atan2(d.x, d.z); this.lastHeading = heading;
        // like a real animal: turn first, then walk (never shuffle backwards or sideways)
        let off = heading - this.yaw; off = Math.atan2(Math.sin(off), Math.cos(off));
        const k = Math.abs(off) > 0.6 ? 0 : Math.abs(off) > 0.3 ? 0.4 : 1;
        p.addScaledVector(d.normalize(), step * k); moving = true;
      }
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
      if (this.idleT < 0 && !this.gazeAt && !this.calm) {   // now and then: graze or look around
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
      // like a real animal: the body turns only until the head can reach (≤ ~50°).
      // In a conversation it turns properly towards the other one, head a little ahead.
      const reach = this.gazeBody ? 0.3 : 0.85;
      if (Math.abs(off) > reach) want = this.yaw + off - Math.sign(off) * reach; else want = this.yaw;
    }
    // turning: a smooth start and a soft landing (critically damped), never a snap
    let dy = want - this.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
    const k = moving ? 9 : 5.5;
    this.yawV = ((this.yawV || 0) + (dy * k * k - 2 * k * (this.yawV || 0)) * dt);
    this.yawV = THREE.MathUtils.clamp(this.yawV, -4, 4);
    this.yaw += this.yawV * dt;
    this.inner.rotation.y = this.yaw;
    // hop arc
    if (this.hopT >= 0) {
      this.hopT += dt * 2.4; this.hop = Math.sin(Math.min(1, this.hopT) * Math.PI) * this.hopH;
      if (this.hopT >= 1) { this.hopT = -1; this.hop = 0; }
    }
    this.inner.position.y = this.hop;
    // head: aim at the look target on top of the animation, then nod
    this.aimW = (this.aimW || 0) + ((this.gazeAt ? 1 : 0) - (this.aimW || 0)) * Math.min(1, dt * 3.2);
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
    // a real neck looks up or down only a little: limit the vertical part of the look
    const flat = Math.hypot(want.x, want.z);
    want.y = THREE.MathUtils.clamp(want.y, -flat * 0.35, flat * 0.45); want.normalize();
    // and never past the shoulder: if the target is behind, the body must turn first
    const bodyF = new THREE.Vector3(Math.sin(this.yaw), 0, Math.cos(this.yaw));
    if (this.group.parent) bodyF.transformDirection(this.group.parent.matrixWorld);
    if (bodyF.dot(new THREE.Vector3(want.x, 0, want.z).normalize()) < 0.05) return;
    for (const c of this.aimChain) {
      c.b.getWorldQuaternion(q);
      const f = c.fwd.clone().applyQuaternion(q);
      const r = new THREE.Quaternion().setFromUnitVectors(f, want);
      const ang = 2 * Math.acos(Math.min(1, Math.abs(r.w)));
      const k = Math.min(c.share, ang > 1e-4 ? c.limit / ang : 1) * weight;
      r.slerpQuaternions(id, r.clone(), k);          // take only this bone's share of the turn
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

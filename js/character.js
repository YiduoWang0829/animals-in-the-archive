// A walking 2D character in the 3D scene.
// The texture is a side-view cut-out (photo, storybook painting or the visitor's
// own drawing). A vertex shader swings the legs found by rig.js in a diagonal
// gait, lifts the feet, bobs the body and nods the head, so the animal walks
// instead of sliding. A fragment shader can "paint" the animal in the style of
// the painting, but only where it is inside the picture frame.

import * as THREE from 'three';
import { autoRig } from './rig.js';
import { boxBlurAlpha } from './util.js';

const VERT = /* glsl */`
  uniform float uPhase, uWalk, uPivot, uHeadU, uNod;
  uniform vec4 uLegs;          // group A (u0,u1), group B (u0,u1)
  uniform float uLegCount;
  varying vec2 vUv;
  varying vec3 vWorld;
  const float PI = 3.14159265;

  float band(float u, float a, float b) {
    return smoothstep(a - 0.015, a + 0.015, u) * (1.0 - smoothstep(b - 0.015, b + 0.015, u));
  }
  // one leg group: near and far leg (left/right half) swing in opposite phase
  vec2 swing(float u, float v, float a, float b, float phase, float height) {
    float w = band(u, a, b);
    if (w <= 0.0) return vec2(0.0);
    float below = clamp((uPivot - v) / max(uPivot, 0.001), 0.0, 1.0);
    float k = smoothstep(0.0, 0.3, below) * w;
    float ph = phase + step((a + b) * 0.5, u) * PI;
    float ang = sin(ph) * 0.42 * uWalk;
    float len = (uPivot - v) * height;
    float lift = max(0.0, cos(ph)) * 0.035 * uWalk * below;
    return vec2(sin(ang) * len, -(1.0 - cos(ang)) * len + lift) * k;
  }

  void main() {
    vUv = uv;
    vec3 p = position;                     // plane: y from 0 (feet) to 1, x = (u - .5) * aspect
    if (uLegCount > 0.5) p.xy += swing(uv.x, uv.y, uLegs.x, uLegs.y, uPhase, 1.0);
    if (uLegCount > 1.5) p.xy += swing(uv.x, uv.y, uLegs.z, uLegs.w, uPhase + PI, 1.0);
    float upper = smoothstep(uPivot - 0.1, uPivot + 0.1, uv.y);
    p.y += abs(sin(uPhase)) * 0.022 * uWalk * upper;                       // body bob
    float head = (1.0 - smoothstep(0.0, 0.32, abs(uv.x - uHeadU))) * smoothstep(uPivot, 1.0, uv.y);
    p.y += (sin(uPhase * 2.0) * 0.012 * uWalk + uNod * 0.06) * head;          // head nod
    vec4 wp = modelMatrix * vec4(p, 1.0);
    vWorld = wp.xyz;
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;

const FRAG = /* glsl */`
  uniform sampler2D uMap, uNormal;
  uniform float uLit, uPaintStyle, uPaintAll, uOpacity, uLight;
  uniform vec4 uFrame;                    // painting rect in world: xmin, xmax, ymin, ymax
  uniform float uWallZ;
  uniform vec3 uSpot, uLightDir;
  uniform vec2 uTexel;
  uniform float uFlip;
  varying vec2 vUv;
  varying vec3 vWorld;

  float lum(vec3 c) { return dot(c, vec3(0.3, 0.59, 0.11)); }

  vec3 eden(vec3 c) {                      // Flemish oil: soften, warm varnish, olive shadows
    vec3 s = (texture2D(uMap, vUv + uTexel * vec2(2, 0)).rgb + texture2D(uMap, vUv - uTexel * vec2(2, 0)).rgb +
              texture2D(uMap, vUv + uTexel * vec2(0, 2)).rgb + texture2D(uMap, vUv - uTexel * vec2(0, 2)).rgb) * 0.25;
    c = mix(c, s, 0.45);
    c = (c - 0.5) * 1.3 + 0.5;                                   // oil paint has depth: more contrast
    float l = lum(c);
    c = mix(vec3(l), c, 1.1);                                    // and richer colour
    c = c * vec3(1.04, 0.97, 0.83) + vec3(0.02, 0.012, 0.0);      // amber varnish
    return clamp(mix(vec3(0.12, 0.1, 0.05), c, 0.7 + 0.3 * l), 0.0, 1.0);
  }
  vec3 durer(vec3 c) {                     // engraving: tones become hatched lines
    float l = pow(lum(c), 0.85);
    vec2 q = vUv / uTexel / 3.2;
    float a = abs(fract((q.x + q.y) * 0.5) - 0.5) * 2.0;
    float b = abs(fract((q.x - q.y) * 0.45) - 0.5) * 2.0;
    float ink = step(0.35 + l * 0.65, a);
    ink = max(ink, step(0.45 + l * 1.1, b) * step(l, 0.45));
    return mix(vec3(0.89, 0.85, 0.76), vec3(0.12, 0.1, 0.09), ink);
  }
  vec3 marc(vec3 c) {                      // prismatic expressionist palette
    float l = lum(c); float warm = c.r - c.b;
    vec3 k;
    if (l > 0.78) k = vec3(0.92);
    else if (warm > 0.28 && l > 0.32) k = l > 0.55 ? vec3(0.88, 0.41, 0.16) : vec3(0.70, 0.17, 0.12);
    else if (l < 0.22) k = vec3(0.09, 0.12, 0.43);
    else if (l < 0.42) k = vec3(0.17, 0.26, 0.70);
    else k = vec3(0.36, 0.47, 0.82);
    return mix(k, c, 0.18);
  }

  void main() {
    vec4 t = texture2D(uMap, vUv);
    if (t.a < 0.08) discard;
    vec3 col = t.rgb;
    // photo mode: relief shading from a normal map → reads as a 3D body
    if (uLit > 0.5) {
      vec3 n = texture2D(uNormal, vUv).xyz * 2.0 - 1.0;
      n.x *= uFlip;
      float d = clamp(dot(normalize(n), normalize(uLightDir)), 0.0, 1.0);
      col *= 0.55 + 0.75 * d;
    }
    // inside the picture frame the animal is repainted in the painting's manner
    float inside = step(uFrame.x, vWorld.x) * step(vWorld.x, uFrame.y) *
                   step(uFrame.z, vWorld.y) * step(vWorld.y, uFrame.w) * step(vWorld.z, uWallZ);
    float paint = max(inside, uPaintAll);
    if (paint > 0.0) {
      vec3 p = uPaintStyle < 1.5 ? eden(col) : uPaintStyle < 2.5 ? durer(col) : marc(col);
      col = mix(col, p, paint);
    }
    // gallery lighting: brighter in the spotlight pool
    float sd = length(vWorld.xz - uSpot.xz);
    float light = mix(0.5, 0.95, exp(-sd * sd / 5.0)) * uLight;
    gl_FragColor = vec4(col * light, t.a * uOpacity);
    #include <colorspace_fragment>
  }
`;

// normal map from the silhouette: blurred alpha as a soft "pillow" height field
function pillowNormals(img, size = 256) {
  const s = size / Math.max(img.width, img.height);
  const w = Math.round(img.width * s), h = Math.round(img.height * s);
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  const ctx = cv.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(img, 0, 0, w, h);
  const a = boxBlurAlpha(ctx.getImageData(0, 0, w, h).data, w, h, Math.max(2, Math.round(size / 40)));
  // luminance adds fur/muscle detail on top of the volume
  const c2 = document.createElement('canvas'); c2.width = w; c2.height = h;
  const x2 = c2.getContext('2d', { willReadFrequently: true }); x2.drawImage(img, 0, 0, w, h);
  const L = x2.getImageData(0, 0, w, h).data;
  const H = (x, y) => {
    x = Math.max(0, Math.min(w - 1, x)); y = Math.max(0, Math.min(h - 1, y));
    const i = (y * w + x) * 4;
    return Math.sqrt(a[i + 3] / 255) * 6 + (L[i] + L[i + 1] + L[i + 2]) / 765 * 0.8;
  };
  const out = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const dx = H(x + 1, y) - H(x - 1, y), dy = H(x, y - 1) - H(x, y + 1);
    const n = new THREE.Vector3(-dx, -dy, 1).normalize();
    const i = ((h - 1 - y) * w + x) * 4;            // flip Y for the texture
    out[i] = (n.x * 0.5 + 0.5) * 255; out[i + 1] = (n.y * 0.5 + 0.5) * 255; out[i + 2] = (n.z * 0.5 + 0.5) * 255; out[i + 3] = 255;
  }
  const tex = new THREE.DataTexture(out, w, h, THREE.RGBAFormat);
  tex.needsUpdate = true;
  return tex;
}

let shadowTex = null;
function blobShadow() {
  if (!shadowTex) {
    const c = document.createElement('canvas'); c.width = c.height = 128;
    const g = c.getContext('2d');
    const gr = g.createRadialGradient(64, 64, 4, 64, 64, 62);
    gr.addColorStop(0, 'rgba(0,0,0,0.55)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
    shadowTex = new THREE.CanvasTexture(c);
  }
  return new THREE.Mesh(new THREE.PlaneGeometry(1, 1),
    new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false }));
}

const STYLE_ID = { eden: 1, durer: 2, marc: 3 };

export class Character {
  // image: HTMLImageElement or canvas; headSide: which way the head points in the image
  constructor(image, { height = 0.6, headSide = 'right', lit = false, name = '', gait } = {}) {
    this.name = name;
    this.headSide = headSide;
    this.aspect = image.width / image.height;
    this.rig = autoRig(image, headSide);
    if (gait === 'hop') this.rig.type = 'hop';
    const tex = new THREE.Texture(image);
    tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4; tex.needsUpdate = true;
    const legs = this.rig.legs;
    this.uniforms = {
      uMap: { value: tex }, uNormal: { value: lit ? pillowNormals(image) : null },
      uLit: { value: lit ? 1 : 0 }, uPhase: { value: 0 }, uWalk: { value: 0 },
      uPivot: { value: this.rig.pivotV }, uHeadU: { value: this.rig.headU }, uNod: { value: 0 },
      uLegs: { value: new THREE.Vector4(legs[0]?.u0 ?? 0, legs[0]?.u1 ?? 0, legs[1]?.u0 ?? 0, legs[1]?.u1 ?? 0) },
      uLegCount: { value: this.rig.type === 'walk' ? legs.length : 0 },
      uPaintStyle: { value: 0 }, uPaintAll: { value: 0 }, uOpacity: { value: 1 }, uLight: { value: 1 },
      uFrame: { value: new THREE.Vector4(1e9, -1e9, 1e9, -1e9) }, uWallZ: { value: -1e9 },
      uSpot: { value: new THREE.Vector3(0, 0, 1.5) }, uLightDir: { value: new THREE.Vector3(0.4, 0.6, 0.7) },
      uTexel: { value: new THREE.Vector2(1 / image.width, 1 / image.height) }, uFlip: { value: 1 },
    };
    const geo = new THREE.PlaneGeometry(this.aspect, 1, 48, 48);
    geo.translate(0, 0.5, 0);                     // feet at the origin
    this.mesh = new THREE.Mesh(geo, new THREE.ShaderMaterial({
      uniforms: this.uniforms, vertexShader: VERT, fragmentShader: FRAG, transparent: true,
      side: THREE.DoubleSide,
    }));
    this.mesh.renderOrder = 2;
    this.shadow = blobShadow();
    this.shadow.rotation.x = -Math.PI / 2;
    this.group = new THREE.Group();
    this.group.add(this.mesh);
    this.height = height;
    this.dir = 1;                                 // +1 walking/looking right, -1 left
    this.turn = 1;                                // animated facing (-1..1)
    this.hop = 0; this.hopT = -1;
    this.target = null; this.speed = 0.8;
    this.ground = null;                           // function (x, z) → y; default: floor y = 0
    this.setHeight(height);
    this.setDir(1, true);
  }

  setHeight(h) { this.height = h; this.mesh.scale.set(h, h, h); this.shadow.scale.set(h * this.aspect * 0.9, h * 0.35, 1); }
  addTo(scene) { scene.add(this.group); scene.add(this.shadow); return this; }
  setPaint(style, frameRect, wallZ) {
    this.uniforms.uPaintStyle.value = STYLE_ID[style] || 0;
    if (frameRect) this.uniforms.uFrame.value.copy(frameRect);
    if (wallZ !== undefined) this.uniforms.uWallZ.value = wallZ;
  }
  get position() { return this.group.position; }

  // face left/right; the turn is animated as a quick squash so it reads as turning around
  setDir(d, instant = false) { this.dir = d; if (instant) this.turn = d; }
  headPoint() {
    const p = this.group.position.clone();
    const u = (this.rig.headU - 0.5) * this.aspect * this.height * (this.headSide === 'right' ? 1 : -1) * this.turn;
    return p.add(new THREE.Vector3(u * (this.headSide === 'right' ? 1 : -1), this.height * 0.95, 0));
  }

  walkTo(target, speed = 0.8) {
    this.target = target.clone(); this.speed = speed;
    const dx = target.x - this.group.position.x;
    if (Math.abs(dx) > 0.02) this.setDir(Math.sign(dx));
    return new Promise(res => { this._arrive = res; });
  }
  stop() { this.target = null; this._arrive?.(); this._arrive = null; }
  hopOnce(height = 0.12) { this.hopT = 0; this.hopH = height; }
  nod(times = 2) { this.nodT = 0; this.nodN = times; }

  update(dt, t) {
    const u = this.uniforms;
    let walking = false;
    if (this.target) {
      const p = this.group.position, d = this.target.clone().sub(p);
      const dist = d.length(), step = this.speed * dt;
      if (dist <= step) { p.copy(this.target); this.target = null; this._arrive?.(); this._arrive = null; }
      else { p.addScaledVector(d.normalize(), step); walking = true; }
      // stride length ~ 0.55 × height: legs cycle in step with the distance covered
      if (walking) u.uPhase.value += (step / (this.height * 0.55)) * Math.PI;
    }
    if (this.rig.type === 'hop' && walking && this.hopT < 0) this.hopOnce(0.08 * this.height / 0.6);
    u.uWalk.value += ((walking ? 1 : 0) - u.uWalk.value) * Math.min(1, dt * 8);
    if (!walking) u.uPhase.value += dt * 0.6 * (1 - u.uWalk.value) * 0;   // idle: legs still

    // hop arc
    if (this.hopT >= 0) {
      this.hopT += dt * 2.6;
      this.hop = Math.sin(Math.min(1, this.hopT) * Math.PI) * this.hopH;
      if (this.hopT >= 1) { this.hopT = -1; this.hop = 0; }
    }
    // nod
    if (this.nodT >= 0 && this.nodT !== undefined) {
      this.nodT += dt * 4;
      u.uNod.value = Math.sin(this.nodT * Math.PI) * 0.6;
      if (this.nodT >= this.nodN) { this.nodT = undefined; u.uNod.value = 0; }
    }
    // breathing when idle
    const breathe = 1 + Math.sin(t * 2.1) * 0.012 * (1 - u.uWalk.value);

    // animated turn: scale.x goes through 0 → reads as turning the body
    const want = this.dir * (this.headSide === 'right' ? 1 : -1);
    this.turn += (want - this.turn) * Math.min(1, dt * 7);
    u.uFlip.value = Math.sign(this.turn) || 1;
    const sx = this.height * (Math.abs(this.turn) < 0.08 ? 0.08 * Math.sign(this.turn || 1) : this.turn);
    this.mesh.scale.set(sx, this.height * breathe, this.height);

    const gy = this.ground ? this.ground(this.group.position.x, this.group.position.z) : this.group.position.y;
    this.mesh.position.y = this.hop;
    this.shadow.position.set(this.group.position.x, gy + 0.004, this.group.position.z + 0.02);
    this.shadow.material.opacity = 1 - Math.min(0.7, this.hop * 3);
  }

  dispose() {
    this.group.removeFromParent(); this.shadow.removeFromParent();
    this.mesh.geometry.dispose(); this.mesh.material.dispose();
    this.uniforms.uMap.value.dispose(); this.uniforms.uNormal.value?.dispose();
  }
}

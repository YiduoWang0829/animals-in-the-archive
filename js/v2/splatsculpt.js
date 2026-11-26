// The sculpture as a cloud of Gaussian splats: the same earth and the same figures, re-made out of
// hundreds of thousands of soft coloured points (the way 3D Gaussian splatting builds a scene),
// with a shimmer of prismatic light running over them.
//
// It is sampled from the sculpture's own surfaces (body, knobs, every figure), so whatever shape
// the visitor gave it, the cloud has. When it appears the points stream out of the flat painting
// and gather into the sculpture; they breathe and glint afterwards. Two layers:
//   core  – dense, nearly opaque splats with a soft Gaussian edge: the body reads as solid
//   glow  – sparse, additive sparks, colour shifting with the angle you see them from
// No sorting is needed: core splats write depth (their soft rim is drawn darker, not transparent),
// glow splats add light.

import * as THREE from '../../vendor/three-0.170.0/build/three.module.js';

const VERT = /* glsl */`
  attribute vec3 aStart, aEnd, aCol, aCol0, aNrm;
  attribute float aSize, aPhase;
  uniform float uT, uTime, uPx, uGlow, uIris;
  varying vec3 vCol; varying vec2 vQ; varying float vA, vRim;
  vec3 hue(float h) { return clamp(abs(mod(h * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0); }
  void main() {
    // gather: each point leaves the painting at its own moment and flies home along a curve
    float k = clamp((uT - aPhase * 0.55) / 0.45, 0.0, 1.0);
    k = k * k * (3.0 - 2.0 * k);
    vec3 mid = mix(aStart, aEnd, 0.5) + vec3(0.0, 0.35, 0.0) + aNrm * 0.25;
    vec3 p = mix(mix(aStart, mid, k), mix(mid, aEnd, k), k);
    // breathing: a slow swell along the surface normal, different for every point
    p += aNrm * sin(uTime * 1.3 + aPhase * 40.0) * 0.006 * k;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    vec3 n = normalize(normalMatrix * aNrm);
    vec3 V = normalize(-mv.xyz);
    float facing = dot(n, V);
    // the painted colour, lit softly from above-left; prismatic sheen where the surface turns away
    float diff = 0.55 + 0.45 * max(dot(n, normalize(vec3(-0.4, 0.8, 0.45))), 0.0);
    vec3 iris = hue(fract(facing * 0.9 + aPhase * 0.6 + uTime * 0.05));
    vRim = 1.0 - abs(facing);
    vec3 c = mix(aCol0, aCol * diff, smoothstep(0.15, 0.95, k));        // the painting's colour as it leaves, its own as it lands
    c = mix(c, iris * (0.55 + 0.7 * dot(aCol, vec3(0.33))), uIris * (0.1 + 0.7 * pow(vRim, 2.5)));   // prismatic light at the turning edges
    if (uGlow > 0.5) {
      c = mix(iris, aCol, 0.35) * (0.5 + 0.8 * pow(0.5 + 0.5 * sin(uTime * 3.0 + aPhase * 90.0), 6.0));
    }
    vCol = c * mix(1.4, 1.0, k);
    vA = uGlow > 0.5 ? 0.5 * smoothstep(0.6, 1.0, k) : 1.0;            // the sparks light up once it has gathered
    float s = aSize * mix(1.8, 1.0, k);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = max(1.0, s * projectionMatrix[1][1] * uPx * 0.5 / -mv.z);
  }`;
const FRAG = /* glsl */`
  uniform float uGlow;
  varying vec3 vCol; varying float vA, vRim;
  void main() {
    vec2 q = gl_PointCoord * 2.0 - 1.0;
    float r2 = dot(q, q);
    if (r2 > 1.0) discard;
    float g = exp(-r2 * 3.2);
    if (uGlow > 0.5) { gl_FragColor = vec4(vCol * g * vA, 1.0); }
    else {
      if (g < 0.2) discard;                         // the splat's footprint (depth written inside it)
      gl_FragColor = vec4(vCol * (0.55 + 0.45 * g), 1.0);
    }
    #include <colorspace_fragment>
  }`;

function triSampler(geo, matrix, mesh) {
  let P = geo.attributes.position; const idx = geo.index;
  if (mesh?.isSkinnedMesh) {           // a rigged animal: its surface as it stands now, not its bind pose
    const out = new Float32Array(P.count * 3), v = new THREE.Vector3();
    for (let i = 0; i < P.count; i++) { v.fromBufferAttribute(P, i); mesh.applyBoneTransform(i, v); out[i * 3] = v.x; out[i * 3 + 1] = v.y; out[i * 3 + 2] = v.z; }
    P = new THREE.BufferAttribute(out, 3);
  }
  const nTri = idx ? idx.count / 3 : P.count / 3;
  const A = new THREE.Vector3(), B = new THREE.Vector3(), C = new THREE.Vector3();
  const cum = new Float32Array(nTri); let tot = 0;
  for (let t = 0; t < nTri; t++) {
    const i0 = idx ? idx.getX(t * 3) : t * 3, i1 = idx ? idx.getX(t * 3 + 1) : t * 3 + 1, i2 = idx ? idx.getX(t * 3 + 2) : t * 3 + 2;
    A.fromBufferAttribute(P, i0).applyMatrix4(matrix); B.fromBufferAttribute(P, i1).applyMatrix4(matrix); C.fromBufferAttribute(P, i2).applyMatrix4(matrix);
    tot += B.sub(A).cross(C.sub(A)).length() * 0.5; cum[t] = tot;
  }
  return { nTri, cum, tot, idx, P };
}

export class SplatCloud {
  constructor(scene) {
    this.scene = scene; this.group = new THREE.Group(); scene.add(this.group);
    this.uniforms = { uT: { value: 0 }, uTime: { value: 0 }, uPx: { value: 800 }, uGlow: { value: 0 }, uIris: { value: 1 } };
    this.t = 0; this.visible = false;
  }
  // roots: objects whose meshes make the sculpture; painting: { px: {w,h,d}, A } for the start plane
  build(roots, painting, { count = 420000, glow = 22000 } = {}) {
    for (const c of [...this.group.children]) { c.geometry.dispose(); c.material.dispose(); this.group.remove(c); }
    const meshes = [];
    for (const r of roots) { r.updateMatrixWorld(true); r.traverse(o => { if (o.isMesh && o.visible !== false && o.geometry?.attributes.position && o.material?.side !== THREE.BackSide) meshes.push(o); }); }
    const samplers = meshes.map(m => ({ m, s: triSampler(m.geometry, m.matrixWorld, m) }));
    const total = samplers.reduce((a, b) => a + b.s.tot, 0) || 1;
    const make = (n, glowLayer) => {
      const col0 = new Float32Array(n * 3), start = new Float32Array(n * 3), end = new Float32Array(n * 3), col = new Float32Array(n * 3), nrm = new Float32Array(n * 3), size = new Float32Array(n), phase = new Float32Array(n);
      const A = new THREE.Vector3(), B = new THREE.Vector3(), C = new THREE.Vector3(), N = new THREE.Vector3(), nm = new THREE.Matrix3();
      const cA = new THREE.Color(), cB = new THREE.Color(), cC = new THREE.Color();
      let i = 0;
      for (const { m, s } of samplers) {
        // small figures keep their shape: each surface gets at least 6 % of the points
        const share = Math.round(n * (0.06 + (1 - 0.06 * samplers.length) * s.tot / total));
        nm.getNormalMatrix(m.matrixWorld);
        const colAttr = m.geometry.attributes.color, base = m.material?.color || new THREE.Color(1, 1, 1);
        for (let j = 0; j < share && i < n; j++, i++) {
          const r = Math.random() * s.tot; let lo = 0, hi = s.nTri - 1;
          while (lo < hi) { const mid = (lo + hi) >> 1; if (s.cum[mid] < r) lo = mid + 1; else hi = mid; }
          const t = lo, i0 = s.idx ? s.idx.getX(t * 3) : t * 3, i1 = s.idx ? s.idx.getX(t * 3 + 1) : t * 3 + 1, i2 = s.idx ? s.idx.getX(t * 3 + 2) : t * 3 + 2;
          let u = Math.random(), v = Math.random(); if (u + v > 1) { u = 1 - u; v = 1 - v; }
          A.fromBufferAttribute(s.P, i0).applyMatrix4(m.matrixWorld); B.fromBufferAttribute(s.P, i1).applyMatrix4(m.matrixWorld); C.fromBufferAttribute(s.P, i2).applyMatrix4(m.matrixWorld);
          const px = A.x + (B.x - A.x) * u + (C.x - A.x) * v, py = A.y + (B.y - A.y) * u + (C.y - A.y) * v, pz = A.z + (B.z - A.z) * u + (C.z - A.z) * v;
          N.copy(B).sub(A).cross(C.clone().sub(A)).normalize();
          end.set([px, py, pz], i * 3); nrm.set([N.x, N.y, N.z], i * 3);
          if (colAttr) {
            cA.fromBufferAttribute(colAttr, i0); cB.fromBufferAttribute(colAttr, i1); cC.fromBufferAttribute(colAttr, i2);
            col.set([cA.r + (cB.r - cA.r) * u + (cC.r - cA.r) * v, cA.g + (cB.g - cA.g) * u + (cC.g - cA.g) * v, cA.b + (cB.b - cA.b) * u + (cC.b - cA.b) * v].map((x, k) => x * [base.r, base.g, base.b][k]), i * 3);
          } else col.set([base.r, base.g, base.b], i * 3);
          // where it starts: the flat painting, hung behind the sculpture
          const su = Math.random(), sv = Math.random();
          start.set([(su - 0.5) * 3.6, 1.9 - sv * 3.6 / Math.max(0.6, painting?.A || 1.4), -2.4 + (Math.random() - 0.5) * 0.1], i * 3);
          if (painting?.px) {               // that point of the painting's own colour (linear)
            const P = painting.px, xx = Math.min(P.w - 1, Math.floor(su * P.w)), yy = Math.min(P.h - 1, Math.floor(sv * P.h)), q = (yy * P.w + xx) * 4;
            const L = v => { v /= 255; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
            col0.set([L(P.d[q]), L(P.d[q + 1]), L(P.d[q + 2])], i * 3);
          } else col0.set(col.subarray(i * 3, i * 3 + 3), i * 3);
          size[i] = glowLayer ? 0.008 + Math.random() * 0.014 : 0.009 + Math.random() * 0.008;
          phase[i] = Math.random();
        }
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(end.slice(0, i * 3), 3));
      g.setAttribute('aEnd', new THREE.BufferAttribute(end.slice(0, i * 3), 3));
      g.setAttribute('aStart', new THREE.BufferAttribute(start.slice(0, i * 3), 3));
      g.setAttribute('aCol', new THREE.BufferAttribute(col.slice(0, i * 3), 3));
      g.setAttribute('aCol0', new THREE.BufferAttribute(col0.slice(0, i * 3), 3));
      g.setAttribute('aNrm', new THREE.BufferAttribute(nrm.slice(0, i * 3), 3));
      g.setAttribute('aSize', new THREE.BufferAttribute(size.slice(0, i), 1));
      g.setAttribute('aPhase', new THREE.BufferAttribute(phase.slice(0, i), 1));
      g.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0.3, 0), 6);
      const u = { ...this.uniforms, uGlow: { value: glowLayer ? 1 : 0 } };
      const mat = new THREE.ShaderMaterial({ uniforms: u, vertexShader: VERT, fragmentShader: FRAG,
        transparent: glowLayer, depthWrite: !glowLayer, blending: glowLayer ? THREE.AdditiveBlending : THREE.NormalBlending });
      const pts = new THREE.Points(g, mat); pts.renderOrder = glowLayer ? 2 : 1;
      this.group.add(pts);
    };
    make(count, false); make(glow, true);
    this.t = 0;
  }
  show(v) { this.visible = v; this.group.visible = v; if (v) this.t = 0; }
  // instant: no gathering animation (after reshaping)
  settle() { this.t = 1.2; }
  update(dt, renderer) {
    if (!this.visible) return;
    this.t = Math.min(1.2, this.t + dt * 0.33);
    this.uniforms.uTime.value += dt;
    for (const c of this.group.children) {
      c.material.uniforms.uT.value = this.t; c.material.uniforms.uTime.value = this.uniforms.uTime.value;
      c.material.uniforms.uPx.value = renderer.domElement.height;
    }
  }
}

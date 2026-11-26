// A painting opened into a 3D world.
//
// Every pixel of the picture is pushed back along its own ray from the painter's eye to the
// distance its depth map gives it (Depth Anything V2), so the ground lies down, the trees
// stand up and the sky goes far away. Seen from the painter's eye, the world is exactly the
// painting; step aside and it has real depth. It is drawn as
//   'splat'  soft Gaussian splats, stretched along the brushwork (fills the picture, painterly)
//   'points' a crisp point cloud (you can see what the picture is made of)
// Painted animals: every splat knows which animal (part) it belongs to, so an animal that
// speaks can glow and lift a little out of the paint.

import * as THREE from '../../vendor/three-0.170.0/build/three.module.js';

const loadImg = url => new Promise((res, rej) => { const i = new Image(); i.crossOrigin = 'anonymous'; i.onload = () => res(i); i.onerror = rej; i.src = url; });
function pixels(img, w, h) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(img, 0, 0, w, h);
  return g.getImageData(0, 0, w, h).data;
}

export const FOV = 42;                  // the painter's eye (vertical field of view, degrees)
const NEAR = 2.2, FAR = 34;             // nearest and furthest distance of the painted world

export class PaintingWorld {
  constructor({ image, depth, parts = [], partBase = '' }) {
    this.o = { image, depth, parts, partBase };
    this.group = new THREE.Group();
    this.mode = 'splat';
    this.flat = 1;                      // 1 = still a flat picture, 0 = fully opened in depth
  }

  async init(maxSplats = 260000) {
    const [img, dimg] = await Promise.all([loadImg(this.o.image), loadImg(this.o.depth)]);
    this.aspect = img.width / img.height;
    this.sourceImage = img;
    const A = this.aspect;
    const H = Math.round(Math.sqrt(maxSplats / A)), W = Math.round(H * A);
    this.gw = W; this.gh = H;
    const col = pixels(img, W, H), dep = pixels(dimg, W, H);
    this.depthGrid = new Float32Array(W * H);
    for (let i = 0; i < W * H; i++) this.depthGrid[i] = dep[i * 4] / 255;
    // which painted part each cell belongs to (from each part's cut-out alpha)
    const owner = new Uint8Array(W * H);
    await Promise.all(this.o.parts.slice(0, 15).map(async (p, k) => {
      if (!p.file) return;
      try {
        const pi = await loadImg(this.o.partBase + p.file);
        const [x0, y0, x1, y1] = p.box;
        const bw = Math.max(1, Math.round((x1 - x0) * W)), bh = Math.max(1, Math.round((y1 - y0) * H));
        const a = pixels(pi, bw, bh);
        const ox = Math.round(x0 * W), oy = Math.round(y0 * H);
        for (let y = 0; y < bh; y++) for (let x = 0; x < bw; x++) {
          if (a[(y * bw + x) * 4 + 3] > 110) { const gx = ox + x, gy = oy + y; if (gx < W && gy < H) owner[gy * W + gx] = k + 1; }
        }
      } catch (e) { /* a missing cut-out only means that animal cannot glow */ }
    }));
    this.owner = owner;
    const n = W * H;
    const pos = new Float32Array(n * 3), flatPos = new Float32Array(n * 3), c = new Float32Array(n * 3);
    const size = new Float32Array(n), ang = new Float32Array(n), part = new Float32Array(n), rnd = new Float32Array(n);
    const tanY = Math.tan(THREE.MathUtils.degToRad(FOV / 2)), tanX = tanY * A;
    this.tanX = tanX; this.tanY = tanY;
    const lum = i => (col[i * 4] * 0.3 + col[i * 4 + 1] * 0.59 + col[i * 4 + 2] * 0.11) / 255;
    let k = 0;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++, k++) {
      const jx = (Math.random() - 0.5) * 0.8, jy = (Math.random() - 0.5) * 0.8;
      const u = (x + 0.5 + jx) / W, v = (y + 0.5 + jy) / H;
      const p = this.unproject(u, v, this.depthGrid[k]);
      pos.set([p.x, p.y, p.z], k * 3);
      const f = this.unprojectFlat(u, v);
      flatPos.set([f.x, f.y, f.z], k * 3);
      c[k * 3] = col[k * 4] / 255; c[k * 3 + 1] = col[k * 4 + 1] / 255; c[k * 3 + 2] = col[k * 4 + 2] / 255;
      // the footprint of one cell at its distance, a little more so neighbours overlap
      const dist = -p.z;
      size[k] = dist * 2 * tanY / H * 1.9;
      // brush direction: across the gradient of the picture's light
      const gx = x > 0 && x < W - 1 ? lum(k + 1) - lum(k - 1) : 0, gy = y > 0 && y < H - 1 ? lum(k + W) - lum(k - W) : 0;
      ang[k] = Math.atan2(gx, -gy) + (Math.random() - 0.5) * 0.4;
      part[k] = owner[k]; rnd[k] = Math.random();
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('aFlat', new THREE.BufferAttribute(flatPos, 3));
    g.setAttribute('color', new THREE.BufferAttribute(c, 3));
    g.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
    g.setAttribute('aAng', new THREE.BufferAttribute(ang, 1));
    g.setAttribute('aPart', new THREE.BufferAttribute(part, 1));
    g.setAttribute('aRnd', new THREE.BufferAttribute(rnd, 1));
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0, -FAR / 2), FAR * 2);
    this.uniforms = {
      uFlat: { value: 1 }, uMode: { value: 0 }, uPx: { value: 1 }, uTime: { value: 0 },
      uGlow: { value: new Array(16).fill(0) }, uLift: { value: new Array(16).fill(0) }, uFade: { value: 1 },
    };
    const mat = new THREE.ShaderMaterial({
      uniforms: this.uniforms, vertexColors: true,
      vertexShader: /* glsl */`
        attribute vec3 aFlat; attribute float aSize, aAng, aPart, aRnd;
        uniform float uFlat, uMode, uPx, uTime; uniform float uGlow[16]; uniform float uLift[16];
        varying vec3 vC; varying float vAng; varying float vGlow; varying float vMode;
        void main() {
          int pi = int(aPart + 0.5);
          float glow = 0.0, lift = 0.0;
          for (int i = 1; i < 16; i++) if (i == pi) { glow = uGlow[i]; lift = uLift[i]; }
          vec3 p = mix(position, aFlat, uFlat);
          // an animal that speaks comes a little out of the paint, towards the eye
          p += normalize(-p) * lift * 0.35 * length(p) * 0.06;
          p.y += lift * sin(uTime * 2.0 + aRnd * 0.5) * 0.004 * length(p);
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          gl_Position = projectionMatrix * mv;
          float s = aSize * mix(1.0, 0.36, uMode);
          gl_PointSize = max(1.0, s * projectionMatrix[1][1] * uPx * 0.5 / -mv.z);
          vC = color; vAng = aAng; vGlow = glow; vMode = uMode;
        }`,
      fragmentShader: /* glsl */`
        uniform float uFade;
        varying vec3 vC; varying float vAng; varying float vGlow; varying float vMode;
        void main() {
          vec2 p = gl_PointCoord * 2.0 - 1.0;
          float c = cos(vAng), s = sin(vAng);
          vec2 q = vec2(c * p.x + s * p.y, -s * p.x + c * p.y);
          float r2;
          if (vMode > 0.5) { r2 = dot(p, p); if (r2 > 1.0) discard; }
          else { q.y *= 1.6; r2 = dot(q, q); if (r2 > 1.0) discard; if (exp(-r2 * 2.0) < 0.2) discard; }
          vec3 col = vC + vGlow * vec3(0.35, 0.3, 0.18);
          gl_FragColor = vec4(col * uFade, 1.0);
        }`,
    });
    this.points = new THREE.Points(g, mat);
    this.points.frustumCulled = false;
    this.group.add(this.points);
    this.parts = this.o.parts.map((p, i) => ({ ...p, i, anchor: this.partAnchor(p) }));
    return this;
  }

  // picture coordinates (u, v in 0..1, v down) + depth (1 = near) → a point in the world
  distance(d) { return 1 / (1 / FAR + (1 / NEAR - 1 / FAR) * Math.pow(Math.max(0, Math.min(1, d)), 1.15)); }
  unproject(u, v, d) {
    const D = this.distance(d);
    const dir = new THREE.Vector3((u * 2 - 1) * this.tanX, (1 - v * 2) * this.tanY, -1);
    return dir.multiplyScalar(D);
  }
  // the flat picture: everything at one distance, exactly filling the view
  unprojectFlat(u, v) {
    const D = 9;
    return new THREE.Vector3((u * 2 - 1) * this.tanX * D, (1 - v * 2) * this.tanY * D, -D);
  }
  depthAt(u, v) {
    const x = Math.max(0, Math.min(this.gw - 1, Math.floor(u * this.gw))), y = Math.max(0, Math.min(this.gh - 1, Math.floor(v * this.gh)));
    return this.depthGrid[y * this.gw + x];
  }
  pointAt(u, v) { return this.unproject(u, v, this.depthAt(u, v)); }

  // where a painted part stands: the bottom of its box (its feet), the top (its head)
  partAnchor(p) {
    const [x0, y0, x1, y1] = p.box, cx = (x0 + x1) / 2;
    const d = p.depth ?? this.depthAt(cx, (y0 + y1) / 2);
    const foot = this.unproject(cx, y1, d), head = this.unproject(cx, y0, d);
    return { foot, head, center: foot.clone().lerp(head, 0.5), height: head.y - foot.y, width: this.unproject(x1, y1, d).x - this.unproject(x0, y1, d).x };
  }

  // open ground for the visitor: low in the picture, not on a painted animal, gently sloped
  groundSpot(avoid = []) {
    let best = null, bs = -1e9;
    for (let t = 0; t < 400; t++) {
      const u = 0.12 + Math.random() * 0.76, v = 0.58 + Math.random() * 0.36;
      const gx = Math.floor(u * this.gw), gy = Math.floor(v * this.gh);
      let occ = 0;
      for (let dy = -6; dy <= 2; dy++) for (let dx = -4; dx <= 4; dx++) {
        const x = gx + dx * 2, y = gy + dy * 3;
        if (x >= 0 && y >= 0 && x < this.gw && y < this.gh && this.owner[y * this.gw + x]) occ++;
      }
      const d = this.depthAt(u, v), d2 = this.depthAt(u, v - 0.04);
      const slope = Math.abs(d - d2);
      const nearAvoid = avoid.some(([au, av]) => Math.hypot(au - u, av - v) < 0.12);
      const score = -occ * 3 - slope * 40 - Math.abs(d - 0.62) * 4 - Math.abs(u - 0.45) * 1.2 - (nearAvoid ? 5 : 0);
      if (score > bs) { bs = score; best = [u, v]; }
    }
    return { uv: best, point: this.pointAt(best[0], best[1]) };
  }

  setMode(m) { this.mode = m; this.uniforms.uMode.value = m === 'points' ? 1 : 0; }
  setFlat(f) { this.flat = f; this.uniforms.uFlat.value = f; }
  glow(i, v) { if (i >= 0 && i < 15) this.uniforms.uGlow.value[i + 1] = v; }
  lift(i, v) { if (i >= 0 && i < 15) this.uniforms.uLift.value[i + 1] = v; }
  update(t, renderer) {
    this.uniforms.uTime.value = t;
    this.uniforms.uPx.value = renderer.domElement.height;
  }
  dispose() { this.points?.geometry.dispose(); this.points?.material.dispose(); }
}

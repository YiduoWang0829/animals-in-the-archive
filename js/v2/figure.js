// The visitor as a still, solid 3D figure, re-made in the manner of the painting it walks into.
//
// 1. bake: a rigged 3D animal is held in its standing pose and frozen into one static mesh
//    with the colours of its own texture; a 2D character (a drawing, a storybook animal) is
//    inflated from its silhouette into a rounded body (thick in the middle, thin at the edge).
//    Either way: height 1, feet on y = 0, head towards +z.
// 2. stylise(baked, look, palette): the same body rebuilt in the painting's own language.
//      oil       glazed oil paint: palette colours, brush-stroke grain, warm chiaroscuro
//      gilded    flat tempera colours with a gold edge, like a medieval panel
//      splat     impressionist: the body becomes thousands of Gaussian brush splats
//      dots      pointillist: pure dots of the palette, side by side
//      facet     cubist / expressionist: a few big flat planes in the painting's colours
//      ink       ink wash: paper-white body, grey wash, a living brush outline
//      woodblock flat colour areas and a crisp black key line
//      flat      folk: clear flat colours, two tones, a dark outline
// Nothing moves: the figure stands still, and the painting's light falls on it.

import * as THREE from '../../vendor/three-0.170.0/build/three.module.js';
import { mergeVertices } from '../../vendor/three-0.170.0/examples/jsm/utils/BufferGeometryUtils.js';

// ------------------------------------------------------------------ baking
export async function bakeAnimal3D(glbUrl) {
  const { loadAnimal3D } = await import('../animal3d.js');
  const a = await loadAnimal3D(glbUrl, { height: 1, look: 'real' });
  const { standClip } = await import('../animal3d.js');
  const stand = a.clips.Walk ? standClip(a.clips.Walk) : (a.clips.Idle || null);
  if (stand) { a.mixer.stopAllAction(); const act = a.mixer.clipAction(stand); act.reset().play(); a.mixer.update(0); a.mixer.setTime(0.01); }
  a.group.updateMatrixWorld(true);
  const pos = [], col = [], idx = [];
  const v = new THREE.Vector3();
  const tex = new Map();
  const sampler = img => {
    if (tex.has(img)) return tex.get(img);
    const c = document.createElement('canvas'); c.width = Math.min(512, img.width); c.height = Math.min(512, img.height);
    const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(img, 0, 0, c.width, c.height);
    const d = g.getImageData(0, 0, c.width, c.height).data;
    const f = (u, w, flipY) => {
      u = ((u % 1) + 1) % 1; w = ((w % 1) + 1) % 1; if (flipY) w = 1 - w;
      const i = (Math.floor(w * (c.height - 1)) * c.width + Math.floor(u * (c.width - 1))) * 4;
      return [d[i] / 255, d[i + 1] / 255, d[i + 2] / 255];
    };
    tex.set(img, f); return f;
  };
  a.root.traverse(o => {
    if (!o.isMesh) return;
    const g = o.geometry, P = g.attributes.position, UV = g.attributes.uv;
    const mat = [].concat(o.material)[0];
    const base = mat.color ? mat.color.clone().convertLinearToSRGB() : new THREE.Color(0.7, 0.6, 0.5);
    const img = mat.map?.image;
    const S = img && img.width ? sampler(img) : null;
    const flipY = mat.map ? mat.map.flipY : false;
    const off = pos.length / 3;
    for (let i = 0; i < P.count; i++) {
      if (o.isSkinnedMesh) o.getVertexPosition(i, v); else v.fromBufferAttribute(P, i);
      v.applyMatrix4(o.matrixWorld);
      pos.push(v.x, v.y, v.z);
      let c = [base.r, base.g, base.b];
      if (S && UV) { const t = S(UV.getX(i), UV.getY(i), flipY); c = [t[0] * base.r, t[1] * base.g, t[2] * base.b]; }
      col.push(...c);
    }
    if (g.index) for (let i = 0; i < g.index.count; i++) idx.push(off + g.index.getX(i));
    else for (let i = 0; i < P.count; i++) idx.push(off + i);
  });
  a.dispose?.();
  return normalise(pos, col, idx);
}

// a 2D image (drawing / storybook animal) → an inflated, rounded body
export function bakeImage(img, headSide = 'right') {
  const N = 150;
  const k = N / Math.max(img.width, img.height);
  const W = Math.max(8, Math.round(img.width * k)), H = Math.max(8, Math.round(img.height * k));
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(img, 0, 0, W, H);
  const d = g.getImageData(0, 0, W, H).data;
  const inside = new Uint8Array(W * H);
  for (let i = 0; i < W * H; i++) inside[i] = d[i * 4 + 3] > 100 ? 1 : 0;
  // chamfer distance to the outside
  const dist = new Float32Array(W * H);
  for (let i = 0; i < W * H; i++) dist[i] = inside[i] ? 1e6 : 0;
  const at = (x, y) => (x < 0 || y < 0 || x >= W || y >= H) ? 0 : dist[y * W + x];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const i = y * W + x; if (dist[i]) dist[i] = Math.min(dist[i], at(x - 1, y) + 1, at(x, y - 1) + 1, at(x - 1, y - 1) + 1.414, at(x + 1, y - 1) + 1.414); }
  for (let y = H - 1; y >= 0; y--) for (let x = W - 1; x >= 0; x--) { const i = y * W + x; if (dist[i]) dist[i] = Math.min(dist[i], at(x + 1, y) + 1, at(x, y + 1) + 1, at(x + 1, y + 1) + 1.414, at(x - 1, y + 1) + 1.414); }
  let maxD = 1; for (const v of dist) maxD = Math.max(maxD, v);
  const pos = [], col = [], idx = [];
  const vid = new Int32Array(W * H * 2).fill(-1);
  const s = 1 / H, thick = 0.55;              // a body is about half as thick as it is tall
  for (let side = 0; side < 2; side++) {
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x; if (!inside[i]) continue;
      const r = dist[i] / maxD, h = Math.sqrt(Math.max(0, 1 - (1 - r) * (1 - r))) * thick * maxD * s;   // round, like a pillow
      const zImg = (headSide === 'right' ? x - W / 2 : W / 2 - x) * s;   // head → +z
      vid[side * W * H + i] = pos.length / 3;
      pos.push(side ? -h : h, (H - y) * s, zImg);
      col.push(d[i * 4] / 255, d[i * 4 + 1] / 255, d[i * 4 + 2] / 255);
    }
  }
  for (let side = 0; side < 2; side++) for (let y = 0; y < H - 1; y++) for (let x = 0; x < W - 1; x++) {
    const o = side * W * H, a = vid[o + y * W + x], b = vid[o + y * W + x + 1], c2 = vid[o + (y + 1) * W + x], e = vid[o + (y + 1) * W + x + 1];
    // outward normals on both sides (the image's x runs along +z or -z depending on the head)
    const flipW = (side === 1) !== (headSide === 'right');
    const tri = (p, q, r) => { if (p >= 0 && q >= 0 && r >= 0) idx.push(...(flipW ? [p, r, q] : [p, q, r])); };
    tri(a, c2, b); tri(b, c2, e);
  }
  const geo = normalise(pos, col, idx);
  geo.userData.flat = true;              // a profile: it should be seen from the side
  return geo;
}

function normalise(pos, col, idx) {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  geo.setIndex(idx);
  geo.computeBoundingBox();
  const b = geo.boundingBox, h = b.max.y - b.min.y || 1;
  geo.translate(-(b.min.x + b.max.x) / 2, -b.min.y, -(b.min.z + b.max.z) / 2);
  geo.scale(1 / h, 1 / h, 1 / h);
  geo.computeVertexNormals();
  geo.computeBoundingBox();
  return geo;
}

// ------------------------------------------------------------------ palette helpers
export function paletteColors(palette) {
  // colours are kept as raw sRGB numbers here (like the vertex colours), not linear
  const cs = (palette?.length ? palette : [{ c: '#2a2118' }, { c: '#6b4f33' }, { c: '#a8865a' }, { c: '#d9c49a' }]).map(p => new THREE.Color(p.c || p).convertLinearToSRGB());
  while (cs.length < 8) cs.push(cs[cs.length - 1].clone());
  return cs.slice(0, 8);
}
const RAW = THREE.LinearSRGBColorSpace;
const hsl = c => { const o = {}; c.getHSL(o, RAW); return o; };
// the palette colour that best stands in for c: close in hue and in value
function nearest(c, pal, wHue = 1) {
  const a = hsl(c); let best = pal[0], bd = 1e9;
  for (const p of pal) {
    const b = hsl(p);
    const dh = Math.min(Math.abs(a.h - b.h), 1 - Math.abs(a.h - b.h)) * Math.min(a.s, b.s) * 2;
    const d = (a.l - b.l) ** 2 * 2 + dh * dh * wHue + (a.s - b.s) ** 2 * 0.4;
    if (d < bd) { bd = d; best = p; }
  }
  return best;
}

// ------------------------------------------------------------------ shared shader pieces
const LIGHT = /* glsl */`
  uniform vec3 uLightDir; uniform vec3 uWarm; uniform vec3 uCool; uniform float uTime;
  uniform vec3 uPal[8];
  float hash13(vec3 p) { p = fract(p * 0.1031); p += dot(p, p.zyx + 31.32); return fract((p.x + p.y) * p.z); }
  float noise3(vec3 p) {
    vec3 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(mix(hash13(i), hash13(i + vec3(1,0,0)), f.x), mix(hash13(i + vec3(0,1,0)), hash13(i + vec3(1,1,0)), f.x), f.y),
               mix(mix(hash13(i + vec3(0,0,1)), hash13(i + vec3(1,0,1)), f.x), mix(hash13(i + vec3(0,1,1)), hash13(i + vec3(1,1,1)), f.x), f.y), f.z);
  }
  float lum(vec3 c) { return dot(c, vec3(0.299, 0.587, 0.114)); }
  vec3 palByLum(float l) {               // the palette as a ramp from dark to light
    float x = clamp(l, 0.0, 0.999) * 7.0; int i = int(floor(x)); float f = fract(x);
    vec3 a = uPal[0], b = uPal[1];
    for (int k = 0; k < 7; k++) if (k == i) { a = uPal[k]; b = uPal[k + 1]; }
    return mix(a, b, smoothstep(0.25, 0.75, f));
  }
`;

function baseUniforms(pal, extra = {}) {
  const lin = pal.map(c => c.clone());
  return {
    uLightDir: { value: new THREE.Vector3(-0.5, 0.8, 0.45).normalize() },
    uWarm: { value: new THREE.Color(1.0, 0.92, 0.8) }, uCool: { value: new THREE.Color(0.55, 0.6, 0.75) },
    uTime: { value: 0 }, uPal: { value: lin }, ...extra,
  };
}

// a solid mesh whose colour is computed by `frag` (gets vColor, vN, vP)
function paintedMesh(geo, pal, frag, extra = {}, { flat = false } = {}) {
  const mat = new THREE.ShaderMaterial({
    uniforms: baseUniforms(pal, extra),
    vertexColors: true,
    vertexShader: /* glsl */`
      varying vec3 vColor; varying vec3 vN; varying vec3 vP; varying vec3 vObj;
      void main() {
        vColor = color; vObj = position;
        vec4 wp = modelMatrix * vec4(position, 1.0); vP = wp.xyz;
        vN = normalize(mat3(modelMatrix) * normal);
        gl_Position = projectionMatrix * viewMatrix * wp;
      }`,
    fragmentShader: LIGHT + /* glsl */`
      varying vec3 vColor; varying vec3 vN; varying vec3 vP; varying vec3 vObj;
      void main() {
        vec3 n = normalize(${flat ? 'cross(dFdx(vP), dFdy(vP))' : 'vN'});
        if (!gl_FrontFacing && ${flat ? 'false' : 'true'}) n = -n;
        float diff = max(dot(n, normalize(uLightDir)), 0.0);
        ${frag}
      }`,
  });
  mat.extensions = { derivatives: true };
  return new THREE.Mesh(geo, mat);
}

// an outline: the back faces pushed out (a constant width in world units)
function outline(geo, color, width) {
  const g = mergeVertices(geo.clone().deleteAttribute('color').deleteAttribute('uv').deleteAttribute('normal'), 1e-3);
  g.computeVertexNormals();
  const m = new THREE.ShaderMaterial({
    uniforms: { uColor: { value: new THREE.Color(color) }, uW: { value: width } },
    side: THREE.BackSide,
    vertexShader: `uniform float uW; void main() { gl_Position = projectionMatrix * modelViewMatrix * vec4(position + normal * uW, 1.0); }`,
    fragmentShader: `uniform vec3 uColor; void main() { gl_FragColor = vec4(uColor, 1.0); }`,
  });
  return new THREE.Mesh(g, m);
}

// colour every vertex with its palette stand-in (keeps hue families, takes the painting's colours)
function paletteVertexColors(geo, pal, { amount = 0.85, sat = 1 } = {}) {
  const g = geo.clone(), C = g.attributes.color, c = new THREE.Color();
  for (let i = 0; i < C.count; i++) {
    c.setRGB(C.getX(i), C.getY(i), C.getZ(i));
    const p = nearest(c, pal);
    const o = c.clone().lerp(p, amount);
    if (sat !== 1) { const h = hsl(o); o.setHSL(h.h, Math.min(1, h.s * sat), h.l, RAW); }
    C.setXYZ(i, o.r, o.g, o.b);
  }
  return g;
}

// sample points over the surface, area-weighted (for splats and dots)
function samplePoints(geo, n) {
  const P = geo.attributes.position, N = geo.attributes.normal, C = geo.attributes.color, I = geo.index;
  const tris = I ? I.count / 3 : P.count / 3, area = new Float32Array(tris);
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), t = new THREE.Vector3();
  const id = k => I ? I.getX(k) : k;
  let tot = 0;
  for (let i = 0; i < tris; i++) {
    a.fromBufferAttribute(P, id(i * 3)); b.fromBufferAttribute(P, id(i * 3 + 1)); c.fromBufferAttribute(P, id(i * 3 + 2));
    tot += t.subVectors(b, a).cross(c.clone().sub(a)).length() / 2; area[i] = tot;
  }
  const pos = new Float32Array(n * 3), nrm = new Float32Array(n * 3), col = new Float32Array(n * 3), rnd = new Float32Array(n);
  for (let k = 0; k < n; k++) {
    const r = Math.random() * tot;
    let lo = 0, hi = tris - 1; while (lo < hi) { const m = (lo + hi) >> 1; if (area[m] < r) lo = m + 1; else hi = m; }
    let u = Math.random(), v = Math.random(); if (u + v > 1) { u = 1 - u; v = 1 - v; }
    const w = 1 - u - v, ia = id(lo * 3), ib = id(lo * 3 + 1), ic = id(lo * 3 + 2);
    for (let j = 0; j < 3; j++) {
      const g = (A) => A.array[ia * 3 + j] * w + A.array[ib * 3 + j] * u + A.array[ic * 3 + j] * v;
      pos[k * 3 + j] = g(P); nrm[k * 3 + j] = g(N); col[k * 3 + j] = g(C);
    }
    rnd[k] = Math.random();
  }
  return { pos, nrm, col, rnd };
}

// a field of Gaussian splats (or round dots) on the body; a darker shell underneath keeps it solid
function splatFigure(geo, pal, { count = 26000, size = 0.034, elong = 2.4, dots = false } = {}) {
  const pg = paletteVertexColors(geo, pal, { amount: dots ? 0.95 : 0.7, sat: dots ? 1.35 : 1.15 });
  const s = samplePoints(pg, count);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(s.pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(s.nrm, 3));
  g.setAttribute('color', new THREE.BufferAttribute(s.col, 3));
  g.setAttribute('aRnd', new THREE.BufferAttribute(s.rnd, 1));
  const mat = new THREE.ShaderMaterial({
    uniforms: baseUniforms(pal, { uSize: { value: size }, uElong: { value: dots ? 1 : elong }, uDots: { value: dots ? 1 : 0 }, uScale: { value: 1 } }),
    vertexColors: true, transparent: false,
    vertexShader: LIGHT + /* glsl */`
      attribute float aRnd; uniform float uSize, uElong, uDots, uScale;
      varying vec3 vC; varying float vAng; varying float vR;
      void main() {
        vec4 wp = modelMatrix * vec4(position + normal * 0.004, 1.0);
        vec3 n = normalize(mat3(modelMatrix) * normal);
        float diff = max(dot(n, normalize(uLightDir)), 0.0);
        vec3 c = color * (0.55 + 0.75 * diff) * mix(uCool, uWarm, diff);
        // impressionists put the complementary colour in the shadows; Seurat put pure dots side by side
        if (uDots > 0.5) { float l = lum(c); vec3 p = palByLum(l + (aRnd - 0.5) * 0.35); c = mix(c, p, 0.55); }
        else c = mix(c, palByLum(lum(c)), 0.25) + (aRnd - 0.5) * 0.08;
        vC = c; vR = aRnd;
        vec4 mv = viewMatrix * wp;
        // strokes follow the form: the screen direction of the surface's slope
        vec3 t = normalize(cross(n, vec3(0.0, 1.0, 0.0)) + 0.001);
        vec4 a = projectionMatrix * mv, b = projectionMatrix * (viewMatrix * vec4(wp.xyz + t * 0.05, 1.0));
        vec2 d = b.xy / b.w - a.xy / a.w;
        vAng = atan(d.y, d.x) + (aRnd - 0.5) * 0.9;
        gl_Position = a;
        gl_PointSize = uSize * uScale * (0.7 + aRnd * 0.6) * projectionMatrix[1][1] * 520.0 / -mv.z;
      }`,
    fragmentShader: /* glsl */`
      uniform float uElong, uDots; varying vec3 vC; varying float vAng; varying float vR;
      void main() {
        vec2 p = gl_PointCoord * 2.0 - 1.0;
        float c = cos(vAng), s = sin(vAng);
        vec2 q = vec2(c * p.x + s * p.y, -s * p.x + c * p.y);
        q.y *= uElong;
        float r2 = dot(q, q);
        if (r2 > 1.0) discard;
        float g = exp(-r2 * 2.2);                       // a Gaussian splat
        if (uDots > 0.5) g = smoothstep(1.0, 0.8, r2);  // a hard round dot
        if (g < 0.25) discard;
        gl_FragColor = vec4(vC * (0.92 + 0.12 * g), 1.0);
      }`,
  });
  const pts = new THREE.Points(g, mat);
  const grp = new THREE.Group();
  // the shell: the same body a touch smaller, in the palette's middle tone
  const shell = paintedMesh(pg, pal, `
    vec3 c = palByLum(lum(vColor) * 0.8) * (0.45 + 0.4 * diff);
    gl_FragColor = vec4(c, 1.0);`);
  shell.scale.setScalar(0.985);
  grp.add(shell, pts);
  grp.userData.points = pts;
  return grp;
}

// cubist / expressionist planes: the body collapsed onto a coarse grid, each plane one colour
function facetFigure(geo, pal, { cells = 11, bold = false } = {}) {
  const P = geo.attributes.position, C = geo.attributes.color, I = geo.index;
  const step = 1 / cells;
  const key = (x, y, z) => `${Math.round(x / step)},${Math.round(y / step)},${Math.round(z / step)}`;
  const clusters = new Map(), cid = new Int32Array(P.count);
  for (let i = 0; i < P.count; i++) {
    const k = key(P.getX(i), P.getY(i), P.getZ(i));
    let c = clusters.get(k);
    if (!c) { c = { id: clusters.size, p: [0, 0, 0], c: [0, 0, 0], n: 0 }; clusters.set(k, c); }
    c.p[0] += P.getX(i); c.p[1] += P.getY(i); c.p[2] += P.getZ(i);
    c.c[0] += C.getX(i); c.c[1] += C.getY(i); c.c[2] += C.getZ(i); c.n++;
    cid[i] = c.id;
  }
  const cl = [...clusters.values()];
  const pos = [], col = [];
  const idxAt = k => I ? I.getX(k) : k;
  const tris = (I ? I.count : P.count) / 3;
  const tmp = new THREE.Color();
  const seen = new Set();
  for (let t = 0; t < tris; t++) {
    const a = cid[idxAt(t * 3)], b = cid[idxAt(t * 3 + 1)], c = cid[idxAt(t * 3 + 2)];
    if (a === b || b === c || a === c) continue;
    const k = [a, b, c].sort((x, y) => x - y).join(':'); if (seen.has(k)) continue; seen.add(k);
    let r = 0, gg = 0, bb = 0;
    for (const id of [a, b, c]) { const q = cl[id]; pos.push(q.p[0] / q.n, q.p[1] / q.n, q.p[2] / q.n); r += q.c[0] / q.n; gg += q.c[1] / q.n; bb += q.c[2] / q.n; }
    tmp.setRGB(r / 3, gg / 3, bb / 3);
    // a plane takes a palette colour; neighbouring planes may jump to another one (Marc, Delaunay)
    let p = nearest(tmp, pal, 2.5);
    if (Math.random() < (bold ? 0.28 : 0.16)) p = pal[Math.floor(Math.random() * pal.length)];
    for (let j = 0; j < 3; j++) col.push(p.r, p.g, p.b);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.computeVertexNormals();
  const mesh = paintedMesh(g, pal, `
    float steps = floor(diff * 3.0 + 0.5) / 3.0;           // light falls in planes too
    vec3 c = vColor * (0.62 + 0.5 * steps);
    ${bold ? 'c = pow(c, vec3(0.85)) * 1.08;' : ''}
    float edge = noise3(vObj * 40.0);
    c *= 0.94 + 0.1 * edge;
    gl_FragColor = vec4(c, 1.0);`, {}, { flat: true });
  mesh.material.side = THREE.DoubleSide;
  const grp = new THREE.Group();
  grp.add(mesh, outline(geo, bold ? '#120c10' : '#1d1a18', bold ? 0.014 : 0.009));
  return grp;
}

export function stylise(geo, look, palette) {
  const pal = paletteColors(palette);
  const dark = pal[0].clone().multiplyScalar(0.6).getStyle();
  let obj;
  switch (look) {
    case 'splat': obj = splatFigure(geo, pal, { count: 24000, size: 0.042, elong: 2.6 }); break;
    case 'dots': obj = splatFigure(geo, pal, { count: 30000, size: 0.026, dots: true }); break;
    case 'facet': obj = facetFigure(geo, pal, { cells: 10, bold: true }); break;
    case 'ink': {
      const m = paintedMesh(geo, pal, `
        float wash = smoothstep(0.15, 0.75, diff + (noise3(vObj * 9.0) - 0.5) * 0.35);
        vec3 paper = uPal[7] * 0.95 + 0.05;
        vec3 ink = mix(uPal[0], vec3(0.08), 0.6);
        float tone = 1.0 - lum(vColor);                        // dark fur takes more ink
        vec3 c = mix(ink, paper, clamp(wash * 0.85 + 0.25 - tone * 0.45, 0.0, 1.0));
        gl_FragColor = vec4(c, 1.0);`);
      obj = new THREE.Group(); obj.add(m, outline(geo, '#141210', 0.012));
      break;
    }
    case 'woodblock': {
      const pg = paletteVertexColors(geo, pal, { amount: 1 });
      const m = paintedMesh(pg, pal, `
        float band = step(0.35, diff);
        vec3 c = vColor * (0.82 + 0.22 * band);
        float grain = noise3(vec3(vObj.x * 3.0, vObj.y * 60.0, vObj.z * 3.0));   // wood grain in the flat colour
        c *= 0.95 + 0.07 * grain;
        gl_FragColor = vec4(c, 1.0);`);
      obj = new THREE.Group(); obj.add(m, outline(geo, '#0d0b0a', 0.01));
      break;
    }
    case 'flat': {
      const pg = paletteVertexColors(geo, pal, { amount: 1, sat: 1.25 });
      const m = paintedMesh(pg, pal, `
        vec3 c = vColor * (diff > 0.4 ? 1.06 : 0.8);
        gl_FragColor = vec4(c, 1.0);`);
      obj = new THREE.Group(); obj.add(m, outline(geo, dark, 0.009));
      break;
    }
    case 'gilded': {
      const pg = paletteVertexColors(geo, pal, { amount: 0.9 });
      const m = paintedMesh(pg, pal, `
        vec3 c = vColor * (0.75 + 0.35 * diff);
        float rim = 1.0 - abs(dot(normalize(vN), normalize(cameraPosition - vP)));
        c = mix(c, vec3(0.86, 0.66, 0.26), smoothstep(0.55, 0.9, rim) * 0.85);     // gold at the edge
        c *= 0.95 + 0.08 * noise3(vObj * 80.0);                                     // craquelure
        gl_FragColor = vec4(c, 1.0);`);
      obj = new THREE.Group(); obj.add(m, outline(geo, '#3b2410', 0.006));
      break;
    }
    default: {    // oil
      const pg = paletteVertexColors(geo, pal, { amount: 0.6 });
      const m = paintedMesh(pg, pal, `
        // brush strokes: long grain along the body, broken by the bristles
        float stroke = noise3(vec3(vObj.x * 18.0, vObj.y * 6.0, vObj.z * 55.0)) * 0.6 + noise3(vObj * 140.0) * 0.4;
        float l = diff + (stroke - 0.5) * 0.35;
        vec3 c = vColor * mix(uCool * 0.55, uWarm * 1.15, smoothstep(0.0, 1.0, l));
        c = mix(c, palByLum(lum(c)), 0.3);
        c = mix(uPal[0] * 0.5, c, 0.35 + 0.65 * smoothstep(-0.1, 0.8, l));          // chiaroscuro
        float rim = 1.0 - abs(dot(normalize(vN), normalize(cameraPosition - vP)));
        c += uWarm * smoothstep(0.7, 1.0, rim) * 0.12;
        gl_FragColor = vec4(c, 1.0);`);
      obj = new THREE.Group(); obj.add(m);
    }
  }
  obj.userData.look = look;
  return obj;
}

// the natural look (in the gallery hall, before it walks in): its own colours, soft light
export function natural(geo) {
  geo = geo.clone();
  const C = geo.attributes.color, c = new THREE.Color();
  for (let i = 0; i < C.count; i++) { c.setRGB(C.getX(i), C.getY(i), C.getZ(i)).convertSRGBToLinear(); C.setXYZ(i, c.r, c.g, c.b); }
  const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, metalness: 0 }));
  const g = new THREE.Group(); g.add(m); return g;
}

// the figure as a cut-out picture (transparent around it), seen in three-quarter view
export async function renderFigureImage(geo, look, palette, size = 520) {
  const r = new THREE.WebGLRenderer({ alpha: true, antialias: true, preserveDrawingBuffer: true });
  r.setSize(size, size, false); r.setClearColor(0x000000, 0);
  const scene = new THREE.Scene();
  const fig = stylise(geo, look, palette);
  scene.add(fig);
  const box = new THREE.Box3().setFromObject(fig), c = box.getCenter(new THREE.Vector3()), s = box.getSize(new THREE.Vector3());
  const cam = new THREE.PerspectiveCamera(30, 1, 0.01, 50);
  const d = Math.max(s.x, s.y, s.z) * 2.3;
  cam.position.set(c.x + d * 0.85, c.y + d * 0.18, c.z + d * 0.25); cam.lookAt(c);
  const pts = fig.userData.points;
  if (pts) pts.material.uniforms.uScale.value = size * 0.5 / 520;
  r.render(scene, cam);
  // crop to what was drawn
  const src = r.domElement, g = document.createElement('canvas'); g.width = size; g.height = size;
  const gx = g.getContext('2d', { willReadFrequently: true }); gx.drawImage(src, 0, 0);
  const px = gx.getImageData(0, 0, size, size).data;
  let x0 = size, y0 = size, x1 = 0, y1 = 0;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) if (px[(y * size + x) * 4 + 3] > 10) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  r.dispose();
  if (x1 <= x0) return g;
  const out = document.createElement('canvas'); out.width = x1 - x0 + 1; out.height = y1 - y0 + 1;
  out.getContext('2d').drawImage(g, x0, y0, out.width, out.height, 0, 0, out.width, out.height);
  return out;
}

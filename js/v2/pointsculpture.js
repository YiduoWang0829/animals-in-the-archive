// The sculpture: your animal, after it has been in the painting, among the painting's own things,
// all made of Gaussian splats (the way a Gaussian Splat is made from photographs).
//
// 1 · your animal is painted in the painting's manner (livestyle + paintFX, as in the painting) and
//     photographed from all round: colour + depth → one cloud of points on its painted skin
//     (a drawn or picture-book animal, which has no body, becomes a painted relief instead)
// 2 · the painting re-forms it: never again the shape it came in as
//       oil   – flesh that flows, swells and sags like paint
//       flat  – a folk painter's animal: flat as a board, rounder, stubby legs, plain colours
//       facet – every part a crystal: a round head comes out a pyramid
// 3 · round it, whole and never cut in half: the painting's animals (turned towards the newcomer),
//     the painting's things (trees, rocks, houses…) or, for a painting with none, crystal shards of
//     its colour; nothing passes through anything else; faint gold star-lines join them
// 4 · three ways to see it: 点彩 (dots, thick here and thin there, dust lifting off), 星辰 (a few
//     bright points), 实体 (solid splats)
import * as THREE from '../../vendor/three-0.170.0/build/three.module.js';
import { OrbitControls } from '../../vendor/three-0.170.0/examples/jsm/controls/OrbitControls.js';

const GS_URL = 'https://unpkg.com/@mkkellogg/gaussian-splats-3d@0.4.7/build/gaussian-splats-3d.module.js';
export const KINDS = ['dots', 'stars', 'solid'];
export const ZH = { lion: '狮子', horse: '马', deer: '鹿', peacock: '孔雀', dog: '狗', rabbit: '兔子', calf: '小牛', cub: '小狮子', goat: '山羊', leopard: '豹子',
  ox: '牛', boar: '野猪', pig: '猪', wolf: '狼', fox: '狐狸', bear: '熊', cat: '猫', cow: '牛', sheep: '羊', bird: '鸟', parrot: '鹦鹉', heron: '鹭', ostrich: '鸵鸟',
  duck: '鸭子', swan: '天鹅', chicken: '鸡', monkey: '猴子', elephant: '大象', camel: '骆驼', donkey: '驴', fish: '鱼', squirrel: '松鼠', owl: '猫头鹰', animal: '动物',
  tree: '树', serpent: '缠着蛇的树干', apple: '苹果树', paradise: '极乐鸟', cattle: '牛', rock: '石头', mountain: '山', house: '房子', flower: '花', branch: '树枝', boat: '船', moon: '月亮' };

const mulberry = a => () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
const pixels = (im, maxW) => { const w = Math.max(1, Math.min(maxW, im.width || im.naturalWidth)), h = Math.max(1, Math.round(w * (im.height || im.naturalHeight) / (im.width || im.naturalWidth)));
  const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(im, 0, 0, w, h);
  return { px: g.getImageData(0, 0, w, h).data, w, h }; };

// ------------------------------------------------------------------ 1 · photograph the painted animal
const SZ = 512, VIEWS = [];
for (const [el, n] of [[12, 8], [42, 6], [-20, 4], [80, 1]]) for (let k = 0; k < n; k++) VIEWS.push([el * Math.PI / 180, (k / n) * Math.PI * 2 + (el > 30 ? .4 : 0)]);
const packMat = new THREE.ShaderMaterial({ uniforms: { tDepth: { value: null } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }',
  fragmentShader: 'uniform sampler2D tDepth; varying vec2 vUv; void main(){ gl_FragColor = vec4(texture2D(tDepth, vUv).x, 0., 0., 1.); }' });
const quadScene = new THREE.Scene(); quadScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), packMat));
const quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

async function photograph(renderer, animal, fx, mean) {
  const scene = new THREE.Scene(); scene.background = new THREE.Color(mean[0], mean[1], mean[2]);
  scene.add(new THREE.HemisphereLight(0xfff4e0, 0x403020, 1.6)); const sun = new THREE.DirectionalLight(0xffffff, 1.8); sun.position.set(2, 4, 3); scene.add(sun);
  scene.add(animal.group); animal.group.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(animal.group, true), ctr = box.getCenter(new THREE.Vector3()), R = box.getSize(new THREE.Vector3()).length() * .5;
  const pr0 = renderer.getPixelRatio(), sz0 = renderer.getSize(new THREE.Vector2());
  renderer.setPixelRatio(1); renderer.setSize(SZ, SZ, false);
  const cam = new THREE.PerspectiveCamera(30, 1, Math.max(.01, R * .2), R * 12), dist = R / Math.sin(15 * Math.PI / 180) * 1.05;
  if (fx) fx.brushK = 2;
  const rtD = new THREE.WebGLRenderTarget(SZ, SZ, { depthTexture: new THREE.DepthTexture(SZ, SZ, THREE.FloatType) }), rtP = new THREE.WebGLRenderTarget(SZ, SZ, { type: THREE.FloatType });
  const c2 = document.createElement('canvas'); c2.width = c2.height = SZ; const g2 = c2.getContext('2d', { willReadFrequently: true });
  const shots = [], v = new THREE.Vector3();
  for (const [el, az] of VIEWS) {
    cam.position.set(ctr.x + Math.cos(el) * Math.sin(az) * dist, ctr.y + Math.sin(el) * dist, ctr.z + Math.cos(el) * Math.cos(az) * dist); cam.lookAt(ctr); cam.updateMatrixWorld(); cam.updateProjectionMatrix();
    animal.updateStyle?.(renderer);
    if (fx) { let u0 = 1, u1 = 0, v0 = 1, v1 = 0; for (let k = 0; k < 8; k++) { v.set(k & 1 ? box.max.x : box.min.x, k & 2 ? box.max.y : box.min.y, k & 4 ? box.max.z : box.min.z).project(cam);
        u0 = Math.min(u0, v.x * .5 + .5); u1 = Math.max(u1, v.x * .5 + .5); v0 = Math.min(v0, v.y * .5 + .5); v1 = Math.max(v1, v.y * .5 + .5); }
      fx.setBox(u0, v0, u1, v1); fx.render(scene, cam, animal.group); }
    else { renderer.setRenderTarget(null); renderer.render(scene, cam); }
    g2.drawImage(renderer.domElement, 0, 0, SZ, SZ); const col = g2.getImageData(0, 0, SZ, SZ).data;
    renderer.setRenderTarget(rtD); renderer.setClearColor(0x000000, 0); renderer.clear(); const bg = scene.background; scene.background = null; renderer.render(scene, cam); scene.background = bg;
    packMat.uniforms.tDepth.value = rtD.depthTexture; renderer.setRenderTarget(rtP); renderer.render(quadScene, quadCam);
    const dp = new Float32Array(SZ * SZ * 4); renderer.readRenderTargetPixels(rtP, 0, 0, SZ, SZ, dp); renderer.setRenderTarget(null);
    shots.push({ cam: cam.clone(), col, dp });
    await new Promise(r => setTimeout(r, 0));
  }
  renderer.setPixelRatio(pr0); renderer.setSize(sz0.x, sz0.y, false);
  rtD.dispose(); rtP.dispose(); scene.remove(animal.group);
  return { shots, R };
}
function toPoints({ shots, R }) {
  const vs = R * 2 / 260, best = new Map(), inv = new THREE.Matrix4(), p = new THREE.Vector3();
  for (const { cam, col, dp } of shots) {
    inv.copy(cam.projectionMatrixInverse).premultiply(cam.matrixWorld);
    const W = SZ, P = new Float32Array(W * W * 3), ok = new Uint8Array(W * W);
    for (let y = 0; y < W; y++) for (let x = 0; x < W; x++) { const i = y * W + x, d = dp[i * 4]; if (d >= .9999) continue;
      p.set((x + .5) / W * 2 - 1, (y + .5) / W * 2 - 1, d * 2 - 1).applyMatrix4(inv); P[i * 3] = p.x; P[i * 3 + 1] = p.y; P[i * 3 + 2] = p.z; ok[i] = 1; }
    const eye = cam.position;
    for (let y = 2; y < W - 2; y += 2) for (let x = 2; x < W - 2; x += 2) { const i = y * W + x; if (!ok[i]) continue;
      if (!ok[i - 2] || !ok[i + 2] || !ok[i - 2 * W] || !ok[i + 2 * W] || !ok[i - 2 * W - 2] || !ok[i + 2 * W + 2]) continue;
      const ax = P[(i + 1) * 3] - P[(i - 1) * 3], ay = P[(i + 1) * 3 + 1] - P[(i - 1) * 3 + 1], az = P[(i + 1) * 3 + 2] - P[(i - 1) * 3 + 2];
      const bx = P[(i + W) * 3] - P[(i - W) * 3], by = P[(i + W) * 3 + 1] - P[(i - W) * 3 + 1], bz = P[(i + W) * 3 + 2] - P[(i - W) * 3 + 2];
      let nx = ay * bz - az * by, ny = az * bx - ax * bz, nz = ax * by - ay * bx; const nl = Math.hypot(nx, ny, nz); if (nl < 1e-12) continue; nx /= nl; ny /= nl; nz /= nl;
      const X = P[i * 3], Y = P[i * 3 + 1], Z = P[i * 3 + 2]; let ex = eye.x - X, ey = eye.y - Y, ez = eye.z - Z; const el = Math.hypot(ex, ey, ez); ex /= el; ey /= el; ez /= el;
      let face = nx * ex + ny * ey + nz * ez; if (face < 0) { nx = -nx; ny = -ny; nz = -nz; face = -face; }
      if (face < .25) continue;
      const ci = ((W - 1 - y) * W + x) * 4, key = `${Math.floor(X / vs)},${Math.floor(Y / vs)},${Math.floor(Z / vs)}`, b = best.get(key);
      if (!b || face > b[9]) best.set(key, [X, Y, Z, nx, ny, nz, col[ci], col[ci + 1], col[ci + 2], face]);
    }
  }
  return [...best.values()];
}
function facet(pts, K = 140) {
  const seeds = []; for (let k = 0; k < K; k++) seeds.push(pts[Math.floor(Math.random() * pts.length)]);
  const grp = pts.map(p => { let b = 0, bd = 1e9; for (let k = 0; k < K; k++) { const s = seeds[k], d = (p[0] - s[0]) ** 2 + (p[1] - s[1]) ** 2 + (p[2] - s[2]) ** 2; if (d < bd) { bd = d; b = k; } } return b; });
  const acc = seeds.map(() => new Array(10).fill(0)); pts.forEach((p, i) => { const a = acc[grp[i]]; for (let j = 0; j < 9; j++) a[j] += p[j]; a[9]++; });
  return pts.map((p, i) => { const a = acc[grp[i]], n = a[9], c = [a[0] / n, a[1] / n, a[2] / n]; let nx = a[3], ny = a[4], nz = a[5]; const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
    const d = (p[0] - c[0]) * nx + (p[1] - c[1]) * ny + (p[2] - c[2]) * nz, tone = [.72, 1, 1.25][(grp[i] * 7) % 3] * (.85 + .3 * Math.max(0, ny));
    return [p[0] - nx * d, p[1] - ny * d, p[2] - nz * d, nx, ny, nz, Math.min(255, a[6] / n * tone), Math.min(255, a[7] / n * tone), Math.min(255, a[8] / n * tone), p[9]]; });
}

// ------------------------------------------------------------------ pieces: point = [x,y,z, nx,ny,nz, r,g,b, size], centred, facing +z
function relief(fig, Hw, cell, thickK = .12) {
  const { px, w, h } = fig, k = Hw / h, step = Math.max(1, cell / k), gw = Math.floor(w / step), gh = Math.floor(h / step);
  const A = new Uint8Array(gw * gh), D = new Float32Array(gw * gh), at = (gx, gy) => (Math.floor(gy * step) * w + Math.floor(gx * step)) * 4;
  for (let y = 0; y < gh; y++) for (let x = 0; x < gw; x++) { A[y * gw + x] = px[at(x, y) + 3] > 128 ? 1 : 0; D[y * gw + x] = A[y * gw + x] ? 1e9 : 0; }
  for (let y = 0; y < gh; y++) for (let x = 0; x < gw; x++) { const i = y * gw + x; if (A[i]) D[i] = Math.min(D[i], (x ? D[i - 1] : 0) + 1, (y ? D[i - gw] : 0) + 1); }
  for (let y = gh - 1; y >= 0; y--) for (let x = gw - 1; x >= 0; x--) { const i = y * gw + x; if (A[i]) D[i] = Math.min(D[i], (x < gw - 1 ? D[i + 1] : 0) + 1, (y < gh - 1 ? D[i + gw] : 0) + 1); }
  let dmax = 1; for (const d of D) if (d < 1e8) dmax = Math.max(dmax, d);
  const Z = i => Hw * thickK * Math.sqrt(Math.min(1, D[i] / (dmax * .6))), u = step * k, out = [];
  for (let y = 1; y < gh - 1; y++) for (let x = 1; x < gw - 1; x++) { const i = y * gw + x; if (!A[i]) continue;
    const X = (x - gw / 2) * u, Y = (gh / 2 - y) * u, z = Z(i);
    let nx = -(Z(i + 1) - Z(i - 1)) / (2 * u), ny = (Z(i + gw) - Z(i - gw)) / (2 * u), nz = 1; const nl = Math.hypot(nx, ny, nz); nx /= nl; ny /= nl; nz /= nl;
    const c = at(x, y), sz = Math.max(cell, u) * 1.25;
    out.push([X, Y, z, nx, ny, nz, px[c], px[c + 1], px[c + 2], sz]);
    out.push([X, Y, -z * .6, -nx, -ny, -nz, px[c] * .6, px[c + 1] * .6, px[c + 2] * .6, sz]);
  }
  return out;
}
function shard(P, rnd, Ww, cell) {
  const n = 3 + Math.floor(rnd() * 3), V = Array.from({ length: n }, () => rnd() * Math.PI * 2).sort((a, b) => a - b).map(a => [Math.cos(a) * (.6 + rnd() * .4), Math.sin(a) * (.6 + rnd() * .4)]);
  const inside = (x, y) => V.every((v, i) => { const w2 = V[(i + 1) % n]; return (w2[0] - v[0]) * (y - v[1]) - (w2[1] - v[1]) * (x - v[0]) >= 0; });
  const u0 = .08 + rnd() * .72, v0 = .08 + rnd() * .72, span = .12 + rnd() * .12, out = [];
  for (let y = -1; y <= 1; y += cell / (Ww / 2)) for (let x = -1; x <= 1; x += cell / (Ww / 2)) { if (!inside(x, y)) continue;
    const ix = Math.min(P.w - 1, Math.max(0, Math.floor((u0 + x * span / 2) * P.w))), iy = Math.min(P.h - 1, Math.max(0, Math.floor((v0 - y * span / 2 * P.w / P.h) * P.h))), c = (iy * P.w + ix) * 4;
    out.push([x * Ww / 2, y * Ww / 2, 0, 0, 0, 1, P.px[c], P.px[c + 1], P.px[c + 2], cell * 1.2]);
    out.push([x * Ww / 2, y * Ww / 2, -cell * .5, 0, 0, -1, P.px[c] * .7, P.px[c + 1] * .7, P.px[c + 2] * .7, cell * 1.2]); }
  return out;
}
function plinth(P, R, n, cell) {      // a lump of the painting's ground, its foot at the origin
  const out = [], Rb = R * .9, h = R * .16, noise = a => Math.sin(a * 3 + 1.7) * .08 + Math.sin(a * 5 + .4) * .05 + Math.sin(a * 9) * .03;
  for (let k = 0; k < n; k++) {
    const a = Math.random() * Math.PI * 2, rr = Rb * (1 + noise(a)), side = Math.random() < .45; let x, y, z, nx, ny, nz, u, v;
    if (!side) { const r = rr * Math.sqrt(Math.random()); x = Math.cos(a) * r; z = Math.sin(a) * r; y = -Math.pow(r / rr, 4) * h * .25; nx = 0; ny = 1; nz = 0; u = .5 + x / (Rb * 2) * .55; v = .8 + z / (Rb * 2) * .3; }
    else { const t = Math.random(), k2 = 1 - t * .18; x = Math.cos(a) * rr * k2; z = Math.sin(a) * rr * k2; y = -h * .25 - t * h * .75; nx = Math.cos(a); ny = .25; nz = Math.sin(a); u = a / (Math.PI * 2); v = .78 + t * .2; }
    const i = (Math.min(P.h - 1, Math.floor(v * P.h)) * P.w + Math.min(P.w - 1, Math.floor(u * P.w))) * 4, dk = side ? .62 : 1;
    out.push([x, y, z, nx, ny, nz, P.px[i] * dk, P.px[i + 1] * dk, P.px[i + 2] * dk, cell * 1.5]);
  }
  return out;
}

// ------------------------------------------------------------------ 2 · the painting re-forms your animal
function parts(P, K, rnd) {
  const C = Array.from({ length: K }, () => P[Math.floor(rnd() * P.length)].slice(0, 3)), g = new Int32Array(P.length);
  for (let it = 0; it < 6; it++) {
    P.forEach((p, i) => { let b = 0, bd = 1e9; C.forEach((c, k) => { const d = (p[0] - c[0]) ** 2 + (p[1] - c[1]) ** 2 + (p[2] - c[2]) ** 2; if (d < bd) { bd = d; b = k; } }); g[i] = b; });
    const S = C.map(() => [0, 0, 0, 0]); P.forEach((p, i) => { const s = S[g[i]]; s[0] += p[0]; s[1] += p[1]; s[2] += p[2]; s[3]++; });
    S.forEach((s, k) => { if (s[3]) C[k] = [s[0] / s[3], s[1] / s[3], s[2] / s[3]]; });
  }
  const rad = C.map(() => [0, 0]); P.forEach((p, i) => { const c = C[g[i]]; rad[g[i]][0] += Math.hypot(p[0] - c[0], p[1] - c[1], p[2] - c[2]); rad[g[i]][1]++; });
  return { C, g, rad: rad.map(([s, n]) => s / Math.max(1, n)) };
}
const TET = [[1, 1, 1], [1, -1, -1], [-1, 1, -1], [-1, -1, 1]].map(v => new THREE.Vector3(...v).normalize());
function reform(pts, look, R, rnd) {
  const m = [0, 0, 0]; pts.forEach(p => { m[0] += p[0]; m[1] += p[1]; m[2] += p[2]; }); m.forEach((v, i) => m[i] = v / pts.length);
  const P = pts.map(p => [p[0] - m[0], p[1] - m[1], p[2] - m[2], p[3], p[4], p[5], p[6], p[7], p[8], 0]);
  let ymin = 1e9; P.forEach(p => { ymin = Math.min(ymin, p[1]); });
  // the side of it (its narrowest horizontal axis): what a folk painter flattens
  let sx = 0, sz = 0; P.forEach(p => { sx += p[0] * p[0]; sz += p[2] * p[2]; });
  const side = sx < sz ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 0, 1), q = new THREE.Vector3(), d = new THREE.Vector3();
  if (look === 'facet' || look === 'woodblock') {
    const { C, g, rad } = parts(P, 9, rnd);
    const N = C.map(() => { const r = new THREE.Quaternion().setFromEuler(new THREE.Euler(rnd() * 6.28, rnd() * 6.28, rnd() * 6.28)); return TET.map(n => n.clone().applyQuaternion(r)); });
    P.forEach((p, i) => { const k = g[i], c = C[k]; d.set(p[0] - c[0], p[1] - c[1], p[2] - c[2]); const r = d.length(); if (r < 1e-6) return; d.divideScalar(r);
      const s = Math.max(.3, ...N[k].map(n => n.dot(d))), r2 = r * .55 + (rad[k] * 1.1 / s) * .45;
      p[0] = c[0] + d.x * r2; p[1] = c[1] + d.y * r2; p[2] = c[2] + d.z * r2; });
  } else if (look === 'flat' || look === 'ink') {
    const { C, g, rad } = parts(P, 7, rnd), yLeg = ymin + R * .45;
    P.forEach((p, i) => { const c = C[g[i]]; d.set(p[0] - c[0], p[1] - c[1], p[2] - c[2]); const r = d.length();
      if (r > 1e-6) d.multiplyScalar((r * .45 + rad[g[i]] * 1.1 * .55) / r);
      q.set(c[0] + d.x, c[1] + d.y, c[2] + d.z); q.addScaledVector(side, -q.dot(side) * .6);
      if (q.y < yLeg) q.y = yLeg - (yLeg - q.y) * .55;
      p[0] = q.x; p[1] = q.y; p[2] = q.z; });
    P.forEach(p => { for (let j = 6; j < 9; j++) p[j] = Math.min(255, Math.round(p[j] / 40) * 40 + 12); });
  } else {
    const W = Array.from({ length: 4 }, () => [rnd() * 6.28, (2 + rnd() * 3) / R]);
    P.forEach(p => { let x = p[0], y = p[1], z = p[2];
      const tw = Math.sin(y / R * 2.2 + W[0][0]) * .55, cx = Math.cos(tw), sx2 = Math.sin(tw); [x, z] = [x * cx - z * sx2, x * sx2 + z * cx];
      const sw = 1 + .28 * Math.sin(x * W[1][1] + W[1][0]) * Math.sin(z * W[2][1] + W[2][0]); x *= sw; z *= sw;
      y = y * 1.18 + .12 * R * Math.sin(x * W[3][1] + W[3][0]); p[0] = x; p[1] = y; p[2] = z; });
  }
  return P;
}

// ------------------------------------------------------------------ 3 · the arrangement (nothing passes through anything)
const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), E = new THREE.Euler(), V = new THREE.Vector3(), Nv = new THREE.Vector3();
function place(arr, { pos, yaw = 0, pitch = 0, roll = 0, s = 1, role = 2 }, into) {      // role: 0 your animal, 1 a painted animal, 2 a thing
  Q.setFromEuler(E.set(pitch, yaw, roll, 'YXZ')); M.compose(pos, Q, V.set(s, s, s));
  for (const p of arr) { V.set(p[0], p[1], p[2]).applyMatrix4(M); Nv.set(p[3], p[4], p[5]).applyQuaternion(Q); into.push([V.x, V.y, V.z, Nv.x, Nv.y, Nv.z, p[6], p[7], p[8], p[9] * s, role]); }
}
const extent = arr => { let r = 0, y0 = 1e9; for (const p of arr) { r = Math.max(r, Math.hypot(p[0], p[1], p[2])); y0 = Math.min(y0, p[1]); } return { r, y0 }; };

function arrange({ me, figs, things, painting, look, R, cell, seed, meName }) {
  const rnd = mulberry(seed), out = [], anchors = [], tilt = k => (rnd() - .5) * k, H = R * 1.6, taken = [];
  const outward = a => Math.PI / 2 - a;
  // a free spot for a piece of radius r: tries random spots, keeps the one that crowds the others least
  const spot = (r, gen) => { let best = null, bestGap = -1e9;
    for (let k = 0; k < 60; k++) { const c = gen(); const gap = Math.min(1e9, ...taken.map(t => c.distanceTo(t.c) - (t.r + r) * .92));
      if (gap > bestGap) { bestGap = gap; best = c; } if (gap > 0) break; }
    taken.push({ c: best, r }); return best; };
  // your animal, re-formed, large, in the middle
  const body = reform(me, look, R, rnd); body.forEach(p => p[9] = cell * 1.3);
  const meS = 1 + rnd() * .1, ex = extent(body), meR = ex.r * meS, meP = new THREE.Vector3((rnd() - .5) * R * .15, -ex.y0 * meS + R * .02, (rnd() - .5) * R * .15);
  place(body, { pos: meP, s: meS, yaw: rnd() * 6.28, roll: tilt(.15), role: 0 }, out); taken.push({ c: meP.clone(), r: meR * .7 }); anchors.push(meP);
  // the painting's animals, whole, standing round it on the ground, each turned three-quarters towards it
  const seen = [], n = Math.max(1, figs.length), a0 = rnd() * 6.28;
  let floated = false;
  figs.forEach((f, k) => {
    const Hw = R * (.6 + rnd() * .3) * Math.min(1.3, Math.sqrt(f.h / f.w) * 1.1), rl = relief(f, Hw, cell, .3), r = extent(rl).r;
    const fl = !floated && rnd() < .3; floated ||= fl;
    const p = spot(r, () => { const a = a0 + k * Math.PI * 2 / n + tilt(.7), rr = Math.max(R * .95, meR * .65 + r * .8) + rnd() * R * .3;
      return new THREE.Vector3(Math.cos(a) * rr, fl ? Hw / 2 + R * (.45 + rnd() * .3) : Hw / 2, Math.sin(a) * rr); });
    const a = Math.atan2(p.z, p.x), turn = (rnd() < .5 ? 1 : -1) * (.2 + rnd() * .35);
    place(rl, { pos: p, yaw: outward(a) + turn, roll: tilt(fl ? .4 : .08), role: 1 }, out); anchors.push(p); seen.push(f.kind);
  });
  // the painting's world: its things, whole, a grove behind and between the animals; or, for a
  // painting with no things in it, crystal shards of its colour circling above
  const named = [];
  if (things.length) things.forEach((t, k) => {
    const Hw = R * (.95 + rnd() * .5), rl = relief(t, Hw, cell, .05), r = extent(rl).r;
    const p = spot(r, () => { const a = a0 + (k + .5) * Math.PI * 2 / Math.max(n, things.length) + tilt(.6), rr = R * (1.25 + rnd() * .35);
      return new THREE.Vector3(Math.cos(a) * rr, Hw / 2 - R * .05 + rnd() * R * .25, Math.sin(a) * rr); });
    const a = Math.atan2(p.z, p.x);
    place(rl, { pos: p, yaw: outward(a) + tilt(.8), pitch: tilt(.25), roll: tilt(.3), role: 2 }, out); anchors.push(p); named.push(t.kind);
  });
  else for (let k = 0, m = 6 + Math.floor(rnd() * 3); k < m; k++) {
    const sh = shard(painting, rnd, R * (.45 + rnd() * .45), cell * 1.1), r = extent(sh).r;
    const p = spot(r, () => { const a = rnd() * 6.28, rr = R * (.7 + rnd() * .8); return new THREE.Vector3(Math.cos(a) * rr, R * (.35 + rnd() * 1.4), Math.sin(a) * rr); });
    place(sh, { pos: p, yaw: rnd() * 6.28, pitch: tilt(2), roll: tilt(2), role: 3 }, out); anchors.push(p);
  }
  // star-lines
  const lines = [], stars = [];
  anchors.forEach((p, i) => anchors.map((b, j) => [p.distanceTo(b), j]).filter(([, j]) => j !== i).sort((x, y) => x[0] - y[0]).slice(0, 2)
    .forEach(([, j]) => { if (!lines.some(([x, y]) => (x === i && y === j) || (x === j && y === i))) lines.push([i, j]); }));
  for (const [i, j] of lines) { const p = anchors[i], b = anchors[j], n = Math.ceil(p.distanceTo(b) / (cell * 1.1));
    for (let t = 0; t <= n; t++) { const c = p.clone().lerp(b, t / n); stars.push([c.x, c.y, c.z, cell * .28, 236, 206, 140, 200]); } }
  for (const p of anchors) stars.push([p.x, p.y, p.z, cell * 1.6, 255, 238, 190, 255]);
  return { pts: out, stars, met: [...new Set(seen)], things: [...new Set(named)], top: Math.max(...taken.map(t => t.c.y + t.r * .6)) };
}

// ------------------------------------------------------------------ 4 · splats
const qtmp = new THREE.Quaternion(), mtmp = new THREE.Matrix4(), T = new THREE.Vector3(), B = new THREE.Vector3(), N = new THREE.Vector3(), UP = new THREE.Vector3(0, 1, 0), I = new THREE.Quaternion();
function frame(nx, ny, nz) { N.set(nx, ny, nz); T.copy(UP).cross(N); if (T.lengthSq() < 1e-6) T.set(1, 0, 0).cross(N); T.normalize(); B.crossVectors(N, T); mtmp.makeBasis(T, B, N); return qtmp.setFromRotationMatrix(mtmp); }
const sp = (x, y, z, s0, s1, s2, r, g, b, a, q) => [x, y, z, s0, s1, s2, r, g, b, a, q.w, q.x, q.y, q.z];
function writeSplats(list) {
  const buf = new ArrayBuffer(list.length * 32), f = new Float32Array(buf), u = new Uint8Array(buf);
  list.forEach((s, k) => { f.set(s.slice(0, 6), k * 8); const o = k * 32 + 24;
    for (let j = 0; j < 4; j++) u[o + j] = Math.min(255, Math.max(0, s[6 + j]));
    for (let j = 0; j < 4; j++) u[o + 4 + j] = Math.min(255, Math.max(0, Math.round(s[10 + j] * 128 + 128))); });
  return buf;
}
function toPly(list) {
  const n = list.length, props = ['x', 'y', 'z', 'nx', 'ny', 'nz', 'f_dc_0', 'f_dc_1', 'f_dc_2', 'opacity', 'scale_0', 'scale_1', 'scale_2', 'rot_0', 'rot_1', 'rot_2', 'rot_3'];
  const head = `ply\nformat binary_little_endian 1.0\nelement vertex ${n}\n${props.map(p => `property float ${p}`).join('\n')}\nend_header\n`;
  const body = new Float32Array(n * props.length), C0 = .28209479177387814;
  list.forEach((s, k) => { const a = Math.min(.999, Math.max(.001, s[9] / 255)); body.set([s[0], s[1], s[2], 0, 0, 0, (s[6] / 255 - .5) / C0, (s[7] / 255 - .5) / C0, (s[8] / 255 - .5) / C0,
    Math.log(a / (1 - a)), Math.log(s[3]), Math.log(s[4]), Math.log(s[5]), s[10], s[11], s[12], s[13]], k * props.length); });
  return new Blob([new TextEncoder().encode(head), body.buffer], { type: 'application/octet-stream' });
}
function render(kind, c, base, cell, R, seed) {
  const out = [], rr = mulberry(seed * 31 + 7), rand = () => rr();
  if (kind === 'solid') {
    for (const p of c.pts) out.push(sp(p[0], p[1], p[2], p[9], p[9], cell * .22, p[6], p[7], p[8], 245, frame(p[3], p[4], p[5])));
    for (const p of base) out.push(sp(p[0], p[1], p[2], p[9], p[9], cell * .3, p[6], p[7], p[8], 240, frame(p[3], p[4], p[5])));
  } else if (kind === 'stars') {
    const st = (p, keep, k) => { if (rand() > keep) return; const big = rand() < .03, s = cell * (big ? 1.1 : .3 + rand() * .3), L = v => Math.min(255, v * k + 60);
      out.push(sp(p[0], p[1], p[2], s, s, s, L(p[6]), L(p[7]), L(p[8]), 255, I)); };
    for (const p of c.pts) st(p, p[10] === 2 ? .08 : .15, 1.5); for (const p of base) st(p, .06, 1.3);
  } else {
    // 点彩: dots whose density drifts through space – thick clusters, thin veils, dust lifting off
    const W = Array.from({ length: 5 }, () => [(rand() - .5) * 2, (rand() - .5) * 2, (rand() - .5) * 2, rand() * 6.28, (1.2 + rand() * 2.6) / R]);
    const field = (x, y, z) => { let v = 0; for (const [a, b, c2, ph, f] of W) v += Math.sin((a * x + b * y + c2 * z) * f + ph); return v / W.length * 2.6; };
    const sm = t => t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t);
    const FLOOR = [.5, .42, 0, .38], dot = (p, scale, k0, k1) => { const n = Math.max(FLOOR[p[10] ?? 2] || 0, sm(field(p[0], p[1], p[2]) * .5 + .5));
      if (rand() > (.05 + .85 * Math.pow(n, 1.3)) * scale) return;
      let x = p[0], y = p[1], z = p[2];
      if (n < .45 && rand() < .35) { const d = R * .25 * (.45 - n) * rand(); x += p[3] * d + (rand() - .5) * d; y += p[4] * d + rand() * d * .6; z += p[5] * d + (rand() - .5) * d; }
      else { x += (rand() - .5) * cell * .8; y += (rand() - .5) * cell * .8; z += (rand() - .5) * cell * .8; }
      const big = rand() < (n < .4 ? .07 : .012), s = big ? cell * (.8 + rand() * .6) : cell * (n > .6 ? .22 + rand() * .2 : .3 + rand() * .35), L = v => Math.min(255, v * k0 + k1 + (big ? 50 : 0) + (1 - n) * 25);
      out.push(sp(x, y, z, s, s, s, L(p[6]), L(p[7]), L(p[8]), big ? 255 : 200 + 55 * n, I)); };
    for (const p of c.pts) dot(p, 1, 1.25, 14); for (const p of base) dot(p, .35, 1.15, 8);
  }
  for (const s of c.stars) { if (s[3] < cell && rand() > (kind === 'solid' ? .5 : .3)) continue; out.push([s[0], s[1], s[2], s[3], s[3], s[3], s[4], s[5], s[6], s[3] < cell ? 170 : 255, 1, 0, 0, 0]); }
  return out;
}

// ------------------------------------------------------------------ the sculpture, in the create view
export class PointSculpture {
  // opts: { work, look, palette, painting (url), visitor: { glb, height } | { img }, figures: [{img, kind}], things: [{img, kind}], meName }
  constructor(container, opts) { this.c = container; this.o = opts; this.material = 'dots'; this.seed = 1 + Math.floor(Math.random() * 1e6); this.form = 'earth'; }
  async init(onStep = () => {}) {
    const o = this.o, look = o.look || 'oil';
    this.renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    this.renderer.setPixelRatio(Math.min(2, devicePixelRatio)); this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.c.appendChild(this.renderer.domElement);
    const pim = new Image(); pim.crossOrigin = 'anonymous'; pim.src = o.painting; await pim.decode();
    this.painting = pixels(pim, 900);
    const lin = v => { v /= 255; return v <= .04045 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); }, mean = [0, 0, 0], px = this.painting.px;
    for (let i = 0; i < px.length; i += 16) for (let k = 0; k < 3; k++) mean[k] += lin(px[i + k]); mean.forEach((v, k) => mean[k] = v / (px.length / 16));
    // your animal
    onStep('photo');
    let me, R;
    if (o.visitor.glb) {
      const [{ loadAnimal3D }, { styleActor }, { paintFX }] = await Promise.all([import('../animal3d.js'), import('./livestyle.js'), import('./paintfx.js')]);
      const animal = await loadAnimal3D(o.visitor.glb, { height: 1, look: 'real' });
      animal.setHeight(o.visitor.height || 1); styleActor(animal, look, o.palette);
      const fx = paintFX(this.renderer, look, o.palette);
      const cap = await photograph(this.renderer, animal, fx, mean);
      me = toPoints(cap); R = cap.R; animal.dispose?.();
      if (look === 'facet' || look === 'woodblock') me = facet(me);
    } else {
      R = .6; me = relief(pixels(o.visitor.img, 400), R * 1.4, R * 2 / 260, .25);
    }
    this.R = R; this.cell = R * 2 / 260;
    this.me = me;
    this.figs = (o.figures || []).map(f => ({ ...pixels(f.img, 360), kind: f.kind }));
    this.things = (o.things || []).map(f => ({ ...pixels(f.img, 360), kind: f.kind }));
    this.base = plinth(this.painting, R * 1.9, 80000, this.cell);
    // the stage
    this.GS = await import(GS_URL);
    this.scene = new THREE.Scene(); this.scene.background = new THREE.Color(0x0b0a09);
    this.camera = new THREE.PerspectiveCamera(35, 1, .01, 200);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true; this.controls.autoRotate = true; this.controls.autoRotateSpeed = .6;
    this.controls.minDistance = R * 1.5; this.controls.maxDistance = R * 14;
    this.camera.position.set(R * 4.2, R * 2.6, R * 4.2); this.controls.target.set(0, R * .8, 0);
    this.renderer.domElement.addEventListener('pointerdown', () => { this.controls.autoRotate = false; clearTimeout(this._ar); this._ar = setTimeout(() => this.controls.autoRotate = true, 6000); });
    this._resize = () => this.resize(); addEventListener('resize', this._resize); this.resize();
    this.renderer.setAnimationLoop(() => { this.controls.update(); this.renderer.render(this.scene, this.camera); });
    onStep('build');
    await this.rebuild();
    return this;
  }
  build() {
    this.coll = arrange({ me: this.me, figs: [...this.figs].sort(() => Math.random() - .5).slice(0, 4), things: this.things.length ? [this.things[0], ...this.things.slice(1).sort(() => Math.random() - .5)].slice(0, 4) : [],
      painting: this.painting, look: this.o.look, R: this.R, cell: this.cell, seed: this.seed });
    // frame the whole of it: the camera keeps its direction and steps back until everything fits
    const b = new THREE.Box3(), v = new THREE.Vector3(); for (let i = 0; i < this.coll.pts.length; i += 7) { const p = this.coll.pts[i]; b.expandByPoint(v.set(p[0], p[1], p[2])); }
    b.expandByPoint(v.set(this.R * 1.2, -this.R * .3, this.R * 1.2)); b.expandByPoint(v.set(-this.R * 1.2, -this.R * .3, -this.R * 1.2));
    const c = b.getCenter(new THREE.Vector3()), rad = b.getSize(new THREE.Vector3()).length() * .5;
    const fov = THREE.MathUtils.degToRad(this.camera.fov) / 2, fit = rad / Math.sin(Math.min(fov, Math.atan(Math.tan(fov) * this.camera.aspect))) * .8;
    const dir = this.camera.position.clone().sub(this.controls.target).normalize();
    this.controls.target.copy(c); this.camera.position.copy(c).addScaledVector(dir, fit);
    this.controls.maxDistance = Math.max(this.controls.maxDistance, fit * 1.8);
  }
  async rebuild() { this.build(); await this.show(); }
  async show() {
    if (this._busy) { this._again = true; return; } this._busy = true;
    this.list = render(this.material, this.coll, this.base, this.cell, this.R, this.seed);
    const url = URL.createObjectURL(new Blob([writeSplats(this.list)]));
    const nv = new this.GS.DropInViewer({ sharedMemoryForWorkers: false, sphericalHarmonicsDegree: 0, gpuAcceleratedSort: false, sceneRevealMode: this.GS.SceneRevealMode.Gradual, sceneFadeInRateMultiplier: 1.5 });
    await nv.addSplatScene(url, { showLoadingUI: false, progressiveLoad: false, format: this.GS.SceneFormat.Splat });
    URL.revokeObjectURL(url);
    if (this.dv) { this.scene.remove(this.dv); this.dv.dispose?.(); } this.dv = nv; this.scene.add(nv);
    this._busy = false; if (this._again) { this._again = false; this.show(); }
  }
  setMaterial(m) { if (m === this.material) return; this.material = m; this.show(); }
  reshape() { this.seed += 7919; this.rebuild(); }
  nextForm() { this.reshape(); } setForm() { this.reshape(); }
  externalBrush() {} handInput() {}
  get info() { return this.coll ? { met: this.coll.met, things: this.coll.things } : null; }
  // the sculpture sits right of the middle when there is room, so the label at the left never covers it
  resize() {
    const w = this.c.clientWidth || innerWidth, h = this.c.clientHeight || innerHeight;
    this.renderer.setSize(w, h); this.camera.aspect = w / h;
    if (w > 900) this.camera.setViewOffset(w, h, -w * .1, 0, w, h); else this.camera.clearViewOffset();
    this.camera.updateProjectionMatrix();
  }
  screenshot() { this.renderer.render(this.scene, this.camera); return this.renderer.domElement.toDataURL('image/jpeg', 0.92); }
  exportPly() { return toPly(this.list || []); }
  dispose() {
    this.renderer.setAnimationLoop(null); removeEventListener('resize', this._resize); clearTimeout(this._ar);
    if (this.dv) { this.scene.remove(this.dv); this.dv.dispose?.(); }
    this.controls.dispose(); this.renderer.dispose(); this.renderer.domElement.remove();
  }
}

// Star-map collage (the 2D "new painting"): stained glass, cyanotype shadows and constellations,
// merged. The visitor lays out animals (their own animal, the painting's animals, animals from other
// paintings) and torn pieces of paintings; on every release the sheet is "fired" again in one of
// three styles:  A 星夜彩窗 (figurative) · B 晒出的星座 (half-abstract) · C 碎玻璃星云 (abstract).
// Each animal becomes a constellation, named after where it came from (the name can be changed).
const load = u => new Promise(r => { const i = new Image(); i.onload = () => r(i); i.onerror = () => r(null); i.src = u; });
function mulberry(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
let rnd = Math.random;                      // seeded during a render so the glass stays put between edits
const pick = (a, n) => a.slice().sort(() => Math.random() - .5).slice(0, n);
const cv = (w, h) => { const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(h)); return c; };
function trim(img) {
  const c = cv(img.width, img.height), g = c.getContext('2d'); g.drawImage(img, 0, 0); const d = g.getImageData(0, 0, c.width, c.height).data;
  let x0 = c.width, y0 = c.height, x1 = 0, y1 = 0;
  for (let y = 0; y < c.height; y += 2) for (let x = 0; x < c.width; x += 2) if (d[(y * c.width + x) * 4 + 3] > 40) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
  const o = cv(x1 - x0, y1 - y0); o.getContext('2d').drawImage(img, x0, y0, o.width, o.height, 0, 0, o.width, o.height); return o;
}
function fit(img, w, h) { const k = Math.min(w / img.width, h / img.height); return [img.width * k, img.height * k]; }
const DARK = [14, 42, 96], LIGHT = [236, 244, 255];
const duoCache = new WeakMap();
function duo(img, gamma = 1.05) {                     // cyanotype print: light → white, dark → Prussian blue
  const key = gamma; let m = duoCache.get(img); if (m && m[key]) return m[key];
  const c = cv(img.width, img.height), g = c.getContext('2d'); g.drawImage(img, 0, 0);
  const d = g.getImageData(0, 0, c.width, c.height), a = d.data;
  for (let i = 0; i < a.length; i += 4) { const L = Math.pow((a[i] * .3 + a[i + 1] * .59 + a[i + 2] * .11) / 255, gamma), t = Math.min(1, Math.max(0, (L - .1) / .72)), v = t * t * (3 - 2 * t);
    for (let k = 0; k < 3; k++) a[i + k] = DARK[k] + (LIGHT[k] - DARK[k]) * v; }
  g.putImageData(d, 0, 0); m = m || {}; m[key] = c; duoCache.set(img, m); return c;
}
function cyanPaper(g, W, H) {
  const gr = g.createRadialGradient(W * .5, H * .45, W * .1, W * .5, H * .5, W * .75); gr.addColorStop(0, '#1d4f96'); gr.addColorStop(1, '#0a2149');
  g.fillStyle = gr; g.fillRect(0, 0, W, H);
  const d = g.getImageData(0, 0, W, H), a = d.data;
  for (let i = 0; i < a.length; i += 4) { const n = (rnd() - .5) * 22; a[i] += n * .6; a[i + 1] += n * .8; a[i + 2] += n; } g.putImageData(d, 0, 0);
  for (let k = 0; k < 500; k++) { g.fillStyle = `rgba(${rnd() < .5 ? '210,228,255' : '4,16,48'},${rnd() * .14})`; g.fillRect(rnd() * W, rnd() * H, 1 + rnd() * 3, 1 + rnd() * 3); }
}
function voronoi(W, H, seeds, B = 26) {
  const gw = Math.ceil(W / B), gh = Math.ceil(H / B), bins = Array.from({ length: gw * gh }, () => []);
  seeds.forEach((s, i) => bins[Math.min(gh - 1, Math.max(0, (s[1] / B) | 0)) * gw + Math.min(gw - 1, Math.max(0, (s[0] / B) | 0))].push(i));
  const idx = new Int32Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const bx = (x / B) | 0, by = (y / B) | 0; let best = 0, bd = 1e12;
    for (let r = 1; r < 14; r++) {
      for (let j = Math.max(0, by - r); j <= Math.min(gh - 1, by + r); j++) for (let i = Math.max(0, bx - r); i <= Math.min(gw - 1, bx + r); i++)
        for (const q of bins[j * gw + i]) { const dx = seeds[q][0] - x, dy = seeds[q][1] - y, dd = dx * dx + dy * dy; if (dd < bd) { bd = dd; best = q; } }
      if (bd < (r * B) * (r * B)) break;
    }
    idx[y * W + x] = best;
  }
  return idx;
}
function drawPlaced(g, p, img) { g.save(); g.translate(p.x, p.y); g.rotate(p.rot); if (p.flip) g.scale(-1, 1); g.drawImage(img, -p.w / 2, -p.h / 2, p.w, p.h); g.restore(); }
function boxOf(p) { const r = Math.hypot(p.w, p.h) / 2; return [p.x - r, p.y - r, p.x + r, p.y + r]; }
function tree(st) {               // minimum spanning tree: how the stars of one figure are joined
  const inT = [0], links = []; while (inT.length < st.length) { let b = null, bd = 1e9;
    inT.forEach(a => st.forEach((s, j) => { if (inT.includes(j)) return; const d = Math.hypot(s[0] - st[a][0], s[1] - st[a][1]); if (d < bd) { bd = d; b = [a, j]; } })); links.push(b); inT.push(b[1]); }
  return links;
}
// an animal's constellation: its extremities (farthest-point picks along its own outline) and a heart star
function animalStars(p, K = 11) {
  const [x0, y0, x1, y1] = boxOf(p).map(Math.round), bw = x1 - x0, bh = y1 - y0, c = cv(bw, bh), cg = c.getContext('2d');
  drawPlaced(cg, { ...p, x: p.x - x0, y: p.y - y0 }, p.im); const d = cg.getImageData(0, 0, c.width, c.height).data, W = c.width, pts = [];
  for (let y = 3; y < c.height - 3; y += 3) for (let x = 3; x < W - 3; x += 3) { const i = y * W + x; if (d[i * 4 + 3] < 100) continue;
    if (d[(i - 3) * 4 + 3] < 100 || d[(i + 3) * 4 + 3] < 100 || d[(i - 3 * W) * 4 + 3] < 100 || d[(i + 3 * W) * 4 + 3] < 100) pts.push([x + x0, y + y0]); }
  if (pts.length < 3) return { stars: [], links: [] };
  const cx = pts.reduce((s, q) => s + q[0], 0) / pts.length, cy = pts.reduce((s, q) => s + q[1], 0) / pts.length;
  const stars = [pts.reduce((b, q) => q[1] < b[1] ? q : b)], dmin = pts.map(q => Math.hypot(q[0] - stars[0][0], q[1] - stars[0][1]));
  while (stars.length < K) { let bi = 0; dmin.forEach((v, i) => { if (v > dmin[bi]) bi = i; }); const s = pts[bi]; stars.push(s); pts.forEach((q, i) => dmin[i] = Math.min(dmin[i], Math.hypot(q[0] - s[0], q[1] - s[1]))); }
  stars.push([cx, cy]); return { stars, links: tree(stars) };
}
function drawStar(g, x, y, r, col = '255,246,220') {
  const s = g.createRadialGradient(x, y, 0, x, y, r * 5); s.addColorStop(0, `rgba(${col},1)`); s.addColorStop(.25, `rgba(${col},.55)`); s.addColorStop(1, `rgba(${col},0)`);
  g.fillStyle = s; g.fillRect(x - r * 5, y - r * 5, r * 10, r * 10);
  if (r > 2.2) { g.strokeStyle = `rgba(${col},.55)`; g.lineWidth = .8; g.beginPath(); g.moveTo(x - r * 6, y); g.lineTo(x + r * 6, y); g.moveTo(x, y - r * 6); g.lineTo(x, y + r * 6); g.stroke(); }
}
let LABELS = [];
function labelAt(c, W, H) {
  const xs = c.stars.map(q => q[0]), ys = c.stars.map(q => q[1]); let x = Math.min(W - 190, Math.max(24, (Math.min(...xs) + Math.max(...xs)) / 2 - 60)), y = Math.min(H - 22, Math.max(...ys) + 28);
  for (let t = 0; t < 6 && LABELS.some(l => Math.abs(l[0] - x) < 180 && Math.abs(l[1] - y) < 22); t++) y = y - 26 < 30 ? y + 26 : y - 26;
  LABELS.push([x, y]); return [x, y];
}
function drawConstellations(g, list, W, H) {
  LABELS = [];
  for (const { c, label } of list) {
    if (!c.stars.length) continue;
    g.save(); g.strokeStyle = 'rgba(4,10,32,.5)'; g.lineWidth = 4; g.beginPath(); c.links.forEach(([a, b]) => { g.moveTo(...c.stars[a]); g.lineTo(...c.stars[b]); }); g.stroke(); g.restore();   // a dark bed so the line reads on lit glass too
    g.save(); g.strokeStyle = 'rgba(255,236,190,.78)'; g.lineWidth = 1.3; g.shadowColor = 'rgba(255,230,170,.8)'; g.shadowBlur = 6;
    g.beginPath(); c.links.forEach(([a, b]) => { g.moveTo(...c.stars[a]); g.lineTo(...c.stars[b]); }); g.stroke(); g.restore();
    c.stars.forEach((s, i) => drawStar(g, s[0], s[1], i === c.stars.length - 1 ? 3.2 : 1.4 + rnd() * 1.8));
    if (!label) continue; const at = labelAt(c, W, H);
    g.save(); g.shadowColor = 'rgba(2,6,20,.95)'; g.shadowBlur = 6; g.fillStyle = 'rgba(255,240,205,.95)'; g.font = 'italic 15px Georgia, "Songti SC", serif'; g.fillText(label, at[0], at[1]); g.fillText(label, at[0], at[1]); g.restore();
  }
}
// stained glass from a source picture: per-pixel lead lines, each pane shaded from its middle
function glaze(g, W, H, seeds, idx, col, md, sd, insideKeepsPicture) {
  const out = g.createImageData(W, H), od = out.data;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const i = y * W + x, q = idx[i], o = i * 4;
    const edge = x > 1 && y > 1 && x < W - 2 && y < H - 2 && (idx[i - 1] !== q || idx[i + 1] !== q || idx[i - W] !== q || idx[i + W] !== q || idx[i - 2] !== q || idx[i - 2 * W] !== q);
    const inside = md[i] > 60;
    const rim = insideKeepsPicture && x > 3 && y > 3 && x < W - 4 && y < H - 4 && ((md[i - 3] > 60) !== inside || (md[i - 3 * W] > 60) !== inside || (md[i + 3] > 60) !== inside || (md[i + 3 * W] > 60) !== inside);
    const lead = insideKeepsPicture && inside ? (idx[i - 1] !== q || idx[i - W] !== q) : edge;
    if (rim || lead) { od[o] = 8; od[o + 1] = 14; od[o + 2] = 30; }
    else if (insideKeepsPicture && inside) { od[o] = sd[o]; od[o + 1] = sd[o + 1]; od[o + 2] = sd[o + 2]; }
    else { const c = col[q], dx = x - seeds[q][0], dy = y - seeds[q][1], sh = 1.08 - Math.min(.36, Math.sqrt(dx * dx + dy * dy) / 76) + (rnd() - .5) * .05;
      od[o] = Math.min(255, c[0] * sh); od[o + 1] = Math.min(255, c[1] * sh); od[o + 2] = Math.min(255, c[2] * sh); }
    od[o + 3] = 255; }
  g.putImageData(out, 0, 0);
}
function maskOf(W, H, animals) { const m = cv(W, H), mg = m.getContext('2d'); animals.forEach(p => drawPlaced(mg, p, p.im)); const d = mg.getImageData(0, 0, W, H).data, md = new Uint8Array(W * H); for (let i = 0; i < W * H; i++) md[i] = d[i * 4 + 3]; return md; }
function seedsFor(W, H, md, n, pin, pout) { const s = []; for (let t = 0; s.length < n && t < n * 40; t++) { const x = rnd() * W, y = rnd() * H; if (md[(y | 0) * W + (x | 0)] > 60 ? rnd() < pin : rnd() < pout) s.push([x, y]); } return s; }
const labelOf = p => p.name ?? p.label;

// ---- the three styles, drawn from what the visitor laid out
const RENDER = {
  A(g, W, H, items, P) {
    const animals = items.filter(p => p.kind === 'animal'), frags = items.filter(p => p.kind === 'frag');
    const src = cv(W, H), sg = src.getContext('2d'); cyanPaper(sg, W, H);
    items.forEach(p => { if (p.kind === 'frag') { sg.save(); sg.globalAlpha = .6; drawPlaced(sg, p, duo(p.im, 1.1)); sg.restore(); } else drawPlaced(sg, p, duo(p.im)); });
    const sd = sg.getImageData(0, 0, W, H).data, md = maskOf(W, H, animals);
    const jw = cv(W, H), jg = jw.getContext('2d'); Object.values(P).forEach((p, k) => { jg.globalAlpha = k ? .5 : 1; jg.drawImage(p, 0, 0, W, H); }); frags.forEach(p => { jg.globalAlpha = 1; drawPlaced(jg, p, p.im); });
    const jd = jg.getImageData(0, 0, W, H).data;
    const seeds = seedsFor(W, H, md, 1500, .3, .3), idx = voronoi(W, H, seeds), n = seeds.length, sum = new Float32Array(n * 5);
    for (let i = 0; i < W * H; i++) { const q = idx[i] * 5; sum[q] += sd[i * 4]; sum[q + 1] += sd[i * 4 + 1]; sum[q + 2] += sd[i * 4 + 2]; sum[q + 3]++; sum[q + 4] += md[i] > 60 ? 1 : 0; }
    const col = seeds.map((s, q) => { const c = sum[q * 5 + 3] || 1, inA = sum[q * 5 + 4] / c > .5;
      let r = sum[q * 5] / c, gg = sum[q * 5 + 1] / c, b = sum[q * 5 + 2] / c;
      if (!inA && rnd() < .07) { const i = ((s[1] | 0) * W + (s[0] | 0)) * 4; r = jd[i]; gg = jd[i + 1]; b = jd[i + 2]; const m = (r + gg + b) / 3, k = 2.2; r = m + (r - m) * k; gg = m + (gg - m) * k; b = m + (b - m) * k; return [r * 1.4 + 30, gg * 1.4 + 30, b * 1.4 + 30, 1]; }
      const lift = .8 + rnd() * .45; return [r * lift, gg * lift, b * lift, 0]; });
    glaze(g, W, H, seeds, idx, col, md, sd, true);
    const lg = g.createLinearGradient(0, 0, W, H); lg.addColorStop(0, 'rgba(200,225,255,.16)'); lg.addColorStop(.55, 'rgba(200,225,255,0)'); g.fillStyle = lg; g.fillRect(0, 0, W, H);
    g.save(); g.globalCompositeOperation = 'lighter'; seeds.forEach((s, q) => { if (!col[q][3]) return; const c = col[q], rg = g.createRadialGradient(s[0], s[1], 0, s[0], s[1], 60);
      rg.addColorStop(0, `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},.22)`); rg.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = rg; g.fillRect(s[0] - 60, s[1] - 60, 120, 120); }); g.restore();
    drawConstellations(g, animals.map(p => ({ c: animalStars(p, 10), label: labelOf(p) })), W, H);
    g.strokeStyle = '#070b18'; g.lineWidth = 18; g.strokeRect(9, 9, W - 18, H - 18);
  },
  B(g, W, H, items) {
    cyanPaper(g, W, H);
    const grass = (x, y, s, a) => { g.save(); g.translate(x, y); g.rotate(a); g.strokeStyle = 'rgba(225,238,255,.4)'; g.lineWidth = 2; g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(s * .2, -s * .5, s * .05, -s); g.stroke();
      for (let t = .2; t < .95; t += .12) { g.fillStyle = 'rgba(225,238,255,.32)'; g.beginPath(); g.ellipse(s * .1 * t + (t * 10 % 2 ? 8 : -8), -s * t, 10, 3, t * 10 % 2 ? .6 : -.6, 0, 7); g.fill(); } g.restore(); };
    for (let k = 0; k < 7; k++) grass(rnd() * W, H * (.8 + rnd() * .25), 140 + rnd() * 140, (rnd() - .5) * .9);
    const cs = [];
    for (const p of items) {
      if (p.kind === 'frag') { g.save(); g.globalAlpha = .42; drawPlaced(g, p, duo(p.im, 1.1)); g.restore(); continue; }   // a faint print of the painting
      const [bx0, by0, bx1, by1] = boxOf(p).map(Math.round), bw = bx1 - bx0, bh = by1 - by0, sheet = cv(bw, bh), shg = sheet.getContext('2d');
      const q = { ...p, x: bw / 2, y: bh / 2 }; drawPlaced(shg, q, duo(p.im)); const sd = shg.getImageData(0, 0, bw, bh).data;
      const colr = cv(bw, bh), cg = colr.getContext('2d'); drawPlaced(cg, q, p.im); const cd = cg.getImageData(0, 0, bw, bh).data;
      const seeds = []; for (let t = 0; t < 6000 && seeds.length < 150; t++) { const x = rnd() * bw, y = rnd() * bh; if (sd[((y | 0) * bw + (x | 0)) * 4 + 3] > 120) seeds.push([x, y]); }
      if (seeds.length < 5) continue;
      const idx = voronoi(bw, bh, seeds, 20), box = seeds.map(() => [1e9, 1e9, -1, -1]);
      for (let y = 0; y < bh; y++) for (let x = 0; x < bw; x++) { const i = y * bw + x; if (sd[i * 4 + 3] < 40) continue; const b = box[idx[i]]; b[0] = Math.min(b[0], x); b[1] = Math.min(b[1], y); b[2] = Math.max(b[2], x); b[3] = Math.max(b[3], y); }
      const jewel = seeds.map(() => rnd() < .1), shards = box.map(b => b[2] < 0 ? null : { b, img: new ImageData(b[2] - b[0] + 1, b[3] - b[1] + 1) });
      for (let y = 0; y < bh; y++) for (let x = 0; x < bw; x++) { const i = y * bw + x, a = sd[i * 4 + 3]; if (a < 40) continue; const k = idx[i], s = shards[k]; if (!s) continue;
        const o = ((y - s.b[1]) * s.img.width + (x - s.b[0])) * 4, edge = x > 0 && y > 0 && x < bw - 1 && y < bh - 1 && (idx[i - 1] !== k || idx[i - bw] !== k || idx[i + 1] !== k || idx[i + bw] !== k);
        const src = jewel[k] ? cd : sd, m = jewel[k] ? 1.35 : 1;
        s.img.data[o] = edge ? 240 : Math.min(255, src[i * 4] * m); s.img.data[o + 1] = edge ? 248 : Math.min(255, src[i * 4 + 1] * m); s.img.data[o + 2] = edge ? 255 : Math.min(255, src[i * 4 + 2] * m); s.img.data[o + 3] = edge ? 200 : a; }
      const cx = bw / 2, cy = bh / 2, corners = [];
      shards.forEach((s, k) => { if (!s) return; const c = cv(s.img.width, s.img.height); c.getContext('2d').putImageData(s.img, 0, 0);
        const sx = seeds[k][0], sy = seeds[k][1], dx = sx - cx, dy = sy - cy, d = Math.hypot(dx, dy) || 1, push = 4 + (d / Math.max(bw, bh)) * 34 * (.6 + rnd() * .8);
        const ox = bx0 + dx / d * push, oy = by0 + dy / d * push, rot = (rnd() - .5) * .08;
        g.save(); g.translate(ox + sx, oy + sy); g.rotate(rot); g.translate(-sx, -sy); g.shadowColor = jewel[k] ? 'rgba(255,220,150,.6)' : 'rgba(170,205,255,.35)'; g.shadowBlur = jewel[k] ? 14 : 6;
        g.drawImage(c, s.b[0], s.b[1]); g.restore();
        if (d > Math.min(bw, bh) * .22) corners.push([ox + sx + dx / d * 8, oy + sy + dy / d * 8, d]); });
      const st = []; corners.sort((a, b) => b[2] - a[2]);
      for (const c of corners) { if (st.every(s => Math.hypot(s[0] - c[0], s[1] - c[1]) > Math.max(bw, bh) * .16)) st.push([c[0], c[1]]); if (st.length >= 10) break; }
      st.push([bx0 + cx, by0 + cy]);
      cs.push({ c: { stars: st, links: tree(st) }, label: labelOf(p) });
    }
    drawConstellations(g, cs, W, H);
    g.strokeStyle = 'rgba(225,238,255,.45)'; g.lineWidth = 1; g.strokeRect(22, 22, W - 44, H - 44);
  },
  C(g, W, H, items, P) {
    const animals = items.filter(p => p.kind === 'animal');
    const src = cv(W, H), sg = src.getContext('2d'), ps = Object.values(P);
    ps.forEach((p, k) => { sg.globalAlpha = [1, .5, .35][k]; sg.drawImage(p, 0, 0, W, H); }); sg.globalAlpha = 1;
    items.forEach(p => { if (p.kind === 'frag') drawPlaced(sg, p, p.im); });
    const sd = sg.getImageData(0, 0, W, H).data, md = maskOf(W, H, animals);
    const seeds = seedsFor(W, H, md, 1100, .9, .35), idx = voronoi(W, H, seeds), n = seeds.length, sum = new Float32Array(n * 3), cnt = new Float32Array(n), inA = new Float32Array(n);
    for (let i = 0; i < W * H; i++) { const q = idx[i]; sum[q * 3] += sd[i * 4]; sum[q * 3 + 1] += sd[i * 4 + 1]; sum[q * 3 + 2] += sd[i * 4 + 2]; cnt[q]++; inA[q] += md[i] > 60 ? 1 : 0; }
    const col = seeds.map((s, q) => { const c = cnt[q] || 1, R = sum[q * 3] / c, G = sum[q * 3 + 1] / c, Bl = sum[q * 3 + 2] / c, L = (R * .3 + G * .59 + Bl * .11) / 255, f = inA[q] / c;
      if (f > .5) { const warm = rnd() < .3, m = .62 + L * .5, base = warm ? [255, 208, 130] : [226, 238, 255]; return base.map((v, k) => Math.min(255, (v * .72 + [R, G, Bl][k] * .55) * m)).concat(f); }
      const m = Math.min(1, Math.pow(L, .8) * 1.15) * (.55 + rnd() * .6), blue = [DARK[0] + (135 - DARK[0]) * m, DARK[1] + (180 - DARK[1]) * m, DARK[2] + (240 - DARK[2]) * m];
      const keep = rnd() < .06 ? .75 : .16; return blue.map((v, k) => v * (1 - keep) + [R, G, Bl][k] * keep * 1.25).concat(0); });
    glaze(g, W, H, seeds, idx, col, md, sd, false);
    g.save(); g.globalCompositeOperation = 'lighter'; seeds.forEach((s, q) => { if (col[q][3] < .5) return; const rg = g.createRadialGradient(s[0], s[1], 0, s[0], s[1], 46);
      rg.addColorStop(0, 'rgba(190,215,255,.13)'); rg.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = rg; g.fillRect(s[0] - 46, s[1] - 46, 92, 92); }); g.restore();
    for (let k = 0; k < 260; k++) drawStar(g, rnd() * W, rnd() * H, .4 + rnd() * .7, '220,232,255');
    drawConstellations(g, animals.map(p => ({ c: animalStars(p, 12), label: labelOf(p) })), W, H);
  },
};

export const STYLES = [{ key: 'A', zh: '星夜彩窗', en: 'Starlit glass', subZh: '具象', subEn: 'figurative' }, { key: 'B', zh: '晒出的星座', en: 'Sun-printed stars', subZh: '半抽象', subEn: 'half-abstract' }, { key: 'C', zh: '碎玻璃星云', en: 'Glass nebula', subZh: '抽象', subEn: 'abstract' }];

// opts: { zh, paintings: [{ key, name, img }] (the first is this painting), animals: [{ img, label, title }] (the first is yours), mine: number of animals that start on the sheet }
export class StarCollage {
  constructor(view, panel, opts) { this.view = view; this.panel = panel; this.o = opts; this.style = 'B'; }
  get variant() { return { A: 'glass', B: 'cyan', C: 'nebula' }[this.style]; }
  async init() {
    const view = this.view, panel = this.panel, o = this.o, zh = o.zh, self = this;
    view.width = 1100; view.height = 760;
    const vg = view.getContext('2d'), W = view.width, H = view.height, art = cv(W, H), ag = art.getContext('2d');
    this.art = art;
    const I = o.animals.map(a => ({ ...a, im: trim(a.img) })), P = {}; o.paintings.forEach(p => P[p.key] = p.img);
    let items = [], sel = null, seed = 1 + Math.floor(Math.random() * 1e6), dragging = null, timer = 0;
    const T = (a, b) => zh ? a : b;
    panel.innerHTML = `<h3>${T('款式', 'Style')}</h3><div class="sc-styles"></div>
      <h3>${T('放一只动物进来', 'Add an animal')}</h3><div class="sc-shelf sc-animals"></div>
      <h3>${T('撕一块画', 'Tear off a piece of a painting')}</h3><div class="sc-shelf sc-paints"></div>
      <div class="sc-sel" hidden><h3>${T('选中的', 'Selected')}</h3><input type="text" class="sc-name" placeholder="${T('给它的星座起个名字', 'Name its constellation')}">
        <div class="sc-row"><button data-do="flip">${T('翻转', 'Flip')}</button><button data-do="up">${T('放到最上面', 'To front')}</button><button data-do="down">${T('放到最下面', 'To back')}</button><button data-do="del">${T('删除', 'Remove')}</button></div></div>
      <div class="sc-busy">${T('正在烧制玻璃…', 'Firing the glass…')}</div>`;
    const busy = panel.querySelector('.sc-busy'), selBox = panel.querySelector('.sc-sel'), nameIn = panel.querySelector('.sc-name');
    const addAnimal = (a, at) => { const [w, h] = fit(a.im, W * .3, H * .5);
      const p = { kind: 'animal', im: a.im, label: a.label, x: at ? at[0] : W * (.3 + Math.random() * .4), y: at ? at[1] : H * (.35 + Math.random() * .3), w, h, rot: (Math.random() - .5) * .2, flip: Math.random() < .5 };
      items.push(p); return p; };
    const addFrag = (key, at) => {
      const p = P[key], sw = p.width * (.25 + Math.random() * .2), sh = sw * (.6 + Math.random() * .5), sx = Math.random() * (p.width - sw), sy = Math.random() * (p.height - sh);
      const c = cv(Math.min(420, sw), Math.min(420, sw) * sh / sw); c.getContext('2d').drawImage(p, sx, sy, sw, sh, 0, 0, c.width, c.height);
      { const g = c.getContext('2d'), w = c.width, h = c.height, j = 9, pts = [];
        for (let t = 0; t <= 1; t += .02) pts.push([8 + (w - 16) * t, 8 + (Math.random() - .5) * j]);
        for (let t = 0; t <= 1; t += .02) pts.push([w - 8 + (Math.random() - .5) * j, 8 + (h - 16) * t]);
        for (let t = 1; t >= 0; t -= .02) pts.push([8 + (w - 16) * t, h - 8 + (Math.random() - .5) * j]);
        for (let t = 1; t >= 0; t -= .02) pts.push([8 + (Math.random() - .5) * j, 8 + (h - 16) * t]);
        g.globalCompositeOperation = 'destination-in'; g.filter = 'blur(1.5px)'; g.beginPath(); pts.forEach((q, i) => i ? g.lineTo(...q) : g.moveTo(...q)); g.closePath(); g.fill(); g.filter = 'none'; g.globalCompositeOperation = 'source-over'; }
      const s = W * (.24 + Math.random() * .14) / c.width;
      const f = { kind: 'frag', key, im: c, x: at ? at[0] : W * (.15 + Math.random() * .7), y: at ? at[1] : H * (.2 + Math.random() * .6), w: c.width * s, h: c.height * s, rot: (Math.random() - .5) * .5, flip: false };
      const fa = items.findIndex(q => q.kind === 'animal'); items.splice(fa < 0 ? items.length : fa, 0, f); return f; };
    const shuffle = () => {
      items = []; const keys = o.paintings.map(p => p.key); addFrag(keys[0]); addFrag(keys[0]); addFrag(pick(keys, 1)[0]); addFrag(keys[0]);
      const slots = [[.2, .52], [.5, .44], [.8, .55]].sort(() => Math.random() - .5);
      [I[0], ...pick(I.slice(1, 1 + (o.mine || 2)).length ? I.slice(1, 1 + (o.mine || 2)) : I.slice(1), 2)].forEach((a, k) => addAnimal(a, [W * slots[k][0], H * slots[k][1]]));
      sel = null; showSel(); seed = 1 + Math.floor(Math.random() * 1e6); rerender(); };
    const rerender = (delay = 60) => { clearTimeout(timer); busy.classList.add('on');
      timer = setTimeout(() => { rnd = mulberry(seed + this.style.charCodeAt(0));
        ag.setTransform(1, 0, 0, 1, 0, 0); ag.clearRect(0, 0, W, H);
        try { RENDER[this.style](ag, W, H, items, P); } catch (e) { console.error(e); }
        rnd = Math.random; busy.classList.remove('on'); paint(); }, delay); };
    const paint = () => {
      vg.setTransform(1, 0, 0, 1, 0, 0); vg.clearRect(0, 0, W, H);
      if (dragging) { vg.globalAlpha = .3; vg.drawImage(art, 0, 0); vg.globalAlpha = 1;
        items.forEach(p => { vg.save(); vg.globalAlpha = p.kind === 'frag' ? .6 : 1; drawPlaced(vg, p, duo(p.im, p.kind === 'frag' ? 1.1 : 1.05)); vg.restore(); }); }
      else vg.drawImage(art, 0, 0);
      if (sel) { const p = sel; vg.save(); vg.translate(p.x, p.y); vg.rotate(p.rot);
        vg.setLineDash([6, 5]); vg.strokeStyle = 'rgba(243,215,154,.9)'; vg.lineWidth = 1.5; vg.strokeRect(-p.w / 2, -p.h / 2, p.w, p.h); vg.setLineDash([]);
        vg.fillStyle = '#f3d79a'; vg.fillRect(p.w / 2 - 8, p.h / 2 - 8, 16, 16);
        vg.beginPath(); vg.moveTo(0, -p.h / 2); vg.lineTo(0, -p.h / 2 - 26); vg.stroke(); vg.beginPath(); vg.arc(0, -p.h / 2 - 30, 8, 0, 7); vg.fill(); vg.restore(); } };
    const toLocal = (p, x, y) => { const dx = x - p.x, dy = y - p.y, c = Math.cos(-p.rot), s = Math.sin(-p.rot); return [dx * c - dy * s, dx * s + dy * c]; };
    const pos = e => { const r = view.getBoundingClientRect(); return [(e.clientX - r.left) * W / r.width, (e.clientY - r.top) * H / r.height]; };
    const hit = (x, y) => { for (let k = items.length - 1; k >= 0; k--) { const p = items[k], [lx, ly] = toLocal(p, x, y); if (Math.abs(lx) <= p.w / 2 && Math.abs(ly) <= p.h / 2) {
        if (p.kind === 'animal') { const c = cv(1, 1), g = c.getContext('2d'), ix = (p.flip ? -lx : lx) / p.w * p.im.width + p.im.width / 2, iy = ly / p.h * p.im.height + p.im.height / 2;
          g.drawImage(p.im, ix, iy, 1, 1, 0, 0, 1, 1); if (g.getImageData(0, 0, 1, 1).data[3] < 30) continue; }
        return p; } } return null; };
    const L = [];
    const on = (el, ev, fn, opt) => { el.addEventListener(ev, fn, opt); L.push([el, ev, fn, opt]); };
    on(view, 'pointerdown', e => { const [x, y] = pos(e); view.setPointerCapture(e.pointerId);
      if (sel) { const [lx, ly] = toLocal(sel, x, y);
        if (Math.abs(lx - sel.w / 2) < 14 && Math.abs(ly - sel.h / 2) < 14) { dragging = { mode: 'scale', p: sel, d0: Math.hypot(x - sel.x, y - sel.y), w0: sel.w, h0: sel.h }; return; }
        if (Math.hypot(lx, ly + sel.h / 2 + 30) < 14) { dragging = { mode: 'rotate', p: sel }; return; } }
      sel = hit(x, y); showSel(); if (sel) dragging = { mode: 'move', p: sel, dx: x - sel.x, dy: y - sel.y, moved: false }; paint(); });
    on(view, 'pointermove', e => { if (!dragging) return; const [x, y] = pos(e), d = dragging, p = d.p; d.moved = true;
      if (d.mode === 'move') { p.x = x - d.dx; p.y = y - d.dy; }
      if (d.mode === 'scale') { const k = Math.max(.15, Math.hypot(x - p.x, y - p.y) / d.d0); p.w = d.w0 * k; p.h = d.h0 * k; }
      if (d.mode === 'rotate') p.rot = Math.atan2(y - p.y, x - p.x) + Math.PI / 2;
      view.style.cursor = 'grabbing'; requestAnimationFrame(paint); });
    const up = () => { if (!dragging) return; const moved = dragging.moved; dragging = null; view.style.cursor = ''; paint(); if (moved) rerender(); };
    on(view, 'pointerup', up); on(view, 'pointercancel', up);
    on(view, 'dblclick', e => { const p = hit(...pos(e)); if (p) { p.flip = !p.flip; sel = p; rerender(); } });
    on(view, 'wheel', e => { if (!sel) return; e.preventDefault(); const k = Math.exp(-e.deltaY * .0015); sel.w *= k; sel.h *= k; dragging = { mode: 'wheel', p: sel }; paint(); clearTimeout(view._w); view._w = setTimeout(() => { dragging = null; rerender(); }, 350); }, { passive: false });
    on(window, 'keydown', e => { if (!sel || e.target.tagName === 'INPUT' || view.offsetParent === null) return; if (e.key === 'Delete' || e.key === 'Backspace') { act('del'); e.preventDefault(); } });
    function showSel() { selBox.hidden = !sel; if (!sel) return; nameIn.disabled = sel.kind !== 'animal'; nameIn.value = sel.kind === 'animal' ? labelOf(sel) : '';
      nameIn.placeholder = sel.kind === 'animal' ? T('给它的星座起个名字', 'Name its constellation') : T('（画的碎片没有星座）', '(pieces of painting have no constellation)'); }
    on(nameIn, 'input', () => { if (sel && sel.kind === 'animal') { sel.name = nameIn.value; rerender(500); } });
    const act = what => {
      if (what === 'flip' && sel) sel.flip = !sel.flip;
      if (what === 'up' && sel) { items.splice(items.indexOf(sel), 1); items.push(sel); }
      if (what === 'down' && sel) { items.splice(items.indexOf(sel), 1); items.unshift(sel); }
      if (what === 'del' && sel) { items.splice(items.indexOf(sel), 1); sel = null; showSel(); }
      if (what === 'reglass') seed = 1 + Math.floor(Math.random() * 1e6);
      if (what === 'shuffle') return shuffle();
      if (what === 'clear') { items = []; sel = null; showSel(); }
      rerender(); };
    this.act = act;
    panel.querySelectorAll('[data-do]').forEach(b => b.onclick = () => act(b.dataset.do));
    const st = panel.querySelector('.sc-styles');
    this.setStyle = k => { this.style = k; st.querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', x.dataset.k === k)); rerender(); };
    STYLES.forEach(s => { const b = document.createElement('button'); b.dataset.k = s.key; b.innerHTML = `<b>${zh ? s.zh : s.en}</b><small>${zh ? s.subZh : s.subEn}</small>`;
      b.setAttribute('aria-pressed', s.key === this.style); b.onclick = () => this.setStyle(s.key); st.appendChild(b); });
    const thumb = (im, title) => { const b = document.createElement('button'), [w, h] = fit(im, 64, 48), c = cv(w * 2, h * 2); c.style.width = w + 'px'; c.style.height = h + 'px';
      c.getContext('2d').drawImage(im, 0, 0, c.width, c.height); b.title = title; b.appendChild(c); return b; };
    const an = panel.querySelector('.sc-animals');
    I.forEach((a, k) => { const b = thumb(a.im, a.title); if (!k) b.classList.add('mine'); b.onclick = () => { sel = addAnimal(a); showSel(); rerender(); }; an.appendChild(b); });
    const pn = panel.querySelector('.sc-paints');
    o.paintings.forEach(p => { const b = thumb(p.img, T(`从《${p.name}》撕一块`, `A piece of ${p.name}`)); b.onclick = () => { sel = addFrag(p.key); showSel(); rerender(); }; pn.appendChild(b); });
    this._off = () => L.forEach(([el, ev, fn, opt]) => el.removeEventListener(ev, fn, opt));
    shuffle();
    return this;
  }
  nextVariant(step = 1) { const ks = STYLES.map(s => s.key); this.setStyle(ks[(ks.indexOf(this.style) + step + ks.length) % ks.length]); }
  handInput() {} resize() {}
  toDataURL() { return this.art.toDataURL('image/jpeg', 0.92); }
  dispose() { this._off?.(); this.panel.innerHTML = ''; }
}

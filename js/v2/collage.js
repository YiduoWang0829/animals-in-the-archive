// The collage, version 2: one picture, one world.
//
// The ground is the painting itself with everything movable lifted out of it and the gap
// repainted (LaMa). Everything that was painted in it (animals, trees, houses, boats …) is
// a cut-out you can pick up, together with the visitor, re-made in the painting's manner.
// Move anything anywhere: it gets smaller as it goes back into the picture (the painting's
// own depth), and it keeps a shadow on the ground. The animals behave like animals:
//   · prey will not stand beside its predator: put the cat next to the wolf and it backs away
//   · a small bird or a monkey dropped on a big animal hops onto its back
//   · animals of one kind drift together; a predator turns to face what it would hunt
// Each reaction is said in one short line, so you see why. "Unify" pulls every piece into
// the painting's palette and brushwork, so pieces from other paintings belong too.

import { relation, kindName, realH, isBird } from './ecology.js';
import { LANG } from '../strings.js';

const loadImg = url => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
const lerp = (a, b, k) => a + (b - a) * k;

export class Collage {
  // opts: { work, plate, depth, parts: [{img, kind, type, box}], visitor: {img, kind}, palette, look, onSay }
  constructor(canvas, opts) {
    this.cv = canvas; this.g = canvas.getContext('2d'); this.o = opts;
    this.items = []; this.sel = null; this.unify = true; this.variant = 'original';
    this.anim = []; this.lines = [];
    this._bind();
  }

  async init() {
    const o = this.o;
    this.plate = await loadImg(o.plate);
    this.A = this.plate.width / this.plate.height;
    try {
      const d = await loadImg(o.depth);
      const c = document.createElement('canvas'); c.width = 96; c.height = Math.round(96 / this.A);
      const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(d, 0, 0, c.width, c.height);
      const px = g.getImageData(0, 0, c.width, c.height).data;
      this.dw = c.width; this.dh = c.height; this.depth = new Float32Array(c.width * c.height);
      for (let i = 0; i < this.depth.length; i++) this.depth[i] = px[i * 4] / 255;
    } catch { this.depth = null; }
    this.grain = makeGrain();
    this.resize();
    // the painted parts, where they were painted
    for (const p of o.parts) this.add(p.img, { kind: p.kind, type: p.type, x: (p.box[0] + p.box[2]) / 2, y: p.box[3], h: p.box[3] - p.box[1], painted: true });
    // the visitor, on open ground near the front
    if (o.visitor) {
      const spot = this.openGround();
      const animals = o.parts.filter(p => p.type === 'animal');
      const ref = animals[0];
      // as tall as it would be next to the painted animals (by real size)
      let h = ref ? (ref.box[3] - ref.box[1]) * realH(o.visitor.kind) / Math.max(0.1, realH(ref.kind)) * this.depthScale(spot[1]) / this.depthScale(ref.box[3]) : 0.32;
      h = Math.max(0.12, Math.min(0.6, h));
      this.add(o.visitor.img, { kind: o.visitor.kind, type: 'animal', x: spot[0], y: spot[1], h, visitor: true });
    }
    this.restyleAll();
    this.loop();
  }

  // a piece: an image standing on the ground at (x, y) [y = its feet], h = height (fraction of the picture)
  add(img, { kind = 'thing', type = 'thing', x = 0.5, y = 0.8, h = 0.2, visitor = false, painted = false, flip = false } = {}) {
    const it = { src: img, img, kind, type, x, y, h, h0: h, y0: y, flip, rot: 0, visitor, painted, id: Math.random().toString(36).slice(2) };
    it.ar = img.width / img.height;
    this.items.push(it);
    if (this.unify) it.img = this.restyle(img);
    this.sortItems();
    return it;
  }
  remove(it) { this.items = this.items.filter(x => x !== it); if (this.sel === it) this.sel = null; }
  removeSelected() { if (this.sel && !this.sel.visitor) this.remove(this.sel); }

  // ---- depth: how big a thing is at a height in the picture (further back = smaller)
  depthAt(x, y) {
    if (!this.depth) return 1 - Math.max(0, Math.min(1, (0.95 - y) / 0.6)) * 0.8;
    const gx = Math.max(0, Math.min(this.dw - 1, Math.round(x * (this.dw - 1)))), gy = Math.max(0, Math.min(this.dh - 1, Math.round(y * (this.dh - 1))));
    return this.depth[gy * this.dw + gx];
  }
  depthScale(y, x = 0.5) { const d = this.depthAt(x, Math.min(0.995, y)); return 1 / (1 / 34 + (1 / 2.2 - 1 / 34) * Math.pow(d, 1.15)) ** -1; }
  rescale(it) { it.h = it.h0 * this.depthScale(it.y, it.x) / this.depthScale(it.y0, it.x0 ?? it.x); }

  openGround() {
    let best = [0.5, 0.88], bs = -1e9;
    for (let k = 0; k < 120; k++) {
      const x = 0.1 + Math.random() * 0.8, y = 0.72 + Math.random() * 0.24;
      const crowd = this.items.reduce((s, it) => s + (Math.abs(it.x - x) < 0.15 && Math.abs(it.y - y) < 0.15 ? 1 : 0), 0);
      const sc = -crowd * 2 - Math.abs(x - 0.5);
      if (sc > bs) { bs = sc; best = [x, y]; }
    }
    return best;
  }

  // ---- the painting's manner on every piece (so a piece from elsewhere belongs here)
  restyle(img) {
    const pal = (this.o.palette || []).map(p => hex(p.c));
    if (!pal.length) return img;
    const W = Math.min(420, img.width), H = Math.round(W * img.height / img.width);
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(img, 0, 0, W, H);
    const d = g.getImageData(0, 0, W, H), px = d.data;
    const look = this.o.look;
    const amt = look === 'facet' || look === 'flat' || look === 'woodblock' ? 0.75 : look === 'ink' ? 0.85 : look === 'dots' ? 0.6 : 0.35;
    for (let i = 0; i < px.length; i += 4) {
      if (px[i + 3] < 8) continue;
      let r = px[i], gg = px[i + 1], b = px[i + 2];
      if (look === 'ink') { const l = (r * 0.3 + gg * 0.59 + b * 0.11); r = gg = b = l; }
      const p = nearestRGB([r, gg, b], pal);
      px[i] = lerp(r, p[0], amt); px[i + 1] = lerp(gg, p[1], amt); px[i + 2] = lerp(b, p[2], amt);
    }
    g.putImageData(d, 0, 0);
    if (look === 'dots' || look === 'splat') {          // break it into strokes / dots like the painting
      const o = document.createElement('canvas'); o.width = W; o.height = H; const og = o.getContext('2d');
      const step = look === 'dots' ? 4 : 5;
      for (let y = 0; y < H; y += step) for (let x = 0; x < W; x += step) {
        const i = ((y | 0) * W + (x | 0)) * 4; if (px[i + 3] < 60) continue;
        og.fillStyle = `rgb(${px[i]},${px[i + 1]},${px[i + 2]})`;
        og.beginPath();
        if (look === 'dots') og.arc(x + Math.random(), y + Math.random(), step * 0.62, 0, 7);
        else og.ellipse(x, y, step * 1.1, step * 0.55, Math.random() * 3.14, 0, 7);
        og.fill();
      }
      og.globalCompositeOperation = 'destination-in'; og.drawImage(c, 0, 0);
      return o;
    }
    if (look === 'facet' || look === 'flat' || look === 'woodblock' || look === 'ink') {   // a key line round it
      const o = document.createElement('canvas'); o.width = W + 8; o.height = H + 8; const og = o.getContext('2d');
      og.filter = 'brightness(0)'; for (const [dx, dy] of [[-2, 0], [2, 0], [0, -2], [0, 2]]) og.drawImage(c, 4 + dx, 4 + dy);
      og.filter = 'none'; og.drawImage(c, 4, 4);
      return o;
    }
    return c;
  }
  restyleAll() { for (const it of this.items) it.img = this.unify ? this.restyle(it.src) : it.src; }
  setUnify(on) { this.unify = on; this.restyleAll(); }

  // ---- the animals' reactions
  react(moved) {
    if (moved.type !== 'animal') return;
    const near = (a, b, k = 1) => Math.abs(a.x - b.x) < (a.h * a.ar + b.h * b.ar) * 0.45 * k && Math.abs(a.y - b.y) < Math.max(a.h, b.h) * 0.6 * k;
    for (const other of this.items) {
      if (other === moved || other.type !== 'animal') continue;
      if (!near(moved, other, 1.4)) continue;
      const r1 = relation(moved.kind, other.kind);          // how `other` feels about `moved`
      const r2 = relation(other.kind, moved.kind);          // how `moved` feels about `other`
      if (r1 === 'fear') this.flee(other, moved);
      else if (r2 === 'fear') this.flee(moved, other);
      else if (r2 === 'perch' && moved.h < other.h * 0.6) this.perch(moved, other);
      else if (r1 === 'perch' && other.h < moved.h * 0.6) this.perch(other, moved);
      else if (r1 === 'herd') this.say(this.line('herd', moved, other));
      if (r1 === 'hunt' || r2 === 'hunt') { const hunter = r1 === 'hunt' ? other : moved, prey = hunter === other ? moved : other; hunter.flip = prey.x > hunter.x ? false : true; }
    }
  }
  flee(prey, from) {
    const dir = Math.sign(prey.x - from.x) || (Math.random() < 0.5 ? -1 : 1);
    const dist = (from.h * from.ar + prey.h * prey.ar) * 0.9 + 0.08;
    const tx = Math.max(0.05, Math.min(0.95, from.x + dir * dist));
    const ty = Math.min(0.98, prey.y + (Math.random() - 0.3) * 0.04);
    prey.flip = dir < 0;                                    // it turns its back as it goes
    this.animateTo(prey, tx, ty, 700);
    this.say(this.line('fear', prey, from));
  }
  perch(small, big) {
    const tx = big.x + (Math.random() - 0.5) * big.h * big.ar * 0.3, ty = big.y - big.h * 0.78;
    this.animateTo(small, tx, ty, 500, true);
    this.say(this.line('perch', small, big));
  }
  line(kind, a, b) {
    const A = kindName(a.kind, LANG), B = kindName(b.kind, LANG);
    if (LANG === 'zh') return {
      fear: `${A}不敢站在${B}旁边：它怕被吃掉。`, perch: `${A}跳到了${B}的背上，这里视野最好。`, herd: `两只${A}凑到了一起。`,
    }[kind];
    return {
      fear: `The ${A} won’t stand next to the ${B}: it’s afraid of being eaten.`,
      perch: `The ${A} hops onto the ${B}’s back. Best view in the picture.`,
      herd: `Two ${A === B ? A + 's' : A + ' and ' + B} stay close together.`,
    }[kind];
  }
  say(text) { if (text) { this.o.onSay?.(text); } }
  animateTo(it, x, y, ms, noScale = false) {
    const x0 = it.x, y0 = it.y, t0 = performance.now();
    this.anim = this.anim.filter(a => a.it !== it);
    this.anim.push({ it, step: now => {
      const k = Math.min(1, (now - t0) / ms), e = 1 - Math.pow(1 - k, 3);
      it.x = lerp(x0, x, e); it.y = lerp(y0, y, e);
      if (!noScale) this.rescale(it);
      it.hop = Math.sin(k * Math.PI) * 0.02;
      return k < 1;
    } });
  }

  // ---- drawing
  resize() {
    const r = this.cv.parentElement.getBoundingClientRect();
    const maxW = r.width - 24, maxH = r.height - 24;
    let w = maxW, h = w / this.A; if (h > maxH) { h = maxH; w = h * this.A; }
    const dpr = Math.min(2, devicePixelRatio);
    this.cv.width = Math.round(w * dpr); this.cv.height = Math.round(h * dpr);
    this.cv.style.width = w + 'px'; this.cv.style.height = h + 'px';
    this.base = { width: this.cv.width, height: this.cv.height };
  }
  sortItems() { this.items.sort((a, b) => (a.perchOn ? 1 : 0) - (b.perchOn ? 1 : 0) || a.y - b.y); }
  loop() {
    const f = () => { this.raf = requestAnimationFrame(f); this.anim = this.anim.filter(a => a.step(performance.now())); this.render(); };
    f();
  }
  rect(it) {
    const W = this.cv.width, H = this.cv.height;
    const h = it.h * H, w = h * it.ar;
    return { x: it.x * W - w / 2, y: (it.y - (it.hop || 0)) * H - h, w, h };
  }
  render() {
    const g = this.g, W = this.cv.width, H = this.cv.height;
    g.save();
    g.filter = { night: 'brightness(0.55) saturate(0.8) hue-rotate(200deg)', engraving: 'grayscale(1) contrast(1.4)', prism: 'saturate(1.6) hue-rotate(25deg)', wash: 'saturate(0.6) brightness(1.1)' }[this.variant] || 'none';
    g.drawImage(this.plate, 0, 0, W, H);
    this.sortItems();
    for (const it of this.items) {
      const r = this.rect(it);
      // shadow on the ground
      g.save(); g.globalAlpha = 0.28; g.fillStyle = '#000';
      g.beginPath(); g.ellipse(r.x + r.w / 2, r.y + r.h - r.h * 0.02, r.w * 0.42, r.h * 0.06, 0, 0, 7); g.filter = 'blur(4px)'; g.fill(); g.restore();
      g.save();
      g.translate(r.x + r.w / 2, r.y + r.h);
      g.rotate(it.rot);
      g.scale(it.flip ? -1 : 1, 1);
      g.drawImage(it.img, -r.w / 2, -r.h, r.w, r.h);
      g.restore();
      if (it === this.sel) {
        g.save(); g.strokeStyle = 'rgba(255,240,210,.85)'; g.setLineDash([6, 6]); g.lineWidth = 2;
        g.strokeRect(r.x - 4, r.y - 4, r.w + 8, r.h + 8); g.restore();
      }
    }
    g.restore();
    // one surface: the painting's grain over everything
    g.save(); g.globalAlpha = 0.07; g.globalCompositeOperation = 'overlay';
    g.fillStyle = g.createPattern(this.grain, 'repeat'); g.fillRect(0, 0, W, H); g.restore();
    const vg = g.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.max(W, H) * 0.75);
    vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(20,12,4,0.28)');
    g.fillStyle = vg; g.fillRect(0, 0, W, H);
  }

  // ---- input: drag to move, wheel to resize, double-click to flip
  hit(px, py) {
    for (let i = this.items.length - 1; i >= 0; i--) {
      const r = this.rect(this.items[i]);
      if (px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h) return this.items[i];
    }
    return null;
  }
  _bind() {
    const cv = this.cv;
    const pt = e => { const r = cv.getBoundingClientRect(); return [(e.clientX - r.left) / r.width * cv.width, (e.clientY - r.top) / r.height * cv.height]; };
    cv.addEventListener('pointerdown', e => {
      const [x, y] = pt(e); const it = this.hit(x, y);
      this.sel = it; if (!it) return;
      cv.setPointerCapture(e.pointerId);
      this.drag = { it, dx: it.x - x / cv.width, dy: it.y - y / cv.height };
      this.anim = this.anim.filter(a => a.it !== it);
    });
    cv.addEventListener('pointermove', e => {
      if (!this.drag) return;
      const [x, y] = pt(e), it = this.drag.it;
      it.x = Math.max(0, Math.min(1, x / cv.width + this.drag.dx)); it.y = Math.max(0.05, Math.min(1.02, y / cv.height + this.drag.dy));
      this.rescale(it);
    });
    cv.addEventListener('pointerup', () => { if (this.drag) { const it = this.drag.it; this.drag = null; this.react(it); } });
    cv.addEventListener('dblclick', e => { const [x, y] = pt(e); const it = this.hit(x, y); if (it) it.flip = !it.flip; });
    cv.addEventListener('wheel', e => {
      if (!this.sel) return; e.preventDefault();
      const k = Math.exp(-e.deltaY * 0.0015); this.sel.h0 *= k; this.rescale(this.sel);
    }, { passive: false });
  }
  turnSelected(a) { if (this.sel) this.sel.rot += a; }
  flipSelected() { if (this.sel) this.sel.flip = !this.sel.flip; }
  scaleSelected(k) { if (this.sel) { this.sel.h0 *= k; this.rescale(this.sel); } }

  // ---- a new arrangement, by the animals' own rules
  shuffle() {
    const animals = this.items.filter(i => i.type === 'animal'), things = this.items.filter(i => i.type !== 'animal');
    for (const t of things) { t.x = 0.08 + Math.random() * 0.84; t.y = 0.45 + Math.random() * 0.45; this.rescale(t); }
    for (const a of animals) { a.x = 0.1 + Math.random() * 0.8; a.y = 0.6 + Math.random() * 0.38; a.flip = Math.random() < 0.5; this.rescale(a); }
    for (const a of animals) this.react(a);
  }

  handInput(hs) {
    const h = hs[0]; if (!h) { this.handDrag = null; return; }
    const r = this.cv.getBoundingClientRect();
    const x = (h.pinchX * innerWidth - r.left) / r.width, y = (h.pinchY * innerHeight - r.top) / r.height;
    if (h.pinch) {
      if (!this.handDrag) { const it = this.hit(x * this.cv.width, y * this.cv.height); if (it) { this.sel = it; this.handDrag = { it, dx: it.x - x, dy: it.y - y }; } }
      else { const it = this.handDrag.it; it.x = x + this.handDrag.dx; it.y = y + this.handDrag.dy; this.rescale(it); }
    } else if (this.handDrag) { const it = this.handDrag.it; this.handDrag = null; this.react(it); }
  }
  toDataURL() { this.render(); return this.cv.toDataURL('image/jpeg', 0.92); }
  dispose() { cancelAnimationFrame(this.raf); }
}

function hex(h) { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
function nearestRGB(c, pal) {
  let best = pal[0], bd = 1e9;
  for (const p of pal) { const d = (c[0] - p[0]) ** 2 * 0.3 + (c[1] - p[1]) ** 2 * 0.59 + (c[2] - p[2]) ** 2 * 0.11; if (d < bd) { bd = d; best = p; } }
  return best;
}
function makeGrain() {
  const c = document.createElement('canvas'); c.width = c.height = 160;
  const g = c.getContext('2d'), d = g.createImageData(160, 160);
  for (let i = 0; i < d.data.length; i += 4) {
    const y = (i / 4 / 160) | 0, x = (i / 4) % 160;
    const v = 128 + (Math.random() - 0.5) * 90 + Math.sin(x * 0.9) * 14 + Math.sin(y * 0.8) * 14;   // canvas weave
    d.data[i] = d.data[i + 1] = d.data[i + 2] = v; d.data[i + 3] = 255;
  }
  g.putImageData(d, 0, 0); return c;
}

// "Make your new painting": a 2D composition on top of one of the paintings.
// The visitor and the painted host can be moved, scaled, rotated and flipped,
// moved into another painting, and the whole picture can be re-imagined
// (night, autumn, engraving, prism, storybook wash).
//
// Mouse/touch: drag an animal to move it, wheel or pinch-zoom to scale,
// double-click/tap to flip. Hands: pinch an animal to carry it; pinch with both
// hands to scale and rotate; swipe an open hand to change the variation.
// All filters are pixel operations (no ctx.filter), so they work in Safari too.

import { loadImage } from './paint.js';

export const VARIANTS = ['original', 'night', 'autumn', 'engraving', 'prism', 'wash'];
const MAXW = 1600;

function toCanvas(img, maxW = MAXW) {
  const s = Math.min(1, maxW / img.width);
  const c = document.createElement('canvas');
  c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
  c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
  return c;
}

// ---- variations (each returns a new canvas) --------------------------------
function pixels(src, fn) {
  const c = document.createElement('canvas'); c.width = src.width; c.height = src.height;
  const x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(src, 0, 0);
  const im = x.getImageData(0, 0, c.width, c.height);
  fn(im.data, c.width, c.height);
  x.putImageData(im, 0, 0);
  return c;
}
const clamp = v => v < 0 ? 0 : v > 255 ? 255 : v;
const FX = {
  original: s => s,
  night: s => pixels(s, (d, w, h) => {
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4, l = d[i] * 0.3 + d[i + 1] * 0.59 + d[i + 2] * 0.11;
      const moon = Math.max(0, 1 - Math.hypot(x / w - 0.75, y / h - 0.15) * 1.6);    // moonlight from the upper right
      const k = 0.38 + moon * 0.35;
      d[i] = clamp((l * 0.55 + d[i] * 0.2) * k); d[i + 1] = clamp((l * 0.7 + d[i + 1] * 0.2) * k * 1.05); d[i + 2] = clamp((l + d[i + 2] * 0.3) * k * 1.25);
    }
  }),
  autumn: s => pixels(s, d => {
    for (let i = 0; i < d.length; i += 4) {
      const r = d[i], g = d[i + 1], b = d[i + 2];
      d[i] = clamp(r * 1.12 + g * 0.18); d[i + 1] = clamp(g * 0.82 + r * 0.12); d[i + 2] = clamp(b * 0.62);
    }
  }),
  engraving: s => pixels(s, (d, w, h) => {
    const sp = Math.max(3, w / 380);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4, l = Math.pow((d[i] * 0.3 + d[i + 1] * 0.59 + d[i + 2] * 0.11) / 255, 0.85);
      const a = Math.abs(((x + y) / sp) % 1 - 0.5) * 2, b = Math.abs(((x - y + 9999) / (sp * 1.2)) % 1 - 0.5) * 2;
      const ink = a > 0.35 + l * 0.65 || (l < 0.45 && b > 0.45 + l * 1.1);
      d[i] = ink ? 32 : 228; d[i + 1] = ink ? 27 : 218; d[i + 2] = ink ? 22 : 196;
    }
  }),
  prism: s => pixels(s, (d, w, h) => {
    const P = [[24, 30, 110], [44, 66, 178], [92, 120, 210], [235, 236, 228], [178, 44, 30], [224, 104, 40], [226, 190, 70], [44, 118, 64]];
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4, r = d[i], g = d[i + 1], b = d[i + 2];
      const l = (r * 0.3 + g * 0.59 + b * 0.11) / 255, warm = (r - b) / 255, green = (g - (r + b) / 2) / 255;
      const band = Math.sin((x + y * 0.6) / w * 9) * 0.08;               // diagonal force lines, as in Marc
      let c = l + band > 0.8 ? P[3] : warm > 0.2 && l > 0.3 ? (l > 0.55 ? P[5] : P[4]) : green > 0.06 ? (l > 0.45 ? P[6] : P[7]) : l < 0.22 ? P[0] : l < 0.42 ? P[1] : P[2];
      d[i] = clamp(c[0] * 0.75 + r * 0.25); d[i + 1] = clamp(c[1] * 0.75 + g * 0.25); d[i + 2] = clamp(c[2] * 0.75 + b * 0.25);
    }
  }),
  wash: s => pixels(s, (d, w, h) => {
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4, l = d[i] * 0.3 + d[i + 1] * 0.59 + d[i + 2] * 0.11;
      const grain = ((Math.sin(x * 12.9898 + y * 78.233) * 43758.5453) % 1) * 10;
      for (let k = 0; k < 3; k++) d[i + k] = clamp((l * 0.35 + d[i + k] * 0.65) * 0.6 + [244, 238, 224][k] * 0.45 - grain);
    }
  }),
};

export class Composer {
  constructor(canvas, { items, onChange } = {}) {
    this.cv = canvas; this.ctx = canvas.getContext('2d');
    this.items = items;                 // [{img, name, x, y, s, r, flip}] x,y in 0..1 of the picture (feet)
    this.onChange = onChange;
    this.variant = 'original';
    this.cache = {};
    this.sel = null;
    this.bindPointer();
  }

  // background: a painting, with the host painted out if it walked away
  async setBackground(work, patch) {
    const img = await loadImage(work.hd);
    const base = toCanvas(img);
    if (patch) {
      const p = await loadImage(patch.src);
      const s = base.width / work.size[0], [x0, y0, x1, y1] = patch.box;
      base.getContext('2d').drawImage(p, x0 * s, y0 * s, (x1 - x0) * s, (y1 - y0) * s);
    }
    this.work = work; this.base = base; this.cache = { original: base };
    this.resize(); this.render();
  }

  setVariant(v) {
    this.variant = v;
    if (!this.cache[v]) this.cache[v] = FX[v](this.base);
    this.render(); this.onChange?.(v);
  }
  nextVariant(step = 1) {
    const i = (VARIANTS.indexOf(this.variant) + step + VARIANTS.length) % VARIANTS.length;
    this.setVariant(VARIANTS[i]);
  }

  resize() {
    const box = this.cv.parentElement.getBoundingClientRect();
    const a = this.base.width / this.base.height;
    let w = box.width, h = w / a;
    if (h > box.height) { h = box.height; w = h * a; }
    const dpr = Math.min(2, devicePixelRatio);
    this.cv.width = Math.round(w * dpr); this.cv.height = Math.round(h * dpr);
    this.cv.style.width = w + 'px'; this.cv.style.height = h + 'px';
    this.render();
  }

  // item geometry in canvas pixels
  rect(it) {
    const W = this.cv.width, H = this.cv.height;
    const h = it.s * H, w = h * it.img.width / it.img.height;
    return { cx: it.x * W, cy: it.y * H - h / 2, w, h };
  }

  render() {
    if (!this.base) return;
    const c = this.ctx, W = this.cv.width, H = this.cv.height;
    c.drawImage(this.cache[this.variant] || this.base, 0, 0, W, H);
    for (const it of this.items) {
      const r = this.rect(it);
      // soft ground shadow
      c.save(); c.globalAlpha = 0.35; c.fillStyle = '#000';
      c.beginPath(); c.ellipse(r.cx, it.y * H, r.w * 0.42, r.h * 0.06, 0, 0, Math.PI * 2); c.fill(); c.restore();
      c.save();
      c.translate(r.cx, r.cy); c.rotate(it.r); c.scale(it.flip ? -1 : 1, 1);
      c.drawImage(it.img, -r.w / 2, -r.h / 2, r.w, r.h);
      if (it === this.sel) { c.strokeStyle = 'rgba(227,207,159,.8)'; c.setLineDash([6, 6]); c.lineWidth = 2; c.strokeRect(-r.w / 2, -r.h / 2, r.w, r.h); }
      c.restore();
    }
  }

  hit(px, py) {
    for (let i = this.items.length - 1; i >= 0; i--) {
      const it = this.items[i], r = this.rect(it);
      if (Math.abs(px - r.cx) < r.w / 2 && Math.abs(py - r.cy) < r.h / 2) return it;
    }
    return null;
  }
  toCanvasXY(clientX, clientY) {
    const b = this.cv.getBoundingClientRect();
    return [(clientX - b.left) * this.cv.width / b.width, (clientY - b.top) * this.cv.height / b.height];
  }

  bindPointer() {
    const cv = this.cv, pts = new Map();
    let drag = null, pinch0 = null;
    cv.addEventListener('pointerdown', e => {
      pts.set(e.pointerId, [e.clientX, e.clientY]);
      try { cv.setPointerCapture(e.pointerId); } catch { /* ignore */ }
      const [x, y] = this.toCanvasXY(e.clientX, e.clientY);
      const it = this.hit(x, y);
      if (pts.size === 1) { this.sel = it; drag = it ? { it, dx: it.x - x / cv.width, dy: it.y - y / cv.height } : null; }
      if (pts.size === 2 && this.sel) {
        const [a, b] = [...pts.values()];
        pinch0 = { d: Math.hypot(a[0] - b[0], a[1] - b[1]), ang: Math.atan2(b[1] - a[1], b[0] - a[0]), s: this.sel.s, r: this.sel.r };
      }
      this.render();
    });
    cv.addEventListener('pointermove', e => {
      if (!pts.has(e.pointerId)) return;
      pts.set(e.pointerId, [e.clientX, e.clientY]);
      if (pts.size === 2 && pinch0 && this.sel) {            // two fingers: scale + rotate
        const [a, b] = [...pts.values()];
        this.sel.s = Math.max(0.05, Math.min(0.9, pinch0.s * Math.hypot(a[0] - b[0], a[1] - b[1]) / pinch0.d));
        this.sel.r = pinch0.r + Math.atan2(b[1] - a[1], b[0] - a[0]) - pinch0.ang;
      } else if (drag) {
        const [x, y] = this.toCanvasXY(e.clientX, e.clientY);
        drag.it.x = Math.max(0, Math.min(1, x / cv.width + drag.dx)); drag.it.y = Math.max(0.05, Math.min(1, y / cv.height + drag.dy));
      }
      this.render();
    });
    const up = e => { pts.delete(e.pointerId); if (pts.size < 2) pinch0 = null; if (!pts.size) drag = null; };
    cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
    cv.addEventListener('wheel', e => {
      if (!this.sel) return;
      e.preventDefault();
      if (e.shiftKey) this.sel.r += e.deltaY * 0.003;
      else this.sel.s = Math.max(0.05, Math.min(0.9, this.sel.s * Math.exp(-e.deltaY * 0.0015)));
      this.render();
    }, { passive: false });
    cv.addEventListener('dblclick', e => {
      const [x, y] = this.toCanvasXY(e.clientX, e.clientY);
      const it = this.hit(x, y); if (it) { it.flip = !it.flip; this.render(); }
    });
  }

  // hands from tracking.js (screen-mirrored, 0..1 of the video). Pinch carries an animal.
  handInput(hands) {
    const b = this.cv.getBoundingClientRect();
    const pinching = hands.filter(h => h.pinch);
    const toLocal = h => [(h.pinchX * innerWidth - b.left) / b.width, (h.pinchY * innerHeight - b.top) / b.height];
    if (pinching.length === 2) {
      const [p, q] = pinching.map(toLocal);
      const d = Math.hypot(p[0] - q[0], p[1] - q[1]), ang = Math.atan2(q[1] - p[1], q[0] - p[0]);
      if (!this.handPinch2 && this.sel) this.handPinch2 = { d, ang, s: this.sel.s, r: this.sel.r };
      if (this.handPinch2 && this.sel) {
        this.sel.s = Math.max(0.05, Math.min(0.9, this.handPinch2.s * d / this.handPinch2.d));
        this.sel.r = this.handPinch2.r + ang - this.handPinch2.ang;
      }
    } else {
      this.handPinch2 = null;
      if (pinching.length === 1) {
        const [u, v] = toLocal(pinching[0]);
        if (!this.handGrab) {
          const it = this.hit(u * this.cv.width, v * this.cv.height);
          if (it) { this.sel = it; this.handGrab = { it, dx: it.x - u, dy: it.y - v }; }
        }
        if (this.handGrab) {
          this.handGrab.it.x = Math.max(0, Math.min(1, u + this.handGrab.dx));
          this.handGrab.it.y = Math.max(0.05, Math.min(1, v + this.handGrab.dy));
        }
      } else this.handGrab = null;
    }
    this.render();
  }

  toBlob() { this.sel = null; this.render(); return new Promise(r => this.cv.toBlob(r, 'image/png')); }
  toDataURL() { this.sel = null; this.render(); return this.cv.toDataURL('image/png'); }
}

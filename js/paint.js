// Painterly treatment of a transparent cut-out, tuned per painting.
// Everything runs once on a <canvas>; the result is used as the "painted" copy
// of the visitor that is visible inside the picture frame.

const clamp = v => (v < 0 ? 0 : v > 255 ? 255 : v);

export function loadImage(src) {
  return new Promise((res, rej) => {
    const im = new Image();
    im.onload = () => res(im);
    im.onerror = () => rej(new Error('image failed: ' + src));
    im.src = src;
  });
}

// Kuwahara filter: flattens texture into brush-like patches, keeps edges.
function kuwahara(src, w, h, r) {
  const out = new Uint8ClampedArray(src.length);
  const quad = [[-r, 0, -r, 0], [0, r, -r, 0], [-r, 0, 0, r], [0, r, 0, r]];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i0 = (y * w + x) * 4;
      if (src[i0 + 3] < 8) continue;
      let best = 1e9, br = 0, bg = 0, bb = 0;
      for (const [x0, x1, y0, y1] of quad) {
        let n = 0, sr = 0, sg = 0, sb = 0, sl = 0, sl2 = 0;
        for (let dy = y0; dy <= y1; dy++) {
          const yy = y + dy; if (yy < 0 || yy >= h) continue;
          for (let dx = x0; dx <= x1; dx++) {
            const xx = x + dx; if (xx < 0 || xx >= w) continue;
            const i = (yy * w + xx) * 4; if (src[i + 3] < 8) continue;
            const l = src[i] * 0.3 + src[i + 1] * 0.59 + src[i + 2] * 0.11;
            n++; sr += src[i]; sg += src[i + 1]; sb += src[i + 2]; sl += l; sl2 += l * l;
          }
        }
        if (!n) continue;
        const v = sl2 / n - (sl / n) ** 2;
        if (v < best) { best = v; br = sr / n; bg = sg / n; bb = sb / n; }
      }
      out[i0] = br; out[i0 + 1] = bg; out[i0 + 2] = bb; out[i0 + 3] = src[i0 + 3];
    }
  }
  return out;
}

// Flemish oil (Brueghel/Rubens): warm varnish glaze, softened detail, deep olive shadows.
function eden(d, w, h) {
  const k = kuwahara(d, w, h, 2);
  for (let i = 0; i < k.length; i += 4) {
    let r = k[i], g = k[i + 1], b = k[i + 2];
    const l = (r * 0.3 + g * 0.59 + b * 0.11) / 255;
    // pull saturation down a little, then glaze towards amber; shadows toward olive-brown
    const m = l * 255;
    r = m + (r - m) * 0.8; g = m + (g - m) * 0.8; b = m + (b - m) * 0.8;
    r = r * 1.04 + 10; g = g * 0.96 + 4; b = b * 0.72;
    const s = 1 - l;                               // shadow weight
    r = r * (1 - 0.25 * s) + 38 * 0.25 * s; g = g * (1 - 0.25 * s) + 34 * 0.25 * s; b = b * (1 - 0.25 * s) + 18 * 0.25 * s;
    // gentle contrast reduction (the scene sits in soft atmospheric light)
    d[i] = clamp(r * 0.88 + 14); d[i + 1] = clamp(g * 0.88 + 12); d[i + 2] = clamp(b * 0.88 + 6);
    d[i + 3] = k[i + 3];
  }
}

// Engraving (Dürer): every tone becomes line. Hatching at 45°, cross-hatch in shadows.
function durer(d, w, h) {
  const scale = Math.max(1, w / 260);              // keep line spacing proportional
  const sp = 3.2 * scale;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      if (d[i + 3] < 8) continue;
      let l = (d[i] * 0.3 + d[i + 1] * 0.59 + d[i + 2] * 0.11) / 255;
      l = Math.pow(l, 0.85);
      // distance to the nearest line in two directions (0 = on the line)
      const a = Math.abs(((x + y) / sp) % 1 - 0.5) * 2;
      const b = Math.abs(((x - y + 1000) / (sp * 1.15)) % 1 - 0.5) * 2;
      const c = Math.abs((y / (sp * 0.9)) % 1 - 0.5) * 2;
      let ink = 0;
      if (a > 0.35 + l * 0.65) ink = 1;            // primary hatch, thicker when darker
      if (l < 0.45 && b > 0.45 + l * 1.1) ink = 1; // cross-hatch
      if (l < 0.22 && c > 0.5 + l * 1.5) ink = 1;  // third layer for deep shadow
      const paper = [226, 216, 194], inkc = [30, 26, 22];
      d[i] = ink ? inkc[0] : paper[0];
      d[i + 1] = ink ? inkc[1] : paper[1];
      d[i + 2] = ink ? inkc[2] : paper[2];
    }
  }
}

// Expressionism (Marc): flattened planes re-coloured into Marc's symbolic palette.
const MARC = [
  [24, 30, 110], [44, 66, 178], [92, 120, 210], [235, 236, 228],    // blues to white
  [178, 44, 30], [224, 104, 40], [226, 190, 70], [44, 118, 64],     // red, orange, yellow, green
];
function marc(d, w, h) {
  const k = kuwahara(d, w, h, 3);
  for (let i = 0; i < k.length; i += 4) {
    const r = k[i], g = k[i + 1], b = k[i + 2];
    const l = (r * 0.3 + g * 0.59 + b * 0.11) / 255;
    const warm = (r - b) / 255;                     // warm fur → red/orange planes
    let c;
    if (l > 0.78) c = MARC[3];
    else if (warm > 0.28 && l > 0.32) c = l > 0.55 ? MARC[5] : MARC[4];
    else if (l < 0.22) c = MARC[0];
    else if (l < 0.42) c = MARC[1];
    else c = MARC[2];
    // keep a trace of the original modelling so the form still reads
    d[i] = clamp(c[0] * 0.8 + r * 0.2); d[i + 1] = clamp(c[1] * 0.8 + g * 0.2); d[i + 2] = clamp(c[2] * 0.8 + b * 0.2);
    d[i + 3] = k[i + 3];
  }
}

const STYLES = { eden, durer, marc };

// Returns a data URL of the painted cut-out. `maxW` keeps the filter fast.
export async function paintify(src, style, maxW = 360) {
  const im = await loadImage(src);
  const s = Math.min(1, maxW / im.naturalWidth);
  const w = Math.round(im.naturalWidth * s), h = Math.round(im.naturalHeight * s);
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  const ctx = cv.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(im, 0, 0, w, h);
  const img = ctx.getImageData(0, 0, w, h);
  STYLES[style](img.data, w, h);
  ctx.putImageData(img, 0, 0);
  return cv.toDataURL('image/png');
}

// Automatic 2D "rig" for any side-view silhouette (photo cut-out, storybook
// illustration or a visitor's own drawing). It finds where the legs are so the
// walk shader can swing them; animals without visible legs hop or waddle.
//
// Returned values are in texture space (u: 0 left → 1 right, v: 0 bottom → 1 top):
//   { type: 'walk' | 'hop', pivotV, groundV, legs: [{u0, u1}], headU }

export function alphaGrid(img, size = 128) {
  const s = size / Math.max(img.width, img.height);
  const w = Math.max(8, Math.round(img.width * s)), h = Math.max(8, Math.round(img.height * s));
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  const ctx = cv.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(img, 0, 0, w, h);
  const d = ctx.getImageData(0, 0, w, h).data;
  const a = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) a[i] = d[i * 4 + 3] > 100 ? 1 : 0;
  return { a, w, h };
}

// opaque runs [x0, x1] in one row, ignoring tiny specks
function runs(g, y, minLen = 2) {
  const out = []; let start = -1;
  for (let x = 0; x <= g.w; x++) {
    const on = x < g.w && g.a[y * g.w + x];
    if (on && start < 0) start = x;
    if (!on && start >= 0) { if (x - start >= minLen) out.push([start, x - 1]); start = -1; }
  }
  return out;
}

export function autoRig(img, headSide = 'right') {
  const g = alphaGrid(img);
  let top = -1, bottom = -1;
  for (let y = 0; y < g.h; y++) if (runs(g, y).length) { if (top < 0) top = y; bottom = y; }
  if (top < 0) return { type: 'hop', pivotV: 0.5, groundV: 0, legs: [], headU: headSide === 'right' ? 0.85 : 0.15 };
  const H = bottom - top + 1;

  // belly line: highest row (from the ground up) that still shows a gap between legs
  // (paws often touch at ground level, so tolerate merged rows at the bottom)
  let belly = bottom, seen = false, miss = 0;
  for (let y = bottom; y > top + H * 0.25; y--) {
    const r = runs(g, y);
    const gapped = r.length >= 2 && (r[r.length - 1][0] - r[0][1]) > g.w * 0.06;
    if (gapped) { belly = y; seen = true; miss = 0; }
    else if (seen) { if (++miss > 3) break; }
    else if (bottom - y > H * 0.2) break;
  }
  const legH = bottom - belly;
  const toV = y => 1 - (y + 0.5) / g.h;
  const headU = headSide === 'right' ? 0.85 : 0.15;
  if (legH < H * 0.12) return { type: 'hop', pivotV: toV(top + H * 0.6), groundV: toV(bottom), legs: [], headU };

  // feet: runs just above the ground, split into a front and a hind group at the widest gap
  const fy = Math.round(bottom - legH * 0.25);
  const r = runs(g, fy, 1);
  let split = 0, widest = -1;
  for (let i = 0; i < r.length - 1; i++) {
    const gap = r[i + 1][0] - r[i][1];
    if (gap > widest) { widest = gap; split = i; }
  }
  const groups = r.length >= 2 ? [r.slice(0, split + 1), r.slice(split + 1)] : [r];
  const pad = g.w * 0.03;
  const legs = groups.map(grp => ({
    u0: Math.max(0, (grp[0][0] - pad) / g.w),
    u1: Math.min(1, (grp[grp.length - 1][1] + 1 + pad) / g.w),
  }));
  return { type: 'walk', pivotV: toV(belly - legH * 0.15), groundV: toV(bottom), legs, headU };
}

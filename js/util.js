// Small shared helpers.
// separable box blur of the alpha channel (works everywhere, unlike ctx.filter)
export function boxBlurAlpha(rgba, w, h, r) {
  let a = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) a[i] = rgba[i * 4 + 3];
  for (let pass = 0; pass < 2; pass++) {
    const b = new Float32Array(w * h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      let s = 0, n = 0;
      for (let k = -r; k <= r; k++) {
        const xx = pass ? x : x + k, yy = pass ? y + k : y;
        if (xx >= 0 && yy >= 0 && xx < w && yy < h) { s += a[yy * w + xx]; n++; }
      }
      b[y * w + x] = s / n;
    }
    a = b;
  }
  const out = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < w * h; i++) out[i * 4 + 3] = a[i];
  return out;
}

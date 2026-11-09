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

// Lines of text that fit maxW on a canvas. Latin and Korean break at spaces; Chinese (and
// Japanese) characters may break anywhere, as they do in print. Punctuation that must not
// start a line stays with the character before it.
const HAN = /[⺀-鿿豈-﫿　-〿＀-￯]/;
const NO_START = /^[，。、；：！？）」』”’》〉…,.;:!?)]$/;
export function wrapLines(ctx, text, maxW) {
  const tokens = [];
  for (const part of String(text).split(/(\s+)/)) {
    if (!part) continue;
    if (/^\s+$/.test(part)) { tokens.push(' '); continue; }
    let buf = '';
    for (const ch of part) {
      if (HAN.test(ch)) {
        if (buf) { tokens.push(buf); buf = ''; }
        if (NO_START.test(ch) && tokens.length && tokens[tokens.length - 1] !== ' ') tokens[tokens.length - 1] += ch;
        else tokens.push(ch);
      } else buf += ch;
    }
    if (buf) tokens.push(buf);
  }
  const lines = []; let line = '';
  for (const tk of tokens) {
    if (tk === ' ') { if (line) line += ' '; continue; }
    const test = line + tk;
    if (ctx.measureText(test.trimEnd()).width > maxW && line.trim()) { lines.push(line.trimEnd()); line = tk; }
    else line = test;
  }
  if (line.trim()) lines.push(line.trimEnd());
  return lines;
}
// canvas font stacks with CJK faces after the Latin ones (the browser picks per glyph)
export const CANVAS_SERIF = '"Cormorant Garamond", "Songti SC", "Noto Serif SC", "AppleMyungjo", "Noto Serif KR", Georgia, serif';
export const CANVAS_SANS = 'Inter, "PingFang SC", "Noto Sans SC", "Apple SD Gothic Neo", "Noto Sans KR", system-ui, sans-serif';

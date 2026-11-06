// Sketch pad + in-browser sketch recognition with DoodleNet (TensorFlow.js).
// Library and model are vendored: vendor/tfjs-4.22.0, vendor/doodlenet.
// Preprocessing follows ml5@0.12.2's DoodleNet code exactly (invert, resize to
// 28x28, average RGB, floor). One addition: the drawing is first cropped to its
// bounding box, because QuickDraw drawings fill their frame.

const SIZE = 280;          // internal canvas size (the ml5 examples use 280 px)
const LINE = 13;           // stroke width; thick strokes survive the floor() step
let loading = null;
let model = null;

function loadScript(src) {
  return new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = src; s.onload = res; s.onerror = () => rej(new Error('script failed: ' + src));
    document.head.appendChild(s);
  });
}

// Loads tf.js + DoodleNet once. Resolves to true, or rejects if unavailable.
export function loadClassifier() {
  if (!loading) {
    loading = (async () => {
      if (!window.tf) await loadScript('vendor/tfjs-4.22.0/tf.min.js');
      if (!window.DOODLENET_CLASSES) await loadScript('vendor/doodlenet/classes.js');
      model = await window.tf.loadLayersModel('vendor/doodlenet/model.json');
      window.tf.tidy(() => model.predict(window.tf.zeros([1, 28, 28, 1])));   // warm-up
      return true;
    })();
    loading.catch(() => { loading = null; });
  }
  return loading;
}

export function createPad(canvas) {
  canvas.width = SIZE; canvas.height = SIZE;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const clear = () => { ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, SIZE, SIZE); strokes = 0; };
  let drawing = false, last = null, strokes = 0;
  clear();
  const pos = e => {
    const r = canvas.getBoundingClientRect();
    return [(e.clientX - r.left) * SIZE / r.width, (e.clientY - r.top) * SIZE / r.height];
  };
  canvas.addEventListener('pointerdown', e => {
    drawing = true; last = pos(e); strokes++;
    try { canvas.setPointerCapture(e.pointerId); } catch { /* ignore */ }
    ctx.fillStyle = '#000'; ctx.beginPath(); ctx.arc(last[0], last[1], LINE / 2, 0, Math.PI * 2); ctx.fill();
  });
  canvas.addEventListener('pointermove', e => {
    if (!drawing) return;
    const p = pos(e);
    ctx.strokeStyle = '#000'; ctx.lineWidth = LINE; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath(); ctx.moveTo(last[0], last[1]); ctx.lineTo(p[0], p[1]); ctx.stroke();
    last = p;
  });
  const end = () => { drawing = false; };
  canvas.addEventListener('pointerup', end);
  canvas.addEventListener('pointercancel', end);
  return { clear, isEmpty: () => strokes === 0, canvas };
}

// Crop to the ink's bounding box (square, with margin) on a fresh 280px canvas.
function cropToInk(src) {
  const ctx = src.getContext('2d', { willReadFrequently: true });
  const d = ctx.getImageData(0, 0, SIZE, SIZE).data;
  let x0 = SIZE, y0 = SIZE, x1 = -1, y1 = -1;
  for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) {
    if (d[(y * SIZE + x) * 4] < 128) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  }
  if (x1 < 0) return null;
  const side = Math.max(x1 - x0, y1 - y0) * 1.15 + LINE;
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
  const out = document.createElement('canvas'); out.width = SIZE; out.height = SIZE;
  const o = out.getContext('2d');
  o.fillStyle = '#fff'; o.fillRect(0, 0, SIZE, SIZE);
  o.drawImage(src, cx - side / 2, cy - side / 2, side, side, 0, 0, SIZE, SIZE);
  return out;
}

// Returns [{label, p}] for all 345 classes, sorted by probability.
export async function classify(canvas) {
  const tf = window.tf;
  const img = cropToInk(canvas);
  if (!img) return null;
  const probs = tf.tidy(() => {
    const t = tf.browser.fromPixels(img);
    const norm = tf.scalar(1).sub(t.toFloat().div(tf.scalar(255)));
    const resized = tf.image.resizeBilinear(norm, [28, 28]);
    const [r, g, b] = tf.split(resized, 3, 2);
    const gray = r.add(g).add(b).div(tf.scalar(3)).floor();
    return model.predict(gray.reshape([1, 28, 28, 1])).dataSync();
  });
  return Array.from(probs, (p, i) => ({ label: window.DOODLENET_CLASSES[i], p }))
    .sort((a, b) => b.p - a.p);
}

// Archive species score = sum of the classifier's probabilities for the
// drawing classes mapped to that species (see SPECIES[].doodle in data.js).
export function matchSpecies(ranked, species) {
  const byLabel = Object.fromEntries(ranked.map(r => [r.label, r.p]));
  const scored = species.map(s => {
    const parts = s.doodle.map(c => ({ c, p: byLabel[c] || 0 })).sort((a, b) => b.p - a.p);
    return { species: s, score: parts.reduce((a, b) => a + b.p, 0), via: parts[0].c };
  }).sort((a, b) => b.score - a.score);
  return scored;
}

// ---------------------------------------------------------------------------
// Turn a drawing into a storybook character: keep the visitor's own ink lines,
// fill the inside of the outline with a watercolour wash, cut it out.
// colour: CSS colour of the wash. Returns a canvas with a transparent background.
export function drawingToCharacter(src, colour = '#c98a4b') {
  const S = SIZE;
  const ctx = src.getContext('2d', { willReadFrequently: true });
  const d = ctx.getImageData(0, 0, S, S).data;
  const ink = new Uint8Array(S * S);
  for (let i = 0; i < S * S; i++) ink[i] = d[i * 4] < 140 ? 1 : 0;
  // close small gaps in the outline (dilate 3 px) before finding the inside
  const wall = new Uint8Array(S * S);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    if (!ink[y * S + x]) continue;
    for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) {
      const xx = x + dx, yy = y + dy;
      if (xx >= 0 && yy >= 0 && xx < S && yy < S) wall[yy * S + xx] = 1;
    }
  }
  // flood the outside from the border; everything not reached is the body
  const outside = new Uint8Array(S * S), stack = [];
  for (let i = 0; i < S; i++) stack.push(i, (S - 1) * S + i, i * S, i * S + S - 1);
  while (stack.length) {
    const p = stack.pop();
    if (outside[p] || wall[p]) continue;
    outside[p] = 1;
    const x = p % S, y = (p / S) | 0;
    if (x > 0) stack.push(p - 1); if (x < S - 1) stack.push(p + 1);
    if (y > 0) stack.push(p - S); if (y < S - 1) stack.push(p + S);
  }
  let body = 0;
  for (let i = 0; i < S * S; i++) if (!outside[i]) body++;
  const filled = body > S * S * 0.02;               // an open scribble gets no wash, only thick ink

  const out = document.createElement('canvas'); out.width = S; out.height = S;
  const o = out.getContext('2d');
  const img = o.createImageData(S, S);
  const c = parseColour(colour);
  // distance to the edge (cheap: count outside pixels nearby) → pigment pools at the rim
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const i = y * S + x, k = i * 4;
    if (ink[i]) { img.data.set([52, 40, 32, 255], k); continue; }
    if (!filled || outside[i]) continue;
    let near = 0;
    for (let r = 2; r <= 8; r += 3) {
      if (x - r < 0 || outside[i - r] || x + r >= S || outside[i + r] || y - r < 0 || outside[i - r * S] || y + r >= S || outside[i + r * S]) { near = 1 - (r - 2) / 9; break; }
    }
    const grain = (Math.sin(x * 12.9898 + y * 78.233) * 43758.5453) % 1 * 0.06;
    const wet = Math.sin(x * 0.07 + y * 0.05) * 0.05 + Math.sin(x * 0.021 - y * 0.033) * 0.06;
    const shade = 1 - near * 0.22 - wet - grain;
    img.data.set([c[0] * shade, c[1] * shade, c[2] * shade, 235], k);
  }
  o.putImageData(img, 0, 0);
  // crop to the character
  let x0 = S, y0 = S, x1 = 0, y1 = 0;
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) if (img.data[(y * S + x) * 4 + 3]) {
    x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
  }
  if (x1 <= x0) return null;
  const crop = document.createElement('canvas');
  crop.width = (x1 - x0 + 7) * 2; crop.height = (y1 - y0 + 7) * 2;    // 2× for a crisper texture
  const cc = crop.getContext('2d');
  cc.imageSmoothingQuality = 'high';
  cc.drawImage(out, x0 - 3, y0 - 3, x1 - x0 + 7, y1 - y0 + 7, 0, 0, crop.width, crop.height);
  return crop;
}

function parseColour(css) {
  const c = document.createElement('canvas').getContext('2d');
  c.fillStyle = css; const v = c.fillStyle;            // normalises to #rrggbb
  return [1, 3, 5].map(i => parseInt(v.slice(i, i + 2), 16));
}

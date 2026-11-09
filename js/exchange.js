// What the two worlds tell each other, and the pieces the finale is made of.
//
// Every answer in the conversation is tagged with the things it talks about. Things
// from the real world (a bowl, the rain, a sofa) are drawn here in ink on paper; things
// from inside the picture (the snake, Death's hourglass, the falling trees) are torn
// out of the painting itself. The collage and the monument are built only from what
// was actually said on this visit, so no two finales are the same.

import { loadImage } from './paint.js';
import { wrapLines } from './util.js';

// ---- which things each line talks about --------------------------------------------
// keys are string paths in strings.js (array index last)
export const TAGS = {
  // the visitor's life, by kind: [where it lives, eating and sleeping]
  'life.fox': [['house', 'moon'], ['den']],
  'life.dog': [['sofa', 'tree'], ['bowl', 'basket']],
  'life.deer': [['tree', 'leaf'], ['grass', 'sun']],
  'life.horse': [['grass', 'rain'], ['apple', 'grass']],
  'life.cat': [['window', 'house'], ['bowl', 'basket']],
  'life.rabbit': [['den', 'grass'], ['grass', 'moon']],
  'life.cattle': [['house', 'grass'], ['grass']],
  'life.alpaca': [['grass', 'wind'], ['paws']],
  'life.donkey': [['house', 'paws'], ['grass', 'sun']],
  'life.zebra': [['grass', 'sun'], ['paws', 'moon']],
  'life.bear': [['tree', 'fish'], ['den', 'snow']],
  'life.wolf': [['moon', 'paws'], ['snow']],
  'life.lion': [['tree', 'sun'], ['moon']],
  'life.tiger': [['tree', 'fish'], ['leaf']],
  'life.squirrel': [['tree', 'acorn'], ['acorn']],
  'life.hedgehog': [['house', 'moon'], ['snow', 'leaf']],
  'life.bird': [['house', 'moon'], ['moon']],
  'life.drawing': [['pencil'], ['pencil', 'eraser']],
  'answerVisitor.wild': [['paws', 'grass'], ['berries', 'leaf'], ['den', 'leaf'], ['rain', 'wind'], ['car'], ['moon', 'tree'], ['paws'], ['snow', 'tree']],
  'answerVisitor.home': [['ball', 'sofa'], ['bowl'], ['basket'], ['rain', 'sun'], ['thunder'], ['house', 'moon'], ['paws'], ['door']],
  'answerVisitor.drawing': [['pencil'], ['pencil'], ['moon'], ['rain'], ['eraser'], ['moon'], ['pencil'], ['door']],
  // the painted animals' lives: [its life, what it does all day]
  'hostLife.eden-lion': [['eden-lion', 'eden-light'], ['eden-apple']],
  'hostLife.eden-horse': [['eden-whitehorse', 'eden-light'], ['eden-whitehorse']],
  'hostLife.eden-deer': [['eden-stag'], ['eden-parrots']],
  'hostLife.eden-rabbit': [['eden-rabbit'], ['eden-rabbit']],
  'hostLife.eden-dog': [['eden-dog'], ['eden-dog']],
  'hostLife.eden-peacock': [['eden-peacock'], ['eden-peacock']],
  'hostLife.hicks-lion': [['hicks-lionface'], ['hicks-lionface']],
  'hostLife.hicks-cub': [['hicks-bearcorn'], ['hicks-children']],
  'hostLife.hicks-calf': [['hicks-lionface'], ['hicks-children']],
  'hostLife.hicks-goat': [['hicks-leopards'], ['hicks-treaty', 'hicks-river']],
  'hostLife.hicks-leopard': [['hicks-children', 'hicks-leopards'], ['hicks-leopards']],
  'hostLife.marc-deer': [['marc-deer'], ['marc-light', 'marc-beams']],
  'hostLife.marc-boar': [['marc-boars'], ['marc-beams']],
  'answerHost.eden': [['eden-rabbit', 'eden-dog'], ['eden-apple'], ['eden-light'], ['eden-light'], ['eden-snake'], ['eden-parrots'], ['eden-rabbit'], ['eden-light']],
  'answerHost.hicks': [['hicks-children'], ['hicks-bearcorn'], ['hicks-wolflamb'], ['hicks-tree', 'hicks-river'], ['hicks-wolflamb'], ['hicks-oxface'], ['hicks-treaty'], ['hicks-lionface']],
  'answerHost.marc': [['marc-light'], ['marc-storm'], ['marc-beams'], ['marc-storm'], ['marc-beams'], ['marc-light'], ['marc-deer'], ['marc-klee']],
};
export const tagsOf = path => {
  const i = path.lastIndexOf('.');
  return TAGS[path.slice(0, i)]?.[+path.slice(i + 1)] || [];
};

// ---- the painted world: fragments torn out of the paintings (HD pixel boxes) -------
export const FRAGMENTS = {
  'eden-snake': { work: 'eden', box: [380, 150, 800, 420] },
  'eden-apple': { work: 'eden', box: [700, 360, 940, 560] },
  'eden-parrots': { work: 'eden', box: [1180, 300, 1430, 590] },
  'eden-light': { work: 'eden', box: [1010, 220, 1330, 470] },
  'eden-rabbit': { work: 'eden', box: [585, 1300, 735, 1450] },
  'eden-dog': { work: 'eden', box: [690, 1210, 830, 1370] },
  'eden-peacock': { work: 'eden', box: [800, 1050, 1210, 1550] },
  'eden-lion': { work: 'eden', box: [1740, 880, 1930, 1070] },
  'eden-whitehorse': { work: 'eden', box: [1290, 780, 1430, 930] },
  'eden-stag': { work: 'eden', box: [1380, 790, 1520, 970] },
  'hicks-treaty': { work: 'hicks', box: [0, 1010, 640, 1290] },
  'hicks-river': { work: 'hicks', box: [250, 700, 860, 1060] },
  'hicks-children': { work: 'hicks', box: [840, 1580, 1600, 2002] },
  'hicks-lionface': { work: 'hicks', box: [1430, 700, 1770, 1080] },
  'hicks-oxface': { work: 'hicks', box: [880, 840, 1250, 1200] },
  'hicks-leopards': { work: 'hicks', box: [1520, 1330, 1960, 1810] },
  'hicks-tree': { work: 'hicks', box: [0, 0, 520, 640] },
  'hicks-bearcorn': { work: 'hicks', box: [1880, 1580, 2240, 1960] },
  'hicks-wolflamb': { work: 'hicks', box: [1880, 880, 2260, 1320] },
  'marc-beams': { work: 'marc', box: [1020, 70, 1700, 770] },
  'marc-deer': { work: 'marc', box: [990, 700, 1415, 1530] },
  'marc-boars': { work: 'marc', box: [100, 1160, 750, 1600] },
  'marc-light': { work: 'marc', box: [1295, 900, 1680, 1200] },
  'marc-storm': { work: 'marc', box: [34, 34, 715, 510] },
  'marc-klee': { work: 'marc', box: [1700, 340, 2370, 1190] },
};
export const isPainted = id => !!FRAGMENTS[id];

// ---- the real world: drawn in ink, the way a field notebook would ------------------
// each draws into a 200 × 200 box; `solid` ones also make good little statues
const INK = '#2a231b', PAPER = '#f4ecdb';
const ICONS = {
  sofa: { solid: true, draw(c) {
    shape(c, () => { rr(c, 42, 66, 116, 54, 14); }, true);
    shape(c, () => { rr(c, 26, 100, 34, 52, 12); rr(c, 140, 100, 34, 52, 12); }, true);
    shape(c, () => { rr(c, 52, 112, 96, 34, 8); }, true);
    line(c, [[100, 114], [100, 144]]);
    line(c, [[36, 152], [36, 166]]); line(c, [[164, 152], [164, 166]]);
    hatch(c, 46, 70, 108, 40, 9, 0.6);
  } },
  bowl: { solid: true, draw(c) {
    for (let i = 0; i < 9; i++) { c.beginPath(); c.arc(64 + i * 9 + (i % 2) * 3, 98 - (i % 3) * 5, 7, 0, 7); c.fillStyle = '#8a6a44'; c.fill(); c.stroke(); }
    shape(c, () => { c.moveTo(36, 104); c.bezierCurveTo(44, 170, 156, 170, 164, 104); c.closePath(); }, true);
    c.beginPath(); c.ellipse(100, 104, 64, 13, 0, 0, 7); c.stroke();
    hatch(c, 50, 120, 100, 30, 8, 0.5);
    c.font = 'italic 400 19px "Cormorant Garamond", "Songti SC", "Noto Serif SC", "AppleMyungjo", "Noto Serif KR", Georgia, serif'; c.fillStyle = INK; c.textAlign = 'center'; c.fillText('★', 100, 146);
  } },
  ball: { solid: true, draw(c) {
    shape(c, () => c.arc(100, 108, 50, 0, 7), true, '#e6d28a');
    c.beginPath(); c.arc(42, 108, 42, -0.9, 0.9); c.stroke();
    c.beginPath(); c.arc(158, 108, 42, Math.PI - 0.9, Math.PI + 0.9); c.stroke();
    hatch(c, 110, 120, 34, 30, 7, 0.7);
  } },
  basket: { solid: true, draw(c) {
    shape(c, () => { c.moveTo(28, 96); c.lineTo(46, 158); c.lineTo(154, 158); c.lineTo(172, 96); c.closePath(); }, true, '#d9b77e');
    for (let x = 40; x < 170; x += 14) line(c, [[x, 100], [100 + (x - 100) * 0.8, 156]]);
    for (let y = 112; y < 156; y += 12) line(c, [[30 + (y - 96) * 0.28, y], [170 - (y - 96) * 0.28, y]]);
    shape(c, () => c.ellipse(100, 96, 72, 16, 0, 0, 7), true, '#e9d7b4');
    shape(c, () => c.ellipse(100, 92, 52, 12, 0, Math.PI, 0), true, '#c9a7a0');
  } },
  window: { solid: true, draw(c) {
    shape(c, () => rr(c, 52, 32, 96, 120, 4), true, '#dfe6ea');
    line(c, [[100, 32], [100, 152]]); line(c, [[52, 92], [148, 92]]);
    hatch(c, 56, 36, 40, 52, 10, 0.35);
    line(c, [[40, 156], [160, 156]]); line(c, [[40, 164], [160, 164]]);
    // a pigeon on the sill
    shape(c, () => { c.ellipse(132, 144, 15, 9, -0.2, 0, 7); }, true, '#b9b9c0');
    shape(c, () => c.arc(145, 134, 6, 0, 7), true, '#b9b9c0');
    line(c, [[118, 146], [108, 150]]);
  } },
  house: { solid: true, draw(c) {
    shape(c, () => { c.moveTo(40, 92); c.lineTo(100, 42); c.lineTo(160, 92); c.lineTo(160, 162); c.lineTo(40, 162); c.closePath(); }, true);
    shape(c, () => rr(c, 128, 46, 14, 30, 2), true);
    shape(c, () => rr(c, 88, 118, 26, 44, 3), true, '#c69b6d');
    shape(c, () => rr(c, 54, 104, 22, 22, 2), true, '#f2d58a');
    shape(c, () => rr(c, 126, 104, 22, 22, 2), true, '#f2d58a');
    hatch(c, 46, 60, 108, 30, 9, 0.5);
  } },
  door: { solid: true, draw(c) {
    shape(c, () => rr(c, 60, 34, 80, 132, 3), true, '#3a2f25');
    shape(c, () => { c.moveTo(60, 34); c.lineTo(104, 46); c.lineTo(104, 176); c.lineTo(60, 166); c.closePath(); }, true, '#b58a5c');
    c.beginPath(); c.arc(96, 110, 3, 0, 7); c.fillStyle = INK; c.fill();
    c.strokeStyle = '#e8c76f'; for (let i = 0; i < 5; i++) line(c, [[112 + i * 6, 168], [128 + i * 16, 190]]); c.strokeStyle = INK;
  } },
  car: { solid: true, draw(c) {
    shape(c, () => { c.moveTo(22, 136); c.lineTo(26, 112); c.lineTo(62, 104); c.lineTo(82, 78); c.lineTo(138, 78); c.lineTo(160, 104); c.lineTo(180, 110); c.lineTo(180, 136); c.closePath(); }, true, '#c25b3f');
    shape(c, () => { c.moveTo(72, 104); c.lineTo(88, 86); c.lineTo(106, 86); c.lineTo(106, 104); c.closePath(); c.moveTo(114, 104); c.lineTo(114, 86); c.lineTo(134, 86); c.lineTo(148, 104); c.closePath(); }, true, '#dfe6ea');
    for (const x of [58, 146]) { shape(c, () => c.arc(x, 138, 17, 0, 7), true, '#3a332b'); shape(c, () => c.arc(x, 138, 6, 0, 7), true); }
    line(c, [[10, 160], [192, 160]]);
  } },
  tree: { solid: true, draw(c) {
    shape(c, () => { c.moveTo(90, 168); c.lineTo(94, 112); c.lineTo(106, 112); c.lineTo(110, 168); c.closePath(); }, true, '#8a6a44');
    blob(c, [[70, 92, 30], [100, 70, 36], [132, 92, 30], [100, 104, 30], [80, 64, 22], [122, 62, 22]], '#7d9a5a');
    hatch(c, 72, 84, 66, 36, 8, 0.5);
    line(c, [[40, 168], [160, 168]]);
  } },
  acorn: { solid: true, draw(c) {
    shape(c, () => c.ellipse(100, 122, 32, 40, 0, 0, 7), true, '#c08a4a');
    shape(c, () => { c.moveTo(62, 104); c.bezierCurveTo(64, 64, 136, 64, 138, 104); c.closePath(); }, true, '#7a5a38');
    for (const [y, x0, x1] of [[96, 68, 132], [84, 76, 124]]) for (let x = x0; x < x1; x += 10) { c.beginPath(); c.arc(x + 5, y, 5, Math.PI, 0); c.stroke(); }
    line(c, [[100, 66], [104, 50]]);
  } },
  leaf: { solid: true, draw(c) {
    shape(c, () => { c.moveTo(40, 160); c.bezierCurveTo(40, 80, 110, 40, 166, 36); c.bezierCurveTo(160, 100, 120, 160, 40, 160); }, true, '#c97a3a');
    line(c, [[40, 160], [150, 50]]);
    for (let k = 0.25; k < 0.9; k += 0.15) { const x = 40 + 110 * k, y = 160 - 110 * k; line(c, [[x, y], [x + 26, y + 8]]); line(c, [[x, y], [x - 8, y - 26]]); }
  } },
  berries: { solid: true, draw(c) {
    line(c, [[100, 40], [100, 80]]); line(c, [[100, 80], [70, 110]]); line(c, [[100, 80], [130, 108]]); line(c, [[100, 80], [100, 120]]);
    for (const [x, y] of [[66, 120], [134, 118], [100, 132], [84, 146], [118, 148]]) { shape(c, () => c.arc(x, y, 15, 0, 7), true, '#8c2f3c'); c.beginPath(); c.arc(x - 5, y - 5, 3, 0, 7); c.fillStyle = '#f4ecdb'; c.fill(); }
    shape(c, () => { c.moveTo(100, 56); c.quadraticCurveTo(130, 36, 150, 50); c.quadraticCurveTo(126, 70, 100, 56); }, true, '#7d9a5a');
  } },
  apple: { solid: true, draw(c) {
    shape(c, () => { c.moveTo(100, 72); c.bezierCurveTo(60, 50, 30, 100, 54, 140); c.bezierCurveTo(70, 168, 92, 162, 100, 156); c.bezierCurveTo(108, 162, 130, 168, 146, 140); c.bezierCurveTo(170, 100, 140, 50, 100, 72); }, true, '#c94a35');
    line(c, [[100, 74], [104, 46]]);
    shape(c, () => { c.moveTo(104, 56); c.quadraticCurveTo(126, 34, 146, 44); c.quadraticCurveTo(128, 64, 104, 56); }, true, '#7d9a5a');
    hatch(c, 112, 96, 30, 50, 7, 0.6);
  } },
  grass: { draw(c) {
    line(c, [[16, 164], [184, 164]]);
    for (let i = 0; i < 26; i++) { const x = 20 + i * 6.4, h = 40 + ((i * 37) % 50), lean = ((i * 13) % 9) - 4; c.beginPath(); c.moveTo(x, 164); c.quadraticCurveTo(x + lean, 164 - h * 0.6, x + lean * 3, 164 - h); c.stroke(); }
  } },
  fish: { solid: true, draw(c) {
    shape(c, () => { c.moveTo(30, 100); c.bezierCurveTo(60, 56, 120, 60, 146, 100); c.bezierCurveTo(120, 140, 60, 144, 30, 100); c.moveTo(146, 100); c.lineTo(178, 74); c.lineTo(172, 100); c.lineTo(178, 126); c.closePath(); }, true, '#c98b7a');
    c.beginPath(); c.arc(54, 94, 4, 0, 7); c.fillStyle = INK; c.fill();
    c.beginPath(); c.arc(70, 100, 16, -1, 1); c.stroke();
    for (let x = 84; x < 136; x += 12) { c.beginPath(); c.arc(x, 100, 8, -1.2, 1.2); c.stroke(); }
    for (const y of [158, 172]) { c.beginPath(); for (let x = 20; x <= 180; x += 4) c.lineTo(x, y + Math.sin(x / 9) * 4); c.stroke(); }
  } },
  rain: { draw(c) {
    cloud(c, 100, 76, '#cfd6dc');
    for (let i = 0; i < 9; i++) { const x = 52 + i * 12, y = 116 + (i % 3) * 14; line(c, [[x, y], [x - 7, y + 20]]); }
  } },
  sun: { solid: true, draw(c) {
    shape(c, () => c.arc(100, 100, 34, 0, 7), true, '#efc75e');
    for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; line(c, [[100 + Math.cos(a) * 46, 100 + Math.sin(a) * 46], [100 + Math.cos(a) * (i % 2 ? 62 : 72), 100 + Math.sin(a) * (i % 2 ? 62 : 72)]]); }
  } },
  moon: { solid: true, draw(c) {
    shape(c, () => { c.arc(100, 100, 52, Math.PI * 0.35, Math.PI * 1.65); c.bezierCurveTo(70, 50, 70, 150, 100 + 52 * Math.cos(Math.PI * 0.35), 100 + 52 * Math.sin(Math.PI * 0.35)); }, true, '#efe1a6');
    for (const [x, y] of [[150, 52], [164, 112], [136, 150]]) { line(c, [[x - 7, y], [x + 7, y]]); line(c, [[x, y - 7], [x, y + 7]]); }
  } },
  snow: { draw(c) {
    for (let a = 0; a < 6; a++) {
      const ca = Math.cos(a * Math.PI / 3), sa = Math.sin(a * Math.PI / 3);
      const P = (r, o = 0) => [100 + ca * r - sa * o, 100 + sa * r + ca * o];
      line(c, [P(0), P(62)]); line(c, [P(30), P(44, 14)]); line(c, [P(30), P(44, -14)]); line(c, [P(48), P(58, 9)]); line(c, [P(48), P(58, -9)]);
    }
    for (const [x, y] of [[30, 40], [168, 36], [26, 160], [172, 168], [150, 150]]) { c.beginPath(); c.arc(x, y, 3, 0, 7); c.fillStyle = INK; c.fill(); }
  } },
  thunder: { draw(c) {
    cloud(c, 100, 72, '#9ea7b0');
    shape(c, () => { c.moveTo(104, 104); c.lineTo(84, 142); c.lineTo(102, 142); c.lineTo(90, 182); c.lineTo(126, 130); c.lineTo(108, 130); c.lineTo(120, 104); c.closePath(); }, true, '#efc75e');
  } },
  wind: { draw(c) {
    for (const [y, l] of [[70, 120], [104, 140], [138, 100]]) {
      c.beginPath(); c.moveTo(30, y); c.lineTo(30 + l, y); c.arc(30 + l, y - 14, 14, Math.PI / 2, -Math.PI * 0.9, true); c.stroke();
    }
  } },
  paws: { draw(c) {
    for (const [x, y, r] of [[60, 150, -0.3], [96, 112, -0.3], [128, 76, -0.3], [158, 40, -0.3]]) {
      c.save(); c.translate(x, y); c.rotate(r); c.fillStyle = INK;
      c.beginPath(); c.ellipse(0, 6, 11, 9, 0, 0, 7); c.fill();
      for (const [dx, dy] of [[-12, -8], [-4, -14], [5, -14], [13, -8]]) { c.beginPath(); c.ellipse(dx, dy, 4, 5, 0, 0, 7); c.fill(); }
      c.restore();
    }
  } },
  pencil: { solid: true, draw(c) {
    c.save(); c.translate(100, 100); c.rotate(-0.7);
    shape(c, () => { c.moveTo(-74, -12); c.lineTo(46, -12); c.lineTo(74, 0); c.lineTo(46, 12); c.lineTo(-74, 12); c.closePath(); }, true, '#e2b64b');
    shape(c, () => { c.moveTo(46, -12); c.lineTo(74, 0); c.lineTo(46, 12); c.closePath(); }, true, '#e8cfa4');
    shape(c, () => { c.moveTo(64, -4); c.lineTo(74, 0); c.lineTo(64, 4); c.closePath(); }, true, INK);
    shape(c, () => rr(c, -90, -12, 16, 24, 3), true, '#d48a8a');
    line(c, [[-74, 0], [46, 0]]);
    c.restore();
  } },
  eraser: { solid: true, draw(c) {
    c.save(); c.translate(100, 104); c.rotate(-0.25);
    shape(c, () => rr(c, -62, -26, 124, 52, 8), true, '#e8a3a3');
    shape(c, () => rr(c, -10, -26, 44, 52, 2), true, '#5a7fa6');
    c.restore();
    for (const [x, y] of [[44, 160], [58, 168], [74, 162], [150, 166]]) { c.beginPath(); c.ellipse(x, y, 5, 2.5, 0.4, 0, 7); c.stroke(); }
  } },
  den: { solid: true, draw(c) {
    shape(c, () => { c.moveTo(14, 164); c.bezierCurveTo(40, 60, 160, 60, 186, 164); c.closePath(); }, true, '#a98d68');
    shape(c, () => { c.moveTo(70, 164); c.bezierCurveTo(70, 104, 130, 104, 130, 164); c.closePath(); }, true, '#2a231b');
    hatch(c, 30, 100, 40, 60, 7, 0.6); hatch(c, 134, 100, 40, 60, 7, 0.6);
    for (let i = 0; i < 8; i++) line(c, [[24 + i * 22, 164], [28 + i * 22, 152]]);
  } },
};
export const REAL = Object.keys(ICONS);
export const isSolid = id => !!ICONS[id]?.solid;

// drawing helpers ------------------------------------------------------------------
function rr(c, x, y, w, h, r) { c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }
function shape(c, path, fill = false, colour = PAPER) { c.beginPath(); path(); if (fill) { c.fillStyle = colour; c.fill(); } c.stroke(); }
function line(c, pts) { c.beginPath(); pts.forEach(([x, y], i) => i ? c.lineTo(x, y) : c.moveTo(x, y)); c.stroke(); }
function cloud(c, x, y, colour) {
  blob(c, [[-40, 10, 24], [-14, -8, 30], [20, -4, 28], [44, 12, 20], [0, 16, 26]].map(([dx, dy, r]) => [x + dx, y + dy, r]), colour);
}
// several circles as one shape: outline only round the outside (stroke wide, then fill over)
function blob(c, circles, colour) {
  const path = () => { c.beginPath(); for (const [x, y, r] of circles) { c.moveTo(x + r, y); c.arc(x, y, r, 0, 7); } };
  const lw = c.lineWidth;
  path(); c.lineWidth = lw * 2; c.stroke(); c.lineWidth = lw;
  path(); c.fillStyle = colour; c.fill();
}
// engraver's hatching, clipped to whatever was drawn last (keeps a hand-made look)
function hatch(c, x, y, w, h, gap, alpha) {
  c.save(); c.globalAlpha = alpha; c.globalCompositeOperation = 'source-atop'; c.lineWidth = 1.6;
  for (let k = -h; k < w; k += gap) line(c, [[x + k, y + h], [x + k + h, y]]);
  c.restore();
}

// a sheet of paper with torn edges, as a Path2D
function tornPath(w, h, rnd, bite = 5) {
  const p = new Path2D(), pts = [];
  const edge = (x0, y0, x1, y1) => {
    const n = Math.max(4, Math.round(Math.hypot(x1 - x0, y1 - y0) / 7));
    for (let i = 0; i < n; i++) {
      const k = i / n, nx = -(y1 - y0), ny = x1 - x0, l = Math.hypot(nx, ny);
      const j = (rnd() - 0.5) * bite + (rnd() < 0.08 ? rnd() * bite * 1.6 : 0);
      pts.push([x0 + (x1 - x0) * k + nx / l * j, y0 + (y1 - y0) * k + ny / l * j]);
    }
  };
  const m = bite;
  edge(m, m, w - m, m); edge(w - m, m, w - m, h - m); edge(w - m, h - m, m, h - m); edge(m, h - m, m, m);
  pts.forEach(([x, y], i) => i ? p.lineTo(x, y) : p.moveTo(x, y)); p.closePath();
  return p;
}
const seeded = s => { let k = 0; for (const ch of String(s)) k = (k * 31 + ch.charCodeAt(0)) >>> 0; k = k % 2147483646 + 1; return () => (k = k * 16807 % 2147483647) / 2147483647; };
function grain(c, w, h, rnd, n = 1600, a = 0.05) {
  for (let i = 0; i < n; i++) { c.fillStyle = `rgba(70,55,35,${rnd() * a})`; c.fillRect(rnd() * w, rnd() * h, 1.4, 1.4); }
}

// ---- pieces, ready for the collage (canvases with alpha) -------------------------
const cache = new Map();

// a real-world thing, drawn in ink on a torn notebook page, with a caption
export function drawnPiece(id, caption) {
  const key = 'r|' + id + '|' + caption;
  if (cache.has(key)) return cache.get(key);
  const W = 300, H = 330, c = document.createElement('canvas'); c.width = W; c.height = H;
  const x = c.getContext('2d'), rnd = seeded(id);
  const page = tornPath(W, H, rnd, 7);
  x.fillStyle = '#f6efdf'; x.fill(page);
  x.save(); x.clip(page);
  x.strokeStyle = 'rgba(80,110,150,.18)'; x.lineWidth = 1;                // a field notebook's faint ruling
  for (let y = 22; y < H; y += 22) { x.beginPath(); x.moveTo(0, y); x.lineTo(W, y); x.stroke(); }
  x.strokeStyle = 'rgba(190,80,70,.25)'; x.beginPath(); x.moveTo(34, 0); x.lineTo(34, H); x.stroke();
  grain(x, W, H, rnd);
  x.drawImage(drawnCutout(id), 22, 4, 256, 256);
  x.restore();
  x.fillStyle = INK; x.textAlign = 'center';
  x.font = 'italic 400 25px "Cormorant Garamond", "Songti SC", "Noto Serif SC", "AppleMyungjo", "Noto Serif KR", Georgia, serif';
  fitText(x, caption, W / 2, H - 34, W - 40);
  cache.set(key, c);
  return c;
}

// the same thing on its own, cut out (for the monument's little statues)
export function drawnCutout(id) {
  const c = document.createElement('canvas'); c.width = 200; c.height = 200;
  const x = c.getContext('2d');
  x.strokeStyle = INK; x.lineWidth = 3.6; x.lineCap = 'round'; x.lineJoin = 'round';
  ICONS[id]?.draw(x);
  return c;
}

// a fragment torn out of a painting, with a small museum label
export async function fragmentPiece(id, work, caption) {
  const key = 'p|' + id + '|' + caption;
  if (cache.has(key)) return cache.get(key);
  const f = FRAGMENTS[id], img = await loadImage(work.hd);
  const [x0, y0, x1, y1] = f.box, bw = x1 - x0, bh = y1 - y0;
  const s = Math.min(420 / Math.max(bw, bh), Math.max(1, 270 / bw)), iw = Math.round(bw * s), ih = Math.round(bh * s);
  const pad = 12, label = 46, W = iw + pad * 2, H = ih + pad * 2 + label;
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const x = c.getContext('2d'), rnd = seeded(id);
  const page = tornPath(W, H, rnd, 6);
  x.fillStyle = '#efe6d2'; x.fill(page);                  // the print's own paper / the panel's ground
  x.save(); x.clip(page);
  x.drawImage(img, x0, y0, bw, bh, pad, pad, iw, ih);
  grain(x, W, H, rnd, 600, 0.04);
  x.restore();
  x.fillStyle = '#4a4137'; x.textAlign = 'left';
  x.font = '500 15px "IBM Plex Mono", Menlo, monospace';
  fitText(x, caption.toUpperCase(), pad + 4, H - 20, W - pad * 2 - 8, 'left');
  cache.set(key, c);
  return c;
}

// a strip of paper with a line someone said on it
export function quoteSlip(text, who, painted) {
  const c = document.createElement('canvas'), x = c.getContext('2d');
  const font = painted ? 'italic 400 30px "Cormorant Garamond", "Songti SC", "Noto Serif SC", "AppleMyungjo", "Noto Serif KR", Georgia, serif' : '400 21px "IBM Plex Mono", Menlo, monospace';
  x.font = font;
  const maxW = 520, lines = wrapLines(x, `“${text}”`, maxW);
  const lh = painted ? 36 : 30, W = Math.ceil(Math.max(...lines.map(l => x.measureText(l).width), 160)) + 60, H = lines.length * lh + 64;
  c.width = W; c.height = H;
  const rnd = seeded(text);
  const page = tornPath(W, H, rnd, 4);
  x.fillStyle = painted ? '#e8dbbd' : '#fbf8f0'; x.fill(page);
  x.save(); x.clip(page); grain(x, W, H, rnd, 500, 0.05); x.restore();
  x.fillStyle = INK; x.font = font; x.textAlign = 'left';
  lines.forEach((l, i) => x.fillText(l, 28, 40 + i * lh));
  x.font = '500 14px "IBM Plex Mono", Menlo, monospace'; x.fillStyle = '#6d6356';
  x.fillText('— ' + who.toUpperCase(), 28, H - 18);
  return c;
}

function fitText(x, text, cx, y, maxW, align = 'center') {
  x.textAlign = align;
  let size = parseFloat(x.font.match(/(\d+)px/)[1]);
  while (x.measureText(text).width > maxW && size > 11) { size -= 1; x.font = x.font.replace(/\d+px/, size + 'px'); }
  x.fillText(text, cx, y);
}

// the things a conversation mentioned, most-talked-about first, one of each
export function motifsOf(log) {
  const count = new Map();
  log.forEach((e, i) => e.tags.forEach(tag => count.set(tag, (count.get(tag) || 0) + 1 + 0.01 * (log.length - i))));
  return [...count.entries()].sort((a, b) => b[1] - a[1]).map(([id]) => id);
}

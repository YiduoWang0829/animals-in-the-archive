// Catalogue-style archive card, drawn on a canvas and offered as a PNG download.
// Nothing is uploaded or stored; the PNG exists only in the page until downloaded.

import { t } from './strings.js';
import { loadImage } from './paint.js';
import { wrapLines } from './util.js';

export function recordNumber(date = new Date()) {
  const ymd = date.toISOString().slice(0, 10).replace(/-/g, '');
  const rnd = crypto.getRandomValues(new Uint16Array(1))[0].toString(16).toUpperCase().padStart(4, '0');
  return `AIA-V-${ymd}-${rnd}`;
}

function wrap(ctx, text, x, y, maxW, lh) {
  for (const line of wrapLines(ctx, text, maxW)) { ctx.fillText(line, x, y); y += lh; }
  return y;
}

export async function makeCard({ screenshot, record, date, work, workText, roleName, speciesName, hostName, mood, made, photoCredit, figure, told }) {
  await document.fonts.ready;
  const W = 1200, H = 1720 + (told ? 130 : 0), M = 84;
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const c = cv.getContext('2d');
  const paper = '#eee8db', ink = '#1d1a16', muted = '#7b7266', rule = 'rgba(29,26,22,.22)';
  const serif = '"Cormorant Garamond", "Songti SC", "Noto Serif SC", "AppleMyungjo", "Noto Serif KR", Georgia, serif', mono = '"IBM Plex Mono", Menlo, monospace', sans = 'Inter, "PingFang SC", "Apple SD Gothic Neo", system-ui, sans-serif';

  c.fillStyle = paper; c.fillRect(0, 0, W, H);
  // faint paper grain
  for (let i = 0; i < 9000; i++) {
    c.fillStyle = `rgba(60,50,35,${Math.random() * 0.04})`;
    c.fillRect(Math.random() * W, Math.random() * H, 1.5, 1.5);
  }
  c.strokeStyle = rule; c.lineWidth = 2; c.strokeRect(36, 36, W - 72, H - 72);

  // header
  c.fillStyle = muted; c.font = `400 20px ${mono}`; c.textBaseline = 'alphabetic';
  c.fillText(t('siteTitle').toUpperCase() + '  ·  ' + t('cardTitle').toUpperCase(), M, M + 26);
  c.textAlign = 'right'; c.fillText(date, W - M, M + 26); c.textAlign = 'left';
  c.fillStyle = ink; c.font = `400 76px ${serif}`;
  c.fillText(record, M, M + 120);
  c.strokeStyle = rule; c.beginPath(); c.moveTo(M, M + 152); c.lineTo(W - M, M + 152); c.stroke();

  // sculpture
  const img = await loadImage(screenshot);
  const boxY = M + 184, boxH = 760, boxW = W - 2 * M;
  c.fillStyle = '#100f0d'; c.fillRect(M, boxY, boxW, boxH);
  const s = Math.max(boxW / img.width, boxH / img.height);
  const iw = img.width * s, ih = img.height * s;
  c.save(); c.beginPath(); c.rect(M, boxY, boxW, boxH); c.clip();
  c.drawImage(img, M + (boxW - iw) / 2, boxY + (boxH - ih) / 2, iw, ih); c.restore();
  c.fillStyle = muted; c.font = `400 17px ${mono}`;
  c.fillText(`FIG. 1  ${speciesName.toUpperCase()} × ${hostName.toUpperCase()}, ${made.toUpperCase()}, BY THE VISITOR`.slice(0, 96), M, boxY + boxH + 34);

  // fields
  const rows = [
    [t('cardPainting'), `${workText.title}, ${workText.artist}, ${workText.date}`],
    [t('cardRole'), roleName],
    [t('cardSpecies'), speciesName],
    [t('cardHost'), hostName],
    [t('cardMood'), mood],
    [t('cardMade'), made],
    ...(told ? [[t('cardTold'), told]] : []),
    [t('cardDate'), date],
  ];
  let y = boxY + boxH + 92;
  for (const [k, v] of rows) {
    c.strokeStyle = rule; c.beginPath(); c.moveTo(M, y - 34); c.lineTo(W - M, y - 34); c.stroke();
    c.fillStyle = muted; c.font = `400 17px ${mono}`; c.fillText(k.toUpperCase(), M, y);
    c.fillStyle = ink; c.font = `400 30px ${serif}`;
    y = wrap(c, v, M + 260, y + 2, W - 2 * M - 260, 34) + 18;
  }

  // credits
  c.strokeStyle = rule; c.beginPath(); c.moveTo(M, y - 30); c.lineTo(W - M, y - 30); c.stroke();
  c.fillStyle = muted; c.font = `400 15px ${mono}`; c.fillText(t('cardCredits').toUpperCase(), M, y);
  c.font = `400 17px ${sans}`;
  y = wrap(c, `${workText.title} (${workText.artist}, ${workText.date}), ${workText.collection}. ` +
    photoCredit + '.', M + 260, y, W - 2 * M - 260, 25);

  c.fillStyle = muted; c.font = `400 15px ${mono}`;
  c.fillText(t('cardFooter').toUpperCase(), M, H - M + 10);
  c.textAlign = 'right'; c.fillText(work.accession, W - M, H - M + 10); c.textAlign = 'left';

  return new Promise(res => cv.toBlob(res, 'image/png'));
}

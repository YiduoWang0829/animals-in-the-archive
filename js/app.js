// Animals in the Archive: flow controller.
// index → record → role → camera (optional) → visitor (draw or archive)
//   → gallery: walk in, look back, the painted animal wakes and asks
//   → step into the painting → create (sculpt 3D / new painting 2D) → card.
// No data is stored or sent anywhere; state lives in memory only.

import { t, STRINGS, LANG, LANGS, localize } from './strings.js';
import { WORKS, SPECIES, HOSTS, ANIMALS3D, workById, speciesById, animal3dById } from './data.js';
import { loadClassifier, createPad, classify, matchSpecies, drawingToCharacter } from './sketch.js';
import { makeCard, recordNumber } from './card.js';
import { paintify, loadImage } from './paint.js';
import { tagsOf, isPainted, isSolid, motifsOf, FRAGMENTS, drawnPiece, drawnCutout, fragmentPiece, quoteSlip } from './exchange.js';

const $ = (sel, root = document) => root.querySelector(sel);
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const W = id => t(`works.${id}`);
const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
const sleep = ms => new Promise(r => setTimeout(r, ms));

const state = {
  work: null, role: null, look: 'storybook', visitor: null, host: null, answer: null,
  facing: 'right', colour: '#c98a4b', made: null,
  choice: { kind: 'animal3d', id: 'stag', look: 'real' },   // the character being shown in the studio
};
let gallery = null, sculpt = null, composer = null, tracker = null, cardUrl = null, hostMeta = null, turntable = null;
let face = null, hands = [];

// ---------------------------------------------------------------- i18n
document.documentElement.lang = LANG;
document.querySelectorAll('[data-i18n]').forEach(el => { el.textContent = t(el.dataset.i18n); });
// the language switch (top right of the first page): EN · 中文 · 한국어
{
  const box = document.createElement('div');
  box.className = 'lang-switch'; box.setAttribute('role', 'group'); box.setAttribute('aria-label', 'Language');
  box.innerHTML = LANGS.map(([code, label]) => `<a href="?lang=${code}" lang="${code}" ${code === LANG ? 'aria-current="true"' : ''}>${label}</a>`).join('');
  document.querySelector('.masthead').appendChild(box);
}

// ---------------------------------------------------------------- views
function show(view) {
  document.querySelectorAll('.view').forEach(v => v.classList.toggle('is-active', v.id === `view-${view}`));
  document.body.classList.toggle('in-stage', view === 'stage');
  document.body.classList.toggle('on-index', view === 'index');
  document.body.classList.toggle('in-sculpt', view === 'create');
  document.body.classList.toggle('in-studio', view === 'character');
  if (view !== 'character' && turntable) { turntable.dispose(); turntable = null; }
  if (view !== 'stage') clearBubbles();
  window.scrollTo(0, 0);
}

// ---------------------------------------------------------------- modal
const modal = $('#modal'), panel = $('#modal-panel');
let lastFocus = null;
function openModal(html, { wide = false } = {}) {
  lastFocus = document.activeElement;
  panel.className = 'modal-panel glass' + (wide ? ' wide' : '');
  panel.innerHTML = `<button class="modal-close" data-action="close-modal" aria-label="${esc(t('close'))}"></button>` + html;
  modal.hidden = false; panel.scrollTop = 0;
  (panel.querySelector('[autofocus]') || panel.querySelector('button:not(.modal-close)') || panel).focus?.();
}
function closeModal() { modal.hidden = true; panel.innerHTML = ''; lastFocus?.focus?.(); }
document.addEventListener('keydown', e => { if (e.key === 'Escape' && !modal.hidden) closeModal(); });

// ---------------------------------------------------------------- 1 · index
function renderIndex() {
  $('#index-count').textContent = t('indexCount', { n: WORKS.length });
  $('#catalogue').innerHTML = WORKS.map((w, i) => {
    const x = W(w.id);
    return `<li class="entry" tabindex="0" role="button" data-work="${w.id}" aria-label="${esc(x.title)}">
      <div class="entry-mount"><img src="${w.image}" alt="${esc(x.title)}, ${esc(x.artist)}" loading="${i ? 'lazy' : 'eager'}"></div>
      <div class="entry-no caption"><span>${esc(w.accession)}</span><span>${String(i + 1).padStart(2, '0')} / ${String(WORKS.length).padStart(2, '0')}</span></div>
      <h3 class="entry-title">${esc(x.title)}</h3>
      <dl class="meta">
        <dt>${esc(t('fieldArtist'))}</dt><dd>${esc(x.artist)}</dd>
        <dt>${esc(t('fieldDate'))}</dt><dd>${esc(x.date)}</dd>
        <dt>${esc(t('fieldStyle'))}</dt><dd>${esc(x.style)}</dd>
        <dt>${esc(t('fieldAnimals'))}</dt><dd>${esc(x.animals)}</dd>
      </dl>
      <span class="btn cta primary enter-pill">${esc(t('enterWork'))}</span>
    </li>`;
  }).join('');
}

// ---------------------------------------------------------------- 2 · record
function openRecord(id) {
  state.work = workById(id);
  const w = state.work, x = W(id);
  openModal(`
    <p class="kicker">${esc(t('stepOf', { n: 1 }))} · ${esc(w.accession)}</p>
    <div class="record">
      <img src="${w.image}" alt="${esc(x.title)}">
      <div>
        <h2>${esc(x.title)}</h2>
        <p class="blurb">${esc(x.blurb)}</p>
        <dl class="meta">
          <dt>${esc(t('fieldAccession'))}</dt><dd>${esc(w.accession)}</dd>
          <dt>${esc(t('fieldArtist'))}</dt><dd>${esc(x.artist)}</dd>
          <dt>${esc(t('fieldDate'))}</dt><dd>${esc(x.date)}</dd>
          <dt>${esc(t('fieldStyle'))}</dt><dd>${esc(x.style)}</dd>
          <dt>${esc(t('fieldCollection'))}</dt><dd>${esc(x.collection)}</dd>
          <dt>${esc(t('fieldAnimals'))}</dt><dd>${esc(x.animals)}</dd>
        </dl>
      </div>
    </div>
    <div class="modal-actions">
      <button class="btn ghost" data-action="close-modal">${esc(t('close'))}</button>
      <button class="btn primary cta" data-action="to-role" autofocus>${esc(t('enterWork'))}</button>
    </div>`, { wide: true });
}

// ---------------------------------------------------------------- 3 · role
function openRole() {
  const roles = ['author', 'guard', 'passer'];
  openModal(`
    <p class="kicker">${esc(t('stepOf', { n: 2 }))} · ${esc(W(state.work.id).title)}</p>
    <h2>${esc(t('roleHeading'))}</h2>
    <p class="sub">${esc(t('roleIntro'))}</p>
    <div class="choices">${roles.map((r, i) => `
      <button class="choice" data-action="pick-role" data-role="${r}" aria-pressed="${state.role === r}">
        <span class="n">${String(i + 1).padStart(2, '0')}</span>
        <h3>${esc(t(`roles.${r}.name`))}</h3>
        <p>${esc(t(`roles.${r}.desc`))}</p>
      </button>`).join('')}
    </div>
    <div class="modal-actions">
      <button class="btn ghost" data-action="back-record">${esc(t('back'))}</button>
      <button class="btn primary cta" data-action="to-camera" ${state.role ? '' : 'disabled'}>${esc(t('continue'))}</button>
    </div>`);
}

// ---------------------------------------------------------------- 4 · camera consent
function openCamera() {
  if (tracker) { openVisitor(); return; }           // already on in this session
  openModal(`
    <p class="kicker">${esc(t('stepOf', { n: 3 }))}</p>
    <h2>${esc(t('camHeading'))}</h2>
    <p class="sub">${esc(t('camBody'))}</p>
    <label class="consent-check"><input type="checkbox" id="consent-box"><span>${esc(t('consentCheck'))}</span></label>
    <div class="modal-actions">
      <button class="btn ghost" data-action="cam-skip">${esc(t('camSkip'))}</button>
      <button class="btn primary cta" data-action="cam-start" id="cam-start" disabled>${esc(t('camStart'))}</button>
    </div>`);
  $('#consent-box').addEventListener('change', e => { $('#cam-start').disabled = !e.target.checked; });
}

async function startCamera() {
  if (!$('#consent-box')?.checked) return;          // consent is required
  $('#cam-start').disabled = true;
  $('#cam-start').innerHTML = `<span class="loading"></span>${esc(t('camLoading'))}`;
  try {
    if (!navigator.mediaDevices?.getUserMedia) throw Object.assign(new Error('no camera API'), { name: 'NotFoundError' });
    const { Tracker } = await import('./tracking.js');
    tracker = await new Tracker($('#cam-video'), {
      onFace: f => { face = f.present ? f : null; },
      onHands: h => { hands = h; onHands(h); },
      onGesture: g => onGesture(g),
    }).start();
    $('#cam-chip').hidden = false;
    openVisitor();
  } catch (err) {
    console.warn('[camera]', err.name, err.message);
    const denied = ['NotAllowedError', 'NotFoundError', 'NotReadableError', 'SecurityError', 'OverconstrainedError'].includes(err.name);
    tracker = null;
    openVisitor(denied ? t('camDenied') : t('camFailed'));
  }
}
function stopCamera() {
  tracker?.stop(); tracker = null; face = null; hands = [];
  $('#cam-chip').hidden = true;
  $('#hand-cursor').hidden = true; $('#hand-cursor-2').hidden = true;
  sculpt?.externalBrush(null);
}

// ---------------------------------------------------------------- 5 · character studio
const SWATCHES = ['#c98a4b', '#9a7b5c', '#e2c48a', '#7f8f9c', '#5d6b4f', '#b8524a', '#3f5a9e', '#efe9dc'];
function openVisitor(notice = '') { closeModal(); openStudio(notice); }
async function openStudio(notice = '') {
  show('character');
  $('#studio-kicker').textContent = `${t('stepOf', { n: 4 })} · ${t(`roles.${state.role}.name`)}${tracker ? ' · ' + t('camOn') : ''}`;
  $('#studio-draw').innerHTML = `
    <h2>${esc(t('studioDraw'))}</h2>
    ${notice ? `<p class="status">${esc(notice)}</p>` : ''}
    <div class="draw-pad" id="draw-pad"><canvas id="draw-canvas" aria-label="${esc(t('drawHint'))}"></canvas>
      <div class="match-photo"><img id="match-img" alt=""></div></div>
    <div class="draw-tools">
      <button class="btn small" data-action="draw-clear">${esc(t('drawClear'))}</button>
      <button class="btn small primary" data-action="draw-go" id="draw-go">${esc(t('drawRecognise'))}</button>
    </div>
    <div class="draw-opts">
      <span class="lbl">${esc(t('facing'))}</span>
      <div class="segmented" role="group">
        <button data-action="facing" data-facing="left" aria-pressed="${state.facing === 'left'}">${esc(t('facingLeft'))}</button>
        <button data-action="facing" data-facing="right" aria-pressed="${state.facing === 'right'}">${esc(t('facingRight'))}</button>
      </div>
      <span class="lbl">${esc(t('wash'))}</span>
      <div class="swatches">${SWATCHES.map(c => `<button data-action="swatch" data-colour="${c}" style="background:${c}" aria-label="${c}" aria-pressed="${state.colour === c}"></button>`).join('')}</div>
    </div>
    <p class="status" id="draw-status"><span class="loading"></span>${esc(t('drawLoading'))}</p>
    <p class="note" style="margin-top:0">${esc(t('drawHint'))}</p>
    <div id="draw-result"></div>
    <div class="result-actions"><button class="btn" data-action="choose-drawing">${esc(t('walkInDrawing'))}</button></div>`;
  $('#shelf-3d').innerHTML = ANIMALS3D.map(a => `
    <button class="pick" data-action="choose-3d" data-id="${a.id}"><img src="${a.thumb}" alt="" loading="lazy"><span>${esc(t(`animals3d.${a.id}`))}</span></button>`).join('');
  $('#shelf-2d').innerHTML = SPECIES.map(s => `
    <button class="pick" data-action="choose-2d" data-species="${s.id}"><img src="${s.storybook}" alt="" loading="lazy"><span>${esc(t(`species.${s.id}`))}</span></button>`).join('');
  const pad = createPad($('#draw-canvas'));
  openVisitor.pad = pad;
  $('#draw-go').disabled = true;
  loadClassifier().then(() => {
    if (!$('#draw-status')) return;
    $('#draw-status').textContent = t('drawReady'); $('#draw-go').disabled = false;
  }).catch(err => {
    console.warn('[sketch] classifier unavailable:', err);
    if ($('#draw-status')) $('#draw-status').textContent = t('drawUnavailable');
  });
  if (!$('#vname').value) $('#vname').value = state.name || pickLine(t('names'));
  if (!turntable) { const { Turntable } = await import('./turntable.js'); turntable = new Turntable($('#turntable')); }
  choose(state.choice);
}

// show a character on the stage and update the big button
function choose(c) {
  state.choice = c;
  if (!turntable) return;                 // the stage is still loading; openStudio shows the choice when ready
  document.querySelectorAll('.pick').forEach(p => p.setAttribute('aria-pressed',
    (c.kind === 'animal3d' && p.dataset.id === c.id) || (c.kind === 'species' && p.dataset.species === c.species.id)));
  const tools = $('#tt-tools'), img2d = $('#tt-2d'), name = $('#tt-name');
  let label;
  if (c.kind === 'animal3d') {
    const a = animal3dById(c.id);
    img2d.hidden = true; $('#turntable').style.visibility = '';
    turntable.show(a, c.look);
    label = t(`animals3d.${a.id}`);
    const r = animal3dById(c.id)?.real;
    name.innerHTML = `<div class="n">${esc(label)}</div><div class="s">3D · ${esc(r ? `${r.author} · ${r.licence}` : 'Quaternius · CC0')}</div>`;
    tools.innerHTML = `
      <div class="segmented" role="group">${['walk'].map(k => `<button data-action="tt-anim" data-anim="${k}" aria-pressed="${(turntable.anim || 'walk') === k}">${esc(t({ walk: 'animWalk', run: 'animRun', idle: 'animIdle', eat: 'animEat' }[k]))}</button>`).join('')}</div>
      <div class="segmented" role="group">
        <button data-action="tt-look" data-look="real" aria-pressed="${c.look !== 'storybook'}">${esc(t('lookNatural'))}</button>
        <button data-action="tt-look" data-look="storybook" aria-pressed="${c.look === 'storybook'}">${esc(t('lookStorybookShort'))}</button>
      </div>
      <span class="hint">${esc(t('dragToTurn'))}</span>`;
  } else {
    $('#turntable').style.visibility = 'hidden'; img2d.hidden = false;
    img2d.src = c.kind === 'drawing' ? c.canvas.toDataURL('image/png') : c.species.storybook;
    label = c.kind === 'drawing' ? t('yourDrawing') : t(`species.${c.species.id}`);
    name.innerHTML = `<div class="n">${esc(label)}</div><div class="s">2D · ${esc(t('lookStorybook'))}</div>`;
    tools.innerHTML = '';
  }
  $('#walk-in').textContent = c.kind === 'drawing' ? t('walkInDrawing') : t('walkInAs', { name: label });
}

async function recogniseSketch() {
  const pad = openVisitor.pad, out = $('#draw-result');
  if (pad.isEmpty()) { out.innerHTML = `<p class="status">${esc(t('drawEmpty'))}</p>`; return; }
  const ranked = await classify(pad.canvas);
  const pct = p => (p * 100).toFixed(1);
  const top = ranked.slice(0, 4).map(r => `<li><span>${esc(r.label)}</span><span class="bar"><i style="width:${(r.p * 100).toFixed(1)}%"></i></span><span class="pct">${pct(r.p)}%</span></li>`).join('');
  // the closest living 3D animal, if any of its drawing classes scored
  const best3d = matchSpecies(ranked.slice(), ANIMALS3D.filter(a => a.doodle.length).map(a => ({ ...a, doodle: a.doodle })))[0];
  let html = `<div class="result"><h4>${esc(t('drawTop'))}</h4><ul class="bars">${top}</ul>`;
  if (best3d && best3d.score >= 0.05) {
    const a = best3d.species;
    html += `<h4>${esc(t('drawMatch'))}</h4><p class="match">${esc(t(`animals3d.${a.id}`))}</p>
      <p class="caption" style="text-transform:none;letter-spacing:.04em">${esc(t('drawScore', { p: pct(best3d.score) }))} · ${esc(t('drawVia', { c: best3d.via }))}</p>
      <div class="result-actions"><button class="btn" data-action="choose-3d" data-id="${a.id}">${esc(t('bringMatch', { name: t(`animals3d.${a.id}`) }))}</button></div>`;
  } else {
    const best = matchSpecies(ranked.slice(), SPECIES.filter(s => s.doodle.length))[0];
    html += `<p class="status" style="margin-top:14px">${esc(t('drawNoMatch', { p: pct(best ? best.score : 0) }))}</p>`;
  }
  out.innerHTML = html + '</div>';
}

// ---------------------------------------------------------------- 6 · gallery
const bubbles = new Map();
function say(who, name, text, hold = 4200) {
  // one speaker at a time on screen: older bubbles fade so painted animals stay visible
  // a new speaker hides everyone else at once (no fading bubbles left overlapping)
  bubbles.forEach((el, k) => { if (k !== who) { el.classList.remove('show'); el.style.visibility = 'hidden'; } });
  let b = bubbles.get(who);
  if (!b) { b = document.createElement('div'); b.className = 'bubble'; $('#bubble-layer').appendChild(b); bubbles.set(who, b); }
  b.classList.remove('show');
  b.innerHTML = `<span class="who"></span><span class="txt"><span class="on"></span><span class="off" style="visibility:hidden"></span></span>`;
  b.querySelector('.who').textContent = name;
  // the words come in at a calm reading pace (the bubble already has its full size: the rest
  // waits invisibly, so nothing jumps)
  const on = b.querySelector('.on'), off = b.querySelector('.off'), chars = [...text];
  off.textContent = text; clearInterval(b._type);
  let n = 0; const step = Math.max(16, Math.round(readMs(text) * 0.45 / Math.max(1, chars.length)));
  b._type = setInterval(() => { n++; on.textContent = chars.slice(0, n).join(''); off.textContent = chars.slice(n).join(''); if (n >= chars.length) clearInterval(b._type); }, step);
  b.style.visibility = 'visible';
  setTimeout(() => b.classList.add('show'), 20);
  clearTimeout(b._t);
  if (hold) b._t = setTimeout(() => b.classList.remove('show'), hold + readMs(text));
}
// how long a line takes to read: Chinese, Japanese and Korean characters each carry a
// word's worth of meaning, so they get far more time than a Latin letter
function readMs(text) {
  let ms = 0;
  for (const c of String(text)) ms += /[\u3000-\u9fff\uac00-\ud7af\uff00-\uffef]/.test(c) ? 240 : /\s/.test(c) ? 30 : 62;
  return ms;
}
function clearBubbles() { bubbles.forEach(b => b.remove()); bubbles.clear(); }
function placeBubbles(g) {
  const items = [...bubbles.entries()].filter(([, el]) => el.classList.contains('show'))
    .map(([who, el]) => ({ el, p: g.project(g.anchor(who)) }));
  items.sort((a, b) => a.p.x - b.p.x);
  for (let i = 1; i < items.length; i++) {          // push overlapping bubbles apart sideways
    const a = items[i - 1], b = items[i];
    if (b.p.x - a.p.x < 300 && Math.abs(a.p.y - b.p.y) < 110) { a.p.x -= 150; b.p.x += 150; }
  }
  const chip = !$('#cam-chip').hidden ? $('#cam-chip').getBoundingClientRect() : null;
  for (const { el, p } of items) {
    let x = Math.max(170, Math.min(innerWidth - 170, p.x)), y = Math.min(innerHeight - 120, Math.max(160, p.y));
    // keep clear of the camera window
    if (chip && x + 170 > chip.left - 10 && y - el.offsetHeight - 14 < chip.bottom + 10) x = Math.min(x, chip.left - 180);
    // and never over the hint box (the bubble moves down below it)
    const hint = $('#stage-status .glass')?.getBoundingClientRect();
    const hw = (el.offsetWidth || 340) / 2;
    if (hint && x + hw > hint.left && x - hw < hint.right && y - el.offsetHeight - 14 < hint.bottom + 8) y = Math.min(innerHeight - 20, hint.bottom + 8 + el.offsetHeight + 14);
    el.style.left = x + 'px'; el.style.top = y + 'px';
  }
}
function controls(html) { $('#stage-controls').innerHTML = html; }
function status(html) { $('#stage-status').innerHTML = html ? `<div class="glass">${html}</div>` : ''; }

async function visitorImage() {
  const v = state.visitor;
  if (v.kind === 'drawing') return v.canvas;
  return loadImage(v.species.storybook);
}

async function enterStage(visitor) {
  state.visitor = visitor; state.answer = null; state.inside = false; state.hostAwake = false; state.talk = [];
  storyToken++; giveAnswer(null); speechLock = Promise.resolve();
  closeModal(); show('stage');
  status(`<span class="loading"></span>${esc(t('loadingRoom'))}`); controls('');
  const w = state.work;
  // a different set of painted animals wakes up each visit (the first one speaks for them)
  const order = [...w.hosts].sort(() => Math.random() - 0.5);
  const free = order.filter(id => !HOSTS[id].inPlace), fixed = order.filter(id => HOSTS[id].inPlace);
  const pick = free.length ? (fixed.length && Math.random() < 0.5 ? [fixed[0]] : []).concat(free).slice(0, Math.min(3, w.hosts.length))
    : fixed.slice(0, 3);                           // a painting whose speakers all stay in place
  state.hosts = pick.map(id => HOSTS[id]);
  state.host = state.hosts[0];
  hostMeta ??= await (await fetch('assets/hosts/hosts.json')).json();
  const actor = await makeVisitorActor();
  gallery?.dispose();
  const { Gallery } = await import('./gallery.js');
  // the other two paintings hang either side on the same wall
  const wi = WORKS.indexOf(w), nb = k => WORKS[(wi + k + WORKS.length) % WORKS.length];
  gallery = new Gallery($('#stage3d'), {
    work: w, workText: W(w.id), visitor: actor, from: state.from || -1,
    visitorRealH: state.visitor.kind === 'animal3d' ? animal3dById(state.visitor.id).realH
      : state.visitor.kind === 'species' ? state.visitor.species.realH : 0.6,
    others: [{ work: nb(-1), text: W(nb(-1).id), side: -1 }, { work: nb(1), text: W(nb(1).id), side: 1 }],
    hosts: state.hosts.map(h => ({ host: h, meta: hostMeta[h.id] })),
    onFrame: g => { placeBubbles(g); stageFrame(g); },
  });
  await gallery.init();
  status('');
  workNav(true);
  if ($('.veil')) { $('.veil').classList.remove('on'); setTimeout(() => $('.veil')?.remove(), 800); }
  runStory(gallery);
}

// ‹ › beside the gallery: walk over to the painting next door
function workNav(on) {
  let nav = $('#work-nav');
  if (!on) { if (nav) nav.hidden = true; return; }
  if (!nav) { nav = document.createElement('div'); nav.id = 'work-nav'; $('#view-stage').appendChild(nav); }
  const wi = WORKS.indexOf(state.work), nb = k => WORKS[(wi + k + WORKS.length) % WORKS.length];
  nav.innerHTML = `<button class="work-nav prev" data-action="switch-work" data-work="${nb(-1).id}" data-side="-1" aria-label="${esc(W(nb(-1).id).title)}">
      <span class="arr">‹</span><span class="t">${esc(W(nb(-1).id).title)}</span></button>
    <button class="work-nav next" data-action="switch-work" data-work="${nb(1).id}" data-side="1" aria-label="${esc(W(nb(1).id).title)}">
      <span class="t">${esc(W(nb(1).id).title)}</span><span class="arr">›</span></button>`;
  nav.hidden = false;
}
let switching = false;
async function switchWork(id, side) {
  const g = gallery;
  if (!g || g.inside || g.entering || switching) return;
  switching = true;
  storyToken++; giveAnswer(null); speechLock = Promise.resolve(); clearBubbles(); controls(''); status(''); workNav(false);
  await g.leaveToward(side);
  const veil = document.createElement('div'); veil.className = 'veil'; document.body.appendChild(veil);
  requestAnimationFrame(() => veil.classList.add('on'));
  await sleep(650);
  state.work = workById(id); state.from = -side; state.switched = true;
  switching = false;
  await enterStage(state.visitor);
}

// the visitor as an actor: a rigged 3D animal, or a 2D character (drawing / storybook)
async function makeVisitorActor() {
  const v = state.visitor;
  if (v.kind === 'animal3d') {
    const { loadAnimal3D } = await import('./animal3d.js');
    const a = animal3dById(v.id);
    return loadAnimal3D(a.glb, { height: a.height * 1.35, look: v.look });
  }
  const { Character } = await import('./character.js');
  if (v.kind === 'drawing') return new Character(v.canvas, { height: 0.55, headSide: v.facing });
  const img = await loadImage(v.species.storybook);
  return new Character(img, { height: 0.55, headSide: v.species.faces, gait: v.species.gait });
}

const pickLine = arr => arr[Math.floor(Math.random() * arr.length)];
const hostNameOf = i => cap(t(`hostNames.${state.hosts[i].id}`));
function sayHost(i, text, hold) { say(i, hostNameOf(i), text, hold); }

const visitorKind = () => state.visitor.kind === 'drawing' ? t('yourDrawing')
  : state.visitor.kind === 'animal3d' ? t(`animals3d.${state.visitor.id}`) : t(`species.${state.visitor.species.id}`);
const visitorName = () => state.name;
const hostName = () => t(`hostNames.${state.host.id}`);   // the first painted animal

// ---- conversation: one speaker at a time, in order ----------------------------
let speechLock = Promise.resolve();
let storyToken = 0;                       // bumped when the stage closes: stops all scripts
let pendingAnswer = null, waveWaiter = null;
const fill = s => localize(String(s).replace(/\{name\}/g, state.name || ''));
const speakerName = who => who === 'visitor' ? state.name : hostNameOf(who);
const shuffled = arr => [...arr].sort(() => Math.random() - 0.5);

// say a line after whoever is speaking now has finished; resolves when it has been read
function speak(who, text, { pause = 350, tags = null, q = '' } = {}) {
  const tok = storyToken, g0 = gallery;
  const run = speechLock.then(async () => {
    if (tok !== storyToken || !gallery || switching || g0 !== gallery) return;
    const g = gallery, dur = Math.max(2800, 1400 + readMs(fill(text)));
    g.actorOf(who)?.nod?.(1);
    // whoever speaks and whoever listens turn to each other (the visitor looks at the
    // painted animal talking to it, not at you, not at the room)
    const listener = who === 'visitor' ? (g.partner ?? null) : 'visitor';
    g.convo = { speaker: who, listener, t: performance.now(), dur };
    if (who !== 'visitor') g.gazeHost = who; else if (listener !== null) g.gazeHost = listener;
    say(who, speakerName(who), fill(text), 0);
    if (tags) state.talk.push({ who, name: speakerName(who), text: fill(text), side: who === 'visitor' ? 'out' : 'in', tags, q: fill(q) });
    await sleep(dur);
    bubbles.get(who)?.classList.remove('show');
    await sleep(pause);
  });
  speechLock = run.catch(() => {});
  return run;
}

// ask the person in front of the screen. Everyone turns to you and waits:
// nod / shake (camera) or the Yes / No buttons. A gentle reminder now and then.
function askUser(who, question) {
  const tok = storyToken;
  const run = speechLock.then(() => new Promise(resolve => {
    if (tok !== storyToken || !gallery) return resolve(null);
    const g = gallery, q = fill(question);
    say(who, speakerName(who), q, 0);
    g.attendAll(true);
    const before = $('#stage-controls').innerHTML;
    controls(`${tracker ? `<span class="hint">${esc(t('answerHint'))}</span>` : ''}
      <button class="btn" data-action="answer" data-answer="no">${esc(t('no'))}</button>
      <button class="btn primary cta" data-action="answer" data-answer="yes">${esc(t('yes'))}</button>
      ${state.inside ? `<button class="btn small ghost" data-action="to-create">${esc(t('create'))}</button>` : ''}`);
    let k = 0;
    const remind = setInterval(() => {
      if (tok !== storyToken) return finish(null);
      say(who, speakerName(who), t('waitingYou')[k++ % t('waitingYou').length], 0);
      setTimeout(() => { if (pendingAnswer === finish) say(who, speakerName(who), q, 0); }, 2800);
    }, 10000);
    function finish(ans) {
      clearInterval(remind); pendingAnswer = null;
      if (gallery === g) { g.attendAll(false); controls(before); bubbles.get(who)?.classList.remove('show'); }
      resolve(ans);
    }
    pendingAnswer = finish;
  }));
  speechLock = run.then(() => sleep(250)).catch(() => {});
  return run;
}
function giveAnswer(a) { pendingAnswer?.(a); }

const kindOf = () => {
  const v = state.visitor;
  return v.kind === 'drawing' ? 'drawing' : v.kind === 'animal3d' ? animal3dById(v.id).kind : v.species.kind;
};

// ---- part 1: the gallery. Only your animal and you. It reads the label, looks,
// tells you what it sees, and asks before walking in.
async function runStory(g) {
  const tok = storyToken, alive = () => g === gallery && tok === storyToken;
  const w = state.work, x = W(w.id), kind = kindOf();
  await g.walkIn();
  if (!alive()) return;
  if (state.switched) await speak('visitor', pickLine(t('switchArrive')));
  else {
    g.talkToYou(true);
    await speak('visitor', pickLine(t('visitorHello')));
    if (tracker && alive()) {                       // invite a wave (only with the camera on)
      status(esc(t('waveHint')));
      await new Promise(res => { waveWaiter = res; setTimeout(res, 3500); });
      waveWaiter = null; status('');
    }
    g.talkToYou(false);
  }
  await Promise.all([g.toLabel(), speak('visitor', pickLine(t('tourArrive')))]);
  if (!alive()) return;
  await speak('visitor', t('tourLabel', { title: x.title, artist: x.artist, date: x.date }));
  for (const f of x.facts) { if (!alive()) return; await speak('visitor', f); }
  if (!alive()) return;
  await Promise.all([g.toPainting(), speak('visitor', t('tourSee', { animals: x.see }))]);
  await speak('visitor', kind === 'drawing' ? t('tourDrawing')
    : w.kinds.includes(kind) ? t('tourSame', { kind: t(`kinds.${kind}`) }) : t('tourNotSame', { kind: t(`kinds.${kind}`) }));
  if (!alive()) return;
  g.talkToYou(true);
  const like = await askUser('visitor', t('tourLikeQ'));
  if (!like || !alive()) return;
  await speak('visitor', like === 'yes' ? t('tourLikeYes') : t('tourLikeNo'));
  await askToGoIn(g);
}

async function askToGoIn(g) {
  const tok = storyToken;
  const go = await askUser('visitor', t('tourGoQ'));
  if (!go || g !== gallery || tok !== storyToken) return;
  state.answer = go;
  if (go === 'yes') { await speak('visitor', t('tourGoYes')); stepIn(g); }
  else {
    await speak('visitor', t('tourGoNo'));
    controls(`<button class="btn" data-action="home">${esc(t('anotherPainting'))}</button>
      <button class="btn primary cta" data-action="step-in">${esc(t('stepInAnyway'))}</button>`);
  }
}

async function stepIn(g = gallery) {
  if (!g || g.inside || g.entering) return;
  g.entering = true;
  const tok = storyToken, alive = () => g === gallery && tok === storyToken;
  controls(''); clearBubbles(); g.talkToYou(false); workNav(false);
  g.locked = true;                                  // no steering until the opening has played
  // the visitor sets off towards the picture; the light closes around it, and while the
  // screen is dark a title card says what is about to happen. The walk through the frame
  // (and the moment the relief opens up) happens behind the card.
  const entering = g.enter();
  await sleep(650);
  if (!alive()) return;
  const x = W(state.work.id);
  await crossing(g, [
    t(`crossTime.${state.work.id}`),
    t('crossStill'),
    fill(t(kindOf() === 'drawing' ? 'crossOutDrawing' : 'crossOut')),
    fill(t('crossTrade')),
    { text: t('crossListen'), small: true },
  ], entering, alive, x.title);
  if (!alive()) return;
  state.inside = true;
  status(esc(t('watchFirst')));                    // the opening plays first; the view is the story's
  controls(`<button class="btn primary cta" data-action="to-create">${esc(t('create'))}</button>`);
  insideStory(g, tok);
}

// ---- the crossing: a black title card, faded in around the picture ----------------
// The dark closes like an iris on the painting (so it reads as "going in", not as a
// cut), the lines appear one at a time, and the card waits for the walk to finish.
async function crossing(g, lines, entering, alive, title) {
  const el = document.createElement('div');
  el.className = 'crossing';
  el.innerHTML = `<div class="crossing-text"><p class="kicker">${esc(t('crossKicker'))}<em>${esc(title)}</em></p>
    ${lines.map(l => typeof l === 'string' ? `<p class="line">${esc(l)}</p>` : `<p class="line small">${esc(l.text)}</p>`).join('')}</div>
    <p class="crossing-skip">${esc(t('crossSkip'))}</p>`;
  document.body.appendChild(el);
  let hurry = false;
  el.addEventListener('click', () => { hurry = true; });
  // the iris closes on the centre of the painting
  const c = g.project(g.paintGroup.getWorldPosition(new (g.paintGroup.position.constructor)()));
  el.style.setProperty('--cx', `${(c.x / innerWidth * 100).toFixed(1)}%`);
  el.style.setProperty('--cy', `${(c.y / innerHeight * 100).toFixed(1)}%`);
  const R0 = Math.hypot(innerWidth, innerHeight) * 0.75;
  await animate(1600, k => el.style.setProperty('--r', `${(R0 * (1 - k)).toFixed(1)}px`), k => k * k * (3 - 2 * k));
  el.classList.add('dark');
  if (!alive()) { el.remove(); return; }
  const ps = [...el.querySelectorAll('.line')];
  await sleep(250);
  for (const p of ps) {
    p.classList.add('show');
    const read = 800 + p.textContent.length * 30;
    for (let w = 0; w < read && !hurry; w += 100) await sleep(100);
    if (!alive()) { el.remove(); return; }
  }
  el.classList.add('can-skip');
  // hold until the walk-in is done (and a moment longer, unless they click)
  let done = false; entering.then(() => { done = true; });
  for (let w = 0; (!done || (w < 1400 && !hurry)) && alive(); w += 100) await sleep(100);
  // the words go first, then the dark lifts onto the inside of the picture
  el.classList.add('leaving');
  await sleep(600);
  el.classList.add('lift');
  setTimeout(() => el.remove(), 2200);
}
function animate(ms, fn, ease = k => k) {
  // smooth on animation frames, but also stepped by a timer, so it always finishes even
  // when the browser holds back frames (a background tab, a hidden window)
  return new Promise(res => {
    const t0 = performance.now(); let done = false;
    const step = () => {
      if (done) return;
      const k = Math.min(1, (performance.now() - t0) / ms); fn(ease(k));
      if (k >= 1) { done = true; clearInterval(iv); res(); }
    };
    const f = () => { step(); if (!done) requestAnimationFrame(f); };
    const iv = setInterval(step, 80);
    requestAnimationFrame(f);
  });
}

// ---- the ledger: what each world told the other, then the way into the finale ------
const firstSentence = s => {
  const parts = s.match(/[^.!?…。！？]+[.!?…。！？]+[”’」』]?/g) || [s];
  let out = parts[0].trim();
  if (out.length < 30 && parts[1]) out += ' ' + parts[1].trim();
  return out;
};
function showLedger(g = gallery) {
  if (!g || $('.ledger')) return;
  const talk = state.talk || [];
  const col = side => talk.filter(e => e.side === side).slice(0, 4)
    .map(e => `<li>${e.q ? `<span class="asked">${esc(e.q)}</span>` : ''}<span class="who">${esc(e.name)}</span><span class="said">${esc(firstSentence(e.text))}</span></li>`).join('');
  const el = document.createElement('div');
  el.className = 'ledger';
  el.innerHTML = `<div class="ledger-panel">
    <p class="kicker">${esc(t('ledgerKicker'))}</p>
    <div class="ledger-cols">
      <section><h3>${esc(t('ledgerIn'))}</h3><ul>${col('in')}</ul></section>
      <section><h3>${esc(t('ledgerOut'))}</h3><ul>${col('out')}</ul></section>
    </div>
    <p class="ledger-note">${esc(t('ledgerNote'))}</p>
    <div class="ledger-actions">
      <button class="btn ghost" data-action="ledger-close">${esc(t('ledgerStay'))}</button>
      <button class="btn" data-action="finale" data-mode="sculpt">${esc(t('ledgerMonument'))}</button>
      <button class="btn primary cta" data-action="finale" data-mode="compose">${esc(t('ledgerCollage'))}</button>
    </div></div>`;
  document.body.appendChild(el);
  state.ledgerOpen = true;
  requestAnimationFrame(() => el.classList.add('show'));
  // the lines arrive one by one, alternating between the two worlds
  const [inL, outL] = [...el.querySelectorAll('section')].map(s => [...s.querySelectorAll('li')]);
  const order = [];
  for (let i = 0; i < Math.max(inL.length, outL.length); i++) { if (inL[i]) order.push(inL[i]); if (outL[i]) order.push(outL[i]); }
  order.forEach((li, k) => setTimeout(() => li.classList.add('show'), 700 + k * 420));
  controls(`<button class="btn" data-action="ledger-open">${esc(t('ledgerOpen'))}</button>
    <button class="btn primary cta" data-action="to-create">${esc(t('create'))}</button>`);
}
function closeLedger() {
  const el = $('.ledger');
  state.ledgerOpen = false;
  if (!el) return;
  el.classList.remove('show');
  setTimeout(() => el.remove(), 700);
}

// ---- part 2: inside. The painted animals were only paint. They freeze, stare at
// the visitor, come alive, and each side learns how the other lives.
async function insideStory(g, tok) {
  const alive = () => g === gallery && tok === storyToken && g.inside;
  const x = W(state.work.id), kind = kindOf();
  const H = state.hosts.length, hid = i => state.hosts[i % H].id;
  const B = H > 1 ? 1 : 0;
  await sleep(900);
  if (!alive()) return;
  // first of all the visitor turns to the painted animal that is about to speak: face to face
  g.partner = 0;
  g.convo = { speaker: 0, listener: 'visitor', t: performance.now(), dur: 2400 };
  await sleep(900);
  if (!alive()) return;
  // the opening: a fixed little scene the visitor does not steer
  await g.startle();
  await speak(0, t('insideStartled'));
  await speak(0, t('openShy'));
  // it starts: a painting just spoke! (a realistic model calls out with its own voice clip)
  if (!g.visitor.gesture?.('call')) g.visitor.nod?.(2);      // (no hop: it only stands, walks or moves its head)
  await speak('visitor', t('openAmazed'));
  await speak('visitor', t('openSorry'));
  await speak(B, t(H > 1 ? 'openWhisper' : 'openWhisperSolo'));
  await speak('visitor', t('openFriendly'));
  for (let i = 0; i < H; i++) { g.wakeHost(i); await sleep(400); }
  state.hostAwake = true;
  const leader = state.hosts.findIndex(h => !h.inPlace);
  if (leader >= 0) {
    await speak(leader, t('openFollow'));
    await speak('visitor', t('openOkay'));
    if (!alive()) return;
    await g.lead(leader);
    await speak(leader, t('openHere'));
    await speak('visitor', t('openWow'));
  }
  else if (alive()) {
    // every painted animal here stays in its place: the visitor walks over to the one that
    // spoke first, to see it close
    await g.meet(0);
  }
  if (!alive()) return;
  // the opening is over: now the view is yours
  g.locked = false;
  status(`<strong>${esc(t('lookNow'))}</strong> ${esc(tracker ? t('insideHint') : t('insideHintMouse'))}`);
  setTimeout(() => { if (gallery === g && !g.locked) status(''); }, 10000);
  // getting to know each other: a different mix every visit, and every question is answered.
  // Before each exchange the two walk towards each other.
  const life = t(`life.${kind}`), host = i => t(`hostLife.${hid(i)}`);
  const cat = kind === 'drawing' ? 'drawing' : ['dog', 'cat', 'horse', 'cattle', 'alpaca', 'donkey', 'rabbit'].includes(kind) ? 'home' : 'wild';
  const vQ = shuffled([0, 1, 2, 3, 4, 5, 6, 7]).slice(0, 3), hQ = shuffled([0, 1, 2, 3, 4, 5, 6, 7]).slice(0, 3);
  const free = [...Array(H).keys()].filter(i => !state.hosts[i].inPlace);
  const asker = n => free.length ? free[n % free.length] : 0;
  // each answer carries the things it talks about (exchange.js): the finale is made of them
  const pairs = [
    [asker(0), t('insideAskOut'), 'visitor', life[0], `life.${kind}.0`],
    ['visitor', t('insideAskIn'), asker(0), host(asker(0))[0], `hostLife.${hid(asker(0))}.0`],
    ...vQ.flatMap((qi, n) => [
      [asker(n + 1), t('askVisitor')[qi], 'visitor', t(`answerVisitor.${cat}`)[qi], `answerVisitor.${cat}.${qi}`],
      ['visitor', t('askHost')[hQ[n]], asker(n), t(`answerHost.${state.work.id}`)[hQ[n]], `answerHost.${state.work.id}.${hQ[n]}`],
    ]),
    ['visitor', t('insideAskDay'), asker(1), host(asker(1))[1], `hostLife.${hid(asker(1))}.1`],
  ];
  for (const [q, ql, a, al, path] of pairs) {
    if (!alive()) return;
    const hostIdx = q === 'visitor' ? a : q;
    g.partner = hostIdx;
    await g.meet(hostIdx);                                  // (returns at once if they are already together)
    await speak(q, ql); await speak(a, al, { tags: tagsOf(path), q: ql });
    if (Math.random() < 0.3) await speak(q, pickLine(t(q === 'visitor' ? 'reactionsToHost' : 'reactions')));
  }
  g.partner = 0;
  const friend = await askUser(0, t('insideAskFriend'));
  if (!alive()) return;
  if (friend) await speak(0, friend === 'yes' ? t('insideFriendYes') : t('insideFriendNo'));
  await speak('visitor', t('insideLeave'));
  await speak(B, t('insideRemember'));
  if (!alive()) return;
  await sleep(900);
  if (!alive()) return;
  showLedger(g);                                            // what they told each other → make something of it
  insideLife(g, tok);
}

// inside the painting: a steady, readable conversation around the visitor
async function insideLife(g, tok) {
  const alive = () => g === gallery && tok === storyToken && g.inside;
  const qa = shuffled(t('qa').filter((_, k) => k >= 1 && k < 7 && k !== 3)),   // (no 'can you run fast?': they only walk)
    ask = shuffled(t('askYou')), toYou = shuffled(t('visitorAskYou'));
  const chorus = shuffled(W(state.work.id).chorus);
  const awake = () => state.hosts.map((h, i) => i).filter(i => g.hosts[i].awake);
  let n = 0;
  while (alive()) {
    await sleep(2200 + Math.random() * 2200);
    while (state.ledgerOpen && alive()) await sleep(400);      // quiet while the ledger is open
    if (!alive()) break;
    const hs = awake(), i = hs[n % hs.length];
    g.partner = i;
    const kind = ['qa', 'ask', 'chorus', 'qa', 'you', 'ask'][n % 6]; n++;
    if (kind === 'qa' && qa.length) {
      const [q, ans, back] = qa.shift();
      await g.meet(i);                                // walk up to each other first
      if (!alive()) break;
      await speak(i, q);
      if (/run fast/i.test(q)) {                      // show, don't tell
        const p0 = g.visitor.position.clone(), p1 = p0.clone(); p1.x += p0.x > 0 ? -0.6 : 0.6;
        g.visitor.walkTo(p1, 1.0, { run: true }).then(() => g.visitor.walkTo(p0, 1.0, { run: true }));
      }
      await speak('visitor', ans); await speak(i, back);
    } else if (kind === 'ask' && ask.length) {
      const [q, yes, no] = ask.shift();
      const a = await askUser(i, q);
      if (a) await speak(i, a === 'yes' ? yes : no);
    } else if (kind === 'you' && toYou.length) {
      const [q, yes, no] = toYou.shift();
      const a = await askUser('visitor', q);
      if (a) await speak('visitor', a === 'yes' ? yes : no);
    } else if (chorus.length) { await speak(i, chorus.shift()); await speak('visitor', pickLine(t('reactionsToHost'))); }
    else if (!qa.length && !ask.length) { await sleep(6000); }
  }
}

// per frame: parallax from your head (or the mouse) and the host's role reaction
let pointer = null, drag = null;
function stageFrame(g) {
  // your animal watches you when you move your head or raise a hand (for ~3 s after)
  const now = performance.now();
  if (face && stageFrame.fx !== undefined && Math.abs(face.x - stageFrame.fx) > 0.015) stageFrame.moved = now;
  if (face) stageFrame.fx = face.x;
  if (hands[0]) stageFrame.moved = now;
  const src = hands[0] || face;
  // (a hand that is pinching or open is steering the view, not asking to be followed)
  g.userGaze = src && now - (stageFrame.moved || 0) < 3000 ? { x: src.x, y: src.y, active: true, gesture: !!(hands[0] && (hands[0].pinch || hands[0].open)) } : null;
  if (g.visitor) g.visitor.calm = g.inside;
  if (g.inside && g.userGaze && state.hostAwake && !g.talking()) {   // painted animals turn towards your side (not mid-conversation)
    const you = g.userGaze.x * innerWidth;
    g.hosts.forEach((h, i) => { if (h.awake && !h.actor.target) h.actor.setDir(Math.sign(you - g.project(g.anchor(i)).x) || 1); });
  }
  if (face) g.parallax.set((face.x - 0.5) * 2.2, -(face.y - 0.45) * 2.2);
  else if (pointer && !g.inside) g.parallax.set(pointer[0], pointer[1]);
  if (!state.hostAwake || g.inside) return;
  // where are you? your face, your hand, or the mouse, in screen x
  const you = face ? face.x * innerWidth : hands[0] ? hands[0].x * innerWidth : pointer ? (pointer[0] + 1) / 2 * innerWidth : null;
  if (you === null) return;
  g.hosts.forEach((h, i) => {
    if (!h.awake || h.actor.target || h.actor.attending) return;
    const hx = g.project(g.anchor(i)).x;
    const toward = Math.sign(you - hx) || 1;
    h.actor.setDir(state.role === 'guard' ? -toward : toward);   // the guard's animals turn away
  });
}
const stage3d = $('#stage3d');
stage3d.addEventListener('pointermove', e => {
  pointer = [e.clientX / innerWidth * 2 - 1, -(e.clientY / innerHeight * 2 - 1)];
  if (drag && gallery?.inside) {
    // drag = move the view across the picture (like the pinched hand)
    gallery.panBy(-(e.clientX - drag[0]) / innerWidth * gallery.pw * 0.9, (e.clientY - drag[1]) / innerHeight * gallery.ph * 0.9);
    if (Math.hypot(e.clientX - drag[2], e.clientY - drag[3]) > 6) drag.moved = true;
    drag[0] = e.clientX; drag[1] = e.clientY;
  }
});
stage3d.addEventListener('pointerdown', e => { drag = [e.clientX, e.clientY, e.clientX, e.clientY]; });
stage3d.addEventListener('pointerup', e => {
  const wasDrag = drag?.moved; drag = null;
  if (!gallery || wasDrag) return;
  const nx = e.clientX / innerWidth * 2 - 1, ny = -(e.clientY / innerHeight * 2 - 1);
  if (gallery.visitorAt(nx, ny)) return greetBack();       // click your animal: it greets you
  const other = gallery.sideAt(nx, ny);
  if (other) return switchWork(other.id, other.side);
  if (gallery.inside) tapInside(nx, ny);
});
stage3d.addEventListener('wheel', e => { if (gallery?.inside) { e.preventDefault(); gallery.zoomBy(-e.deltaY * 0.0015); } }, { passive: false });

// a tap/pinch inside the picture: call the animal under it, or walk there
function tapInside(nx, ny) {
  if (gallery.locked) return;
  const i = gallery.hostAt(nx, ny);
  if (i >= 0) { gallery.callHost(i); speak(i, pickLine(t('called'))); }
  else gallery.walkVisitorToScreen(nx, ny);
}

// you waved (or clicked the visitor): everyone turns to you; the visitor waves back
let lastGreet = 0;
function greetBack() {
  if (!gallery || performance.now() - lastGreet < 2500) return;
  lastGreet = performance.now();
  const g = gallery;
  waveWaiter?.();
  if (!g.visitor.gesture?.('shake')) g.visitor.nod(2);
  g.hosts.forEach(h => { if (h.awake) h.actor.nod(2); });
  if (!pendingAnswer) { g.attendAll(true); setTimeout(() => { if (!pendingAnswer && gallery === g) g.attendAll(false); }, 3500); }
  speak('visitor', pickLine(t('waveBack')));
}

// ---------------------------------------------------------------- camera events
let lastPinchWalk = 0;
function onGesture(g) {
  const view = document.querySelector('.view.is-active')?.id;
  if (view === 'view-stage' && gallery) {
    if (g === 'nod') giveAnswer('yes');
    else if (g === 'shake') giveAnswer('no');
    else if (g === 'wave') greetBack();
  }
  if (view === 'view-create') {
    const step = g === 'swipeLeft' ? -1 : g === 'swipeRight' ? 1 : 0;
    if (!step) return;
    if (!$('#compose-wrap').hidden) { composer?.nextVariant(step); syncVariant(); }
    else { sculpt?.nextForm(step); syncForm(); }
  }
}
function onHands(hs) {
  const view = document.querySelector('.view.is-active')?.id;
  // inside the painting:
  //   two hands moving apart = zoom in · moving together = zoom out (all the way to the whole painting)
  //   one hand pinched and dragged = move the view across the picture
  if (view === 'view-stage' && gallery?.inside) {
    if (hs.length >= 2) {
      onHands.pinch = null;
      const d = Math.hypot(hs[0].x - hs[1].x, hs[0].y - hs[1].y);
      if (onHands.span != null) {
        const dd = d - onHands.span;
        if (Math.abs(dd) > 0.003) gallery.zoomBy(dd * 3.2);   // spread ~0.3 of the view = a full zoom step
      }
      onHands.span = d;
    } else {
      onHands.span = null;
      const h = hs[0];
      if (h && h.pinch) {
        const ps = onHands.pinch;
        if (ps) gallery.panBy(-(h.pinchX - ps.x) * gallery.pw * 1.1, (h.pinchY - ps.y) * gallery.ph * 1.1);
        onHands.pinch = { x: h.pinchX, y: h.pinchY };
      } else onHands.pinch = null;
    }
  }
  if (view !== 'view-create' && !(view === 'view-stage' && gallery?.inside)) { $('#hand-cursor').hidden = $('#hand-cursor-2').hidden = true; return; }
  const c1 = $('#hand-cursor'), c2 = $('#hand-cursor-2');
  [c1, c2].forEach((c, i) => {
    const h = hs[i];
    c.hidden = !h;
    if (h) { c.style.left = h.pinchX * innerWidth + 'px'; c.style.top = h.pinchY * innerHeight + 'px'; c.classList.toggle('pinch', h.pinch); }
  });
  if (view !== 'view-create') return;
  if (!$('#compose-wrap').hidden) { composer?.handInput(hs); return; }
  sculpt?.handInput(hs);
}

// ---------------------------------------------------------------- 7 · create
function goCreate(mode) {
  closeLedger();
  storyToken++; giveAnswer(null); gallery?.dispose(); gallery = null; clearBubbles(); status(''); controls('');
  enterCreate(mode);
}
async function enterCreate(mode = 'sculpt') {
  show('create');
  $('#create-modes').innerHTML = ['sculpt', 'compose'].map(m =>
    `<button role="tab" data-action="create-mode" data-mode="${m}" aria-selected="${m === mode}">${esc(t(m === 'sculpt' ? 'modeSculpt' : 'modeCompose'))}</button>`).join('');
  if (mode === 'sculpt') await openSculpt(); else await openCompose();
}

async function openSculpt() {
  $('#compose-wrap').hidden = true; $('#sculpt-canvas').hidden = false;
  if ($('#collage-shelf')) $('#collage-shelf').hidden = true;
  createStatus(t('monumentTalk') + ' ' + t('monumentHint') + (tracker ? ' ' + t('monumentHands') : ''));
  $('#create-tools').innerHTML = `
    <div class="segmented" role="group" id="form-group">${['stele', 'cube', 'drum', 'chalice', 'medallion'].map(f =>
      `<button data-action="form" data-form="${f}" aria-pressed="${f === (sculpt?.form || 'stele')}">${esc(t(`forms.${f}`))}</button>`).join('')}</div>
    <div class="segmented" role="group" id="mat-group">${['marble', 'bronze', 'clay', 'painted'].map(m =>
      `<button data-action="material" data-mat="${m}" aria-pressed="${m === 'marble'}">${esc(t(`materials.${m}`))}</button>`).join('')}</div>
    <button class="btn small" data-action="export-glb">${esc(t('exportGLB'))}</button>
    <button class="btn primary cta" data-action="card">${esc(t('makeCard'))}</button>`;
  if (sculpt) return;
  const v = state.visitor;
  let visitorStatue;
  if (v.kind === 'animal3d') { const a = animal3dById(v.id); visitorStatue = { kind: 'animal3d', glb: a.glb, height: a.height }; }
  else visitorStatue = { kind: 'slab', src: v.kind === 'drawing' ? v.canvas : v.species.storybook, height: 0.55 };
  const { createMonument } = await import('./monument.js');
  await document.fonts.ready;
  const tp = await talkPieces();
  sculpt = await createMonument($('#sculpt-canvas'), {
    work: state.work, visitor: visitorStatue,
    objects: tp.real.filter(isSolid).slice(0, 3).map(drawnCutout),
    inscription: {
      head: fill(t('inscriptionHead', { title: W(state.work.id).title })),
      lines: (state.talk || []).map(e => `“${firstSentence(e.text)}” — ${e.name}`).filter(l => l.length < 100).slice(0, 5),
    },
    statues: state.hosts.map(h => ({ kind: 'slab', src: h.sprite, height: Math.min(0.75, Math.max(0.3, (hostMeta[h.id].box[3] - hostMeta[h.id].box[1]) / state.work.size[1] * 2.2)), flip: h.faces === 'left' })),
  });
  window.__aia.sculpt = sculpt;          // console/debug access only
}
function syncForm() {
  document.querySelectorAll('#form-group button').forEach(b => b.setAttribute('aria-pressed', b.dataset.form === sculpt?.form));
}
function syncMaterial() {
  document.querySelectorAll('#mat-group button').forEach(b => b.setAttribute('aria-pressed', b.dataset.mat === sculpt?.material));
}
function createStatus(text, append = false) {
  const el = $('#create-status');
  el.classList.remove('folded'); clearTimeout(createStatus.t);
  createStatus.t = setTimeout(() => el.classList.add('folded'), 9000);
  if (!append) el.innerHTML = `<strong>${esc(t('createHeading'))}</strong>`;
  el.insertAdjacentHTML('beforeend', `<div>${esc(text)}</div>`);
}

let collage = null;
async function openCompose() {
  $('#sculpt-canvas').hidden = true; $('#compose-wrap').hidden = false;
  createStatus(t('composeTalkHint') + (tracker ? ' ' + t('composeHands') : ''));
  const { Composer, VARIANTS, SEASONS } = await import('./compose.js');
  collage ??= await (await fetch('assets/collage/collage.json')).json();
  $('#create-tools').innerHTML = `
    <label class="check"><input type="checkbox" id="meet-toggle" checked> ${esc(t('twoWorlds'))}</label>
    <label>${esc(t('background'))}<select id="bg-select">${WORKS.map(w => `<option value="${w.id}" ${w.id === state.work.id ? 'selected' : ''}>${esc(W(w.id).title)}</option>`).join('')}</select></label>
    <label>${esc(t('season'))}<select id="season-select">${SEASONS.map(v => `<option value="${v}">${esc(t(`seasons.${v}`))}</option>`).join('')}</select></label>
    <label>${esc(t('variant'))}<select id="variant-select">${VARIANTS.map(v => `<option value="${v}">${esc(t(`variants.${v}`))}</option>`).join('')}</select></label>
    <button class="btn small ghost" data-action="shuffle-layout">${esc(t('shuffleLayout'))}</button>
    <button class="btn small ghost" data-action="remove-sel">${esc(t('removeSel'))}</button>
    <button class="btn primary cta" data-action="card">${esc(t('makeCard'))}</button>`;
  await document.fonts.ready;
  const tp = await talkPieces();
  // the shelf: first everything this conversation mentioned, then every animal in the collection
  let shelf = $('#collage-shelf');
  if (!shelf) { shelf = document.createElement('div'); shelf.id = 'collage-shelf'; shelf.className = 'collage-shelf glass'; $('#view-create').appendChild(shelf); }
  shelf.hidden = false;
  const thumb = c => { const k = 120 / Math.max(c.width, c.height), d = document.createElement('canvas'); d.width = c.width * k; d.height = c.height * k; d.getContext('2d').drawImage(c, 0, 0, d.width, d.height); return d.toDataURL(); };
  shelf.innerHTML = `<h3>${esc(t('fromTalk'))}</h3><div class="shelf-row">${tp.all.map((p, i) =>
    `<button class="pick piece" data-action="add-piece" data-i="${i}"><img src="${thumb(p.img)}" alt=""><span>${esc(p.label)}</span></button>`).join('')}</div>
    <h3 style="margin-top:16px">${esc(t('addAnimals'))}</h3><div class="shelf-row">${Object.entries(collage).map(([id, c]) =>
    `<button class="pick" data-action="add-collage" data-id="${id}"><img src="assets/collage/${id}.webp" alt=""><span>${esc(LANG === 'en' ? c.name : (STRINGS[LANG].collageNames?.[id] || c.name))}</span></button>`).join('')}</div>`;
  if (!composer) {
    const v = state.visitor;
    let vimg, vflip = false;
    if (v.kind === 'animal3d') vimg = await loadImage(animal3dById(v.id).thumb);          // thumbnails face left
    else if (v.kind === 'drawing') { vimg = v.canvas; vflip = v.facing === 'right'; }
    else { vimg = await loadImage(v.species.storybook); vflip = v.species.faces === 'right'; }
    // they meet at the tear: the painted animal on the painting, the visitor on the page
    const A = workById(state.work.id).size[0] / workById(state.work.id).size[1], sz = A < 1 ? 0.19 : 0.26;
    const items = [{ img: vimg, x: 0.76, y: 0.95, s: sz, r: 0, flip: vflip }];
    let k = 0;
    for (const h of state.hosts) {
      if (!collage[h.id]) continue;
      items.push({ img: await loadImage(`assets/collage/${h.id}.webp`), x: 0.48 - k * 0.15, y: 0.95 - k * 0.04, s: sz - k * 0.03, r: 0, flip: h.faces === 'left' });
      k++;
    }
    composer = new Composer($('#compose-canvas'), { items });
    window.__aia.composer = composer;
    composer.meet = true;
    await setComposeBackground(state.work.id);
    layoutTalk(tp);
    addEventListener('resize', () => composer?.resize());
  }
  $('#meet-toggle').checked = composer.meet;
  $('#meet-toggle').addEventListener('change', e => composer.setMeet(e.target.checked));
  $('#bg-select').addEventListener('change', e => setComposeBackground(e.target.value));
  $('#variant-select').addEventListener('change', e => composer.setVariant(e.target.value));
  $('#season-select').addEventListener('change', e => composer.setSeason(e.target.value));
  composer.onChange = syncVariant;
  syncVariant();
}

// what this visit's conversation was about: things from each world, and lines to quote
let talkCache = null;
async function talkPieces() {
  if (talkCache?.talk === state.talk) return talkCache;
  const talk = state.talk || [];
  let ids = motifsOf(talk);
  if (!ids.length) {           // they went straight to making something: use what each side would have said
    const kind = kindOf();
    ids = [...new Set([0, 1].flatMap(n => [...tagsOf(`life.${kind}.${n}`), ...state.hosts.flatMap(h => tagsOf(`hostLife.${h.id}.${n}`))]))];
  }
  const real = ids.filter(id => !isPainted(id)), painted = ids.filter(id => isPainted(id) && FRAGMENTS[id].work === state.work.id);
  const pick = side => { const c = talk.filter(e => e.side === side).map(e => ({ ...e, line: firstSentence(e.text) })).filter(e => e.line.length < 95); return c[Math.floor(Math.random() * c.length)]; };
  const quotes = [pick('in'), pick('out')].filter(Boolean);
  const all = [
    ...await Promise.all(painted.map(async id => ({ id, kind: 'painted', label: t(`fragments.${id}`), img: await fragmentPiece(id, state.work, t(`fragments.${id}`)) }))),
    ...real.map(id => ({ id, kind: 'real', label: t(`pieces.${id}`), img: drawnPiece(id, t(`pieces.${id}`)) })),
    ...quotes.map(q => ({ id: 'q:' + q.line, kind: q.side === 'in' ? 'qin' : 'qout', label: q.line, img: quoteSlip(q.line, q.name, q.side === 'in') })),
  ];
  talkCache = { talk: state.talk, all, real, painted, quotes };
  return talkCache;
}

// arrange the pieces: torn fragments on the painting, drawings on the notebook page, the two
// quotes pinned over the tear. Animals stay where they are. Random each time, never piled up.
function layoutTalk(tp) {
  const A = composer.base.width / composer.base.height;
  const k = A < 1 ? 1.5 : 1;                    // a tall picture is narrow: pieces take more of its width
  composer.items = composer.items.filter(it => !it.flat);
  const jit = (v, a) => v + (Math.random() - 0.5) * a;
  const place = (p, x, y, wf, rot) => composer.items.push({ img: p.img, x: jit(x, 0.02), y: jit(y, 0.025), s: Math.min(0.3, wf * k * A / (p.img.width / p.img.height)), r: jit(0, rot), flip: false, flat: true, piece: p.id });
  const S = arr => [...arr].sort(() => Math.random() - 0.5);
  const paintedSlots = S([[0.12, 0.36], [0.33, 0.31], [0.12, 0.68], [0.34, 0.63]]);
  const realSlots = S([[0.75, 0.36], [0.9, 0.33], [0.74, 0.66], [0.91, 0.64]]);
  tp.all.filter(p => p.kind === 'painted').slice(0, 4).forEach((p, i) => place(p, ...paintedSlots[i], 0.17, 0.16));
  tp.all.filter(p => p.kind === 'real').slice(0, 4).forEach((p, i) => place(p, ...realSlots[i], 0.115, 0.26));
  const qin = tp.all.find(p => p.kind === 'qin'), qout = tp.all.find(p => p.kind === 'qout');
  if (qin) place(qin, 0.42, 0.13, 0.25, 0.07);
  if (qout) place(qout, 0.8, 0.12, 0.25, 0.07);
  // drawn on top of the background, under the animals
  const animals = composer.items.filter(it => !it.flat);
  composer.items = [...composer.items.filter(it => it.flat), ...animals];
  composer.render();
}
async function setComposeBackground(id) {
  const w = workById(id);
  const own = id === state.work.id && !state.host.inPlace;   // the host left its place in its own painting
  await composer.setBackground(w, own ? { src: state.host.patch, box: hostMeta[state.host.id].box } : null);
}
function syncVariant() { if ($('#variant-select') && composer) { $('#variant-select').value = composer.variant; $('#season-select').value = composer.season; } }

function pressGroup(btn) { btn.parentElement.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', b === btn)); }

async function exportGLB() {
  const blob = await sculpt.exportGLB();
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = 'animals-in-the-archive-monument.glb';
  a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}

// ---------------------------------------------------------------- 8 · card
async function openCard() {
  const w = state.work, x = W(w.id), v = state.visitor;
  const composing = !$('#compose-wrap').hidden;
  const shot = composing ? composer.toDataURL() : sculpt.screenshot();
  state.made = composing ? t('madePainting', { variant: t(`variants.${composer.variant}`) }) : t('madeSculpture', { material: t(`materials.${sculpt.material}`).toLowerCase() });
  const date = new Date();
  const blob = await makeCard({
    screenshot: shot, record: recordNumber(date), date: date.toISOString().slice(0, 10),
    work: w, workText: x, roleName: t(`roles.${state.role}.name`),
    speciesName: `${state.name}, ${v.kind === 'species' ? `${t(`species.${v.species.id}`)} (${t(`speciesLatin.${v.species.id}`)})` : visitorKind()}`,
    hostName: state.hosts.map(h => t(`hostNames.${h.id}`)).join(', '), mood: t(`moods.${state.role}.${state.answer || 'yes'}`), made: state.made,
    photoCredit: v.kind === 'drawing' ? t('cardDrawingCredit') : v.kind === 'animal3d' ? (animal3dById(v.id).real
        ? t('card3dRealCredit', { title: animal3dById(v.id).real.title, author: animal3dById(v.id).real.author, licence: animal3dById(v.id).real.licence })
        : t('card3dCredit', { name: t(`animals3d.${v.id}`) }))
      : t('cardPhotoCredit', { file: v.species.file + '.png' }),
    figure: composing,
    told: [(state.talk || []).find(e => e.side === 'in'), (state.talk || []).find(e => e.side === 'out')].filter(Boolean)
      .map(e => `“${firstSentence(e.text)}” (${e.name})`).join('  ·  '),
  });
  if (cardUrl) URL.revokeObjectURL(cardUrl);
  cardUrl = URL.createObjectURL(blob);
  openModal(`
    <p class="kicker">${esc(t('stepOf', { n: 6 }))}</p>
    <h2>${esc(t('cardHeading'))}</h2>
    <p class="sub">${esc(t('cardIntro'))}</p>
    <div class="card-preview"><img src="${cardUrl}" alt="${esc(t('cardHeading'))}"></div>
    <div class="modal-actions">
      <button class="btn ghost" data-action="play-again">${esc(t('playAgain'))}</button>
      <a class="btn primary cta" href="${cardUrl}" download="animals-in-the-archive-card.png">${esc(t('cardDownload'))}</a>
    </div>`, { wide: true });
}

function teardown() {
  workNav(false); $('.veil')?.remove();
  closeLedger(); document.querySelectorAll('.crossing').forEach(e => e.remove());
  storyToken++; giveAnswer(null); speechLock = Promise.resolve();
  gallery?.dispose(); gallery = null;
  sculpt?.dispose(); sculpt = null;
  composer = null; clearBubbles(); status(''); controls('');
  if ($('#collage-shelf')) $('#collage-shelf').hidden = true;
  $('#compose-canvas').getContext('2d').clearRect(0, 0, 9999, 9999);
}
function playAgain() {
  teardown();
  if (cardUrl) { URL.revokeObjectURL(cardUrl); cardUrl = null; }
  Object.assign(state, { work: null, role: null, visitor: null, host: null, answer: null, made: null });
  closeModal(); show('index');
}

// ---------------------------------------------------------------- credits
function renderCredits() {
  const c = t('creditsData'), L = k => esc(t(`credits.${k}`));
  const tbv = s => esc(s).replace(/(to be verified|to be confirmed)/g, '<span class="tbv">$1</span>');
  const link = u => `<a href="${esc(u)}" target="_blank" rel="noopener">${esc(u.replace(/^https?:\/\//, '').slice(0, 46))}…</a>`;
  $('#credits-body').innerHTML = `
    <h2>${L('paintings')}</h2><div class="scroll"><table>
      <tr><th>${L('work')}</th><th>${L('author')}</th><th>${L('date')}</th><th>${L('collection')}</th><th>${L('source')}</th><th>${L('licence')}</th></tr>
      ${c.paintings.map(p => `<tr><td><em>${esc(p.work)}</em></td><td>${esc(p.author)}</td><td>${tbv(p.date)}</td><td>${tbv(p.collection)}</td><td>${link(p.source)}</td><td>${tbv(p.licence)}</td></tr>`).join('')}
    </table></div>
    <h2>${L('hosts')}</h2><p class="note">${L('hostNote')}</p>
    <h2>${L('photos')}</h2><p class="note">${L('photoNote')}</p><div class="scroll"><table>
      <tr><th>${L('file')}</th><th>${L('species')}</th><th>${L('photographer')}</th><th>${L('record')}</th><th>${L('recorded')}</th><th>${L('via')}</th></tr>
      ${c.photos.map(p => `<tr><td>${esc(p.file)}</td><td>${esc(p.species)}</td><td class="tbv">${L('tbc')}</td><td>${link(p.record)}</td><td>${esc(p.recorded)} · <span class="tbv">${L('tbc')}</span></td><td>${esc(p.via)}</td></tr>`).join('')}
    </table></div>
    <h2>${L('models3d')}</h2><p class="note">${L('modelsNote')}</p><div class="scroll"><table>
      <tr><th>${L('file')}</th><th>${L('model')}</th><th>${L('source')}</th><th>${L('licence')}</th></tr>
      ${ANIMALS3D.filter(a => a.real).map(a => `<tr><td>${esc(a.glb.split('/').pop())}</td><td>${esc(a.real.title)} · ${esc(a.real.author)}</td><td>${link(a.real.url)}</td><td>${esc(a.real.licence)}</td></tr>`).join('')}

    </table></div>
    <h2>${L('software')}</h2><div class="scroll"><table>
      <tr><th>${L('item')}</th><th>${L('version')}</th><th>${L('use')}</th><th>${L('licence')}</th></tr>
      ${c.software.map(s => `<tr><td>${esc(s.item)}</td><td>${esc(s.version)}</td><td>${esc(s.use)}</td><td>${tbv(s.licence)}</td></tr>`).join('')}
    </table></div>`;
}

// ---------------------------------------------------------------- events
document.addEventListener('click', e => {
  const el = e.target.closest('[data-action], .entry');
  if (!el) return;
  const a = el.dataset.action || 'open-work';
  if (el.tagName === 'A' && el.hasAttribute('download')) return;
  if (a !== 'open-work') e.preventDefault();
  switch (a) {
    case 'open-work': openRecord(el.dataset.work); break;
    case 'home': teardown(); closeModal(); show('index'); break;
    case 'credits': teardown(); renderCredits(); closeModal(); show('credits'); break;
    case 'close-modal': closeModal(); break;
    case 'to-role': openRole(); break;
    case 'back-record': openRecord(state.work.id); break;
    case 'pick-role':
      state.role = el.dataset.role;
      panel.querySelectorAll('.choice').forEach(c => c.setAttribute('aria-pressed', c === el));
      panel.querySelector('[data-action="to-camera"]').disabled = false; break;
    case 'to-camera': openCamera(); break;
    case 'cam-start': startCamera(); break;
    case 'cam-skip': openVisitor(); break;
    case 'cam-stop': stopCamera(); break;
    case 'back-role': show('index'); openRole(); break;
    case 'facing': state.facing = el.dataset.facing; pressGroup(el); break;
    case 'swatch': state.colour = el.dataset.colour; pressGroup(el); break;
    case 'draw-clear': openVisitor.pad.clear(); $('#draw-pad').classList.remove('revealed'); $('#draw-result').innerHTML = ''; break;
    case 'draw-go': recogniseSketch(); break;
    case 'choose-drawing': {
      const pad = openVisitor.pad;
      if (pad.isEmpty()) { $('#draw-result').innerHTML = `<p class="status">${esc(t('drawEmpty'))}</p>`; break; }
      const canvas = drawingToCharacter(pad.canvas, state.colour);
      if (canvas) choose({ kind: 'drawing', canvas, facing: state.facing });
      break;
    }
    case 'choose-3d': choose({ kind: 'animal3d', id: el.dataset.id, look: state.choice.look || 'real' }); break;
    case 'choose-2d': choose({ kind: 'species', species: speciesById(el.dataset.species) }); break;
    case 'tt-anim': pressGroup(el); turntable?.setAnim(el.dataset.anim); break;
    case 'tt-look': pressGroup(el); state.choice.look = el.dataset.look; choose(state.choice); break;
    case 'walk-in': state.from = -1; state.switched = false; state.name = $('#vname').value.trim().slice(0, 16) || pickLine(t('names')); enterStage({ ...state.choice }); break;
    case 'answer': giveAnswer(el.dataset.answer); break;
    case 'step-in': stepIn(); break;
    case 'switch-work': switchWork(el.dataset.work, +el.dataset.side); break;
    case 'to-create':
      if (gallery?.inside && state.talk?.length && !$('.ledger')) { showLedger(); break; }
      goCreate('compose'); break;
    case 'finale': goCreate(el.dataset.mode); break;
    case 'ledger-close': closeLedger(); break;
    case 'ledger-open': showLedger(); break;
    case 'create-mode':
      $('#create-modes').querySelectorAll('button').forEach(b => b.setAttribute('aria-selected', b === el));
      if (el.dataset.mode === 'sculpt') openSculpt(); else openCompose(); break;
    case 'material': pressGroup(el); sculpt?.setMaterial(el.dataset.mat); break;
    case 'form': pressGroup(el); sculpt?.setForm(el.dataset.form); break;
    case 'add-piece': talkPieces().then(tp => { const p = tp.all[+el.dataset.i]; const A = composer.base.width / composer.base.height;
      composer?.addItem(p.img, 0.2 + Math.random() * 0.6, 0.3 + Math.random() * 0.5, (p.kind[0] === 'q' ? 0.25 : p.kind === 'real' ? 0.12 : 0.17) * A / (p.img.width / p.img.height), { flat: true, piece: p.id, r: (Math.random() - 0.5) * 0.2 }); }); break;
    case 'shuffle-layout': talkPieces().then(layoutTalk); break;
    case 'add-collage': loadImage(`assets/collage/${el.dataset.id}.webp`).then(img => composer?.addItem(img, 0.12 + Math.random() * 0.76, 0.7 + Math.random() * 0.25, 0.14 + Math.random() * 0.1)); break;
    case 'remove-sel': composer?.removeSelected(); break;
    case 'export-glb': exportGLB(); break;
    case 'card': openCard(); break;
    case 'play-again': playAgain(); break;
  }
});
document.addEventListener('keydown', e => {
  if ((e.key === 'Enter' || e.key === ' ') && e.target.classList?.contains('entry')) { e.preventDefault(); openRecord(e.target.dataset.work); }
});
document.addEventListener('visibilitychange', () => { if (document.hidden && tracker) stopCamera(); });

renderIndex();
window.__aia = { state, STRINGS, get gallery() { return gallery; },
  // testing only: feed fake camera input (a face, hands, a gesture) without a camera
  sim: { face: f => { face = f; }, hands: h => { hands = h; onHands(h); }, gesture: x => onGesture(x) } };   // console/debug access only

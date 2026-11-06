// Animals in the Archive: flow controller.
// index → record → role → camera (optional) → visitor (draw or archive)
//   → gallery: walk in, look back, the painted animal wakes and asks
//   → step into the painting → create (sculpt 3D / new painting 2D) → card.
// No data is stored or sent anywhere; state lives in memory only.

import { t, STRINGS, LANG } from './strings.js';
import { WORKS, SPECIES, HOSTS, ANIMALS3D, workById, speciesById, animal3dById } from './data.js';
import { loadClassifier, createPad, classify, matchSpecies, drawingToCharacter } from './sketch.js';
import { makeCard, recordNumber } from './card.js';
import { paintify, loadImage } from './paint.js';

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

// ---------------------------------------------------------------- views
function show(view) {
  document.querySelectorAll('.view').forEach(v => v.classList.toggle('is-active', v.id === `view-${view}`));
  document.body.classList.toggle('in-stage', view === 'stage');
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
  if (!turntable) { const { Turntable } = await import('./turntable.js'); turntable = new Turntable($('#turntable')); }
  choose(state.choice);
}

// show a character on the stage and update the big button
function choose(c) {
  state.choice = c;
  document.querySelectorAll('.pick').forEach(p => p.setAttribute('aria-pressed',
    (c.kind === 'animal3d' && p.dataset.id === c.id) || (c.kind === 'species' && p.dataset.species === c.species.id)));
  const tools = $('#tt-tools'), img2d = $('#tt-2d'), name = $('#tt-name');
  let label;
  if (c.kind === 'animal3d') {
    const a = animal3dById(c.id);
    img2d.hidden = true; $('#turntable').style.visibility = '';
    turntable.show(a, c.look);
    label = t(`animals3d.${a.id}`);
    name.innerHTML = `<div class="n">${esc(label)}</div><div class="s">3D · Quaternius · CC0</div>`;
    tools.innerHTML = `
      <div class="segmented" role="group">${['walk', 'run', 'idle', 'eat'].map(k => `<button data-action="tt-anim" data-anim="${k}" aria-pressed="${(turntable.anim || 'walk') === k}">${esc(t({ walk: 'animWalk', run: 'animRun', idle: 'animIdle', eat: 'animEat' }[k]))}</button>`).join('')}</div>
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
  bubbles.forEach((el, k) => { if (k !== who) el.classList.remove('show'); });
  let b = bubbles.get(who);
  if (!b) { b = document.createElement('div'); b.className = 'bubble'; $('#bubble-layer').appendChild(b); bubbles.set(who, b); }
  b.classList.remove('show');
  b.innerHTML = `<span class="who"></span><span class="txt"></span>`;
  b.querySelector('.who').textContent = name; b.querySelector('.txt').textContent = text;
  requestAnimationFrame(() => b.classList.add('show'));
  clearTimeout(b._t);
  if (hold) b._t = setTimeout(() => b.classList.remove('show'), hold + text.length * 35);
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
  for (const { el, p } of items) {
    const x = Math.max(170, Math.min(innerWidth - 170, p.x)), y = Math.max(150, p.y);
    el.style.left = x + 'px'; el.style.top = y + 'px';
  }
}
function controls(html) { $('#stage-controls').innerHTML = html; }
function status(html) { $('#stage-status').innerHTML = html ? `<div class="glass">${html}</div>` : ''; }

async function visitorImage() {
  const v = state.visitor;
  if (v.kind === 'drawing') return v.canvas;
  return loadImage(state.look === 'photo' ? v.species.cutout : v.species.storybook);
}

async function enterStage(visitor) {
  state.visitor = visitor; state.answer = null; state.inside = false; state.hostAwake = false;
  closeModal(); show('stage');
  status(`<span class="loading"></span>${esc(t('loadingRoom'))}`); controls('');
  const w = state.work;
  // a different set of painted animals wakes up each visit (the first one speaks for them)
  const order = [...w.hosts].sort(() => Math.random() - 0.5);
  const free = order.filter(id => !HOSTS[id].inPlace), fixed = order.filter(id => HOSTS[id].inPlace);
  const pick = (fixed.length && Math.random() < 0.5 ? [fixed[0]] : []).concat(free).slice(0, Math.min(3, w.hosts.length));
  state.hosts = pick.map(id => HOSTS[id]);
  state.host = state.hosts[0];
  hostMeta ??= await (await fetch('assets/hosts/hosts.json')).json();
  const actor = await makeVisitorActor();
  gallery?.dispose();
  const { Gallery } = await import('./gallery.js');
  gallery = new Gallery($('#stage3d'), {
    work: w, workText: W(w.id), visitor: actor,
    hosts: state.hosts.map(h => ({ host: h, meta: hostMeta[h.id] })),
    onFrame: g => { placeBubbles(g); stageFrame(g); },
    onEvent: (kind, i) => { if (kind === 'run' && Math.random() < 0.5) sayHost(i, pickLine(t('runAway'))); },
  });
  await gallery.init();
  status('');
  runStory(gallery);
}

// the visitor as an actor: a rigged 3D animal, or a 2D character (drawing / storybook)
async function makeVisitorActor() {
  const v = state.visitor;
  if (v.kind === 'animal3d') {
    const { loadAnimal3D } = await import('./animal3d.js');
    const a = animal3dById(v.id);
    return loadAnimal3D(a.glb, { height: a.height, look: v.look });
  }
  const { Character } = await import('./character.js');
  if (v.kind === 'drawing') return new Character(v.canvas, { height: 0.55, headSide: v.facing });
  const img = await loadImage(v.species.storybook);
  return new Character(img, { height: 0.55, headSide: v.species.faces, gait: v.species.gait });
}

const pickLine = arr => arr[Math.floor(Math.random() * arr.length)];
const hostNameOf = i => cap(t(`hostNames.${state.hosts[i].id}`));
function sayHost(i, text, hold) { say(i, hostNameOf(i), text, hold); }

const visitorName = () => state.visitor.kind === 'drawing' ? t('yourDrawing')
  : state.visitor.kind === 'animal3d' ? t(`animals3d.${state.visitor.id}`) : t(`species.${state.visitor.species.id}`);
const hostName = () => t(`hostNames.${state.host.id}`);   // the first painted animal

async function runStory(g) {
  const x = W(state.work.id);
  await g.walkIn();
  if (g !== gallery) return;
  // the visitor stops and looks back at you (towards your face if the camera sees you)
  const side = face ? (face.x < 0.45 ? -1 : 1) : 1;
  say('visitor', cap(visitorName()), t(`visitorGreet.${state.role}`));
  await g.lookBack(side);
  await sleep(1600);
  if (g !== gallery) return;
  bubbles.get('visitor')?.classList.remove('show');
  await g.approach();
  // the first painted animal wakes and speaks
  await g.wakeHost(0, 0);
  if (g !== gallery) return;
  state.hostAwake = true;
  sayHost(0, `${t(`works.${state.work.id}.welcome`, { visitor: visitorName() })} ${x.greet[state.role]}`);
  await sleep(2600);
  // the others wake up one by one, curious about the visitor
  const chorus = [...x.chorus].sort(() => Math.random() - 0.5);
  for (let i = 1; i < state.hosts.length; i++) {
    if (g !== gallery) return;
    g.wakeHost(i, i % 2 ? -1 : 1);
    await sleep(1400);
    sayHost(i, chorus[(i - 1) % chorus.length]);
    await sleep(1900);
  }
  if (g !== gallery) return;
  for (let i = 1; i < state.hosts.length; i++) bubbles.get(i)?.classList.remove('show');
  say(0, hostNameOf(0), t('hostAsk'), 0);
  state.awaiting = true;
  controls(`${tracker ? `<span class="hint">${esc(t('answerHint'))}</span>` : ''}
    <button class="btn" data-action="answer" data-answer="no">${esc(t('no'))}</button>
    <button class="btn primary cta" data-action="answer" data-answer="yes">${esc(t('yes'))}</button>`);
}

async function answer(a) {
  if (!state.awaiting || !gallery) return;
  state.awaiting = false; state.answer = a;
  const g = gallery, x = W(state.work.id);
  controls('');
  say('visitor', cap(visitorName()), a === 'yes' ? t('visitorYes') : t('visitorNo'));
  await sleep(900);
  sayHost(0, x[a]);
  if (a === 'yes') { await sleep(2600); await stepIn(g); }
  else {
    await g.hostsRefuse();
    controls(`<button class="btn" data-action="home">${esc(t('anotherPainting'))}</button>
      <button class="btn primary cta" data-action="step-in">${esc(t('stepInAnyway'))}</button>`);
  }
}

async function stepIn(g = gallery) {
  if (!g || g.inside) return;
  controls(''); clearBubbles();
  state.hostAwake = false;
  await g.enter();
  if (g !== gallery) return;
  state.inside = true;
  status(esc(tracker ? t('insideHint') : t('insideHintMouse')));
  controls(`<button class="btn primary cta" data-action="to-create">${esc(t('create'))}</button>`);
  // now and then one of them says something
  const chorus = W(state.work.id).chorus;
  (async () => {
    while (gallery === g && g.inside) {
      await sleep(7000 + Math.random() * 5000);
      if (gallery !== g) break;
      const i = Math.floor(Math.random() * state.hosts.length);
      sayHost(i, pickLine(chorus));
      setTimeout(() => bubbles.get(i)?.classList.remove('show'), 4200);
    }
  })();
}

// per frame: parallax from your head (or the mouse) and the host's role reaction
let pointer = null, drag = null;
function stageFrame(g) {
  if (face) g.parallax.set((face.x - 0.5) * 2.2, -(face.y - 0.45) * 2.2);
  else if (pointer && !g.inside) g.parallax.set(pointer[0], pointer[1]);
  if (!state.hostAwake || g.inside) return;
  // where are you? your face, your hand, or the mouse, in screen x
  const you = face ? face.x * innerWidth : hands[0] ? hands[0].x * innerWidth : pointer ? (pointer[0] + 1) / 2 * innerWidth : null;
  if (you === null) return;
  g.hosts.forEach((h, i) => {
    if (!h.awake || h.actor.target) return;
    const hx = g.project(g.anchor(i)).x;
    const toward = Math.sign(you - hx) || 1;
    h.actor.setDir(state.role === 'guard' ? -toward : toward);   // the guard's animals turn away
  });
}
const stage3d = $('#stage3d');
stage3d.addEventListener('pointermove', e => {
  pointer = [e.clientX / innerWidth * 2 - 1, -(e.clientY / innerHeight * 2 - 1)];
  if (drag && gallery?.inside) {
    gallery.look(-(e.clientX - drag[0]) * 0.003, (e.clientY - drag[1]) * 0.002);
    if (Math.hypot(e.clientX - drag[2], e.clientY - drag[3]) > 6) drag.moved = true;
    drag[0] = e.clientX; drag[1] = e.clientY;
  }
});
stage3d.addEventListener('pointerdown', e => { drag = [e.clientX, e.clientY, e.clientX, e.clientY]; });
stage3d.addEventListener('pointerup', e => {
  const wasDrag = drag?.moved; drag = null;
  if (!gallery?.inside || wasDrag) return;
  const nx = e.clientX / innerWidth * 2 - 1, ny = -(e.clientY / innerHeight * 2 - 1);
  tapInside(nx, ny);
});
stage3d.addEventListener('wheel', e => { if (gallery?.inside) { e.preventDefault(); gallery.zoomBy(-e.deltaY * 0.0015); } }, { passive: false });

// a tap/pinch inside the picture: call the animal under it, or walk there
function tapInside(nx, ny) {
  const i = gallery.hostAt(nx, ny);
  if (i >= 0) { gallery.callHost(i); sayHost(i, pickLine(t('called'))); setTimeout(() => bubbles.get(i)?.classList.remove('show'), 3600); }
  else gallery.walkVisitorToScreen(nx, ny);
}

// ---------------------------------------------------------------- camera events
let lastPinchWalk = 0;
function onGesture(g) {
  const view = document.querySelector('.view.is-active')?.id;
  if (view === 'view-stage' && gallery) {
    if (g === 'nod' && state.awaiting) answer('yes');
    else if (g === 'shake' && state.awaiting) answer('no');
    else if (g === 'wave') {
      gallery.visitor.hopOnce(0.1); gallery.visitor.nod(2);
      say('visitor', cap(visitorName()), t('waveReply'));
      setTimeout(() => bubbles.get('visitor')?.classList.remove('show'), 2500);
      gallery.hosts.forEach(h => { if (h.awake) { h.actor.nod(2); h.actor.hopOnce(0.03); } });
    }
  }
  if (view === 'view-create') {
    const step = g === 'swipeLeft' ? -1 : g === 'swipeRight' ? 1 : 0;
    if (!step) return;
    if (!$('#compose-wrap').hidden) { composer?.nextVariant(step); syncVariant(); }
    else { sculpt?.nextMaterial(step); syncMaterial(); }
  }
}
function onHands(hs) {
  const view = document.querySelector('.view.is-active')?.id;
  // inside the painting: pinch in the air to send the visitor there
  if (view === 'view-stage' && gallery?.inside) {
    const p = hs.find(h => h.pinch), open = hs.filter(h => h.open);
    if (p && performance.now() - lastPinchWalk > 600) {
      lastPinchWalk = performance.now();
      tapInside(p.pinchX * 2 - 1, -(p.pinchY * 2 - 1));
    }
    if (open.length === 2) {                         // two hands apart = zoom in, together = out
      const d = Math.hypot(open[0].x - open[1].x, open[0].y - open[1].y);
      if (onHands.zd) gallery.zoomBy((d - onHands.zd) * 2.2);
      onHands.zd = d;
    } else {
      onHands.zd = null;
      if (open.length === 1) {                       // one open hand = look around, like a joystick
        const h = open[0];
        gallery.look((h.x - 0.5) * 0.06, -(h.y - 0.5) * 0.04);
      }
    }
  }
  if (view !== 'view-create') return;
  const c1 = $('#hand-cursor'), c2 = $('#hand-cursor-2');
  [c1, c2].forEach((c, i) => {
    const h = hs[i];
    c.hidden = !h;
    if (h) { c.style.left = h.pinchX * innerWidth + 'px'; c.style.top = h.pinchY * innerHeight + 'px'; c.classList.toggle('pinch', h.pinch); }
  });
  if (!$('#compose-wrap').hidden) { composer?.handInput(hs); return; }
  sculpt?.handInput(hs);
}

// ---------------------------------------------------------------- 7 · create
async function enterCreate(mode = 'sculpt') {
  show('create');
  $('#create-modes').innerHTML = ['sculpt', 'compose'].map(m =>
    `<button role="tab" data-action="create-mode" data-mode="${m}" aria-selected="${m === mode}">${esc(t(m === 'sculpt' ? 'modeSculpt' : 'modeCompose'))}</button>`).join('');
  if (mode === 'sculpt') await openSculpt(); else await openCompose();
}

async function openSculpt() {
  $('#compose-wrap').hidden = true; $('#sculpt-canvas').hidden = false;
  if ($('#collage-shelf')) $('#collage-shelf').hidden = true;
  createStatus(t('monumentHint') + (tracker ? ' ' + t('monumentHands') : ''));
  $('#create-tools').innerHTML = `
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
  sculpt = await createMonument($('#sculpt-canvas'), {
    work: state.work, visitor: visitorStatue,
    statues: state.hosts.map(h => ({ kind: 'slab', src: h.sprite, height: Math.min(0.75, Math.max(0.3, (hostMeta[h.id].box[3] - hostMeta[h.id].box[1]) / state.work.size[1] * 2.2)), flip: h.faces === 'left' })),
  });
  window.__aia.sculpt = sculpt;          // console/debug access only
}
function syncMaterial() {
  document.querySelectorAll('#mat-group button').forEach(b => b.setAttribute('aria-pressed', b.dataset.mat === sculpt?.material));
}
function createStatus(text, append = false) {
  const el = $('#create-status');
  if (!append) el.innerHTML = `<strong>${esc(t('createHeading'))}</strong>`;
  el.insertAdjacentHTML('beforeend', `<div>${esc(text)}</div>`);
}

let collage = null;
async function openCompose() {
  $('#sculpt-canvas').hidden = true; $('#compose-wrap').hidden = false;
  createStatus(t('composeHint') + (tracker ? ' ' + t('composeHands') : ''));
  const { Composer, VARIANTS, SEASONS } = await import('./compose.js');
  collage ??= await (await fetch('assets/collage/collage.json')).json();
  $('#create-tools').innerHTML = `
    <label>${esc(t('background'))}<select id="bg-select">${WORKS.map(w => `<option value="${w.id}" ${w.id === state.work.id ? 'selected' : ''}>${esc(W(w.id).title)}</option>`).join('')}</select></label>
    <label>${esc(t('season'))}<select id="season-select">${SEASONS.map(v => `<option value="${v}">${esc(t(`seasons.${v}`))}</option>`).join('')}</select></label>
    <label>${esc(t('variant'))}<select id="variant-select">${VARIANTS.map(v => `<option value="${v}">${esc(t(`variants.${v}`))}</option>`).join('')}</select></label>
    <button class="btn small ghost" data-action="remove-sel">${esc(t('removeSel'))}</button>
    <button class="btn primary cta" data-action="card">${esc(t('makeCard'))}</button>`;
  // a shelf of every animal cut from the three paintings, plus your visitor
  let shelf = $('#collage-shelf');
  if (!shelf) { shelf = document.createElement('div'); shelf.id = 'collage-shelf'; shelf.className = 'collage-shelf glass'; $('#view-create').appendChild(shelf); }
  shelf.hidden = false;
  shelf.innerHTML = `<h3>${esc(t('addAnimals'))}</h3><div class="shelf-row">${Object.entries(collage).map(([id, c]) =>
    `<button class="pick" data-action="add-collage" data-id="${id}"><img src="assets/collage/${id}.webp" alt=""><span>${esc(c.name)}</span></button>`).join('')}</div>`;
  if (!composer) {
    const v = state.visitor;
    let vimg;
    if (v.kind === 'animal3d') vimg = await loadImage(animal3dById(v.id).thumb);
    else if (v.kind === 'drawing') vimg = v.canvas;
    else vimg = await loadImage(v.species.storybook);
    const items = [{ img: vimg, x: 0.36, y: 0.9, s: 0.24, r: 0, flip: false }];
    for (const [k, h] of state.hosts.entries()) {
      if (!collage[h.id]) continue;
      items.push({ img: await loadImage(`assets/collage/${h.id}.webp`), x: 0.56 + k * 0.14, y: 0.9, s: 0.24, r: 0, flip: h.faces === 'right' });
    }
    composer = new Composer($('#compose-canvas'), { items });
    window.__aia.composer = composer;
    await setComposeBackground(state.work.id);
    addEventListener('resize', () => composer?.resize());
  }
  $('#bg-select').addEventListener('change', e => setComposeBackground(e.target.value));
  $('#variant-select').addEventListener('change', e => composer.setVariant(e.target.value));
  $('#season-select').addEventListener('change', e => composer.setSeason(e.target.value));
  composer.onChange = syncVariant;
  syncVariant();
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
  state.made = composing ? t('madePainting', { variant: t(`variants.${composer.variant}`) }) : t('madeSculpture', { material: t(`materials.${sculpt.material}`) });
  const date = new Date();
  const blob = await makeCard({
    screenshot: shot, record: recordNumber(date), date: date.toISOString().slice(0, 10),
    work: w, workText: x, roleName: t(`roles.${state.role}.name`),
    speciesName: v.kind === 'drawing' ? t('yourDrawing') : `${t(`species.${v.species.id}`)} (${t(`speciesLatin.${v.species.id}`)})`,
    hostName: hostName(), mood: t(`moods.${state.role}.${state.answer || 'yes'}`), made: state.made,
    photoCredit: v.kind === 'drawing' ? t('cardDrawingCredit') : t('cardPhotoCredit', { file: v.species.file + '.png' }),
    figure: composing,
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
    case 'walk-in': enterStage({ ...state.choice }); break;
    case 'answer': answer(el.dataset.answer); break;
    case 'step-in': stepIn(); break;
    case 'to-create': gallery?.dispose(); gallery = null; clearBubbles(); enterCreate('sculpt'); break;
    case 'create-mode':
      $('#create-modes').querySelectorAll('button').forEach(b => b.setAttribute('aria-selected', b === el));
      if (el.dataset.mode === 'sculpt') openSculpt(); else openCompose(); break;
    case 'material': pressGroup(el); sculpt?.setMaterial(el.dataset.mat); break;
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
window.__aia = { state, STRINGS, get gallery() { return gallery; } };   // console/debug access only

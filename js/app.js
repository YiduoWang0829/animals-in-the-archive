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
  // a new speaker hides everyone else at once (no fading bubbles left overlapping)
  bubbles.forEach((el, k) => { if (k !== who) { el.classList.remove('show'); el.style.visibility = 'hidden'; } });
  let b = bubbles.get(who);
  if (!b) { b = document.createElement('div'); b.className = 'bubble'; $('#bubble-layer').appendChild(b); bubbles.set(who, b); }
  b.classList.remove('show');
  b.innerHTML = `<span class="who"></span><span class="txt"></span>`;
  b.querySelector('.who').textContent = name; b.querySelector('.txt').textContent = text;
  b.style.visibility = 'visible';
  setTimeout(() => b.classList.add('show'), 20);
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
  return loadImage(v.species.storybook);
}

async function enterStage(visitor) {
  state.visitor = visitor; state.answer = null; state.inside = false; state.hostAwake = false;
  storyToken++; giveAnswer(null); speechLock = Promise.resolve();
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
const fill = s => String(s).replace(/\{name\}/g, state.name || '');
const speakerName = who => who === 'visitor' ? state.name : hostNameOf(who);
const shuffled = arr => [...arr].sort(() => Math.random() - 0.5);

// say a line after whoever is speaking now has finished; resolves when it has been read
function speak(who, text, { pause = 350 } = {}) {
  const tok = storyToken;
  const run = speechLock.then(async () => {
    if (tok !== storyToken || !gallery) return;
    gallery.actorOf(who)?.nod?.(1);
    if (who !== 'visitor') gallery.gazeHost = who;         // the visitor turns its head to the speaker
    say(who, speakerName(who), fill(text), 0);
    await sleep(1500 + fill(text).length * 48);
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
  g.talkToYou(true);
  await speak('visitor', pickLine(t('visitorHello')));
  if (tracker && alive()) {                         // invite a wave (only with the camera on)
    status(esc(t('waveHint')));
    await new Promise(res => { waveWaiter = res; setTimeout(res, 5000); });
    waveWaiter = null; status('');
  }
  g.talkToYou(false);
  await Promise.all([g.toLabel(), speak('visitor', pickLine(t('tourArrive')))]);
  if (!alive()) return;
  await speak('visitor', t('tourLabel', { title: x.title, artist: x.artist, date: x.date }));
  for (const f of x.facts) await speak('visitor', f);
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
  controls(''); clearBubbles(); g.talkToYou(false);
  await g.enter();
  if (!alive()) return;
  state.inside = true;
  status(esc(tracker ? t('insideHint') : t('insideHintMouse')));
  controls(`<button class="btn primary cta" data-action="to-create">${esc(t('create'))}</button>`);
  insideStory(g, tok);
}

// ---- part 2: inside. The painted animals were only paint. They freeze, stare at
// the visitor, come alive, and each side learns how the other lives.
async function insideStory(g, tok) {
  const alive = () => g === gallery && tok === storyToken && g.inside;
  const x = W(state.work.id), kind = kindOf();
  const H = state.hosts.length, hid = i => state.hosts[i % H].id;
  const B = H > 1 ? 1 : 0;
  await sleep(1200);
  if (!alive()) return;
  // the opening: a fixed little scene the visitor does not steer
  await g.startle();
  await speak(0, t('insideStartled'));
  await speak(0, t('openShy'));
  await speak('visitor', t('openSorry'));
  await speak(B, t('openWhisper'));
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
  if (!alive()) return;
  // getting to know each other: every question gets an answer
  const life = t(`life.${kind}`), host = i => t(`hostLife.${hid(i)}`);
  const pairs = [
    [B, t('insideAskOut'), 'visitor', life[0]],
    ['visitor', t('insideAskIn'), 0, host(0)[0]],
    [B, t('insideAskEat'), 'visitor', life[1]],
    ['visitor', t('insideAskDay'), B, host(B)[1]],
  ];
  for (const [q, ql, a, al] of pairs) { if (!alive()) return; await speak(q, ql); await speak(a, al); }
  if (H > 2) { await speak(2, host(2)[0]); await speak('visitor', pickLine(t('reactions'))); }
  const friend = await askUser(0, t('insideAskFriend'));
  if (!alive()) return;
  if (friend) await speak(0, friend === 'yes' ? t('insideFriendYes') : t('insideFriendNo'));
  await speak('visitor', t('insideLeave'));
  await speak(B, t('insideRemember'));
  insideLife(g, tok);
}

// inside the painting: a steady, readable conversation around the visitor
async function insideLife(g, tok) {
  const alive = () => g === gallery && tok === storyToken && g.inside;
  const qa = shuffled(t('qa').slice(1, 7)), ask = shuffled(t('askYou')), toYou = shuffled(t('visitorAskYou'));
  const chorus = shuffled(W(state.work.id).chorus);
  const awake = () => state.hosts.map((h, i) => i).filter(i => g.hosts[i].awake);
  let n = 0;
  while (alive()) {
    await sleep(2200 + Math.random() * 2200);
    if (!alive()) break;
    const hs = awake(), i = hs[n % hs.length];
    const kind = ['qa', 'ask', 'chorus', 'qa', 'you', 'ask'][n % 6]; n++;
    if (kind === 'qa' && qa.length) {
      const [q, ans, back] = qa.shift();
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
    } else if (chorus.length) { await speak(i, chorus.shift()); await speak('visitor', pickLine(t('reactions'))); }
    else if (!qa.length && !ask.length) { await sleep(6000); }
  }
}

// per frame: parallax from your head (or the mouse) and the host's role reaction
let pointer = null, drag = null;
function stageFrame(g) {
  g.handGaze = hands[0] ? { x: hands[0].x, y: hands[0].y } : null;
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
    gallery.look(-(e.clientX - drag[0]) * 0.003, (e.clientY - drag[1]) * 0.002);
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
  if (gallery.inside) tapInside(nx, ny);
});
stage3d.addEventListener('wheel', e => { if (gallery?.inside) { e.preventDefault(); gallery.zoomBy(-e.deltaY * 0.0015); } }, { passive: false });

// a tap/pinch inside the picture: call the animal under it, or walk there
function tapInside(nx, ny) {
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
  g.visitor.hopOnce(0.1); g.visitor.nod(2);
  g.hosts.forEach(h => { if (h.awake) { h.actor.nod(2); h.actor.hopOnce(0.03); } });
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
  // inside the painting: pinch in the air to send the visitor there
  if (view === 'view-stage' && gallery?.inside) {
    const p = hs.find(h => h.pinch), open = hs.filter(h => h.open);
    if (p && performance.now() - lastPinchWalk > 600) {
      lastPinchWalk = performance.now();
      tapInside(p.pinchX * 2 - 1, -(p.pinchY * 2 - 1));
    }
    if (open.length === 2) {                         // two hands: spread = come closer to your animal
      const d = Math.hypot(open[0].x - open[1].x, open[0].y - open[1].y);
      gallery.zoomTo((d - 0.3) * 1.6);
    } else if (open.length === 1) {                  // one open hand: the view orbits your animal, following the hand
      const h = open[0];
      gallery.lookTo((h.x - 0.5) * 1.3, (0.5 - h.y) * 0.7);
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
  sculpt = await createMonument($('#sculpt-canvas'), {
    work: state.work, visitor: visitorStatue,
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
  state.made = composing ? t('madePainting', { variant: t(`variants.${composer.variant}`) }) : t('madeSculpture', { material: t(`materials.${sculpt.material}`).toLowerCase() });
  const date = new Date();
  const blob = await makeCard({
    screenshot: shot, record: recordNumber(date), date: date.toISOString().slice(0, 10),
    work: w, workText: x, roleName: t(`roles.${state.role}.name`),
    speciesName: `${state.name}, ${v.kind === 'species' ? `${t(`species.${v.species.id}`)} (${t(`speciesLatin.${v.species.id}`)})` : visitorKind()}`,
    hostName: state.hosts.map(h => t(`hostNames.${h.id}`)).join(', '), mood: t(`moods.${state.role}.${state.answer || 'yes'}`), made: state.made,
    photoCredit: v.kind === 'drawing' ? t('cardDrawingCredit') : v.kind === 'animal3d' ? t('card3dCredit', { name: t(`animals3d.${v.id}`) })
      : t('cardPhotoCredit', { file: v.species.file + '.png' }),
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
      ${c.models3d.map(m => `<tr><td>${esc(m.file)}</td><td>${esc(m.name)} · Quaternius</td><td>${link(m.source)}</td><td>CC0 1.0</td></tr>`).join('')}
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
    case 'walk-in': state.name = $('#vname').value.trim().slice(0, 16) || pickLine(t('names')); enterStage({ ...state.choice }); break;
    case 'answer': giveAnswer(el.dataset.answer); break;
    case 'step-in': stepIn(); break;
    case 'to-create': storyToken++; giveAnswer(null); gallery?.dispose(); gallery = null; clearBubbles(); status(''); controls(''); enterCreate('sculpt'); break;
    case 'create-mode':
      $('#create-modes').querySelectorAll('button').forEach(b => b.setAttribute('aria-selected', b === el));
      if (el.dataset.mode === 'sculpt') openSculpt(); else openCompose(); break;
    case 'material': pressGroup(el); sculpt?.setMaterial(el.dataset.mat); break;
    case 'form': pressGroup(el); sculpt?.setForm(el.dataset.form); break;
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

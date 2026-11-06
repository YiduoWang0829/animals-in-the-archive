// Animals in the Archive: main flow controller.
// index → record → role → visitor (archive or sketch) → stage → sculpt → card.
// No data is stored or sent anywhere; state lives in memory only.

import { t, STRINGS, LANG } from './strings.js';
import { WORKS, SPECIES, workById, speciesById } from './data.js';
import { paintify } from './paint.js';
import { Stage } from './stage.js';
import { loadClassifier, createPad, classify, matchSpecies } from './sketch.js';
import { makeCard, recordNumber } from './card.js';

const $ = (sel, root = document) => root.querySelector(sel);
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const W = id => t(`works.${id}`);

const state = { work: null, role: null, species: null, answer: null, viaSketch: false };
let stage = null, sculpt = null, hands = null, cardUrl = null;

// ---------------------------------------------------------------- i18n
document.documentElement.lang = LANG;
document.querySelectorAll('[data-i18n]').forEach(el => { el.textContent = t(el.dataset.i18n); });

// ---------------------------------------------------------------- views
function show(view) {
  document.querySelectorAll('.view').forEach(v => v.classList.toggle('is-active', v.id === `view-${view}`));
  document.body.classList.toggle('in-stage', view === 'stage');
  document.body.classList.toggle('in-sculpt', view === 'sculpt');
  window.scrollTo(0, 0);
}

// ---------------------------------------------------------------- modal
const modal = $('#modal'), panel = $('#modal-panel');
let lastFocus = null;
function openModal(html, { wide = false } = {}) {
  lastFocus = document.activeElement;
  panel.className = 'modal-panel glass' + (wide ? ' wide' : '');
  panel.innerHTML = `<button class="modal-close" data-action="close-modal" aria-label="${esc(t('close'))}"></button>` + html;
  modal.hidden = false;
  panel.scrollTop = 0;
  (panel.querySelector('[autofocus]') || panel.querySelector('button:not(.modal-close)') || panel).focus?.();
}
function closeModal() {
  modal.hidden = true; panel.innerHTML = '';
  lastFocus?.focus?.();
}
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
      <span class="link view-link arrow">${esc(t('viewRecord'))}</span>
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
      <button class="btn primary" data-action="to-role" autofocus>${esc(t('enterWork'))}</button>
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
      <button class="btn primary" data-action="to-visitor" ${state.role ? '' : 'disabled'}>${esc(t('continue'))}</button>
    </div>`);
}

// ---------------------------------------------------------------- 4 · visitor
function openVisitor(tab = 'archive') {
  openModal(`
    <p class="kicker">${esc(t('stepOf', { n: 3 }))} · ${esc(t(`roles.${state.role}.name`))}</p>
    <h2>${esc(t('visitorHeading'))}</h2>
    <p class="sub">${esc(t('visitorIntro'))}</p>
    <div class="tabs" role="tablist">
      <button role="tab" data-action="tab" data-tab="archive" aria-selected="${tab === 'archive'}">${esc(t('tabArchive'))}</button>
      <button role="tab" data-action="tab" data-tab="draw" aria-selected="${tab === 'draw'}">${esc(t('tabDraw'))}</button>
    </div>
    <div id="tab-body"></div>
    <div class="modal-actions">
      <button class="btn ghost" data-action="back-role">${esc(t('back'))}</button>
    </div>`, { wide: true });
  tab === 'archive' ? renderArchiveTab() : renderDrawTab();
}

function renderArchiveTab() {
  $('#tab-body').innerHTML = `<div class="species-grid">${SPECIES.map(s => `
    <button class="species" data-action="pick-species" data-species="${s.id}">
      <div class="thumb"><img src="${s.cutout}" alt="" loading="lazy"></div>
      <h3>${esc(t(`species.${s.id}`))}</h3>
      <span class="latin">${esc(t(`speciesLatin.${s.id}`))}</span>
      <span class="caption">${esc(t('archiveRecord', { file: s.file + '.png' }))}</span>
    </button>`).join('')}</div>`;
}

function renderDrawTab() {
  $('#tab-body').innerHTML = `
    <div class="draw">
      <div>
        <div class="draw-pad" id="draw-pad"><canvas id="draw-canvas" aria-label="${esc(t('drawHint'))}"></canvas>
          <div class="match-photo"><img id="match-img" alt=""></div></div>
        <div class="draw-tools">
          <button class="btn small" data-action="draw-clear">${esc(t('drawClear'))}</button>
          <button class="btn small primary" data-action="draw-go" id="draw-go" disabled>${esc(t('drawRecognise'))}</button>
        </div>
      </div>
      <div>
        <p class="status" id="draw-status"><span class="loading"></span>${esc(t('drawLoading'))}</p>
        <p class="sub" style="margin:0 0 8px">${esc(t('drawHint'))}</p>
        <div id="draw-result"></div>
        <p class="note">${esc(t('drawNote'))}</p>
      </div>
    </div>`;
  const pad = createPad($('#draw-canvas'));
  renderDrawTab.pad = pad;
  loadClassifier().then(() => {
    if (!$('#draw-status')) return;
    $('#draw-status').textContent = t('drawReady');
    $('#draw-go').disabled = false;
  }).catch(err => {
    console.warn('[sketch] classifier unavailable:', err);
    if (!$('#draw-status')) return;
    $('#draw-status').textContent = t('drawUnavailable');
    $('#draw-go').disabled = true;
  });
}

async function recogniseSketch() {
  const pad = renderDrawTab.pad, out = $('#draw-result');
  if (pad.isEmpty()) { out.innerHTML = `<p class="status">${esc(t('drawEmpty'))}</p>`; return; }
  const ranked = await classify(pad.canvas);
  const matches = matchSpecies(ranked, SPECIES);
  const best = matches[0];
  const pct = p => (p * 100).toFixed(1);
  const top = ranked.slice(0, 5).map(r => `<li><span>${esc(r.label)}</span><span class="bar"><i style="width:${(r.p * 100).toFixed(1)}%"></i></span><span class="pct">${pct(r.p)}%</span></li>`).join('');
  const MIN = 0.05;   // below this the match is not shown as a recognition
  let html = `<div class="result"><h4>${esc(t('drawTop'))}</h4><ul class="bars">${top}</ul>`;
  if (best.score >= MIN) {
    html += `<h4>${esc(t('drawMatch'))}</h4>
      <p class="match">${esc(t(`species.${best.species.id}`))}</p>
      <p class="caption" style="text-transform:none;letter-spacing:.04em">${esc(t('drawScore', { p: pct(best.score) }))} · ${esc(t('drawVia', { c: best.via }))}</p>
      <div style="margin-top:14px"><button class="btn primary" data-action="pick-species" data-species="${best.species.id}" data-sketch="1">${esc(t('useMatch', { species: t(`species.${best.species.id}`) }))}</button></div>`;
    // cross-fade the sketch into the matched photograph
    $('#match-img').src = best.species.cutout;
    $('#draw-pad').classList.add('revealed');
  } else {
    html += `<p class="status" style="margin-top:14px">${esc(t('drawNoMatch', { p: pct(best.score) }))}</p>
      <button class="btn small" data-action="tab" data-tab="archive">${esc(t('tabArchive'))}</button>`;
  }
  out.innerHTML = html + '</div>';
}

// ---------------------------------------------------------------- 5–6 · stage
async function enterStage(speciesId) {
  state.species = speciesById(speciesId);
  state.answer = null;
  closeModal();
  show('stage');
  const w = state.work, x = W(w.id), sp = state.species;
  $('#wall-label').innerHTML = `<div class="caption">${esc(w.accession)}</div>
    <div class="t">${esc(x.title)}</div><div class="a">${esc(x.artist)}, ${esc(x.date)}</div>`;
  const bar = $('#stage-controls');
  bar.innerHTML = `<span class="hint"><span class="loading"></span>${esc(t('entering', { species: cap(t(`species.${sp.id}`)) }))}</span>`;

  stage?.destroy();
  stage = new Stage({
    wrap: $('#stage-wrap'), stage: $('#stage'), outside: $('#outside-layer'),
    picture: $('#picture'), img: $('#picture-img'), bubbles: $('#bubble-layer'),
  });
  const painted = await paintify(sp.cutout, w.style);
  await stage.setup({ work: w, species: sp, role: state.role, paintedSrc: painted });
  await stage.walkIn();

  // the painted host replies
  const hostName = cap(x.host);
  stage.say('host', hostName, `${t(`works.${w.id}.welcome`, { visitor: t(`species.${sp.id}`) })} ${x.greet[state.role]}`);
  bar.innerHTML = `<span class="hint">${esc(t(`pointerHint.${state.role}`, { animal: x.host }))}</span>
    <button class="btn primary" data-action="ask">${esc(t('askQuestion'))}</button>`;
}

function ask() {
  stage.say('visitor', cap(t(`species.${state.species.id}`)), t('questionLine'));
  const bar = $('#stage-controls');
  bar.innerHTML = `<button class="btn" data-action="answer" data-answer="no">${esc(t('no'))}</button>
    <button class="btn primary" data-action="answer" data-answer="yes">${esc(t('yes'))}</button>`;
}

function answer(a) {
  state.answer = a;
  const x = W(state.work.id);
  stage.say('visitor', cap(t(`species.${state.species.id}`)), a === 'yes' ? t('visitorYes') : t('visitorNo'));
  stage.setAnswer(a);
  setTimeout(() => stage.say('host', cap(x.host), x[a]), 900);
  $('#stage-controls').innerHTML = `<span class="hint">${esc(t('cardMood'))}: ${esc(mood())}</span>
    <button class="btn primary" data-action="to-sculpt">${esc(t('toSculpt'))}</button>`;
}

const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
const mood = () => t(`moods.${state.role}.${state.answer || 'yes'}`);

// ---------------------------------------------------------------- 7 · sculpt
async function enterSculpt() {
  stage?.destroy(); stage = null;
  show('sculpt');
  const w = state.work, sp = state.species;
  const status = $('#sculpt-status');
  status.innerHTML = `<strong>${esc(t('sculptHeading'))}</strong>${esc(t('sculptHint'))}`;
  renderTools();
  const { createSculpt } = await import('./sculpt.js');
  sculpt?.dispose();
  sculpt = await createSculpt($('#sculpt-canvas'), {
    models: [
      { glb: sp.glb, png: sp.cutout, position: [-0.38, 0, 0.14], rotY: 0.3, scale: 0.95 },
      { glb: w.host.glb, png: w.host.sprite, position: [0.38, 0, -0.12], rotY: -0.32, scale: 0.95 },
    ],
    onStatus: kind => { if (kind === 'fallback') status.insertAdjacentHTML('beforeend', `<br><em>${esc(t('modelFallback'))}</em>`); },
  });
  applyTools();
  window.__aia.sculpt = sculpt;   // console/debug access only
}

function renderTools() {
  $('#sculpt-tools').innerHTML = `
    <div class="segmented" role="group" aria-label="Brush">
      <button data-action="mode" data-mode="pull" aria-pressed="true">${esc(t('toolPull'))}</button>
      <button data-action="mode" data-mode="press" aria-pressed="false">${esc(t('toolPress'))}</button>
    </div>
    <label>${esc(t('toolSize'))}<input type="range" id="tool-size" min="0.06" max="0.45" step="0.01" value="0.18"></label>
    <label>${esc(t('toolStrength'))}<input type="range" id="tool-strength" min="0.1" max="1.5" step="0.05" value="0.5"></label>
    <span class="sep"></span>
    <div class="segmented" role="group" aria-label="View">
      <button data-action="wire" data-wire="0" aria-pressed="true">${esc(t('viewSolid'))}</button>
      <button data-action="wire" data-wire="1" aria-pressed="false">${esc(t('viewWire'))}</button>
    </div>
    <button class="btn small ghost" data-action="reset">${esc(t('resetModels'))}</button>
    <button class="btn small" data-action="hands" id="hands-btn">${esc(t('handTracking'))}</button>
    <button class="btn small primary" data-action="card">${esc(t('makeCard'))}</button>`;
  $('#tool-size').addEventListener('input', applyTools);
  $('#tool-strength').addEventListener('input', applyTools);
}
function applyTools() {
  if (!sculpt) return;
  sculpt.setRadius(+$('#tool-size').value);
  sculpt.setStrength(+$('#tool-strength').value);
}
function pressGroup(btn) {
  btn.parentElement.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', b === btn));
}

// ---- camera consent + hand tracking (optional) ----
function openConsent() {
  openModal(`
    <p class="kicker">${esc(t('handTracking'))}</p>
    <h2>${esc(t('consentHeading'))}</h2>
    <p class="sub">${esc(t('consentBody'))}</p>
    <label class="consent-check"><input type="checkbox" id="consent-box"><span>${esc(t('consentCheck'))}</span></label>
    <div class="modal-actions">
      <button class="btn ghost" data-action="close-modal">${esc(t('consentCancel'))}</button>
      <button class="btn primary" data-action="consent-start" id="consent-start" disabled>${esc(t('consentStart'))}</button>
    </div>`);
  $('#consent-box').addEventListener('change', e => { $('#consent-start').disabled = !e.target.checked; });
}

async function startHandTracking() {
  if (!$('#consent-box')?.checked) return;           // consent is required, every time
  closeModal();
  const line = setHandStatus(t('handStatusLoading'));
  const cursor = $('#hand-cursor'), video = $('#hand-video');
  try {
    if (!navigator.mediaDevices?.getUserMedia) throw Object.assign(new Error('no camera API'), { name: 'NotFoundError' });
    const { startHands } = await import('./hands.js');
    hands = await startHands(video, f => {
      if (!sculpt) return;
      if (!f.present) { cursor.hidden = true; sculpt.externalBrush(null); setHandStatus(t('handStatusNoHand')); return; }
      const r = $('#sculpt-canvas').getBoundingClientRect();
      const x = r.left + f.x * r.width, y = r.top + f.y * r.height;
      cursor.hidden = false; cursor.style.left = x + 'px'; cursor.style.top = y + 'px';
      cursor.classList.toggle('pinch', f.pinch);
      sculpt.externalBrush(f.pinch ? { x, y } : null);
      setHandStatus(f.pinch ? t('handStatusPinch') : t('handStatusOn'));
    });
    $('#hand-preview').hidden = false;
    const b = $('#hands-btn'); b.textContent = t('handStop'); b.dataset.action = 'hands-stop';
  } catch (err) {
    console.warn('[hands]', err.name, err.message);
    const denied = ['NotAllowedError', 'NotFoundError', 'NotReadableError', 'SecurityError', 'OverconstrainedError'].includes(err.name);
    line.textContent = denied ? t('handDenied') : t('handFailed');
    stopHandTracking(false);
  }
}
function setHandStatus(msg) {
  let line = $('#hand-line');
  if (!line) { $('#sculpt-status').insertAdjacentHTML('beforeend', '<div id="hand-line" class="caption" style="margin-top:8px;text-transform:none;letter-spacing:.02em"></div>'); line = $('#hand-line'); }
  if (line.textContent !== msg) line.textContent = msg;
  return line;
}
function stopHandTracking(resetText = true) {
  hands?.stop(); hands = null;
  sculpt?.externalBrush(null);
  $('#hand-preview').hidden = true; $('#hand-cursor').hidden = true;
  const b = $('#hands-btn'); if (b) { b.textContent = t('handTracking'); b.dataset.action = 'hands'; }
  if (resetText && $('#hand-line')) $('#hand-line').textContent = t('handStatusOff');
}

// ---------------------------------------------------------------- 8 · card
async function openCard() {
  const w = state.work, x = W(w.id), sp = state.species;
  const shot = sculpt.screenshot();
  const date = new Date();
  const blob = await makeCard({
    screenshot: shot, record: recordNumber(date), date: date.toISOString().slice(0, 10),
    work: w, workText: x, roleName: t(`roles.${state.role}.name`),
    speciesName: `${t(`species.${sp.id}`)} (${t(`speciesLatin.${sp.id}`)})`,
    hostName: `${x.host}`, mood: mood(), photoFile: sp.file + '.png',
  });
  if (cardUrl) URL.revokeObjectURL(cardUrl);
  cardUrl = URL.createObjectURL(blob);
  openModal(`
    <p class="kicker">${esc(t('stepOf', { n: 5 }))}</p>
    <h2>${esc(t('cardHeading'))}</h2>
    <p class="sub">${esc(t('cardIntro'))}</p>
    <div class="card-preview"><img src="${cardUrl}" alt="${esc(t('cardHeading'))}"></div>
    <div class="modal-actions">
      <button class="btn ghost" data-action="play-again">${esc(t('playAgain'))}</button>
      <a class="btn primary" href="${cardUrl}" download="animals-in-the-archive-card.png">${esc(t('cardDownload'))}</a>
    </div>`, { wide: true });
}

function playAgain() {
  stopHandTracking(false);
  sculpt?.dispose(); sculpt = null;
  stage?.destroy(); stage = null;
  if (cardUrl) { URL.revokeObjectURL(cardUrl); cardUrl = null; }
  Object.assign(state, { work: null, role: null, species: null, answer: null });
  closeModal();
  show('index');
}

// ---------------------------------------------------------------- credits
function renderCredits() {
  const c = t('creditsData'), L = k => esc(t(`credits.${k}`));
  const tbv = s => esc(s).replace(/(to be verified|to be confirmed)/g, '<span class="tbv">$1</span>');
  const link = u => `<a href="${esc(u)}" target="_blank" rel="noopener">${esc(u.replace(/^https?:\/\//, '').slice(0, 48))}…</a>`;
  $('#credits-body').innerHTML = `
    <h2>${L('paintings')}</h2><div class="scroll"><table>
      <tr><th>${L('work')}</th><th>${L('author')}</th><th>${L('date')}</th><th>${L('collection')}</th><th>${L('source')}</th><th>${L('licence')}</th></tr>
      ${c.paintings.map(p => `<tr><td><em>${esc(p.work)}</em></td><td>${esc(p.author)}</td><td>${tbv(p.date)}</td><td>${tbv(p.collection)}</td><td>${link(p.source)}</td><td>${tbv(p.licence)}</td></tr>`).join('')}
    </table></div>
    <h2>${L('photos')}</h2><p class="note">${L('photoNote')}</p><div class="scroll"><table>
      <tr><th>${L('file')}</th><th>${L('species')}</th><th>${L('photographer')}</th><th>${L('record')}</th><th>${L('recorded')}</th></tr>
      ${c.photos.map(p => `<tr><td>${esc(p.file)}</td><td>${esc(p.species)}</td><td class="tbv">${L('tbc')}</td><td>${link(p.record)}</td><td>${esc(p.recorded)} · <span class="tbv">${L('tbc')}</span></td></tr>`).join('')}
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
    case 'home': if (hands) stopHandTracking(); sculpt?.dispose(); sculpt = null; stage?.destroy(); stage = null; closeModal(); show('index'); break;
    case 'credits': if (hands) stopHandTracking(); renderCredits(); closeModal(); show('credits'); break;
    case 'close-modal': closeModal(); break;
    case 'to-role': openRole(); break;
    case 'back-record': openRecord(state.work.id); break;
    case 'pick-role':
      state.role = el.dataset.role;
      panel.querySelectorAll('.choice').forEach(c => c.setAttribute('aria-pressed', c === el));
      panel.querySelector('[data-action="to-visitor"]').disabled = false; break;
    case 'to-visitor': openVisitor(); break;
    case 'back-role': openRole(); break;
    case 'tab': openVisitor(el.dataset.tab); break;
    case 'draw-clear': renderDrawTab.pad.clear(); $('#draw-pad').classList.remove('revealed'); $('#draw-result').innerHTML = ''; break;
    case 'draw-go': recogniseSketch(); break;
    case 'pick-species': state.viaSketch = !!el.dataset.sketch; enterStage(el.dataset.species); break;
    case 'ask': ask(); break;
    case 'answer': answer(el.dataset.answer); break;
    case 'to-sculpt': enterSculpt(); break;
    case 'mode': pressGroup(el); sculpt?.setMode(el.dataset.mode); break;
    case 'wire': pressGroup(el); sculpt?.setWireframe(el.dataset.wire === '1'); break;
    case 'reset': sculpt?.reset(); break;
    case 'hands': openConsent(); break;
    case 'hands-stop': stopHandTracking(); break;
    case 'consent-start': startHandTracking(); break;
    case 'card': openCard(); break;
    case 'play-again': playAgain(); break;
  }
});
document.addEventListener('keydown', e => {
  if ((e.key === 'Enter' || e.key === ' ') && e.target.classList?.contains('entry')) { e.preventDefault(); openRecord(e.target.dataset.work); }
});
// stop the camera if the tab is hidden or closed
document.addEventListener('visibilitychange', () => { if (document.hidden && hands) stopHandTracking(); });

renderIndex();
// expose a tiny hook for debugging in the console only
window.__aia = { state, STRINGS };

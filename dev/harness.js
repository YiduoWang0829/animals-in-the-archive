// Development test harness (not used by the site). Drives the real app from the
// console: picks a painting, role and character, then advances the 3D simulation
// in fixed steps (works even when the browser tab is in the background) and
// records what happens: lines spoken, gait, facing, overlaps, head direction.

const sleep = ms => new Promise(r => setTimeout(r, ms));
const q = s => document.querySelector(s);
const wait = async s => { for (let i = 0; i < 80 && !q(s); i++) await sleep(150); return q(s); };

export async function setup({ work = 'eden', role = 'passer', pick = ['3d', 'stag'], name = 'Pip', autoYes = true } = {}) {
  await wait('.entry');
  q(`.entry[data-work="${work}"]`).click();
  (await wait('[data-action="to-role"]')).click();
  (await wait(`[data-role="${role}"]`)).click();
  q('[data-action="to-camera"]').click();
  (await wait('[data-action="cam-skip"]')).click();
  await wait('#vname'); await sleep(1200);
  q('#vname').value = name;
  if (pick[0] === '3d') q(`[data-action="choose-3d"][data-id="${pick[1]}"]`).click();
  else q(`[data-action="choose-2d"][data-species="${pick[1]}"]`).click();
  await sleep(300);
  q('[data-action="walk-in"]').click();
  for (let i = 0; i < 120 && !(window.__aia.gallery && window.__aia.gallery.hosts.length); i++) await sleep(150);
  await sleep(300);
  const g = window.__aia.gallery;
  g.renderer.setAnimationLoop(null);
  if (autoYes) window.__auto = setInterval(() => q('[data-action="answer"][data-answer="yes"]')?.click(), 400);
  window.__H = { g, log: [], last: '', vis: 0, overlap: 0, insideFrames: 0, back: 0, walkFrames: 0, flips: {}, idleWalk: 0 };
  return g;
}

const W = a => a.aspect ? a.aspect * a.height : (a.length || 1) * a.height;

// advance real time (so the dialogue timers run) while stepping the 3D world
export async function pump(until = () => false, ms = 40000) {
  const H = window.__H, g = H.g, v = g.visitor;
  const t0 = performance.now(); let last = t0;
  while (performance.now() - t0 < ms && !until(g)) {
    await sleep(25);
    const now = performance.now(), dt = Math.min(0.1, (now - last) / 1000); last = now;
    const p0 = v.position.clone(), dirs = g.hosts.map(h => h.actor.dir);
    g.advance(dt);
    const d = v.position.clone().sub(p0);
    if (d.length() > 1e-4 && v.aimChain) {            // walking: body must point where it goes
      H.walkFrames++;
      const mv = Math.atan2(d.x, d.z); let off = mv - v.yaw; off = Math.atan2(Math.sin(off), Math.cos(off));
      if (Math.abs(off) > 1.2) H.back++;
      if (v.current !== v.actions.walk && v.current !== v.actions.run) H.idleWalk++;
    }
    g.hosts.forEach((h, i) => { if (h.actor.dir !== dirs[i]) H.flips[i] = (H.flips[i] || 0) + 1; });
    if (g.inside && g.follow) {
      H.insideFrames++;
      const acts = [v, ...g.hosts.filter(h => h.awake && !h.host.inPlace).map(h => h.actor)];
      for (let i = 0; i < acts.length; i++) for (let j = i + 1; j < acts.length; j++) {
        const a = acts[i], b = acts[j];
        const ov = Math.min(a.position.x + W(a) / 2, b.position.x + W(b) / 2) - Math.max(a.position.x - W(a) / 2, b.position.x - W(b) / 2);
        if (ov > 0.4 * Math.min(W(a), W(b)) && Math.abs(a.position.z - b.position.z) < 0.05) H.overlap++;
      }
    }
    const vis = [...document.querySelectorAll('.bubble')].filter(b => b.style.visibility !== 'hidden' && b.classList.contains('show'));
    H.vis = Math.max(H.vis, vis.length);
    const txt = vis.map(b => b.innerText.replace(/\n/, ': ')).join(' / ');
    if (txt && txt !== H.last) { H.log.push(txt); H.last = txt; }
  }
  return H;
}

// render the current scene from any camera into an image (for checking poses)
export function shot(g, pos, look, w = 400, h = 300) {
  const cam = g.camera.clone(); cam.position.copy(pos); cam.lookAt(look);
  g.renderer.render(g.scene, cam);
  return g.renderer.domElement.toDataURL('image/jpeg', 0.7);
}

// show a grid of data-URL images over the page (for screenshots)
export async function sheet(urls, cols = 3, cw = 400, ch = 300) {
  const imgs = await Promise.all(urls.map(u => new Promise(r => { const i = new Image(); i.onload = () => r(i); i.src = u; })));
  const c = document.createElement('canvas'); c.width = cw * cols; c.height = ch * Math.ceil(imgs.length / cols);
  const x = c.getContext('2d'); x.fillStyle = '#000'; x.fillRect(0, 0, c.width, c.height);
  imgs.forEach((im, i) => x.drawImage(im, (i % cols) * cw, Math.floor(i / cols) * ch, cw, ch));
  document.getElementById('dbg')?.remove();
  document.body.insertAdjacentHTML('beforeend', '<div id="dbg" style="position:fixed;inset:0;z-index:999;background:#000"></div>');
  c.style.width = '100%'; document.getElementById('dbg').appendChild(c);
}

// angle (degrees) between the 3D visitor's face direction and a world point
export function headAngle(v, target) {
  v.group.updateMatrixWorld(true);
  const V = target.constructor, hp = new V(); v.head.getWorldPosition(hp);
  const q4 = v.head.getWorldQuaternion(v.head.quaternion.clone());
  const f = v.aimChain.at(-1).fwd.clone().applyQuaternion(q4).normalize();
  return Math.acos(Math.max(-1, Math.min(1, f.dot(target.clone().sub(hp).normalize())))) * 180 / Math.PI;
}

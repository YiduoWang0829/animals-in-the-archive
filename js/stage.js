// The painting stage: the visitor walks in from outside the frame, is "painted"
// as it crosses the frame edge, and the painted host animal replies.
//
// Trick: there are two copies of the visitor with identical geometry.
//  - the raw photo lives in .outside-layer, *below* the picture, so it is only
//    visible outside the frame;
//  - the painted copy lives inside .picture (overflow: hidden), so it is only
//    visible inside the frame.
// Moving both together makes the animal change medium exactly at the frame edge.

import { loadImage } from './paint.js';

const lerp = (a, b, t) => a + (b - a) * t;
const ease = t => 1 - Math.pow(1 - t, 2.2);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export class Stage {
  constructor(els) {
    this.els = els;                 // {wrap, stage, outside, picture, img, bubbles}
    this.raf = 0;
    this.pointer = null;            // pointer in picture px, or null
    this.state = 'idle';
    this.answer = null;
    this.onResize = () => this.layout();
    this.onPointer = e => {
      const r = this.els.picture.getBoundingClientRect();
      this.pointer = [e.clientX - r.left, e.clientY - r.top];
    };
    this.onLeave = () => { this.pointer = null; };
  }

  async setup({ work, species, role, paintedSrc }) {
    this.work = work; this.species = species; this.role = role;
    const { outside, picture, img, bubbles } = this.els;
    outside.innerHTML = ''; bubbles.innerHTML = '';
    picture.querySelectorAll('.walker, .host').forEach(n => n.remove());

    // painting background = "plate" (the host animal softly painted out)
    img.src = work.host.plate;
    img.alt = '';
    const cut = await loadImage(species.cutout);
    this.aspect = cut.naturalHeight / cut.naturalWidth;

    // which way to walk / face
    const fromLeft = work.entry.side === 'left';
    this.dir = fromLeft ? 1 : -1;
    const flip = (this.dir === 1) !== (species.faces === 'right');

    const makeWalker = (src, painted) => {
      const el = document.createElement('div');
      el.className = 'walker' + (flip ? ' flip' : '');
      el.innerHTML = `<div class="shadow"></div><div class="body"><img alt="" draggable="false"></div>`;
      const im = el.querySelector('img');
      im.src = src;
      if (painted) im.style.filter = `url(#brush-${work.style})`;
      return el;
    };
    this.rawWalker = makeWalker(species.cutout, false);
    this.paintWalker = makeWalker(paintedSrc, true);
    outside.appendChild(this.rawWalker);

    // host sprite, placed exactly where it was cut from
    const [W, H] = work.size, b = work.host.box;
    this.hostBox = { x: b[0] / W, y: b[1] / H, w: (b[2] - b[0]) / W, h: (b[3] - b[1]) / H };
    const host = document.createElement('div');
    host.className = 'host';
    Object.assign(host.style, {
      left: this.hostBox.x * 100 + '%', top: this.hostBox.y * 100 + '%',
      width: this.hostBox.w * 100 + '%', height: this.hostBox.h * 100 + '%',
    });
    host.innerHTML = `<img alt="" draggable="false"><div class="blush"></div>`;
    host.querySelector('img').src = work.host.sprite;
    const blush = host.querySelector('.blush');
    blush.style.webkitMaskImage = blush.style.maskImage = `url(${work.host.sprite})`;
    picture.appendChild(host);
    picture.appendChild(this.paintWalker);
    this.host = host; this.blush = blush;

    this.hostAnim = { dx: 0, dy: 0, rotY: 0, rot: 0, scale: 1, blush: 0, mood: 0 };
    this.visitor = { x: 0, y: 0, scale: 1, hop: 0, tilt: 0 };

    window.addEventListener('resize', this.onResize);
    picture.addEventListener('pointermove', this.onPointer);
    picture.addEventListener('pointerdown', this.onPointer);
    picture.addEventListener('pointerleave', this.onLeave);
    this.layout();
    this.place(0);
    this.loop();
  }

  // Fit the picture into the viewport, leaving room on the sides for the walk-in.
  layout() {
    const [W, H] = this.work.size;
    const vw = this.els.wrap.clientWidth, vh = window.innerHeight;
    const maxW = Math.min(vw * (vw > 900 ? 0.62 : 0.86), 1100);
    const maxH = vh * (vw > 900 ? 0.7 : 0.56);
    const s = Math.min(maxW / W, maxH / H);
    this.W = Math.round(W * s); this.H = Math.round(H * s);
    Object.assign(this.els.stage.style, { width: this.W + 'px', height: this.H + 'px' });
  }

  // Path parameter p in [0,1]: outside the frame → resting point in the painting.
  pathAt(p) {
    const e = this.work.entry;
    const startX = e.side === 'left' ? -0.32 : 1.32;
    const x = lerp(startX, e.end[0], p);
    const y = lerp(Math.min(e.end[1] + 0.1, 1.12), e.end[1], ease(p));
    const scale = lerp(1.5, 1, ease(p));          // nearer the viewer outside, smaller inside
    return { x, y, scale };
  }

  place(p) { Object.assign(this.visitor, this.pathAt(p)); }

  walkIn(duration = 5200) {
    this.state = 'walking';
    return new Promise(res => {
      const t0 = performance.now();
      let done = false;
      const step = now => {
        if (done) return;
        const p = clamp((now - t0) / duration, 0, 1);
        this.place(p);
        const steps = 9;                            // number of hops over the walk
        this.visitor.hop = Math.abs(Math.sin(p * Math.PI * steps)) * (1 - p * 0.3);
        this.visitor.tilt = Math.sin(p * Math.PI * steps * 2) * 1.6;
        if (p < 1) requestAnimationFrame(step);
        else { done = true; this.visitor.hop = 0; this.visitor.tilt = 0; this.state = 'arrived'; res(); }
      };
      requestAnimationFrame(step);
      // safety net: if animation frames are paused (background tab), still arrive
      setTimeout(() => step(t0 + duration), duration + 600);
    });
  }

  // Main render loop: positions both visitor copies and animates the host.
  loop() {
    const tick = now => {
      this.render(now / 1000);
      this.raf = requestAnimationFrame(tick);
    };
    this.raf = requestAnimationFrame(tick);
  }

  render(t) {
    const { W, H } = this;
    const e = this.work.entry, v = this.visitor;
    // visitor geometry in px
    const w = e.width * W * v.scale, h = w * this.aspect;
    const breathe = this.state === 'walking' ? 0 : Math.sin(t * 2.2) * 0.012;
    const hopPx = v.hop * h * 0.07;
    const left = v.x * W - w / 2, top = v.y * H - h;
    for (const el of [this.rawWalker, this.paintWalker]) {
      el.style.width = w + 'px';
      el.style.transform = `translate(${left}px, ${top}px)`;
      el.querySelector('.body').style.transform =
        `translateY(${-hopPx}px) rotate(${v.tilt * this.dir}deg) scaleY(${1 + breathe})`;
      el.querySelector('.shadow').style.transform = `scale(${1 - v.hop * 0.25})`;
      el.querySelector('.shadow').style.opacity = 1 - v.hop * 0.4;
    }

    // host animation
    const a = this.hostAnim, hb = this.hostBox;
    const hx = (hb.x + hb.w / 2) * W, hy = (hb.y + hb.h / 2) * H;
    const hw = hb.w * W;
    let tx = 0, ty = 0, rotY = 0, rot = Math.sin(t * 1.3) * 1.1, sc = 1, blush = 0;

    if (this.state !== 'walking') {
      // turn toward the visitor (a gentle 3D lean, not a flip)
      const towardVisitor = Math.sign(v.x * W - hx) || 1;
      rotY = towardVisitor * 14;
    }
    if (this.speaking) { sc = 1 + Math.abs(Math.sin(t * 9)) * 0.018; }

    // role reaction to the pointer
    if (this.pointer && this.state !== 'walking') {
      const [px, py] = this.pointer;
      const dx = px - hx, dy = py - hy, d = Math.hypot(dx, dy) || 1;
      const R = Math.max(hw * 1.8, 140);
      const near = clamp(1 - d / R, 0, 1);
      if (this.role === 'author') {
        blush = near;
        rotY = Math.sign(dx) * (12 + near * 16);
        rot += clamp(dy / R, -1, 1) * 4 * near;
      } else if (this.role === 'guard') {
        const push = near * hw * 0.35;
        tx = -dx / d * push; ty = -dy / d * push * 0.3;
        sc *= 1 - near * 0.06;
        rotY = -Math.sign(dx) * (10 + near * 20);
      } else {
        const reach = Math.min(d, hw * 0.6);
        tx = dx / d * reach * 0.7; ty = dy / d * reach * 0.15;
        rotY = Math.sign(dx) * 20;
      }
    }

    // answer reactions
    if (this.answer === 'yes') {
      ty -= Math.abs(Math.sin(t * 5)) * hw * 0.04 * Math.max(0, 1 - (t - this.answerT) / 3);
      blush = Math.max(blush, 0.35);
    } else if (this.answer === 'no') {
      rotY = -Math.sign(v.x * W - hx) * 24;
      rot -= 2.5; sc *= 0.97;
    }

    // smooth towards targets
    const k = 0.12;
    a.dx = lerp(a.dx, tx, k); a.dy = lerp(a.dy, ty, k);
    a.rotY = lerp(a.rotY, rotY, 0.08); a.rot = lerp(a.rot, rot, 0.1);
    a.scale = lerp(a.scale, sc, 0.2); a.blush = lerp(a.blush, blush, 0.1);
    this.host.style.transform =
      `translate(${a.dx}px, ${a.dy}px) perspective(${hw * 4}px) rotateY(${a.rotY}deg) rotate(${a.rot}deg) scale(${a.scale})`;
    this.blush.style.opacity = a.blush;
    this.host.style.filter = this.answer === 'no' ? 'saturate(.75) brightness(.92)'
      : this.answer === 'yes' ? 'saturate(1.08) brightness(1.06)' : '';
    this.positionBubbles();
  }

  // ---- speech -----------------------------------------------------------
  say(who, name, text, hold = true) {
    const b = document.createElement('div');
    b.className = 'bubble';
    b.dataset.who = who;
    b.innerHTML = `<span class="who"></span><span class="txt"></span>`;
    b.querySelector('.who').textContent = name;
    b.querySelector('.txt').textContent = text;
    this.els.bubbles.querySelectorAll(`.bubble[data-who="${who}"]`).forEach(n => n.remove());
    this.els.bubbles.appendChild(b);
    this.positionBubbles();
    requestAnimationFrame(() => b.classList.add('show'));
    if (who === 'host') {
      this.speaking = true;
      clearTimeout(this.speakT);
      this.speakT = setTimeout(() => { this.speaking = false; }, 1600);
    }
    return b;
  }

  positionBubbles() {
    const { W, H } = this;
    for (const b of this.els.bubbles.children) {
      const bw = b.offsetWidth, bh = b.offsetHeight;
      let x, y;
      if (b.dataset.who === 'host') {
        const hb = this.hostBox;
        x = (hb.x + hb.w / 2) * W - bw / 2 + this.hostAnim.dx;
        y = hb.y * H - bh - 12;
      } else {
        const e = this.work.entry, v = this.visitor;
        const w = e.width * W * v.scale, h = w * this.aspect;
        x = v.x * W - bw / 2;
        y = v.y * H - h - bh - 12;
      }
      // keep bubbles on screen: clamp to the viewport, not only the picture
      const r = this.els.stage.getBoundingClientRect();
      x = clamp(x, -r.left + 8, window.innerWidth - r.left - bw - 8);
      y = clamp(y, -r.top + 72, H - bh);
      b._x = x; b._y = y; b._w = bw; b._h = bh;
    }
    // if the two speakers' bubbles collide, lift the older one above the newer one
    const [older, newer] = this.els.bubbles.children;
    if (older && newer && older._x < newer._x + newer._w && newer._x < older._x + older._w &&
        older._y < newer._y + newer._h && newer._y < older._y + older._h) {
      older._y = newer._y - older._h - 10;
    }
    for (const b of this.els.bubbles.children) { b.style.left = b._x + 'px'; b.style.top = b._y + 'px'; }
  }

  setAnswer(ans) {
    this.answer = ans; this.answerT = performance.now() / 1000;
    // the visitor reacts too: steps closer and hops, or backs away and lowers its head
    const v = this.visitor, start = v.x, target = start + (ans === 'yes' ? 0.035 : -0.035) * this.dir;
    const t0 = performance.now();
    const step = now => {
      const p = clamp((now - t0) / 1100, 0, 1);
      v.x = lerp(start, target, ease(p));
      if (ans === 'yes') { v.hop = Math.abs(Math.sin(p * Math.PI * 3)) * (1 - p); v.tilt = 0; }
      else { v.tilt = lerp(0, -5, ease(p)); }
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  destroy() {
    cancelAnimationFrame(this.raf);
    clearTimeout(this.speakT);
    window.removeEventListener('resize', this.onResize);
    const p = this.els.picture;
    p.removeEventListener('pointermove', this.onPointer);
    p.removeEventListener('pointerdown', this.onPointer);
    p.removeEventListener('pointerleave', this.onLeave);
  }
}

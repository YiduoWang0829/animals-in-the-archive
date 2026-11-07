// Camera interaction (only after explicit consent). One camera stream feeds two
// MediaPipe models that are stored on this site: a face detector and a hand
// landmarker. Frames are processed in this tab only; nothing is uploaded,
// recorded or saved.
//
// Reports, through callbacks:
//   onFace({present, x, y, size})          x,y in 0..1, mirrored like a mirror
//   onHands([{x, y, pinch, open, fist, pinchX, pinchY, lm}])
//   onGesture('nod' | 'shake' | 'wave' | 'swipeLeft' | 'swipeRight')

const BASE = new URL('../vendor/', import.meta.url).href;

export class Tracker {
  constructor(video, handlers = {}) {
    this.video = video;
    this.h = handlers;
    this.faceHist = []; this.handHist = [];
    this.lastGesture = 0;
    this.frame = 0;
  }

  async start() {
    this.stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } }, audio: false,
    });
    this.video.srcObject = this.stream;
    await this.video.play();
    try {
      const { FilesetResolver, FaceDetector, HandLandmarker } =
        await import(BASE + 'mediapipe-tasks-vision-0.10.14/vision_bundle.mjs');
      const fs = await FilesetResolver.forVisionTasks(BASE + 'mediapipe-tasks-vision-0.10.14/wasm');
      const make = async delegate => {
        this.face = await FaceDetector.createFromOptions(fs, {
          baseOptions: { modelAssetPath: BASE + 'models/blaze_face_short_range.tflite', delegate },
          runningMode: 'VIDEO', minDetectionConfidence: 0.5,
        });
        this.hands = await HandLandmarker.createFromOptions(fs, {
          baseOptions: { modelAssetPath: BASE + 'models/hand_landmarker.task', delegate },
          runningMode: 'VIDEO', numHands: 2,
        });
      };
      try { await make('GPU'); } catch { await make('CPU'); }
    } catch (err) { this.stop(); throw err; }
    this.running = true;
    this.loop();
    return this;
  }

  stop() {
    this.running = false;
    cancelAnimationFrame(this.raf); clearTimeout(this.timer);
    this.stream?.getTracks().forEach(t => t.stop());
    this.video.srcObject = null;
    this.face?.close(); this.hands?.close();
    this.face = this.hands = null;
  }

  loop() {
    if (!this.running) return;
    const v = this.video, now = performance.now();
    // ~30 detections a second in total (hands and face alternate), so the 3D scene
    // keeps most of each frame for itself
    if (v.readyState >= 2 && v.currentTime !== this.lastT && now - (this.lastRun || 0) > 33) {
      this.lastT = v.currentTime; this.lastRun = now;
      if (this.frame++ % 2 === 0) this.detectFace(now); else this.detectHands(now);
    }
    this.raf = requestAnimationFrame(() => this.loop());
  }

  detectFace(now) {
    const res = this.face.detectForVideo(this.video, now);
    const d = res.detections?.[0];
    if (!d) { this.h.onFace?.({ present: false }); this.faceHist = []; return; }
    const b = d.boundingBox, W = this.video.videoWidth, H = this.video.videoHeight;
    const f = { present: true, x: 1 - (b.originX + b.width / 2) / W, y: (b.originY + b.height / 2) / H, size: b.width / W };
    // nose keypoint (index 2) moves more than the box when you nod: use it if present
    const nose = d.keypoints?.[2];
    const ny = nose ? nose.y : f.y, nx = nose ? 1 - nose.x : f.x;
    this.h.onFace?.(f);
    this.faceHist.push({ t: now, x: nx, y: ny });
    this.faceHist = this.faceHist.filter(p => now - p.t < 1100);
    if (this.faceHist.length < 5 || now - this.lastGesture < 1100) return;
    // a nod = down then back up; a shake = sideways and back. Measured relative to
    // face size so it works near or far from the camera.
    const s = f.size || 0.2, H0 = this.faceHist[0];
    const ys = this.faceHist.map(p => p.y), xs = this.faceHist.map(p => p.x);
    const yMax = Math.max(...ys), yMin = Math.min(...ys), xMax = Math.max(...xs), xMin = Math.min(...xs);
    const iMax = ys.indexOf(yMax), last = this.faceHist[this.faceHist.length - 1];
    const dy = (yMax - yMin) / s, dx = (xMax - xMin) / s;
    const nod = dy > 0.07 && dy > dx * 1.3 && (yMax - H0.y) / s > 0.04 && (yMax - last.y) / s > 0.035 && iMax > 0 && iMax < ys.length - 1;
    let turns = 0, dir = 0;
    for (let i = 1; i < xs.length; i++) {
      const dv = xs[i] - xs[i - 1];
      if (Math.abs(dv) > s * 0.01) { const nd = Math.sign(dv); if (dir && nd !== dir) turns++; dir = nd; }
    }
    const shake = dx > 0.09 && dx > dy * 1.3 && turns >= 1;
    if (nod) this.gesture('nod', now);
    else if (shake) this.gesture('shake', now);
  }

  detectHands(now) {
    const res = this.hands.detectForVideo(this.video, now);
    const hands = (res.landmarks || []).map(lm => {
      const wrist = lm[0], mid = lm[9];
      const size = Math.hypot(mid.x - wrist.x, mid.y - wrist.y) || 1e-3;
      const ext = [8, 12, 16, 20].filter(t => Math.hypot(lm[t].x - wrist.x, lm[t].y - wrist.y) >
                                             Math.hypot(lm[t - 2].x - wrist.x, lm[t - 2].y - wrist.y) * 1.12).length;
      const pinchDist = Math.hypot(lm[4].x - lm[8].x, lm[4].y - lm[8].y) / size;
      const pinch = pinchDist < 0.38;
      const cx = lm.reduce((a, p) => a + p.x, 0) / lm.length, cy = lm.reduce((a, p) => a + p.y, 0) / lm.length;
      return {
        x: 1 - cx, y: cy, size, pinch, pinchDist, open: ext >= 4 && !pinch, fist: ext <= 1 && !pinch,
        pinchX: 1 - (lm[4].x + lm[8].x) / 2, pinchY: (lm[4].y + lm[8].y) / 2, lm,
      };
    });
    // steadier hands: smooth positions, and give pinch hysteresis so it does not flicker.
    // Hands are matched to last frame's by nearest position.
    const prev = this.prevHands || [];
    for (const h of hands) {
      let best = null, bd = 0.2;
      for (const p of prev) { const d = Math.hypot(p.rawX - h.x, p.rawY - h.y); if (d < bd) { bd = d; best = p; } }
      h.rawX = h.x; h.rawY = h.y;
      if (best) {
        const k = 0.45;                                   // 0 = frozen, 1 = raw
        h.x = best.x + (h.x - best.x) * k; h.y = best.y + (h.y - best.y) * k;
        h.pinchX = best.pinchX + (h.pinchX - best.pinchX) * k; h.pinchY = best.pinchY + (h.pinchY - best.pinchY) * k;
        h.pinch = best.pinch ? h.pinchDist < 0.5 : h.pinchDist < 0.32;
      } else h.pinch = h.pinchDist < 0.32;
      h.open = h.open && !h.pinch;
    }
    this.prevHands = hands;
    this.h.onHands?.(hands);
    // wave (open palm moving side to side) and swipe (one fast sideways sweep)
    const open = hands.find(h => h.open);
    if (open) this.handHist.push({ t: now, x: open.x });
    this.handHist = this.handHist.filter(p => now - p.t < 1200);
    if (this.handHist.length > 6 && now - this.lastGesture > 1200) {
      let turns = 0, dir = 0;
      for (let i = 1; i < this.handHist.length; i++) {
        const dv = this.handHist[i].x - this.handHist[i - 1].x;
        if (Math.abs(dv) > 0.012) { const nd = Math.sign(dv); if (dir && nd !== dir) turns++; dir = nd; }
      }
      const first = this.handHist[0], last = this.handHist[this.handHist.length - 1];
      const sweep = last.x - first.x, dt = last.t - first.t;
      const span = Math.max(...this.handHist.map(p => p.x)) - Math.min(...this.handHist.map(p => p.x));
      if (turns >= 2 || (turns >= 1 && span > 0.12)) this.gesture('wave', now);
      else if (Math.abs(sweep) > 0.35 && dt < 700) this.gesture(sweep > 0 ? 'swipeRight' : 'swipeLeft', now);
    }
  }

  gesture(name, now) {
    this.lastGesture = now; this.faceHist = []; this.handHist = [];
    this.h.onGesture?.(name);
  }
}

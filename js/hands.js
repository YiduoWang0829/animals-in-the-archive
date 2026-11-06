// Optional hand tracking with MediaPipe HandLandmarker (vendored locally).
// Only started after explicit consent. Video frames stay in this tab: nothing
// is uploaded or stored. Thumb–index pinch acts as the sculpting brush.

const BASE = new URL('../vendor/', import.meta.url).href;

export async function startHands(video, onFrame) {
  // 1. camera (throws if denied / absent)
  const stream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } }, audio: false,
  });
  video.srcObject = stream;
  await video.play();

  let landmarker = null, raf = 0, stopped = false;
  const stop = () => {
    stopped = true;
    cancelAnimationFrame(raf);
    stream.getTracks().forEach(tr => tr.stop());
    video.srcObject = null;
    landmarker?.close();
  };

  try {
    // 2. model, from this site only
    const { FilesetResolver, HandLandmarker } =
      await import(BASE + 'mediapipe-tasks-vision-0.10.14/vision_bundle.mjs');
    const fileset = await FilesetResolver.forVisionTasks(BASE + 'mediapipe-tasks-vision-0.10.14/wasm');
    const make = delegate => HandLandmarker.createFromOptions(fileset, {
      baseOptions: { modelAssetPath: BASE + 'models/hand_landmarker.task', delegate },
      runningMode: 'VIDEO', numHands: 1,
    });
    try { landmarker = await make('GPU'); } catch { landmarker = await make('CPU'); }
  } catch (err) { stop(); throw err; }

  // 3. per-frame detection
  let lastT = -1;
  const loop = () => {
    if (stopped) return;
    if (video.readyState >= 2 && video.currentTime !== lastT) {
      lastT = video.currentTime;
      const res = landmarker.detectForVideo(video, performance.now());
      const lm = res.landmarks?.[0];
      if (lm) {
        const thumb = lm[4], index = lm[8], wrist = lm[0], mid = lm[9];
        const handSize = Math.hypot(mid.x - wrist.x, mid.y - wrist.y) || 1e-3;
        const pinchDist = Math.hypot(thumb.x - index.x, thumb.y - index.y) / handSize;
        // mirrored, so moving your hand right moves the brush right
        onFrame({ present: true, x: 1 - (thumb.x + index.x) / 2, y: (thumb.y + index.y) / 2, pinch: pinchDist < 0.38 });
      } else onFrame({ present: false });
    }
    raf = requestAnimationFrame(loop);
  };
  loop();
  return { stop };
}

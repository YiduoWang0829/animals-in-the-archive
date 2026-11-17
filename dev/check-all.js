// Development check (not used by the site): runs one visit with a 3D animal and records
// every glitch it can measure — the skeleton touching the steps, feet under the floor, the
// head turned far from the body, spinning, odd clips, and (inside) standing in a figure.
import * as THREE from '../vendor/three-0.170.0/build/three.module.js';
import { setup, pump } from './harness.js';

export async function check(id, work = 'eden', insideSec = 25) {
  const R = { id, work, steps: 0, under: 0, neck: 0, maxNeck: 0, spin: 0, maxTurn: 0, odd: {}, relief: 0, maxRelief: 0, outRange: 0, slide: 0, frames: 0, inFrames: 0, labelDx: null };
  const skip = setInterval(() => document.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true })), 350);
  const g = await setup({ work, pick: ['3d', id] });
  const v = g.visitor;
  const steps = [];
  g.scene.traverse(o => { if (o.isMesh && o.geometry?.type === 'BoxGeometry' && Math.abs(o.position.x) < 0.01 && o.position.y < 0.3 && o.position.z > 0.05 && o.position.z < 0.6) steps.push(new THREE.Box3().setFromObject(o).expandByScalar(0.02)); });
  const bones = []; v.root.traverse(o => { if (o.isBone) bones.push(o); });
  const P = new THREE.Vector3(), Q = new THREE.Vector3();
  let turnAcc = 0, lastYaw = v.yaw, unlockedAt = 0;
  const [u0, u1] = g.o.work.walk || [0, 1];
  await pump(g => {
    R.frames++;
    g.scene.updateMatrixWorld(true);
    // turning: how far it turns in one go without walking
    // (standing turns: walking a long curved route is not spinning)
    let d = v.yaw - lastYaw; lastYaw = v.yaw;
    const walked = R._lp ? Math.hypot(v.group.position.x - R._lp.x, v.group.position.z - R._lp.z) > 1e-4 : false;
    if (Math.abs(d) > 1e-4 && !walked) { turnAcc += d; R.maxTurn = Math.max(R.maxTurn, Math.abs(turnAcc)); } else if (walked || Math.abs(d) <= 1e-4) turnAcc = 0;
    if (Math.abs(turnAcc) > 3.5) R.spin++;
    // sliding: moving in a direction its body does not point
    const lp = v.group.position.clone();
    if (R._lp && !g.entering) { const dd = lp.clone().sub(R._lp); dd.y = 0;
      if (dd.length() > 1e-4) { let a = Math.atan2(dd.x, dd.z) - v.yaw; a = Math.abs(Math.atan2(Math.sin(a), Math.cos(a))); if (a > 0.25) R.slide++; } }
    R._lp = lp;
    // odd clips
    const c = v.current?.getClip().name; if (c && !/^(Idle|Walk)$/.test(c)) R.odd[c] = (R.odd[c] || 0) + 1;
    // head against the body: the neck never wrings round
    if (v.head && v.backBone) {
      v.head.getWorldPosition(P); v.backBone.getWorldPosition(Q);
      const hv = P.clone().sub(Q); hv.y = 0;
      const fw = new THREE.Vector3(Math.sin(v.yaw), 0, Math.cos(v.yaw)).transformDirection(v.group.parent.matrixWorld);
      const ang = hv.lengthSq() > 1e-8 ? hv.normalize().angleTo(fw) : 0;
      R.maxNeck = Math.max(R.maxNeck, ang); if (ang > 1.75) R.neck++;
    }
    if (!g.inside) {
      if (!g.entering) {
        if (bones.some(b => { b.getWorldPosition(P); return steps.some(s => s.containsPoint(P)); })) R.steps++;
        const minY = Math.min(...v.feet.map(f => f.getWorldPosition(P).y));
        if (minY < -0.03) R.under++;
        if (!v.target && Math.abs(v.position.z - g.labelSpot().at.z) < 0.02) R.labelDx = +(v.position.x - g.labelX).toFixed(3);
      }
    } else if (g.follow) {
      R.inFrames++;
      if (!g.locked && !unlockedAt) unlockedAt = performance.now();
      const w = g.widthOf(v); let f = -9;
      for (const fx of [-0.4, 0, 0.4]) for (const fy of [0.1, 0.5, 0.9]) f = Math.max(f, g.surfaceZ(v.position.x + fx * w, v.position.y + fy * v.height));
      const over = f - v.position.z; R.maxRelief = Math.max(R.maxRelief, over); if (over > 0.02) R.relief++;
      const u = v.position.x / g.pw + 0.5; if (u < u0 - 0.01 || u > u1 + 0.01) R.outRange++;
    }
    return unlockedAt && performance.now() - unlockedAt > insideSec * 1000;
  }, 240000);
  clearInterval(skip); clearInterval(window.__auto);
  R.maxNeck = +(R.maxNeck * 180 / Math.PI).toFixed(0); R.maxTurn = +(R.maxTurn * 180 / Math.PI).toFixed(0); R.maxRelief = +R.maxRelief.toFixed(3);
  delete R._lp;
  return R;
}

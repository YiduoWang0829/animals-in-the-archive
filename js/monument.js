// "Monument": the painting carved as a relief into a plinth, with the visitor
// and the painted animals standing on top as statues. All in one material
// (marble, bronze, clay or the painting itself), so it reads as one sculpture.
//
// Mouse/touch: drag empty space to turn, wheel to zoom, drag a statue to move it
// across the plinth. Hands (from tracking.js): pinch+move to turn, pinch on a
// statue to carry it, two hands apart/together to zoom, swipe to change material.
// Export: the whole monument as .glb (opens in Blender).

import * as THREE from 'three';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { loadAnimal3D } from './animal3d.js';

export const MATERIALS = ['marble', 'bronze', 'clay', 'painted'];

const loadImg = url => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });

function makeMaterial(kind, map) {
  switch (kind) {
    case 'bronze': return new THREE.MeshStandardMaterial({ color: 0x8a6232, metalness: 0.9, roughness: 0.38 });
    case 'clay': return new THREE.MeshStandardMaterial({ color: 0xb8775a, metalness: 0, roughness: 0.95 });
    case 'painted': return new THREE.MeshStandardMaterial({ map, metalness: 0, roughness: 0.8 });
    default: return new THREE.MeshStandardMaterial({ color: 0xe9e4da, metalness: 0, roughness: 0.55 });
  }
}

// a 2D animal (drawing / storybook / painted sprite) as a carved slab statue
async function slabStatue(src, height) {
  const img = src instanceof HTMLCanvasElement ? src : await loadImg(src);
  const aspect = img.width / img.height;
  const cv = document.createElement('canvas'); const G = 96;
  cv.width = Math.round(G * Math.max(1, aspect)); cv.height = Math.round(G / Math.min(1, aspect));
  const ctx = cv.getContext('2d', { willReadFrequently: true }); ctx.drawImage(img, 0, 0, cv.width, cv.height);
  const a = ctx.getImageData(0, 0, cv.width, cv.height).data;
  const shape = new THREE.Shape();
  // outline from the alpha channel: a simple marching walk over the column extents
  const cols = cv.width, rows = cv.height, top = [], bot = [];
  for (let x = 0; x < cols; x++) {
    let t = -1, b = -1;
    for (let y = 0; y < rows; y++) if (a[(y * cols + x) * 4 + 3] > 100) { if (t < 0) t = y; b = y; }
    if (t >= 0) { top.push([x, t]); bot.push([x, b]); }
  }
  if (!top.length) return new THREE.Group();
  const P = ([x, y]) => [(x / cols - 0.5) * aspect, 1 - y / rows];
  shape.moveTo(...P(top[0])); top.forEach(p => shape.lineTo(...P(p)));
  [...bot].reverse().forEach(p => shape.lineTo(...P(p)));
  const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.06, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.012, bevelSegments: 3 });
  geo.translate(0, 0, -0.03);
  const tex = new THREE.Texture(img); tex.colorSpace = THREE.SRGBColorSpace; tex.needsUpdate = true;
  // planar UVs so the 'painted' material shows the picture on the front
  const pos = geo.attributes.position, uv = new Float32Array(pos.count * 2);
  for (let i = 0; i < pos.count; i++) { uv[i * 2] = pos.getX(i) / aspect + 0.5; uv[i * 2 + 1] = pos.getY(i); }
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  const mesh = new THREE.Mesh(geo); mesh.userData.map = tex;
  const g = new THREE.Group(); g.add(mesh); g.scale.setScalar(height);
  return g;
}

export async function createMonument(container, { work, visitor, statues }) {
  const r = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  r.setPixelRatio(Math.min(devicePixelRatio, 2));
  r.outputColorSpace = THREE.SRGBColorSpace; r.toneMapping = THREE.ACESFilmicToneMapping;
  Object.assign(r.domElement.style, { width: '100%', height: '100%', display: 'block', touchAction: 'none' });
  container.appendChild(r.domElement);
  const scene = new THREE.Scene(); scene.background = new THREE.Color(0x0f0e0c);
  scene.fog = new THREE.Fog(0x0f0e0c, 7, 15);
  const cam = new THREE.PerspectiveCamera(36, 1, 0.05, 50);
  scene.add(new THREE.HemisphereLight(0xfff4e6, 0x1a1612, 0.7));
  const key = new THREE.SpotLight(0xfff0dc, 90, 14, 0.55, 0.6, 1.4); key.position.set(2.5, 5, 3.5); scene.add(key);
  const rim = new THREE.DirectionalLight(0x9fb4d8, 1.4); rim.position.set(-3, 2, -3); scene.add(rim);
  const floor = new THREE.Mesh(new THREE.CircleGeometry(8, 64), new THREE.MeshStandardMaterial({ color: 0x15130f, roughness: 0.6 }));
  floor.rotation.x = -Math.PI / 2; scene.add(floor);

  const sculpture = new THREE.Group(); scene.add(sculpture);
  const [W, H] = work.size, pw = 2.4, ph = pw * H / W, base = 0.5;

  // ---- plinth: the painting carved in relief on its front face ----
  const [img, depthImg] = await Promise.all([loadImg(work.hd), loadImg(work.depth)]);
  const map = new THREE.Texture(img); map.colorSpace = THREE.SRGBColorSpace; map.needsUpdate = true;
  const dc = document.createElement('canvas'); dc.width = 260; dc.height = Math.round(200 * H / W);
  const dx = dc.getContext('2d', { willReadFrequently: true }); dx.drawImage(depthImg, 0, 0, dc.width, dc.height);
  const dd = dx.getImageData(0, 0, dc.width, dc.height).data;
  const relief = new THREE.PlaneGeometry(pw, ph, dc.width - 1, dc.height - 1);
  const rp = relief.attributes.position;
  for (let i = 0; i < rp.count; i++) rp.setZ(i, Math.pow(dd[i * 4] / 255, 1.4) * 0.2);   // near = stands out
  relief.computeVertexNormals();
  const block = new THREE.BoxGeometry(pw + 0.16, ph + 0.16, 0.5);
  const parts = { relief: new THREE.Mesh(relief), block: new THREE.Mesh(block), top: new THREE.Mesh(new THREE.BoxGeometry(pw + 0.5, 0.06, 1.3)) };
  parts.relief.position.set(0, base + ph / 2, 0.26);
  parts.block.position.set(0, base + ph / 2, 0);
  parts.top.position.set(0, base + ph + 0.11, 0.25);
  const step = new THREE.Mesh(new THREE.BoxGeometry(pw + 0.7, base, 1.6)); step.position.set(0, base / 2, 0.15);
  parts.step = step;
  for (const m of Object.values(parts)) sculpture.add(m);
  parts.relief.userData.map = map;
  const topY = base + ph + 0.14;

  // ---- statues on top ----
  const actors = [];                 // 3D animals keep their pose; we freeze them mid-stride
  const statueGroups = [];
  const all = [{ ...visitor, isVisitor: true }, ...statues];
  for (const [k, s] of all.entries()) {
    let g;
    if (s.kind === 'animal3d') {
      const a = await loadAnimal3D(s.glb, { height: Math.max(0.55, s.height * 1.1) });
      a.play(k === 0 ? 'walk' : 'idle', 0); a.mixer.update(0.4); a.mixer.timeScale = 0;   // frozen like a statue
      a.inner.rotation.y = Math.PI / 2;
      g = a.group; actors.push(a);
      g.traverse(o => { if (o.isMesh) o.userData.map = [].concat(o.material)[0].map; });
    } else {
      g = await slabStatue(s.src, Math.max(0.45, s.height * 1.2));
      if (s.flip) g.scale.x *= -1;
    }
    const x = (k - (all.length - 1) / 2) * Math.min(0.85, (pw + 0.3) / all.length);
    g.position.set(x, topY, 0.3);
    g.userData.statue = true;
    sculpture.add(g); statueGroups.push(g);
  }

  // ---- materials ----
  let current = 'marble';
  const setMaterial = kind => {
    current = kind;
    sculpture.traverse(o => {
      if (!o.isMesh) return;
      const old = o.material;
      o.material = makeMaterial(kind, o.userData.map || map);
      if (o.isSkinnedMesh) o.material.skinning = true;
      [].concat(old).forEach(m => m.dispose?.());
    });
  };
  setMaterial('marble');

  // ---- camera / controls ----
  const view = { yaw: -0.4, pitch: 0.2, dist: 7.6, ty: -0.4, tp: 0.2, td: 7.6 };
  const target = new THREE.Vector3(0, base + ph * 0.72, 0.2);
  const resize = () => { const w = container.clientWidth, h = container.clientHeight; r.setSize(w, h, false); cam.aspect = w / h; cam.updateProjectionMatrix(); };
  const ro = new ResizeObserver(resize); ro.observe(container); resize();

  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  const statueAt = (cx, cy) => {
    const b = r.domElement.getBoundingClientRect();
    ndc.set((cx - b.left) / b.width * 2 - 1, -((cy - b.top) / b.height * 2 - 1));
    ray.setFromCamera(ndc, cam);
    const hit = ray.intersectObjects(statueGroups, true)[0];
    if (!hit) return null;
    let o = hit.object; while (o && !o.userData.statue) o = o.parent;
    return o;
  };
  const topPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -topY);
  const moveStatue = (g, cx, cy) => {
    const b = r.domElement.getBoundingClientRect();
    ndc.set((cx - b.left) / b.width * 2 - 1, -((cy - b.top) / b.height * 2 - 1));
    ray.setFromCamera(ndc, cam);
    const p = new THREE.Vector3();
    if (!ray.ray.intersectPlane(topPlane, p)) return;
    const local = sculpture.worldToLocal(p);
    g.position.x = THREE.MathUtils.clamp(local.x, -pw / 2 - 0.15, pw / 2 + 0.15);
    g.position.z = THREE.MathUtils.clamp(local.z, -0.35, 0.85);
  };

  let drag = null;
  const el = r.domElement;
  el.addEventListener('pointerdown', e => {
    try { el.setPointerCapture(e.pointerId); } catch {}
    drag = { x: e.clientX, y: e.clientY, statue: statueAt(e.clientX, e.clientY) };
  });
  el.addEventListener('pointermove', e => {
    if (!drag) return;
    if (drag.statue) moveStatue(drag.statue, e.clientX, e.clientY);
    else { view.ty -= (e.clientX - drag.x) * 0.006; view.tp = THREE.MathUtils.clamp(view.tp + (e.clientY - drag.y) * 0.004, -0.05, 1.1); }
    drag.x = e.clientX; drag.y = e.clientY;
  });
  el.addEventListener('pointerup', () => { drag = null; });
  el.addEventListener('wheel', e => { e.preventDefault(); view.td = THREE.MathUtils.clamp(view.td + e.deltaY * 0.004, 2.6, 11); }, { passive: false });
  el.addEventListener('dblclick', e => { const s = statueAt(e.clientX, e.clientY); if (s) s.rotation.y += Math.PI / 2; });

  // ---- hands ----
  let handGrab = null, prevPinch = null, zoom0 = null;
  const handInput = hs => {
    const pinch = hs.find(h => h.pinch), open = hs.filter(h => h.open);
    if (pinch) {
      const sx = pinch.pinchX * innerWidth, sy = pinch.pinchY * innerHeight;
      if (!handGrab && !prevPinch) handGrab = statueAt(sx, sy) || 'turn';
      if (handGrab && handGrab !== 'turn') moveStatue(handGrab, sx, sy);
      else if (prevPinch) { view.ty -= (pinch.pinchX - prevPinch[0]) * 4; view.tp = THREE.MathUtils.clamp(view.tp + (pinch.pinchY - prevPinch[1]) * 2.5, -0.05, 1.1); }
      prevPinch = [pinch.pinchX, pinch.pinchY];
    } else { handGrab = null; prevPinch = null; }
    if (open.length === 2) {
      const d = Math.hypot(open[0].x - open[1].x, open[0].y - open[1].y);
      if (zoom0) view.td = THREE.MathUtils.clamp(view.td - (d - zoom0) * 9, 2.6, 9);
      zoom0 = d;
    } else zoom0 = null;
  };

  const clock = new THREE.Clock();
  let raf = 0;
  r.setAnimationLoop(() => {
    const dt = Math.min(0.05, clock.getDelta());
    view.yaw += (view.ty - view.yaw) * 0.1; view.pitch += (view.tp - view.pitch) * 0.1; view.dist += (view.td - view.dist) * 0.1;
    cam.position.set(target.x + Math.sin(view.yaw) * Math.cos(view.pitch) * view.dist,
      target.y + Math.sin(view.pitch) * view.dist, target.z + Math.cos(view.yaw) * Math.cos(view.pitch) * view.dist);
    cam.lookAt(target);
    r.render(scene, cam);
  });

  return {
    materials: MATERIALS,
    get material() { return current; },
    setMaterial,
    nextMaterial(step = 1) { setMaterial(MATERIALS[(MATERIALS.indexOf(current) + step + MATERIALS.length) % MATERIALS.length]); },
    handInput,
    // turn the step so it would advance a fixed amount (testing)
    turn(d) { view.ty += d; },
    screenshot() { r.render(scene, cam); return r.domElement.toDataURL('image/png'); },
    exportGLB() {
      return new Promise((res, rej) => new GLTFExporter().parse(sculpture,
        buf => res(new Blob([buf], { type: 'model/gltf-binary' })), rej, { binary: true }));
    },
    dispose() {
      r.setAnimationLoop(null); ro.disconnect();
      actors.forEach(a => a.mixer.stopAllAction());
      scene.traverse(o => { o.geometry?.dispose?.(); if (o.material) [].concat(o.material).forEach(m => m.dispose?.()); });
      r.dispose(); el.remove();
    },
  };
}

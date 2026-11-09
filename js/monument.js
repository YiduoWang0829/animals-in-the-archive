// "Monument": the painting carved as a relief into a plinth, with the visitor
// and the painted animals standing on top as statues. All in one material
// (marble, bronze, clay or the painting itself), so it reads as one sculpture.
//
// Mouse/touch: drag empty space to turn, wheel to zoom, drag a statue to move it
// across the plinth. Hands (from tracking.js): pinch+move to turn, pinch on a
// statue to carry it, two hands apart/together to zoom, swipe to change material.
// Export: the whole monument as .glb (opens in Blender).

import * as THREE from '../vendor/three-0.170.0/build/three.module.js';
import { GLTFExporter } from '../vendor/three-0.170.0/examples/jsm/exporters/GLTFExporter.js';
import { loadAnimal3D } from './animal3d.js';

export const MATERIALS = ['marble', 'bronze', 'clay', 'painted'];

const loadImg = url => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });

function makeMaterial(kind, map) {
  switch (kind) {
    case 'bronze': return new THREE.MeshStandardMaterial({ color: 0x8a6232, metalness: 0.9, roughness: 0.38 });
    case 'clay': return new THREE.MeshStandardMaterial({ color: 0xb8775a, metalness: 0, roughness: 0.95 });
    case 'painted': return map ? new THREE.MeshStandardMaterial({ map, metalness: 0, roughness: 0.8 })
      : new THREE.MeshStandardMaterial({ color: 0x5a4632, metalness: 0.1, roughness: 0.7 });
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

export async function createMonument(container, { work, visitor, statues, objects = [], inscription = null }) {
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

  // ---- the painting's depth, used to carve every form ----
  const [img, depthImg] = await Promise.all([loadImg(work.hd), loadImg(work.depth)]);
  const map = new THREE.Texture(img); map.colorSpace = THREE.SRGBColorSpace; map.needsUpdate = true;
  const wrapMap = map.clone(); wrapMap.wrapS = THREE.RepeatWrapping; wrapMap.repeat.set(2, 1); wrapMap.needsUpdate = true;
  const aspect = W / H;
  const dw = 260, dh = Math.round(260 / aspect);
  const dc = document.createElement('canvas'); dc.width = dw; dc.height = dh;
  const dx = dc.getContext('2d', { willReadFrequently: true }); dx.drawImage(depthImg, 0, 0, dw, dh);
  const dd = dx.getImageData(0, 0, dw, dh).data;
  const depthAt = (u, v) => {
    u = u - Math.floor(u); v = Math.min(1, Math.max(0, v));
    return Math.pow(dd[(Math.round((1 - v) * (dh - 1)) * dw + Math.round(u * (dw - 1))) * 4] / 255, 1.4);
  };
  // a flat relief panel; clip() may pull edge vertices onto an outline (oval)
  function reliefPanel(w, h, amp, clip) {
    const g = new THREE.PlaneGeometry(w, h, dw - 1, dh - 1), p = g.attributes.position, uv = g.attributes.uv;
    for (let i = 0; i < p.count; i++) {
      if (clip) { const [x, y] = clip(p.getX(i), p.getY(i)); p.setXY(i, x, y); }
      p.setZ(i, depthAt(uv.getX(i), uv.getY(i)) * amp);
    }
    g.computeVertexNormals();
    const m = new THREE.Mesh(g); m.userData.map = map; return m;
  }
  // carve the painting around a curved surface (uv.x around, uv.y along v0..v1)
  function wrapRelief(g, amp, v0 = 0, v1 = 1) {
    const p = g.attributes.position, n = g.attributes.normal, uv = g.attributes.uv;
    for (let i = 0; i < p.count; i++) {
      const v = (uv.getY(i) - v0) / (v1 - v0);
      if (v < 0 || v > 1) continue;
      const d = depthAt(uv.getX(i) * 2, v) * amp * Math.sin(Math.PI * v) ** 0.3;   // fades at the rims
      p.setXYZ(i, p.getX(i) + n.getX(i) * d, p.getY(i) + n.getY(i) * d, p.getZ(i) + n.getZ(i) * d);
    }
    g.computeVertexNormals();
    const m = new THREE.Mesh(g); m.userData.map = wrapMap; return m;
  }
  const mesh = (geo, x = 0, y = 0, z = 0) => { const m = new THREE.Mesh(geo); m.position.set(x, y, z); m.userData.map = null; return m; };

  // ---- the forms. Each returns its group, where statues stand, and its height ----
  const FORMS = {
    stele() {
      const g = new THREE.Group(), ph = 2.4 / aspect, pw = 2.4;
      g.add(mesh(new THREE.BoxGeometry(pw + 0.7, base, 1.6), 0, base / 2, 0.15));
      g.add(mesh(new THREE.BoxGeometry(pw + 0.16, ph + 0.16, 0.5), 0, base + ph / 2, 0));
      const r = reliefPanel(pw, ph, 0.2); r.position.set(0, base + ph / 2, 0.26); g.add(r);
      g.add(mesh(new THREE.BoxGeometry(pw + 0.5, 0.06, 1.3), 0, base + ph + 0.11, 0.25));
      return { g, topY: base + ph + 0.14, z: 0.3, height: base + ph + 0.6, spread: pw + 0.3 };
    },
    cube() {
      const g = new THREE.Group(), S = 1.9, b = 0.3, inner = S - 0.26;
      const rw = aspect >= 1 ? inner : inner * aspect, rh = rw / aspect;
      g.add(mesh(new THREE.BoxGeometry(S + 0.4, b, S + 0.4), 0, b / 2, 0));
      g.add(mesh(new THREE.BoxGeometry(S, S, S), 0, b + S / 2, 0));
      const r = reliefPanel(rw, rh, 0.16); r.position.set(0, b + S / 2, S / 2 + 0.004); g.add(r);
      g.add(mesh(new THREE.BoxGeometry(S + 0.12, 0.06, S + 0.12), 0, b + S + 0.03, 0));
      return { g, topY: b + S + 0.06, z: 0.1, height: b + S + 0.6, spread: S };
    },
    drum() {
      const g = new THREE.Group(), R = 1.0, Hd = 1.45, b = 0.28;
      g.add(mesh(new THREE.CylinderGeometry(R + 0.25, R + 0.3, b, 96), 0, b / 2, 0));
      const side = wrapRelief(new THREE.CylinderGeometry(R, R, Hd, 360, 120, true), 0.13);
      side.position.y = b + Hd / 2; g.add(side);
      g.add(mesh(new THREE.CylinderGeometry(R + 0.06, R + 0.06, 0.08, 96), 0, b + Hd + 0.04, 0));
      g.add(mesh(new THREE.CylinderGeometry(R + 0.06, R + 0.06, 0.06, 96), 0, b + 0.03, 0));
      return { g, topY: b + Hd + 0.08, z: 0.05, height: b + Hd + 0.6, spread: 1.8 };
    },
    chalice() {
      const g = new THREE.Group();
      const foot = [[0, 0], [0.8, 0], [0.82, 0.07], [0.6, 0.15], [0.3, 0.28], [0.17, 0.45], [0.15, 0.7], [0.2, 0.82], [0.24, 0.86]]
        .map(([x, y]) => new THREE.Vector2(x, y));
      g.add(mesh(new THREE.LatheGeometry(foot, 128)));
      const bowl = [];
      for (let i = 0; i <= 60; i++) { const k = i / 60; bowl.push(new THREE.Vector2(0.24 + 0.84 * Math.pow(Math.sin(k * Math.PI / 2), 0.75), 0.86 + 1.1 * k)); }
      g.add(wrapRelief(new THREE.LatheGeometry(bowl, 360), 0.11, 0.18, 0.98));
      g.add(mesh(new THREE.CylinderGeometry(1.12, 1.09, 0.06, 128), 0, 1.99, 0));
      return { g, topY: 2.02, z: 0.05, height: 2.6, spread: 1.9 };
    },
    medallion() {
      const g = new THREE.Group(), a = 1.15, bb = a / Math.max(0.75, Math.min(1.35, aspect)) * 1.05, b = 0.3;
      const cy = b + 0.12 + bb;
      const ell = (x, y) => { const k = Math.hypot(x / a, y / bb); return k > 1 ? [x / k, y / k] : [x, y]; };
      const r = reliefPanel(2 * a, 2 * bb, 0.17, ell); r.position.set(0, cy, 0.1); g.add(r);
      const shape = new THREE.Shape(); shape.absellipse(0, 0, a + 0.04, bb + 0.04, 0, Math.PI * 2);
      const back = mesh(new THREE.ExtrudeGeometry(shape, { depth: 0.22, bevelEnabled: false, curveSegments: 96 }), 0, cy, -0.12); g.add(back);
      const rim = mesh(new THREE.TorusGeometry(1, 0.055, 16, 160), 0, cy, 0.1); rim.scale.set(a + 0.04, bb + 0.04, 1); g.add(rim);
      g.add(mesh(new THREE.BoxGeometry(2 * a + 0.6, b, 1.5), 0, b / 2, 0.2));
      return { g, topY: b, z: 0.62, height: cy + bb + 0.4, spread: 2 * a + 0.3 };
    },
  };
  let form = null, formName = '';
  function buildForm(name) {
    if (form) { sculpture.remove(form.g); form.g.traverse(o => { o.geometry?.dispose(); [].concat(o.material || []).forEach(m => m.dispose?.()); }); }
    form = FORMS[name](); formName = name;
    sculpture.add(form.g);
  }
  buildForm('stele');
  const topY = form.topY;

  // ---- statues on top ----
  const actors = [];                 // 3D animals keep their pose; we freeze them mid-stride
  const statueGroups = [];
  // the animals, with the things they talked about standing between them
  const all = [{ ...visitor, isVisitor: true }, ...statues];
  objects.forEach((o, i) => all.splice(Math.min(all.length, 1 + i * 2), 0, { kind: 'slab', src: o, height: 0.36, object: true }));
  for (const [k, s] of all.entries()) {
    let g;
    if (s.kind === 'animal3d') {
      const a = await loadAnimal3D(s.glb, { height: Math.max(0.55, s.height * 1.1) });
      a.play(k === 0 ? 'walk' : 'idle', 0); a.mixer.update(0.4); a.mixer.timeScale = 0;   // frozen like a statue
      a.inner.rotation.y = Math.PI / 2;
      g = a.group; actors.push(a);
      g.traverse(o => { if (o.isMesh) o.userData.map = [].concat(o.material)[0].map; });
    } else {
      g = await slabStatue(s.src, s.object ? s.height : Math.max(0.45, s.height * 1.2));
      if (s.flip) g.scale.x *= -1;
    }
    const x = (k - (all.length - 1) / 2) * Math.min(0.85, form.spread / all.length);
    g.position.set(x, form.topY, form.z);
    g.userData.statue = true;
    sculpture.add(g); statueGroups.push(g);
  }

  // ---- the inscription: a low stone in front, with their words cut into it ----
  if (inscription) {
    const tc = document.createElement('canvas'); tc.width = 2048; tc.height = 640;
    const x = tc.getContext('2d');
    x.fillStyle = '#fff'; x.fillRect(0, 0, tc.width, tc.height);
    x.fillStyle = '#34302a'; x.textAlign = 'center';
    x.font = '500 50px "Cormorant Garamond", "Songti SC", "Noto Serif SC", "AppleMyungjo", "Noto Serif KR", Georgia, serif';
    x.fillText(inscription.head.toUpperCase(), tc.width / 2, 92, tc.width - 120);
    x.strokeStyle = '#6d675d'; x.lineWidth = 4; x.beginPath(); x.moveTo(560, 128); x.lineTo(tc.width - 560, 128); x.stroke();
    x.font = 'italic 400 66px "Cormorant Garamond", "Songti SC", "Noto Serif SC", "AppleMyungjo", "Noto Serif KR", Georgia, serif';
    inscription.lines.slice(0, 5).forEach((l, i) => x.fillText(l, tc.width / 2, 212 + i * 88, tc.width - 100));
    const tex = new THREE.CanvasTexture(tc); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
    const stone = new THREE.Group();
    const slab = new THREE.Mesh(new THREE.BoxGeometry(2.7, 0.14, 0.86)); slab.userData.map = null; slab.position.y = 0.07;
    const face = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 0.81)); face.rotation.x = -Math.PI / 2; face.position.y = 0.1405;
    face.userData.inscription = tex;
    stone.add(slab, face);
    stone.position.set(0, 0, 1.55); stone.rotation.x = 0.16;
    sculpture.add(stone);
  }

  // ---- materials ----
  let current = 'marble';
  const setMaterial = kind => {
    current = kind;
    sculpture.traverse(o => {
      if (!o.isMesh) return;
      const old = o.material;
      o.material = makeMaterial(kind, o.userData.map === undefined ? map : o.userData.map);
      if (o.userData.inscription) {                 // the letters are cut: darker, in any material
        o.material = makeMaterial(kind === 'painted' ? 'clay' : kind, null);
        o.material.map = o.userData.inscription; o.material.bumpMap = o.userData.inscription; o.material.bumpScale = -3;
      }
      if (o.isSkinnedMesh) o.material.skinning = true;
      [].concat(old).forEach(m => m.dispose?.());
    });
  };
  setMaterial('marble');

  // ---- camera / controls ----
  // a little from above, so the carved stone in front can be read too
  const d0 = 6.4 + form.height * 0.95;          // far enough back for the whole form, statues to stone
  const view = { yaw: -0.35, pitch: 0.36, dist: d0, ty: -0.35, tp: 0.36, td: d0 };
  const target = new THREE.Vector3(0, form.height * 0.42, inscription ? 0.55 : 0.2);
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
  const setTopPlane = () => { topPlane.constant = -form.topY; };
  const moveStatue = (g, cx, cy) => {
    const b = r.domElement.getBoundingClientRect();
    ndc.set((cx - b.left) / b.width * 2 - 1, -((cy - b.top) / b.height * 2 - 1));
    ray.setFromCamera(ndc, cam);
    const p = new THREE.Vector3();
    if (!ray.ray.intersectPlane(topPlane, p)) return;
    const local = sculpture.worldToLocal(p);
    g.position.x = THREE.MathUtils.clamp(local.x, -form.spread / 2 - 0.1, form.spread / 2 + 0.1);
    g.position.z = THREE.MathUtils.clamp(local.z, form.z - 0.6, form.z + 0.6);
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
  el.addEventListener('wheel', e => { e.preventDefault(); view.td = THREE.MathUtils.clamp(view.td + e.deltaY * 0.004, 2.6, 13); }, { passive: false });
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
      if (zoom0) view.td = THREE.MathUtils.clamp(view.td - (d - zoom0) * 9, 2.6, 13);
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
    forms: Object.keys(FORMS),
    get form() { return formName; },
    // switch the plinth's form; statues keep their order and step onto the new top
    setForm(name) {
      buildForm(name); setTopPlane(); setMaterial(current);
      statueGroups.forEach((g, k) => { g.position.set((k - (statueGroups.length - 1) / 2) * Math.min(0.85, form.spread / statueGroups.length), form.topY, form.z); });
      target.y = form.height * 0.42; view.td = 6.4 + form.height * 0.95;
    },
    nextForm(step = 1) { const f = Object.keys(FORMS); this.setForm(f[(f.indexOf(formName) + step + f.length) % f.length]); },
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

// Sculpture room: two relief models (made in Blender, see blender/make_relief.py)
// loaded overlapping; a brush pushes or pulls vertices. Drag on a model sculpts,
// drag on empty space orbits. If a .glb cannot load, a relief is generated
// in the browser from the same transparent PNG instead.

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { boxBlurAlpha } from './util.js';

export async function createSculpt(container, { models, onStatus }) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x100f0d);
  scene.fog = new THREE.Fog(0x100f0d, 6, 14);
  const camera = new THREE.PerspectiveCamera(38, 1, 0.05, 50);
  camera.position.set(0.5, 0.45, 5.2);

  scene.add(new THREE.HemisphereLight(0xfff3e0, 0x1a1612, 1.1));
  const key = new THREE.DirectionalLight(0xfff0d8, 2.2); key.position.set(2.5, 3, 3); scene.add(key);
  const rim = new THREE.DirectionalLight(0x9fb4d8, 1.2); rim.position.set(-3, 1.5, -2.5); scene.add(rim);

  // plinth
  const plinth = new THREE.Mesh(new THREE.CylinderGeometry(1.7, 1.75, 0.1, 96),
    new THREE.MeshStandardMaterial({ color: 0x1d1a16, roughness: 0.9 }));
  plinth.position.y = -1.06; scene.add(plinth);

  // ---- models -----------------------------------------------------------
  const loader = new GLTFLoader();
  const meshes = [];
  const sculpture = new THREE.Group();          // turned as one piece by hand gestures
  scene.add(sculpture);
  const usedFallback = [];
  for (const m of models) {
    let mesh;
    try {
      const gltf = await loader.loadAsync(m.glb);
      gltf.scene.traverse(o => { if (o.isMesh && !mesh) mesh = o; });
      if (!mesh) throw new Error('no mesh in ' + m.glb);
    } catch (err) {
      console.warn('[sculpt] glb failed, using in-browser relief:', err.message);
      mesh = await reliefFromPng(m.png);
      usedFallback.push(m.glb);
    }
    mesh.geometry.computeVertexNormals();
    mesh.material.roughness = 0.85;
    mesh.position.set(...m.position);
    mesh.rotation.y = m.rotY;
    mesh.scale.setScalar(m.scale);
    mesh.userData.orig = mesh.geometry.attributes.position.array.slice();
    sculpture.add(mesh); meshes.push(mesh);
  }
  if (usedFallback.length) onStatus?.('fallback', usedFallback);

  // seat the plinth just under the models and aim the camera at their centre
  const box = new THREE.Box3();
  meshes.forEach(m => box.expandByObject(m));
  plinth.position.y = box.min.y - 0.06;
  const centre = box.getCenter(new THREE.Vector3());

  // ---- orbit vs sculpt -----------------------------------------------------
  const canvas = renderer.domElement;
  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  const opts = { mode: 'pull', radius: 0.18, strength: 0.5 };
  let sculpting = false, pending = null;

  const hitAt = (clientX, clientY) => {
    const r = canvas.getBoundingClientRect();
    ndc.set(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    return ray.intersectObjects(meshes, false)[0] || null;
  };

  // registered BEFORE OrbitControls so we can switch it off for this drag
  canvas.addEventListener('pointerdown', e => {
    const hit = hitAt(e.clientX, e.clientY);
    if (hit) {
      sculpting = true; controls.enabled = false;
      try { canvas.setPointerCapture(e.pointerId); } catch { /* synthetic or lost pointer */ }
      pending = { x: e.clientX, y: e.clientY };
    }
  });
  canvas.addEventListener('pointermove', e => { if (sculpting) pending = { x: e.clientX, y: e.clientY }; });
  const endStroke = () => { sculpting = false; controls.enabled = true; pending = null; };
  canvas.addEventListener('pointerup', endStroke);
  canvas.addEventListener('pointercancel', endStroke);

  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.target.set(0, centre.y - 0.15, 0);   // a little low so the models sit above the toolbar
  controls.minDistance = 1.6; controls.maxDistance = 8;
  controls.enablePan = false;

  // ---- brush -----------------------------------------------------------
  const tmpP = new THREE.Vector3(), tmpN = new THREE.Vector3(), inv = new THREE.Matrix4();
  function stroke(clientX, clientY) {
    const hit = hitAt(clientX, clientY);
    if (!hit) return false;
    const worldN = hit.face.normal.clone().transformDirection(hit.object.matrixWorld);
    const sign = opts.mode === 'pull' ? 1 : -1;
    for (const mesh of meshes) {
      inv.copy(mesh.matrixWorld).invert();
      tmpP.copy(hit.point).applyMatrix4(inv);                        // brush centre, local
      tmpN.copy(worldN).transformDirection(inv);                     // brush direction, local
      const s = mesh.scale.x, r = opts.radius / s, r2 = r * r;
      const amt = (opts.strength * 0.02 * sign) / s;
      const pos = mesh.geometry.attributes.position, a = pos.array;
      let touched = false;
      for (let i = 0; i < a.length; i += 3) {
        const dx = a[i] - tmpP.x, dy = a[i + 1] - tmpP.y, dz = a[i + 2] - tmpP.z;
        const d2 = dx * dx + dy * dy + dz * dz;
        if (d2 > r2) continue;
        const f = (1 - d2 / r2) ** 2;                               // smooth falloff
        a[i] += tmpN.x * amt * f; a[i + 1] += tmpN.y * amt * f; a[i + 2] += tmpN.z * amt * f;
        touched = true;
      }
      if (touched) {
        pos.needsUpdate = true;
        mesh.geometry.computeVertexNormals();                       // keep shading correct
        mesh.geometry.computeBoundingSphere();
        mesh.geometry.computeBoundingBox();
      }
    }
    return true;
  }

  // ---- loop / resize ------------------------------------------------------
  const resize = () => {
    const w = container.clientWidth, h = container.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h; camera.updateProjectionMatrix();
  };
  const ro = new ResizeObserver(resize); ro.observe(container); resize();
  let raf = 0, external = null;
  const tick = () => {
    if (pending) { stroke(pending.x, pending.y); }
    if (external) { stroke(external.x, external.y); }
    controls.update();
    renderer.render(scene, camera);
    raf = requestAnimationFrame(tick);
  };
  tick();

  return {
    usedFallback,
    setMode: m => { opts.mode = m; },
    setRadius: v => { opts.radius = v; },
    setStrength: v => { opts.strength = v; },
    // wireframe uses a plain line material so the mesh structure is legible
    setWireframe: on => meshes.forEach(m => {
      m.userData.solid ??= m.material;
      m.userData.wire ??= new THREE.MeshBasicMaterial({ color: 0xe3cf9f, wireframe: true, transparent: true, opacity: 0.45 });
      m.material = on ? m.userData.wire : m.userData.solid;
    }),
    reset() {
      for (const m of meshes) {
        m.geometry.attributes.position.array.set(m.userData.orig);
        m.geometry.attributes.position.needsUpdate = true;
        m.geometry.computeVertexNormals();
        m.geometry.computeBoundingSphere();
      }
    },
    // hand tracking feeds a screen point; pass null to stop sculpting
    externalBrush(pt) { external = pt; },
    // open-hand gestures: turn and zoom the sculpture
    rotateBy(dx, dy) {
      sculpture.rotation.y += dx * 3.2;
      sculpture.rotation.x = THREE.MathUtils.clamp(sculpture.rotation.x + dy * 2.0, -0.9, 0.9);
    },
    zoomBy(f) {
      const dir = camera.position.clone().sub(controls.target);
      const len = THREE.MathUtils.clamp(dir.length() / f, controls.minDistance, controls.maxDistance);
      camera.position.copy(controls.target).add(dir.setLength(len));
    },
    // the sculpted meshes as a .glb file (opens in Blender: File > Import > glTF 2.0)
    exportGLB() {
      return new Promise((res, rej) => new GLTFExporter().parse(sculpture,
        buf => res(new Blob([buf], { type: 'model/gltf-binary' })), rej, { binary: true }));
    },
    // total vertex displacement from the original models (used for testing)
    displacement() {
      let d = 0;
      for (const m of meshes) {
        const a = m.geometry.attributes.position.array, o = m.userData.orig;
        for (let i = 0; i < a.length; i++) d += Math.abs(a[i] - o[i]);
      }
      return d;
    },
    screenshot() { renderer.render(scene, camera); return canvas.toDataURL('image/png'); },
    dispose() {
      cancelAnimationFrame(raf); ro.disconnect(); controls.dispose();
      meshes.forEach(m => { m.geometry.dispose(); const sm = m.userData.solid || m.material; sm.map?.dispose(); sm.dispose(); m.userData.wire?.dispose(); });
      renderer.dispose(); canvas.remove();
    },
  };
}

// Fallback: a displaced plane built from the PNG's alpha (same idea as the
// Blender script, simplified). Transparent areas are cut with alphaTest.
async function reliefFromPng(url) {
  const img = await new THREE.ImageLoader().loadAsync(url);
  const long = 120;
  const aspect = img.width / img.height;
  const gw = aspect >= 1 ? long : Math.round(long * aspect);
  const gh = aspect >= 1 ? Math.round(long / aspect) : long;
  const cv = document.createElement('canvas'); cv.width = gw + 1; cv.height = gh + 1;
  const ctx = cv.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(img, 0, 0, gw + 1, gh + 1);
  const raw = ctx.getImageData(0, 0, gw + 1, gh + 1).data;
  const alpha = boxBlurAlpha(raw, gw + 1, gh + 1, 3);      // blurred alpha → rounded volume
  const w = aspect >= 1 ? 2 : 2 * aspect, h = aspect >= 1 ? 2 / aspect : 2;
  const geo = new THREE.PlaneGeometry(w, h, gw, gh);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = i % (gw + 1), y = Math.floor(i / (gw + 1));
    const a = alpha[(y * (gw + 1) + x) * 4 + 3] / 255;
    pos.setZ(i, Math.sqrt(Math.max(0, a - 0.35) / 0.65) * 0.22);
  }
  const tex = new THREE.Texture(img); tex.colorSpace = THREE.SRGBColorSpace; tex.needsUpdate = true;
  const mat = new THREE.MeshStandardMaterial({ map: tex, alphaTest: 0.5, side: THREE.DoubleSide });
  return new THREE.Mesh(geo, mat);
}


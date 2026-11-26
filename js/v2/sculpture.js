// The sculpture, version 2: one lump of earth that the painting grew out of.
//
// No plinth, no perfect shapes. The body is a single irregular mass (layered noise, a heavy
// settled base), with the painting's own depth pressed into its front like a relief. Out of
// it grow knobs, and on each knob something emerges from the same material: the visitor,
// re-made in the painting's manner, the painted animals (inflated from their cut-outs), and a
// few painted things (a tree, a house). Drag a knob (or the figure on it) anywhere over the
// body: the earth swells up under it and settles where it left. Turn it by dragging the
// empty space, zoom with the wheel. Materials: painted (the picture's own colours), clay,
// bronze, stone. Export as .glb for Blender.

import * as THREE from '../../vendor/three-0.170.0/build/three.module.js';
import { OrbitControls } from '../../vendor/three-0.170.0/examples/jsm/controls/OrbitControls.js';
import { mergeVertices } from '../../vendor/three-0.170.0/examples/jsm/utils/BufferGeometryUtils.js';
import { stylise, paletteColors } from './figure.js';
import { SplatCloud } from './splatsculpt.js';

export const MATERIALS = ['painted', 'clay', 'bronze', 'stone', 'splat'];
const loadImg = url => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });

// a small, smooth 3D value noise (deterministic per seed)
function makeNoise(seed) {
  const P = new Uint8Array(512); const r = mulberry(seed);
  const p = [...Array(256).keys()].sort(() => r() - 0.5); for (let i = 0; i < 512; i++) P[i] = p[i & 255];
  const h = (x, y, z) => P[(P[(P[x & 255] + y) & 255] + z) & 255] / 255;
  const f = t => t * t * (3 - 2 * t);
  return (x, y, z) => {
    const X = Math.floor(x), Y = Math.floor(y), Z = Math.floor(z), u = f(x - X), v = f(y - Y), w = f(z - Z);
    const l = (a, b, t) => a + (b - a) * t;
    return l(l(l(h(X, Y, Z), h(X + 1, Y, Z), u), l(h(X, Y + 1, Z), h(X + 1, Y + 1, Z), u), v),
             l(l(h(X, Y, Z + 1), h(X + 1, Y, Z + 1), u), l(h(X, Y + 1, Z + 1), h(X + 1, Y + 1, Z + 1), u), v), w) * 2 - 1;
  };
}
function mulberry(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

export class Sculpture {
  // opts: { work, painting (url), depth (url), palette, look, figures: [{ geo, kind, realH, visitor }] }
  constructor(container, opts) {
    this.c = container; this.o = opts; this.material = 'painted'; this.form = 'earth';
    this.renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping; this.renderer.toneMappingExposure = 1.05;
    container.appendChild(this.renderer.domElement);
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x15120f);
    this.camera = new THREE.PerspectiveCamera(38, 1, 0.05, 100);
    this.camera.position.set(0.8, 1.4, 5.4);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true; this.controls.target.set(0, 0.45, 0); this.controls.minDistance = 1.6; this.controls.maxDistance = 9;
    this.scene.add(new THREE.HemisphereLight(0xfff2e0, 0x2a2018, 1.1));
    const key = new THREE.DirectionalLight(0xffe7c8, 2.4); key.position.set(-3, 5, 4); this.scene.add(key);
    const rim = new THREE.DirectionalLight(0x9ab4ff, 0.9); rim.position.set(4, 2, -4); this.scene.add(rim);
    const floor = new THREE.Mesh(new THREE.CircleGeometry(6, 64), new THREE.MeshStandardMaterial({ color: 0x1d1915, roughness: 1 }));
    floor.rotation.x = -Math.PI / 2; floor.position.y = -0.62; this.scene.add(floor);
    this.seed = Math.floor(Math.random() * 1e6);
    this.knobs = [];
    this._resize = () => this.resize(); addEventListener('resize', this._resize);
  }

  async init() {
    const o = this.o;
    const [img, dimg] = await Promise.all([loadImg(o.painting), loadImg(o.depth).catch(() => null)]);
    this.A = img.width / img.height;
    this.paintPx = readPixels(img, 256, Math.round(256 / this.A));
    this.depthPx = dimg ? readPixels(dimg, 128, Math.round(128 / this.A)) : null;
    this.pal = paletteColors(o.palette);
    // the body
    let g = new THREE.IcosahedronGeometry(1, 56);
    g.deleteAttribute('normal'); g.deleteAttribute('uv');
    g = mergeVertices(g);
    this.dirs = g.attributes.position.array.slice();       // unit directions of every vertex
    g.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 3), 3));
    this.geo = g;
    this.body = new THREE.Mesh(g, this.bodyMaterial());
    this.scene.add(this.body);
    // knobs: one per figure, spread over the upper body; the visitor on the front
    const figs = o.figures.slice(0, 7);
    const rnd = mulberry(this.seed + 3);
    const maxH = Math.max(...figs.map(f => f.realH || 0.8));
    figs.forEach((f, i) => {
      const a = f.visitor ? 0 : (i % 2 ? 1 : -1) * (0.5 + 0.45 * Math.ceil(i / 2)) + (rnd() - 0.5) * 0.3;
      const el = f.visitor ? 0.55 : 0.25 + rnd() * 0.7;
      const dir = new THREE.Vector3(Math.sin(a) * Math.cos(el), Math.sin(el), Math.cos(a) * Math.cos(el)).normalize();
      const size = Math.max(0.36, Math.min(f.visitor ? 0.95 : 0.8, 0.85 * Math.sqrt((f.realH || 0.8) / maxH)));
      const fig = f.thing ? null : stylise(f.geo, o.look, o.palette);
      const obj = new THREE.Group();
      if (fig) { fig.scale.setScalar(size); obj.add(fig); }
      else { const t = stylise(f.geo, o.look, o.palette); t.scale.setScalar(size); obj.add(t); }
      this.scene.add(obj);
      this.knobs.push({ dir, amp: 0.32 + rnd() * 0.22 + (f.visitor ? 0.12 : 0), width: 0.2 + rnd() * 0.1, size, obj, fig: obj.children[0], f, spin: (rnd() - 0.5) * 1.2 });
    });
    this.shape();
    this.applyMaterial();
    this.bind();
    this.resize();
    this.clock = new THREE.Clock();
    const loop = () => { this.raf = requestAnimationFrame(loop); this.controls.update(); this.cloud?.update(Math.min(0.05, this.clock.getDelta()), this.renderer); this.renderer.render(this.scene, this.camera); };
    loop();
    return this;
  }

  // radius of the body in a direction (without knobs)
  bodyR(x, y, z) {
    const n = this.noise ||= makeNoise(this.seed);
    let r = 0.92 + n(x * 1.1, y * 1.1, z * 1.1) * 0.3 + n(x * 2.6 + 7, y * 2.6, z * 2.6) * 0.11 + n(x * 7, y * 7, z * 7 + 3) * 0.025 + Math.max(0, y) * 0.18;
    // the painting pressed into the front (as a relief): its depth swells the surface
    if (z > 0.15 && this.depthPx) {
      const u = 0.5 + x / (2 * 0.95), v = 0.5 - y / (2 * 0.95 / Math.max(0.6, Math.min(1.6, this.A)));
      if (u > 0 && u < 1 && v > 0 && v < 1) r += (sample(this.depthPx, u, v)[0] / 255 - 0.4) * 0.16 * Math.min(1, (z - 0.15) * 3);
    }
    return r;
  }
  shape() {
    const P = this.geo.attributes.position, C = this.geo.attributes.color, d = this.dirs;
    const stretch = Math.max(0.85, Math.min(1.25, Math.pow(this.A, 0.35)));
    const v = new THREE.Vector3();
    for (let i = 0; i < P.count; i++) {
      const x = d[i * 3], y = d[i * 3 + 1], z = d[i * 3 + 2];
      let r = this.bodyR(x, y, z);
      let knobW = 0;
      for (const k of this.knobs) {
        const dot = x * k.dir.x + y * k.dir.y + z * k.dir.z;
        const ang = Math.acos(Math.max(-1, Math.min(1, dot)));
        const w = Math.exp(-(ang * ang) / (k.width * k.width));
        r += k.amp * w; knobW = Math.max(knobW, w);
      }
      v.set(x * r * stretch, y * r * 1.0, z * r * 0.9);
      // a heavy, settled base: the earth slumps onto the ground
      if (v.y < -0.42) v.y = -0.42 + (v.y + 0.42) * 0.22, v.x *= 1.06, v.z *= 1.06;
      P.setXYZ(i, v.x, v.y + 0.1, v.z);
      // colour: the painting where it is pressed in, its palette (in drifts) elsewhere
      let c;
      if (z > 0.1) {
        const u = 0.5 + x / 1.9, vv = 0.5 - y / (1.9 / Math.max(0.6, Math.min(1.6, this.A)));
        c = u > 0 && u < 1 && vv > 0 && vv < 1 ? sample(this.paintPx, u, vv).map(t => t / 255) : null;
      }
      if (!c) {
        const k = Math.floor(((this.noise(x * 2, y * 2, z * 2) + 1) / 2) * 7.99);
        const p = this.pal[Math.max(0, Math.min(7, k))]; c = [p.r, p.g, p.b];
      }
      C.setXYZ(i, lin(c[0]), lin(c[1]), lin(c[2]));          // vertex colours are linear
    }
    P.needsUpdate = true; C.needsUpdate = true;
    this.geo.computeVertexNormals(); this.geo.computeBoundingSphere();
    this.placeFigures();
  }
  surfacePoint(dir) {
    // the outer surface along a direction (body + knobs), and the way it faces
    let r = this.bodyR(dir.x, dir.y, dir.z);
    for (const k of this.knobs) { const ang = dir.angleTo(k.dir); r += k.amp * Math.exp(-(ang * ang) / (k.width * k.width)); }
    const stretch = Math.max(0.85, Math.min(1.25, Math.pow(this.A, 0.35)));
    const p = new THREE.Vector3(dir.x * r * stretch, dir.y * r * 1.0, dir.z * r * 0.9);
    if (p.y < -0.42) p.y = -0.42 + (p.y + 0.42) * 0.22;
    p.y += 0.1;
    return p;
  }
  placeFigures() {
    for (const k of this.knobs) {
      const p = this.surfacePoint(k.dir);
      // emerges from the top of its knob, sunk into it a little; leans out with the surface
      const up = k.dir.clone().lerp(new THREE.Vector3(0, 1, 0), 0.82).normalize();
      k.obj.position.copy(p).addScaledVector(up, -k.size * 0.12);
      k.obj.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), up);
      const out = new THREE.Vector3(k.dir.x, 0, k.dir.z);
      const yaw = out.lengthSq() > 1e-4 ? Math.atan2(out.x, out.z) + Math.PI / 2 + k.spin : k.spin;
      k.obj.rotateY(yaw);
    }
  }

  // ---- materials: the whole thing is one material
  bodyMaterial() {
    return new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92, metalness: 0, flatShading: this.o.look === 'facet' });
  }
  setMaterial(m) { this.material = m; this.applyMaterial(); }
  // the Gaussian-splat sculpture: the same shape, re-made from soft coloured points
  showSplats(animate = true) {
    this.cloud ??= new SplatCloud(this.scene);
    this.body.visible = true; this.knobs.forEach(k => k.obj.visible = true);
    const m = this.body.material; m.vertexColors = true; m.color.set(0xffffff); m.needsUpdate = true;
    for (const k of this.knobs) k.obj.traverse(o => { if (o.userData.own) o.material = o.userData.own; });
    this.cloud.build([this.body, ...this.knobs.map(k => k.obj)], { A: this.A, px: this.paintPx });
    this.body.visible = false; this.knobs.forEach(k => k.obj.visible = false);
    this.cloud.show(true); if (!animate) this.cloud.settle();
    this.scene.background.set(0x07060a);
    this.controls.autoRotate = true; this.controls.autoRotateSpeed = 0.6;     // it turns slowly in its own light
  }
  applyMaterial() {
    if (this.material === 'splat') return this.showSplats();
    if (this.cloud) { this.cloud.show(false); this.body.visible = true; this.knobs.forEach(k => k.obj.visible = true); this.scene.background.set(0x15120f); this.controls.autoRotate = false; }
    const m = this.body.material, mat = this.material;
    m.vertexColors = mat === 'painted';
    if (mat === 'painted') { m.color.set(0xffffff); m.roughness = 0.88; m.metalness = 0; }
    if (mat === 'clay') { m.color.set(0xb0623d); m.roughness = 1; m.metalness = 0; }
    if (mat === 'bronze') { m.color.set(0x8a6236); m.roughness = 0.38; m.metalness = 0.92; }
    if (mat === 'stone') { m.color.set(0xd8d2c6); m.roughness = 0.75; m.metalness = 0; }
    m.needsUpdate = true;
    // figures: painted keeps each figure in the painting's manner; otherwise they are cast
    // in the same material as the earth they grow from
    for (const k of this.knobs) k.obj.traverse(o => {
      if (!o.isMesh && !o.isPoints) return;
      o.userData.own ??= o.material;
      if (mat === 'painted') { o.material = o.userData.own; return; }
      if (o.isPoints) { o.visible = false; return; }
      o.visible = true;
      if (o.material.side === THREE.BackSide || o.userData.own.side === THREE.BackSide) { o.visible = false; return; }
      o.userData.cast ??= new THREE.MeshStandardMaterial({ side: THREE.DoubleSide });
      o.userData.cast.color.copy(m.color); o.userData.cast.roughness = m.roughness; o.userData.cast.metalness = m.metalness;
      o.material = o.userData.cast;
    });
    for (const k of this.knobs) k.obj.traverse(o => { if (mat === 'painted') o.visible = true; });
  }
  nextForm() { this.reshape(); }
  setForm() { this.reshape(); }
  reshape() { this.seed = Math.floor(Math.random() * 1e6); this.noise = null; this.shape(); if (this.material === 'splat') this.showSplats(); }

  // ---- dragging knobs over the body
  bind() {
    const el = this.renderer.domElement, ray = new THREE.Raycaster();
    const ndc = e => { const r = el.getBoundingClientRect(); return new THREE.Vector2((e.clientX - r.left) / r.width * 2 - 1, -(e.clientY - r.top) / r.height * 2 + 1); };
    el.addEventListener('pointerdown', e => {
      ray.setFromCamera(ndc(e), this.camera);
      // a figure, or near a knob on the body
      const figHit = ray.intersectObjects(this.knobs.map(k => k.obj), true)[0];
      let knob = figHit ? this.knobs.find(k => isChild(figHit.object, k.obj)) : null;
      if (!knob) {
        const h = ray.intersectObject(this.body)[0];
        if (h) { const d = h.point.clone().setY(h.point.y - 0.1).normalize(); knob = this.knobs.reduce((b, k) => (!b || k.dir.angleTo(d) < b.dir.angleTo(d)) ? k : b, null); if (knob && knob.dir.angleTo(d) > knob.width * 1.1) knob = null; }
      }
      if (!knob) return;
      this.drag = knob; this.controls.enabled = false; el.setPointerCapture(e.pointerId);
    });
    el.addEventListener('pointermove', e => {
      if (!this.drag) return;
      ray.setFromCamera(ndc(e), this.camera);
      const h = ray.intersectObject(this.body)[0];
      if (!h) return;
      const d = h.point.clone().setY(h.point.y - 0.1).normalize();
      if (d.y < -0.25) d.y = -0.25;                 // not under the base
      this.drag.dir.lerp(d.normalize(), 0.5).normalize();
      this.shape();
    });
    const up = () => { if (this.drag) { this.drag = null; this.controls.enabled = true; if (this.material === 'splat') this.showSplats(false); } };
    el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
  }
  handInput(hs) {
    const h = hs[0]; if (!h) { this.handPrev = null; return; }
    if (h.pinch) {
      if (this.handPrev) { const dx = h.pinchX - this.handPrev.x; this.scene.rotation.y += dx * 4; }
      this.handPrev = { x: h.pinchX };
    } else this.handPrev = null;
  }

  resize() {
    const r = this.c.getBoundingClientRect();
    this.renderer.setSize(r.width || innerWidth, r.height || innerHeight, false);
    this.renderer.domElement.style.width = '100%'; this.renderer.domElement.style.height = '100%';
    this.camera.aspect = (r.width || innerWidth) / (r.height || innerHeight); this.camera.updateProjectionMatrix();
  }
  screenshot() { this.renderer.render(this.scene, this.camera); return this.renderer.domElement.toDataURL('image/jpeg', 0.92); }
  async exportGLB() {
    const { GLTFExporter } = await import('../../vendor/three-0.170.0/examples/jsm/exporters/GLTFExporter.js');
    // shader-painted figures go out with their vertex colours as plain materials
    const swaps = [];
    this.scene.traverse(o => {
      if ((o.isMesh || o.isPoints) && o.material?.isShaderMaterial) {
        swaps.push([o, o.material, o.visible]);
        if (o.isPoints || o.material.side === THREE.BackSide) o.visible = false;
        else o.material = new THREE.MeshStandardMaterial({ vertexColors: !!o.geometry.attributes.color, roughness: 0.85 });
      }
    });
    const group = new THREE.Group(); group.add(this.body.clone()); this.knobs.forEach(k => group.add(k.obj.clone()));
    const glb = await new GLTFExporter().parseAsync(group, { binary: true, onlyVisible: true });
    for (const [o, m, v] of swaps) { o.material = m; o.visible = v; }
    return new Blob([glb], { type: 'model/gltf-binary' });
  }
  dispose() {
    cancelAnimationFrame(this.raf); removeEventListener('resize', this._resize);
    this.controls.dispose(); this.renderer.dispose(); this.renderer.domElement.remove();
  }
}

const lin = c => c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
function isChild(o, root) { for (let p = o; p; p = p.parent) if (p === root) return true; return false; }
function readPixels(img, w, h) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(img, 0, 0, w, h);
  return { w, h, d: g.getImageData(0, 0, w, h).data };
}
function sample(px, u, v) {
  const x = Math.max(0, Math.min(px.w - 1, Math.floor(u * px.w))), y = Math.max(0, Math.min(px.h - 1, Math.floor(v * px.h)));
  const i = (y * px.w + x) * 4; return [px.d[i], px.d[i + 1], px.d[i + 2]];
}

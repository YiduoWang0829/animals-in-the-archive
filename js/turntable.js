// Character studio turntable: the chosen 3D animal on a lit plinth, moving in
// place (walk, run, stand, graze). Drag to turn it; it also turns slowly by itself.

import * as THREE from '../vendor/three-0.170.0/build/three.module.js';
import { loadAnimal3D } from './animal3d.js';

export class Turntable {
  constructor(container) {
    this.container = container;
    const r = this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    r.setPixelRatio(Math.min(devicePixelRatio, 2));
    r.outputColorSpace = THREE.SRGBColorSpace;
    r.toneMapping = THREE.ACESFilmicToneMapping;
    Object.assign(r.domElement.style, { width: '100%', height: '100%', display: 'block', touchAction: 'none', cursor: 'grab' });
    container.appendChild(r.domElement);
    const scene = this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(30, 1, 0.05, 30);
    this.camera.position.set(0, 1.0, 3.3); this.camera.lookAt(0, 0.42, 0);
    scene.add(new THREE.HemisphereLight(0xfff3e2, 0x1a1612, 1.0));
    const key = new THREE.SpotLight(0xffe9cc, 40, 10, 0.6, 0.7, 1.5); key.position.set(1.4, 3.2, 2.2); scene.add(key);
    const rim = new THREE.DirectionalLight(0xa9bddc, 1.1); rim.position.set(-2.5, 1.5, -2); scene.add(rim);
    const plinth = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 1.0, 0.08, 96),
      new THREE.MeshStandardMaterial({ color: 0x1e1b17, roughness: 0.55, metalness: 0.2 }));
    plinth.position.y = -0.04; scene.add(plinth);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.975, 0.006, 8, 120), new THREE.MeshStandardMaterial({ color: 0x9a7740, metalness: 0.8, roughness: 0.35 }));
    ring.rotation.x = Math.PI / 2; scene.add(ring);
    this.spin = 0.6; this.vel = 0.25; this.anim = 'walk';
    this.clock = new THREE.Clock();
    let drag = null;
    r.domElement.addEventListener('pointerdown', e => { drag = e.clientX; try { r.domElement.setPointerCapture(e.pointerId); } catch {} });
    r.domElement.addEventListener('pointermove', e => { if (drag !== null) { this.vel = (e.clientX - drag) * 0.6; this.spin += (e.clientX - drag) * 0.01; drag = e.clientX; } });
    r.domElement.addEventListener('pointerup', () => { drag = null; });
    this.ro = new ResizeObserver(() => this.resize()); this.ro.observe(container); this.resize();
    r.setAnimationLoop(() => this.tick());
  }

  resize() {
    const w = this.container.clientWidth, h = this.container.clientHeight;
    if (!w || !h) return;
    this.renderer.setSize(w, h, false); this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
  }

  async show(animal, look = 'real') {
    const token = (this.token = {});
    const a = await loadAnimal3D(animal.glb, { height: 1, look });
    if (token !== this.token) { a.dispose(); return; }      // a newer choice arrived meanwhile
    this.actor?.dispose();
    this.actor = a; a.addTo(this.scene);
    // fit: big animals are scaled to the plinth by length, small ones by height
    const fit = Math.min(0.9, 1.5 / Math.max(0.8, a.length));
    a.setHeight(fit);
    this.setAnim(this.anim);
  }

  setAnim(name) {
    this.anim = name;
    const a = this.actor; if (!a) return;
    a.target = null;
    a.play(name === 'walk' ? 'walk' : name === 'run' ? 'run' : name === 'eat' ? 'eat' : 'idle', 0.3);
    a.idleT = 1e9;                                   // no random idles while on show
  }

  tick() {
    const dt = Math.min(0.05, this.clock.getDelta());
    this.spin += dt * this.vel; this.vel += (0.25 - this.vel) * dt * 1.5;
    const a = this.actor;
    if (a) {
      a.mixer.update(dt);
      a.inner.rotation.y = this.spin;
      if (a.current) a.current.timeScale = this.anim === 'run' ? 1.1 : 1;
      a.shadow.position.set(0, 0.004, 0);
    }
    this.renderer.render(this.scene, this.camera);
  }

  dispose() {
    this.renderer.setAnimationLoop(null); this.ro.disconnect();
    this.actor?.dispose(); this.renderer.dispose(); this.renderer.domElement.remove();
  }
}

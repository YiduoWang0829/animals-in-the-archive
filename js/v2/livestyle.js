// The real, rigged 3D animal re-painted in a painting's manner, while it keeps moving.
//
// The model keeps its skeleton and its own walk / idle clips; only its surface changes.
// Every look works on the moving body:
//   oil, gilded, ink, woodblock, flat  the skin's own colours translated into the painting's
//                                      palette and light (fragment shader on the skinned mesh)
//   facet                              cubist / expressionist planes: flat-shaded, each patch of
//                                      the body takes one palette colour (patches ride with the bones)
//   splat, dots                        the body made of Gaussian brush splats / pure dots that are
//                                      skinned too, so the strokes walk with the animal
// Ink lines (outline) are skinned back faces, as in the storybook look.

import * as THREE from '../../vendor/three-0.170.0/build/three.module.js';

// palette: [{c:'#rrggbb'}] → 8 linear colours, dark → light
function palette(p) {
  const cs = (p?.length ? p : [{ c: '#2a2118' }, { c: '#6b4f33' }, { c: '#a8865a' }, { c: '#d9c49a' }]).map(x => new THREE.Color(x.c || x));
  while (cs.length < 8) cs.push(cs[cs.length - 1].clone());
  return cs.slice(0, 8);
}

const COMMON = /* glsl */`
  uniform vec3 uPal[8]; uniform float uLook; uniform vec2 uDeform; uniform vec3 uHue;
  varying vec3 vObjP;
  float sHash(vec3 p) { p = fract(p * 0.1031); p += dot(p, p.zyx + 31.32); return fract((p.x + p.y) * p.z); }
  float sNoise(vec3 p) {
    vec3 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(mix(sHash(i), sHash(i + vec3(1,0,0)), f.x), mix(sHash(i + vec3(0,1,0)), sHash(i + vec3(1,1,0)), f.x), f.y),
               mix(mix(sHash(i + vec3(0,0,1)), sHash(i + vec3(1,0,1)), f.x), mix(sHash(i + vec3(0,1,1)), sHash(i + vec3(1,1,1)), f.x), f.y), f.z);
  }
  float sLum(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
  vec3 palRamp(float l) {
    float x = clamp(l, 0.0, 0.999) * 7.0; int i = int(floor(x)); float f = fract(x);
    vec3 a = uPal[0], b = uPal[1];
    for (int k = 0; k < 7; k++) if (k == i) { a = uPal[k]; b = uPal[k + 1]; }
    return mix(a, b, smoothstep(0.2, 0.8, f));
  }
  vec3 palNearest(vec3 c) {               // the palette colour closest in colour (hue and value)
    vec3 best = uPal[0]; float bd = 1e9;
    for (int k = 0; k < 8; k++) {
      vec3 d = c - uPal[k]; float dd = dot(d * d, vec3(0.3, 0.59, 0.11)) + abs(sLum(c) - sLum(uPal[k])) * 0.15;
      if (dd < bd) { bd = dd; best = uPal[k]; }
    }
    return best;
  }
  vec3 palAt(float h) {                   // a palette colour picked by a hash (0..1)
    int i = int(floor(h * 7.99)); vec3 c = uPal[0];
    for (int k = 0; k < 8; k++) if (k == i) c = uPal[k];
    return c;
  }
`;

// look → number used in the shader
const LOOK_ID = { oil: 1, gilded: 2, ink: 3, woodblock: 4, flat: 5, facet: 6, splat: 7, dots: 8 };

const STYLE_FRAG = /* glsl */`
  {
    vec3 alb = diffuseColor.rgb;
    vec3 N = normalize(vNormal);
    if (uLook > 5.5 && uLook < 6.5) N = normalize(cross(dFdx(vViewPosition), dFdy(vViewPosition)));   // facets
    vec3 L = normalize(vec3(-0.45, 0.75, 0.5));            // the painting's light: high, from the left
    float diff = max(dot(N, L), 0.0);
    vec3 V = normalize(vViewPosition);
    float rim = 1.0 - abs(dot(N, -V));
    float l = sLum(alb);
    vec3 c;
    if (uLook < 1.5) {                                      // oil: glaze, brushwork, chiaroscuro
      float stroke = sNoise(vec3(vObjP.x * 30.0, vObjP.y * 9.0, vObjP.z * 80.0)) * 0.6 + sNoise(vObjP * 220.0) * 0.4;
      float k = diff + (stroke - 0.5) * 0.35;
      c = mix(alb, palNearest(alb), 0.45) * mix(vec3(0.35, 0.33, 0.4), vec3(1.25, 1.12, 0.92), smoothstep(-0.1, 1.0, k));
      c = mix(uPal[0] * 0.4, c, 0.3 + 0.7 * smoothstep(-0.1, 0.8, k));
      c += vec3(1.0, 0.85, 0.6) * smoothstep(0.75, 1.0, rim) * 0.08;
    } else if (uLook < 2.5) {                               // gilded: tempera colour, gold edge, craquelure
      c = mix(alb, palNearest(alb), 0.75) * (0.7 + 0.45 * diff);
      c = mix(c, vec3(0.75, 0.5, 0.14), smoothstep(0.5, 0.9, rim) * 0.85);
      c *= 0.92 + 0.12 * sNoise(vObjP * 160.0);
    } else if (uLook < 3.5) {                               // ink: paper body, grey wash, dark fur takes ink
      float wash = smoothstep(0.1, 0.8, diff + (sNoise(vObjP * 14.0) - 0.5) * 0.4);
      vec3 paper = uPal[7] * 0.95 + 0.03, ink = mix(uPal[0], vec3(0.01), 0.7);
      c = mix(ink, paper, clamp(wash * 0.8 + 0.3 - (1.0 - smoothstep(0.0, 0.5, l)) * 0.55, 0.0, 1.0));
    } else if (uLook < 4.5) {                               // woodblock: flat palette areas, two printed tones, wood grain
      c = palNearest(alb) * (diff > 0.35 ? 1.0 : 0.72);
      c *= 0.94 + 0.08 * sNoise(vec3(vObjP.x * 6.0, vObjP.y * 120.0, vObjP.z * 6.0));
    } else if (uLook < 5.5) {                               // flat folk colour: brighter, two tones
      c = palNearest(alb * 1.15) * (diff > 0.4 ? 1.08 : 0.78);
    } else if (uLook < 6.5) {                               // facets: Marc / expressionist planes
      // the whole animal in one pure colour of the painting (as Marc's blue horses, red deer),
      // modelled in two or three flat values; planes facing a different way take a neighbouring
      // colour of the palette, like light breaking through crystal
      vec3 plane = floor(N * 2.2 + 0.5);
      float h = sHash(plane + 3.7);
      vec3 hue = uHue;
      vec3 other = palAt(sHash(plane * 1.9 + 1.3));
      float band = floor(diff * 2.99) / 2.0;
      c = mix(hue, other, h < 0.28 ? 0.7 : 0.0) * (0.42 + 0.78 * band);
      c += vec3(1.0, 0.95, 0.8) * smoothstep(0.82, 1.0, diff) * 0.18;
      c = mix(c, uPal[0] * 0.5, smoothstep(0.55, 0.95, rim) * 0.6);
    } else {                                                // under the splats / dots: the palette's dark mass
      c = palRamp(l * 0.7) * (0.35 + 0.35 * diff);
    }
    outgoingLight = c;
  }
`;

function styleMaterial(src, look, uniforms) {
  const m = new THREE.MeshStandardMaterial({ map: src.map || null, color: src.color?.clone() || new THREE.Color(1, 1, 1), roughness: 0.9, metalness: 0,
    transparent: false, side: src.side ?? THREE.FrontSide, flatShading: false });
  m.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, uniforms);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\n' + COMMON)
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvObjP = position;')
      // facet (cubist / expressionist): the body itself breaks into planes. Every vertex is pulled
      // towards the corners of a slanted lattice (the size of a few hand-widths of the animal), so
      // its rounded flesh becomes crystal facets and angular shards; a slight shear along the
      // diagonal gives the forward-leaning, stretched forms of Marc's and the Futurists' animals.
      .replace('#include <project_vertex>', `
        if (uDeform.y > 0.0) {
          mat3 Rl = mat3(0.80, 0.36, -0.48, -0.20, 0.91, 0.36, 0.56, -0.20, 0.80);
          vec3 q = Rl * transformed / uDeform.x;
          vec3 sn = (floor(q) + 0.5 + (vec3(sHash(floor(q)), sHash(floor(q) + 3.1), sHash(floor(q) + 7.7)) - 0.5) * 0.5) * uDeform.x;
          vec3 snapped = transpose(Rl) * sn;
          transformed = mix(transformed, snapped, uDeform.y);
          transformed.y += transformed.z * 0.18 * uDeform.y;      // the forward lean
        }
        #include <project_vertex>`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\n' + COMMON)
      .replace('#include <opaque_fragment>', STYLE_FRAG + '\n#include <opaque_fragment>');
  };
  m.customProgramCacheKey = () => 'livestyle3';
  return m;
}

// skinned splats: a SkinnedMesh drawn as points (so its strokes follow the bones)
function skinnedSplats(mesh, uniforms, { dots, count }) {
  const g = mesh.geometry, P = g.attributes.position, N = g.attributes.normal, UV = g.attributes.uv;
  const SI = g.attributes.skinIndex, SW = g.attributes.skinWeight;
  const n = Math.min(count, P.count);
  // vertices spread over the body (a random subset, each pushed a hair outwards)
  const pick = new Uint32Array(n);
  for (let i = 0; i < n; i++) pick[i] = Math.floor(Math.random() * P.count);
  const geo = new THREE.BufferGeometry();
  const take = (A, size) => { const out = new Float32Array(n * size); for (let i = 0; i < n; i++) for (let k = 0; k < size; k++) out[i * size + k] = A.array[pick[i] * size + k]; return out; };
  geo.setAttribute('position', new THREE.BufferAttribute(take(P, 3), 3));
  if (N) geo.setAttribute('normal', new THREE.BufferAttribute(take(N, 3), 3));
  if (UV) geo.setAttribute('uv', new THREE.BufferAttribute(take(UV, 2), 2));
  geo.setAttribute('skinIndex', new THREE.BufferAttribute(Float32Array.from(take(SI, 4)), 4));
  geo.setAttribute('skinWeight', new THREE.BufferAttribute(take(SW, 4), 4));
  const rnd = new Float32Array(n); for (let i = 0; i < n; i++) rnd[i] = Math.random();
  geo.setAttribute('aRnd', new THREE.BufferAttribute(rnd, 1));
  const srcMat = [].concat(mesh.material)[0];
  const mat = new THREE.ShaderMaterial({
    uniforms: { ...uniforms, uMap: { value: srcMat.map || null }, uHasMap: { value: srcMat.map ? 1 : 0 }, uBase: { value: srcMat.color?.clone() || new THREE.Color(1, 1, 1) },
      uSize: { value: dots ? 0.012 : 0.02 }, uPx: { value: 800 }, uDots: { value: dots ? 1 : 0 } },
    vertexShader: /* glsl */`
      #include <common>
      #include <skinning_pars_vertex>
      ${COMMON}
      attribute float aRnd;
      uniform sampler2D uMap; uniform float uHasMap, uSize, uPx, uDots; uniform vec3 uBase;
      varying vec3 vC; varying float vAng;
      void main() {
        vObjP = position;
        #include <beginnormal_vertex>
        #include <skinbase_vertex>
        #include <skinnormal_vertex>
        vec3 transformed = position + normal * 0.004;
        #include <skinning_vertex>
        vec4 mv = modelViewMatrix * vec4(transformed, 1.0);
        gl_Position = projectionMatrix * mv;
        vec3 n = normalize(normalMatrix * objectNormal);
        float diff = max(dot(n, normalize(vec3(-0.45, 0.75, 0.5))), 0.0);
        vec3 alb = uBase;
        if (uHasMap > 0.5) alb *= texture2D(uMap, uv).rgb;
        vec3 c = mix(alb, palNearest(alb), uDots > 0.5 ? 0.85 : 0.55) * (0.5 + 0.75 * diff);
        if (uDots > 0.5) c = mix(c, palRamp(sLum(c) + (aRnd - 0.5) * 0.4), 0.45);   // Seurat: neighbouring pure dots
        else c += (aRnd - 0.5) * 0.05;
        vC = c;
        vAng = aRnd * 6.2831;
        float s = uSize * (0.7 + aRnd * 0.6);
        gl_PointSize = max(1.5, s * projectionMatrix[1][1] * uPx * 0.5 / -mv.z);
      }`,
    fragmentShader: /* glsl */`
      uniform float uDots; varying vec3 vC; varying float vAng;
      void main() {
        vec2 p = gl_PointCoord * 2.0 - 1.0;
        float c = cos(vAng), s = sin(vAng);
        vec2 q = vec2(c * p.x + s * p.y, -s * p.x + c * p.y);
        if (uDots < 0.5) q.y *= 2.4;
        float r2 = dot(q, q);
        if (r2 > 1.0) discard;
        if (uDots < 0.5 && exp(-r2 * 2.2) < 0.25) discard;
        gl_FragColor = vec4(vC, 1.0);
        #include <colorspace_fragment>
      }`,
  });
  // a skinned mesh, drawn as points: the renderer still binds its skeleton
  const sp = new THREE.SkinnedMesh(geo, mat);
  sp.isMesh = false; sp.isPoints = true;
  sp.bind(mesh.skeleton, mesh.bindMatrix);
  sp.frustumCulled = false;
  return sp;
}

export function styleActor(actor, look, pal, { renderer } = {}) {
  // the deformation's lattice: about a fifth of the animal's size (from its own meshes)
  let rad = 0; actor.root.traverse(o => { if (o.isMesh && o.geometry) { o.geometry.computeBoundingSphere(); rad = Math.max(rad, o.geometry.boundingSphere.radius); } });
  // the painting's purest strong colour (not too dark, most saturated): the facet look's body colour
  const P_ = palette(pal); let hue = P_[3].clone(), bs = -1;
  for (const c of P_) { const hsl = {}; c.getHSL(hsl); const sc = hsl.s * Math.min(1, hsl.l * 3) * (hsl.l > 0.12 && hsl.l < 0.75 ? 1 : 0.2); if (sc > bs) { bs = sc; hue = c.clone(); } }
  { const hsl = {}; hue.getHSL(hsl); hue.setHSL(hsl.h, Math.min(1, hsl.s * 1.35 + 0.1), Math.min(0.55, Math.max(0.3, hsl.l))); }
  const uniforms = { uHue: { value: hue }, uPal: { value: P_ }, uLook: { value: LOOK_ID[look] || 1 }, uDeform: { value: new THREE.Vector2(Math.max(1e-4, rad * 0.22), look === 'facet' ? 0.62 : 0) } };
  const splats = [];
  actor.root.traverse(o => {
    if (!o.isMesh || o.userData.livestyleLine || o.isPoints) return;
    if (o.material?.side === THREE.BackSide) return;           // the storybook outline
    o.userData.ownMaterial ??= o.material;
    o.material = Array.isArray(o.material) ? o.material.map(m => styleMaterial(m, look, uniforms)) : styleMaterial(o.material, look, uniforms);
    o.material.extensions = { derivatives: true };
    if ((look === 'splat' || look === 'dots') && o.isSkinnedMesh) splats.push(o);
  });
  for (const o of splats) {
    const sp = skinnedSplats(o, uniforms, { dots: look === 'dots', count: look === 'dots' ? 22000 : 16000 });
    o.parent.add(sp);
    (actor.splatMeshes ||= []).push(sp);
  }
  // ink lines: the actor's own skinned outlines, in the painting's ink
  const lineLooks = { ink: ['#141210', 0.0045], woodblock: ['#0d0b0a', 0.004], flat: [null, 0.0035], facet: ['#120c10', 0.0045], gilded: ['#3b2410', 0.0025] };
  for (const line of actor.outlines || []) {
    const L = lineLooks[look];
    line.visible = !!L;
    if (L) { line.material.color.set(L[0] || uniforms.uPal.value[0].clone().multiplyScalar(0.5)); }
  }
  if (actor.uniforms?.uOutline && lineLooks[look]) actor.uniforms.uOutline.value = lineLooks[look][1];
  actor.styled = look;
  actor.updateStyle = r => { for (const s of actor.splatMeshes || []) s.material.uniforms.uPx.value = r.domElement.height; };
  return actor;
}

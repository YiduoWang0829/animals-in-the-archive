// The visitor animal, painted in the painting's own manner (prototype; meant for the whole site).
//
// The scene is drawn as usual; the animal alone is drawn again into its own layer. On the way to
// the screen that layer is repainted: brush strokes that flatten detail into patches of colour
// (an anisotropic Kuwahara filter: the classic "oil paint" filter), colours pulled onto the
// painting's palette, then the manner of the painting:
//   oil       – soft patches, varnish warmth, canvas grain
//   splat     – loose dabs of paint (impressionist / loose romantic)
//   dots      – points of pure colour (pointillist)
//   flat      – flat areas of the palette's colours with a dark outline (folk, naive)
//   ink       – ink wash in the paper's dark, with a brushed outline
// Occlusion is kept: where a painted figure stands in front of the animal, the figure shows.

import * as THREE from '../../vendor/three-0.170.0/build/three.module.js';

const MODE = { oil: 0, gilded: 0, splat: 1, dots: 2, flat: 3, woodblock: 3, facet: 5, ink: 4 };

export function paintFX(renderer, look, palette) {
  const mk = () => {
    const rt = new THREE.WebGLRenderTarget(1, 1, { samples: 4, type: THREE.HalfFloatType });
    return rt;
  };
  const animalRT = mk();
  const probeRT = new THREE.WebGLRenderTarget(192, 120);              // small, readable: the animal's own colours
  function animalOnly(scene, camera, animalRoot, target) {
    const bg = scene.background; scene.background = null;
    const changed = [];
    scene.traverse(o => {
      if (!(o.isMesh || o.isPoints || o.isLine) || !o.visible) return;
      let a = o; while (a && a !== animalRoot) a = a.parent;
      if (a === animalRoot) return;
      const m = o.material;
      if (m.depthWrite && !m.isShadowMaterial && o.renderOrder > -1 && !(m.transparent && !m.alphaTest)) { changed.push([o, 'colorWrite', m.colorWrite]); m.colorWrite = false; }
      else { changed.push([o, 'visible', true]); o.visible = false; }
    });
    renderer.setRenderTarget(target); renderer.setClearColor(0x000000, 0); renderer.clear();
    const sm = renderer.shadowMap.autoUpdate; renderer.shadowMap.autoUpdate = false;
    renderer.render(scene, camera);
    renderer.shadowMap.autoUpdate = sm;
    for (const [o, k, v] of changed) { if (k === 'visible') o.visible = v; else o.material.colorWrite = v; }
    scene.background = bg;
  }
  const pal = (palette || []).slice(0, 8).map(p => new THREE.Color(p.c).convertSRGBToLinear());
  while (pal.length < 8) pal.push(pal[pal.length - 1] || new THREE.Color(0.5, 0.5, 0.5));
  // the painting's purest strong colour (for the expressionist look: the whole animal in it)
  let hue = pal[3].clone(), hs = -1;
  for (const c of pal) { const h = {}; c.clone().convertLinearToSRGB().getHSL(h); const sc = h.s * (h.l > 0.15 && h.l < 0.7 ? 1 : 0.2); if (sc > hs) { hs = sc; hue = c.clone(); } }
  { const h = {}; const sr = hue.clone().convertLinearToSRGB(); sr.getHSL(h); sr.setHSL(h.h, Math.min(1, h.s * 1.4 + 0.12), Math.min(0.5, Math.max(0.34, h.l))); hue = sr.convertSRGBToLinear(); }
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      animalTex: { value: animalRT.texture },
      px: { value: new THREE.Vector2(1, 1) }, mode: { value: MODE[look] ?? 0 }, pal: { value: pal },
      brush: { value: 4 }, time: { value: 0 },
      // the painting's light where the animal stands, and the animal's own (set by calibrate()):
      // the animal's colours are moved onto the painting's (mean and spread, per channel)
      muA: { value: new THREE.Vector3(0.5, 0.5, 0.5) }, sdA: { value: new THREE.Vector3(0.2, 0.2, 0.2) },
      muS: { value: new THREE.Vector3(0.5, 0.5, 0.5) }, sdS: { value: new THREE.Vector3(0.2, 0.2, 0.2) }, toneK: { value: 0 },
      // the brushwork of an animal the painter painted in this picture (its cut-out), laid over
      // yours: its strokes, hatching and cracks, stretched over your animal's outline on screen
      refTex: { value: null }, hasRef: { value: 0 }, refPx: { value: new THREE.Vector2(1, 1) }, detailK: { value: 1 },
      aBox: { value: new THREE.Vector4(0, 0, 1, 1) }, seed: { value: 0 }, hue: { value: hue }, refScale: { value: new THREE.Vector2(0.2, 0.2) },
    },
    vertexShader: `varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`,
    fragmentShader: `
      uniform sampler2D animalTex;
      uniform vec2 px; uniform int mode; uniform vec3 pal[8]; uniform float brush, time; uniform vec3 muA, sdA, muS, sdS; uniform float toneK;
      uniform vec3 hue; uniform sampler2D refTex; uniform float hasRef, detailK, seed; uniform vec2 refPx, refScale; uniform vec4 aBox;
      varying vec2 vUv;
      float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float noise(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y); }
      float lum(vec3 c) { return dot(c, vec3(0.299, 0.587, 0.114)); }
      // the animal's own colour, only where the animal is (and not hidden behind a painted figure)
      // (the animal pass is drawn with the painted figures and the room as invisible occluders,
      // so its alpha is exactly the part of the animal you can see)
      vec3 tone(vec3 c) { return mix(c, max(vec3(0.0), (c - muA) / max(sdA, vec3(0.02)) * sdS + muS), toneK); }
      vec4 A(vec2 uv) { vec4 c = texture2D(animalTex, uv); vec3 rgb = c.a > 0.0 ? c.rgb / c.a : c.rgb; return vec4(tone(rgb), c.a); }
      // painterly smoothing: eight wedge-shaped neighbourhoods around the pixel; each gives its mean
      // colour, weighted by how calm it is (generalized Kuwahara). Strokes follow the edges.
      vec3 kuwahara(vec2 uv, float r) {
        vec3 acc = vec3(0); float wsum = 0.0;
        for (int k = 0; k < 8; k++) {
          vec3 m = vec3(0), s2 = vec3(0); float n = 0.0;
          for (int a = 0; a < 3; a++) for (int q = 1; q <= 4; q++) {
            float t = (float(k) + (float(a) + 0.5) / 3.0) * 0.785398;
            vec2 o = vec2(cos(t), sin(t)) * r * float(q) / 4.0;
            vec4 c = A(uv + o * px);
            if (c.a < 0.5) continue;
            m += c.rgb; s2 += c.rgb * c.rgb; n += 1.0;
          }
          vec4 c0 = A(uv); if (c0.a > 0.5) { m += c0.rgb; s2 += c0.rgb * c0.rgb; n += 1.0; }
          if (n < 1.0) continue;
          m /= n; vec3 v = abs(s2 / n - m * m);
          float w = 1.0 / (1.0 + pow(1200.0 * (v.r + v.g + v.b), 2.0));
          acc += m * w; wsum += w;
        }
        return wsum > 0.0 ? acc / wsum : A(uv).rgb;
      }
      // the painting's colours: the nearest one of its palette (in brightness and hue)
      vec3 nearestPal(vec3 c) {
        vec3 b = pal[0]; float bd = 1e9;
        for (int k = 0; k < 8; k++) { vec3 d = c - pal[k]; float e = dot(d, d) + 2.0 * abs(lum(c) - lum(pal[k])); if (e < bd) { bd = e; b = pal[k]; } }
        return b;
      }
      // keep the animal's light and shade, but in the painting's colours
      vec3 inPalette(vec3 c, float k) {
        vec3 p = nearestPal(c);
        vec3 tinted = p * (lum(c) / max(0.02, lum(p)));
        return mix(c, mix(tinted, p, 0.35), k);
      }
      float stroke(vec2 uv) {
        float gx = lum(A(uv + vec2(brush, 0.0) * px).rgb) - lum(A(uv - vec2(brush, 0.0) * px).rgb);
        float gy = lum(A(uv + vec2(0.0, brush) * px).rgb) - lum(A(uv - vec2(0.0, brush) * px).rgb);
        vec2 t = normalize(vec2(-gy, gx) + vec2(1e-4, 0.0));        // along the edges of light and shade
        vec2 p = uv / px / brush;
        vec2 q = vec2(dot(p, t), dot(p, vec2(-t.y, t.x)));
        return noise(q * vec2(0.18, 1.3)) * 0.65 + noise(q * vec2(0.4, 2.6)) * 0.35;
      }
      // the painter's own brushwork (high-pass of the painted animal), where your animal is
      vec2 local(vec2 uv) { vec2 d = aBox.zw - aBox.xy; d = sign(d) * max(abs(d), vec2(1e-4)); return (uv - aBox.xy) / d; }   // (mirrored when it faces left)
      vec4 refAt(vec2 l) {
        vec4 r = texture2D(refTex, l);
        if (r.a < 0.5) { vec2 m = mix(l, vec2(0.5), 0.35); r = texture2D(refTex, m); if (r.a < 0.5) r = texture2D(refTex, mix(l, vec2(0.5), 0.65)); }
        return r;
      }
      float detail(vec2 uv) {
        if (hasRef < 0.5) return 0.0;
        // at the painter's own scale: the painted animal's strokes are as big on the screen as on it
        vec2 l = clamp(local(uv), 0.0, 1.0);                         // laid over your animal's outline, once
        float c = lum(refAt(l).rgb);
        float b = 0.0;
        for (int k = 0; k < 6; k++) { float t = float(k) * 1.047; b += lum(refAt(l + vec2(cos(t), sin(t)) * refPx * 1.6).rgb); }
        return (c - b / 6.0) / max(0.08, c);
      }
      // straight shards across the animal (Marc, cubism): which side of seven lines a point is on
      float lineD(vec2 p, float i) {
        float a = hash(vec2(i, seed) * 3.7) * 3.1416, o = (hash(vec2(seed, i) * 5.3) - 0.5) * 0.9;
        return dot(p - 0.5, vec2(cos(a), sin(a))) - o * 0.5;
      }
      float shardId(vec2 p, out float dmin) {
        float id = 0.0; dmin = 9.0;
        for (int i = 0; i < 7; i++) { float d = lineD(p, float(i)); dmin = min(dmin, abs(d)); if (d > 0.0) id += exp2(float(i)); }
        return id;
      }
      float edge(vec2 uv, float r) {   // the animal's outline
        float a = A(uv).a, e = 0.0;
        for (int k = 0; k < 8; k++) { float t = float(k) * 0.785; e += abs(a - A(uv + vec2(cos(t), sin(t)) * r * px).a); }
        return clamp(e / 3.0, 0.0, 1.0);
      }
      void main() {
        vec4 here = A(vUv);
        // brush strokes may reach a little past the body, like paint does
        float near = here.a;
        if (near < 0.5) { for (int k = 0; k < 6; k++) { float t = float(k) * 1.047; near = max(near, A(vUv + vec2(cos(t), sin(t)) * brush * 0.6 * px).a); } }
        // Marc's lines of force: a few shards run out past the body into the painting around it
        float ray_ = 0.0;
        if (mode == 5 && near < 0.5) {
          vec2 l = local(vUv);
          if (l.x > -0.18 && l.x < 1.18 && l.y > -0.12 && l.y < 1.15) {
            for (int i = 0; i < 3; i++) { float d = abs(lineD(l, float(i))); ray_ = max(ray_, smoothstep(0.035, 0.0, d) * 0.32); }
          }
          if (ray_ < 0.03) discard;
          gl_FragColor = vec4(mix(hue * 1.3, pal[6], 0.35), ray_ * (1.0 - smoothstep(0.0, 0.18, max(max(-l.x, l.x - 1.0), max(-l.y, l.y - 1.0)))));
          #include <colorspace_fragment>
          return;
        }
        if (near < 0.5) discard;
        vec3 c; float cover = here.a;
        if (mode == 1) {                 // loose dabs: each dab one colour, oriented, ragged edged
          vec2 g = vUv / px / (brush * 1.6);
          vec2 cell = floor(g + noise(g * 0.7) * 0.8);
          vec2 cuv = (cell + 0.5 + (vec2(hash(cell), hash(cell + 7.0)) - 0.5) * 0.6) * brush * 1.6 * px;
          vec4 d = A(cuv);
          c = d.a > 0.5 ? kuwahara(cuv, brush * 0.8) : kuwahara(vUv, brush * 0.8);
          c *= (0.92 + 0.16 * hash(cell + 3.0)) * (0.9 + 0.2 * stroke(vUv));
          c = inPalette(c, 0.45);
          cover = max(here.a, d.a * step(0.35, noise(g * 2.3)));
        } else if (mode == 2) {          // points of colour
          vec2 g = vUv / px / (brush * 1.1);
          vec2 cell = floor(g); vec2 f = fract(g) - 0.5;
          vec2 cuv = (cell + 0.5) * brush * 1.1 * px;
          vec3 base = kuwahara(cuv, brush * 0.5);
          vec3 p = nearestPal(base * (0.85 + 0.3 * hash(cell)));
          float dot_ = smoothstep(0.5, 0.36, length(f));
          c = mix(base * 0.95, p * (lum(base) / max(0.02, lum(p))), 0.7);
          cover = here.a * max(dot_, 0.35);
        } else if (mode == 3) {          // flat colour, dark outline
          c = kuwahara(vUv, brush);
          vec3 p = nearestPal(c);
          float l = lum(c); c = p * (floor(l / max(0.02, lum(p)) * 3.0 + 0.5) / 3.0);
          c = mix(c, p, 0.5);
          c = mix(c, pal[0] * 0.4, edge(vUv, 1.6));
        } else if (mode == 4) {          // ink wash
          float l = lum(kuwahara(vUv, brush));
          float wash = floor(l * 4.0 + noise(vUv / px * 0.05) * 0.6) / 4.0;
          c = mix(vec3(0.06, 0.05, 0.045), vec3(0.85, 0.82, 0.76), wash);
          c = mix(c, vec3(0.03), edge(vUv, 1.8));
        } else if (mode == 5) {          // shards: Marc's animals, one pure colour, broken by crystal light
          vec2 l = local(vUv); float dm;
          float id = shardId(l, dm);
          vec3 base = kuwahara(vUv, brush * 1.6);
          float h = hash(vec2(id, seed + 1.0));
          // its light and shade in three flat values (relative to its own mean)
          float rel = lum(base) / max(0.02, lum(muA));
          float band = floor(clamp(rel * 0.75, 0.0, 0.999) * 3.0) / 2.0;
          vec3 other = pal[int(floor(hash(vec2(id * 1.7, seed)) * 7.99))];
          other *= 0.6 / max(0.05, lum(other));                         // the other planes as strong as the body
          // each plane the body colour at its own strength; a few take a neighbouring colour, laid
          // over it like coloured glass
          c = hue * (0.32 + 0.62 * band) * (0.78 + 0.44 * hash(vec2(id, seed + 5.0)));
          if (h < 0.3) c = mix(c, other * (0.4 + 0.5 * band), 0.55);
          c += hue * smoothstep(1.2, 1.7, rel) * 0.35;                              // where light catches it
          c = mix(c, c * 0.45, smoothstep(0.006, 0.0, dm) * 0.7);               // soft seams between planes
          c = mix(c, c * 0.3, edge(vUv, 2.0));                                   // a dark contour, as Marc drew
          cover = here.a * (h > 0.82 ? 0.5 : 1.0);                          // some shards let the painting through
        } else {                         // oil
          c = kuwahara(vUv, brush);
          c = inPalette(c, 0.18);
          // old-master light: a little deeper in the shadows, warm varnished lights
          float l = lum(c);
          c *= 0.8 + 0.35 * smoothstep(0.04, 0.75, l);
          c *= vec3(1.07, 1.0, 0.86);
          c *= 0.86 + 0.28 * stroke(vUv);                       // fine strokes along the light and shade
          c *= 0.96 + 0.06 * noise(vUv / px * 0.9);        // canvas weave
        }
        // the painter's brushwork on it (not on the flat folk colour, which has none)
        float dt = detail(vUv);
        c *= 1.0 + clamp(dt * 2.2 * detailK, -0.45, 0.45);
        gl_FragColor = vec4(c, clamp(cover, 0.0, 1.0));
        #include <colorspace_fragment>
      }`,
    depthTest: false, depthWrite: false, transparent: true,
  });
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat); quad.frustumCulled = false;
  const post = new THREE.Scene(); post.add(quad);
  const cam = new THREE.Camera();
  const size = new THREE.Vector2();
  return {
    mat,
    // scene: {mean, sd} of the painting around the animal (linear RGB). The animal's own are read
    // from a small render of it alone.
    calibrate(scene, camera, animalRoot, sceneStats, strength = 0.85) {
      animalOnly(scene, camera, animalRoot, probeRT);
      const px = new Uint8Array(192 * 120 * 4); renderer.readRenderTargetPixels(probeRT, 0, 0, 192, 120, px);
      renderer.setRenderTarget(null);
      const lin = v => v / 255;                                         // a render target holds linear light already
      let n = 0; const m = [0, 0, 0], q = [0, 0, 0];
      for (let i = 0; i < px.length; i += 4) { if (px[i + 3] < 200) continue; n++;
        for (let k = 0; k < 3; k++) { const v = lin(px[i + k]); m[k] += v; q[k] += v * v; } }
      if (n < 30) return false;
      const mu = m.map(v => v / n), sd = q.map((v, k) => Math.sqrt(Math.max(1e-6, v / n - mu[k] * mu[k])));
      mat.uniforms.muA.value.set(...mu); mat.uniforms.sdA.value.set(...sd);
      mat.uniforms.muS.value.set(...sceneStats.mean); mat.uniforms.sdS.value.set(...sceneStats.sd.map(v => v * 0.9));
      mat.uniforms.toneK.value = strength;
      return { animal: { mu, sd }, scene: sceneStats };
    },
    setRef(tex) {
      mat.uniforms.refTex.value = tex; mat.uniforms.hasRef.value = tex ? 1 : 0;
      if (tex?.image) mat.uniforms.refPx.value.set(1 / tex.image.width, 1 / tex.image.height);
    },
    setBox(u0, v0, u1, v1) { mat.uniforms.aBox.value.set(u0, v0, u1, v1); },
    setRefScale(su, sv) { mat.uniforms.refScale.value.set(Math.max(0.01, su), Math.max(0.01, sv)); },
    brushK: 1,
    render(scene, camera, animalRoot) {
      renderer.getDrawingBufferSize(size);
      if (animalRT.width !== size.x || animalRT.height !== size.y || this._bk !== this.brushK) {
        this._bk = this.brushK;
        animalRT.setSize(size.x, size.y);
        mat.uniforms.px.value.set(1 / size.x, 1 / size.y);
        mat.uniforms.brush.value = Math.max(1.5, size.y / 110 * this.brushK);   // the painting's own brush (finer for fine painters)
      }
      // 1 · everything, as usual, straight to the screen (the animal too: it casts its shadow)
      renderer.setRenderTarget(null); renderer.render(scene, camera);
      // 2 · the animal alone; the room and the painted figures only hide it (depth, no colour)
      animalOnly(scene, camera, animalRoot, animalRT);
      // 3 · the animal, repainted, over the picture
      renderer.setRenderTarget(null);
      const ac = renderer.autoClear; renderer.autoClear = false; renderer.render(post, cam); renderer.autoClear = ac;
    },
  };
}

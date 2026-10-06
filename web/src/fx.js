// World shading effects (simulation layer, ambience only):
// - wind: foliage sways a little in the vertex shader (stronger in rain);
// - weather surfaces: upward-facing outdoor surfaces get patchy snow or a wet, glossy sheen with puddles;
// - water: ponds, fountains and bird baths share one rippling, reflective material;
// - rain splashes and footprints in snow.
// Everything is patched onto existing flat-shaded materials once, so draw calls don't change.

import * as THREE from 'three';

const MAX_ROOMS = 24;

export const fxUniforms = {
  uTime: { value: 0 },
  uWind: { value: 1 },
  uWet: { value: 0 },
  uSnow: { value: 0 },
  uRooms: { value: Array.from({ length: MAX_ROOMS }, () => new THREE.Vector4(1e5, 1e5, 1e5, 1e5)) },
  uRoomCount: { value: 0 },
  uCloud: { value: 0 }, // moving cloud shadows on the ground (0 at night or under overcast skies)
  uRimColor: { value: new THREE.Color(0xbfd6ff) },
  uRimStrength: { value: 0.35 },
};

const NOISE = /* glsl */ `
  float fxHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float fxNoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(fxHash(i), fxHash(i + vec2(1.0, 0.0)), f.x), mix(fxHash(i + vec2(0.0, 1.0)), fxHash(i + 1.0), f.x), f.y);
  }
`;

const WORLD_VARYINGS = /* glsl */ `
  vec4 fxWorld = vec4(transformed, 1.0);
  vec3 fxN = objectNormal;
  #ifdef USE_INSTANCING
    fxWorld = instanceMatrix * fxWorld;
    fxN = mat3(instanceMatrix) * fxN;
  #endif
  fxWorld = modelMatrix * fxWorld;
  vFxWorld = fxWorld.xyz;
  vFxNormal = normalize(mat3(modelMatrix) * fxN);
`;

/**
 * Add wind sway (when `material.userData.sway`) and weather surfaces to a flat-shaded standard material.
 * Safe to call repeatedly; materials are patched once.
 */
export function patchWorldMaterial(m) {
  if (m.userData.fx || !m.isMeshStandardMaterial || !m.flatShading || m.transparent) return false;
  m.userData.fx = true;
  const sway = !!m.userData.sway;
  // Surface detail flags (set before the first render): mottle (0–1 strength) for grass and paving,
  // asphalt wear, siding (board height in m) for clapboard walls, bands (row height in m) for shingles.
  const flags = [
    m.userData.mottle ? `#define FX_MOTTLE ${m.userData.mottle.toFixed(3)}` : '',
    m.userData.asphalt ? '#define FX_ASPHALT' : '',
    m.userData.siding ? `#define FX_SIDING ${m.userData.siding.toFixed(3)}` : '',
    m.userData.bands ? `#define FX_BANDS ${m.userData.bands.toFixed(3)}` : '',
  ].filter(Boolean).join('\n');
  m.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, fxUniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>
        uniform float uTime, uWind;
        varying vec3 vFxWorld;
        varying vec3 vFxNormal;`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        ${sway ? `{
          vec4 sw = modelMatrix * vec4(transformed, 1.0);
          float h = max(0.0, sw.y - 0.3);
          float ph = sw.x * 0.35 + sw.z * 0.27;
          transformed.x += sin(uTime * 1.7 + ph) * 0.03 * uWind * h;
          transformed.z += cos(uTime * 1.3 + ph * 1.3) * 0.022 * uWind * h;
        }` : ''}`)
      .replace('#include <project_vertex>', `#include <project_vertex>
        ${WORLD_VARYINGS}`);
    shader.fragmentShader = `${flags}\n${shader.fragmentShader}`
      .replace('#include <common>', `#include <common>
        uniform float uWet, uSnow, uCloud, uTime;
        uniform vec4 uRooms[${MAX_ROOMS}];
        uniform int uRoomCount;
        varying vec3 vFxWorld;
        varying vec3 vFxNormal;
        ${NOISE}`)
      .replace('#include <color_fragment>', `#include <color_fragment>
        #ifdef FX_MOTTLE
          float fxM = fxNoise(vFxWorld.xz * 0.32) * 0.6 + fxNoise(vFxWorld.xz * 1.9) * 0.4;
          diffuseColor.rgb *= 1.0 + (fxM - 0.5) * FX_MOTTLE;
        #endif
        #ifdef FX_ASPHALT
          float fxA = fxNoise(vFxWorld.xz * 0.55) * 0.55 + fxNoise(vFxWorld.xz * 3.3) * 0.25 + fxHash(floor(vFxWorld.xz * 22.0)) * 0.2;
          diffuseColor.rgb *= 0.9 + fxA * 0.2;
          // Hairline cracks in a few patches.
          float fxCrack = abs(fxNoise(vFxWorld.xz * 0.85 + 3.7) - 0.5);
          float fxPatch = smoothstep(0.62, 0.72, fxNoise(vFxWorld.xz * 0.12 + 9.0));
          diffuseColor.rgb *= mix(1.0, 0.62, (1.0 - smoothstep(0.0, 0.02, fxCrack)) * fxPatch);
        #endif
        #ifdef FX_SIDING
          float fxVert = 1.0 - smoothstep(0.3, 0.6, abs(normalize(vFxNormal).y));
          float fxLap = fract(vFxWorld.y / FX_SIDING);
          diffuseColor.rgb *= mix(1.0, 0.84 + 0.16 * smoothstep(0.0, 0.18, fxLap), fxVert);
        #endif
        #ifdef FX_BANDS
          float fxRow = fract(vFxWorld.y / FX_BANDS);
          diffuseColor.rgb *= 0.86 + 0.14 * smoothstep(0.0, 0.3, fxRow);
          diffuseColor.rgb *= 0.94 + 0.12 * fxHash(floor(vec2(vFxWorld.x * 2.2, vFxWorld.y / FX_BANDS)));
        #endif
        float fxUp = smoothstep(0.55, 0.9, normalize(vFxNormal).y);
        float fxOut = 1.0;
        for (int i = 0; i < ${MAX_ROOMS}; i++) {
          if (i >= uRoomCount) break;
          vec4 r = uRooms[i];
          // Rooms stay dry; roofs above them still catch snow and rain.
          if (vFxWorld.x > r.x && vFxWorld.x < r.z && vFxWorld.z > r.y && vFxWorld.z < r.w && vFxWorld.y < 2.6) fxOut = 0.0;
        }
        float fxDrift = fxNoise(vFxWorld.xz * 0.5) * 0.65 + fxNoise(vFxWorld.xz * 2.3) * 0.2;
        // Cloud shadows drifting across everything outdoors that faces up.
        float fxCs = smoothstep(0.42, 0.78, fxNoise(vFxWorld.xz * 0.022 + uTime * vec2(0.011, 0.005)));
        diffuseColor.rgb *= 1.0 - 0.2 * fxCs * uCloud * fxOut * smoothstep(0.2, 0.6, normalize(vFxNormal).y);
        float fxSnow = fxUp * fxOut * smoothstep(0.42, 0.7, fxDrift + uSnow * 0.32) * min(1.0, uSnow * 1.6) * 0.92;
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.9, 0.93, 0.97), fxSnow);
        float fxWet = uWet * fxUp * fxOut * (1.0 - fxSnow);
        float fxPuddle = smoothstep(0.58, 0.72, fxNoise(vFxWorld.xz * 0.16 + 7.0)) * fxWet;
        diffuseColor.rgb *= 1.0 - 0.26 * fxWet;
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.45, 0.53, 0.64), fxPuddle * 0.55); // sky in the puddles`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
        roughnessFactor = mix(roughnessFactor, 0.32, fxWet * 0.7);
        roughnessFactor = mix(roughnessFactor, 0.03, fxPuddle);`);
  };
  m.customProgramCacheKey = () => `fx${sway ? '-sway' : ''}|${flags}`;
  m.needsUpdate = true;
  return true;
}

/** Tileable ripple normal map (sum of integer-frequency waves, so it wraps seamlessly). */
function rippleNormals(size = 128) {
  const h = new Float32Array(size * size);
  const waves = [[3, 1, 0.6], [1, 4, 0.5], [5, -3, 0.25], [-2, 6, 0.2], [7, 2, 0.12]];
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let v = 0;
      for (const [fx, fy, a] of waves) v += a * Math.sin(((fx * x + fy * y) / size) * Math.PI * 2 + fx * 1.7);
      h[y * size + x] = v;
    }
  }
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const at = (i, j) => h[((j + size) % size) * size + ((i + size) % size)];
      const dx = (at(x + 1, y) - at(x - 1, y)) * 2.2;
      const dy = (at(x, y + 1) - at(x, y - 1)) * 2.2;
      const n = new THREE.Vector3(-dx, -dy, 1).normalize();
      const k = (y * size + x) * 4;
      data[k] = (n.x * 0.5 + 0.5) * 255;
      data[k + 1] = (n.y * 0.5 + 0.5) * 255;
      data[k + 2] = (n.z * 0.5 + 0.5) * 255;
      data[k + 3] = 255;
    }
  }
  const tex = new THREE.DataTexture(data, size, size);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.generateMipmaps = true;
  tex.needsUpdate = true;
  return tex;
}

let water = null;
const waterUniforms = { uRain: { value: 0 } };
/** The shared water surface: reflective, gently rippling in world space, with rain rings. */
export function waterMaterial() {
  if (water) return water;
  water = new THREE.MeshStandardMaterial({ color: 0x4ba3d6, roughness: 0.05, metalness: 0.15, normalMap: rippleNormals(), envMapIntensity: 1.4 });
  water.normalScale.set(0.55, 0.55);
  water.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, fxUniforms, waterUniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vFxWorld;\nvarying vec3 vFxNormal;')
      .replace('#include <project_vertex>', `#include <project_vertex>\n${WORLD_VARYINGS}`);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
        uniform float uTime, uRain;
        varying vec3 vFxWorld;
        varying vec3 vFxNormal;`)
      // Includes are expanded after onBeforeCompile, so replace the whole normal-map chunk.
      .replace('#include <normal_fragment_maps>', `
        vec2 wuv = vFxWorld.xz * 0.55;
        vec3 n1 = texture2D(normalMap, wuv + vec2(uTime * 0.035, uTime * 0.02)).xyz * 2.0 - 1.0;
        vec3 n2 = texture2D(normalMap, wuv * 1.7 - vec2(uTime * 0.02, -uTime * 0.04)).xyz * 2.0 - 1.0;
        vec3 n3 = texture2D(normalMap, wuv * 4.3 + vec2(uTime * 0.31, uTime * 0.27)).xyz * 2.0 - 1.0;
        vec3 mapN = vec3(n1.xy + n2.xy + n3.xy * uRain * 1.6, n1.z * n2.z);
        // Calm the ripples with distance so big water doesn't show the texture's tiling.
        mapN.xy *= normalScale * (1.0 - 0.8 * smoothstep(20.0, 70.0, length(vViewPosition)));
        normal = normalize(tbn * normalize(mapN));`);
  };
  water.customProgramCacheKey = () => 'fx-water';
  return water;
}

/** Rain splashes on the ground and footprints in the snow, near the camera focus. */
export class WeatherFx {
  constructor(scene) {
    this.scene = scene;
    const ringGeo = new THREE.RingGeometry(0.06, 0.1, 14);
    ringGeo.rotateX(-Math.PI / 2);
    this.splashes = new THREE.InstancedMesh(ringGeo, new THREE.MeshBasicMaterial({ color: 0xdfeefc, transparent: true, opacity: 0.45, depthWrite: false }), 90);
    this.splashes.frustumCulled = false;
    this.splashes.visible = false;
    this.splashState = Array.from({ length: 90 }, () => ({ x: 0, z: 0, y: 0.105, age: Math.random(), life: 0.45 + Math.random() * 0.3 }));
    scene.add(this.splashes);

    const printGeo = new THREE.CircleGeometry(0.07, 10);
    printGeo.scale(1, 1.55, 1);
    printGeo.rotateX(-Math.PI / 2);
    this.prints = new THREE.InstancedMesh(printGeo, new THREE.MeshBasicMaterial({ color: 0xa9b6c6, transparent: true, opacity: 0.5, depthWrite: false }), 80);
    this.prints.frustumCulled = false;
    this.prints.count = 0;
    this.printState = [];
    this.lastPrint = null;
    this.printSide = 1;
    scene.add(this.prints);
    this.m = new THREE.Matrix4();
    this.q = new THREE.Quaternion();
    this.s = new THREE.Vector3();
    this.p = new THREE.Vector3();
  }

  /** Lot-local rooms in world space, so effects stay outdoors. Rects are [x0, z0, x1, z1]. */
  setRooms(rects) {
    rects.slice(0, MAX_ROOMS).forEach((r, i) => fxUniforms.uRooms.value[i].set(...r));
    fxUniforms.uRoomCount.value = Math.min(rects.length, MAX_ROOMS);
    this.rooms = rects;
  }

  indoors(x, z) {
    return (this.rooms || []).some((r) => x > r[0] && x < r[2] && z > r[1] && z < r[3]);
  }

  /**
   * @param {{ weather: string, season: string }} now
   * @param {THREE.Vector3} focus camera focus
   * @param {{ pos: THREE.Vector3, facing: number, moving: boolean }} avatar
   */
  update(dt, t, now, focus, avatar) {
    fxUniforms.uTime.value = t;
    const raining = now.weather === 'rain';
    const snowTarget = now.weather === 'snow' ? 1 : now.season === 'winter' ? 0.45 : 0;
    const u = fxUniforms;
    // Snow builds up over ~20 s and melts over ~1 min; rain wets quickly and dries slowly.
    const snowRate = snowTarget > u.uSnow.value ? 0.05 : 0.016;
    u.uSnow.value += Math.sign(snowTarget - u.uSnow.value) * Math.min(Math.abs(snowTarget - u.uSnow.value), snowRate * dt);
    const wetRate = raining ? 0.12 : 0.025;
    u.uWet.value += Math.sign((raining ? 1 : 0) - u.uWet.value) * Math.min(Math.abs((raining ? 1 : 0) - u.uWet.value), wetRate * dt);
    u.uWind.value += ((raining ? 1.9 : now.weather === 'snow' ? 1.3 : 1) - u.uWind.value) * Math.min(1, dt * 0.5);
    waterUniforms.uRain.value += ((raining ? 1 : 0) - waterUniforms.uRain.value) * Math.min(1, dt * 0.6);

    // Splashes: short-lived rings scattered around the focus.
    this.splashes.visible = u.uWet.value > 0.05 && raining;
    if (this.splashes.visible) {
      this.splashState.forEach((sp, i) => {
        sp.age += dt;
        if (sp.age > sp.life) {
          sp.age = 0;
          for (let tries = 0; tries < 4; tries++) {
            sp.x = focus.x + (Math.random() - 0.5) * 34;
            sp.z = focus.z + (Math.random() - 0.5) * 34;
            if (!this.indoors(sp.x, sp.z)) break;
          }
        }
        const k = sp.age / sp.life;
        const scale = this.indoors(sp.x, sp.z) ? 0.0001 : 0.4 + k * 2.2;
        this.splashes.setMatrixAt(i, this.m.compose(this.p.set(sp.x, sp.y, sp.z), this.q.identity(), this.s.setScalar(scale * (1 - k * 0.3))));
      });
      this.splashes.instanceMatrix.needsUpdate = true;
    }

    // Footprints: alternate feet every ~0.42 m while walking outdoors in snow; they fade over 30 s.
    if (avatar && u.uSnow.value > 0.3 && avatar.moving && !this.indoors(avatar.pos.x, avatar.pos.z)) {
      const last = this.lastPrint;
      if (!last || Math.hypot(avatar.pos.x - last.x, avatar.pos.z - last.z) > 0.42) {
        this.printSide *= -1;
        const side = this.printSide * 0.11;
        const x = avatar.pos.x + Math.cos(avatar.facing) * side;
        const z = avatar.pos.z - Math.sin(avatar.facing) * side;
        this.printState.push({ x, z, rot: avatar.facing, age: 0 });
        if (this.printState.length > 80) this.printState.shift();
        this.lastPrint = { x: avatar.pos.x, z: avatar.pos.z };
      }
    }
    if (this.printState.length) {
      this.printState = this.printState.filter((p) => (p.age += dt) < 30 && u.uSnow.value > 0.15);
      this.printState.forEach((p, i) => {
        const fade = 1 - Math.max(0, (p.age - 20) / 10);
        this.q.setFromAxisAngle(this.s.set(0, 1, 0), p.rot);
        this.prints.setMatrixAt(i, this.m.compose(this.p.set(p.x, 0.105, p.z), this.q, this.s.setScalar(Math.max(0.0001, fade))));
      });
      this.prints.count = this.printState.length;
      this.prints.instanceMatrix.needsUpdate = true;
    } else this.prints.count = 0;
  }
}

/**
 * Characters (play layer): a soft rim light so Sims read against any background, tinted by the time of
 * day (main.js sets uRimColor/uRimStrength). Applied to the smooth-shaded materials people are built from.
 */
export function patchCharacterMaterial(m) {
  if (m.userData.rim) return m;
  m.userData.rim = true;
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uRimColor = fxUniforms.uRimColor;
    shader.uniforms.uRimStrength = fxUniforms.uRimStrength;
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform vec3 uRimColor;\nuniform float uRimStrength;')
      .replace('#include <opaque_fragment>', `
        float rimF = pow(1.0 - max(dot(normalize(normal), normalize(vViewPosition)), 0.0), 3.0);
        outgoingLight += uRimColor * rimF * uRimStrength;
        #include <opaque_fragment>`);
  };
  m.customProgramCacheKey = () => 'rim';
  return m;
}

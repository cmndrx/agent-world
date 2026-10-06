// Sky, sun/moon, fog, and image-based lighting, driven by time of day.
// Time of day is ambience only: it never says anything about what agents are doing.

import * as THREE from 'three';

/** Palette keyframes by hour (0–24). Colors are interpolated between neighbors. */
const KEYS = [
  { h: 0, top: '#081030', horizon: '#1d2a5c', sun: '#9fb4ff', sunI: 1.0, hemiSky: '#3d4f8f', hemiGround: '#1a2033', hemiI: 0.62, exposure: 1.18, gTint: '#e2e8ff', gSat: 1.05, gCon: 1.1 },
  { h: 5.2, top: '#101a40', horizon: '#3f3b6a', sun: '#a9bcff', sunI: 0.9, hemiSky: '#4a5a98', hemiGround: '#221f33', hemiI: 0.62, exposure: 1.15, gTint: '#dfe2ff', gSat: 1.05, gCon: 1.08 },
  { h: 6.4, top: '#3b5a99', horizon: '#f6a586', sun: '#ffaa70', sunI: 1.7, hemiSky: '#8fa6e0', hemiGround: '#7a5a48', hemiI: 0.6, exposure: 1.0, gTint: '#fff0e4', gSat: 1.12, gCon: 1.08 },
  { h: 8, top: '#5598e2', horizon: '#ffe0c2', sun: '#ffe0b8', sunI: 2.9, hemiSky: '#a9c8f5', hemiGround: '#8a8a5e', hemiI: 0.5, exposure: 0.98, gTint: '#fff8ee', gSat: 1.16, gCon: 1.1 },
  { h: 12.5, top: '#4a94e6', horizon: '#cfe7fa', sun: '#fff4e2', sunI: 3.1, hemiSky: '#a8c9f4', hemiGround: '#8fa86a', hemiI: 0.52, exposure: 0.95, gTint: '#fbfcff', gSat: 1.14, gCon: 1.12 },
  { h: 16.5, top: '#4f8fda', horizon: '#ffe3c2', sun: '#ffe2b8', sunI: 2.9, hemiSky: '#a6c3f0', hemiGround: '#90a06a', hemiI: 0.5, exposure: 0.97, gTint: '#fff6ea', gSat: 1.15, gCon: 1.1 },
  { h: 18.4, top: '#4a66b0', horizon: '#ffa565', sun: '#ffaa6c', sunI: 2.8, hemiSky: '#9ca8e2', hemiGround: '#7f7458', hemiI: 0.52, exposure: 1.05, gTint: '#fff1e2', gSat: 1.15, gCon: 1.1 },
  { h: 19.6, top: '#24305f', horizon: '#e5717a', sun: '#ff6a58', sunI: 1.4, hemiSky: '#6a62a8', hemiGround: '#3a2c40', hemiI: 0.58, exposure: 1.06, gTint: '#ffdcd8', gSat: 1.15, gCon: 1.1 },
  { h: 20.8, top: '#0b1333', horizon: '#26306a', sun: '#9fb4ff', sunI: 1.0, hemiSky: '#3d4f8f', hemiGround: '#1a2033', hemiI: 0.62, exposure: 1.16, gTint: '#e2e8ff', gSat: 1.05, gCon: 1.1 },
  { h: 24, top: '#081030', horizon: '#1d2a5c', sun: '#9fb4ff', sunI: 1.0, hemiSky: '#3d4f8f', hemiGround: '#1a2033', hemiI: 0.62, exposure: 1.18, gTint: '#e2e8ff', gSat: 1.05, gCon: 1.1 },
];

export const TIME_PRESETS = {
  auto: null,
  morning: 8.2,
  noon: 12.5,
  golden: 18.2,
  night: 22.5,
};

const SKY_VERT = /* glsl */ `
  varying vec3 vDir;
  void main() {
    vDir = normalize((modelMatrix * vec4(position, 0.0)).xyz);
    vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    gl_Position = p.xyww; // always at the far plane
  }
`;

const SKY_FRAG = /* glsl */ `
  uniform vec3 topColor;
  uniform vec3 horizonColor;
  uniform vec3 sunColor;
  uniform vec3 sunDir;
  uniform float night;
  uniform vec3 moonDir;
  varying vec3 vDir;

  float hash(vec3 p) { return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453); }

  void main() {
    vec3 d = normalize(vDir);
    float h = d.y;
    vec3 col = mix(horizonColor, topColor, pow(clamp(h, 0.0, 1.0), 0.55));
    col = mix(col, horizonColor * 0.85, smoothstep(0.0, -0.25, h)); // below the horizon

    float s = max(dot(d, normalize(sunDir)), 0.0);
    float disk = smoothstep(0.9993, 0.9997, s);
    float glow = pow(s, 12.0) * 0.45 + pow(s, 160.0) * 0.6;
    col += sunColor * (glow * (1.0 - night * 0.6) + disk * (1.0 - night * 0.7) * 2.5);

    // The moon: a soft disc with a faint halo, up while the sun is down.
    float m = max(dot(d, normalize(moonDir)), 0.0);
    col += vec3(0.85, 0.9, 1.0) * (smoothstep(0.99955, 0.99975, m) * 1.6 + pow(m, 90.0) * 0.18) * night;

    // Stars at night.
    vec3 cell = floor(d * 220.0);
    float star = step(0.9975, hash(cell)) * smoothstep(0.05, 0.4, h);
    float twinkle = 0.6 + 0.4 * sin(hash(cell + 1.0) * 60.0);
    col += vec3(star * twinkle * night * 1.4);

    gl_FragColor = vec4(col, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

const c = (hex) => new THREE.Color(hex);

function sample(hour) {
  let a = KEYS[0];
  let b = KEYS[KEYS.length - 1];
  for (let i = 0; i < KEYS.length - 1; i++) {
    if (hour >= KEYS[i].h && hour <= KEYS[i + 1].h) {
      a = KEYS[i];
      b = KEYS[i + 1];
      break;
    }
  }
  const t = b.h === a.h ? 0 : (hour - a.h) / (b.h - a.h);
  const mixC = (k) => c(a[k]).lerp(c(b[k]), t);
  const mixN = (k) => a[k] + (b[k] - a[k]) * t;
  return {
    top: mixC('top'),
    horizon: mixC('horizon'),
    sun: mixC('sun'),
    sunI: mixN('sunI'),
    hemiSky: mixC('hemiSky'),
    hemiGround: mixC('hemiGround'),
    hemiI: mixN('hemiI'),
    exposure: mixN('exposure'),
    gTint: mixC('gTint'),
    gSat: mixN('gSat'),
    gCon: mixN('gCon'),
  };
}

export class Environment {
  constructor(renderer, scene) {
    this.renderer = renderer;
    this.scene = scene;
    this.mode = 'auto';
    this.hour = 12;
    this.night = 0;
    this.lastEnvHour = -99;

    this.skyUniforms = {
      topColor: { value: new THREE.Color() },
      horizonColor: { value: new THREE.Color() },
      sunColor: { value: new THREE.Color() },
      sunDir: { value: new THREE.Vector3(0, 1, 0) },
      night: { value: 0 },
      // Low over the far side of the neighborhood, where the camera usually looks.
      moonDir: { value: new THREE.Vector3(0.3, 0.3, -0.9).normalize() },
    };
    const skyMat = new THREE.ShaderMaterial({
      uniforms: this.skyUniforms,
      vertexShader: SKY_VERT,
      fragmentShader: SKY_FRAG,
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
    });
    this.sky = new THREE.Mesh(new THREE.SphereGeometry(400, 32, 16), skyMat);
    this.sky.frustumCulled = false;
    this.sky.renderOrder = -1;
    scene.add(this.sky);

    // A separate scene holding only the sky, for generating the environment map.
    this.envScene = new THREE.Scene();
    this.envScene.add(new THREE.Mesh(new THREE.SphereGeometry(10, 32, 16), skyMat));
    this.pmrem = new THREE.PMREMGenerator(renderer);

    this.hemi = new THREE.HemisphereLight(0xffffff, 0x888888, 1);
    this.sun = new THREE.DirectionalLight(0xffffff, 2);
    this.sun.castShadow = true;
    this.sun.shadow.bias = -0.0004;
    this.sun.shadow.normalBias = 0.03;
    scene.add(this.hemi, this.sun, this.sun.target);

    scene.fog = new THREE.FogExp2(0xcfe6f5, 0.0032);
    this.sunDir = new THREE.Vector3();
  }

  setMode(mode) {
    this.mode = mode in TIME_PRESETS ? mode : 'auto';
    this.lastEnvHour = -99; // force an environment-map refresh
  }

  setShadowQuality(size, extent) {
    const s = this.sun.shadow;
    if (s.mapSize.x !== size) {
      s.mapSize.set(size, size);
      s.map?.dispose();
      s.map = null;
    }
    Object.assign(s.camera, { left: -extent, right: extent, top: extent, bottom: -extent, near: 1, far: 160 });
    s.camera.updateProjectionMatrix();
  }

  currentHour() {
    if (this.mode !== 'auto') return TIME_PRESETS[this.mode];
    const d = new Date();
    return d.getHours() + d.getMinutes() / 60 + d.getSeconds() / 3600;
  }

  /** @param {THREE.Vector3} focus point the camera looks at; the shadow camera follows it. */
  update(focus) {
    const hour = this.currentHour();
    // Ease toward preset changes instead of snapping.
    let dh = hour - this.hour;
    if (dh > 12) dh -= 24;
    if (dh < -12) dh += 24;
    this.hour = (this.hour + dh * 0.06 + 24) % 24;

    const p = sample(this.hour);
    const theta = (Math.PI * (this.hour - 6.3)) / 13.4; // 0 at sunrise, π at sunset
    const elevation = Math.sin(theta);
    this.night = THREE.MathUtils.smoothstep(-elevation, -0.12, 0.08);

    // Sun arcs east → west; at night the key light becomes a cool moon high in the sky.
    const sunDir = this.sunDir.set(-Math.cos(theta) * 0.85, Math.max(elevation, -0.2) * 1.25, 0.55).normalize();
    // At night the key light is the moon, low enough to model shapes and throw soft blue shadows.
    const lightDir = elevation > 0.05 ? sunDir : new THREE.Vector3(0.45, 0.85, 0.5).normalize();

    this.skyUniforms.topColor.value.copy(p.top);
    this.skyUniforms.horizonColor.value.copy(p.horizon);
    this.skyUniforms.sunColor.value.copy(p.sun);
    this.skyUniforms.sunDir.value.copy(sunDir);
    this.skyUniforms.night.value = this.night;

    this.hemi.color.copy(p.hemiSky);
    this.hemi.groundColor.copy(p.hemiGround);
    this.hemi.intensity = p.hemiI;
    this.sun.color.copy(p.sun);
    this.sun.intensity = p.sunI;
    this.sun.position.copy(focus).addScaledVector(lightDir, 60);
    this.sun.target.position.copy(focus);
    this.scene.fog.color.copy(p.horizon).lerp(p.top, 0.35);
    this.renderer.toneMappingExposure = p.exposure;
    this.grade = { tint: p.gTint, saturation: p.gSat, contrast: p.gCon };
    this.sky.position.copy(focus);

    // Weather ambience (seasons.js): overcast skies go gray, the sun dims, the air thickens a little.
    const o = this.overcast || 0;
    if (o > 0.001) {
      const gray = new THREE.Color(0x9aa6b4).multiplyScalar(1 - this.night * 0.75);
      this.skyUniforms.topColor.value.lerp(gray, 0.65 * o);
      this.skyUniforms.horizonColor.value.lerp(gray, 0.5 * o);
      this.sun.intensity *= 1 - 0.6 * o;
      this.hemi.intensity *= 1 - 0.15 * o;
      this.scene.fog.color.lerp(gray, 0.6 * o);
    }
    this.scene.fog.density = (0.0032 + 0.007 * o) * (this.fogScale ?? 1);

    // Regenerate image-based lighting when the sky has changed noticeably.
    if (Math.abs(this.hour - this.lastEnvHour) > 0.25) {
      this.lastEnvHour = this.hour;
      this.envRT?.dispose();
      this.envRT = this.pmrem.fromScene(this.envScene, 0.04);
      this.scene.environment = this.envRT.texture;
      this.scene.environmentIntensity = 0.3 + (1 - this.night) * 0.15;
    }
  }

  label() {
    const h = Math.floor(this.hour);
    const m = Math.floor((this.hour % 1) * 60);
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }
}

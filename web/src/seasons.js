// Seasons and weather (phase 3). Ambience only: the season follows the viewer's calendar (or a chosen
// override) and the weather is a calm, seeded daily pick, never a forecast and never agent-related.

import * as THREE from 'three';
import { dayKey } from '../../shared/collectibles.mjs';
import { PALETTE } from './models.js';
import { patchWorldMaterial } from './fx.js';

export const SEASONS = { auto: 'Follow the calendar', spring: 'Spring', summer: 'Summer', autumn: 'Autumn', winter: 'Winter' };
export const WEATHERS = { auto: 'Seasonal mix', clear: 'Clear', rain: 'Rain', snow: 'Snow' };

export function seasonFor(date = new Date()) {
  const m = date.getMonth();
  return m <= 1 || m === 11 ? 'winter' : m <= 4 ? 'spring' : m <= 7 ? 'summer' : 'autumn';
}

function dailyWeather(season, day) {
  let h = 2166136261;
  for (const c of day) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  const roll = (h >>> 0) % 100;
  if (season === 'winter') return roll < 55 ? 'snow' : 'clear';
  return roll < { spring: 30, summer: 15, autumn: 35 }[season] ? 'rain' : 'clear';
}

// Foliage and ground colors (by their original color) per season.
const FOLIAGE = [PALETTE.leaf, PALETTE.leafLight, PALETTE.leafDark, 0x4c9a59, 0x9bd06b, 0x7fb866, 0x6aa65a, 0x8fc477, 0x5f9b57, 0x6fb257];
const GROUND = [PALETTE.grassLot, 0x8fca70];
const AUTUMN = { [PALETTE.leaf]: 0xd9822b, [PALETTE.leafLight]: 0xe9b44c, [PALETTE.leafDark]: 0xb5452b, 0x9bd06b: 0xe9c46a, 0x7fb866: 0xc9a14a, 0x6aa65a: 0xb9803a, 0x8fc477: 0xd8b25a, 0x5f9b57: 0xa86a32, 0x6fb257: 0xb9a54a };
const SPRING = { [PALETTE.leafLight]: 0xf4b6c8, 0x9bd06b: 0xa8e07a };

export class Seasons {
  constructor(scene, env, scenery) {
    this.scene = scene;
    this.env = env;
    this.scenery = scenery;
    this.setting = { season: 'auto', weather: 'auto' };
    this.key = '';
    this.overcast = 0;
    this.rain = this.particles(1600, new THREE.BoxGeometry(0.02, 0.5, 0.02), new THREE.MeshBasicMaterial({ color: 0xaac4dd, transparent: true, opacity: 0.55 }));
    this.snow = this.particles(1300, new THREE.IcosahedronGeometry(0.05, 0), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9 }));
    this.leaves = this.particles(140, new THREE.PlaneGeometry(0.14, 0.1), new THREE.MeshStandardMaterial({ color: 0xd9822b, side: THREE.DoubleSide }));
    this.lastRefresh = -1;
  }

  particles(count, geometry, material) {
    const mesh = new THREE.InstancedMesh(geometry, material, count);
    mesh.frustumCulled = false;
    mesh.visible = false;
    const parts = [];
    for (let i = 0; i < count; i++) parts.push({ x: (Math.random() - 0.5) * 60, y: Math.random() * 25, z: (Math.random() - 0.5) * 60, s: Math.random() });
    mesh.userData.parts = parts;
    this.scene.add(mesh);
    return mesh;
  }

  set(setting) {
    Object.assign(this.setting, setting);
    this.lastRefresh = -1;
  }

  /** The season and weather actually showing now. */
  current() {
    const season = this.setting.season === 'auto' ? seasonFor() : this.setting.season;
    let weather = this.setting.weather === 'auto' ? dailyWeather(season, dayKey()) : this.setting.weather;
    if (weather === 'snow' && this.setting.weather === 'auto' && season !== 'winter') weather = 'clear';
    return { season, weather };
  }

  /** Recolor foliage and ground (cheap: shared materials). Re-run periodically to catch new objects. */
  recolor(season) {
    const ground = this.scenery.group.children.find((o) => o.isMesh && o.material.vertexColors);
    const colors = ground?.geometry.getAttribute('color');
    if (colors && ground.userData.season !== season) {
      // Blend the terrain's vertex colors (kept from the first pass) toward the season's ground color.
      ground.userData.season = season;
      const base = (ground.userData.baseColors ??= colors.array.slice());
      const [tr, tg, tb, k] = { autumn: [0.78, 0.7, 0.36, 0.45], winter: [0.93, 0.95, 0.97, 0.88], spring: [0.5, 0.78, 0.4, 0.1], summer: [0, 0, 0, 0] }[season];
      for (let i = 0; i < base.length; i += 3) {
        colors.array[i] = base[i] + (tr - base[i]) * k;
        colors.array[i + 1] = base[i + 1] + (tg - base[i + 1]) * k;
        colors.array[i + 2] = base[i + 2] + (tb - base[i + 2]) * k;
      }
      colors.needsUpdate = true;
    }
    const seen = new Set();
    this.scene.traverse((o) => {
      if (!o.isMesh || !o.material?.color || seen.has(o.material)) return;
      const m = o.material;
      seen.add(m);
      if (m.userData.baseColor === undefined) m.userData.baseColor = m.color.getHex();
      const base = m.userData.baseColor;
      const isFoliage = FOLIAGE.includes(base);
      const isGround = GROUND.includes(base);
      // Wind and weather surfaces (fx.js) ride along on the same pass, so new objects pick them up too.
      if (isFoliage && !m.userData.fx) m.userData.sway = true;
      patchWorldMaterial(m);
      if (!isFoliage && !isGround) return;
      if (m.userData.season === season) return;
      m.userData.season = season;
      const c = new THREE.Color(base);
      if (season === 'autumn') c.setHex(AUTUMN[base] ?? (isGround ? 0xb7c46a : base));
      else if (season === 'winter') c.lerp(new THREE.Color(0xeef3f6), isGround ? 0.92 : base === 0x4c9a59 ? 0.35 : 0.72);
      else if (season === 'spring') c.setHex(SPRING[base] ?? base);
      m.color.copy(c);
    });
  }

  update(dt, t, focus) {
    const { season, weather } = this.current();
    const key = `${season}|${weather}`;
    if (key !== this.key || t - this.lastRefresh > 2 || this.lastRefresh < 0) {
      this.key = key;
      this.lastRefresh = t;
      this.recolor(season);
    }
    const target = weather === 'rain' ? 0.7 : weather === 'snow' ? 0.45 : 0;
    this.overcast += (target - this.overcast) * (1 - Math.exp(-dt * 0.8));
    this.env.overcast = this.overcast;

    this.flow(this.rain, weather === 'rain', dt, focus, (p) => {
      p.y -= dt * 22;
      p.x += dt * 2;
    });
    this.flow(this.snow, weather === 'snow', dt, focus, (p) => {
      p.y -= dt * (1.4 + p.s);
      p.x += Math.sin(t * 0.8 + p.s * 10) * dt * 0.6;
    });
    this.flow(this.leaves, season === 'autumn' && weather === 'clear', dt, focus, (p) => {
      p.y -= dt * (0.9 + p.s * 0.6);
      p.x += Math.sin(t * 1.3 + p.s * 20) * dt * 1.2;
      p.z += Math.cos(t * 0.9 + p.s * 13) * dt * 0.8;
    }, t);
  }

  /** Move a particle field with the camera focus, wrapping drops back to the top. */
  flow(mesh, on, dt, focus, step, t = 0) {
    mesh.visible = on;
    if (!on) return;
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const e = new THREE.Euler();
    const one = new THREE.Vector3(1, 1, 1);
    const pos = new THREE.Vector3();
    mesh.userData.parts.forEach((p, i) => {
      step(p);
      if (p.y < 0) {
        p.y = 18 + Math.random() * 7;
        p.x = (Math.random() - 0.5) * 60;
        p.z = (Math.random() - 0.5) * 60;
      }
      pos.set(focus.x + p.x, p.y, focus.z + p.z);
      q.setFromEuler(e.set(t * (1 + p.s), t * p.s * 2, 0.3));
      mesh.setMatrixAt(i, m.compose(pos, q, one));
    });
    mesh.instanceMatrix.needsUpdate = true;
  }
}

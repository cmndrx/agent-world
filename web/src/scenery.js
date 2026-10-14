// The neighborhood around the lots: terrain, hills, streets, lamps, grass, flowers, clouds.

import * as THREE from 'three';
import { CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { LOT_D, LOT_W } from './lot.js';
import { PALETTE, buildTree, ico, mat, mergeStatic, rng } from './models.js';
import { BUILDABLE, DEFAULT_STREETS, PROTECTED, TILE, extents, tileCenter, tilesRect, worldToLocal } from '../../shared/town.mjs';
import { buildRoads, roadRects } from './roads.js';

const wind = { value: 0 };
export { DEFAULT_STREETS };

/** Inject a gentle wind sway into a material's vertex shader (higher vertices move more). */
function addWind(material, strength = 0.12) {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = wind;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uTime;')
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        #ifdef USE_INSTANCING
          vec3 ip = vec3(instanceMatrix[3][0], 0.0, instanceMatrix[3][2]);
        #else
          vec3 ip = vec3(0.0);
        #endif
        float sway = sin(uTime * 1.6 + ip.x * 0.35 + ip.z * 0.27) * ${strength.toFixed(3)};
        transformed.x += sway * max(position.y, 0.0) * 2.0;
        transformed.z += sway * 0.6 * max(position.y, 0.0) * 2.0;`,
      );
  };
  return material;
}

/** Grass tuft base color (seasons.js recolors it with the ground). */
export const TUFT = 0x70b358;

export class Scenery {
  constructor(scene) {
    this.scene = scene;
    // Surface detail for shared ground materials (fx.js): mottled grass and paving, worn asphalt.
    Object.assign(mat(PALETTE.grassLot).userData, { mottle: 0.16, lawn: true });
    mat(PALETTE.sidewalk).userData.mottle = 0.07;
    mat(PALETTE.asphalt, { roughness: 0.9 }).userData.asphalt = true;
    this.group = new THREE.Group();
    scene.add(this.group);
    this.lamps = [];
    this.clouds = [];
    this.buildTerrain();
    this.buildHills();
    this.buildClouds();
  }

  buildTerrain() {
    // Large faceted ground with subtle color variation; flat near the lots, rolling farther out.
    const size = 520;
    const seg = 90;
    const geo = new THREE.PlaneGeometry(size, size, seg, seg).toNonIndexed();
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position;
    const colors = new Float32Array(pos.count * 3);
    const base = new THREE.Color(PALETTE.grass);
    const dark = new THREE.Color(PALETTE.grassDark);
    const light = new THREE.Color(0xa6d67f);
    const cx = LOT_W;
    const cz = LOT_D;
    const n = (x, z) => Math.sin(x * 0.045) * Math.cos(z * 0.05) + Math.sin(x * 0.11 + z * 0.07) * 0.4;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      const dist = Math.hypot(x - cx, z - cz);
      const rolling = THREE.MathUtils.smoothstep(dist, 150, 205); // flat across the buildable grid, groves and pond; hills beyond
      pos.setY(i, -0.06 + n(x, z) * 2.4 * rolling);
    }
    // Color per triangle (flat facets).
    const c = new THREE.Color();
    for (let i = 0; i < pos.count; i += 3) {
      const x = (pos.getX(i) + pos.getX(i + 1) + pos.getX(i + 2)) / 3;
      const z = (pos.getZ(i) + pos.getZ(i + 1) + pos.getZ(i + 2)) / 3;
      const v = n(x * 1.7, z * 1.7);
      c.copy(base).lerp(v > 0 ? light : dark, Math.min(1, Math.abs(v) * 0.35 + ((i * 7919) % 13) / 130));
      for (let k = 0; k < 3; k++) colors.set([c.r, c.g, c.b], (i + k) * 3);
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.computeVertexNormals();
    const groundMat = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.95 });
    groundMat.userData.mottle = 0.22; // fine grain plus broad warm/cool patches (fx.js)
    const ground = new THREE.Mesh(geo, groundMat);
    ground.position.set(cx, 0, cz);
    ground.receiveShadow = true;
    this.group.add(ground);
  }

  buildHills() {
    const r = rng(42);
    const hills = new THREE.Group();
    const colors = [0x7fb866, 0x6aa65a, 0x8fc477, 0x5f9b57];
    for (let i = 0; i < 26; i++) {
      const a = (i / 26) * Math.PI * 2 + r() * 0.2;
      const d = 178 + r() * 60; // beyond the buildable grid
      const s = 18 + r() * 26;
      const hill = ico(s, colors[i % colors.length], LOT_W + Math.cos(a) * d, -s * 0.55, LOT_D + Math.sin(a) * d, 1);
      hill.scale.y = 0.55 + r() * 0.3;
      hill.castShadow = false;
      hills.add(hill);
      // A few distant trees on the slopes.
      for (let k = 0; k < 3; k++) {
        const t = buildTree(i * 10 + k, LOT_W + Math.cos(a + (r() - 0.5) * 0.08) * (d - s * 0.6), LOT_D + Math.sin(a + (r() - 0.5) * 0.08) * (d - s * 0.6), 'pine');
        t.scale.setScalar(2.4);
        t.position.y = s * hill.scale.y * 0.25;
        t.traverse((o) => (o.userData.dynamic = false)); // too far to see sway; let it merge
        hills.add(t);
      }
    }
    this.group.add(mergeStatic(hills));
  }

  buildClouds() {
    const r = rng(9);
    const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, flatShading: true, roughness: 1, emissive: 0xffffff, emissiveIntensity: 0.15 });
    for (let i = 0; i < 9; i++) {
      const cloud = new THREE.Group();
      const puffs = 3 + Math.floor(r() * 4);
      for (let k = 0; k < puffs; k++) {
        const m = new THREE.Mesh(new THREE.IcosahedronGeometry(2 + r() * 2.5, 0), mat);
        m.position.set(k * 2.6 - puffs * 1.3, r() * 1.2, (r() - 0.5) * 2.5);
        m.scale.y = 0.7;
        cloud.add(m);
      }
      cloud.position.set(-80 + r() * 220, 34 + r() * 14, -60 + r() * 160);
      cloud.userData.speed = 0.6 + r() * 0.8;
      this.group.add(cloud);
      this.clouds.push(cloud);
    }
    this.cloudMat = mat;
  }

  /**
   * Streets, lamps, grass and flowers from the town layout (shared/town.mjs). Rebuilt when streets or plots
   * change; street name signs update in place.
   */
  setTown(town) {
    const layoutKey = JSON.stringify([town.roads.map((r) => [r.i0, r.j0, r.i1, r.j1]), town.homes.map((h) => [h.i, h.j, h.rot]), (town.civic || []).map((c) => [c.i, c.j, c.rot])]);
    if (layoutKey !== this.layoutKey) {
      this.layoutKey = layoutKey;
      this.disposeTown();
      const { group, lamps } = buildRoads(town);
      mergeStatic(group.children[1]); // lamp posts (bulbs and light pools stay separate)
      this.townGroup = group;
      this.lamps = lamps;
      this.group.add(group);
      this.buildMeadow(town);
    }
    this.setStreetLabels(town);
  }

  disposeTown() {
    for (const g of [this.townGroup, this.meadow]) {
      if (!g) continue;
      this.group.remove(g);
      g.traverse((o) => {
        o.geometry?.dispose();
        // Only the lamps' own glow materials; the palette materials are shared and cached.
        if (o.userData?.nightGlow || o.userData?.nightPool || o.isInstancedMesh) o.material?.dispose();
      });
    }
    this.townGroup = this.meadow = null;
  }

  /** Instanced grass tufts and flowers on open ground: off streets, rooms, front paths, civic land and civic buildings. */
  buildMeadow(town) {
    const r = rng(100);
    const x0 = BUILDABLE.i0 * TILE - TILE / 2 - 6, x1 = BUILDABLE.i1 * TILE + TILE / 2 + 6;
    const z0 = BUILDABLE.j0 * TILE - 4, z1 = BUILDABLE.j1 * TILE + TILE + 6;
    const streets = roadRects(town).map(([a, b, c, d]) => [a - 0.3, b - 0.3, c + 0.3, d + 0.3]);
    const square = PROTECTED.map((p) => tilesRect(p.i0, p.j0, p.i1, p.j1));
    const homes = town.homes.filter((h) => h.i != null);
    const civic = (town.civic || []).map((c) => { const { ex, ez } = extents(c); return tilesRect(c.i, c.j, c.i + ex - 1, c.j + ez - 1); });
    const open = (x, z) => {
      for (const q of streets) if (x > q[0] && x < q[2] && z > q[1] && z < q[3]) return false;
      for (const q of square) if (x > q[0] && x < q[2] && z > q[1] && z < q[3]) return false;
      for (const q of civic) if (x > q[0] && x < q[2] && z > q[1] && z < q[3]) return false; // a civic building's grounds
      for (const h of homes) {
        const l = worldToLocal(h, x, z);
        if (Math.abs(l.x) < 8.2 && Math.abs(l.z) < 6.2) return false; // the room
        if (Math.abs(l.x) < 1.4 && l.z > 4.5 && l.z < 8.2) return false; // the front path
      }
      return Math.hypot((x - 26) / 16, (z + 36) / 10) > 1; // the pond
    };
    // Each tuft is a little clump of three splayed blades rather than a single spike.
    const blades = [[0, 0, 0.42, 0.07], [0.06, 2.1, 0.32, 0.055], [0.06, 4.2, 0.36, 0.05]].map(([off, a, h, rad]) => {
      const b = new THREE.ConeGeometry(rad, h, 3);
      b.translate(0, h / 2, 0);
      b.rotateZ(off ? 0.32 : 0.08);
      b.rotateY(a);
      b.translate(Math.cos(a) * off, 0, -Math.sin(a) * off);
      return b;
    });
    const area = (x1 - x0) * (z1 - z0);
    const count = Math.round(area * 0.16);
    const fcount = Math.round(area * 0.045);
    const tufts = new THREE.InstancedMesh(mergeGeometries(blades), addWind(new THREE.MeshStandardMaterial({ color: TUFT, flatShading: true, roughness: 1 })), count);
    const flowerGeo = new THREE.IcosahedronGeometry(0.08, 0);
    flowerGeo.translate(0, 0.32, 0);
    const flowers = new THREE.InstancedMesh(flowerGeo, addWind(new THREE.MeshStandardMaterial({ flatShading: true, roughness: 0.8 }), 0.08), fcount);
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const sc = new THREE.Vector3();
    const p = new THREE.Vector3();
    const color = new THREE.Color();
    const up = new THREE.Vector3(0, 1, 0);
    let placed = 0;
    for (let tries = 0; placed < count && tries < count * 3; tries++) {
      const x = x0 + r() * (x1 - x0), z = z0 + r() * (z1 - z0);
      if (!open(x, z)) continue;
      q.setFromAxisAngle(up, r() * Math.PI);
      sc.setScalar(0.7 + r() * 0.8);
      tufts.setMatrixAt(placed, m.compose(p.set(x, 0, z), q, sc));
      tufts.setColorAt(placed++, color.setScalar(0.82 + r() * 0.3)); // light and dark clumps
    }
    tufts.count = placed;
    placed = 0;
    for (let tries = 0; placed < fcount && tries < fcount * 4; tries++) {
      const x = x0 + r() * (x1 - x0), z = z0 + r() * (z1 - z0);
      if (!open(x, z)) continue;
      sc.setScalar(0.8 + r() * 0.6);
      flowers.setMatrixAt(placed, m.compose(p.set(x, 0, z), q.identity(), sc));
      flowers.setColorAt(placed++, color.setHex(PALETTE.flowers[Math.floor(r() * PALETTE.flowers.length)]));
    }
    flowers.count = placed;
    tufts.receiveShadow = flowers.receiveShadow = true;
    this.meadow = new THREE.Group();
    this.meadow.add(tufts, flowers);
    this.group.add(this.meadow);
  }

  /** One name sign per street (names are the player's, renamed in town planning). */
  setStreetLabels(town) {
    this.streetLabels ??= new Map();
    const streets = new Map();
    for (const r of town.roads) if (!streets.has(r.streetId)) streets.set(r.streetId, r);
    for (const [id, label] of this.streetLabels) if (!streets.has(id)) { label.removeFromParent(); label.element.remove(); this.streetLabels.delete(id); }
    for (const [id, r] of streets) {
      let label = this.streetLabels.get(id);
      if (!label) {
        const el = document.createElement('button');
        el.type = 'button';
        el.className = 'street-sign';
        el.dataset.streetId = id;
        label = new CSS2DObject(el);
        this.group.add(label);
        this.streetLabels.set(id, label);
      }
      // Each sign sits at its street's west or north end (Main Street's at the town square end).
      const c = tileCenter(r.i0, r.j0);
      const across = r.i0 === r.i1 && r.j0 !== r.j1;
      label.position.set(c.x + (across ? 3.2 : 0), 2.6, c.z - (across ? 0 : 3.2));
      if (label.element.textContent !== r.name) label.element.textContent = r.name;
      label.element.title = `${r.name} · rename in Plan town`;
    }
  }

  update(dt, t, night) {
    wind.value = t;
    for (const lamp of this.lamps) {
      if (lamp.userData.nightPool) lamp.material.opacity = night * lamp.userData.nightPool;
      else lamp.material.emissiveIntensity = night * lamp.userData.nightGlow;
    }
    for (const c of this.clouds) {
      c.position.x += c.userData.speed * dt;
      if (c.position.x > 170) c.position.x = -90;
    }
    this.cloudMat.color.setScalar(1 - night * 0.75);
    this.cloudMat.emissiveIntensity = 0.15 * (1 - night);
  }
}

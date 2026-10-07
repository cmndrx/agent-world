// The neighborhood around the lots: terrain, hills, streets, lamps, grass, flowers, clouds.

import * as THREE from 'three';
import { CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { LOT_D, LOT_W } from './lot.js';
import { PALETTE, box, buildLampPost, buildTree, ico, mat, mergeStatic, rng } from './models.js';

const wind = { value: 0 };
export const DEFAULT_STREETS = ['Main Street', 'Oak Avenue', 'Maple Lane', 'Cedar Road', 'Willow Way', 'Birch Boulevard', 'Elm Court'];

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
    this.rows = 0;
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
      const rolling = THREE.MathUtils.smoothstep(dist, 100, 180); // flat through the groves and pond, hills beyond
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
      const d = 150 + r() * 60;
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

  /** Streets, sidewalks, lamps, grass and flowers for each row of lots. */
  ensureRows(rows) {
    for (let row = this.rows; row < rows; row++) this.buildRow(row);
    this.rows = Math.max(this.rows, rows);
  }

  buildRow(row) {
    const r = rng(100 + row);
    const z = row * LOT_D + LOT_D / 2;
    const x0 = -LOT_W * 1.5 - 14; // reaches past the town square on the left
    const x1 = LOT_W * 4.5 + 14; // reaches past downtown on the right
    const len = x1 - x0;
    const cx = (x0 + x1) / 2;
    const street = new THREE.Group();

    const flat = (m) => ((m.castShadow = false), m);
    street.add(flat(box(len, 0.08, 5.2, PALETTE.asphalt, cx, -0.02, z, { roughness: 0.9 })));
    for (const side of [-1, 1]) {
      street.add(flat(box(len, 0.16, 1.7, PALETTE.sidewalk, cx, 0.02, z + side * 3.45)));
      street.add(box(len, 0.2, 0.18, PALETTE.curb, cx, 0.04, z + side * 2.6));
    }
    // Sidewalk joints and lane dashes.
    for (let x = x0; x < x1; x += 1.7) {
      for (const side of [-1, 1]) street.add(flat(box(0.04, 0.17, 1.7, PALETTE.curb, x, 0.025, z + side * 3.45)));
    }
    for (let x = x0 + 1; x < x1; x += 4) street.add(flat(box(1.8, 0.09, 0.16, PALETTE.roadLine, x, -0.01, z)));
    // Crosswalk stripes in front of each lot's path.
    for (let col = 0; col < 3; col++) {
      for (let k = -3; k <= 3; k++) street.add(flat(box(0.5, 0.09, 4.2, PALETTE.roadLine, col * LOT_W + LOT_W / 2 + k * 0.85, -0.005, z)));
    }
    this.group.add(mergeStatic(street));

    // Lamp posts along the lot-side sidewalk (bulbs glow at night).
    for (let x = x0 + 6; x < x1; x += 13) {
      const lamp = buildLampPost(x, z - 3.9);
      this.group.add(lamp);
      lamp.traverse((o) => (o.userData.nightGlow || o.userData.nightPool) && this.lamps.push(o));
    }

    // Instanced grass tufts and flowers on the open ground beside and behind lots.
    // Each tuft is a little clump of three splayed blades rather than a single spike.
    const blades = [[0, 0, 0.42, 0.07], [0.06, 2.1, 0.32, 0.055], [0.06, 4.2, 0.36, 0.05]].map(([off, a, h, r]) => {
      const b = new THREE.ConeGeometry(r, h, 3);
      b.translate(0, h / 2, 0);
      b.rotateZ(off ? 0.32 : 0.08);
      b.rotateY(a);
      b.translate(Math.cos(a) * off, 0, -Math.sin(a) * off);
      return b;
    });
    const tuftGeo = mergeGeometries(blades);
    const tuftMat = addWind(new THREE.MeshStandardMaterial({ color: TUFT, flatShading: true, roughness: 1 }));
    const count = 900;
    const tufts = new THREE.InstancedMesh(tuftGeo, tuftMat, count);
    const flowerGeo = new THREE.IcosahedronGeometry(0.08, 0);
    flowerGeo.translate(0, 0.32, 0);
    const flowerMat = addWind(new THREE.MeshStandardMaterial({ flatShading: true, roughness: 0.8 }), 0.08);
    const fcount = 260;
    const flowers = new THREE.InstancedMesh(flowerGeo, flowerMat, fcount);
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const s = new THREE.Vector3();
    const p = new THREE.Vector3();
    const color = new THREE.Color();
    const open = (x, zz) => {
      // Avoid rooms (in every lot of this row), the street, and the paths.
      const lx = ((x % LOT_W) + LOT_W) % LOT_W;
      const inLot = (lx < 8.2 || lx > LOT_W - 8.2) && Math.abs(zz - row * LOT_D) < 6.2;
      // This row's street, and the previous row's (the band between rows overlaps it).
      const onStreet = Math.abs(zz - z) < 4.5 || Math.abs(zz - (z - LOT_D)) < 4.5;
      const onPath = (lx < 1.4 || lx > LOT_W - 1.4) && zz - row * LOT_D > 4.5 && zz - row * LOT_D < 11;
      const inDowntown = row === 0 && x > LOT_W * 2.5 - 1 && x < LOT_W * 4.5 + 1 && zz < 10.2;
      return !inLot && !onStreet && !onPath && !inDowntown;
    };
    let placed = 0;
    for (let tries = 0; placed < count && tries < count * 6; tries++) {
      const x = x0 + r() * len;
      const zz = row * LOT_D - LOT_D / 2 + r() * LOT_D;
      if (!open(x, zz)) continue;
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), r() * Math.PI);
      s.setScalar(0.7 + r() * 0.8);
      m.compose(p.set(x, 0, zz), q, s);
      tufts.setMatrixAt(placed, m);
      tufts.setColorAt(placed++, color.setScalar(0.82 + r() * 0.3)); // light and dark clumps
    }
    tufts.count = placed;
    placed = 0;
    for (let tries = 0; placed < fcount && tries < fcount * 8; tries++) {
      const x = x0 + r() * len;
      const zz = row * LOT_D - LOT_D / 2 + r() * LOT_D;
      if (!open(x, zz)) continue;
      s.setScalar(0.8 + r() * 0.6);
      m.compose(p.set(x, 0, zz), q.identity(), s);
      flowers.setMatrixAt(placed, m);
      flowers.setColorAt(placed++, color.setHex(PALETTE.flowers[Math.floor(r() * PALETTE.flowers.length)]));
    }
    flowers.count = placed;
    tufts.receiveShadow = flowers.receiveShadow = true;
    this.group.add(tufts, flowers);

    // Trees at the ends of the street.
    for (let i = 0; i < 8; i++) {
      const left = i % 2 === 0;
      const t = buildTree(500 + row * 20 + i, left ? x0 - 2 - r() * 10 : x1 + 2 + r() * 10, row * LOT_D + (r() - 0.5) * 20);
      this.group.add(t);
    }
  }

  /** Street name signs at the start of each row (names are the user's, from map mode). */
  setStreetNames(names) {
    this.streetLabels ??= [];
    for (let row = 0; row < this.rows; row++) {
      let label = this.streetLabels[row];
      if (!label) {
        const el = document.createElement('div');
        el.className = 'street-sign';
        label = new CSS2DObject(el);
        label.position.set(-LOT_W / 2 + 0.5, 2.6, row * LOT_D + LOT_D / 2 - 3.2);
        this.group.add(label);
        this.streetLabels[row] = label;
      }
      const name = names[row] || DEFAULT_STREETS[row % DEFAULT_STREETS.length];
      if (label.element.textContent !== name) label.element.textContent = name;
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

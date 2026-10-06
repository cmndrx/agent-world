// The world around the neighborhood (simulation layer, scenery only): groves of trees, a pond, parked and
// passing cars, birds, street furniture and a distant skyline. Nothing here reflects agent activity.

import * as THREE from 'three';
import { LOT_D, LOT_W } from './lot.js';
import { PALETTE, box, cyl, ico, mat, mergeStatic, rng } from './models.js';
import { waterMaterial } from './fx.js';

const CAR_COLORS = [0xd94f4f, 0x4f86c6, 0xf2c14e, 0xf4f1ea, 0x334155, 0x5fbf73, 0x9b7ede, 0xef8354];
const STREET_X0 = -LOT_W * 1.5 - 14;
const STREET_X1 = LOT_W * 4.5 + 14;

/** A small low-poly car facing +x. Returns { group, lights }. Parked cars skip the light meshes. */
export function buildCar(color, { lit = true } = {}) {
  const g = new THREE.Group();
  const body = mat(color, { roughness: 0.35, metalness: 0.25 });
  g.add(box(3.6, 0.62, 1.7, 0, 0, 0.62, 0, { material: body }));
  g.add(box(1.9, 0.58, 1.5, 0, -0.25, 1.2, 0, { material: body }));
  g.add(box(1.7, 0.42, 1.52, 0x24324a, -0.25, 1.22, 0, { roughness: 0.15, metalness: 0.4 })); // windows
  g.add(box(3.62, 0.1, 1.72, 0x2a2f3c, 0, 0.36, 0)); // trim
  for (const x of [-1.15, 1.15]) {
    for (const z of [-0.78, 0.78]) {
      const w = cyl(0.36, 0.36, 0.26, 0x1c1f26, 12, x, 0.36, z);
      w.rotation.x = Math.PI / 2;
      g.add(w);
    }
  }
  const lightMat = new THREE.MeshStandardMaterial({ color: 0xfff3d0, emissive: 0xfff0c8, emissiveIntensity: 0.1 });
  const tailMat = new THREE.MeshStandardMaterial({ color: 0xd94f4f, emissive: 0xff3a2a, emissiveIntensity: 0.1 });
  const lights = [];
  if (!lit) {
    for (const z of [-0.55, 0.55]) g.add(box(0.06, 0.16, 0.32, 0xe9e2cc, 1.81, 0.7, z), box(0.06, 0.14, 0.3, 0xa83a30, -1.81, 0.72, z));
    return { group: mergeStatic(g), lights };
  }
  for (const z of [-0.55, 0.55]) {
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.16, 0.32), lightMat);
    head.position.set(1.81, 0.7, z);
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.14, 0.3), tailMat);
    tail.position.set(-1.81, 0.72, z);
    head.userData.dynamic = tail.userData.dynamic = true;
    g.add(head, tail);
  }
  lights.push(lightMat, tailMat);
  return { group: mergeStatic(g), lights };
}

export class Landscape {
  constructor(scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    scene.add(this.group);
    this.rows = 0;
    this.lightMats = [];
    this.parked = []; // [x0, z0, x1, z1] rectangles the avatar can't walk through
    this.buildGroves();
    this.buildPond();
    this.buildSkyline();
    this.buildBirds();
    this.buildTraffic();
  }

  /** Clustered groves on the open land around the neighborhood (instanced: one draw per part). */
  buildGroves() {
    const r = rng(77);
    const noise = (x, z) => Math.sin(x * 0.045 + 1.3) * Math.cos(z * 0.05 - 0.7) + Math.sin(x * 0.11 + z * 0.08) * 0.5;
    const spots = [];
    const tryArea = (x0, x1, z0, z1, n) => {
      for (let i = 0; i < n * 6 && spots.length < 2000; i++) {
        const x = x0 + r() * (x1 - x0);
        const z = z0 + r() * (z1 - z0);
        if (noise(x, z) > 0.35 + r() * 0.3) spots.push([x, z, 0.8 + r() * 0.9, r() < 0.4]);
      }
    };
    tryArea(-110, 190, -95, -20, 220); // north (behind the first row)
    tryArea(-140, -62, -20, 160, 120); // west, past the town square
    tryArea(140, 220, -20, 160, 120); // east, past downtown
    // Keep the pond clear.
    const clear = spots.filter(([x, z]) => Math.hypot((x - 26) / 16, (z + 36) / 10) > 1);
    const trunkGeo = new THREE.CylinderGeometry(0.16, 0.24, 1.6, 6);
    trunkGeo.translate(0, 0.8, 0);
    const roundGeo = new THREE.IcosahedronGeometry(1.25, 0);
    roundGeo.translate(0, 2.4, 0);
    const pineGeo = new THREE.ConeGeometry(1.1, 3.0, 7);
    pineGeo.translate(0, 2.9, 0);
    const trunkMat = mat(PALETTE.trunk);
    const leafMat = mat(PALETTE.leaf);
    const pineMat = mat(PALETTE.leafDark);
    const rounds = clear.filter((s) => !s[3]);
    const pines = clear.filter((s) => s[3]);
    const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, clear.length);
    const crowns = new THREE.InstancedMesh(roundGeo, leafMat, rounds.length);
    const cones = new THREE.InstancedMesh(pineGeo, pineMat, pines.length);
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const s = new THREE.Vector3();
    const p = new THREE.Vector3();
    clear.forEach(([x, z, k], i) => trunks.setMatrixAt(i, m.compose(p.set(x, 0, z), q.setFromAxisAngle(s.set(0, 1, 0), i), s.setScalar(k))));
    rounds.forEach(([x, z, k], i) => crowns.setMatrixAt(i, m.compose(p.set(x, 0, z), q.setFromAxisAngle(s.set(0, 1, 0), i * 1.7), s.set(k, k * (0.85 + (i % 5) * 0.06), k))));
    pines.forEach(([x, z, k], i) => cones.setMatrixAt(i, m.compose(p.set(x, 0, z), q.setFromAxisAngle(s.set(0, 1, 0), i), s.setScalar(k * 1.1))));
    for (const mesh of [trunks, crowns, cones]) {
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      this.group.add(mesh);
    }
  }

  /** A pond north of the homes, with stones and reeds. */
  buildPond() {
    const g = new THREE.Group();
    const water = cyl(1, 1, 0.06, 0, 28, 0, 0.06, 0, { material: waterMaterial() });
    water.scale.set(14, 1, 8);
    water.castShadow = false;
    g.add(water);
    const bank = cyl(1, 1, 0.08, 0xc9b98f, 28, 0, 0.03, 0);
    bank.scale.set(15.2, 1, 9.1);
    bank.castShadow = false;
    g.add(bank);
    const r = rng(5);
    for (let i = 0; i < 26; i++) {
      const a = (i / 26) * Math.PI * 2;
      const x = Math.cos(a) * 15 + (r() - 0.5);
      const z = Math.sin(a) * 9 + (r() - 0.5);
      if (i % 3) {
        const stone = ico(0.3 + r() * 0.35, 0x9aa0a8, x, 0.15, z);
        stone.scale.y = 0.6;
        g.add(stone);
      } else {
        for (let k = 0; k < 5; k++) g.add(cyl(0.02, 0.03, 0.9 + r() * 0.6, PALETTE.leafDark, 4, x + (r() - 0.5) * 0.6, 0.5, z + (r() - 0.5) * 0.6));
      }
    }
    // A little jetty.
    g.add(box(1.2, 0.12, 4.5, PALETTE.woodMid, 8, 0.3, 6.8));
    for (const [x, z] of [[7.5, 5], [8.5, 5], [7.5, 8.6], [8.5, 8.6]]) g.add(cyl(0.08, 0.08, 0.8, PALETTE.wood, 6, x, 0.1, z));
    mergeStatic(g);
    g.position.set(26, 0, -36);
    this.group.add(g);
  }

  /** Low, hazy city blocks far to the east; their windows light up at night. */
  buildSkyline() {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const x = c.getContext('2d');
    x.fillStyle = '#000';
    x.fillRect(0, 0, 64, 64);
    const r = rng(31);
    for (let i = 0; i < 8; i++) {
      for (let j = 0; j < 8; j++) {
        if (r() < 0.55) {
          x.fillStyle = `rgba(255,${190 + Math.floor(r() * 50)},120,1)`;
          x.fillRect(i * 8 + 2, j * 8 + 2, 4, 4);
        }
      }
    }
    const windows = new THREE.CanvasTexture(c);
    windows.colorSpace = THREE.SRGBColorSpace;
    windows.wrapS = windows.wrapT = THREE.RepeatWrapping;
    const m = new THREE.MeshStandardMaterial({ color: 0x8fa2bf, roughness: 0.9, emissive: 0xffffff, emissiveMap: windows, emissiveIntensity: 0, flatShading: true });
    m.userData.skyline = true;
    this.skylineMat = m;
    const g = new THREE.Group();
    for (let i = 0; i < 34; i++) {
      const h = 14 + r() * 48;
      const w = 8 + r() * 10;
      const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, w * (0.7 + r() * 0.6)), m);
      b.position.set(250 + r() * 70, h / 2 - 1, -100 + i * 8 + r() * 6);
      g.add(b);
    }
    mergeStatic(g);
    this.group.add(g);
  }

  /** A small flock that crosses the sky every so often during the day. */
  buildBirds() {
    const geo = new THREE.BufferGeometry();
    // Two wings as thin triangles, joined at the body.
    geo.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, -0.5, 0, 0.55, 0.15, 0, 0.05, 0, 0, 0, -0.5, 0, -0.55, 0.15, 0, -0.05], 3));
    geo.computeVertexNormals();
    this.birds = new THREE.InstancedMesh(geo, new THREE.MeshBasicMaterial({ color: 0x2a2f3c, side: THREE.DoubleSide }), 9);
    this.birds.frustumCulled = false;
    this.birds.visible = false;
    this.flock = { t: -20, from: new THREE.Vector3(), dir: new THREE.Vector3() };
    this.group.add(this.birds);
  }

  /** One car that drives main street slowly, and parked cars along every street. */
  buildTraffic() {
    const car = buildCar(0x4f86c6);
    this.driver = { car: car.group, x: STREET_X0, z: LOT_D / 2 - 1.3, speed: 5 };
    this.lightMats.push(...car.lights);
    this.group.add(car.group);
  }

  /** Parked cars and street furniture for each row (called as rows are added). */
  ensureRows(rows) {
    for (let row = this.rows; row < rows; row++) {
      const r = rng(900 + row);
      const z = row * LOT_D + LOT_D / 2;
      const g = new THREE.Group();
      // Parked along the far curb, clear of the crosswalks in front of each home.
      for (let x = STREET_X0 + 8; x < STREET_X1 - 6; x += 7 + r() * 9) {
        const nearCrossing = [0, 1, 2].some((c) => Math.abs(x - (c * LOT_W + LOT_W / 2)) < 4.5);
        if (nearCrossing || r() < 0.35) continue;
        const { group } = buildCar(CAR_COLORS[Math.floor(r() * CAR_COLORS.length)], { lit: false }); // parked: lights off
        group.position.set(x, 0, z + 1.75);
        group.rotation.y = r() < 0.5 ? 0 : Math.PI;
        g.add(group);
        this.parked.push([x - 1.9, z + 0.8, x + 1.9, z + 2.7]);
      }
      // Hydrants on the lot-side sidewalk, benches and bins by the crossings.
      for (let c = 0; c < 3; c++) {
        const hx = c * LOT_W - 6;
        g.add(cyl(0.12, 0.14, 0.55, 0xd94f4f, 8, hx, 0.35, z - 2.9), ico(0.13, 0xd94f4f, hx, 0.66, z - 2.9));
        const bx = c * LOT_W + LOT_W / 2 + 4;
        g.add(box(1.4, 0.08, 0.45, PALETTE.woodMid, bx, 0.55, z + 4.0), box(1.4, 0.4, 0.06, PALETTE.woodMid, bx, 0.82, z + 4.2));
        for (const dx of [-0.6, 0.6]) g.add(box(0.06, 0.5, 0.45, PALETTE.dark, bx + dx, 0.3, z + 4.0));
        g.add(cyl(0.22, 0.2, 0.7, 0x3f8a4f, 10, bx + 1.3, 0.42, z + 4.0));
      }
      if (row === 0) {
        // Bus stop at the start of main street.
        const sx = LOT_W * 2.5 + 2;
        g.add(box(3.0, 0.1, 1.3, 0x34405a, sx, 2.5, z + 4.1));
        for (const dx of [-1.4, 1.4]) g.add(box(0.08, 2.4, 0.08, 0x34405a, sx + dx, 1.25, z + 4.6));
        g.add(box(2.8, 1.8, 0.05, 0x9fc6e0, sx, 1.3, z + 4.7, { roughness: 0.1, metalness: 0.3 }));
        g.add(box(2.2, 0.08, 0.4, PALETTE.woodMid, sx, 0.55, z + 4.4));
        g.add(cyl(0.05, 0.05, 2.6, PALETTE.metal, 6, sx - 2, 1.3, z + 3.6), box(0.6, 0.6, 0.05, 0x4f86c6, sx - 2, 2.5, z + 3.6));
      }
      mergeStatic(g);
      this.group.add(g);
    }
    this.rows = Math.max(this.rows, rows);
  }

  /** Avatar collision with parked cars (null when not near one). */
  blockedAt(x, z) {
    return this.parked.some((r) => x > r[0] && x < r[2] && z > r[1] && z < r[3]) ? true : null;
  }

  update(dt, t, night, avatarPos) {
    // Passing car: slows and waits if your avatar is just ahead in its lane.
    const d = this.driver;
    const ahead = avatarPos && avatarPos.x > d.x + 1 && avatarPos.x < d.x + 7 && Math.abs(avatarPos.z - d.z) < 1.6;
    const target = ahead ? 0 : 5;
    d.speed += (target - d.speed) * Math.min(1, dt * 2.5);
    d.x += d.speed * dt;
    if (d.x > STREET_X1 + 10) d.x = STREET_X0 - 10;
    d.car.position.set(d.x, 0, d.z);
    this.lightMats[0].emissiveIntensity = 0.1 + night * 2.4; // the passing car's headlights
    this.lightMats[1].emissiveIntensity = 0.1 + night * 1.6; // and tail lights
    if (this.skylineMat) this.skylineMat.emissiveIntensity = night * 0.9;

    // Birds: a flock every ~45 s by day, gliding across with flapping wings.
    const f = this.flock;
    if (night > 0.5) {
      this.birds.visible = false;
      return;
    }
    if (t - f.t > 45) {
      f.t = t;
      const a = Math.random() * Math.PI * 2;
      f.from.set(LOT_W + Math.cos(a) * 140, 22 + Math.random() * 8, LOT_D + Math.sin(a) * 140);
      f.dir.set(-Math.cos(a), 0, -Math.sin(a));
    }
    const k = t - f.t;
    this.birds.visible = k < 30;
    if (!this.birds.visible) return;
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.atan2(-f.dir.z, f.dir.x));
    const s = new THREE.Vector3();
    const p = new THREE.Vector3();
    for (let i = 0; i < 9; i++) {
      const row = Math.ceil(i / 2);
      const side = i % 2 ? 1 : -1;
      p.copy(f.from).addScaledVector(f.dir, k * 10 - row * 1.6);
      p.x += side * row * 1.4 * -f.dir.z;
      p.z += side * row * 1.4 * f.dir.x;
      p.y += Math.sin(t * 0.8 + i) * 0.3;
      const flap = 0.4 + Math.abs(Math.sin(t * 7 + i * 0.7)) * 0.8;
      this.birds.setMatrixAt(i, m.compose(p, q, s.set(1.4, flap, 1.4)));
    }
    this.birds.instanceMatrix.needsUpdate = true;
  }
}

// Decor models for build mode. Each builder returns a group standing on the floor at the origin,
// with its front facing +z. Glowing parts are flagged `userData.nightGlow` and swaying canopies are
// named "canopy", so the lot can light and animate them like its own furniture.
// The catalog itself (names, footprints, where items may go) lives in shared/style.mjs.

import * as THREE from 'three';
import { buildFloorLamp, buildRug, buildSideTable } from './furniture.js';
import { PALETTE, box, buildBush, buildTree, cyl, ico, mat, mergeStatic, rng, softBox } from './models.js';
import { waterMaterial } from './fx.js';

const glow = (color, nightGlow, base = 0.25) => {
  const m = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: base, roughness: 0.4 });
  return { material: m, nightGlow, base };
};

function glowMesh(geometry, g, x, y, z) {
  const mesh = new THREE.Mesh(geometry, g.material);
  mesh.position.set(x, y, z);
  mesh.userData.dynamic = true;
  mesh.userData.nightGlow = g.nightGlow;
  mesh.userData.dayGlow = g.base;
  return mesh;
}

function pot(g, color = PALETTE.pot, r = 0.2, h = 0.38) {
  g.add(cyl(r, r * 0.78, h, color, 10, 0, h / 2, 0));
  g.add(cyl(r * 0.92, r * 0.92, 0.03, 0x5a4030, 10, 0, h, 0));
  return h;
}

const BUILDERS = {
  fern(g) {
    const h = pot(g);
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2;
      const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.62, 4), mat(i % 2 ? PALETTE.leaf : PALETTE.leafLight));
      leaf.castShadow = true;
      leaf.position.set(Math.cos(a) * 0.14, h + 0.26, Math.sin(a) * 0.14);
      leaf.rotation.set(Math.sin(a) * 0.75, 0, -Math.cos(a) * 0.75);
      g.add(leaf);
    }
  },
  monstera(g) {
    const h = pot(g, PALETTE.potAlt, 0.26, 0.45);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + 0.3;
      g.add(cyl(0.012, 0.012, 0.5, PALETTE.leafDark, 4, Math.cos(a) * 0.08, h + 0.25, Math.sin(a) * 0.08));
      const leaf = ico(0.24, i % 2 ? PALETTE.leaf : PALETTE.leafDark, Math.cos(a) * 0.26, h + 0.5 + (i % 3) * 0.08, Math.sin(a) * 0.26);
      leaf.scale.set(1, 0.25, 0.8);
      leaf.rotation.set(0.3, a, 0.4);
      g.add(leaf);
    }
  },
  cactus(g) {
    const h = pot(g, 0xe9c46a, 0.17, 0.3);
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.1, 0.4, 4, 10), mat(0x4f9d5a));
    body.castShadow = true;
    body.position.y = h + 0.3;
    g.add(body);
    for (const s of [1, -1]) {
      const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.055, 0.14, 4, 8), mat(0x4f9d5a));
      arm.castShadow = true;
      arm.position.set(s * 0.14, h + 0.36 + (s > 0 ? 0.08 : 0), 0);
      g.add(arm);
    }
    g.add(ico(0.04, 0xff8fab, 0, h + 0.62, 0));
  },
  bonsai(g) {
    g.add(box(0.5, 0.5, 0.5, PALETTE.wood, 0, 0.25, 0));
    g.add(box(0.36, 0.08, 0.24, 0x3b4256, 0, 0.54, 0));
    g.add(cyl(0.03, 0.05, 0.22, PALETTE.trunk, 6, 0.03, 0.68, 0));
    for (const [x, y, s] of [[-0.08, 0.82, 0.13], [0.1, 0.86, 0.11], [0.02, 0.92, 0.1]]) g.add(ico(s, PALETTE.leafDark, x, y, 0, 0));
  },
  floor_lamp(g) {
    const lamp = buildFloorLamp();
    g.add(lamp.group);
  },
  lantern(g) {
    g.add(cyl(0.05, 0.07, 1.0, PALETTE.dark, 6, 0, 0.5, 0));
    g.add(box(0.26, 0.04, 0.26, PALETTE.dark, 0, 1.02, 0));
    g.add(glowMesh(new THREE.BoxGeometry(0.2, 0.26, 0.2), glow(0xffd28a, 2.6, 0.1), 0, 1.17, 0));
    g.add(cyl(0, 0.18, 0.12, PALETTE.dark, 4, 0, 1.36, 0));
  },
  round_rug(g, r) {
    const colors = [0xe8a598, 0x9fc4e6, 0xf0d58f, 0xc7b8e6];
    const c = colors[Math.floor(r() * colors.length)];
    for (const [rad, color, y] of [[1.1, c, 0.135], [0.85, 0xf6efe4, 0.137], [0.6, c, 0.139]]) {
      const m = cyl(rad, rad, 0.02, color, 24, 0, y, 0);
      m.castShadow = false;
      g.add(m);
    }
  },
  runner_rug(g, r) {
    g.add(buildRug(3, 1, [0x6f87b8, 0xd98b62, 0x5fbf73][Math.floor(r() * 3)], 0, 0));
  },
  armchair(g, r) {
    const c = [0xd98b62, 0x6c8ebf, 0x5fbf73, 0x9b7ede][Math.floor(r() * 4)];
    const dark = new THREE.Color(c).multiplyScalar(0.8).getHex();
    g.add(softBox(0.9, 0.32, 0.85, dark, 0, 0.26, 0, 0.1));
    g.add(softBox(0.62, 0.14, 0.62, c, 0, 0.48, 0.06, 0.1));
    g.add(softBox(0.9, 0.62, 0.22, dark, 0, 0.62, -0.32, 0.08));
    for (const s of [1, -1]) g.add(softBox(0.18, 0.46, 0.85, dark, s * 0.36, 0.44, 0, 0.06));
  },
  beanbag(g, r) {
    const c = [0xef8354, 0xe9c46a, 0x3fb7b0, 0xe56b8a][Math.floor(r() * 4)];
    const bag = ico(0.45, c, 0, 0.3, 0, 1);
    bag.scale.set(1, 0.62, 1);
    g.add(bag);
    const dent = ico(0.3, new THREE.Color(c).multiplyScalar(0.88).getHex(), 0, 0.46, 0.04, 1);
    dent.scale.set(1, 0.4, 1);
    g.add(dent);
  },
  bench(g) {
    for (let i = 0; i < 3; i++) g.add(box(1.6, 0.05, 0.14, PALETTE.woodMid, 0, 0.46, -0.18 + i * 0.18));
    for (let i = 0; i < 2; i++) g.add(box(1.6, 0.12, 0.04, PALETTE.woodMid, 0, 0.72 + i * 0.16, -0.27));
    for (const s of [1, -1]) {
      g.add(box(0.06, 0.46, 0.5, PALETTE.dark, s * 0.7, 0.23, 0));
      g.add(box(0.06, 0.5, 0.06, PALETTE.dark, s * 0.7, 0.72, -0.27));
    }
  },
  side_table(g) {
    g.add(buildSideTable());
  },
  low_shelf(g, r) {
    g.add(box(1.3, 0.9, 0.42, PALETTE.shelf, 0, 0.45, 0));
    g.add(box(1.22, 0.04, 0.38, PALETTE.wood, 0, 0.46, 0.03));
    for (const y of [0.1, 0.5]) {
      let x = -0.56;
      while (x < 0.52) {
        const w = 0.05 + r() * 0.05;
        const h = 0.25 + r() * 0.1;
        g.add(box(w, h, 0.28, PALETTE.books[Math.floor(r() * PALETTE.books.length)], x + w / 2, y + h / 2, 0.04));
        x += w + 0.012;
      }
    }
    g.add(ico(0.1, PALETTE.leaf, 0.45, 1.0, 0));
  },
  aquarium(g, r) {
    g.add(box(1.2, 0.7, 0.5, PALETTE.dark, 0, 0.35, 0));
    const water = new THREE.Mesh(new THREE.BoxGeometry(1.14, 0.56, 0.44), new THREE.MeshStandardMaterial({ color: 0x5ab4e6, transparent: true, opacity: 0.55, roughness: 0.1, emissive: 0x2a7fb8, emissiveIntensity: 0.25 }));
    water.position.y = 0.98;
    g.add(water);
    g.add(box(1.2, 0.04, 0.5, PALETTE.dark, 0, 1.28, 0));
    g.add(box(1.1, 0.06, 0.4, 0xe9c46a, 0, 0.73, 0));
    for (let i = 0; i < 4; i++) {
      const fish = ico(0.045, [0xff8c42, 0xffd166, 0xef476f, 0x06d6a0][i], -0.4 + i * 0.26 + r() * 0.1, 0.88 + r() * 0.3, -0.1 + r() * 0.2);
      fish.scale.set(1.5, 1, 0.6);
      g.add(fish);
    }
    g.add(cyl(0.02, 0.02, 0.3, PALETTE.leaf, 4, -0.45, 0.88, 0));
    g.add(cyl(0.02, 0.02, 0.24, PALETTE.leafLight, 4, 0.4, 0.86, 0.05));
  },
  arcade(g, r) {
    const c = [0x5b6cf9, 0xe63946, 0x8b5cf6][Math.floor(r() * 3)];
    g.add(softBox(0.8, 1.7, 0.7, c, 0, 0.85, 0, 0.04));
    g.add(box(0.7, 0.1, 0.25, PALETTE.dark, 0, 1.05, 0.38));
    for (const [x, col] of [[-0.15, 0xef476f], [0, 0xffd166], [0.15, 0x06d6a0]]) g.add(cyl(0.03, 0.03, 0.04, col, 10, x, 1.12, 0.42));
    g.add(glowMesh(new THREE.BoxGeometry(0.6, 0.45, 0.02), glow(0x7fd3ff, 1.6, 0.8), 0, 1.4, 0.36));
    g.add(glowMesh(new THREE.BoxGeometry(0.7, 0.14, 0.02), glow(0xffd166, 1.6, 0.9), 0, 1.78, 0.36));
  },
  record_player(g) {
    g.add(softBox(0.8, 0.62, 0.5, PALETTE.woodMid, 0, 0.31, 0, 0.03));
    g.add(box(0.7, 0.06, 0.44, PALETTE.dark, 0, 0.65, 0));
    g.add(cyl(0.17, 0.17, 0.015, 0x111111, 24, -0.08, 0.69, 0));
    g.add(cyl(0.05, 0.05, 0.02, 0xe63946, 12, -0.08, 0.7, 0));
    const arm = box(0.02, 0.02, 0.22, PALETTE.metal, 0.18, 0.72, -0.02);
    arm.rotation.y = 0.5;
    g.add(arm);
    for (let i = 0; i < 4; i++) g.add(box(0.03, 0.28, 0.28, PALETTE.books[i], -0.3 + i * 0.05, 0.3, 0.12));
  },
  guitar(g) {
    g.add(box(0.3, 0.04, 0.3, PALETTE.dark, 0, 0.02, 0));
    g.add(cyl(0.02, 0.02, 0.5, PALETTE.dark, 6, 0, 0.25, -0.08));
    const wood = 0xc8833f;
    const lower = ico(0.2, wood, 0, 0.42, 0, 1);
    lower.scale.z = 0.35;
    const upper = ico(0.15, wood, 0, 0.66, 0, 1);
    upper.scale.z = 0.35;
    g.add(lower, upper);
    const hole = cyl(0.05, 0.05, 0.02, 0x2a1a10, 12, 0, 0.6, 0.06);
    hole.rotation.x = Math.PI / 2;
    g.add(hole);
    g.add(box(0.06, 0.6, 0.04, 0x5a3a22, 0, 1.05, 0));
    g.add(box(0.1, 0.14, 0.05, 0x2a1a10, 0, 1.4, 0));
  },
  snack_fridge(g) {
    g.add(softBox(0.7, 1.15, 0.65, 0xf4f1ea, 0, 0.575, 0, 0.05));
    g.add(glowMesh(new THREE.BoxGeometry(0.56, 0.9, 0.02), glow(0xcfe9ff, 0.9, 0.25), 0, 0.62, 0.33));
    for (let row = 0; row < 3; row++) {
      for (let i = 0; i < 4; i++) g.add(cyl(0.035, 0.035, 0.14, PALETTE.books[(row * 4 + i) % PALETTE.books.length], 8, -0.18 + i * 0.12, 0.32 + row * 0.27, 0.22));
    }
    g.add(box(0.04, 0.3, 0.04, PALETTE.metal, 0.26, 0.8, 0.36));
  },
  tree_round(g, r, seed) {
    g.add(buildTree(seed, 0, 0, 'round'));
  },
  tree_pine(g, r, seed) {
    g.add(buildTree(seed, 0, 0, 'pine'));
  },
  bush(g) {
    g.add(buildBush(0, 0, 1));
  },
  flower_patch(g, r) {
    g.add(box(1.2, 0.12, 0.8, 0x6b4a33, 0, 0.06, 0));
    for (let i = 0; i < 12; i++) {
      const x = -0.5 + (i % 4) * 0.33 + (r() - 0.5) * 0.08;
      const z = -0.25 + Math.floor(i / 4) * 0.25;
      g.add(cyl(0.015, 0.015, 0.26, PALETTE.leafDark, 4, x, 0.24, z));
      g.add(ico(0.08, PALETTE.flowers[Math.floor(r() * PALETTE.flowers.length)], x, 0.4, z));
    }
  },
  gnome(g) {
    g.add(cyl(0.12, 0.16, 0.3, 0x4f86c6, 10, 0, 0.15, 0));
    g.add(ico(0.1, 0xf5d0b0, 0, 0.36, 0, 1));
    const beard = cyl(0, 0.11, 0.16, 0xffffff, 10, 0, 0.28, 0.05);
    beard.rotation.x = Math.PI;
    g.add(beard);
    g.add(cyl(0, 0.11, 0.3, 0xe63946, 10, 0, 0.56, 0));
    g.add(ico(0.03, 0xf2a58f, 0, 0.36, 0.1));
  },
  bird_bath(g) {
    g.add(cyl(0.18, 0.24, 0.08, 0xd8d2c6, 12, 0, 0.04, 0));
    g.add(cyl(0.08, 0.1, 0.6, 0xd8d2c6, 10, 0, 0.38, 0));
    g.add(cyl(0.34, 0.2, 0.12, 0xd8d2c6, 16, 0, 0.72, 0));
    const water = cyl(0.29, 0.29, 0.01, 0x7fc4ec, 16, 0, 0.78, 0, { material: waterMaterial() });
    water.castShadow = false;
    g.add(water);
    g.add(ico(0.05, 0x8b5e3c, 0.2, 0.84, 0.05));
  },
  garden_bed(g) {
    // Raised bed: plank frame around dark soil (top at y 0.2). Crops are added by garden.js.
    g.add(box(1.32, 0.16, 0.92, 0x4a3222, 0, 0.11, 0));
    for (const z of [-0.48, 0.48]) g.add(box(1.4, 0.24, 0.07, PALETTE.woodMid, 0, 0.12, z));
    for (const x of [-0.67, 0.67]) g.add(box(0.07, 0.24, 0.9, PALETTE.woodMid, x, 0.12, 0));
    for (const [x, z] of [[-0.67, -0.48], [0.67, -0.48], [-0.67, 0.48], [0.67, 0.48]]) g.add(box(0.1, 0.28, 0.1, PALETTE.wood, x, 0.14, z));
  },
  // ---- Grown in a garden bed ----
  veg_crate(g) {
    g.add(box(0.66, 0.06, 0.46, PALETTE.woodLight, 0, 0.03, 0));
    for (const z of [-0.21, 0.21]) g.add(box(0.66, 0.2, 0.04, PALETTE.woodLight, 0, 0.14, z));
    for (const x of [-0.31, 0.31]) g.add(box(0.04, 0.2, 0.42, PALETTE.woodMid, x, 0.14, 0));
    for (let i = 0; i < 9; i++) g.add(ico(0.075, i % 4 ? 0xe24a3b : 0xf08a3c, -0.2 + (i % 3) * 0.2, 0.2 + (i % 2) * 0.03, -0.12 + Math.floor(i / 3) * 0.12));
  },
  sunflower_vase(g) {
    g.add(cyl(0.11, 0.08, 0.3, 0x5a7d9a, 10, 0, 0.15, 0));
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2;
      const x = Math.cos(a) * 0.06;
      const z = Math.sin(a) * 0.06;
      g.add(cyl(0.01, 0.01, 0.42 + i * 0.06, PALETTE.leafDark, 4, x, 0.5 + i * 0.03, z));
      const head = new THREE.Group();
      head.position.set(x * 2, 0.72 + i * 0.06, z * 2 + 0.03);
      head.rotation.x = Math.PI / 2 - 0.5;
      head.add(cyl(0.085, 0.085, 0.02, 0xf5c518, 10, 0, 0, 0));
      head.add(cyl(0.04, 0.04, 0.03, 0x6b4423, 8, 0, 0.008, 0));
      g.add(head);
    }
  },
  pumpkin_stack(g) {
    const pumpkin = (r, x, y, z, color = 0xec8a2c) => {
      const p = ico(r, color, x, y, z, 1);
      p.scale.y = 0.72;
      g.add(p);
      g.add(cyl(0.015, 0.02, 0.07, 0x6b4423, 5, x, y + r * 0.72 + 0.02, z));
    };
    g.add(box(0.9, 0.12, 0.6, 0xd8c08a, 0, 0.06, 0)); // hay bale
    pumpkin(0.24, -0.22, 0.3, 0);
    pumpkin(0.2, 0.24, 0.27, 0.05, 0xf2a03d);
    pumpkin(0.15, 0.02, 0.58, -0.02, 0xe07a26);
  },
  // ---- Found while exploring ----
  veggie_patch(g) {
    g.add(box(1.2, 0.14, 0.8, 0x5a3d28, 0, 0.07, 0));
    for (let i = 0; i < 8; i++) {
      const x = -0.42 + (i % 4) * 0.28;
      const z = i < 4 ? -0.18 : 0.18;
      if (i % 3 === 0) {
        g.add(cyl(0, 0.06, 0.18, 0xef8354, 6, x, 0.16, z)); // carrot top peeking out
        g.add(cyl(0.01, 0.04, 0.16, PALETTE.leaf, 4, x, 0.3, z));
      } else {
        const head = ico(0.11, i % 2 ? 0x7cc46b : 0x5aae5f, x, 0.22, z);
        head.scale.y = 0.7;
        g.add(head);
      }
    }
    g.add(box(0.05, 0.4, 0.05, PALETTE.wood, 0.55, 0.2, 0.35));
    g.add(box(0.22, 0.14, 0.02, 0xe9c46a, 0.55, 0.38, 0.37));
  },
  blue_tulips(g) {
    pot(g, PALETTE.potAlt, 0.2, 0.32);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      g.add(cyl(0.012, 0.012, 0.36, PALETTE.leafDark, 4, Math.cos(a) * 0.08, 0.5, Math.sin(a) * 0.08));
      const bloom = cyl(0.06, 0.035, 0.1, 0x4f86c6, 6, Math.cos(a) * 0.08, 0.7, Math.sin(a) * 0.08);
      g.add(bloom);
    }
  },
  clover_patch(g, r) {
    for (let i = 0; i < 14; i++) {
      const x = (r() - 0.5) * 0.8;
      const z = (r() - 0.5) * 0.8;
      for (let k = 0; k < (i === 3 ? 4 : 3); k++) {
        const a = (k / (i === 3 ? 4 : 3)) * Math.PI * 2;
        const leaf = ico(0.035, i === 3 ? 0x7cdb5a : 0x3fa34d, x + Math.cos(a) * 0.035, 0.05, z + Math.sin(a) * 0.035);
        leaf.scale.y = 0.3;
        leaf.castShadow = false;
        g.add(leaf);
      }
    }
  },
  crystal_lamp(g) {
    g.add(cyl(0.16, 0.2, 0.08, 0x3b4256, 8, 0, 0.04, 0));
    const big = glowMesh(new THREE.OctahedronGeometry(0.14, 0), glow(0xc77dff, 2.4, 0.9), 0, 0.3, 0);
    big.scale.y = 1.6;
    g.add(big);
    g.add(glowMesh(new THREE.OctahedronGeometry(0.08, 0), glow(0x9fd8ff, 2.4, 0.9), 0.1, 0.2, 0.05));
  },
  golden_gnome(g) {
    const gold = mat(0xffd166, { roughness: 0.25, metalness: 0.7 });
    const m = (geo, x, y, z) => {
      const mesh = new THREE.Mesh(geo, gold);
      mesh.position.set(x, y, z);
      mesh.castShadow = true;
      g.add(mesh);
      return mesh;
    };
    m(new THREE.CylinderGeometry(0.12, 0.16, 0.3, 10), 0, 0.15, 0);
    m(new THREE.IcosahedronGeometry(0.1, 1), 0, 0.36, 0);
    m(new THREE.CylinderGeometry(0, 0.11, 0.3, 10), 0, 0.56, 0);
    const beard = m(new THREE.CylinderGeometry(0, 0.11, 0.16, 10), 0, 0.28, 0.05);
    beard.rotation.x = Math.PI;
  },
  picnic_table(g) {
    for (let i = 0; i < 4; i++) g.add(box(1.8, 0.05, 0.16, PALETTE.woodLight, 0, 0.74, -0.27 + i * 0.18));
    for (const z of [-0.6, 0.6]) g.add(box(1.8, 0.05, 0.26, PALETTE.woodLight, 0, 0.44, z));
    for (const s of [1, -1]) {
      for (const tilt of [1, -1]) {
        const leg = box(0.06, 0.82, 0.06, PALETTE.woodMid, s * 0.7, 0.38, 0);
        leg.rotation.x = tilt * 0.55;
        g.add(leg);
      }
    }
  },
};

/**
 * Build a decor item. Returns { group, glows, canopies } where glows light up at night and
 * canopies sway in the wind.
 */
export function buildDecor(item, seed = 1) {
  const g = new THREE.Group();
  const build = BUILDERS[item];
  if (build) build(g, rng(seed), seed);
  mergeStatic(g);
  const glows = [];
  const canopies = [];
  g.traverse((o) => {
    if (o.userData.nightGlow) glows.push(o);
    if (o.name === 'canopy') canopies.push(o);
  });
  return { group: g, glows, canopies };
}

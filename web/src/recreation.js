// Recreation venues (play layer): parks, an arcade, a cinema and more that the player places on the town grid
// (shared/town.mjs RECREATION). Built with the civic building kit (civic.js), so they share its frame (footprint
// centre, front +z facing the street, door at x = doorX), walk-in halls, lifting roofs and cutaway walls.
// A venue in range meets matching resident interests (shared/home-satisfaction.mjs), and idle residents may visit it
// (web/src/visits.js, flavor only); it never shows or implies agent work.

import * as THREE from 'three';
import { PALETTE, box, cyl, ico } from './models.js';

const PAVING = 0xcfc8bb;
const DARK = 0x3a4150;
const STEEL = 0xb8c3cf;
const WHITE = 0xf7f3ea;
const WOOD = PALETTE.wood ?? 0x9a6b43;
const WOOD_LIGHT = PALETTE.woodLight ?? 0xc89a68;
const LEAF = PALETTE.grassDark ?? 0x6faa57;
const SOIL = 0x5b4332;

/** A cone (point up, or down with `down`), base radius r, height h, base (or tip, when down) at y. */
function cone(r, h, color, x, y, z, segments = 12, down = false) {
  return down ? cyl(r, 0.04, h, color, segments, x, y + h / 2, z) : cyl(0.04, r, h, color, segments, x, y + h / 2, z);
}

/** A striped awning over a door or window: n stripes leaning out from the wall at z. */
function awning(k, x, y, z, w, colors = [0xd94f4f, WHITE], n = 8, depth = 1.6) {
  const g = new THREE.Group();
  g.position.set(x, y, z + depth / 2 - 0.1);
  g.rotation.x = 0.32;
  for (let s = 0; s < n; s++) g.add(box(w / n, 0.08, depth, colors[s % colors.length], -w / 2 + (w / n) * (s + 0.5), 0, 0));
  k.ext.add(g);
}

/** A café table with a parasol (outside) or without (inside). */
function bistro(k, x, z, { where = 'ext', parasol = null, top = WHITE, chairs = 2 } = {}) {
  const y0 = where === 'ext' ? 0 : 0.14;
  const g = new THREE.Group();
  g.position.set(x, y0, z);
  g.add(cyl(0.45, 0.45, 0.06, top, 14, 0, 0.76, 0), cyl(0.05, 0.05, 0.74, DARK, 6, 0, 0.37, 0), cyl(0.28, 0.28, 0.04, DARK, 10, 0, 0.02, 0));
  for (let c = 0; c < chairs; c++) {
    const a = (c / chairs) * Math.PI * 2;
    g.add(cyl(0.2, 0.2, 0.05, DARK, 10, Math.sin(a) * 0.75, 0.48, Math.cos(a) * 0.75), cyl(0.03, 0.03, 0.46, DARK, 5, Math.sin(a) * 0.75, 0.23, Math.cos(a) * 0.75));
  }
  if (parasol) g.add(cyl(0.035, 0.035, 2.2, STEEL, 6, 0, 1.1, 0), cone(1.3, 0.55, parasol, 0, 2.05, 0, 10));
  k[where].add(g);
  return g;
}

/** A low fence of posts and two rails along x (len) or z, at (x, z). Gaps: [{ at, w }] along its length. */
function fence(k, x, z, len, alongX, { color = WHITE, h = 0.9, gaps = [] } = {}) {
  const runs = [];
  let from = -len / 2;
  for (const g of [...gaps].sort((a, b) => a.at - b.at)) { runs.push([from, g.at - g.w / 2]); from = g.at + g.w / 2; }
  runs.push([from, len / 2]);
  for (const [a, b] of runs) {
    if (b - a < 0.2) continue;
    const mid = (a + b) / 2, l = b - a;
    const at = (t) => (alongX ? [x + t, z] : [x, z + t]);
    for (const ry of [h * 0.4, h * 0.85]) {
      const [px, pz] = at(mid);
      k.ext.add(box(alongX ? l : 0.06, 0.07, alongX ? 0.06 : l, color, px, ry, pz));
    }
    for (let t = a; t <= b + 0.01; t += 1.2) {
      const [px, pz] = at(Math.min(t, b));
      k.ext.add(box(0.1, h, 0.1, color, px, h / 2, pz));
    }
  }
}

/** A lamp post whose head glows at night. */
function lamp(k, x, z, h = 3.4) {
  k.ext.add(cyl(0.07, 0.09, h, DARK, 6, x, h / 2, z));
  k.ext.add(k.glow(0.34, 0.34, 0.34, 0xffe2a8, x, h + 0.12, z, 0.15, 0.9));
}

/** A round planter or shrub. */
const shrub = (k, x, z, s = 1, color = LEAF) => k.ext.add(ico(0.7 * s, color, x, 0.55 * s, z, 1));

export const VENUE_BUILD = {
  /** 3 × 3 (24 × 24 m): a loop path for walks, jogs and bike rides, a bandstand, a fenced dog run, a games lawn and a pond. */
  park(k) {
    k.lawn(0x8fcd70);
    // The loop and the path in from the street.
    for (const z of [-5.5, 5.5]) k.ext.add(box(12.8, 0.05, 1.8, PAVING, 0, 0.035, z));
    for (const x of [-5.5, 5.5]) k.ext.add(box(1.8, 0.05, 9.2, PAVING, x, 0.035, 0));
    k.path(0, 6.4, 2.2);
    // Bandstand in the middle.
    k.ext.add(cyl(3, 3.1, 0.35, WOOD_LIGHT, 8, 0, 0.18, 0));
    for (let p = 0; p < 8; p++) {
      const a = (p / 8) * Math.PI * 2 + Math.PI / 8;
      k.ext.add(cyl(0.09, 0.09, 2.7, WHITE, 6, Math.sin(a) * 2.7, 1.7, Math.cos(a) * 2.7));
    }
    k.ext.add(cyl(3.2, 3.2, 0.2, WHITE, 8, 0, 3.1, 0), cone(3.5, 1.7, 0x5f8f4a, 0, 3.2, 0, 8), ico(0.18, 0xe6c84f, 0, 5, 0));
    // Benches facing the loop, and lamps.
    for (const [x, z, ry] of [[-3, 7.4, Math.PI], [3, -7.4, 0], [-7.4, -2.4, Math.PI / 2], [7.4, 2.4, -Math.PI / 2]]) k.bench(x, z, ry);
    for (const [x, z] of [[-4.2, -4.2], [4.2, 4.2], [-4.2, 4.2], [4.2, -4.2]]) lamp(k, x, z, 3);
    // Dog run (back left): a fence with a gate, a hoop, a ramp and a water bowl.
    k.ext.add(box(4.8, 0.03, 4.8, 0xa9c98a, -9, 0.045, -9));
    fence(k, -9, -6.6, 4.8, true, { color: WOOD_LIGHT, gaps: [{ at: 1.2, w: 1.1 }] });
    fence(k, -6.6, -9, 4.8, false, { color: WOOD_LIGHT });
    fence(k, -9, -11.4, 4.8, true, { color: WOOD_LIGHT });
    fence(k, -11.4, -9, 4.8, false, { color: WOOD_LIGHT });
    const hoop = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.06, 6, 16), new THREE.MeshStandardMaterial({ color: 0xe6c84f, roughness: 0.6 }));
    hoop.position.set(-9.8, 0.75, -9.4);
    k.ext.add(hoop, box(0.06, 0.4, 0.06, DARK, -10.35, 0.2, -9.4), box(0.06, 0.4, 0.06, DARK, -9.25, 0.2, -9.4));
    const ramp = box(0.9, 0.08, 2.2, WOOD, -8.2, 0.4, -10.2);
    ramp.rotation.x = 0.35;
    k.ext.add(ramp, cyl(0.25, 0.2, 0.12, 0x4f86c6, 10, -7.4, 0.06, -7.5));
    // Games lawn (back right): two cornhole boards and a frisbee.
    for (const z of [-10.4, -7]) {
      const b = box(0.7, 0.06, 1.3, z < -8 ? 0xd94f4f : 0x4f86c6, 9, 0.28, z);
      b.rotation.x = z < -8 ? 0.4 : -0.4;
      k.ext.add(b);
    }
    k.ext.add(cyl(0.16, 0.16, 0.03, 0xe6c84f, 12, 7.6, 0.06, -8.6));
    // Pond with reeds (front left), a bike rack (front right), trees around the edge.
    k.ext.add(cyl(2.4, 2.4, 0.06, 0x6fb8d8, 20, -8.4, 0.06, 8.2, { roughness: 0.15 }));
    for (const [x, z] of [[-10.3, 7], [-6.6, 9.6], [-9.8, 9.8]]) k.ext.add(cyl(0.03, 0.03, 0.9, 0x4f7f3a, 4, x, 0.45, z));
    k.ext.add(box(3.2, 0.06, 0.08, STEEL, 7.4, 0.7, 9.4));
    for (let n = 0; n < 3; n++) {
      const bike = new THREE.Group();
      bike.position.set(6.4 + n * 1, 0, 9.6);
      bike.rotation.y = Math.PI / 2;
      for (const s of [-0.45, 0.45]) {
        const w = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.04, 6, 14), new THREE.MeshStandardMaterial({ color: DARK, roughness: 0.6 }));
        w.position.set(s, 0.32, 0);
        bike.add(w);
      }
      bike.add(box(0.9, 0.05, 0.05, [0xd94f4f, 0x5fbf73, 0x4f86c6][n], 0, 0.55, 0));
      k.ext.add(bike);
    }
    for (const [x, z, s] of [[-10.6, -2], [-10.4, 2.6, 0.9], [10.6, -2.4, 1.1], [10.4, 3.4], [-2.8, -10.6, 0.9], [2.6, -10.8], [10.6, 10.4, 0.8], [-3.6, 10.4, 0.8]]) k.tree(x, z, s ?? 1);
    k.top = 6;
  },

  /** 2 × 2 (16 × 16 m): a pastel parlour with a scoop counter and freezer case, a patio and a giant cone on the roof. */
  ice_cream(k) {
    const pink = 0xf6c6d6, mint = 0xa8e0c8;
    k.lawn();
    const hz = -2.6, hd = 8, hw = 12;
    k.ext.add(box(9, 0.05, 5.4, PAVING, -1, 0.03, 4.4)); // patio
    k.path(k.doorX, hz + hd / 2, 1.8);
    k.hall({ z: hz, w: hw, d: hd, h: 4, wall: pink, trim: WHITE, floor: 0xf3ede4, roof: mint,
      doors: [{ x: k.doorX, w: 1.6, h: 2.5 }], windows: { front: [-3.5, -0.8], back: [-3, 3], left: [0], right: [-1.5, 1.5] }, winY: 2, winH: 1.6, winW: 1.8 });
    awning(k, -2.2, 3.2, hz + hd / 2, 6, [mint, WHITE]);
    // Checkerboard floor tiles.
    for (let a = 0; a < 6; a++) for (let b = 0; b < 4; b++) if ((a + b) % 2) k.add('inside', box(1.9, 0.02, 1.9, 0xe7b9cb, -hw / 2 + 1 + a * 2, 0.15, hz - hd / 2 + 1 + b * 2));
    // The counter with a glass freezer case of tubs, a till and a cone stand.
    const cz = hz - 1;
    k.add('inside', box(6.4, 1, 0.8, WHITE, -1.5, 0.64, cz), box(6.5, 0.07, 0.9, mint, -1.5, 1.17, cz));
    k.add('inside', box(4.6, 0.45, 0.7, 0xdff3f7, -2.2, 1.43, cz, { roughness: 0.1, transparent: true, opacity: 0.5 }));
    const tubs = [0xf7e7c6, 0x7b4b2e, 0xf3a6c0, 0xa8e0c8, 0xf6d36b, 0xc9a7e8];
    tubs.forEach((c, n) => k.add('inside', box(0.6, 0.18, 0.5, c, -4.1 + n * 0.75, 1.3, cz)));
    k.add('inside', box(0.6, 0.35, 0.45, DARK, 1, 1.38, cz), cone(0.12, 0.35, 0xd8a24a, 0.6 + 1.4, 1.2, cz, 8, true));
    // Menu board behind the counter, a freezer and two little tables.
    k.add('inside', k.glow(4, 1.2, 0.06, 0x3a4150, -1.5, 2.7, hz - hd / 2 + 0.2, 0.05, 0.2));
    for (let n = 0; n < 4; n++) k.add('inside', box(0.7, 0.12, 0.02, tubs[n + 1], -2.6 + n * 0.75, 2.8, hz - hd / 2 + 0.25));
    k.add('inside', box(1.6, 1.8, 0.7, WHITE, 3.8, 1.04, hz - hd / 2 + 0.5));
    bistro(k, 3.2, hz + 1.8, { where: 'inside', top: pink });
    bistro(k, -3.8, hz + 2, { where: 'inside', top: mint });
    // Patio tables with parasols.
    bistro(k, -4, 3.6, { parasol: 0xf3a6c0 });
    bistro(k, -0.6, 5.4, { parasol: mint });
    // The giant cone on the roof (lifts with it).
    k.add('roof', cone(1.1, 2.6, 0xd8a24a, 0, 4.4, hz, 10, true), ico(1.05, 0xf3a6c0, 0, 7.2, hz, 1), ico(0.85, 0xf7e7c6, 0, 8.1, hz, 1), ico(0.16, 0xd94f4f, 0, 8.95, hz));
    k.tree(6, 5.6, 0.8);
    k.top = 9;
  },

  /** 2 × 2 (16 × 16 m): neon facade, rows of glowing cabinets, a claw machine, air hockey and a prize counter. */
  arcade(k) {
    const wall = 0x3b2a63, neonA = 0xff4fd8, neonB = 0x4fe3ff;
    k.lawn(0x8fbf72);
    k.ext.add(box(12, 0.05, 4.6, 0x6c6880, 0, 0.03, 5));
    k.path(k.doorX, 2.4, 1.8);
    const hz = -1.6, hd = 8, hw = 13;
    k.hall({ z: hz, w: hw, d: hd, h: 4.6, wall, trim: 0x2a1f48, floor: 0x26213a, roof: 0x2a1f48,
      doors: [{ x: k.doorX, w: 1.8, h: 2.6 }], windows: { front: [-4.2, -1.4], back: [], left: [0], right: [] }, winColor: neonB, winY: 2.2 });
    // Neon strips along the facade and a glowing marquee.
    k.add('ext', k.glow(hw, 0.14, 0.1, neonA, 0, 4.1, hz + hd / 2 + 0.2, 0.5, 1.2), k.glow(hw, 0.14, 0.1, neonB, 0, 0.5, hz + hd / 2 + 0.2, 0.5, 1.2));
    k.add('ext', box(5.4, 1.1, 0.3, 0x2a1f48, -2.8, 5.2, hz + hd / 2), k.glow(5, 0.7, 0.1, neonA, -2.8, 5.2, hz + hd / 2 + 0.18, 0.4, 1.1));
    // Carpet with a starry pattern.
    for (let n = 0; n < 18; n++) k.add('inside', box(0.16, 0.02, 0.16, [neonA, neonB, 0xe6c84f][n % 3], -5.6 + ((n * 37) % 11), 0.15, hz - 3.2 + ((n * 53) % 7)));
    // Cabinets along the back and left walls.
    const cabinet = (x, z, ry, color) => {
      const g = new THREE.Group();
      g.position.set(x, 0.14, z);
      g.rotation.y = ry;
      g.add(box(0.85, 1.75, 0.75, color, 0, 0.88, 0), box(0.85, 0.3, 0.9, DARK, 0, 1.9, 0.05), box(0.8, 0.12, 0.35, DARK, 0, 1.05, 0.5));
      g.add(k.glow(0.6, 0.48, 0.05, 0x9fd6ff, 0, 1.45, 0.39, 0.35, 0.8), k.glow(0.75, 0.22, 0.05, color, 0, 1.9, 0.52, 0.35, 0.8));
      g.add(ico(0.06, 0xd94f4f, -0.15, 1.15, 0.6), ico(0.05, 0xe6c84f, 0.12, 1.14, 0.6));
      k.inside.add(g);
    };
    [0xd94f4f, 0x4f86c6, 0x5fbf73, 0xe6c84f, 0x9b7ede, neonA].forEach((c, n) => cabinet(-5.2 + n * 1.05, hz - hd / 2 + 0.55, 0, c));
    [0x4f86c6, 0xd94f4f, 0x5fbf73].forEach((c, n) => cabinet(-hw / 2 + 0.55, hz - 1.4 + n * 1.1, Math.PI / 2, c));
    // Claw machine, air hockey and a prize counter with plushies.
    k.add('inside', box(1.2, 0.9, 1.2, neonA, 4.6, 0.59, hz - 2.6), box(1.2, 1.2, 1.2, 0xdff3f7, 4.6, 1.64, hz - 2.6, { transparent: true, opacity: 0.35, roughness: 0.1 }), box(1.25, 0.2, 1.25, neonA, 4.6, 2.34, hz - 2.6));
    for (const [x, z, c] of [[4.4, -2.8, 0xe6c84f], [4.8, -2.4, 0x4fe3ff], [4.5, -2.3, 0xf3a6c0]]) k.add('inside', ico(0.2, c, x, 1.25, hz + z));
    k.add('inside', box(2.4, 0.8, 1.3, 0x2f8fce, 0.4, 0.54, hz + 0.8), box(2.2, 0.03, 1.1, 0xf2f6fa, 0.4, 0.96, hz + 0.8), cyl(0.07, 0.07, 0.02, 0xd94f4f, 10, 0.1, 0.99, hz + 0.8));
    k.add('inside', box(3.2, 1, 0.7, 0x2a1f48, 3.6, 0.64, hz + 2.2), box(3.3, 0.07, 0.8, neonB, 3.6, 1.17, hz + 2.2));
    for (let n = 0; n < 4; n++) k.add('inside', ico(0.22, [0xe6c84f, 0xf3a6c0, 0x5fbf73, 0x4f86c6][n], 2.4 + n * 0.75, 1.4, hz + 2.1));
    k.top = 6;
  },

  /** 3 × 2 (24 × 16 m): a brick bistro with a dining room, an open kitchen, a host stand and a terrace. */
  restaurant(k) {
    const brick = 0xb5503c, cream = 0xf1e4cf, green = 0x2f5d4a;
    k.lawn();
    const hz = -2.6, hd = 9, hw = 18;
    k.ext.add(box(20, 0.05, 4.4, PAVING, 0, 0.03, 4.8)); // terrace
    k.path(0, hz + hd / 2, 2);
    k.hall({ z: hz, w: hw, d: hd, h: 4.2, wall: brick, trim: cream, floor: 0x9b6a45, roof: green,
      doors: [{ x: 0, w: 1.8, h: 2.7 }], windows: { front: [-6.5, -3.5, 3.5, 6.5], back: [-6, 6], left: [-1.5, 1.5], right: [0] }, winY: 2, winH: 1.8, winW: 1.8 });
    awning(k, -5, 3.3, hz + hd / 2, 6.4, [green, cream]);
    awning(k, 5, 3.3, hz + hd / 2, 6.4, [green, cream]);
    // Dining room: four laid tables with candles, a host stand by the door.
    for (const [x, z] of [[-5.5, hz + 2], [-1.8, hz + 2], [-5.5, hz - 0.4], [-1.8, hz - 0.4]]) {
      k.table(x, z, 1.6, 0.9, WOOD, 1);
      k.add('inside', box(1.7, 0.02, 1, WHITE, x, 0.91, z), cyl(0.04, 0.04, 0.18, WHITE, 6, x, 1.01, z), k.glow(0.06, 0.08, 0.06, 0xffc47a, x, 1.15, z, 0.6, 1));
    }
    k.add('inside', box(0.7, 1.15, 0.5, WOOD, 1.6, 0.72, hz + 3.6), box(0.5, 0.03, 0.35, WHITE, 1.6, 1.31, hz + 3.6));
    // Open kitchen at the back right: a pass counter, a stove with burners and a hood, a fridge and pans.
    const kx = 5;
    k.add('inside', box(0.2, 3, 4, cream, kx - 2.6, 1.64, hz - 2.2));
    k.add('inside', box(4.6, 1, 0.7, STEEL, kx + 0.4, 0.64, hz - 0.6), box(4.7, 0.06, 0.8, 0xe9edf2, kx + 0.4, 1.17, hz - 0.6));
    k.add('inside', box(2.2, 0.9, 0.8, DARK, kx, 0.59, hz - hd / 2 + 0.55), box(2.4, 0.5, 1, STEEL, kx, 3.2, hz - hd / 2 + 0.6));
    for (const x of [-0.6, 0.6]) k.add('inside', k.glow(0.4, 0.03, 0.4, 0xff6a3d, kx + x, 1.06, hz - hd / 2 + 0.55, 0.5, 0.9), cyl(0.28, 0.24, 0.16, DARK, 10, kx + x, 1.16, hz - hd / 2 + 0.55));
    k.add('inside', box(1, 2.1, 0.7, 0xe9edf2, kx + 2.6, 1.19, hz - hd / 2 + 0.5));
    for (let n = 0; n < 4; n++) k.add('inside', cyl(0.16, 0.16, 0.04, DARK, 10, kx - 1.4 + n * 0.5, 2.4, hz - hd / 2 + 0.2));
    // Terrace tables with parasols.
    for (const x of [-7, -3.5, 3.5, 7]) bistro(k, x, 4.6, { parasol: x < 0 ? green : cream, chairs: 3 });
    for (const x of [-9.4, 9.4]) shrub(k, x, 6.6, 0.8);
    k.top = 5;
  },

  /** 3 × 2 (24 × 16 m): fenced raised beds, sunflowers, a greenhouse you can walk into, a tool shed and compost. */
  community_garden(k) {
    k.lawn(0x92c46e);
    k.path(0, 2.6, 2);
    k.ext.add(box(2, 0.05, 10, 0xc9b58f, 0, 0.035, -2.4)); // gravel spine
    fence(k, 0, k.D / 2 - 0.5, k.W - 1.2, true, { gaps: [{ at: 0, w: 2.4 }] });
    fence(k, 0, -k.D / 2 + 0.5, k.W - 1.2, true);
    fence(k, -k.W / 2 + 0.6, 0, k.D - 1, false);
    fence(k, k.W / 2 - 0.6, 0, k.D - 1, false);
    // Raised beds either side of the spine: soil and rows of crops.
    const crops = [0x5fbf73, 0xd94f4f, 0xe6a43a, 0x8fd16a, 0x9b7ede, 0x5fbf73];
    let n = 0;
    for (const x of [-8.6, -4.4, 4.4, 8.6]) for (const z of [-0.4, 3.2]) {
      k.ext.add(box(3.2, 0.5, 2.6, WOOD, x, 0.25, z), box(2.9, 0.05, 2.3, SOIL, x, 0.52, z));
      for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) k.ext.add(ico(0.3, crops[(n + r) % crops.length], x - 1 + c, 0.75, z - 0.75 + r * 0.75));
      n++;
    }
    // Sunflowers along the front fence.
    for (const x of [-10, -8.6, -7.2, 7.2, 8.6, 10]) k.ext.add(cyl(0.04, 0.05, 2.2, 0x4f7f3a, 5, x, 1.1, 6.6), cyl(0.36, 0.36, 0.08, 0xf2c43a, 10, x, 2.3, 6.75), cyl(0.15, 0.15, 0.1, 0x6b4a2a, 8, x, 2.3, 6.8));
    for (const [x, z] of [[-6.5, 6.6], [6.5, 6.6]]) k.ext.add(cyl(0.04, 0.05, 2.2, 0x4f7f3a, 5, x, 1.1, z));
    // Greenhouse at the back (walk-in, pale glassy walls) with benches of seedlings.
    const gz = -5;
    k.hall({ x: -5.5, z: gz, w: 8, d: 4, h: 2.8, wall: 0xd6eef0, trim: WHITE, floor: 0xbfb39b, roof: 0xe9f6f7,
      doors: [{ x: 2.4, w: 1.1, h: 2.1 }], windows: { front: [-1.6, 0.4], back: [-2.4, 0, 2.4], left: [0], right: [0] }, winColor: 0xcff3e6, winY: 1.6, winH: 1.4, winW: 1.6 });
    for (const z of [gz - 1.2, gz + 0.5]) {
      k.add('inside', box(5, 0.08, 0.8, WOOD_LIGHT, -6.5, 0.86, z));
      for (let p = 0; p < 6; p++) k.add('inside', cyl(0.13, 0.1, 0.18, 0xc0643a, 8, -8.7 + p * 0.85, 1, z), ico(0.13, 0x5fbf73, -8.7 + p * 0.85, 1.18, z));
    }
    k.add('roof', box(8.2, 0.05, 4.2, 0xdff3f7, -5.5, 3.2, gz, { transparent: true, opacity: 0.6, roughness: 0.1 }));
    // Tool shed (back right), compost bins and a watering can.
    k.ext.add(box(3, 2.4, 2.4, 0x7a8f5a, 7.4, 1.2, gz), box(3.3, 0.2, 2.8, 0x5d4a3a, 7.4, 2.5, gz), box(0.9, 1.8, 0.05, WOOD, 7.4, 0.9, gz + 1.22));
    for (const x of [3.6, 4.9]) k.ext.add(box(1.1, 0.9, 1.1, WOOD, x, 0.45, gz - 0.4), box(1, 0.05, 1, SOIL, x, 0.91, gz - 0.4));
    k.ext.add(cyl(0.18, 0.2, 0.32, 0x4f86c6, 10, 1.6, 0.18, -2), box(0.36, 0.04, 0.04, 0x4f86c6, 1.85, 0.3, -2));
    k.top = 3.6;
  },

  /** 3 × 2 (24 × 16 m): treadmills facing the street, free weights by a mirror wall, a heavy bag and a juice counter. */
  gym(k) {
    const wall = 0xdfe6ee, blue = 0x2f8fce;
    k.lawn();
    k.path(0, 2.4, 2.2);
    const hz = -2.2, hd = 9.6, hw = 20;
    k.hall({ z: hz, w: hw, d: hd, h: 5, wall, trim: blue, floor: 0x3a3f48, roof: 0x34495e,
      doors: [{ x: 0, w: 2, h: 2.8 }], windows: { front: [-7.5, -5, -2.5, 2.5, 5, 7.5], back: [], left: [-2, 2], right: [-2, 2] }, winColor: 0xcfe2ff, winY: 2.4, winH: 2, winW: 2 });
    k.add('ext', box(hw + 0.2, 0.5, 0.15, blue, 0, 4.2, hz + hd / 2 + 0.2));
    // Mirror wall at the back.
    k.add('inside', box(hw - 1, 2.4, 0.05, 0xd7e9f5, 0, 1.6, hz - hd / 2 + 0.2, { roughness: 0.05, metalness: 0.6 }));
    // Treadmills facing the front windows.
    for (let n = 0; n < 5; n++) {
      const x = -8 + n * 1.6, z = hz + 2.8;
      k.add('inside', box(0.8, 0.22, 1.8, DARK, x, 0.25, z), box(0.7, 0.03, 1.5, 0x22252c, x, 0.37, z), box(0.06, 1.1, 0.06, STEEL, x - 0.35, 0.85, z + 0.8), box(0.06, 1.1, 0.06, STEEL, x + 0.35, 0.85, z + 0.8), box(0.8, 0.3, 0.12, DARK, x, 1.45, z + 0.8));
      k.add('inside', k.glow(0.4, 0.2, 0.03, 0x9fffc4, x, 1.47, z + 0.73, 0.4, 0.8));
    }
    // Free weights: a bench press, a dumbbell rack and plates on the mirror side.
    const bx = 4.4, bz = hz - 1.6;
    k.add('inside', box(0.45, 0.45, 1.6, DARK, bx, 0.37, bz), box(0.06, 1.3, 0.06, STEEL, bx - 0.7, 0.79, bz - 0.6), box(0.06, 1.3, 0.06, STEEL, bx + 0.7, 0.79, bz - 0.6));
    const bar = cyl(0.03, 0.03, 2, STEEL, 6, bx, 1.35, bz - 0.6);
    bar.rotation.z = Math.PI / 2;
    k.inside.add(bar);
    for (const s of [-0.85, 0.85]) { const p = cyl(0.32, 0.32, 0.08, DARK, 12, bx + s, 1.35, bz - 0.6); p.rotation.z = Math.PI / 2; k.inside.add(p); }
    k.add('inside', box(3, 0.9, 0.6, STEEL, -4, 0.59, hz - hd / 2 + 0.7));
    for (let n = 0; n < 8; n++) { const d = cyl(0.09, 0.09, 0.32, [blue, 0xd94f4f, DARK][n % 3], 8, -5.3 + n * 0.37, 1.12, hz - hd / 2 + 0.7); d.rotation.x = Math.PI / 2; k.inside.add(d); }
    // A heavy bag hanging from the ceiling, yoga mats and a juice counter.
    k.add('inside', cyl(0.02, 0.02, 1.4, STEEL, 4, 8, 4.3, hz - 2), cyl(0.32, 0.32, 1.3, 0xd94f4f, 12, 8, 2.95, hz - 2));
    for (const x of [-1.4, -0.4]) k.add('inside', box(0.7, 0.03, 1.8, [0x9b7ede, 0x5fbf73][x < -1 ? 0 : 1], x, 0.16, hz - 1.4));
    k.add('inside', box(2.6, 1, 0.6, WHITE, 7.4, 0.64, hz + 3.6), box(2.7, 0.06, 0.7, blue, 7.4, 1.17, hz + 3.6));
    for (const [x, c] of [[6.8, 0x8fd16a], [7.4, 0xf2c43a], [8, 0xf3a6c0]]) k.add('inside', cyl(0.07, 0.06, 0.24, c, 8, x, 1.32, hz + 3.6));
    // A giant dumbbell on the roof (lifts with it).
    const rod = cyl(0.18, 0.18, 5, STEEL, 8, 0, 6.3, hz + 1);
    rod.rotation.z = Math.PI / 2;
    k.add('roof', rod, box(0.3, 1, 0.3, DARK, -1.2, 5.75, hz + 1), box(0.3, 1, 0.3, DARK, 1.2, 5.75, hz + 1));
    for (const s of [-1, 1]) for (const [dx, r] of [[2, 1.1], [2.45, 0.85]]) { const p = cyl(r, r, 0.4, s > 0 ? blue : DARK, 14, s * dx, 6.3, hz + 1); p.rotation.z = Math.PI / 2; k.roof.add(p); }
    k.top = 7.6;
  },

  /** 3 × 3 (24 × 24 m): a marquee canopy, a lobby with concessions and posters, and a raked auditorium behind. */
  cinema(k) {
    const wall = 0x7a2a3c, trim = 0xf2d38a, deep = 0x4a1a26;
    k.ext.add(box(k.W - 0.6, 0.05, k.D - 0.6, PAVING, 0, 0.03, 0));
    k.ext.add(box(k.W - 2, 0.03, 6, 0x9a3b4c, 0, 0.06, 7.6)); // red carpet plaza
    const hz = -2.6, hd = 16, hw = 20;
    k.hall({ z: hz, w: hw, d: hd, h: 6, wall, trim, floor: 0x5a2230, roof: deep,
      doors: [{ x: -1.6, w: 1.6, h: 2.8 }, { x: 0, w: 1.6, h: 2.8 }, { x: 1.6, w: 1.6, h: 2.8 }], windows: { front: [-7, 7], back: [], left: [4.5], right: [4.5] }, winY: 3.6, winH: 1.4 });
    // Marquee canopy with chaser bulbs, and lit poster frames on the facade.
    const fz = hz + hd / 2;
    k.add('ext', box(9, 0.5, 2.6, deep, 0, 3.6, fz + 1.2), box(9.2, 0.9, 0.2, trim, 0, 4.25, fz + 2.5), k.glow(8.4, 0.5, 0.06, 0xfff4d6, 0, 4.25, fz + 2.62, 0.5, 1.2));
    for (let n = 0; n < 12; n++) k.add('ext', k.glow(0.14, 0.14, 0.14, 0xffe08a, -4.4 + n * 0.8, 3.3, fz + 2.5, 0.6, 1.2));
    for (const x of [-7, -4.6, 4.6, 7]) k.add('ext', box(1.6, 2.3, 0.12, trim, x, 1.6, fz + 0.1), k.glow(1.3, 2, 0.05, [0x4f86c6, 0xe6a43a, 0x5fbf73, 0x9b7ede][Math.abs(x) > 5 ? 0 : 1], x, 1.6, fz + 0.18, 0.25, 0.8));
    // A tower sign above the roof line.
    k.add('ext', box(1.6, 5, 0.6, deep, -9, 8.4, fz - 0.4), k.glow(1.2, 4.4, 0.06, 0xff6a6a, -9, 8.4, fz - 0.08, 0.4, 1.2));
    // Lobby (front): a concession counter, a popcorn machine and a dividing wall with two doors into the auditorium.
    const lz = fz - 2.6;
    k.add('inside', box(6, 1.05, 0.7, deep, -4.4, 0.66, lz - 1.6), box(6.1, 0.07, 0.8, trim, -4.4, 1.22, lz - 1.6));
    k.add('inside', box(1, 1, 0.8, 0xd94f4f, -6.6, 1.75, lz - 1.6), box(0.9, 0.7, 0.7, 0xfff4d6, -6.6, 2.6, lz - 1.6, { transparent: true, opacity: 0.45 }));
    for (let n = 0; n < 6; n++) k.add('inside', ico(0.12, 0xf7e7a6, -6.85 + (n % 3) * 0.25, 2.35 + Math.floor(n / 3) * 0.2, lz - 1.6));
    for (const x of [-3.6, -2.6]) k.add('inside', cyl(0.14, 0.11, 0.3, 0xd94f4f, 8, x, 1.4, lz - 1.6));
    const wz = lz - 3.6;
    for (const [x, w] of [[-7, 6], [0, 4], [7, 6]]) k.add('inside', box(w, 5.8, 0.25, wall, x, 3.04, wz));
    k.add('inside', box(20, 1.2, 0.25, wall, 0, 5.3, wz));
    // Auditorium (back): the glowing screen and rows of seats rising away from it.
    const az = hz - hd / 2;
    k.add('inside', box(14, 0.4, 0.4, deep, 0, 0.34, az + 0.6), k.glow(13, 4.4, 0.06, 0xdbe9ff, 0, 3.2, az + 0.35, 0.4, 0.9));
    for (let r = 0; r < 4; r++) {
      const z = az + 3.6 + r * 1.4, y = 0.14 + r * 0.32;
      k.add('inside', box(16, r ? r * 0.32 : 0.01, 1.4, 0x4a1a26, 0, 0.14 + (r * 0.32) / 2, z));
      for (let s = 0; s < 10; s++) k.add('inside', box(0.6, 0.45, 0.55, 0xc0303e, -6.3 + s * 1.4, y + 0.3, z), box(0.6, 0.6, 0.12, 0xc0303e, -6.3 + s * 1.4, y + 0.75, z + 0.3));
    }
    k.storeys({ z: az + 4, w: hw, d: 8, from: 6, n: 1, fh: 2.6, wall: deep, band: trim, winColor: 0xffc47a, cols: 4 });
    // Ticket booth on the plaza.
    k.ext.add(box(1.8, 2.2, 1.6, trim, 6.4, 1.1, 8.6), box(2.1, 0.25, 1.9, deep, 6.4, 2.32, 8.6), pane(1.2, 0.8, 6.4, 1.5, 9.42, 0xfff4d6));
    k.top = 11.5;

    function pane(w, h, x, y, z, c) { return k.glow(w, h, 0.06, c, x, y, z, 0.2, 0.8); }
  },

  /** 3 × 2 (24 × 16 m): a warm wooden room with a lit stage, a band's kit, a bar with stools and little tables. */
  music_lounge(k) {
    const wall = 0x6b3f2a, trim = 0xe0a85a, deep = 0x3a2219;
    k.lawn();
    k.path(0, 2.6, 2);
    const hz = -2.2, hd = 9.6, hw = 19;
    k.hall({ z: hz, w: hw, d: hd, h: 4.6, wall, trim, floor: 0x4a2c20, roof: deep,
      doors: [{ x: 0, w: 1.8, h: 2.7 }], windows: { front: [-6, -3.5, 3.5, 6], back: [], left: [0], right: [] }, winColor: 0xffb86b, winY: 2.2 });
    // A neon note and a canopy over the door.
    k.add('ext', box(4, 0.3, 1.6, deep, 0, 3.2, hz + hd / 2 + 0.8), k.glow(0.3, 1.2, 0.08, 0xff9a3d, -6.5, 4, hz + hd / 2 + 0.2, 0.5, 1.2), k.glow(0.7, 0.5, 0.08, 0xff9a3d, -6.75, 3.5, hz + hd / 2 + 0.2, 0.5, 1.2));
    // The stage at the back: a riser, a drum kit, an amp, a mic stand and coloured spots.
    const sz = hz - hd / 2 + 1.8;
    k.add('inside', box(9, 0.5, 3.2, deep, -2, 0.39, sz), box(9.1, 0.06, 0.1, trim, -2, 0.66, sz + 1.6));
    const kit = (x, z) => {
      k.add('inside', cyl(0.4, 0.4, 0.5, 0xd94f4f, 12, x, 0.95, z), cyl(0.25, 0.25, 0.3, 0xd94f4f, 10, x - 0.7, 1.05, z + 0.3), cyl(0.25, 0.25, 0.3, 0xd94f4f, 10, x + 0.7, 1.05, z + 0.3));
      for (const s of [-1.1, 1.1]) k.add('inside', cyl(0.02, 0.02, 1.2, STEEL, 4, x + s, 1.24, z - 0.2), cyl(0.38, 0.38, 0.02, 0xd8b24a, 12, x + s, 1.85, z - 0.2));
    };
    kit(-4, sz - 0.4);
    k.add('inside', box(0.9, 1, 0.5, DARK, 0.6, 1.14, sz - 0.6), box(0.75, 0.75, 0.04, 0x55504a, 0.6, 1.14, sz - 0.33));
    k.add('inside', cyl(0.02, 0.02, 1.5, STEEL, 4, -1.6, 1.39, sz + 0.8), ico(0.07, DARK, -1.6, 2.18, sz + 0.8));
    for (const [x, c] of [[-5, 0xff4fd8], [-2, 0xffd36b], [1, 0x4fe3ff]]) k.add('inside', box(0.3, 0.3, 0.3, DARK, x, 4.2, sz + 1.6), k.glow(0.24, 0.05, 0.24, c, x, 4.04, sz + 1.6, 0.4, 1));
    // The bar along the right wall with bottles and stools.
    const bx = hw / 2 - 1.9;
    k.add('inside', box(0.8, 1.05, 5.6, deep, bx, 0.66, hz + 0.4), box(0.9, 0.07, 5.7, trim, bx, 1.22, hz + 0.4));
    k.add('inside', box(0.4, 2.2, 5, WOOD, hw / 2 - 0.35, 1.6, hz + 0.4));
    for (let n = 0; n < 9; n++) k.add('inside', cyl(0.06, 0.06, 0.3, [0x5fbf73, 0xd8a24a, 0x9b5a3a][n % 3], 6, hw / 2 - 0.35, 1.9 + (n % 2) * 0.6, hz - 1.6 + Math.floor(n / 2) * 0.9));
    for (let n = 0; n < 4; n++) k.add('inside', cyl(0.22, 0.22, 0.06, trim, 10, bx - 0.9, 0.86, hz - 1.4 + n * 1.2), cyl(0.04, 0.04, 0.72, STEEL, 5, bx - 0.9, 0.5, hz - 1.4 + n * 1.2));
    // Little round tables facing the stage.
    for (const [x, z] of [[-6, hz + 2.4], [-3, hz + 2.6], [0, hz + 2.4], [-4.5, hz + 0.8], [-1.5, hz + 0.9]]) {
      bistro(k, x, z, { where: 'inside', top: deep });
      k.add('inside', k.glow(0.08, 0.1, 0.08, 0xffc47a, x, 1, z, 0.6, 1));
    }
    // A rooftop marquee with a glowing note (lifts with the roof).
    const mz = hz + hd / 2 - 1;
    k.add('roof', box(7, 2, 0.4, deep, 0, 5.9, mz), box(7.2, 0.2, 0.6, trim, 0, 6.95, mz), box(7.2, 0.2, 0.6, trim, 0, 4.85, mz));
    k.add('roof', k.glow(6.4, 1.4, 0.06, 0xffb86b, 0.6, 5.9, mz + 0.22, 0.35, 1), k.glow(0.5, 0.4, 0.08, 0xff4fd8, -2.6, 5.5, mz + 0.26, 0.6, 1.2), k.glow(0.1, 1.1, 0.08, 0xff4fd8, -2.4, 6.05, mz + 0.26, 0.6, 1.2), k.glow(0.4, 0.14, 0.08, 0xff4fd8, -2.2, 6.55, mz + 0.26, 0.6, 1.2));
    [0.5, 0.9, 0.7, 1.1, 0.6, 0.8].forEach((h, n) => k.add('roof', k.glow(0.32, h, 0.06, 0x3a2219, -0.9 + n * 0.62, 5.3 + h / 2, mz + 0.27, 0.6, 0.6)));
    k.top = 7.4;
  },

  /** 4 × 3 (32 × 24 m): a lane pool with a diving board, loungers and parasols, a lifeguard chair and a changing house. */
  pool(k) {
    k.lawn();
    k.ext.add(box(28, 0.08, 15.6, 0xe9e2d4, 0, 0.05, -3.4)); // deck
    // The pool: a tiled rim, water and lane ropes.
    const px = 0, pz = -4.2, pw = 18, pd = 9;
    k.ext.add(box(pw + 0.8, 0.22, pd + 0.8, WHITE, px, 0.11, pz), box(pw, 0.05, pd, 0x3fb6d3, px, 0.22, pz, { roughness: 0.08, metalness: 0.1 }));
    for (let n = 1; n < 4; n++) {
      const z = pz - pd / 2 + (pd / 4) * n;
      for (let s = 0; s < 12; s++) k.ext.add(ico(0.1, s % 2 ? 0xd94f4f : WHITE, px - pw / 2 + 0.75 + s * 1.5, 0.27, z));
    }
    // Diving board and ladders.
    k.ext.add(box(0.6, 0.6, 0.6, STEEL, px - pw / 2 - 1.2, 0.35, pz), box(2.6, 0.1, 0.5, 0x4f86c6, px - pw / 2 + 0.2, 0.75, pz));
    for (const x of [px + pw / 2 - 1.5, px - pw / 2 + 2]) for (const s of [-0.3, 0.3]) k.ext.add(cyl(0.035, 0.035, 1.2, STEEL, 6, x + s, 0.7, pz + pd / 2 + 0.3));
    // Loungers with parasols along the back and right side.
    const lounger = (x, z, ry, c) => {
      const g = new THREE.Group();
      g.position.set(x, 0, z);
      g.rotation.y = ry;
      const back = box(0.7, 0.06, 0.8, c, 0, 0.6, -0.75);
      back.rotation.x = -0.6;
      g.add(box(0.7, 0.08, 1.5, c, 0, 0.36, 0.2), back, box(0.66, 0.32, 0.06, STEEL, 0, 0.16, 0.85), box(0.66, 0.32, 0.06, STEEL, 0, 0.16, -0.6));
      k.ext.add(g);
    };
    for (let n = 0; n < 5; n++) lounger(-8 + n * 3, -10.2, Math.PI, [0x3fb6d3, 0xf2c43a][n % 2]);
    [-6.5, -0.5, 5.5].forEach((x, n) => k.ext.add(cyl(0.04, 0.04, 2.4, STEEL, 6, x, 1.2, -10.4), cone(1.5, 0.6, [0xd94f4f, 0x3fb6d3, 0xf2c43a][n], x, 2.2, -10.4, 10)));
    for (let n = 0; n < 3; n++) lounger(12.4, -6.6 + n * 2.4, -Math.PI / 2, 0xf3a6c0);
    // Lifeguard chair beside the pool (the lifeguard sits on top).
    const lx = px + pw / 2 + 1.6, lz = pz + 1.6;
    for (const [a, b] of [[-0.45, -0.45], [0.45, -0.45], [-0.45, 0.45], [0.45, 0.45]]) k.ext.add(box(0.1, 1.8, 0.1, WHITE, lx + a, 0.9, lz + b));
    k.ext.add(box(1.1, 0.1, 1.1, WHITE, lx, 1.8, lz), box(1.1, 0.7, 0.08, WHITE, lx + 0.55, 2.2, lz), cone(0.9, 0.5, 0xd94f4f, lx, 3.4, lz, 8), cyl(0.03, 0.03, 1.4, WHITE, 4, lx, 2.6, lz));
    // A changing house at the front with a snack window; a fence around the deck.
    const hx = k.doorX, hzz = 7.4;
    k.hall({ x: hx - 4, z: hzz, w: 12, d: 5, h: 3.2, wall: 0xf2f6fa, trim: 0x3fb6d3, floor: 0xcfd6dc, roof: 0x3fb6d3,
      doors: [{ x: 4, w: 1.4, h: 2.3 }, { x: 0, w: 1.2, h: 2.2 }], windows: { front: [-3.5], back: [-3, 3], left: [0], right: [0] }, winY: 2.2, winH: 0.8 });
    k.path(hx, hzz + 2.5, 1.8);
    k.add('inside', box(0.15, 3, 4.6, 0x3fb6d3, hx - 2.6, 1.64, hzz), box(0.15, 3, 4.6, 0x3fb6d3, hx - 6.6, 1.64, hzz));
    for (let n = 0; n < 4; n++) k.add('inside', box(0.6, 1.8, 0.5, [0x3fb6d3, 0xf2c43a, 0xf3a6c0, 0x5fbf73][n], hx - 6 + n * 0.75, 1.04, hzz - 2.1));
    k.add('inside', box(2.6, 0.4, 0.6, WOOD_LIGHT, hx - 4.6, 0.5, hzz + 1.2));
    fence(k, 0, 4.6, 28, true, { color: WHITE, gaps: [{ at: hx - 4, w: 12.4 }] });
    fence(k, -14, -3.4, 15.6, false);
    fence(k, 14, -3.4, 15.6, false);
    fence(k, 0, -11.2, 28, true);
    k.tree(-14.6, 9.2, 0.9); k.tree(14.6, 9.2, 0.9);
    k.top = 4.5;
  },

  /** 4 × 4 (32 × 32 m): a lined pitch inside a running track, bleachers, floodlights, a scoreboard and a clubhouse with trophies. */
  sports_complex(k) {
    const blue = 0x2f5d8a, gold = 0xe0a83a;
    k.ext.add(box(k.W - 0.6, 0.05, k.D - 0.6, 0x86b865, 0, 0.03, 0));
    // Running track and the pitch inside it.
    const cz = -5.5;
    k.ext.add(box(24, 0.06, 17, 0xc65a3f, 0, 0.05, cz), box(20, 0.07, 13, 0x5fae4a, 0, 0.06, cz));
    for (let s = 0; s < 5; s++) k.ext.add(box(4, 0.075, 13, s % 2 ? 0x58a344 : 0x66b552, -8 + s * 4, 0.065, cz)); // mown stripes
    const line = (w, d, x, z) => k.ext.add(box(w, 0.09, d, WHITE, x, 0.08, z));
    line(19.6, 0.12, 0, cz - 6.3); line(19.6, 0.12, 0, cz + 6.3); line(0.12, 12.6, -9.8, cz); line(0.12, 12.6, 9.8, cz); line(0.12, 12.6, 0, cz);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(2, 0.06, 4, 28), new THREE.MeshStandardMaterial({ color: WHITE }));
    ring.rotation.x = Math.PI / 2;
    ring.position.set(0, 0.09, cz);
    k.ext.add(ring);
    for (const x of [-9.8, 9.8]) {
      const s = Math.sign(x);
      line(3, 0.1, x - s * 1.5, cz - 3); line(3, 0.1, x - s * 1.5, cz + 3); line(0.1, 6, x - s * 3, cz);
      // Goals.
      k.ext.add(box(0.1, 1.6, 0.1, WHITE, x + s * 0.5, 0.8, cz - 1.8), box(0.1, 1.6, 0.1, WHITE, x + s * 0.5, 0.8, cz + 1.8), box(0.1, 0.1, 3.7, WHITE, x + s * 0.5, 1.6, cz));
      k.ext.add(box(0.05, 1.5, 3.6, 0xe9edf2, x + s * 1.2, 0.8, cz, { transparent: true, opacity: 0.45 }));
    }
    for (let n = 1; n < 4; n++) {
      k.ext.add(box(24, 0.07, 0.05, WHITE, 0, 0.08, cz - 8.5 + n * 0.5), box(24, 0.07, 0.05, WHITE, 0, 0.08, cz + 8.5 - n * 0.5));
    }
    k.ext.add(ico(0.22, WHITE, 2.4, 0.3, cz + 1.2));
    // Bleachers on the left, three stepped rows with seats.
    for (let r = 0; r < 3; r++) {
      k.ext.add(box(1.1, 0.5 + r * 0.55, 15, 0x9aa3ad, -12.9 - r * 1.05, (0.5 + r * 0.55) / 2, cz));
      for (let s = 0; s < 14; s++) k.ext.add(box(0.5, 0.12, 0.5, [blue, gold][(s + r) % 2], -12.9 - r * 1.05, 0.56 + r * 0.55, cz - 6.5 + s));
    }
    // Floodlights at the corners and a scoreboard on the right.
    for (const [x, z] of [[-15, -15], [15, -15], [-15, 3.6], [15, 3.6]]) {
      k.ext.add(cyl(0.16, 0.24, 11, STEEL, 6, x, 5.5, z), box(1.8, 0.9, 0.3, DARK, x, 11.2, z));
      k.ext.add(k.glow(1.6, 0.7, 0.08, 0xfffbe8, x - Math.sign(x) * 0.18, 11.2, z + (z < 0 ? 0.2 : -0.2), 0.15, 1.1));
    }
    k.ext.add(box(0.3, 4.4, 0.3, STEEL, 14.4, 2.2, cz - 2), box(0.3, 4.4, 0.3, STEEL, 14.4, 2.2, cz + 2), box(0.5, 2.6, 5.4, DARK, 14.4, 5.2, cz));
    k.ext.add(k.glow(0.06, 0.8, 1.8, 0xff6a3d, 14.12, 5.5, cz - 1.2, 0.5, 1.1), k.glow(0.06, 0.8, 1.8, 0x4fe3ff, 14.12, 5.5, cz + 1.2, 0.5, 1.1));
    // The clubhouse at the front: a trophy case, benches and lockers.
    const hx = k.doorX, hz = 9.4;
    k.ext.add(box(30, 0.05, 5, PAVING, 0, 0.04, 13.2));
    k.path(hx, hz + 3, 2.4);
    k.hall({ x: hx, z: hz, w: 14, d: 6, h: 4, wall: 0xf1ece2, trim: blue, floor: 0xb08d63, roof: blue,
      doors: [{ x: 0, w: 2, h: 2.8 }], windows: { front: [-5, -2.6, 2.6, 5], back: [-4.5, 4.5], left: [0], right: [0] }, winY: 2.2 });
    k.add('inside', box(3.6, 2, 0.6, WOOD, hx - 4.4, 1.14, hz - 2.4), box(3.4, 1.6, 0.05, 0xdff3f7, hx - 4.4, 1.3, hz - 2.08, { transparent: true, opacity: 0.4 }));
    for (let n = 0; n < 4; n++) k.add('inside', cyl(0.12, 0.08, 0.35, gold, 8, hx - 5.6 + n * 0.8, 1.4, hz - 2.4), ico(0.14, gold, hx - 5.6 + n * 0.8, 1.7, hz - 2.4));
    for (let n = 0; n < 5; n++) k.add('inside', box(0.6, 1.8, 0.45, [blue, gold][n % 2], hx + 2.6 + n * 0.7, 1.04, hz - 2.5));
    k.bench(hx + 3.8, hz + 0.4, 0, 'inside');
    k.add('roof', box(4, 1.2, 0.3, blue, hx, 4.9, hz + 3.1), k.glow(3.4, 0.6, 0.06, gold, hx, 4.9, hz + 3.28, 0.4, 1));
    // A champion's statue on the plaza.
    k.ext.add(box(1.4, 1.2, 1.4, 0xcfc6b4, -9, 0.6, 12.4), cyl(0.25, 0.3, 1.4, gold, 8, -9, 1.9, 12.4), ico(0.3, gold, -9, 2.85, 12.4), box(0.12, 0.8, 0.12, gold, -8.75, 3.1, 12.4));
    k.top = 12;
  },
};

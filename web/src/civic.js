// Civic buildings (play layer): city infrastructure the player places on the town grid (shared/town.mjs).
// Each kind has its own footprint (a 2 × 2 police station up to a 4 × 4 hospital) and a walk-in ground floor:
// zoom in and the roof (with any upper storeys) lifts away and the walls facing you drop, like a home, so the
// interior shows. Frame: the footprint's centre, front (+z) facing the street, door at x = doorX.
// They're scenery: nothing here reflects agent work.

import * as THREE from 'three';
import { CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { CIVIC, CIVIC_KINDS, civicTransform } from '../../shared/town.mjs';
import { icon } from './icons.js';
import { PALETTE, box, buildLightPool, cyl, ico, mergeStatic } from './models.js';
import { escapeHtml as esc } from './sim.js';

const PAVING = 0xcfc8bb;
const DARK = 0x3a4150;
const STEEL = 0xb8c3cf;
const WOOD = PALETTE.wood ?? 0x9a6b43;
const WOOD_LIGHT = PALETTE.woodLight ?? 0xc89a68;
const BOOKS = PALETTE.books ?? [0xd94f4f, 0x4f86c6, 0xe6c84f, 0x5fbf73, 0x9b7ede];
const CUT_SCALE = 0.13;
const WALL_T = 0.3;

function glowMat(color, base = 0.06, night = 0.55) {
  const m = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: base, roughness: 0.35 });
  m.userData.dayGlow = base;
  m.userData.nightGlow = night;
  return m;
}

/** A window pane facing +z in its parent's frame (glows at night). */
function pane(w, h, x, y, z, color = 0xffc47a, night = 0.55) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.08), glowMat(color, 0.06, night));
  mesh.position.set(x, y, z);
  mesh.userData.dynamic = true;
  mesh.userData.glow = true;
  return mesh;
}

/** A gable roof (triangular prism): w across x, h tall, d along z, base at y. */
function gable(w, h, d, color, x, y, z) {
  const m = cyl(1, 1, 1, color, 3, x, y, z);
  m.geometry.dispose();
  const geo = new THREE.CylinderGeometry(1, 1, 1, 3, 1);
  geo.rotateX(Math.PI / 2);
  geo.rotateZ(Math.PI);
  m.geometry = geo;
  m.scale.set(w / 1.73, h / 1.5, d);
  m.position.y = y + h / 3;
  return m;
}

/** Everything one building is made of: exterior, interior, the lifting roof and the cutaway walls. */
class Kit {
  constructor(kind) {
    this.kind = kind;
    const t = civicTransform({ kind, i: 0, j: 0, rot: 0 });
    Object.assign(this, { W: t.W, D: t.D, doorX: t.doorX });
    this.root = new THREE.Group();
    this.ext = new THREE.Group(); // grounds, vehicles, towers: always shown
    this.inside = new THREE.Group(); // furniture on the ground floor
    this.roof = new THREE.Group(); // roof slabs and upper storeys: lift away up close
    this.root.add(this.ext, this.inside, this.roof);
    this.walls = [];
    this.halls = []; // [x0, z0, x1, z1] in the building's frame, kept dry by the weather
    this.top = 4;
  }

  add(group, ...meshes) { this[group].add(...meshes); return meshes[0]; }

  /** Paving from the front edge to a door at (x, z). */
  path(x, z, w = 2.2, color = PAVING) {
    const len = this.D / 2 - z;
    this.ext.add(box(w, 0.05, len, color, x, 0.03, z + len / 2));
  }

  /** Ground for the whole plot. */
  lawn(color = PALETTE.grassLot ?? 0x97cf78) {
    this.ext.add(box(this.W - 0.6, 0.04, this.D - 0.6, color, 0, 0.02, 0));
  }

  /**
   * A walk-in hall: a floor, four walls (doors cut in the front one) and a flat roof. `windows` lists window
   * x positions per side. Returns the wall height. Doors: [{ x, w, h }] in the hall's frame.
   */
  hall({ x = 0, z = 0, w, d, h = 4, wall, trim = 0xf1ece2, floor = 0xd8d2c6, roof = 0x6b7280, doors = [], windows = {}, winColor = 0xffc47a, winY, winW = 1.2, winH = 1.3 }) {
    this.inside.add(box(w, 0.14, d, floor, x, 0.07, z));
    this.halls.push([x - w / 2, z - d / 2, x + w / 2, z + d / 2]);
    const side = (name, len, px, pz, ry, normal, cuts = []) => {
      const g = new THREE.Group();
      g.position.set(px, 0, pz);
      g.rotation.y = ry;
      g.userData = { normal: new THREE.Vector3(...normal), scale: 1, windows: [] };
      // Wall pieces between door gaps (wall frame: x along the wall, outer face at +z).
      const gaps = cuts.map((c) => [c.x - c.w / 2, c.x + c.w / 2, c.h]).sort((a, b) => a[0] - b[0]);
      let from = -len / 2;
      for (const [a, b, dh] of gaps) {
        if (a > from) g.add(box(a - from, h, WALL_T, wall, (from + a) / 2, h / 2, 0));
        g.add(box(b - a, h - dh, WALL_T, wall, (a + b) / 2, dh + (h - dh) / 2, 0)); // lintel
        g.add(box(b - a + 0.3, 0.18, WALL_T + 0.12, trim, (a + b) / 2, dh + 0.09, 0));
        from = b;
      }
      if (from < len / 2) g.add(box(len / 2 - from, h, WALL_T, wall, (from + len / 2) / 2, h / 2, 0));
      g.add(box(len + WALL_T, 0.22, WALL_T + 0.1, trim, 0, h - 0.11, 0));
      for (const wx of windows[name] || []) {
        const p = pane(winW, winH, wx, winY ?? h * 0.55, WALL_T / 2 + 0.03, winColor);
        g.add(p);
        g.userData.windows.push(p);
      }
      this.root.add(g);
      this.walls.push(g);
    };
    side('front', w, x, z + d / 2, 0, [0, 0, 1], doors);
    side('back', w, x, z - d / 2, Math.PI, [0, 0, -1]);
    side('left', d, x - w / 2, z, -Math.PI / 2, [-1, 0, 0]);
    side('right', d, x + w / 2, z, Math.PI / 2, [1, 0, 0]);
    this.roof.add(box(w + 0.5, 0.35, d + 0.5, roof, x, h + 0.17, z));
    this.top = Math.max(this.top, h + 0.4);
    return h;
  }

  /** Upper storeys (part of the roof group): a shell with windows on every side. */
  storeys({ x = 0, z = 0, w, d, from, n, fh = 3.2, wall, band, winColor = 0xffc47a, cols = 5 }) {
    let y = from + 0.35;
    for (let f = 0; f < n; f++) {
      this.roof.add(box(w, fh, d, wall, x, y + fh / 2, z));
      if (band) this.roof.add(box(w + 0.1, 0.25, d + 0.1, band, x, y + fh - 0.12, z));
      for (let c = 0; c < cols; c++) {
        const wx = x - w / 2 + (w / cols) * (c + 0.5);
        this.roof.add(pane(1.2, 1.3, wx, y + fh * 0.5, z + d / 2 + 0.03, winColor));
        const back = pane(1.2, 1.3, wx, y + fh * 0.5, z - d / 2 - 0.03, winColor);
        this.roof.add(back);
      }
      y += fh;
    }
    this.roof.add(box(w + 0.4, 0.35, d + 0.4, band || wall, x, y + 0.17, z));
    this.top = Math.max(this.top, y + 0.5);
    return y + 0.35;
  }

  // ---- Furniture (interior, y from the floor at 0.14) ----

  desk(x, z, ry = 0, { color = WOOD, screen = true, chair = true } = {}) {
    const g = new THREE.Group();
    g.position.set(x, 0.14, z);
    g.rotation.y = ry;
    g.add(box(1.5, 0.08, 0.75, color, 0, 0.74, 0));
    for (const sx of [-0.68, 0.68]) g.add(box(0.06, 0.74, 0.7, color, sx, 0.37, 0));
    if (screen) g.add(box(0.6, 0.38, 0.04, DARK, 0, 1.0, -0.2), box(0.08, 0.2, 0.08, DARK, 0, 0.82, -0.2), pane(0.52, 0.3, 0, 1.0, -0.17, 0x9fd6ff, 0.6));
    if (chair) g.add(box(0.5, 0.06, 0.5, DARK, 0, 0.46, 0.65), box(0.5, 0.5, 0.06, DARK, 0, 0.72, 0.88), cyl(0.04, 0.04, 0.42, STEEL, 6, 0, 0.23, 0.65));
    this.inside.add(g);
    return g;
  }

  shelf(x, z, w, ry = 0, h = 2.2) {
    const g = new THREE.Group();
    g.position.set(x, 0.14, z);
    g.rotation.y = ry;
    g.add(box(w, h, 0.45, WOOD, 0, h / 2, 0));
    for (let r = 0; r < 4; r++) {
      let bx = -w / 2 + 0.12;
      let n = 0;
      while (bx < w / 2 - 0.2) {
        const bw = 0.08 + ((n * 37 + r * 11) % 5) * 0.025;
        g.add(box(bw, 0.36, 0.3, BOOKS[(n + r * 2) % BOOKS.length], bx + bw / 2, 0.32 + r * 0.5, 0.1));
        bx += bw + 0.015;
        n++;
      }
    }
    this.inside.add(g);
    return g;
  }

  table(x, z, w = 2, d = 1, color = WOOD_LIGHT, chairs = 2) {
    this.inside.add(box(w, 0.08, d, color, x, 0.86, z));
    for (const sx of [-w / 2 + 0.12, w / 2 - 0.12]) for (const sz of [-d / 2 + 0.12, d / 2 - 0.12]) this.inside.add(box(0.07, 0.72, 0.07, color, x + sx, 0.5, z + sz));
    for (let c = 0; c < chairs; c++) {
      const cx = x - w / 2 + (w / chairs) * (c + 0.5);
      this.inside.add(box(0.42, 0.06, 0.42, DARK, cx, 0.6, z + d / 2 + 0.4), box(0.42, 0.06, 0.42, DARK, cx, 0.6, z - d / 2 - 0.4));
    }
  }

  bed(x, z, ry = 0) {
    const g = new THREE.Group();
    g.position.set(x, 0.14, z);
    g.rotation.y = ry;
    g.add(box(1.0, 0.5, 2.1, STEEL, 0, 0.35, 0), box(0.95, 0.18, 2.0, 0xffffff, 0, 0.66, 0), box(0.8, 0.14, 0.45, 0xe9f4ff, 0, 0.8, -0.7), box(0.97, 0.06, 1.2, 0x7cc7bd, 0, 0.77, 0.35));
    g.add(box(1.0, 0.9, 0.08, STEEL, 0, 0.6, -1.05));
    g.add(cyl(0.03, 0.03, 1.8, STEEL, 6, 0.7, 0.9, -0.8), box(0.22, 0.32, 0.08, 0xd8f2ff, 0.7, 1.7, -0.8)); // IV stand
    this.inside.add(g);
  }

  vehicle(x, z, ry, body, { cab = 0xe9edf2, len = 4.2, wid = 2, h = 1.3, stripe = null, lights = null } = {}) {
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    g.rotation.y = ry;
    g.add(box(wid, h, len, body, 0, 0.35 + h / 2, 0));
    g.add(box(wid - 0.1, 0.65, len * 0.32, cab, 0, 0.35 + h + 0.3, len * 0.28));
    if (stripe) g.add(box(wid + 0.02, 0.22, len + 0.02, stripe, 0, 0.35 + h * 0.45, 0));
    if (lights) g.add(box(wid * 0.6, 0.16, 0.3, lights, 0, 0.35 + h + 0.7, len * 0.28, { emissive: lights, emissiveIntensity: 0.5 }));
    for (const sx of [-wid / 2 + 0.05, wid / 2 - 0.05]) for (const sz of [-len * 0.32, len * 0.32]) {
      const wh = cyl(0.38, 0.38, 0.28, DARK, 10, sx, 0.38, sz);
      wh.rotation.z = Math.PI / 2;
      g.add(wh);
    }
    this.ext.add(g);
    return g;
  }

  flagpole(x, z, color = 0xd94f4f) {
    this.ext.add(cyl(0.07, 0.09, 8, STEEL, 6, x, 4, z), box(1.5, 0.9, 0.05, color, x + 0.8, 7.3, z), ico(0.12, 0xe6c84f, x, 8.05, z));
  }

  tree(x, z, s = 1) {
    this.ext.add(cyl(0.16 * s, 0.22 * s, 1.6 * s, WOOD, 6, x, 0.8 * s, z), ico(1.1 * s, PALETTE.grassDark ?? 0x6faa57, x, 2.2 * s, z, 1));
  }

  bench(x, z, ry = 0, where = 'ext') {
    const g = new THREE.Group();
    g.position.set(x, where === 'ext' ? 0 : 0.14, z);
    g.rotation.y = ry;
    g.add(box(1.6, 0.08, 0.45, WOOD_LIGHT, 0, 0.45, 0), box(1.6, 0.4, 0.06, WOOD_LIGHT, 0, 0.7, -0.2));
    for (const sx of [-0.7, 0.7]) g.add(box(0.06, 0.45, 0.42, DARK, sx, 0.22, 0));
    this[where].add(g);
  }
}

// ---- The buildings ------------------------------------------------------------------------------

const BUILD = {
  /** 3 × 2 (24 × 16 m): two engine bays, a crew room with lockers and the pole, a hose tower. */
  fire_station(k) {
    const red = 0xc2453a, trim = 0xf1e7d8;
    k.lawn();
    k.ext.add(box(14, 0.05, 6.6, PAVING, -3.4, 0.03, 4.7)); // apron
    k.path(4.4, 3.4, 1.6);
    const hz = -1.6, hd = 10, hw = 19;
    k.hall({ x: -1.5, z: hz, w: hw, d: hd, h: 5, wall: red, trim, floor: 0xc9c6c0, roof: 0x6b4a43,
      doors: [{ x: -5.5, w: 3.8, h: 3.8 }, { x: -1.0, w: 3.8, h: 3.8 }, { x: 5.9, w: 1.3, h: 2.4 }],
      windows: { back: [-5, 0, 5], left: [-2, 2], right: [-2.5, 2.5] }, winY: 3.2 });
    // Engine bays: two fire engines, hose reels and a dividing wall to the crew room.
    k.add('inside', box(0.2, 4.8, hd - 0.6, trim, 2.4, 2.4, hz));
    for (const x of [-7, -2.5]) {
      const e = new THREE.Group();
      e.position.set(x, 0.14, hz + 0.6);
      e.add(box(2.2, 1.5, 5.8, 0xd9483b, 0, 1.15, 0), box(2.1, 0.9, 1.6, 0xe9edf2, 0, 2.2, 1.9), box(0.24, 0.24, 5, 0xc8ccd2, 0.5, 2.1, -0.6));
      e.add(box(1.4, 0.18, 0.3, 0xd94f4f, 0, 2.75, 1.9, { emissive: 0xd94f4f, emissiveIntensity: 0.4 }));
      for (const sx of [-1.05, 1.05]) for (const sz of [-1.8, 1.8]) { const w = cyl(0.45, 0.45, 0.3, DARK, 10, sx, 0.45, sz); w.rotation.z = Math.PI / 2; e.add(w); }
      k.inside.add(e);
      const reel = cyl(0.5, 0.5, 0.3, 0xd9483b, 12, x - 1.6, 1.4, hz - hd / 2 + 0.5);
      reel.rotation.x = Math.PI / 2;
      k.inside.add(reel);
    }
    // Crew room: lockers with gear, the brass pole, a kitchen table.
    for (let n = 0; n < 5; n++) k.add('inside', box(0.85, 2.1, 0.6, 0x8a929e, 3.4 + n * 0.9, 1.19, hz - hd / 2 + 0.55), box(0.5, 0.35, 0.3, 0xe6c84f, 3.4 + n * 0.9, 1.9, hz - hd / 2 + 0.95));
    k.add('inside', cyl(0.08, 0.08, 4.9, 0xd8b24a, 8, 7.4, 2.55, hz + 1.2), cyl(0.6, 0.6, 0.05, 0x2b2f38, 16, 7.4, 0.17, hz + 1.2));
    k.table(5.2, hz + 1.6, 2.2, 1, WOOD_LIGHT, 2);
    k.add('inside', box(2.4, 0.95, 0.6, 0xe9edf2, 4.4, 0.62, hz + hd / 2 - 0.5));
    // Hose tower and a hydrant.
    k.ext.add(box(3.4, 12, 3.4, red, 10, 6, -5.5), box(3.8, 0.4, 3.8, trim, 10, 12.2, -5.5));
    k.ext.add(pane(1, 1.4, 10, 10, -3.78), cyl(0.28, 0.32, 0.5, 0xd9483b, 8, 10, 12.65, -5.5, { emissive: 0xd9483b, emissiveIntensity: 0.6 }));
    k.ext.add(cyl(0.2, 0.24, 0.8, 0xd9483b, 8, 9.6, 0.4, 6.2), ico(0.22, 0xd9483b, 9.6, 0.85, 6.2));
    k.top = 12.4;
  },

  /** 2 × 2 (16 × 16 m): front counter, desks, two holding cells; a patrol car out front. */
  police(k) {
    const wall = 0x9fb3cf, deep = 0x3c64b4, trim = 0xf2f4f8;
    k.lawn();
    k.ext.add(box(6, 0.05, 6, 0x7f7c8c, -4.5, 0.03, 4.6)); // parking
    k.path(k.doorX, 1.9);
    const hz = -2.6, hd = 9, hw = 13;
    k.hall({ z: hz, w: hw, d: hd, h: 4.4, wall, trim, floor: 0xd9dde3, roof: 0x2f3e5c,
      doors: [{ x: k.doorX, w: 1.8, h: 2.6 }], windows: { front: [-4.5, -2], back: [-4, 0, 4], left: [-1.5, 1.5], right: [-1.5] }, winColor: 0xcfe2ff });
    // Front counter and a waiting bench by the door.
    k.add('inside', box(4, 1.1, 0.7, deep, 2.2, 0.69, hz + 1.2), box(4.1, 0.08, 0.8, trim, 2.2, 1.28, hz + 1.2));
    k.desk(2.2, hz + 0.3, Math.PI, { color: 0x6b7a99 });
    k.bench(5.2, hz + 3.4, Math.PI, 'inside');
    // Two desks and filing cabinets.
    k.desk(-4.2, hz + 2.2, 0);
    k.desk(-1.6, hz + 2.2, 0);
    for (let n = 0; n < 3; n++) k.add('inside', box(0.6, 1.4, 0.6, 0x8a929e, -6 + n * 0.65, 0.84, hz + 3.9));
    // Holding cells at the back: bars and bunks.
    k.add('inside', box(0.2, 4.2, 3.2, trim, -0.5, 2.24, hz - 2.8));
    for (const cx of [-3.4, 2.6]) {
      for (let b = 0; b < 12; b++) k.add('inside', cyl(0.035, 0.035, 2.6, STEEL, 6, cx - 2.5 + b * 0.42, 1.44, hz - 1.2));
      k.add('inside', box(5.2, 0.08, 0.08, STEEL, cx, 2.75, hz - 1.2), box(1.8, 0.4, 0.8, 0xb7c0cc, cx, 0.4, hz - 3.8), box(1.7, 0.1, 0.7, 0xe7ebf2, cx, 0.65, hz - 3.8));
    }
    // Badge sign and roof light bar.
    k.add('ext', box(3.4, 0.8, 0.15, deep, -3, 3.6, hz + hd / 2 + 0.25), ico(0.32, 0xe6c84f, -4.3, 3.6, hz + hd / 2 + 0.38));
    k.add('roof', box(1.4, 0.25, 0.4, DARK, 0, 4.85, hz), box(0.6, 0.25, 0.42, 0xd94f4f, -0.4, 5.02, hz, { emissive: 0xd94f4f, emissiveIntensity: 0.7 }), box(0.6, 0.25, 0.42, 0x4f86ff, 0.4, 5.02, hz, { emissive: 0x4f86ff, emissiveIntensity: 0.7 }));
    k.vehicle(-5.6, 4.6, 0, trim, { cab: DARK, len: 3.8, wid: 1.8, h: 0.75, stripe: deep, lights: 0xd94f4f });
    k.flagpole(6.6, 5.6, deep);
    k.top = 8;
  },

  /** 3 × 2 (24 × 16 m): a portico, reading room with shelves, tables and a librarian's desk; a dome. */
  library(k) {
    const stone = 0xe7dfcf, roof = 0x7c6a9e, white = 0xf7f2e8;
    k.lawn();
    k.path(0, 3.6, 3);
    const hz = -2.4, hd = 10.4, hw = 19;
    k.ext.add(box(hw + 1, 0.5, hd + 1, 0xcfc6b4, 0, 0.25, hz)); // plinth
    k.hall({ z: hz, w: hw, d: hd, h: 5.6, wall: stone, trim: white, floor: 0xb08d63, roof,
      doors: [{ x: 0, w: 2.2, h: 3.4 }], windows: { front: [-6.5, -4, 4, 6.5], back: [-6, -2, 2, 6], left: [-2.5, 2.5], right: [-2.5, 2.5] }, winY: 3, winH: 2.4, winW: 1 });
    // Portico: steps, six columns and a pediment.
    for (let s = 0; s < 3; s++) k.ext.add(box(8 - s * 0.4, 0.2, 0.7, 0xcfc6b4, 0, 0.1 + s * 0.2, 5.6 - s * 0.6));
    for (let c = 0; c < 6; c++) k.ext.add(cyl(0.3, 0.34, 4.8, white, 10, -4 + c * 1.6, 2.9, 4.2));
    k.ext.add(box(9.4, 0.5, 2.4, white, 0, 5.55, 3.7), gable(9.6, 1.8, 2.4, white, 0, 5.8, 3.7));
    // Reading room: rows of shelves, a rug, reading tables with lamps, the librarian's desk and a globe.
    for (const x of [-7.6, -5.2, 5.2, 7.6]) k.shelf(x, hz - 0.6, 3.6, Math.PI / 2);
    for (const x of [-6, -2, 2, 6]) k.shelf(x, hz - hd / 2 + 0.5, 3.4);
    k.add('inside', box(6, 0.03, 4.4, 0x8a3b4a, 0, 0.16, hz + 0.6));
    for (const z of [hz - 0.2, hz + 1.9]) {
      k.table(0, z, 3.2, 1.1, WOOD, 3);
      for (const x of [-0.9, 0.9]) k.add('inside', cyl(0.03, 0.03, 0.4, 0xd8b24a, 6, x, 1.1, z), cyl(0.12, 0.22, 0.22, 0x3f7f5a, 10, x, 1.36, z));
    }
    k.add('inside', box(3, 1.05, 0.8, WOOD, -5.6, 0.66, hz + 3.6), box(3.1, 0.08, 0.9, WOOD_LIGHT, -5.6, 1.22, hz + 3.6));
    k.add('inside', cyl(0.06, 0.1, 0.9, WOOD, 6, 6, 0.6, hz + 3.6), ico(0.42, 0x4f86c6, 6, 1.3, hz + 3.6, 1));
    // Dome on the roof.
    const dome = new THREE.Mesh(new THREE.SphereGeometry(3, 18, 9, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x9a86c4, roughness: 0.45, metalness: 0.2, flatShading: true }));
    dome.position.set(0, 6.1, hz);
    dome.castShadow = true;
    k.add('roof', box(6.6, 0.8, 6.6, white, 0, 6.1, hz), dome, ico(0.3, 0xe6c84f, 0, 9.2, hz));
    k.tree(-10, 5.4); k.tree(10, 5.4);
    k.top = 9.6;
  },

  /** 4 × 3 (32 × 24 m): two classrooms off a hallway, a second storey, bell tower, playground and court. */
  school(k) {
    const brick = 0xd8a24a, trim = 0xfaf3e3, roof = 0x8a4a3a;
    k.lawn();
    k.path(k.doorX, 0.6);
    const hz = -5.4, hd = 12, hw = 27;
    k.hall({ z: hz, w: hw, d: hd, h: 4, wall: brick, trim, floor: 0xd9c9a8, roof: trim,
      doors: [{ x: k.doorX, w: 2.4, h: 2.8 }], windows: { front: [-11, -8.5, -6, -3, 9, 11.5], back: [-10, -6, -2, 2, 6, 10], left: [-3, 0, 3], right: [-3, 3] }, winY: 2.2, winH: 1.5 });
    // A hallway from the front door (x 1.5…6.5) with lockers along the back; a classroom either side.
    for (const x of [1.5, 6.5]) k.add('inside', box(0.2, 3.9, hd - 0.6, trim, x, 2.0, hz));
    for (let n = 0; n < 6; n++) k.add('inside', box(0.6, 1.8, 0.45, [0x4f86c6, 0xd94f4f, 0x5fbf73][n % 3], 2.2 + n * 0.72, 1.04, hz - hd / 2 + 0.45));
    const classroom = (cx, cols) => {
      k.add('inside', box(4.6, 1.3, 0.08, 0x2f4a3a, cx, 2.2, hz - hd / 2 + 0.22), box(4.8, 0.1, 0.16, WOOD, cx, 1.5, hz - hd / 2 + 0.3));
      k.desk(cx, hz - hd / 2 + 1.8, Math.PI, { screen: false, chair: false });
      for (let r = 0; r < 3; r++) for (let c = 0; c < cols; c++) {
        const x = cx - (cols - 1) * 1.2 + c * 2.4, z = hz - 1.8 + r * 2;
        k.add('inside', box(1, 0.06, 0.6, WOOD_LIGHT, x, 0.78, z), box(0.06, 0.64, 0.5, STEEL, x, 0.46, z), box(0.4, 0.06, 0.4, [0x4f86c6, 0xe56b8a, 0x5fbf73][(r + c) % 3], x, 0.5, z + 0.55));
      }
    };
    classroom(-6, 5);
    classroom(10, 3);
    // Second storey, gable roof and a bell tower with a clock.
    const top = k.storeys({ z: hz, w: hw, d: hd, from: 4, n: 1, fh: 3.6, wall: brick, band: trim, cols: 8 });
    k.add('roof', gable(hw + 0.6, 3, hd + 0.6, roof, 0, top, hz));
    k.add('roof', box(3, 4, 3, trim, k.doorX, top + 2, hz + 2), gable(3.4, 2, 3.4, roof, k.doorX, top + 4, hz + 2));
    const face = cyl(0.9, 0.9, 0.1, 0xffffff, 18, k.doorX, top + 2.4, hz + 3.55);
    face.rotation.x = Math.PI / 2;
    k.add('roof', face, box(0.08, 0.6, 0.06, DARK, k.doorX, top + 2.6, hz + 3.62), box(0.45, 0.08, 0.06, DARK, k.doorX + 0.18, top + 2.4, hz + 3.62));
    k.top = top + 6.4;
    // Playground (left) and a basketball court (right).
    k.ext.add(box(11, 0.05, 9, 0xd9b77e, -9.5, 0.03, 6.6));
    k.ext.add(box(0.8, 2, 0.8, 0x5fbf73, -12, 1, 5.4));
    const slide = box(0.8, 0.1, 3, 0xe56b8a, -12, 1.05, 7);
    slide.rotation.x = 0.6;
    k.ext.add(slide);
    for (const x of [-8.4, -5.4]) k.ext.add(cyl(0.06, 0.06, 2.6, STEEL, 6, x, 1.3, 6), cyl(0.06, 0.06, 2.6, STEEL, 6, x, 1.3, 7.6));
    k.ext.add(box(3.2, 0.1, 0.1, STEEL, -6.9, 2.6, 6), box(3.2, 0.1, 0.1, STEEL, -6.9, 2.6, 7.6));
    for (const x of [-7.8, -6]) k.ext.add(box(0.6, 0.06, 0.3, 0xe6c84f, x, 0.8, 6.8));
    k.ext.add(box(10, 0.05, 8, 0x7c8c9e, 9.5, 0.03, 6.8), box(9.6, 0.02, 0.08, 0xffffff, 9.5, 0.07, 6.8));
    k.ext.add(cyl(0.08, 0.08, 3, STEEL, 6, 9.5, 1.5, 10.4), box(1.2, 0.8, 0.06, 0xffffff, 9.5, 3, 10.3), cyl(0.3, 0.3, 0.05, 0xd9483b, 12, 9.5, 2.75, 10));
    k.flagpole(1, 7.6);
  },

  /** 4 × 4 (32 × 32 m): reception and waiting room, a ward of beds, four storeys, helipad, ambulance bay. */
  hospital(k) {
    const white = 0xf3f5f7, teal = 0x4fb3a5;
    k.lawn();
    k.ext.add(box(12, 0.05, 9, 0x7f7c8c, -8.6, 0.03, 10.6)); // parking
    for (const [x, c] of [[-12, 0x4f86c6], [-9.6, 0xe6c84f], [-7.2, 0x5fbf73]]) k.vehicle(x, 10.6, 0, c, { cab: c, len: 3.6, wid: 1.7, h: 0.7 });
    k.path(k.doorX, 2, 4);
    const hz = -6, hd = 16, hw = 27;
    k.hall({ z: hz, w: hw, d: hd, h: 4, wall: white, trim: teal, floor: 0xe3ecef, roof: teal,
      doors: [{ x: k.doorX, w: 3, h: 2.8 }], windows: { front: [-11, -8, -5, -2, 9, 12], back: [-10, -5, 0, 5, 10], left: [-5, 0, 5], right: [-5, 0, 5] }, winColor: 0xd8f2ff, winY: 2.2 });
    // Reception desk and waiting rows.
    k.add('inside', box(5, 1.1, 0.8, teal, k.doorX, 0.69, hz + 3.6), box(5.1, 0.08, 0.9, white, k.doorX, 1.28, hz + 3.6));
    k.desk(k.doorX - 1, hz + 2.7, Math.PI, { color: white });
    for (let r = 0; r < 2; r++) for (let c = 0; c < 5; c++) k.add('inside', box(0.5, 0.45, 0.5, 0x5aa3d9, 7 + c * 0.6, 0.37, hz + 5.2 - r * 1.4), box(0.5, 0.5, 0.08, 0x5aa3d9, 7 + c * 0.6, 0.74, hz + 5.45 - r * 1.4));
    // Ward: six beds with curtains, and a nurses' station.
    k.add('inside', box(0.2, 3.9, hd - 0.6, white, -1.6, 2.0, hz));
    for (let n = 0; n < 6; n++) {
      const x = -11.4 + (n % 3) * 3.4, z = n < 3 ? hz - 4.6 : hz + 0.6;
      k.bed(x, z, n < 3 ? 0 : Math.PI);
      k.add('inside', box(0.06, 2, 2.4, 0xbfe6e0, x + 1.7, 1.15, z));
    }
    k.add('inside', box(3, 1, 0.7, teal, -6, 0.64, hz + 4.4));
    k.desk(-6, hz + 5.2, 0);
    // Three more storeys, the red cross and a helipad.
    const top = k.storeys({ z: hz, w: hw, d: hd, from: 4, n: 3, fh: 3.4, wall: white, band: teal, winColor: 0xd8f2ff, cols: 8 });
    k.add('roof', box(3, 0.9, 0.3, 0xd94f4f, 6, top + 1.4, hz + hd / 2 - 1, { emissive: 0xd94f4f, emissiveIntensity: 0.35 }), box(0.9, 3, 0.3, 0xd94f4f, 6, top + 1.4, hz + hd / 2 - 1, { emissive: 0xd94f4f, emissiveIntensity: 0.35 }));
    k.add('roof', cyl(3.6, 3.6, 0.1, 0x59606e, 24, -6, top + 0.05, hz - 1), box(0.4, 0.04, 2.4, 0xffffff, -6.8, top + 0.12, hz - 1), box(0.4, 0.04, 2.4, 0xffffff, -5.2, top + 0.12, hz - 1), box(1.6, 0.04, 0.4, 0xffffff, -6, top + 0.12, hz - 1));
    k.top = top + 3;
    // Entrance canopy and the ambulance bay.
    k.ext.add(box(7, 0.3, 3.4, white, k.doorX, 3.2, 3.6), box(7.1, 0.12, 3.5, teal, k.doorX, 3.4, 3.6));
    for (const x of [k.doorX - 3.2, k.doorX + 3.2]) k.ext.add(cyl(0.14, 0.14, 3.1, STEEL, 6, x, 1.55, 5.1));
    k.vehicle(11, 6, Math.PI, white, { cab: white, len: 4.4, wid: 2, h: 1.6, stripe: 0xd94f4f, lights: 0xd94f4f });
    k.tree(-14, 3); k.tree(14, 12);
  },

  /** 4 × 3 (32 × 24 m): a fenced yard of heaps and skips, a weighbridge office (the interior) and a bulldozer. */
  city_dump(k) {
    k.ext.add(box(k.W - 0.8, 0.05, k.D - 0.8, 0x9c9378, 0, 0.03, 0));
    const fence = (w, x, z, ry) => {
      const f = box(w, 2, 0.06, 0x8b929c, x, 1, z, { roughness: 0.6, metalness: 0.4 });
      f.rotation.y = ry;
      f.material = f.material.clone();
      f.material.transparent = true;
      f.material.opacity = 0.55;
      f.userData.keep = true;
      k.ext.add(f);
    };
    fence(k.W - 1, 0, -k.D / 2 + 0.6, 0); fence(k.D - 1, -k.W / 2 + 0.6, 0, Math.PI / 2); fence(k.D - 1, k.W / 2 - 0.6, 0, Math.PI / 2);
    fence(k.W / 2 - 1.2, -k.W / 4 - 0.6, k.D / 2 - 0.6, 0); fence(k.W / 2 - 5.2, k.W / 4 + 3.2, k.D / 2 - 0.6, 0); // a gate at the door
    const heap = (x, z, r, c) => { const h = ico(r, c, x, r * 0.32, z, 1); h.scale.y = 0.5; k.ext.add(h); };
    heap(-10, -6, 4, 0x8a7f62); heap(-3, -7.5, 3.4, 0x6e7a52); heap(4.5, -6.8, 3.8, 0x7d6a58); heap(-10.5, 1.5, 2.6, 0x9a8a6c); heap(11, -6, 3, 0x857a64);
    for (const [x, z, c] of [[-9, -6.2, 0xd94f4f], [-7.6, -5, 0x4f86c6], [-2.4, -7, 0xe6c84f], [4, -5.4, 0x5fbf73], [6, -7.4, 0xffffff], [11, -5.2, 0xe56b8a]]) k.ext.add(box(0.7, 0.55, 0.6, c, x, 1.6, z));
    for (const [x, c] of [[-4, 0x3f7f5a], [-1, 0x4f6ec6], [2, 0xd9883a]]) k.ext.add(box(2.4, 1.3, 1.5, c, x, 0.65, 0), box(2.5, 0.12, 1.6, 0x2b2f38, x, 1.36, 0));
    // Bulldozer and a garbage truck.
    k.ext.add(box(2, 1.1, 2.6, 0xe6b43a, -6, 0.85, 3), box(1.4, 1, 1.2, 0xe6b43a, -6, 1.9, 2.4), box(2.6, 1, 0.2, 0x5b5f66, -6, 0.6, 4.5));
    for (const x of [-7.05, -4.95]) k.ext.add(box(0.45, 0.75, 2.8, DARK, x, 0.38, 3));
    k.vehicle(-12, 6.6, 0, 0x5fbf73, { cab: 0xe9edf2, len: 5, wid: 2.1, h: 1.8 });
    // Weighbridge office at the gate (walk-in), and the weighbridge plate.
    const oz = 6.2;
    k.hall({ x: k.doorX + 6, z: oz, w: 6, d: 5, h: 3, wall: 0xb7c0a4, trim: 0x5d6650, floor: 0xbdb6a6, roof: 0x5d6650,
      doors: [{ x: -1.8, w: 1.1, h: 2.2 }], windows: { left: [0], front: [1], back: [-1, 1] }, winY: 1.8, winH: 0.9 });
    k.desk(k.doorX + 6.6, oz - 0.8, 0);
    k.add('inside', box(0.6, 1.4, 0.5, 0x8a929e, k.doorX + 8.4, 0.84, oz - 1.9), box(1.6, 0.9, 0.5, WOOD, k.doorX + 4.4, 0.6, oz - 2));
    k.ext.add(box(3.4, 0.12, 7, 0x6c737e, k.doorX, 0.08, k.D / 2 - 5));
    k.top = 5;
  },

  /** 2 × 2 (16 × 16 m): the tank on its legs, and a pump house you can see into. */
  water_tower(k) {
    const blue = 0x5aa3d9;
    k.lawn();
    k.ext.add(box(9, 0.05, 9, PAVING, 2, 0.03, -2.6));
    k.path(k.doorX, -0.6, 1.6);
    const tx = 2, tz = -3.4;
    for (const [x, z] of [[-2.4, -2.4], [2.4, -2.4], [-2.4, 2.4], [2.4, 2.4]]) k.ext.add(cyl(0.18, 0.26, 13, STEEL, 6, tx + x, 6.5, tz + z));
    for (const y of [4.5, 9]) k.ext.add(box(5, 0.12, 0.12, STEEL, tx, y, tz - 2.4), box(5, 0.12, 0.12, STEEL, tx, y, tz + 2.4), box(0.12, 0.12, 5, STEEL, tx - 2.4, y, tz), box(0.12, 0.12, 5, STEEL, tx + 2.4, y, tz));
    k.ext.add(cyl(0.3, 0.3, 13, STEEL, 8, tx, 6.5, tz));
    k.ext.add(cyl(3.6, 3.6, 4.4, blue, 18, tx, 15.2, tz), cyl(3.75, 3.75, 0.3, 0xe9eef3, 18, tx, 13.1, tz), cyl(0.2, 3.85, 1.9, 0x3f6f99, 18, tx, 18.3, tz));
    k.ext.add(box(4, 0.7, 0.1, 0xffffff, tx, 15.4, tz + 3.62));
    // Pump house: two pumps, pipes up to the riser, valve wheels and a control panel.
    const px = -3.6, pz = 2.4;
    k.hall({ x: px, z: pz, w: 6.4, d: 6, h: 3.2, wall: 0xd9d4ca, trim: 0x3f6f99, floor: 0xb8bcc2, roof: 0x3f6f99,
      doors: [{ x: 1.6, w: 1.2, h: 2.3 }], windows: { front: [-1.6], left: [0], back: [0] }, winY: 2, winH: 0.9 });
    for (const x of [px - 1.6, px]) {
      const pump = cyl(0.5, 0.5, 1.4, blue, 12, x, 0.84, pz - 1.4);
      pump.rotation.z = Math.PI / 2;
      k.add('inside', pump, box(1.6, 0.3, 0.9, DARK, x, 0.29, pz - 1.4), cyl(0.12, 0.12, 2.4, STEEL, 8, x, 1.6, pz - 2.2));
      const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.25, 0.04, 6, 14), new THREE.MeshStandardMaterial({ color: 0xd94f4f, roughness: 0.5 }));
      wheel.position.set(x + 0.7, 1.4, pz - 1.4);
      k.inside.add(wheel);
    }
    k.add('inside', box(1.6, 1.4, 0.4, 0x6c737e, px + 1.6, 0.84, pz - 2.6), pane(1.1, 0.5, px + 1.6, 1.15, pz - 2.38, 0x9fffc4, 0.7));
    k.add('ext', box(0.25, 0.25, 6.6, STEEL, -0.6, 0.6, tz + 2.4 - 0.2)); // feed main to the riser
    k.top = 19.4;
  },

  /** 4 × 4 (32 × 32 m): a turbine hall with two generators and a control room; cooling towers and a stack. */
  power_plant(k) {
    const wall = 0xc9cdd3, yellow = 0xe8c547;
    k.ext.add(box(k.W - 0.6, 0.05, k.D - 0.6, 0xbab4a8, 0, 0.03, 0));
    k.path(k.doorX, 9.4, 2.4);
    const hx = -2, hz = 4.4, hw = 18, hd = 10;
    k.hall({ x: hx, z: hz, w: hw, d: hd, h: 6, wall, trim: yellow, floor: 0x9aa0a8, roof: 0x5b6470,
      doors: [{ x: k.doorX - hx, w: 2.4, h: 3 }, { x: -4, w: 4.2, h: 4.4 }], windows: { front: [-7.5, 1.5, 3.5], back: [-6, -2, 2, 6], left: [-2, 2], right: [-2.5, 2.5] }, winColor: 0xfff1c7, winY: 4.4 });
    // Two turbine-generator sets on plinths, a gantry crane rail and a glass control room.
    for (const z of [hz - 2.3, hz + 1.2]) {
      k.add('inside', box(9, 0.5, 1.8, DARK, hx - 2, 0.39, z));
      const shaft = cyl(0.7, 0.9, 6, 0x5aa3d9, 14, hx - 3, 1.5, z);
      shaft.rotation.z = Math.PI / 2;
      k.add('inside', shaft, box(2.4, 2, 1.6, yellow, hx + 1.6, 1.64, z), cyl(0.16, 0.16, 3, STEEL, 8, hx - 6.2, 2.6, z));
    }
    k.add('inside', box(hw - 1, 0.25, 0.3, yellow, hx, 5.3, hz - hd / 2 + 0.5), box(hw - 1, 0.25, 0.3, yellow, hx, 5.3, hz + hd / 2 - 0.5));
    const cr = hx + 6.4;
    k.add('inside', box(0.12, 3, 4, 0xbfe6ff, cr - 2, 1.64, hz - 2.4), box(4, 3, 0.12, 0xbfe6ff, cr, 1.64, hz - 0.4));
    k.add('inside', box(3.4, 0.9, 0.7, 0x6c737e, cr, 0.6, hz - 4.1), pane(3, 0.6, cr, 1.45, hz - 4.4, 0x9fffc4, 0.8));
    k.desk(cr, hz - 2.5, 0);
    // Cooling towers, a striped stack, a switchyard and a pylon.
    for (const [x, z] of [[8.4, -8.6], [-4.6, -9.6]]) {
      const pts = [[4.2, 0], [3.2, 3.6], [2.8, 7.2], [3.1, 10.2], [3.4, 11]].map(([r, y]) => new THREE.Vector2(r, y));
      const tower = new THREE.Mesh(new THREE.LatheGeometry(pts, 22), new THREE.MeshStandardMaterial({ color: 0xe3e1db, roughness: 0.9, side: THREE.DoubleSide, flatShading: true }));
      tower.position.set(x, 0, z);
      tower.castShadow = tower.receiveShadow = true;
      tower.userData.keep = true;
      k.ext.add(tower);
    }
    k.ext.add(cyl(0.6, 0.9, 15, 0xe9e9e9, 10, 12, 7.5, 1.2));
    for (const y of [11.8, 13.8]) k.ext.add(cyl(0.65, 0.68, 0.8, 0xd94f4f, 10, 12, y, 1.2));
    k.ext.add(box(7, 0.05, 6, 0x9c9a92, 11, 0.04, 10.5));
    for (const [x, z] of [[9.4, 9.4], [11, 9.4], [12.6, 9.4], [9.4, 11.6], [11, 11.6], [12.6, 11.6]]) k.ext.add(box(1, 1.4, 1, 0x7d8794, x, 0.7, z), cyl(0.08, 0.08, 0.8, 0xe9e9e9, 6, x, 1.8, z));
    k.ext.add(cyl(0.1, 0.35, 9, 0x8b929c, 4, -13, 4.5, 12), box(4, 0.15, 0.15, 0x8b929c, -13, 8.4, 12), box(3, 0.15, 0.15, 0x8b929c, -13, 7.2, 12));
    k.top = 15.4;
  },
};

/** Steam puffs over the cooling towers (animated). */
function steam(k) {
  const puffs = [];
  const m = new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0.5, roughness: 1, depthWrite: false });
  for (const [x, z] of [[8.4, -8.6], [-4.6, -9.6]]) for (let n = 0; n < 3; n++) {
    const p = new THREE.Mesh(new THREE.IcosahedronGeometry(1.7, 1), m.clone());
    p.position.set(x, 11, z);
    p.userData = { dynamic: true, x, z, phase: n / 3 };
    k.root.add(p);
    puffs.push(p);
  }
  return puffs;
}

/** Build one civic building in its own frame. */
export function buildCivic(kind) {
  const k = new Kit(kind);
  BUILD[kind](k);
  k.ext.add(buildLightPool(5, 3, k.doorX, 0.1, k.D / 2 - 2));
  for (const g of [k.ext, k.inside, k.roof]) mergeStatic(g);
  const puffs = kind === 'power_plant' ? steam(k) : [];
  const glows = [];
  k.root.traverse((o) => o.userData.glow && glows.push(o));
  return { root: k.root, roof: k.roof, walls: k.walls, halls: k.halls, glows, puffs, top: k.top, W: k.W, D: k.D };
}

// ---- Pictures for the build list --------------------------------------------------------------

let pictures = null;
/** A rendered picture of each building (data URLs), made once with a small offscreen renderer. */
export function civicPictures() {
  if (pictures) return pictures;
  pictures = {};
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  } catch { return pictures; }
  renderer.setPixelRatio(1);
  renderer.setSize(360, 240, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight(0xeaf2ff, 0x8a9a6a, 1.6));
  const sun = new THREE.DirectionalLight(0xfff1dc, 2.2);
  sun.position.set(14, 26, 18);
  scene.add(sun);
  const camera = new THREE.PerspectiveCamera(26, 1.5, 0.5, 500);
  for (const kind of CIVIC_KINDS) {
    const b = buildCivic(kind);
    scene.add(b.root);
    const bounds = new THREE.Box3().setFromObject(b.root);
    const sphere = bounds.getBoundingSphere(new THREE.Sphere());
    const dir = new THREE.Vector3(0.9, 0.85, 1.25).normalize();
    const dist = sphere.radius / Math.sin(THREE.MathUtils.degToRad(camera.fov / 2)) * 0.82;
    camera.position.copy(sphere.center).addScaledVector(dir, dist);
    camera.lookAt(sphere.center);
    renderer.render(scene, camera);
    pictures[kind] = renderer.domElement.toDataURL('image/png');
    scene.remove(b.root);
    b.root.traverse((o) => { o.geometry?.dispose(); if (o.userData?.glow || o.userData?.dynamic) o.material?.dispose?.(); });
  }
  renderer.dispose();
  renderer.forceContextLoss?.();
  return pictures;
}

// ---- In the town ------------------------------------------------------------------------------

export class CivicBuildings {
  constructor(scene) {
    this.group = new THREE.Group();
    this.group.name = 'civic';
    scene.add(this.group);
    this.items = new Map(); // kind → building
    this.wallMode = 'cutaway';
  }

  /** Rebuild buildings whose placement changed; remove ones taken off the map. */
  setTown(town) {
    const placed = new Map((town?.civic || []).filter((c) => CIVIC[c.kind]).map((c) => [c.kind, c]));
    for (const [kind, it] of this.items) {
      const c = placed.get(kind);
      if (c && it.key === `${c.i},${c.j},${c.rot}`) continue;
      this.dispose(it);
      this.items.delete(kind);
    }
    for (const [kind, c] of placed) {
      if (this.items.has(kind)) continue;
      const b = buildCivic(kind);
      const t = civicTransform(c);
      b.root.position.set(t.x, 0, t.z);
      b.root.rotation.y = t.yaw;
      const el = document.createElement('div');
      el.className = 'civic-sign';
      el.style.setProperty('--c', `#${CIVIC[kind].color.toString(16).padStart(6, '0')}`);
      el.innerHTML = `${icon(CIVIC[kind].icon)}<b>${esc(CIVIC[kind].name)}</b>`;
      const label = new CSS2DObject(el);
      label.position.set(0, b.top + 1.4, 0);
      b.root.add(label);
      this.group.add(b.root);
      this.items.set(kind, { ...b, label, key: `${c.i},${c.j},${c.rot}`, yaw: t.yaw, roofOn: true, roofK: 1, roofV: 0 });
    }
  }

  /** World rectangles [x0, z0, x1, z1] of every hall, for the weather (rooms stay dry). */
  rooms() {
    const out = [];
    for (const it of this.items.values()) {
      const c = Math.cos(it.yaw), s = Math.sin(it.yaw), o = it.root.position;
      for (const [x0, z0, x1, z1] of it.halls) {
        const pts = [[x0, z0], [x1, z0], [x0, z1], [x1, z1]].map(([x, z]) => [o.x + x * c + z * s, o.z - x * s + z * c]);
        out.push([Math.min(...pts.map((p) => p[0])), Math.min(...pts.map((p) => p[1])), Math.max(...pts.map((p) => p[0])), Math.max(...pts.map((p) => p[1]))]);
      }
    }
    return out;
  }

  dispose(it) {
    it.label.element.remove();
    it.label.removeFromParent();
    this.group.remove(it.root);
    it.root.traverse((o) => {
      o.geometry?.dispose();
      if (o.userData?.glow || o.userData?.dynamic) o.material?.dispose?.();
    });
  }

  /**
   * Per frame: night glow, steam, and the dollhouse view: up close (or with the building centred in view) the
   * roof lifts away and the walls between the camera and the room drop, like a home.
   */
  update(dt, t, { night = 0, camera = null, target = null, peekOpen = 60 } = {}) {
    for (const it of this.items.values()) {
      for (const g of it.glows) g.material.emissiveIntensity = g.material.userData.dayGlow + night * g.material.userData.nightGlow;
      for (const p of it.puffs) {
        const k = (t * 0.12 + p.userData.phase) % 1;
        p.position.set(p.userData.x + k * 1.8, 11 + k * 8, p.userData.z);
        p.scale.setScalar(0.6 + k * 1.5);
        p.material.opacity = 0.55 * Math.sin(k * Math.PI);
      }
      if (!camera) continue;
      const c = it.root.position;
      const camDist = camera.position.distanceTo(c);
      const centred = target && Math.abs(target.x - c.x) < Math.max(it.W, it.D) / 2 && Math.abs(target.z - c.z) < Math.max(it.W, it.D) / 2;
      const openBelow = centred ? Math.max(48, peekOpen) : 40 + Math.max(it.W, it.D) * 0.4;
      if (this.wallMode === 'down') it.roofOn = false;
      else if (it.roofOn && camDist < openBelow) it.roofOn = false;
      else if (!it.roofOn && camDist > openBelow + 8) it.roofOn = true;
      const goal = it.roofOn ? 1 : 0;
      it.roofV += ((goal - it.roofK) * 70 - it.roofV * 11) * dt;
      it.roofK += it.roofV * dt;
      if (Math.abs(goal - it.roofK) < 0.001 && Math.abs(it.roofV) < 0.01) it.roofK = goal;
      const k = THREE.MathUtils.clamp(it.roofK, 0, 1.08);
      it.roof.visible = k > 0.02;
      it.roof.position.y = (1 - Math.min(k, 1)) * (6 + it.top * 0.3);
      // Cutaway: walls facing the camera drop while the roof is off.
      const cx = camera.position.x - c.x, cz = camera.position.z - c.z;
      const cos = Math.cos(it.yaw), sin = Math.sin(it.yaw);
      const toCam = new THREE.Vector3(cx * cos - cz * sin, 0, cx * sin + cz * cos).normalize();
      for (const w of it.walls) {
        let s = 1;
        if (it.roofK <= 0.3) s = this.wallMode === 'down' ? CUT_SCALE : this.wallMode === 'cutaway' && w.userData.normal.dot(toCam) > 0.15 ? CUT_SCALE : 1;
        w.userData.scale += (s - w.userData.scale) * (1 - Math.exp(-dt * 7));
        w.scale.y = w.userData.scale;
        for (const win of w.userData.windows) win.visible = w.userData.scale > 0.75;
      }
    }
  }
}

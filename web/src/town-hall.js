// The Town Hall: a domed civic building at the head of the town square (commons.js). Game space only: Mayor
// Martin's office and the town's rooms are scenery and never reflect agent activity.
//
// Coordinates here are hall-local (the hall group sits at HALL.x, HALL.z in the square; +z faces the street).
// The building: a stone podium; a main block with a six-column portico; two lower wings; a balustraded roof with
// a drum, dome, lantern and finial. Inside, five rooms read clearly in the cutaway: the entrance lobby, the domed
// rotunda with a model of the town, the records archive, the council chamber and the mayor's office.

import * as THREE from 'three';
import { PALETTE, box, cyl, ico, mergeStatic, softBox } from './models.js';
import { buildArmchair, buildBookshelf, buildCouch, buildFireplace, buildGlobe, buildReception, buildRug, buildSideTable } from './furniture.js';

/** Where the hall sits in the square, its footprint (half sizes, incl. steps) and Mayor Martin's way in. */
export const HALL = {
  x: 0, z: -18,
  w: 13.6, front: 11.2, back: 7.4, // footprint: x ±w, z from −back to +front (steps)
  floor: 0.6, // top of the podium (the interior floor)
};
const toSquare = (x, z) => [HALL.x + x, HALL.z + z];
/** Mayor Martin's chair (square coordinates), the way he faces seated, and his walk from the square. */
export const MAYOR_SEAT = { x: HALL.x + 11.45, y: HALL.floor, z: HALL.z - 0.4, yaw: -Math.PI / 2 };
export const MAYOR_ROUTE = [[2.1, -6.2], [0, -7.0], ...[[0, 6.4], [0, 5.3], [6.6, 5.3], [6.6, 3.2], [8.2, 2.7], [11.6, 2.5], [11.6, 0.7]].map(([x, z]) => toSquare(x, z)), [MAYOR_SEAT.x, MAYOR_SEAT.z]];
/** Height of the walking surface at a square z (steps rise from the forecourt to the podium). */
export const hallFloorAt = (z) => THREE.MathUtils.lerp(0.12, HALL.floor, THREE.MathUtils.clamp((-(z - HALL.z) + 11) / 1.4, 0, 1));
/** The front doors swing open while the mayor walks through them (square z range). */
export const DOOR_ZONE = [HALL.z + 5.6, HALL.z + 8.4];

const STONE = 0xf1e8d6;
const STONE_SHADE = 0xe0d3bb;
const TRIM = 0xd5c29c;
const PLINTH = 0xcbbd9f;
const DOME = 0x5f9e8f;
const DOME_DARK = 0x467d71;
const GOLD = 0xe2b64d;
const WOOD = PALETTE.wood;

/** A square frustum scaled to w × d (hip roofs). */
function frustum(w, h, d, topK, color, x, y, z) {
  const geo = new THREE.CylinderGeometry(Math.SQRT2 * topK, Math.SQRT2, 1, 4, 1);
  geo.rotateY(Math.PI / 4);
  geo.scale(w / 2, h, d / 2);
  const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.8 }));
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  m.userData.ownMaterial = true;
  return m;
}

/** A triangular prism (pediment) across x, depth along z, base at y. */
function pediment(w, h, d, color, x, y, z) {
  const tri = new THREE.Shape([new THREE.Vector2(-w / 2, 0), new THREE.Vector2(w / 2, 0), new THREE.Vector2(0, h)]);
  const geo = new THREE.ExtrudeGeometry(tri, { depth: d, bevelEnabled: false });
  geo.translate(0, 0, -d / 2);
  const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.85 }));
  m.position.set(x, y, z);
  m.castShadow = true;
  m.userData.ownMaterial = true;
  return m;
}

/**
 * Build the Town Hall into group `g` (hall-local). Returns the parts the square animates: cutaway walls, the
 * interior partitions, the front doors, the roof stack that lifts away, glowing windows and lamps, and the
 * obstacle rects (hall-local) for the square's nav.
 */
export function buildTownHall(g, { outcomes = 0 } = {}) {
  const F = HALL.floor;
  const glows = [];
  // Hall windows share one material of their own (never the shared palette cache: it would make every box of
  // that colour glow at night).
  const glass = new THREE.MeshStandardMaterial({ color: 0x9dc8c4, emissive: 0xffb45e, emissiveIntensity: 0.1, roughness: 0.15, metalness: 0.1 });
  glass.userData.dayGlow = 0.08;
  const lampMat = new THREE.MeshStandardMaterial({ color: 0xfff1c9, emissive: 0xffd28a, emissiveIntensity: 0.3 });
  lampMat.userData.dayGlow = 0.25;
  for (const m of [glass, lampMat]) m.userData.ownMaterial = true;
  const glowing = (mesh, nightGlow) => {
    mesh.userData.nightGlow = nightGlow;
    mesh.userData.dynamic = true;
    glows.push(mesh);
    return mesh;
  };
  const lit = (geo, material, nightGlow, x, y, z) => {
    const m = new THREE.Mesh(geo, material);
    m.position.set(x, y, z);
    m.userData.ownMaterial = false;
    return glowing(m, nightGlow);
  };

  // ---- Podium, steps and forecourt (static) ------------------------------------------------------
  g.add(box(27.4, 0.36, 14.6, PLINTH, 0, 0.18, 0));
  g.add(box(26.8, 0.26, 14.0, TRIM, 0, 0.47, 0));
  for (let i = 0; i < 5; i++) g.add(box(12.4 - i * 0.3, 0.13, 1.4 - i * 0.26, TRIM, 0, 0.065 + i * 0.12, 10.3 - i * 0.14));
  for (const s of [-1, 1]) {
    g.add(box(0.7, 0.9, 1.6, STONE_SHADE, s * 6.55, 0.45, 10.1));
    g.add(ico(0.32, GOLD, s * 6.55, 1.15, 10.1, 1));
  }
  g.add(Object.assign(box(11.6, 0.05, 6.2, 0xe9e0d2, 0, 0.07, 14.1), { castShadow: false }));
  for (let i = 0; i < 6; i++) g.add(Object.assign(box(11.6, 0.052, 0.06, 0xd8ccb8, 0, 0.073, 11.6 + i), { castShadow: false }));
  // Forecourt lamps, hedges and flower beds in front of the wings.
  for (const s of [-1, 1]) {
    for (const z of [11.6, 16.2]) {
      g.add(cyl(0.07, 0.1, 2.6, PALETTE.dark, 8, s * 5.0, 1.3, z));
      g.add(box(0.34, 0.08, 0.34, PALETTE.dark, s * 5.0, 2.62, z));
      g.add(lit(new THREE.BoxGeometry(0.26, 0.34, 0.26), lampMat, 2.6, s * 5.0, 2.84, z));
    }
    g.add(softBox(0.6, 0.8, 5.0, PALETTE.leafDark, s * 5.7, 0.45, 14.0, 0.12));
    g.add(box(6.0, 0.18, 2.2, 0x6b4a33, s * 9.8, 0.09, 8.4));
    for (let k = 0; k < 14; k++) g.add(ico(0.12, PALETTE.flowers[k % PALETTE.flowers.length], s * (7.1 + (k % 7) * 0.85), 0.32, 7.8 + Math.floor(k / 7) * 1.1));
    // Flagpoles flank the steps.
    g.add(cyl(0.05, 0.07, 6.6, 0xd9d4ca, 8, s * 7.6, 3.3, 10.6));
    g.add(ico(0.1, GOLD, s * 7.6, 6.65, 10.6, 1));
    g.add(box(1.5, 0.95, 0.04, s < 0 ? 0x3b6fb6 : 0x2f8f6f, s * 7.6 + s * 0.78, 6.0, 10.6));
    g.add(box(0.5, 0.3, 0.05, 0xf4ead2, s * 7.6 + s * 0.78, 6.0, 10.62));
  }

  // ---- Exterior walls (lower toward the camera in cutaway) -------------------------------------------
  const walls = [];
  const H = 4.2; // main block storey
  const HW = 3.4; // wings
  const makeWall = ({ normal, x, z, len, h, windows = [], door = false, extras }) => {
    const wall = new THREE.Group();
    wall.position.set(x, F, z);
    wall.userData.dynamic = true;
    wall.userData.normal = new THREE.Vector3(...normal);
    wall.userData.scale = 1;
    wall.userData.windows = [];
    const alongX = normal[2] !== 0;
    const out = alongX ? normal[2] : normal[0];
    const piece = (a0, a1, y0, y1, depth, color, off = 0) => {
      const l = a1 - a0;
      if (l <= 0.01) return;
      const c = (a0 + a1) / 2;
      wall.add(alongX ? box(l, y1 - y0, depth, color, c, (y0 + y1) / 2, off * out) : box(depth, y1 - y0, l, color, off * out, (y0 + y1) / 2, c));
    };
    const at = (a, y, n) => (alongX ? [a, y, n * out] : [n * out, y, a]);
    // Solid wall with a door opening.
    if (door) {
      piece(-len / 2, -1.4, 0, h, 0.32, STONE);
      piece(1.4, len / 2, 0, h, 0.32, STONE);
      piece(-1.4, 1.4, 3.3, h, 0.32, STONE);
    } else piece(-len / 2, len / 2, 0, h, 0.32, STONE);
    piece(-len / 2 - 0.05, len / 2 + 0.05, 0, 0.5, 0.42, PLINTH);
    piece(-len / 2 - 0.08, len / 2 + 0.08, h - 0.3, h, 0.46, TRIM);
    piece(-len / 2 - 0.04, len / 2 + 0.04, h - 0.62, h - 0.52, 0.4, TRIM);
    // Pilasters between the windows, and tall windows with arched heads.
    const bays = [-len / 2 + 0.25, ...windows.flatMap((c) => [c - 0.95, c + 0.95]), len / 2 - 0.25].sort((a, b) => a - b);
    for (const p of bays) piece(p - 0.17, p + 0.17, 0.5, h - 0.3, 0.44, STONE_SHADE);
    for (const c of windows) {
      const win = new THREE.Group();
      win.userData.dynamic = true;
      const pane = new THREE.Mesh(alongX ? new THREE.BoxGeometry(1.0, 2.1, 0.05) : new THREE.BoxGeometry(0.05, 2.1, 1.0), glass);
      pane.position.set(...at(c, 2.05, 0.19));
      glowing(pane, 0.75);
      win.add(pane);
      const inner = pane.clone();
      inner.position.set(...at(c, 2.05, -0.19));
      win.add(inner);
      // A fanlight over the window under a stone head.
      const fan = new THREE.Mesh(alongX ? new THREE.BoxGeometry(0.7, 0.32, 0.05) : new THREE.BoxGeometry(0.05, 0.32, 0.7), glass);
      fan.position.set(...at(c, 3.32, 0.19));
      win.add(fan);
      win.add(alongX ? box(1.0, 0.1, 0.16, TRIM, c, 3.13, 0.21 * out) : box(0.16, 0.1, 1.0, TRIM, 0.21 * out, 3.13, c));
      for (const [l, hh, y, a] of [[1.2, 0.1, 0.95, c], [0.08, 2.2, 2.05, c - 0.54], [0.08, 2.2, 2.05, c + 0.54], [1.0, 0.07, 2.05, c]]) {
        win.add(alongX ? box(l, hh, 0.16, TRIM, a, y, 0.21 * out) : box(0.16, hh, l, TRIM, 0.21 * out, y, a));
      }
      win.add(alongX ? box(0.5, 0.36, 0.14, TRIM, c, 3.52, 0.22 * out) : box(0.14, 0.36, 0.5, TRIM, 0.22 * out, 3.52, c)); // keystone
      wall.add(win);
      wall.userData.windows.push(win);
    }
    extras?.(wall, at, out);
    const statics = new THREE.Group();
    for (const child of [...wall.children]) if (!child.userData.dynamic) statics.add(child);
    mergeStatic(statics);
    wall.add(statics);
    g.add(wall);
    walls.push(wall);
    return wall;
  };

  const doors = [];
  // Main block: front with the portico and doors, back, and the short ends beside the wings.
  makeWall({
    normal: [0, 0, 1], x: 0, z: 6.85, len: 18.3, h: H, windows: [-7.2, 7.2], door: true,
    extras: (wall) => {
      // Six columns, bases and capitals: the portico lowers with the front wall so the lobby stays in view.
      for (const x of [-4.6, -2.75, -0.92, 0.92, 2.75, 4.6]) {
        wall.add(box(0.72, 0.3, 0.72, TRIM, x, 0.15, 2.3));
        wall.add(cyl(0.29, 0.33, H - 0.6, STONE, 12, x, 0.3 + (H - 0.6) / 2, 2.3));
        wall.add(box(0.74, 0.3, 0.74, TRIM, x, H - 0.15, 2.3));
      }
      for (const sign of [-1, 1]) {
        const hinge = new THREE.Group();
        hinge.position.set(sign * 1.36, 0, 0.12);
        hinge.userData.dynamic = true;
        hinge.add(box(1.32, 3.2, 0.1, 0x3a5d57, -sign * 0.66, 1.6, 0));
        for (const y of [0.9, 2.3]) hinge.add(box(1.0, 0.9, 0.04, 0x2f4d48, -sign * 0.66, y, 0.06));
        hinge.add(ico(0.08, GOLD, -sign * 0.2, 1.55, 0.09, 1));
        wall.add(hinge);
        doors.push({ hinge, sign });
      }
      wall.add(box(3.2, 0.24, 0.5, TRIM, 0, 3.42, 0.1));
    },
  });
  makeWall({ normal: [0, 0, -1], x: 0, z: -6.85, len: 18.3, h: H, windows: [-6.6, -3.3, 0, 3.3, 6.6] });
  for (const s of [-1, 1]) {
    makeWall({ normal: [s, 0, 0], x: s * 9.0, z: -6.0, len: 1.7, h: H });
    makeWall({ normal: [s, 0, 0], x: s * 9.0, z: 5.5, len: 2.7, h: H });
    // Wings.
    makeWall({ normal: [s, 0, 0], x: s * 13.0, z: -0.45, len: 9.1, h: HW, windows: [-2.6, 0, 2.6] });
    makeWall({ normal: [0, 0, 1], x: s * 11.0, z: 4.0, len: 4.3, h: HW, windows: [0] });
    makeWall({ normal: [0, 0, -1], x: s * 11.0, z: -4.9, len: 4.3, h: HW, windows: [0] });
  }

  // ---- Interior: floors, partitions and the five rooms ---------------------------------------------
  const inside = new THREE.Group();
  const floor = (w, d, color, x, z) => inside.add(Object.assign(box(w, 0.04, d, color, x, F + 0.02, z), { castShadow: false }));
  floor(17.6, 13.4, 0xd9cdb4, 0, 0); // stone floor of the main block
  for (const s of [-1, 1]) floor(4.0, 8.6, 0x9a6f4c, s * 10.85, -0.45); // wood in the wings
  floor(17.4, 2.4, 0xe6dccb, 0, 5.4); // lobby
  for (let x = -8.4; x <= 8.4; x += 1.2) floor(0.04, 2.4, 0xc9bca2, x, 5.4);
  // Rotunda mosaic: rings and a compass star under the dome.
  for (const [r, c] of [[3.0, 0xc9a96b], [2.7, 0xefe4cc], [2.0, 0x6f9f94], [1.6, 0xefe4cc]]) {
    const ring = cyl(r, r, 0.02, c, 32, 0, F + 0.05 + (3.0 - r) * 0.004, 0.7);
    ring.castShadow = false;
    inside.add(ring);
  }
  for (let i = 0; i < 8; i++) {
    const ray = box(0.16, 0.02, 2.6, i % 2 ? 0xc9a96b : 0x466965, 0, F + 0.07, 0.7);
    ray.rotation.y = (i / 8) * Math.PI;
    inside.add(ray);
  }
  // Partitions: lobby line, rotunda sides, records line.
  const partitions = new THREE.Group();
  partitions.userData.dynamic = true;
  partitions.userData.scale = 1;
  const wallSeg = (x0, z0, x1, z1) => partitions.add(box(Math.max(0.16, x1 - x0), H - 0.4, Math.max(0.16, z1 - z0), 0xf7efe0, (x0 + x1) / 2, F + (H - 0.4) / 2, (z0 + z1) / 2), box(Math.max(0.18, x1 - x0), 0.14, Math.max(0.18, z1 - z0), TRIM, (x0 + x1) / 2, F + 0.07, (z0 + z1) / 2));
  wallSeg(-8.7, 3.95, -7.6, 4.11); wallSeg(-5.6, 3.95, -1.6, 4.11); wallSeg(1.6, 3.95, 5.6, 4.11); wallSeg(7.6, 3.95, 8.7, 4.11);
  for (const s of [-1, 1]) {
    const x0 = s * 4.5 - 0.08;
    wallSeg(Math.min(x0, x0 + 0.16), -6.7, Math.max(x0, x0 + 0.16), -0.9);
    wallSeg(Math.min(x0, x0 + 0.16), 0.9, Math.max(x0, x0 + 0.16), 3.95);
  }
  wallSeg(-4.5, -2.68, -1.0, -2.52); wallSeg(1.0, -2.68, 4.5, -2.52);
  // Arches over the three wide openings.
  for (const [x, z, w, along] of [[0, 4.03, 3.2, 'x'], [-4.5, 0, 1.8, 'z'], [4.5, 0, 1.8, 'z'], [0, -2.6, 2.0, 'x']]) {
    partitions.add(along === 'x' ? box(w, 0.6, 0.3, TRIM, x, F + H - 0.7, z) : box(0.3, 0.6, w, TRIM, x, F + H - 0.7, z));
  }
  mergeStatic(partitions);
  g.add(partitions);

  // Lobby: the clerk's counter, benches, a notice board and planters.
  const place = (obj, x, z, yaw = 0) => {
    obj.position.set(x, F, z);
    obj.rotation.y = yaw;
    inside.add(obj);
    return obj;
  };
  place(buildReception(2.6), -5.6, 5.2, Math.PI);
  for (const x of [4.2, 6.4]) place(bench(), x, 6.15, Math.PI);
  inside.add(box(1.8, 1.1, 0.06, 0x8f6a46, -2.9, F + 2.0, 6.62), box(1.6, 0.9, 0.04, 0xf4ead2, -2.9, F + 2.0, 6.6));
  for (const [x, z] of [[-8.2, 6.2], [8.2, 6.2]]) inside.add(cyl(0.34, 0.26, 0.5, 0xc19368, 10, x, F + 0.25, z), ico(0.5, PALETTE.leafDark, x, F + 0.95, z, 1));

  // Rotunda: a model of the town on a round plinth, benches, and a chandelier under the dome.
  inside.add(cyl(1.25, 1.35, 0.8, STONE_SHADE, 20, 0, F + 0.4, 0.7), cyl(1.4, 1.4, 0.08, TRIM, 20, 0, F + 0.84, 0.7));
  inside.add(Object.assign(cyl(1.25, 1.25, 0.03, 0x8fca70, 20, 0, F + 0.9, 0.7), { castShadow: false }));
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2;
    const [x, z] = [Math.cos(a) * 0.85, 0.7 + Math.sin(a) * 0.85];
    inside.add(box(0.22, 0.18, 0.22, [0xf0d58f, 0xa9c9a4, 0xe6ae94, 0x9fc4e6][i % 4], x, F + 1.0, z));
    inside.add(cyl(0, 0.18, 0.14, 0x8a4b3c, 4, x, F + 1.16, z));
  }
  inside.add(box(0.5, 0.28, 0.36, STONE, 0, F + 1.05, 0.7), cyl(0, 0.24, 0.2, DOME, 10, 0, F + 1.3, 0.7));
  for (const s of [-1, 1]) place(bench(), s * 3.3, 0.7, s * Math.PI / 2);
  inside.add(cyl(0.02, 0.02, 1.0, GOLD, 6, 0, F + H - 0.5, 0.7));
  inside.add(lit(new THREE.SphereGeometry(0.45, 12, 8), lampMat, 2.4, 0, F + H - 1.1, 0.7));
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    inside.add(lit(new THREE.SphereGeometry(0.14, 8, 6), lampMat, 2.0, Math.cos(a) * 0.8, F + H - 1.25, 0.7 + Math.sin(a) * 0.8));
  }

  // Records archive: shelves on every wall, a reading table and filing cabinets.
  for (const x of [-3.0, 0, 3.0]) place(buildBookshelf(41 + x), x, -6.45, -Math.PI / 2);
  for (const s of [-1, 1]) place(buildBookshelf(47 + s), s * 4.2, -4.6, s < 0 ? 0 : Math.PI);
  inside.add(softBox(2.8, 0.08, 1.1, PALETTE.woodMid, 0, F + 0.78, -4.4, 0.04));
  for (const x of [-1.2, 1.2]) inside.add(box(0.08, 0.76, 0.9, WOOD, x, F + 0.38, -4.4));
  inside.add(cyl(0.12, 0.14, 0.05, GOLD, 10, 0.8, F + 0.85, -4.4), box(0.6, 0.03, 0.42, 0xf5f0dc, -0.5, F + 0.835, -4.35));
  for (const s of [-1, 1]) for (const z of [-3.4]) {
    inside.add(box(0.7, 1.3, 0.6, 0x8b98a6, s * 2.6, F + 0.65, z));
    for (const y of [0.35, 0.75, 1.15]) inside.add(box(0.5, 0.05, 0.02, 0xd8dee6, s * 2.6, F + y, z + 0.31));
  }

  // Council chamber (west): a curved council bench on a dais, a speaker's lectern, public seating, flags.
  inside.add(box(3.2, 0.24, 7.6, 0x7d5a3e, -11.3, F + 0.12, -0.45));
  for (let i = 0; i < 5; i++) {
    // An arc of five council desks around the chamber's west end, councillors facing the room.
    const a = (i - 2) * 0.42;
    const [x, z] = [-13.6 + Math.cos(a) * 2.5, -0.45 + Math.sin(a) * 2.5];
    const desk = softBox(0.7, 0.85, 1.25, PALETTE.woodMid, 0, 0.66, 0, 0.05);
    const seat = new THREE.Group();
    seat.add(desk, box(0.62, 0.06, 1.3, 0x466965, 0, 1.11, 0));
    seat.add(box(0.5, 0.95, 0.55, 0x2f4d48, -0.75, 0.72, 0), box(0.5, 0.12, 0.55, 0x2f4d48, -0.62, 0.66, 0));
    seat.position.set(x, F + 0.24, z);
    seat.rotation.y = -a;
    inside.add(seat);
  }
  inside.add(cyl(0.9, 0.9, 0.05, GOLD, 24, -12.85, F + 2.4, -0.45).rotateZ(Math.PI / 2));
  inside.add(cyl(0.7, 0.7, 0.06, 0x2f5f8f, 24, -12.83, F + 2.4, -0.45).rotateZ(Math.PI / 2));
  for (const z of [-3.6, 2.7]) {
    inside.add(cyl(0.03, 0.04, 2.6, GOLD, 6, -12.4, F + 1.3, z));
    inside.add(box(0.04, 0.8, 0.9, z < 0 ? 0x3b6fb6 : 0x2f8f6f, -12.4, F + 2.2, z + 0.45));
  }
  inside.add(softBox(0.7, 1.1, 0.6, PALETTE.woodMid, -8.0, F + 0.55, -0.45, 0.06), box(0.8, 0.06, 0.7, PALETTE.woodLight, -8.0, F + 1.12, -0.45));
  for (const x of [-6.6, -5.4]) for (const z of [-2.4, 1.5]) place(bench(), x, z, -Math.PI / 2);
  const councilRug = buildRug(2.2, 7.0, 0x8a3b3b, -7.0, -0.45);
  councilRug.position.y = F - 0.12;
  inside.add(councilRug);

  // Mayor's office (east): his desk under the flags, visitor chairs, the trophy cabinet, a fireside corner.
  const officeRug = buildRug(4.2, 5.2, 0x466965, 9.9, -0.4);
  officeRug.position.y = F - 0.12;
  inside.add(officeRug);
  const desk = new THREE.Group();
  desk.add(softBox(3.2, 0.16, 1.4, PALETTE.woodMid, 0, 0.86, 0, 0.07), box(3.24, 0.06, 1.42, 0x466965, 0, 0.96, 0));
  for (const x of [-1.3, 1.3]) desk.add(box(0.44, 0.8, 1.2, WOOD, x, 0.4, 0));
  desk.add(box(2.4, 0.66, 0.12, WOOD, 0, 0.45, 0.62));
  desk.add(box(0.75, 0.025, 0.48, 0xf5f0dc, -0.7, 1.0, 0.1), box(0.75, 0.025, 0.48, 0xf5f0dc, -0.55, 1.02, -0.02));
  desk.add(cyl(0.14, 0.18, 0.08, GOLD, 12, 1.1, 1.03, -0.25), cyl(0.045, 0.045, 0.5, GOLD, 8, 1.1, 1.3, -0.25), cyl(0.34, 0.16, 0.24, 0xf1d58a, 12, 1.1, 1.66, -0.25));
  desk.add(box(0.5, 0.06, 0.34, PALETTE.dark, 0.2, 1.0, -0.2));
  desk.position.set(10.25, F, -0.4);
  desk.rotation.y = -Math.PI / 2; // the front panel faces visitors (−x); the mayor sits on the +x side
  inside.add(desk);
  const chair = new THREE.Group();
  chair.add(box(1.15, 0.16, 0.96, 0x455b58, 0, 0.62, 0), box(1.15, 1.25, 0.18, 0x455b58, 0, 1.2, -0.43));
  for (const x of [-0.46, 0.46]) chair.add(box(0.11, 0.6, 0.11, WOOD, x, 0.3, 0.32));
  chair.position.set(MAYOR_SEAT.x - HALL.x + 0.05, F, MAYOR_SEAT.z - HALL.z);
  chair.rotation.y = -Math.PI / 2;
  inside.add(chair);
  for (const z of [-2.0, 1.2]) {
    inside.add(cyl(0.03, 0.04, 2.6, GOLD, 6, 12.55, F + 1.3, z));
    inside.add(box(0.04, 0.8, 0.9, z < 0 ? 0x3b6fb6 : 0x2f8f6f, 12.55, F + 2.2, z + 0.45));
  }
  inside.add(cyl(0.8, 0.8, 0.05, GOLD, 24, 12.84, F + 2.5, -0.4).rotateZ(Math.PI / 2));
  for (const z of [-1.4, 0.6]) place(buildArmchair(5 + z), 8.4, z, Math.PI / 2);
  // Trophy cabinet against the wing's back wall: one cup per reached outcome (up to ten).
  inside.add(box(3.8, 2.1, 0.5, WOOD, 10.85, F + 1.05, -4.5));
  for (const y of [0.75, 1.35, 1.95]) inside.add(box(3.6, 0.07, 0.42, PALETTE.woodLight, 10.85, F + y, -4.38));
  const cups = Math.min(outcomes, 10);
  for (let i = 0; i < cups; i++) {
    const x = 9.25 + (i % 5) * 0.8;
    const y = F + (i < 5 ? 1.0 : 1.6);
    inside.add(cyl(0.11, 0.06, 0.22, 0xffd166, 8, x, y + 0.14, -4.36, { metalness: 0.6, roughness: 0.3 }));
    inside.add(cyl(0.05, 0.07, 0.08, 0xffd166, 8, x, y - 0.01, -4.36, { metalness: 0.6, roughness: 0.3 }));
  }
  const fire = buildFireplace();
  fire.group.position.set(6.8, F, -6.4);
  inside.add(fire.group);
  glowing(fire.glow, 1.8);
  place(buildCouch(19), 6.8, -3.7, Math.PI);
  place(buildSideTable(), 6.8, -5.0);
  for (const s of [-1, 1]) place(buildArmchair(9 + s), 6.8 + s * 1.9, -5.0, -s * Math.PI / 2);
  const globe = buildGlobe();
  globe.group.position.set(5.6, F, 2.8);
  inside.add(globe.group);
  for (const [x, z] of [[12.4, 3.4], [5.1, -6.2], [-5.1, -6.2], [-12.4, 3.4]]) inside.add(cyl(0.3, 0.24, 0.46, 0xc19368, 10, x, F + 0.23, z), ico(0.45, PALETTE.leafDark, x, F + 0.85, z, 1));

  const insideStatics = new THREE.Group();
  for (const child of [...inside.children]) if (!child.userData.dynamic && !child.isGroup) insideStatics.add(child);
  for (const child of [...inside.children]) if (child.isGroup && !child.userData.dynamic) insideStatics.add(child);
  mergeStatic(insideStatics);
  inside.add(insideStatics);
  inside.userData.dynamic = true;
  g.add(inside);

  // ---- Roof stack: lifts away like a roof when you zoom in ---------------------------------------
  const roof = new THREE.Group();
  roof.position.y = F + H;
  roof.userData.dynamic = true;
  roof.add(box(18.7, 0.34, 14.1, TRIM, 0, 0.17, 0));
  roof.add(box(18.1, 0.12, 13.5, 0xb9b2a6, 0, 0.4, 0));
  // Balustrade round the main roof.
  const balustrade = (x0, z0, x1, z1) => {
    const len = Math.hypot(x1 - x0, z1 - z0);
    const alongX = Math.abs(x1 - x0) > Math.abs(z1 - z0);
    roof.add(alongX ? box(len, 0.12, 0.3, TRIM, (x0 + x1) / 2, 1.05, z0) : box(0.3, 0.12, len, TRIM, x0, 1.05, (z0 + z1) / 2));
    const n = Math.round(len / 0.45);
    for (let k = 0; k <= n; k++) {
      const t = k / n;
      roof.add(cyl(0.07, 0.09, 0.62, STONE, 6, x0 + (x1 - x0) * t, 0.68, z0 + (z1 - z0) * t));
    }
  };
  balustrade(-9.1, 6.8, -5.6, 6.8); balustrade(5.6, 6.8, 9.1, 6.8); balustrade(-9.1, -6.8, 9.1, -6.8);
  balustrade(-9.1, -6.8, -9.1, 6.8); balustrade(9.1, -6.8, 9.1, 6.8);
  for (const [x, z] of [[-9.1, 6.8], [9.1, 6.8], [-9.1, -6.8], [9.1, -6.8]]) roof.add(box(0.5, 1.1, 0.5, STONE_SHADE, x, 0.75, z), ico(0.22, GOLD, x, 1.45, z, 1));
  // Portico pediment with the town seal.
  roof.add(box(10.8, 0.45, 2.8, TRIM, 0, -0.02, 8.1)); // entablature over the columns
  roof.add(box(11.4, 0.5, 3.4, TRIM, 0, 0.45, 8.05));
  roof.add(pediment(11.4, 2.2, 3.2, STONE, 0, 0.7, 8.05));
  roof.add(pediment(10.2, 1.7, 0.1, STONE_SHADE, 0, 0.85, 9.66));
  roof.add(cyl(0.62, 0.62, 0.08, GOLD, 24, 0, 1.55, 9.72).rotateX(Math.PI / 2));
  roof.add(cyl(0.44, 0.44, 0.1, 0x2f5f8f, 24, 0, 1.55, 9.74).rotateX(Math.PI / 2));
  roof.add(ico(0.18, GOLD, 0, 2.95, 8.05, 1));
  // Attic storey, drum, dome, lantern and finial.
  roof.add(box(9.4, 1.3, 7.4, STONE, 0, 1.05, 0.2));
  roof.add(box(9.6, 0.18, 7.6, TRIM, 0, 1.75, 0.2));
  const drum = new THREE.Group();
  drum.position.set(0, 1.84, 0.7);
  drum.add(cyl(3.0, 3.1, 2.4, STONE, 24, 0, 1.2, 0));
  drum.add(cyl(3.2, 3.2, 0.2, TRIM, 24, 0, 2.5, 0), cyl(3.2, 3.2, 0.2, TRIM, 24, 0, 0.1, 0));
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    drum.add(cyl(0.13, 0.15, 2.1, STONE_SHADE, 8, Math.sin(a) * 3.08, 1.25, Math.cos(a) * 3.08));
    if (i % 2) continue;
    const w = new THREE.Mesh(new THREE.BoxGeometry(0.7, 1.3, 0.05), glass);
    w.position.set(Math.sin(a + Math.PI / 12) * 3.04, 1.25, Math.cos(a + Math.PI / 12) * 3.04);
    w.rotation.y = a + Math.PI / 12;
    drum.add(glowing(w, 1.3));
  }
  // Clock facing the street.
  drum.add(cyl(0.72, 0.72, 0.1, 0xfaf0ce, 24, 0, 1.25, 3.12).rotateX(Math.PI / 2));
  drum.add(cyl(0.8, 0.8, 0.06, GOLD, 24, 0, 1.25, 3.08).rotateX(Math.PI / 2));
  drum.add(box(0.07, 0.48, 0.05, 0x344440, 0, 1.43, 3.2), box(0.36, 0.07, 0.05, 0x344440, 0.16, 1.25, 3.2));
  const domeMesh = new THREE.Mesh(new THREE.SphereGeometry(3.25, 24, 10, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: DOME, flatShading: true, roughness: 0.6, metalness: 0.15 }));
  domeMesh.userData.ownMaterial = true;
  domeMesh.scale.y = 0.92;
  domeMesh.position.y = 2.6;
  domeMesh.castShadow = true;
  drum.add(domeMesh);
  // Copper bands round the dome.
  for (const [r, y] of [[3.18, 2.75], [2.55, 4.35]]) {
    const band = new THREE.Mesh(new THREE.TorusGeometry(r, 0.07, 6, 32), new THREE.MeshStandardMaterial({ color: DOME_DARK, flatShading: true }));
    band.userData.ownMaterial = true;
    band.rotation.x = Math.PI / 2;
    band.position.y = y;
    drum.add(band);
  }
  drum.add(cyl(0.65, 0.7, 1.0, STONE, 12, 0, 5.75, 0));
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    drum.add(lit(new THREE.BoxGeometry(0.22, 0.6, 0.06), lampMat, 1.8, Math.sin(a) * 0.68, 5.75, Math.cos(a) * 0.68));
  }
  const cupola = new THREE.Mesh(new THREE.SphereGeometry(0.78, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: DOME, flatShading: true, roughness: 0.6 }));
  cupola.userData.ownMaterial = true;
  cupola.position.y = 6.25;
  drum.add(cupola);
  drum.add(cyl(0.05, 0.09, 1.1, GOLD, 8, 0, 7.4, 0), ico(0.18, GOLD, 0, 7.95, 0, 1));
  roof.add(drum);
  // Wing roofs.
  for (const s of [-1, 1]) {
    roof.add(box(4.6, 0.3, 9.6, TRIM, s * 11.0, -H + HW + 0.15, -0.45));
    roof.add(frustum(4.6, 1.2, 9.6, 0.35, DOME, s * 11.0, -H + HW + 0.9, -0.45));
    roof.add(box(4.6 * 0.35 + 0.1, 0.1, 9.6 * 0.35, DOME_DARK, s * 11.0, -H + HW + 1.52, -0.45));
  }
  g.add(roof);

  // Everything inside the hall (and the steps) blocks the square's nav; the forecourt stays open.
  const obstacles = [[-13.6, -7.4, 13.6, 11.0], [-6.0, 11.2, -5.4, 16.6], [5.4, 11.2, 6.0, 16.6]];
  return { walls, partitions, doors, roof, inside, glows, obstacles, roofBase: F + H };
}

function bench() {
  const g = new THREE.Group();
  g.add(softBox(2.0, 0.08, 0.5, PALETTE.woodMid, 0, 0.46, 0, 0.04));
  g.add(box(2.0, 0.45, 0.07, PALETTE.woodMid, 0, 0.75, -0.22));
  for (const x of [-0.85, 0.85]) g.add(box(0.08, 0.44, 0.44, PALETTE.dark, x, 0.22, 0));
  return g;
}

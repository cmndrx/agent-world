// Streets drawn from the town layout (shared/town.mjs). Simulation layer only: streets, lamps and crossings are
// scenery and never reflect agent activity. One tile is 8 m: asphalt in the middle, a sidewalk along every side
// that doesn't continue into another street, curbs, lane dashes, crosswalks at junctions and home entrances,
// and a barrier where a street ends.

import * as THREE from 'three';
import { PALETTE, box, buildLampPost, cyl, mergeStatic } from './models.js';
import { TILE, entranceTile, key, roadMap, roadShape, tileCenter } from '../../shared/town.mjs';

const HALF = TILE / 2;
const ROAD = 2.6; // half the asphalt width
const WALK = HALF - ROAD; // sidewalk width (1.4 m)
const flat = (m) => ((m.castShadow = false), m);

/** Build every street tile. Returns { group, lamps } (lamp materials glow at night). */
export function buildRoads(town) {
  const roads = roadMap(town);
  const entrances = new Set([...(town.homes || []).filter((h) => h.i != null), ...(town.civic || [])].map((h) => key(entranceTile(h).i, entranceTile(h).j)));
  const g = new THREE.Group();
  const lampGroup = new THREE.Group();
  const lamps = [];
  let n = 0;
  for (const k of roads.keys()) {
    const [i, j] = k.split(',').map(Number);
    const { x, z } = tileCenter(i, j);
    const s = roadShape(roads, i, j);
    // Asphalt: the centre plus an arm toward each connected neighbour.
    g.add(flat(box(ROAD * 2, 0.08, ROAD * 2, PALETTE.asphalt, x, -0.02, z, { roughness: 0.9 })));
    if (s.e) g.add(flat(box(WALK, 0.08, ROAD * 2, PALETTE.asphalt, x + ROAD + WALK / 2, -0.02, z, { roughness: 0.9 })));
    if (s.w) g.add(flat(box(WALK, 0.08, ROAD * 2, PALETTE.asphalt, x - ROAD - WALK / 2, -0.02, z, { roughness: 0.9 })));
    if (s.s) g.add(flat(box(ROAD * 2, 0.08, WALK, PALETTE.asphalt, x, -0.02, z + ROAD + WALK / 2, { roughness: 0.9 })));
    if (s.n) g.add(flat(box(ROAD * 2, 0.08, WALK, PALETTE.asphalt, x, -0.02, z - ROAD - WALK / 2, { roughness: 0.9 })));
    // Sidewalks along closed sides (full length) and corner squares where two open sides meet.
    const side = (dx, dz) => {
      const along = dx === 0; // a north/south side runs along x
      const w = along ? TILE : WALK, d = along ? WALK : TILE;
      g.add(flat(box(w, 0.16, d, PALETTE.sidewalk, x + dx * (HALF - WALK / 2), 0.02, z + dz * (HALF - WALK / 2))));
      // Curb on the street edge of the sidewalk.
      g.add(box(along ? TILE - (s.w ? 0 : WALK) - (s.e ? 0 : WALK) : 0.18, 0.2, along ? 0.18 : TILE - (s.n ? 0 : WALK) - (s.s ? 0 : WALK), PALETTE.curb,
        x + (along ? ((s.e ? 0 : -WALK) + (s.w ? 0 : WALK)) / 2 : dx * ROAD), 0.04, z + (along ? dz * ROAD : ((s.s ? 0 : -WALK) + (s.n ? 0 : WALK)) / 2)));
      // Sidewalk joints.
      for (let t = -HALF + 1.6; t < HALF; t += 1.6) g.add(flat(along ? box(0.04, 0.17, WALK, PALETTE.curb, x + t, 0.025, z + dz * (HALF - WALK / 2)) : box(WALK, 0.17, 0.04, PALETTE.curb, x + dx * (HALF - WALK / 2), 0.025, z + t)));
    };
    if (!s.n) side(0, -1);
    if (!s.s) side(0, 1);
    if (!s.w) side(-1, 0);
    if (!s.e) side(1, 0);
    for (const [dx, dz, open] of [[-1, -1, s.w && s.n], [1, -1, s.e && s.n], [-1, 1, s.w && s.s], [1, 1, s.e && s.s]]) {
      if (!open) continue;
      g.add(flat(box(WALK, 0.16, WALK, PALETTE.sidewalk, x + dx * (HALF - WALK / 2), 0.02, z + dz * (HALF - WALK / 2))));
      g.add(box(0.18, 0.2, WALK, PALETTE.curb, x + dx * ROAD, 0.04, z + dz * (HALF - WALK / 2)), box(WALK, 0.2, 0.18, PALETTE.curb, x + dx * (HALF - WALK / 2), 0.04, z + dz * ROAD));
    }
    // Lane dashes on straight runs; crosswalks where a street meets a junction or a home's front path.
    if (s.kind === 'straight') {
      if (s.e) for (const t of [-2, 2]) g.add(flat(box(1.8, 0.09, 0.16, PALETTE.roadLine, x + t, -0.01, z)));
      else for (const t of [-2, 2]) g.add(flat(box(0.16, 0.09, 1.8, PALETTE.roadLine, x, -0.01, z + t)));
    }
    const zebra = (vertical) => {
      for (let t = -3; t <= 3; t++) g.add(flat(vertical ? box(0.5, 0.09, 4.2, PALETTE.roadLine, x + t * 0.85, -0.005, z) : box(4.2, 0.09, 0.5, PALETTE.roadLine, x, -0.005, z + t * 0.85)));
    };
    const near = (di, dj) => { const o = roadShape(roads, i + di, j + dj); return roads.has(key(i + di, j + dj)) && o.count >= 3; };
    if (s.kind === 'straight' && (entrances.has(k) || (s.e ? near(1, 0) || near(-1, 0) : near(0, 1) || near(0, -1)))) zebra(!!s.e);
    // Dead ends: a striped barrier across the closed end.
    if (s.kind === 'end') {
      const [dx, dz] = s.e ? [-1, 0] : s.w ? [1, 0] : s.s ? [0, -1] : [0, 1];
      const bx = x + dx * (ROAD - 0.3), bz = z + dz * (ROAD - 0.3);
      for (let t = -2; t <= 2; t += 1) g.add(cyl(0.07, 0.07, 0.9, PALETTE.curb, 6, bx + dz * t, 0.45, bz + dx * t));
      g.add(box(dz ? 4.6 : 0.12, 0.28, dz ? 0.12 : 4.6, 0xd94f4f, bx, 0.78, bz), box(dz ? 1.2 : 0.13, 0.29, dz ? 0.13 : 1.2, 0xf4f1ea, bx, 0.78, bz));
    }
    // Lamp posts on alternate tiles, on a sidewalk.
    if ((i + j) % 2 === 0 && s.kind !== 'cross') {
      const [dx, dz] = !s.n ? [0, -1] : !s.w ? [-1, 0] : !s.s ? [0, 1] : [1, 0];
      if (s.count < 4) {
        const lamp = buildLampPost(x + dx * (HALF - 0.45) + (dz ? 2.2 : 0), z + dz * (HALF - 0.45) + (dx ? 2.2 : 0));
        lampGroup.add(lamp);
        lamp.traverse((o) => (o.userData.nightGlow || o.userData.nightPool) && lamps.push(o));
      }
    }
    if (++n > 2000) break;
  }
  mergeStatic(g);
  const group = new THREE.Group();
  group.add(g, lampGroup);
  return { group, lamps };
}

/** World rectangles covered by streets (with sidewalks), for keeping grass and props off them. */
export function roadRects(town) {
  return [...roadMap(town).keys()].map((k) => {
    const [i, j] = k.split(',').map(Number);
    const { x, z } = tileCenter(i, j);
    return [x - HALF, z - HALF, x + HALF, z + HALF];
  });
}

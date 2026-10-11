import { buildingTier } from '../../shared/progression.mjs';
// Layout plans for the eight residential tiers (docs/concepts/home-tiers). Pure data, no Three.js, so the
// footprints, doors and yard obstacles can be checked in Node. Lot-local coordinates: the ground-floor
// studio spans x −7..7, z −5..5 (walls to ±7.25 / ±5.25); the street is at +z and the front gate is the
// fence gap at |x| < 1.2, z = YARD_Z.
//
// Every tier keeps the same ground-floor studio (desks, stations, furniture), so residents, desks and
// conversations carry over unchanged when a home upgrades. Tiers differ in the front façade (doors and
// windows), the upper floors and roof (which lift away together like a roof when you zoom in) and the yard.

export const YARD_Z = 7.45;
export const STUDIO = { x0: -7.25, z0: -5.25, x1: 7.25, z1: 5.25 };
/** Ground floor wall height; upper floors start just above the wall cap. */
export const GROUND_H = 2.74;
/** The gate corridor from the sidewalk to the front wall; nothing in a yard may block it. */
export const GATE = { x0: -1.2, x1: 1.2 };

// Collectible finds float at these yard spots (shared/collectibles.mjs YARD_SPOTS); props keep clear of them.
const FIND_SPOTS = [[-8.5, 4.5], [8.3, 4.5], [-5.2, 8.2], [4.4, 7.8], [-9.2, -4.5], [9.2, -5], [-5, -7.4], [5, -7.8]];

const door = (x, w = 1.8, color = null) => ({ kind: 'door', x, w, color });
const win = (x, w = 1.6, box = false) => ({ kind: 'window', x, w, box });

/**
 * One plan per home level. `front` lists the openings in the street-facing wall. `stories` counts floors
 * including the ground floor; `height` is the tallest point above the ground (for camera and roof lift).
 * `yard` lists [kind, x0, z0, x1, z1] footprints of landscaping that blocks walking; `soft` lists
 * walkable or purely decorative footprints that still avoid user decor.
 */
export const TIER_PLANS = [
  {
    level: 1, key: 'cottage', stories: 1, height: 7.4,
    front: [win(-4.2, 1.6, true), door(0), win(4.2, 1.6, true)],
    siding: 0, quoins: true, plinth: true,
    fence: 'picket',
    yard: [
      ['flowerBed', -5.8, 5.45, -2.6, 6.1],
      ['vegBed', 3.0, 5.5, 6.4, 6.45],
      ['barrel', 1.45, 5.45, 1.95, 5.95],
      ['canopyPost', -1.33, 5.98, -1.19, 6.12],
      ['canopyPost', 1.19, 5.98, 1.33, 6.12],
      ['bush', -9.9, 6.1, -8.9, 7.1],
      ['bush', 8.9, 6.2, 9.9, 7.1],
      ['roses', 7.9, 1.2, 9.4, 2.5],
      ['bush', 9.2, -2.4, 10.0, -1.6],
    ],
    trees: [[-8.9, -6.4, 'round'], [8.9, -6.2, 'round'], [-9.3, -1.6, 'round']],
  },
  {
    level: 2, key: 'family-house', stories: 2, height: 10.4,
    front: [win(-4.7, 1.6), door(0), win(3.9, 1.6)],
    siding: 0.26, quoins: false, plinth: true,
    fence: 'stoneWall',
    bay: { x0: -5.9, x1: -3.5, depth: 0.7 },
    yard: [
      ['bay', -5.95, 5.2, -3.45, 5.95],
      ['porchPost', -1.64, 6.46, -1.36, 6.74],
      ['porchPost', 1.36, 6.46, 1.64, 6.74],
      ['porchPost', 4.16, 6.46, 4.44, 6.74],
      ['porchPost', 6.66, 6.46, 6.94, 6.74],
      ['railing', 1.64, 6.55, 4.16, 6.65],
      ['railing', 4.44, 6.55, 6.66, 6.65],
      ['railing', 6.75, 5.25, 6.85, 6.46],
      ['shrubs', -6.6, 6.2, -2.4, 6.9],
      ['evergreen', 7.6, 5.6, 8.4, 6.4],
      ['evergreen', -8.3, 5.7, -7.5, 6.5],
      ['bush', 8.9, 1.1, 9.9, 2.1],
      ['bush', -10.0, 1.0, -9.0, 2.0],
    ],
    soft: [['porch', -1.7, 5.25, 7.0, 6.75]],
    trees: [[-8.9, -6.4, 'round'], [8.9, -6.2, 'round'], [-9.3, -1.6, 'pine'], [9.4, 2.9, 'round']],
  },
  {
    level: 3, key: 'duplex', stories: 2, height: 10.8,
    front: [win(-5.2, 1.4, true), door(-2.2, 1.1), door(2.2, 1.1), win(5.2, 1.4, true)],
    siding: 0, quoins: true, plinth: true,
    fence: 'woodPillars',
    yard: [
      ['hedge', -0.35, 5.4, 0.35, 6.15],
      ['shrubs', -6.4, 5.45, -3.4, 6.1],
      ['shrubs', 3.4, 5.45, 6.4, 6.1],
      ['evergreen', -8.2, 5.6, -7.4, 6.4],
      ['evergreen', 7.4, 5.6, 8.2, 6.4],
      ['bush', -10.0, 0.6, -9.0, 1.6],
      ['bush', 9.0, 1.0, 10.0, 2.0],
    ],
    trees: [[-9.1, -6.0, 'round'], [9.1, -6.0, 'round'], [-9.4, -2.2, 'pine']],
  },
  {
    level: 4, key: 'townhouse-row', stories: 2, height: 11.2,
    front: [
      door(-6.1, 1.1, 0x5e7d4c), win(-4.5, 1.0, true),
      door(-2.5, 1.1, 0x9c3b34), win(-0.9, 1.0, true),
      door(1.1, 1.1, 0x3f4c66), win(2.7, 1.0, true),
      door(4.7, 1.1, 0xa8703f), win(6.3, 1.0, true),
    ],
    siding: 0, quoins: true, plinth: true,
    fence: 'woodPillars',
    yard: [
      ['planter', -5.15, 5.3, -3.85, 5.85],
      ['planter', -1.55, 5.3, -0.4, 5.85],
      ['planter', 2.15, 5.3, 3.25, 5.85],
      ['planter', 5.75, 5.3, 6.85, 5.85],
      ['hedge', -10.4, 2.0, -9.7, 6.6],
      ['hedge', 9.7, 2.0, 10.4, 6.6],
    ],
    trees: [[-9.0, -6.2, 'round'], [9.0, -6.0, 'round']],
  },
  {
    level: 5, key: 'small-apartment', stories: 4, height: 13.4,
    front: [win(-4.4, 1.6), door(0), win(4.4, 1.6)],
    siding: 0, quoins: false, plinth: true, stoneBase: true,
    fence: 'lowWall',
    yard: [
      ['raisedPlanter', -6.6, 5.45, -2.0, 6.15],
      ['raisedPlanter', 2.0, 5.45, 6.6, 6.15],
      ['evergreen', -8.4, 5.4, -7.6, 6.2],
      ['evergreen', 7.6, 5.4, 8.4, 6.2],
      ['bush', -10.0, 0.8, -9.0, 1.8],
      ['bush', 9.0, 0.8, 10.0, 1.8],
    ],
    trees: [[-9.0, -6.0, 'round'], [9.0, -6.2, 'round'], [-9.4, -1.8, 'round'], [9.4, 2.6, 'pine']],
  },
  {
    level: 6, key: 'apartment-block', stories: 6, height: 17.6,
    front: [win(-4.4, 1.6), door(0), win(4.4, 1.6)],
    siding: 0, quoins: false, plinth: true, stoneBase: true,
    fence: 'hedgeWall',
    yard: [
      ['lamp', -1.72, 6.18, -1.48, 6.42],
      ['lamp', 1.48, 6.18, 1.72, 6.42],
      ['bench', -5.4, 6.2, -3.6, 6.65],
      ['bench', 3.6, 6.2, 5.4, 6.65],
      ['raisedPlanter', -6.8, 5.4, -2.6, 5.95],
      ['raisedPlanter', 2.6, 5.4, 6.8, 5.95],
      ['evergreen', -8.4, 5.6, -7.6, 6.4],
      ['evergreen', 7.6, 5.6, 8.4, 6.4],
    ],
    trees: [[-9.0, -6.0, 'round'], [9.0, -6.0, 'round'], [-9.3, 0.4, 'round'], [9.3, 0.4, 'round']],
  },
  {
    level: 7, key: 'residential-tower', stories: 10, height: 27.4,
    front: [win(-4.4, 1.6), door(0), win(4.4, 1.6)],
    siding: 0, quoins: false, plinth: true, stoneBase: true,
    fence: 'hedgeWall',
    yard: [
      ['lamp', -1.72, 6.48, -1.48, 6.72],
      ['lamp', 1.48, 6.48, 1.72, 6.72],
      ['raisedPlanter', -6.8, 5.4, -2.2, 6.0],
      ['raisedPlanter', 2.2, 5.4, 6.8, 6.0],
      ['evergreen', -8.4, 5.6, -7.6, 6.4],
      ['evergreen', 7.6, 5.6, 8.4, 6.4],
      ['evergreen', -10.1, 1.4, -9.3, 2.2],
      ['evergreen', 9.3, 1.4, 10.1, 2.2],
    ],
    trees: [[-9.0, -6.0, 'round'], [9.0, -6.0, 'round'], [-9.4, -2.0, 'round'], [9.4, -2.0, 'pine']],
  },
  {
    level: 8, key: 'landmark-residence', stories: 13, height: 36.5,
    front: [win(-4.4, 1.6), door(0), win(4.4, 1.6)],
    siding: 0, quoins: false, plinth: true, stoneBase: true,
    fence: 'hedgeWall',
    yard: [
      ['lamp', -1.72, 6.48, -1.48, 6.72],
      ['lamp', 1.48, 6.48, 1.72, 6.72],
      ['terrace', -6.9, 5.35, -2.2, 6.25],
      ['terrace', 2.2, 5.35, 6.9, 6.25],
      ['evergreen', -8.4, 5.5, -7.6, 6.3],
      ['evergreen', 7.6, 5.5, 8.4, 6.3],
      ['evergreen', -10.1, 1.0, -9.3, 1.8],
      ['evergreen', 9.3, 1.0, 10.1, 1.8],
      ['evergreen', -10.1, -2.4, -9.3, -1.6],
      ['evergreen', 9.3, -2.4, 10.1, -1.6],
    ],
    trees: [[-9.0, -6.2, 'round'], [9.0, -6.2, 'round'], [-9.4, 3.8, 'round'], [9.4, 3.8, 'round']],
  },
];

export function tierPlan(level) {
  return TIER_PLANS[buildingTier(level) - 1];
}

export const doorsOf = (plan) => plan.front.filter((o) => o.kind === 'door');

/** Swing of an open door leaf: hinged at the opening's +x jamb, folded into the room along −z. */
export function leafRect(d) {
  const len = d.w >= 1.6 ? 1.74 : d.w - 0.05;
  const hx = d.x + d.w / 2;
  return [hx - 0.12, 5.0 - len, hx + 0.05, 5.0];
}

/** Front wall obstacles: solid segments between the openings, plus each open door leaf. */
export function frontWallBlocks(plan) {
  const out = [];
  let cursor = STUDIO.x0;
  for (const d of doorsOf(plan).sort((a, b) => a.x - b.x)) {
    out.push([cursor, 4.95, d.x - d.w / 2 - 0.05, 5.25]);
    out.push(leafRect(d));
    cursor = d.x + d.w / 2 + 0.05;
  }
  out.push([cursor, 4.95, STUDIO.x1, 5.25]);
  return out;
}

const overlaps = (a, b) => a[0] < b[2] && a[2] > b[0] && a[1] < b[3] && a[3] > b[1];

/** Yard props that fit around the user's decor: a prop overlapping a placed decoration is skipped. */
export function yardProps(plan, decorRects = []) {
  const keep = (r) => !decorRects.some((d) => overlaps(r, d));
  return {
    blocking: plan.yard.filter(([, ...r]) => keep(r)),
    soft: (plan.soft || []).filter(([, ...r]) => keep(r)),
  };
}

/** Problems with a plan (used by tests): props on the gate path, on the studio, outside the yard or on finds. */
export function planProblems(plan) {
  const problems = [];
  const studio = [STUDIO.x0 - 0.05, STUDIO.z0, STUDIO.x1 + 0.05, STUDIO.z1 - 0.06];
  const gate = [GATE.x0 + 0.05, 6.3, GATE.x1 - 0.05, YARD_Z + 0.1]; // the threshold band by the gate
  for (const [kind, ...r] of plan.yard) {
    if (overlaps(r, studio)) problems.push(`${kind} overlaps the studio`);
    if (overlaps(r, gate)) problems.push(`${kind} blocks the gate path`);
    if (r[0] < -10.75 || r[2] > 10.75 || r[1] < -YARD_Z || r[3] > YARD_Z) problems.push(`${kind} leaves the yard`);
    for (const [x, z] of FIND_SPOTS) if (x > r[0] - 0.4 && x < r[2] + 0.4 && z > r[1] - 0.4 && z < r[3] + 0.4) problems.push(`${kind} covers a find spot`);
  }
  let last = -Infinity;
  for (const o of [...plan.front].sort((a, b) => a.x - b.x)) {
    const a = o.x - o.w / 2;
    if (a < STUDIO.x0 + 0.3 || o.x + o.w / 2 > STUDIO.x1 - 0.3) problems.push(`${o.kind} at ${o.x} leaves the wall`);
    if (a < last + 0.15) problems.push(`${o.kind} at ${o.x} overlaps its neighbor`);
    last = o.x + o.w / 2;
  }
  if (!doorsOf(plan).length) problems.push('no front door');
  return problems;
}

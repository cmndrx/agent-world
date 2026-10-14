// Upper floors of the residential tiers, and how residents are spread across a building's floors. Pure data and
// geometry helpers (no Three.js), validated in Node (test/home-tiers.test.mjs). Lot-local coordinates; each floor
// has its own base height `y` (matching the upper stack in home-tiers.js), footprint `rects`, walkable plan and
// `landings` where residents step off the stairs or elevator.
//
// Every resident gets a living space: a desk and (on upper floors) their own bed nearby. Seats are dealt out
// round-robin over the floors, so a growing household spreads through the building instead of piling onto one floor.

import { D, I, floorplanFor, layoutPlan, spotAt, YAW } from './home-floorplans.js';
import { GROUND_H, TIER_PLANS } from './home-tier-plans.js';
import { BUILDING_UNLOCK_LEVELS, MAX_LEVEL } from '../../shared/progression.mjs';

const FULL = [[-7.2, -5.2, 7.2, 5.2]];
const repeat = (n, make) => Array.from({ length: n }, (_, i) => make(i));

/** Family House: three bedrooms with desks around the stair hall, a bath and a reading nook. */
const familyUpper = () => [{
  name: 'Upstairs', y: GROUND_H, h: 2.6, rects: FULL,
  landings: [[-0.5, -4.1, 's']],
  plan: {
    rooms: [['Landing', 'carpet', -1.34, -4.95, 1.34, 4.95], ['Bedroom', 'carpet', -6.95, -4.95, -1.46, -0.66], ['Bedroom', 'carpet', -6.95, -0.54, -1.46, 4.95], ['Bedroom', 'carpet', 1.46, -0.54, 6.95, 4.95], ['Bath', 'tile', 1.46, -4.95, 6.95, -0.66]],
    partitions: [[-1.4, -4.95, -1.4, 4.95, [-2.6, 2.6]], [1.4, -4.95, 1.4, 4.95, [-1.35, 1.4]], [-6.95, -0.6, -1.4, -0.6], [1.4, -0.6, 6.95, -0.6]],
    items: [
      I('stairwell', 0.8, -3.4, 's', { w: 1.0, d: 2.8 }),
      I('plant', -0.95, 4.5),
      I('bed', -5.8, -2.8, 'e'), I('wardrobe', -6.3, -4.62), I('plant', -2.0, -1.1),
      I('bed', -5.8, 2.4, 'e'), I('wardrobe', -6.3, 4.62, 'n'),
      I('bed', 5.8, 2.4, 'w'), I('wardrobe', 6.3, 4.62, 'n'),
      I('bath', 5.4, -4.5), I('bookshelf', 6.74, -2.4, 'w'), I('loveseat', 3.6, -1.6, 'n'),
    ],
    desks: [D(-3.2, -4.0), D(-3.2, 0.6), D(3.0, 0.6)],
    wander: [[0.0, 0.5], [3.4, -3.0]],
  },
}];

/** Duplex: each home's upstairs has a back and a front bedroom-office off its own stair hall. */
const duplexUpper = () => {
  const home = (s) => {
    const x = (v) => s * v;
    const f = s < 0 ? 'e' : 'w';
    return {
      partitions: [[Math.min(x(6.95), x(0.06)), -0.6, Math.max(x(6.95), x(0.06)), -0.6, [x(1.2)]], [x(2.0), -0.54, x(2.0), 4.95, [1.9]]],
      items: [
        I('stairwell', x(0.56), 3.6, 's', { w: 1.0, d: 2.4 }),
        I('bed', x(5.8), -2.8, f), I('wardrobe', x(6.3), -4.62), I('plant', x(0.5), -1.1),
        I('bed', x(5.8), 2.6, f), I('plant', x(6.55), 0.0),
      ],
      desks: [D(x(2.6), -3.9), s < 0 ? D(-3.6, 0.5) : D(3.1, 0.3)],
      rooms: [['Bedroom', 'carpet', Math.min(x(6.95), x(0.06)), -4.95, Math.max(x(6.95), x(0.06)), -0.66], ['Bedroom', 'carpet', Math.min(x(6.95), x(2.06)), -0.54, Math.max(x(6.95), x(2.06)), 4.95]],
    };
  };
  const w = home(-1);
  const e = home(1);
  return [{
    name: 'Upstairs', y: GROUND_H, h: 2.6, rects: FULL,
    landings: [[-1.0, 1.7, 'n'], [1.0, 1.7, 'n']],
    plan: {
      rooms: [...w.rooms, ...e.rooms],
      partitions: [[0, -4.95, 0, 4.95], ...w.partitions, ...e.partitions],
      items: [...w.items, ...e.items],
      desks: [w.desks[0], e.desks[0], w.desks[1], e.desks[1]],
      wander: [[-1.0, 0.6], [1.0, 0.6]],
    },
  }];
};

/** Townhouse Row: each home's upstairs has a bedroom over the stairs and a two-desk study at the back. */
const townhouseUpper = () => {
  const homes = [[-6.95, -3.66, -4.16, -5.8], [-3.54, -0.06, -0.56, -2.3], [0.06, 3.54, 3.04, 1.3], [3.66, 6.95, 6.45, 4.8]];
  const parts = homes.map(([x0, x1, sx, bx]) => ({
    partition: [x0, 0.4, x1, 0.4, [x0 + 1.0]],
    items: [I('stairwell', sx, 3.6, 's', { w: 1.0, d: 2.6 }), I('bed', bx, 3.8, 'n'), I('bookshelf', x0 + 0.21, -2.6, 'e')],
    desks: [D(x1 - 0.45, -3.9, 'e', 'BED'), D(x1 - 0.45, -1.4, 'e', false)],
    room: ['Study', 'carpet', x0, -4.95, x1, 0.34],
  }));
  return [{
    name: 'Upstairs', y: GROUND_H, h: 2.7, rects: FULL,
    landings: homes.map(([, , sx]) => [sx, 1.9, 'n']),
    plan: {
      rooms: parts.map((p) => p.room),
      partitions: [[-3.6, -4.95, -3.6, 4.95], [0, -4.95, 0, 4.95], [3.6, -4.95, 3.6, 4.95], ...parts.map((p) => p.partition)],
      items: parts.flatMap((p) => p.items),
      // Each home's first study desk owns that home's bed; the second resident shares the house.
      desks: [...parts.map((p, i) => [...p.desks[0].slice(0, 3), i]), ...parts.map((p) => p.desks[1])],
      wander: homes.map(([x0, x1]) => [(x0 + x1) / 2 - 0.3, 1.4]),
    },
  }];
};

/** Small Apartment Building: three floors of four apartments around the stair and elevator corridor. */
const smallApartmentUpper = () => repeat(3, (i) => ({
  name: `Floor ${i + 1}`, y: GROUND_H + i * 2.6, h: 2.6, rects: FULL,
  landings: [[-0.75, -3.6, 's']],
  plan: {
    rooms: [['Corridor', 'tile', -1.44, -4.95, 1.44, 4.95], ['Apartment', 'carpet', -6.95, -4.95, -1.56, -0.06], ['Apartment', null, -6.95, 0.06, -1.56, 4.95], ['Apartment', null, 1.56, -4.95, 6.95, -0.06], ['Apartment', 'carpet', 1.56, 0.06, 6.95, 4.95]],
    partitions: [[-1.5, -4.95, -1.5, 4.95, [-2.4, 2.4]], [1.5, -4.95, 1.5, 4.95, [-1.2, 2.4]], [-6.95, 0, -1.5, 0], [1.5, 0, 6.95, 0]],
    items: [
      I('elevator', -0.75, -4.7, 's', { w: 1.2 }), I('stairwell', 0.85, -3.6, 's', { w: 0.9, d: 2.6 }), I('plant', -1.1, 4.5),
      I('kitchen', -5.3, -4.6, 's', { len: 2.6, coffee: 0.9 }), I('bed', -5.8, -1.6, 'e'),
      I('kitchen', -5.3, 4.6, 'n', { len: 2.6, coffee: -0.9 }), I('bed', -5.8, 1.6, 'e'),
      I('kitchen', 5.3, -4.6, 's', { len: 2.6, coffee: -0.9 }), I('bed', 5.8, -1.6, 'w'),
      I('kitchen', 5.3, 4.6, 'n', { len: 2.6, coffee: 0.9 }), I('bed', 5.8, 1.6, 'w'),
    ],
    desks: [D(-2.8, -4.1), D(2.8, -4.1), D(-2.8, 1.0), D(2.8, 1.0)],
    wander: [[0.0, 1.5]],
  },
}));

/** Apartment Block: five floors, each with a two-resident apartment in either wing off the elevator hall. */
const apartmentBlockUpper = () => repeat(5, (i) => ({
  name: `Floor ${i + 1}`, y: GROUND_H + i * 2.5, h: 2.5,
  rects: [[-7.2, -5.2, -2.8, 5.2], [-2.8, -5.2, 2.8, -1.4], [2.8, -5.2, 7.2, 5.2]],
  voids: [[-2.8, -1.4, 2.8, 5.2]],
  landings: [[0, -3.6, 's']],
  plan: {
    rooms: [['Elevator hall', 'tile', -2.8, -4.95, 2.8, -1.65], ['Apartment', 'carpet', -6.95, -4.95, -3.01, 4.95], ['Apartment', 'carpet', 3.01, -4.95, 6.95, 4.95]],
    partitions: [[-2.95, -4.95, -2.95, -1.65, [-3.3]], [2.95, -4.95, 2.95, -1.65, [-3.3]]],
    items: [
      I('elevator', 0, -4.7, 's', { w: 2.2 }), I('loveseat', 0, -2.2, 's'),
      I('kitchen', -5.0, -4.6, 's', { len: 2.6, coffee: 0.9 }), I('bed', -5.9, 3.8, 'n'), I('bed', -3.95, 3.8, 'n'),
      I('kitchen', 5.0, -4.6, 's', { len: 2.6, coffee: -0.9 }), I('bed', 5.9, 3.8, 'n'), I('bed', 3.95, 3.8, 'n'),
    ],
    desks: [D(-6.5, -2.0, 'w'), D(6.5, -2.0, 'e'), D(-6.5, 0.8, 'w'), D(6.5, 0.8, 'e')],
    wander: [[-1.6, -3.0], [-4.4, -0.6], [4.4, -0.6]],
  },
}));

/** Residential Tower: nine floors, each with an apartment either side of the elevator core. */
const towerUpper = () => repeat(9, (i) => ({
  name: `Floor ${i + 1}`, y: GROUND_H + 0.13 + i * 2.4, h: 2.4, rects: [[-5.4, -4.6, 5.4, 3.8]],
  landings: [[0, -3.1, 's']],
  plan: {
    rooms: [['Corridor', 'tile', -1.24, -4.35, 1.24, 3.55], ['Apartment', 'carpet', -5.15, -4.35, -1.36, 3.55], ['Apartment', 'carpet', 1.36, -4.35, 5.15, 3.55]],
    partitions: [[-1.3, -4.35, -1.3, 3.55, [-2.6]], [1.3, -4.35, 1.3, 3.55, [-2.6]]],
    items: [
      I('elevator', 0, -4.1, 's', { w: 2.2 }), I('loveseat', 0, 3.1, 'n'),
      I('kitchen', -3.3, -4.02, 's', { len: 2.6, coffee: 0.8 }), I('bed', -3.3, 2.4, 'n'),
      I('kitchen', 3.3, -4.02, 's', { len: 2.6, coffee: -0.8 }), I('bed', 3.3, 2.4, 'n'),
    ],
    desks: [D(-4.7, -1.4, 'w'), D(4.7, -1.4, 'e')],
    wander: [[0.0, 0.5]],
  },
}));

/** Landmark Residence: a residents' club, seven floors of two suites, and three penthouse floors. */
const landmarkUpper = () => [
  {
    name: 'Residents club', y: GROUND_H + 0.15, h: 2.6, rects: [[-6.4, -4.6, 6.4, 4.0]],
    landings: [[0, -3.1, 's']],
    plan: {
      rooms: [['Lounge', 'carpet', -6.15, -4.35, -0.1, 3.75], ['Business suite', null, 0.1, -4.35, 6.15, 3.75]],
      partitions: [],
      items: [
        I('elevator', 0, -4.1, 's', { w: 2.0 }),
        I('couch', -3.9, 2.9, 'n'), I('bookshelf', -5.94, -2.4, 'e'), I('globe', -3.2, -1.6, 's'),
        I('coffeeBar', 5.68, 2.6, 'w'), I('armchair', -5.4, 1.0, 'e'), I('plant', 0.0, 3.4),
      ],
      desks: [D(2.6, -1.4), D(5.7, -1.4, 'e')],
      wander: [[-1.4, 0.6], [2.6, 2.4]],
    },
  },
  ...repeat(7, (i) => ({
    name: `Floor ${i + 2}`, y: GROUND_H + 2.97 + i * 2.4, h: 2.4, rects: [[-4.8, -3.8, 4.8, 3.0]],
    landings: [[0, -2.4, 's']],
    plan: {
      rooms: [['Corridor', 'tile', -1.14, -3.55, 1.14, 2.75], ['Suite', 'carpet', -4.55, -3.55, -1.26, 2.75], ['Suite', 'carpet', 1.26, -3.55, 4.55, 2.75]],
      partitions: [[-1.2, -3.55, -1.2, 2.75, [-1.9]], [1.2, -3.55, 1.2, 2.75, [-1.9]]],
      items: [
        I('elevator', 0, -3.3, 's', { w: 1.8 }), I('plant', 0, 2.4),
        I('kitchen', -2.9, -3.22, 's', { len: 2.2, coffee: 0.7 }), I('bed', -2.9, 1.6, 'n'),
        I('kitchen', 2.9, -3.22, 's', { len: 2.2, coffee: -0.7 }), I('bed', 2.9, 1.6, 'n'),
      ],
      desks: [D(-4.1, -0.6, 'w'), D(4.1, -1.6, 'e')],
      wander: [[0.0, 0.4]],
    },
  })),
  ...repeat(3, (i) => ({
    name: `Penthouse ${i + 1}`, y: GROUND_H + 19.97 + i * 2.4, h: 2.4, rects: [[-3.8, -3.2, 3.8, 2.2]],
    landings: [[0, -1.8, 's']],
    plan: {
      rooms: [['Penthouse', 'carpet', -3.55, -2.95, 3.55, 1.95]],
      partitions: [],
      items: [
        I('elevator', 0, -2.7, 's', { w: 1.6 }), I('kitchen', 2.4, -2.62, 's', { len: 1.8, coffee: 0 }),
        I('bed', 2.4, 0.8, 'w'), I('loveseat', -1.3, 1.5, 'n'), I('plant', -3.2, 1.6),
      ],
      desks: [D(-3.1, -1.0, 'w')],
      wander: [[0.4, -0.6]],
    },
  })),
];

export const UPPER_FLOORS = {
  'family-house': familyUpper,
  duplex: duplexUpper,
  'townhouse-row': townhouseUpper,
  'small-apartment': smallApartmentUpper,
  'apartment-block': apartmentBlockUpper,
  'residential-tower': towerUpper,
  'landmark-residence': landmarkUpper,
};

/**
 * The exterior edges of a footprint made of axis-aligned rects (edges shared between two rects are left open).
 * @returns {Array<{x0:number,z0:number,x1:number,z1:number,nx:number,nz:number}>}
 */
export function outline(rects) {
  const out = [];
  const eps = 1e-6;
  const subtract = (segs, a, b) => segs.flatMap(([s, e]) => (b <= s + eps || a >= e - eps ? [[s, e]] : [[s, Math.max(s, a)], [Math.min(e, b), e]].filter(([p, q]) => q - p > 0.01)));
  rects.forEach((r, i) => {
    const others = rects.filter((_, j) => j !== i);
    // [fixed coordinate, axis, start, end, normal]
    for (const [axis, at, a0, a1, n] of [['z', r[3], r[0], r[2], 1], ['z', r[1], r[0], r[2], -1], ['x', r[2], r[1], r[3], 1], ['x', r[0], r[1], r[3], -1]]) {
      let segs = [[a0, a1]];
      for (const o of others) {
        const touches = axis === 'z' ? Math.abs((n > 0 ? o[1] : o[3]) - at) < eps : Math.abs((n > 0 ? o[0] : o[2]) - at) < eps;
        if (!touches) continue;
        segs = axis === 'z' ? subtract(segs, o[0], o[2]) : subtract(segs, o[1], o[3]);
      }
      for (const [s, e] of segs) {
        out.push(axis === 'z' ? { x0: s, z0: at, x1: e, z1: at, nx: 0, nz: n } : { x0: at, z0: s, x1: at, z1: e, nx: n, nz: 0 });
      }
    }
  });
  return out;
}

/** Obstacles that bound an upper floor: a band inside every outer wall, and any voids (courtyards). */
export function floorShellBlocks(floor) {
  const t = 0.25;
  const walls = outline(floor.rects).map((s) => (s.nz ? [s.x0, s.nz > 0 ? s.z0 - t : s.z0, s.x1, s.nz > 0 ? s.z0 : s.z0 + t] : [s.nx > 0 ? s.x0 - t : s.x0, s.z0, s.nx > 0 ? s.x0 : s.x0 + t, s.z1]));
  return [...walls, ...(floor.voids || [])];
}

export const floorBounds = (rects) => ({
  x0: Math.min(...rects.map((r) => r[0])), z0: Math.min(...rects.map((r) => r[1])),
  x1: Math.max(...rects.map((r) => r[2])), z1: Math.max(...rects.map((r) => r[3])),
});

/**
 * The whole building for a tier: its floors (0 = ground, from home-floorplans.js) and the seat order that spreads
 * residents across them. Seat i is `{ floor, desk }`; each desk knows its floor and nearest landing.
 */
export function buildingPlanFor(key, yardRects = []) {
  const ground = floorplanFor(key, yardRects);
  const floors = [{ index: 0, name: 'Ground floor', y: 0, h: 2.7, rects: [[-7.25, -5.25, 7.25, 5.25]], voids: [], landings: [ground.stations.entrance], ...ground }];
  (UPPER_FLOORS[ground.key]?.() || []).forEach((spec, i) => {
    const landings = spec.landings.map(([x, z, f]) => spotAt(x, z, YAW[f]));
    const fp = layoutPlan(spec.plan, { entrance: landings[0], yardWander: false });
    floors.push({ index: i + 1, name: spec.name, y: spec.y, h: spec.h, rects: spec.rects, voids: spec.voids || [], landings, ...fp, key: `${ground.key}#${i + 1}` });
  });
  for (const f of floors) {
    for (const d of f.desks) {
      d.floor = f.index;
      d.entrance = f.index ? f.landings.reduce((a, b) => (Math.hypot(b.x - d.x, b.z - d.z) < Math.hypot(a.x - d.x, a.z - d.z) ? b : a)) : f.stations.entrance;
    }
    f.obstacles = [...f.obstacles, ...(f.index ? floorShellBlocks(f) : [])];
  }
  // Round-robin over floors: the owner starts on the ground floor, then one resident per floor, and so on.
  const seats = [];
  for (let round = 0; seats.length < floors.reduce((n, f) => n + f.desks.length, 0); round++) {
    for (const f of floors) if (f.desks[round]) seats.push({ floor: f.index, desk: f.desks[round] });
  }
  return { key: ground.key, floors, seats };
}

/** The most residents each tier can house: one per home level until the next building tier unlocks. */
export const TIER_CAPACITY = Object.fromEntries(TIER_PLANS.map((p, i) => [p.key, (BUILDING_UNLOCK_LEVELS[i + 1] ?? MAX_LEVEL + 1) - 1]));

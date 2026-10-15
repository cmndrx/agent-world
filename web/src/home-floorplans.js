// Ground-floor plans for the eight residential tiers. Pure data and geometry helpers (no Three.js) so layouts can
// be validated in Node. Lot-local coordinates; the ground floor's inside spans x −6.95..6.95, z −4.95..4.95 and the
// street (front wall, doors) is at +z. Facing letters: 's' toward the street (+z), 'n' toward the back (−z),
// 'e' (+x), 'w' (−x).
//
// Residents only *work* at desks; the bookshelf, whiteboard, globe, coffee and couch are flavor stations
// (sim.js FLAVOR) and the rack blinks while commands run. Every plan provides all of them, laid out the way that
// kind of building is: a cottage with a kitchen, bedroom and study; a family house with a hall, living room,
// kitchen and office; a duplex split into two homes; a townhouse row of four narrow homes with their own doors;
// apartment buildings with lobbies, mail, elevators and shared rooms.

const PI = Math.PI;
export const YAW = { s: 0, e: PI / 2, n: PI, w: -PI / 2 };
export const PARTITION_T = 0.12;
export const DOORWAY = 1.4;
export const spotAt = (x, z, face) => ({ x: +x.toFixed(3), z: +z.toFixed(3), face });

/** Canonical footprints (width along the front, depth front-to-back) with the front facing +z. */
export const FURNITURE = {
  bookshelf: { w: 2.0, d: 0.42 },
  whiteboard: { w: 2.0, d: 0.1, walkable: true },
  globe: { w: 0.6, d: 0.6 },
  rack: { w: 0.95, d: 0.8 },
  coffeeBar: { w: 1.9, d: 0.95 },
  couch: { w: 2.7, d: 0.95 },
  loveseat: { w: 1.9, d: 0.9 },
  sideTable: { w: 0.6, d: 0.6 },
  floorLamp: { w: 0.4, d: 0.4 },
  plant: { w: 0.48, d: 0.48 },
  rug: { w: 2, d: 2, walkable: true },
  bed: { w: 1.8, d: 2.3 },
  kitchen: { w: 3, d: 0.65 },
  fridge: { w: 0.8, d: 0.72 },
  dining: { w: 2.0, d: 1.6 },
  armchair: { w: 0.9, d: 0.9 },
  fireplace: { w: 1.9, d: 0.55 },
  tv: { w: 1.6, d: 0.45 },
  reception: { w: 2.6, d: 0.9 },
  mailboxes: { w: 1.8, d: 0.32 },
  elevator: { w: 2.2, d: 0.5 },
  stairs: { w: 1.0, d: 2.6 },
  bath: { w: 2.2, d: 0.9 },
  wardrobe: { w: 1.2, d: 0.6 },
  laundry: { w: 1.6, d: 0.7 },
  bench: { w: 1.6, d: 0.5 },
  treadmill: { w: 0.8, d: 1.7 },
  column: { w: 0.5, d: 0.5 },
  planter: { w: 0.9, d: 0.9 },
  lockers: { w: 2.0, d: 0.45 },
  stairwell: { w: 1.0, d: 2.6 },
};

/** Where Sims stand or sit at a station, in the item's local frame (front +z); `toward` = facing the item. */
const SPOTS = {
  bookshelf: { station: 'bookshelf', at: [[-0.7, 0.83], [0, 0.83], [0.7, 0.83]], toward: true },
  whiteboard: { station: 'whiteboard', at: [[-0.45, 0.92], [0.45, 0.92]], toward: true },
  globe: { station: 'globe', at: [[0, 0.85], [0.85, 0], [-0.85, 0]], toward: true },
  rack: { station: 'rack', at: [[0, 1.0], [-0.85, 1.0]], toward: true },
  coffeeBar: { station: 'coffee', at: [[-0.35, 0.9], [0.45, 0.9]], toward: true },
  couch: { station: 'couch', at: [[-0.85, 0.02], [0, 0.02], [0.85, 0.02]] },
  loveseat: { station: 'couch', at: [[-0.45, 0.02], [0.45, 0.02]] },
};

export function rotate(lx, lz, yaw) {
  const c = Math.cos(yaw);
  const s = Math.sin(yaw);
  return [lx * c + lz * s, -lx * s + lz * c];
}

const spot = (x, z, face) => ({ x: +x.toFixed(3), z: +z.toFixed(3), face });

/** Footprint rect of an item (or null when it can be walked over). */
export function itemRect(item) {
  const def = FURNITURE[item.kind];
  if (def.walkable || item.walkable) return null;
  let w = item.w ?? (item.kind === 'kitchen' ? item.len ?? def.w : item.kind === 'stairs' ? def.w : def.w);
  let d = item.d ?? (item.kind === 'stairs' ? item.len ?? def.d : def.d);
  if (item.facing === 'e' || item.facing === 'w') [w, d] = [d, w];
  return [item.x - w / 2, item.z - d / 2, item.x + w / 2, item.z + d / 2];
}

/** A desk: the resident sits on its `look` side's opposite, facing `look` (sim.js DESK geometry). */
export function deskLayout(x, z, look = 'n') {
  const t = YAW[look] - PI;
  const at = (lx, lz, face) => {
    const [dx, dz] = rotate(lx, lz, t);
    return spot(x + dx, z + dz, face);
  };
  const [hw, hd] = look === 'e' || look === 'w' ? [0.43, 0.85] : [0.85, 0.43];
  return {
    x, z, yaw: t, look,
    block: [x - hw, z - hd, x + hw, z + hd],
    chair: at(0, 0.78, t + PI),
    wait: at(0, 1.73, t),
    visitorWait: at(0.85, 1.78, t),
    guests: [at(1.3, 0.85, t - 2.2), at(1.3, 1.6, t - 2.6), at(-1.3, 0.85, t + 2.2)],
  };
}

/** Split a partition line into solid segments around its doorways (centers along the line). */
export function partitionSegments([x0, z0, x1, z1, doors = []]) {
  const alongX = z0 === z1;
  const a0 = alongX ? Math.min(x0, x1) : Math.min(z0, z1);
  const a1 = alongX ? Math.max(x0, x1) : Math.max(z0, z1);
  const out = [];
  let cursor = a0;
  for (const c of [...doors].sort((a, b) => a - b)) {
    if (c - DOORWAY / 2 > cursor + 0.01) out.push([cursor, c - DOORWAY / 2]);
    cursor = c + DOORWAY / 2;
  }
  if (a1 > cursor + 0.01) out.push([cursor, a1]);
  const h = PARTITION_T / 2;
  return out.map(([a, b]) => (alongX ? [a, z0 - h, b, z0 + h] : [x0 - h, a, x0 + h, b]));
}

export const I = (kind, x, z, facing = 's', opts = {}) => ({ kind, x, z, facing, ...opts });
/** Places to stroll in the yard: the front path, the side yards and the back garden. */
const YARD_WANDER = [[0.4, 6.6], [-3.4, 6.8], [4.4, 6.8], [-7.6, 4.0], [7.7, -1.0], [-8.4, -3.2], [-3.0, -6.4], [3.6, -6.3]]; // lot.js drops any the yard leaves unreachable
/** A desk at (x, z) whose resident faces `look`; `bed` pins it to the plan's n-th bed (default: nearest free). */
export const D = (x, z, look = 'n', bed = null) => [x, z, look, bed];

/**
 * Plans by tier key. `desks` are in seat order (seat 1 is the owner's); a plan has at least as many desks as its
 * home level has resident slots. `rooms` label areas (and give some a tiled or carpeted floor).
 */
export const FLOORPLANS = {
  cottage: {
    rooms: [['Kitchen', 'tile', -6.95, -4.95, -2.2, -3.4], ['Bedroom', 'carpet', 2.86, -4.95, 6.95, -1.06], ['Living room', null, -6.95, 0.6, -2.0, 4.95], ['Study', null, 2.9, -0.9, 6.95, 4.95]],
    partitions: [[2.8, -4.95, 2.8, -1.0], [2.8, -1.0, 6.95, -1.0, [3.7]]],
    items: [
      I('kitchen', -5.05, -4.6, 's', { len: 3.8, coffee: 1.3 }),
      I('fridge', -2.7, -4.58),
      I('dining', -4.3, -2.3),
      I('bookshelf', -6.74, -0.6, 'e'),
      I('globe', -4.9, 0.0),
      I('rug', -4.9, 2.2, 's', { w: 2.6, d: 2.4 }),
      I('fireplace', -6.67, 2.2, 'e'),
      I('couch', -3.6, 2.2, 'w'),
      I('armchair', -5.2, 3.95, 'n'),
      I('floorLamp', -6.6, 4.5),
      I('plant', -3.0, 4.55),
      I('rack', 2.25, -4.55),
      I('bed', 5.4, -3.8),
      I('sideTable', 6.65, -4.55),
      I('wardrobe', 3.6, -4.62),
      I('rug', 4.7, -2.0, 's', { w: 2.2, d: 1.2 }),
      I('plant', 6.55, -1.45),
      I('whiteboard', 6.93, 1.2, 'w'),
      I('plant', 6.55, 4.5),
    ],
    desks: [D(5.0, 0.1), D(5.0, 2.7), D(2.0, 0.2), D(1.0, -2.6), D(-1.5, -2.6), D(-1.0, 0.2), D(2.0, 2.7), D(-1.6, 2.7)],
    wander: [[0.45, 1.5], [-3.0, -0.6], [3.9, -2.0]],
    art: [[-1.3, -4.97, 's'], [5.4, -4.97, 's'], [-6.97, 2.2, 'e']],
    gallery: [-0.3, -4.96],
  },
  'family-house': {
    rooms: [['Kitchen', 'tile', -6.95, -4.95, -1.46, -0.66], ['Living room', null, -6.95, -0.54, -1.46, 4.95], ['Hall', 'tile', -1.34, -4.95, 1.34, 4.95], ['Office', null, 1.46, -0.54, 6.95, 4.95], ['Study', 'carpet', 1.46, -4.95, 6.95, -0.66], ['Bath', 'tile', 1.46, -4.95, 3.74, -3.26]],
    partitions: [[-1.4, -4.95, -1.4, 4.95, [-2.6, 2.6]], [1.4, -4.95, 1.4, 4.95, [1.4, -1.35]], [-6.95, -0.6, -1.4, -0.6, [-3.0]], [1.4, -0.6, 6.95, -0.6], [3.8, -4.95, 3.8, -3.2], [1.4, -3.2, 3.8, -3.2, [2.6]]],
    items: [
      I('kitchen', -4.6, -4.6, 's', { len: 4.0, coffee: -1.4 }),
      I('fridge', -2.05, -4.58),
      I('dining', -4.6, -2.2),
      I('bookshelf', -5.6, -0.33, 's'),
      I('fireplace', -6.67, 2.2, 'e'),
      I('rug', -5.0, 2.2, 's', { w: 2.4, d: 2.4 }),
      I('couch', -3.7, 2.2, 'w'),
      I('armchair', -5.4, 4.1, 'n'),
      I('globe', -2.9, 4.2, 'n'),
      I('floorLamp', -6.6, 4.5),
      I('stairs', 0.8, -3.4, 's', { len: 2.8 }),
      I('plant', -0.95, 4.5),
      I('bath', 2.6, -4.5),
      I('bookshelf', 6.74, -2.85, 'w'),
      I('rack', 6.55, -1.2, 'w'),
      I('whiteboard', 5.4, -4.92, 's'),
      I('armchair', 4.4, -2.4, 's'),
      I('plant', 6.55, 4.5),
    ],
    desks: [D(2.85, 0.0), D(5.35, 0.0), D(2.85, 2.7), D(5.35, 2.7)],
    wander: [[0.0, 1.0], [-2.6, -1.4], [5.0, -2.0]],
    art: [[-6.97, 2.2, 'e'], [-4.6, -4.97, 's'], [4.2, 4.97, 'n']],
    gallery: [-4.6, -4.96],
  },
  duplex: {
    rooms: [['Kitchen', 'tile', -6.95, -4.95, -0.06, -3.6], ['Kitchen', 'tile', 0.06, -4.95, 6.95, -3.6], ['Living room', 'carpet', -6.95, 2.0, -3.2, 4.95], ['Living room', 'carpet', 3.2, 2.0, 6.95, 4.95]],
    partitions: [[0, -4.95, 0, 4.95]],
    items: [
      // West home.
      I('kitchen', -4.9, -4.6, 's', { len: 3.6, coffee: 1.2 }),
      I('fridge', -2.6, -4.58),
      I('dining', -4.6, -2.3),
      I('bookshelf', -0.27, -2.0, 'w'),
      I('tv', -6.72, 3.6, 'e'),
      I('rug', -5.3, 3.6, 's', { w: 1.8, d: 2.2 }),
      I('couch', -3.9, 3.6, 'w'),
      I('plant', -6.6, 1.6),
      I('stairs', -0.56, 3.6, 's', { len: 2.4 }),
      // East home.
      I('kitchen', 4.9, -4.6, 's', { len: 3.6, coffee: -1.2 }),
      I('fridge', 2.6, -4.58),
      I('dining', 4.2, -2.3),
      I('whiteboard', 6.93, 0.6, 'w'),
      I('rack', 6.55, -1.9, 'w'),
      I('tv', 6.72, 3.6, 'w'),
      I('rug', 5.3, 3.6, 's', { w: 1.8, d: 2.2 }),
      I('couch', 3.9, 3.6, 'e'),
      I('stairs', 0.56, 3.6, 's', { len: 2.4 }),
      I('globe', 2.3, -2.4, 'e'),
      I('plant', 6.6, 1.6),
    ],
    desks: [D(-4.6, 0.0), D(4.6, 0.0), D(-1.9, 0.0), D(1.9, 0.0)],
    wander: [[-3.2, -1.2], [3.2, -1.2]],
    art: [[-6.97, 0.6, 'e'], [-4.9, -4.97, 's']],
    gallery: [4.9, -4.96],
  },
  'townhouse-row': {
    // Four narrow homes behind party walls, each entered by its own front door: kitchen across the back, a desk
    // against a party wall, stairs up from the front hall.
    rooms: [['Kitchen', 'tile', -6.95, -4.95, -3.66, -3.9], ['Kitchen', 'tile', -3.54, -4.95, -0.06, -3.9], ['Kitchen', 'tile', 0.06, -4.95, 3.54, -3.9], ['Kitchen', 'tile', 3.66, -4.95, 6.95, -3.9]],
    partitions: [[-3.6, -4.95, -3.6, 4.95], [0, -4.95, 0, 4.95], [3.6, -4.95, 3.6, 4.95]],
    items: [
      // Home 1 (door −6.1): the reader's home.
      I('kitchen', -5.3, -4.6, 's', { len: 3.1, coffee: 0.9 }),
      I('bookshelf', -6.74, -1.0, 'e'),
      I('loveseat', -6.5, 1.95, 'e'),
      I('whiteboard', -6.93, 3.7, 'e'),
      I('stairs', -4.16, 3.6, 's', { len: 2.6 }),
      // Home 2 (door −2.5): the planner's home.
      I('kitchen', -1.8, -4.6, 's', { len: 3.3 }),
      I('bookshelf', -3.33, 1.4, 'e'),
      I('loveseat', -0.51, 0.75, 'w'),
      I('stairs', -0.56, 3.6, 's', { len: 2.6 }),
      // Home 3 (door 1.1): the traveller's home.
      I('kitchen', 1.8, -4.6, 's', { len: 3.3 }),
      I('globe', 1.0, -3.0, 'e'),
      I('armchair', 0.55, 1.0, 'e'),
      I('stairs', 3.04, 3.6, 's', { len: 2.6 }),
      // Home 4 (door 4.7): the tinkerer's home, with the row's server rack.
      I('kitchen', 4.8, -4.6, 's', { len: 2.2, coffee: 0.6 }),
      I('rack', 6.45, -4.5, 's'),
      I('stairs', 6.45, 3.6, 's', { len: 2.6 }),
      I('plant', 3.95, 4.5),
    ],
    desks: [D(-4.11, -2.0, 'e'), D(-0.51, -2.0, 'e'), D(3.09, -2.0, 'e'), D(6.5, -2.0, 'e')],
    wander: [[-5.3, 0.3], [-2.0, 3.0], [1.4, 2.6], [5.0, 1.0]],
    art: [[6.97, 0.8, 'w'], [-1.8, -4.97, 's']],
    gallery: [-1.8, -4.96],
  },
  'small-apartment': {
    // A lobby with the elevator, stairs, mailboxes and a bench between apartment 1A (kitchen, sleeping alcove,
    // two desks) and the residents' lounge with a coffee bar and shared desks.
    rooms: [['Lobby', 'tile', -1.44, -4.95, 1.44, 4.95], ['Apartment 1A', null, -6.95, -4.95, -1.56, 4.95], ['Bedroom', 'carpet', -6.95, 2.66, -4.2, 4.95], ['Lounge', 'carpet', 1.56, -4.95, 6.95, 4.95]],
    partitions: [[-1.5, -4.95, -1.5, 4.95, [1.2]], [1.5, -4.95, 1.5, 4.95, [2.0]], [-6.95, 2.6, -4.2, 2.6]],
    items: [
      I('elevator', -0.75, -4.7, 's', { w: 1.2 }),
      I('stairs', 0.85, -3.6, 's', { len: 2.6, w: 0.9 }),
      I('mailboxes', -1.28, -1.2, 'e'),
      I('bench', 1.19, 0.4, 'w'),
      I('plant', -1.1, 4.55),
      // Apartment 1A.
      I('kitchen', -5.25, -4.6, 's', { len: 3.4, coffee: 1.1 }),
      I('fridge', -3.1, -4.58),
      I('bookshelf', -1.77, -1.6, 'w'),
      I('bed', -5.8, 3.85, 'e'),
      I('loveseat', -2.3, 3.8, 'w'),
      I('plant', -6.6, 2.2),
      // Residents' lounge and co-working.
      I('coffeeBar', 6.47, -3.2, 'w'),
      I('whiteboard', 4.0, -4.92, 's'),
      I('rack', 2.1, -4.55),
      I('couch', 4.2, 4.2, 'n'),
      I('globe', 6.4, 3.4, 'w'),
      I('plant', 6.55, 4.55),
    ],
    desks: [D(-4.6, -2.4), D(2.55, -1.6), D(5.35, -1.6), D(-4.6, 0.4), D(2.55, 1.0), D(5.35, 1.0)],
    wander: [[0.0, 2.0], [-3.0, 2.0], [4.0, -3.4]],
    art: [[-6.97, -1.0, 'e'], [6.97, 0.0, 'w']],
    gallery: [-5.25, -4.96],
  },
  'apartment-block': {
    // A staffed lobby (reception, mail wall, elevator) between the residents' lounge with its fireplace, a back
    // room with laundry, parcel lockers and a kitchenette, and the co-working room.
    rooms: [['Lobby', 'tile', -1.94, -4.95, 1.94, 4.95], ['Residents lounge', 'carpet', -6.95, 0.1, -2.06, 4.95], ['Laundry and kitchenette', 'tile', -6.95, -4.95, -2.06, -0.02], ['Co-working', null, 2.06, -4.95, 6.95, 4.95]],
    partitions: [[-2.0, -4.95, -2.0, 4.95, [3.4, -1.0]], [2.0, -4.95, 2.0, 4.95, [3.6]], [-6.95, 0.04, -2.0, 0.04, [-3.0]]],
    items: [
      I('elevator', 0, -4.7),
      I('reception', 0, 0.8, 's', { w: 2.0 }),
      I('mailboxes', -1.78, -2.0, 'e'),
      I('plant', -1.65, 4.55),
      I('plant', 1.65, 4.55),
      I('fireplace', -6.67, 2.5, 'e'),
      I('rug', -5.2, 2.5, 's', { w: 2.4, d: 2.6 }),
      I('couch', -4.0, 2.5, 'w'),
      I('armchair', -5.5, 4.3, 'n'),
      I('bookshelf', -2.27, 1.1, 'w'),
      I('globe', -2.6, 4.3, 'n'),
      I('laundry', -5.8, -4.55),
      I('lockers', -3.6, -4.7),
      I('rack', -6.55, -1.4, 'e'),
      I('coffeeBar', -2.535, -3.2, 'w'),
      I('whiteboard', 4.6, -4.92, 's'),
      I('plant', 6.55, 4.55),
    ],
    desks: [D(3.2, -3.1), D(6.5, -3.2, 'e'), D(3.2, -0.5), D(6.5, -0.6, 'e'), D(3.2, 2.1), D(6.5, 2.0, 'e')],
    wander: [[0.0, -1.6], [-4.4, -2.4], [-3.0, 1.0], [4.6, 0.8]],
    art: [[-6.97, 2.5, 'e'], [0, -4.97, 's'], [6.97, 0.8, 'w']],
    gallery: [-5.0, -4.96],
  },
  'residential-tower': {
    // A concierge lobby with two elevators; co-working and a mechanical room on one side; a café lounge and a
    // mail room with a private office on the other.
    rooms: [['Lobby', 'tile', -1.94, -4.95, 1.94, 4.95], ['Co-working', null, -6.95, -1.5, -2.06, 4.95], ['Mechanical', 'tile', -6.95, -4.95, -2.06, -1.62], ['Café lounge', 'carpet', 2.06, -0.4, 6.95, 4.95], ['Mail room and office', 'tile', 2.06, -4.95, 6.95, -0.52]],
    partitions: [[-2.0, -4.95, -2.0, 4.95, [4.0]], [2.0, -4.95, 2.0, 4.95, [3.6, -2.4]], [-6.95, -1.56, -2.0, -1.56, [-4.6]], [2.0, -0.46, 6.95, -0.46, [5.9]]],
    items: [
      I('elevator', -0.9, -4.7, 's', { w: 1.6 }),
      I('elevator', 0.9, -4.7, 's', { w: 1.6 }),
      I('reception', 0, 0.6, 's', { w: 2.0 }),
      I('plant', -1.65, 4.55),
      I('plant', 1.65, 4.55),
      I('rack', -5.2, -4.5, 's'),
      I('whiteboard', -3.2, -4.92, 's'),
      I('coffeeBar', 6.47, 1.6, 'w'),
      I('couch', 4.6, 4.2, 'n'),
      I('globe', 2.5, 0.4, 'e'),
      I('plant', 6.55, 4.55),
      I('mailboxes', 4.2, -4.79),
      I('bookshelf', 6.74, -2.3, 'w'),
      I('plant', 2.35, -4.55),
    ],
    desks: [D(-6.5, 0.4, 'w'), D(-3.2, 1.2), D(-6.5, 3.0, 'w'), D(3.9, -2.6), D(4.3, 1.4), D(-2.51, -3.0, 'e'), D(-6.5, -2.7, 'w')],
    wander: [[0.0, -1.8], [-4.6, 1.0], [5.2, 2.9]],
    art: [[0, -4.97, 's'], [6.97, 3.2, 'w'], [-6.97, 1.0, 'e']],
    gallery: [4.2, -4.96],
  },
  'landmark-residence': {
    // A grand lobby with a reception desk before the elevator bank; two private office suites; a library lounge
    // around a fireplace with a reading desk; a business center with a coffee bar beside the building's systems.
    rooms: [['Grand lobby', 'tile', -1.94, -4.95, 1.94, 4.95], ['Office suite', 'carpet', -6.95, 0.06, -2.06, 4.95], ['Office suite', 'carpet', -6.95, -4.95, -2.06, -0.06], ['Library', 'carpet', 2.06, 0.06, 6.95, 4.95], ['Business center', 'tile', 2.06, -4.95, 6.95, -0.06]],
    partitions: [[-2.0, -4.95, -2.0, 4.95, [2.4, -0.9]], [2.0, -4.95, 2.0, 4.95, [3.4, -0.9]], [-6.95, 0, -2.0, 0], [2.0, 0, 6.95, 0]],
    items: [
      I('elevator', -0.85, -4.7, 's', { w: 1.5 }),
      I('elevator', 0.85, -4.7, 's', { w: 1.5 }),
      I('reception', 0, -1.6, 's', { w: 1.6 }),
      I('plant', -1.6, 4.6),
      I('plant', 1.6, 4.6),
      I('rug', 0, 1.6, 's', { w: 2.4, d: 2.6 }),
      // Office suites.
      I('bookshelf', -6.74, 3.6, 'e'),
      I('whiteboard', -4.3, -4.92, 's'),
      I('plant', -6.6, -4.55),
      // Library lounge.
      I('fireplace', 6.67, 2.6, 'w'),
      I('rug', 5.5, 2.6, 's', { w: 1.6, d: 2.4 }),
      I('couch', 4.9, 2.6, 'e'),
      I('bookshelf', 5.4, 0.31, 's'),
      I('globe', 2.7, 4.3, 'n'),
      I('plant', 6.6, 4.55),
      // Business center and systems.
      I('coffeeBar', 5.0, -4.47, 's'),
      I('rack', 2.55, -4.5, 's'),
    ],
    desks: [D(-6.0, 1.6), D(-3.4, 1.6), D(-6.0, -2.9), D(-3.4, -2.9), D(3.2, -3.4), D(6.5, -3.6, 'e'), D(3.0, 1.0), D(6.5, -1.5, 'e')],
    wander: [[0.0, 0.4], [-4.7, -0.9], [4.6, -1.6]],
    art: [[0, -4.97, 's'], [-6.97, 1.4, 'e'], [6.97, 2.6, 'w']],
    gallery: [-5.2, -4.96],
  },
};

/**
 * Lay out one floor's plan: items with footprints, partition segments, desks, station spots and obstacles.
 * Beds give their nearest desk a `rest` spot (sitting on the end of the bed), so each resident has a living space.
 */
export function layoutPlan(plan, { yardRects = [], entrance = spot(0, 10.6, PI), yardWander = true } = {}) {
  const items = plan.items.map((it) => ({ ...it, rect: itemRect(it) }));
  const partitions = plan.partitions.flatMap(partitionSegments);
  const desks = plan.desks.map(([x, z, look]) => deskLayout(x, z, look));
  const stations = { bookshelf: [], whiteboard: [], globe: [], rack: [], coffee: [], couch: [] };
  const beds = [];
  for (const it of items) {
    const yaw = YAW[it.facing] ?? 0;
    if (it.kind === 'bed') {
      const [dx, dz] = rotate(0, 0.75, yaw);
      beds.push(spot(it.x + dx, it.z + dz, yaw));
      continue;
    }
    const def = it.kind === 'kitchen' && it.coffee != null
      ? { station: 'coffee', at: [[it.coffee - 0.3, 0.755], [it.coffee + 0.4, 0.755]], toward: true }
      : SPOTS[it.kind];
    if (!def) continue;
    for (const [lx, lz] of def.at) {
      const [dx, dz] = rotate(lx, lz, yaw);
      const face = def.toward ? Math.atan2(-dx, -dz) : yaw;
      stations[def.station].push(spot(it.x + dx, it.z + dz, face));
    }
  }
  // Each bed belongs to its pinned desk, or else to the closest desk without one.
  const free = new Set(beds);
  plan.desks.forEach(([, , , bed], i) => {
    if (bed != null && beds[bed]) { desks[i].rest = beds[bed]; free.delete(beds[bed]); }
  });
  for (const [i, d] of desks.entries()) {
    if (d.rest || plan.desks[i][3] === false || !free.size) continue;
    d.rest = [...free].sort((a, b) => Math.hypot(a.x - d.x, a.z - d.z) - Math.hypot(b.x - d.x, b.z - d.z))[0];
    free.delete(d.rest);
  }
  // Indoor wander spots, plus the yard spots this tier's landscaping leaves open.
  const clear = ([x, z]) => !yardRects.some((r) => x > r[0] - 0.45 && x < r[2] + 0.45 && z > r[1] - 0.45 && z < r[3] + 0.45);
  stations.wander = [...plan.wander.map((p) => [...p, false]), ...(yardWander ? YARD_WANDER.filter(clear) : []).map((p) => [...p, true])]
    .map(([x, z, yard], i) => ({ ...spot(x, z, (i * 0.7) % (2 * PI) - PI), ...(yard ? { yard } : {}) }));
  stations.entrance = entrance;
  const obstacles = [...partitions, ...items.map((it) => it.rect).filter(Boolean), ...desks.map((d) => d.block)];
  return { items, partitions, desks, stations, beds, obstacles, rooms: plan.rooms, art: plan.art || [], gallery: plan.gallery };
}

/** The tier's ground floor (upper floors and seat order live in home-floors.js). */
export function floorplanFor(key, yardRects = []) {
  const plan = FLOORPLANS[key] || FLOORPLANS.cottage;
  return { key: FLOORPLANS[key] ? key : 'cottage', ...layoutPlan(plan, { yardRects }) };
}

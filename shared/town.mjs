// Town planning (simulation layer): a versioned grid of streets and residential plots. Pure data and pure
// functions, shared by the bridge (which validates and persists every change) and the client (which
// previews, renders and navigates from the same layout). Nothing here creates projects or agents.
//
// The grid: square tiles of TILE metres. Tile (i, j) covers world x [8i − 4, 8i + 4], z [8j, 8j + 8].
// A street is one tile wide (asphalt plus a sidewalk on each side). A home reserves 3 × 3 tiles (24 × 24 m):
// enough for the widest tier's yard, fence, trees and decor bounds (x ±11, z −9.2…+7.7 in lot-local metres),
// so upgrading a home never collides with its neighbours. Its entrance is the middle of its front edge and must
// adjoin a street tile. Rotation `rot` is quarter turns: 0 faces +z (south), 1 +x (east), 2 −z, 3 −x.
// Civic buildings (fire station, hospital, …) have their own footprints (w tiles across the front, d deep, from a
// 2 × 2 police station to a 4 × 4 hospital) and the same entrance rule: the middle of the front edge (for an even
// width, the tile right of centre as seen from the street) adjoins a street. One of each, unlocked by town tier
// (`townTier`; tiers come from shared/town-tiers.mjs).
// Recreation venues (park, arcade, cinema, …) follow exactly the same rules and share the saved `town.civic` list:
// it holds every public building, and each kind's definition says which group it belongs to.

import { experience, xpLevel } from './experience.mjs';
import { ACTIVITIES } from './catalogs/activities.js';
import { INTERESTS } from './catalogs/intrests.js';

export const TOWN_VERSION = 2;
export const TILE = 8;
export const HOME_TILES = 3;
/** Land you can build on (inclusive tile ranges): flat ground between the western and eastern groves. */
export const BUILDABLE = { i0: -7, j0: -2, i1: 16, j1: 17 };
/** The entry street: Main Street runs east from the town square. It cannot be removed. */
export const MAIN_STREET = { id: 'road-main', streetId: 'street-main', name: 'Main Street', i0: -7, j0: 1, i1: 16, j1: 1, protected: true };
/** Civic land that roads and buildings keep clear of in this version. */
export const PROTECTED = [
  { id: 'town-square', name: 'the town square and Town Hall', i0: -6, j0: -4, i1: -2, j1: 0 },
];

/** City infrastructure the player places themselves: one of each, unlocked by town tier. */
export const CIVIC = {
  fire_station: { name: 'Fire station', townTier: 1, icon: 'flame', color: 0xd9483b, size: { w: 3, d: 2 }, height: 11 },
  police: { name: 'Police department', townTier: 2, icon: 'shield', color: 0x3c64b4, size: { w: 2, d: 2 }, height: 8 },
  library: { name: 'Library', townTier: 2, icon: 'bookOpen', color: 0x8a6ccf, size: { w: 3, d: 2 }, height: 10 },
  school: { name: 'School', townTier: 3, icon: 'graduationCap', color: 0xe0a83a, size: { w: 4, d: 3 }, height: 11 },
  hospital: { name: 'Hospital', townTier: 4, icon: 'heartPulse', color: 0x4fb3a5, size: { w: 4, d: 4 }, height: 17 },
  city_dump: { name: 'City dump', townTier: 4, icon: 'trash', color: 0x7f8a5a, size: { w: 4, d: 3 }, height: 5 },
  water_tower: { name: 'Water tower', townTier: 5, icon: 'droplet', color: 0x5aa3d9, size: { w: 2, d: 2 }, height: 19 },
  power_plant: { name: 'Power plant', townTier: 6, icon: 'zap', color: 0xe8c547, size: { w: 4, d: 4 }, height: 15 },
};
/** Civic building kinds in unlock order. */
export const CIVIC_KINDS = Object.keys(CIVIC).sort((a, b) => CIVIC[a].townTier - CIVIC[b].townTier);

/** Recreation groups shown together in the planner (venues inside open by town tier). */
export const RECREATION_TIERS = [
  { tier: 1, name: 'Neighbourhood', blurb: 'Everyday places to unwind close to home' },
  { tier: 2, name: 'Downtown', blurb: 'Meals, gardens and workouts around town' },
  { tier: 3, name: 'Night out', blurb: 'Films, live music and long afternoons by the pool' },
  { tier: 4, name: 'Landmark', blurb: 'A destination the whole town plays at' },
];

/**
 * Where residents could spend free time: one of each, unlocked by town tier. `venue` is the catalog
 * template (shared/catalogs/buildings.js); the interests each one serves come from the activity catalog, so they
 * stay in step with what residents like to do. Placing one is scenery: it grants no happiness by itself and never
 * implies that an agent went there.
 */
const VENUES = {
  park: { name: 'Public park', tier: 1, townTier: 1, icon: 'trees', color: 0x5fae5a, size: { w: 3, d: 3 }, height: 7, venue: 'park' },
  ice_cream: { name: 'Ice cream parlour', tier: 1, townTier: 1, icon: 'iceCreamCone', color: 0xf08bb4, size: { w: 2, d: 2 }, height: 7, venue: 'ice_cream_shop' },
  arcade: { name: 'Arcade', tier: 1, townTier: 2, icon: 'gamepad', color: 0x7a4fd6, size: { w: 2, d: 2 }, height: 8, venue: 'arcade' },
  restaurant: { name: 'Restaurant', tier: 2, townTier: 3, icon: 'utensils', color: 0xc8553d, size: { w: 3, d: 2 }, height: 8, venue: 'restaurant' },
  community_garden: { name: 'Community garden', tier: 2, townTier: 3, icon: 'sprout', color: 0x8cbf4a, size: { w: 3, d: 2 }, height: 5, venue: 'community_garden' },
  gym: { name: 'Gym', tier: 2, townTier: 3, icon: 'dumbbell', color: 0x2f8fce, size: { w: 3, d: 2 }, height: 8, venue: 'gym' },
  cinema: { name: 'Movie theater', tier: 3, townTier: 4, icon: 'clapperboard', color: 0xb83a52, size: { w: 3, d: 3 }, height: 12, venue: 'movie_theater' },
  music_lounge: { name: 'Live music lounge', tier: 3, townTier: 5, icon: 'music', color: 0xd9822b, size: { w: 3, d: 2 }, height: 8, venue: 'live_music_lounge' },
  pool: { name: 'Public pool', tier: 3, townTier: 5, icon: 'wavesLadder', color: 0x3fb6d3, size: { w: 4, d: 3 }, height: 6, venue: 'public_swimming_pool' },
  sports_complex: { name: 'Sports complex', tier: 4, townTier: 6, icon: 'trophy', color: 0xe0a83a, size: { w: 4, d: 4 }, height: 12, venue: 'sports_complex' },
};
/** Interest ids whose activity can happen at a venue template. */
export const venueInterests = (venue) => INTERESTS
  .filter((i) => i.relatedActivities.some((a) => ACTIVITIES.find((x) => x.id === a)?.buildingIds.includes(venue)))
  .map((i) => i.id);
export const RECREATION = Object.fromEntries(Object.entries(VENUES).map(([k, v]) => [k, { ...v, group: 'recreation', interests: venueInterests(v.venue) }]));
/** Recreation kinds in unlock order. */
export const RECREATION_KINDS = Object.keys(RECREATION).sort((a, b) => RECREATION[a].townTier - RECREATION[b].townTier);
/** Every public building (civic services and recreation): what `town.civic` may hold. */
export const PUBLIC_BUILDINGS = { ...Object.fromEntries(Object.entries(CIVIC).map(([k, v]) => [k, { ...v, group: 'civic' }])), ...RECREATION };
export const PUBLIC_KINDS = [...CIVIC_KINDS, ...RECREATION_KINDS];

/**
 * Small 1×1 town props bought with Civic Pride (shared/civic-pride.mjs): many of each, no street needed, unlocked by
 * town tier. Their green space and noise buffer live in shared/town-influence.mjs (`PROP_RULES`).
 */
export const TOWN_PROPS = {
  tree: { name: 'Tree', townTier: 1, cost: 10, icon: 'treeDeciduous', color: 0x4f9a4a },
  flower_bed: { name: 'Flower bed', townTier: 1, cost: 15, icon: 'flower', color: 0xe887b8 },
  bench: { name: 'Bench', townTier: 1, cost: 10, icon: 'armchair', color: 0x9a6b43 },
  hedge: { name: 'Hedge row', townTier: 2, cost: 15, icon: 'leaf', color: 0x3f7d3a },
  fountain: { name: 'Fountain', townTier: 2, cost: 30, icon: 'droplet', color: 0x7cc4e4 },
  gazebo: { name: 'Gazebo', townTier: 3, cost: 35, icon: 'house', color: 0xf2e6cf },
  statue: { name: 'Statue', townTier: 4, cost: 40, icon: 'trophy', color: 0xc9c3b6 },
};
export const PROP_KINDS = Object.keys(TOWN_PROPS);
export const MAX_PROPS = 60;
export const DEFAULT_STREETS = ['Main Street', 'Oak Avenue', 'Maple Lane', 'Cedar Road', 'Willow Way', 'Birch Boulevard', 'Elm Court', 'Aspen Drive', 'Juniper Street', 'Linden Row'];
const MAX_ROADS = 400;

export const key = (i, j) => `${i},${j}`;
export const tileCenter = (i, j) => ({ x: i * TILE, z: j * TILE + TILE / 2 });
export const tileAt = (x, z) => ({ i: Math.round(x / TILE), j: Math.floor(z / TILE) });
export const inBuildable = (i, j) => i >= BUILDABLE.i0 && i <= BUILDABLE.i1 && j >= BUILDABLE.j0 && j <= BUILDABLE.j1;
const inRect = (r, i, j) => i >= r.i0 && i <= r.i1 && j >= r.j0 && j <= r.j1;
export const protectedAt = (i, j) => PROTECTED.find((r) => inRect(r, i, j)) || null;
const normRot = (rot) => ((Math.round(Number(rot)) % 4) + 4) % 4;
export const FACING = [[0, 1], [1, 0], [0, -1], [-1, 0]];

/** Every tile of an axis-aligned road segment. */
export function segTiles(s) {
  const out = [];
  for (let i = Math.min(s.i0, s.i1); i <= Math.max(s.i0, s.i1); i++) for (let j = Math.min(s.j0, s.j1); j <= Math.max(s.j0, s.j1); j++) out.push([i, j]);
  return out;
}

/** A building's size in tiles: w across its front, d deep (homes 3 × 3; civic buildings by kind). */
export const footprintSize = (b) => PUBLIC_BUILDINGS[b?.kind]?.size || { w: HOME_TILES, d: HOME_TILES };
/** Its extent on the grid once turned: ex tiles along x, ez along z. */
export function extents(b) {
  const { w, d } = footprintSize(b);
  return normRot(b.rot) % 2 ? { ex: d, ez: w } : { ex: w, ez: d };
}

/** The tiles a home (3 × 3) or civic building reserves; (i, j) is its north-west (minimum) tile. */
export function homeTiles(h) {
  const { ex, ez } = extents(h);
  const out = [];
  for (let a = 0; a < ex; a++) for (let b = 0; b < ez; b++) out.push([h.i + a, h.j + b]);
  return out;
}

/**
 * A civic building's frame: the footprint's centre, its yaw (local +z faces the street), its size in metres
 * (W across the front, D deep) and the door's local x (0 for odd widths, half a tile right for even ones).
 */
export function civicTransform(b) {
  const rot = normRot(b.rot);
  const { w, d } = footprintSize(b);
  const { ex, ez } = extents(b);
  return { x: b.i * TILE - TILE / 2 + (ex * TILE) / 2, z: b.j * TILE + (ez * TILE) / 2, yaw: (rot * Math.PI) / 2, rot, W: w * TILE, D: d * TILE, doorX: (Math.floor(w / 2) + 0.5 - w / 2) * TILE };
}

/** The street tile a building's entrance opens onto. */
export function entranceTile(h) {
  const t = civicTransform(h);
  const lx = t.doorX, lz = t.D / 2 + TILE / 2;
  const c = Math.cos(t.yaw), s = Math.sin(t.yaw);
  return tileAt(t.x + lx * c + lz * s, t.z - lx * s + lz * c + 1e-6);
}

/** The anchor (north-west tile) that centres a building on a tile, for previews that follow the pointer. */
export function centeredAt(t, rot, kind = null) {
  const { ex, ez } = extents({ kind, rot });
  return { i: t.i - Math.floor((ex - 1) / 2), j: t.j - Math.floor((ez - 1) / 2), rot: normRot(rot) };
}

/**
 * World placement of a home's lot group: the lot-local origin sits 4 m in front of the footprint's centre
 * (lot-local z spans −16…+8 across the footprint), and `yaw` turns lot-local +z to the home's facing.
 */
export function homeTransform(h) {
  const rot = normRot(h.rot);
  const [fx, fz] = FACING[rot];
  const c = tileCenter(h.i + 1, h.j + 1);
  return { x: c.x + fx * 4, z: c.z + fz * 4, yaw: (rot * Math.PI) / 2, rot };
}

/** Lot-local (x, z) → world, for a placement. */
export function localToWorld(h, x, z) {
  const t = homeTransform(h);
  const c = Math.cos(t.yaw), s = Math.sin(t.yaw);
  return { x: t.x + x * c + z * s, z: t.z - x * s + z * c };
}
/** World (x, z) → lot-local, for a placement. */
export function worldToLocal(h, x, z) {
  const t = homeTransform(h);
  const c = Math.cos(t.yaw), s = Math.sin(t.yaw);
  const dx = x - t.x, dz = z - t.z;
  return { x: dx * c - dz * s, z: dx * s + dz * c };
}

/** World rectangle [x0, z0, x1, z1] covered by a run of tiles. */
export function tilesRect(i0, j0, i1, j1) {
  return [Math.min(i0, i1) * TILE - TILE / 2, Math.min(j0, j1) * TILE, Math.max(i0, i1) * TILE + TILE / 2, Math.max(j0, j1) * TILE + TILE];
}

/** An empty town: just Main Street. */
export function emptyTown() {
  return { version: TOWN_VERSION, revision: 0, roads: [{ ...MAIN_STREET }], homes: [], civic: [], props: [], retired: [], pendingRemoval: {}, activeChoice: null };
}

/** Map of road tiles: "i,j" → road segment id. */
export function roadMap(town) {
  const m = new Map();
  for (const r of town.roads || []) for (const [i, j] of segTiles(r)) if (!m.has(key(i, j))) m.set(key(i, j), r.id);
  return m;
}

/** What occupies each tile ("i,j" → { kind, id, project? }), optionally ignoring one home or civic building (when moving it). */
export function occupancy(town, { exceptProject = null, exceptCivic = null, exceptProp = null } = {}) {
  const m = new Map();
  for (const h of town.homes || []) {
    if (h.project === exceptProject || h.i == null) continue;
    for (const [i, j] of homeTiles(h)) m.set(key(i, j), { kind: 'home', id: h.id, project: h.project });
  }
  for (const c of town.civic || []) {
    if (c.kind === exceptCivic) continue;
    for (const [i, j] of homeTiles(c)) m.set(key(i, j), { kind: 'civic', id: c.id, name: PUBLIC_BUILDINGS[c.kind]?.name });
  }
  for (const p of town.props || []) {
    if (p.id === exceptProp || p.i == null) continue;
    m.set(key(p.i, p.j), { kind: 'prop', id: p.id, name: TOWN_PROPS[p.kind]?.name || 'Prop' });
  }
  for (const r of town.roads || []) for (const [i, j] of segTiles(r)) if (!m.has(key(i, j))) m.set(key(i, j), { kind: 'road', id: r.id });
  return m;
}

/** Street tiles reachable from Main Street (4-neighbour connectivity). */
export function connectedRoads(town, roads = roadMap(town)) {
  const seen = new Set();
  const queue = segTiles(MAIN_STREET).map(([i, j]) => key(i, j)).filter((k) => roads.has(k));
  for (const k of queue) seen.add(k);
  while (queue.length) {
    const [i, j] = queue.shift().split(',').map(Number);
    for (const [di, dj] of FACING) {
      const k = key(i + di, j + dj);
      if (roads.has(k) && !seen.has(k)) {
        seen.add(k);
        queue.push(k);
      }
    }
  }
  return seen;
}

/**
 * Street distance (in tiles, 4-neighbour) from one street tile to every connected street tile: "i,j" → steps.
 * Empty when `from` is not a connected street. Town simulation uses it so services reach homes along the streets.
 */
export function streetDistances(town, from, roads = roadMap(town)) {
  const reach = connectedRoads(town, roads);
  const start = key(from.i, from.j);
  const dist = new Map();
  if (!reach.has(start)) return dist;
  dist.set(start, 0);
  const queue = [start];
  while (queue.length) {
    const k = queue.shift();
    const [i, j] = k.split(',').map(Number);
    for (const [di, dj] of FACING) {
      const n = key(i + di, j + dj);
      if (reach.has(n) && !dist.has(n)) { dist.set(n, dist.get(k) + 1); queue.push(n); }
    }
  }
  return dist;
}

/** Shape of a street tile for rendering: which neighbours are street too. */
export function roadShape(roads, i, j) {
  const n = roads.has(key(i, j - 1)), s = roads.has(key(i, j + 1)), w = roads.has(key(i - 1, j)), e = roads.has(key(i + 1, j));
  const count = n + s + w + e;
  return { n, s, e, w, count, kind: count >= 3 ? (count === 4 ? 'cross' : 'tee') : count === 2 ? ((n && s) || (e && w) ? 'straight' : 'corner') : count === 1 ? 'end' : 'single' };
}

const label = (o) => (o.kind === 'home' ? 'a home' : o.kind === 'road' ? 'a street' : o.kind === 'civic' ? `the ${String(o.name || 'civic building').toLowerCase()}`
  : o.kind === 'prop' ? `a ${String(o.name).toLowerCase()}` : o.name || 'protected land');

/**
 * Plan a straight street or one 90° turn from `a` to `b` (tiles). `bend` chooses the turn: 'x' runs east–west
 * first, 'z' north–south first. Returns each tile's state and, when valid, the new segments to add.
 */
export function planRoad(town, a, b, { bend = 'x' } = {}) {
  const roads = roadMap(town);
  const occ = occupancy(town);
  const corner = bend === 'z' ? { i: a.i, j: b.j } : { i: b.i, j: a.j };
  const straight = a.i === b.i || a.j === b.j;
  const legs = straight ? [[a, b]] : [[a, corner], [corner, b]];
  const tiles = [];
  const seen = new Set();
  legs.forEach(([p, q], leg) => {
    const di = Math.sign(q.i - p.i), dj = Math.sign(q.j - p.j);
    for (let i = p.i, j = p.j; ; i += di, j += dj) {
      if (!seen.has(key(i, j))) {
        seen.add(key(i, j));
        tiles.push({ i, j, leg });
      }
      if (i === q.i && j === q.j) break;
    }
  });
  let reason = '';
  for (const t of tiles) {
    const k = key(t.i, t.j);
    const o = occ.get(k);
    const p = protectedAt(t.i, t.j);
    if (roads.has(k)) t.state = 'existing';
    else if (!inBuildable(t.i, t.j)) [t.state, t.reason] = ['blocked', 'Outside buildable land: the groves and hills start here.'];
    else if (p) [t.state, t.reason] = ['blocked', `Keeps clear of ${p.name}.`];
    else if (o) [t.state, t.reason] = ['blocked', `Would run through ${label(o)}.`];
    else t.state = 'new';
    if (t.state === 'blocked' && !reason) reason = t.reason;
  }
  const fresh = tiles.filter((t) => t.state === 'new');
  if (!reason && !fresh.length) reason = 'That street is already built.';
  // A new street must join the network: touch or cross an existing street.
  if (!reason) {
    const joins = tiles.some((t) => t.state === 'existing') || fresh.some((t) => FACING.some(([di, dj]) => roads.has(key(t.i + di, t.j + dj))));
    if (!joins) reason = 'Connect new streets to an existing street.';
  }
  if (!reason && (town.roads || []).length >= MAX_ROADS) reason = 'This town has reached its street limit.';
  // Maximal runs of new tiles along each leg become straight segments.
  const segments = [];
  let run = null;
  tiles.forEach((t, n) => {
    const prev = tiles[n - 1];
    if (t.state !== 'new') { run = null; return; }
    if (run && prev && prev.state === 'new' && prev.leg === t.leg) {
      run.i0 = Math.min(run.i0, t.i); run.i1 = Math.max(run.i1, t.i);
      run.j0 = Math.min(run.j0, t.j); run.j1 = Math.max(run.j1, t.j);
    } else {
      run = { i0: t.i, j0: t.j, i1: t.i, j1: t.j };
      segments.push(run);
    }
  });
  return { ok: !reason, reason, tiles, segments };
}

/** Homes (active, including under construction) whose street access breaks if these tiles were removed. */
export function cutOffHomes(town, removeKeys) {
  const roads = roadMap(town);
  for (const k of removeKeys) roads.delete(k);
  const reach = connectedRoads(town, roads);
  return (town.homes || []).filter((h) => h.i != null && !reach.has(key(entranceTile(h).i, entranceTile(h).j)));
}

/** Civic buildings whose street access breaks if these tiles were removed. */
export function cutOffCivic(town, removeKeys) {
  const roads = roadMap(town);
  for (const k of removeKeys) roads.delete(k);
  const reach = connectedRoads(town, roads);
  return (town.civic || []).filter((c) => !reach.has(key(entranceTile(c).i, entranceTile(c).j)));
}

/** Plan removing a straight run of street tiles. */
export function planRoadRemoval(town, a, b) {
  const roads = roadMap(town);
  const tiles = [];
  let reason = '';
  if (a.i !== b.i && a.j !== b.j) reason = 'Remove streets in a straight line.';
  else {
    for (const [i, j] of segTiles({ i0: a.i, j0: a.j, i1: b.i, j1: b.j })) {
      const t = { i, j, state: roads.has(key(i, j)) ? 'remove' : 'empty' };
      if (t.state === 'remove' && i >= MAIN_STREET.i0 && i <= MAIN_STREET.i1 && j === MAIN_STREET.j0) [t.state, t.reason] = ['blocked', 'Main Street is the town’s entry street and stays.'];
      tiles.push(t);
    }
    const blocked = tiles.find((t) => t.state === 'blocked');
    if (blocked) reason = blocked.reason;
    else if (!tiles.some((t) => t.state === 'remove')) reason = 'There is no street there to remove.';
  }
  const removing = new Set(tiles.filter((t) => t.state === 'remove').map((t) => key(t.i, t.j)));
  const reach = connectedRoads(town);
  const linked = (b) => reach.has(key(entranceTile(b).i, entranceTile(b).j));
  const affected = reason ? [] : cutOffHomes(town, removing).filter(linked);
  const civic = reason ? [] : cutOffCivic(town, removing).filter(linked);
  if (!reason && affected.length) reason = affected.length === 1 ? 'A home would lose its connection to Main Street.' : `${affected.length} homes would lose their connection to Main Street.`;
  else if (!reason && civic.length) reason = civic.length === 1 ? `The ${PUBLIC_BUILDINGS[civic[0].kind].name.toLowerCase()} would lose its connection to Main Street.` : `${civic.length} public buildings would lose their connection to Main Street.`;
  return { ok: !reason, reason, tiles, affected: affected.map((h) => h.project), civic: civic.map((c) => c.kind) };
}

/** Is a home (or, with `civic`, a civic building) placement valid? Returns each footprint tile's state and every reason it isn't. */
export function checkPlacement(town, p, { project = p.project, civic = null } = {}) {
  const h = { i: Math.round(p.i), j: Math.round(p.j), rot: normRot(p.rot), ...(civic ? { kind: civic } : {}) };
  const occ = occupancy(town, civic ? { exceptCivic: civic } : { exceptProject: project });
  const reasons = [];
  const tiles = homeTiles(h).map(([i, j]) => {
    const o = occ.get(key(i, j));
    const pr = protectedAt(i, j);
    const t = { i, j, ok: true };
    if (!inBuildable(i, j)) [t.ok, t.reason] = [false, 'Part of the plot is outside buildable land.'];
    else if (pr) [t.ok, t.reason] = [false, `The plot overlaps ${pr.name}.`];
    else if (o) [t.ok, t.reason] = [false, o.kind === 'road' ? 'The plot overlaps a street.' : o.kind === 'civic' || o.kind === 'prop' ? `The plot overlaps ${label(o)}.` : 'The plot overlaps another home.'];
    if (!t.ok && !reasons.includes(t.reason)) reasons.push(t.reason);
    return t;
  });
  const door = entranceTile(h);
  const roads = roadMap(town);
  const frontage = roads.has(key(door.i, door.j));
  if (!frontage) reasons.push('The entrance (arrow) must face a street.');
  else if (!connectedRoads(town, roads).has(key(door.i, door.j))) reasons.push('That street isn’t connected to Main Street.');
  return { ok: !reasons.length, reasons, reason: reasons[0] || '', tiles, entrance: door, placement: h };
}

/** Every valid plot for a new (or moving) home or civic building, nearest the Town Hall first. */
export function eligiblePlots(town, { project = null, civic = null, limit = 60 } = {}) {
  const roads = roadMap(town);
  const reach = connectedRoads(town, roads);
  const out = [];
  const seen = new Set();
  for (const k of reach) {
    const [ri, rj] = k.split(',').map(Number);
    for (let rot = 0; rot < 4; rot++) {
      const e0 = entranceTile({ kind: civic, i: 0, j: 0, rot });
      const p = { i: ri - e0.i, j: rj - e0.j, rot };
      const id = `${p.i},${p.j},${rot}`;
      if (seen.has(id)) continue;
      seen.add(id);
      if (checkPlacement(town, p, { project, civic }).ok) out.push(p);
    }
  }
  // The classic plots first (three across each row, facing its street, as the old layout placed them), then
  // whatever is nearest the Town Hall.
  const classic = (p) => (p.rot === 0 && (p.i + 1) % 3 === 0 && p.i >= -1 && p.i <= 5 && (p.j + 2) % 4 === 0 ? ((p.j + 2) / 4) * 3 + (p.i + 1) / 3 : Infinity);
  const d = (p) => Math.hypot(p.i + 1 - -4, p.j + 1 - -2);
  return out.sort((a, b) => (classic(a) - classic(b)) || d(a) - d(b) || a.rot - b.rot).slice(0, limit);
}

const uid = (prefix, taken) => {
  for (let n = 1; ; n++) {
    const id = `${prefix}-${n.toString(36)}`;
    if (!taken.has(id)) return id;
  }
};
const ids = (town) => new Set([...(town.roads || []).map((r) => r.id), ...(town.homes || []).map((h) => h.id), ...(town.civic || []).map((c) => c.id), ...(town.props || []).map((p) => p.id)]);
const nextName = (town) => DEFAULT_STREETS.find((n) => !(town.roads || []).some((r) => r.name === n)) || `Street ${(town.roads || []).length + 1}`;

/** With connectivity recorded on every road and home (persisted alongside the layout). */
export function withNetwork(town) {
  const roads = roadMap(town);
  const reach = connectedRoads(town, roads);
  return {
    ...town,
    roads: town.roads.map((r) => ({ ...r, connected: segTiles(r).some(([i, j]) => reach.has(key(i, j))) })),
    homes: town.homes.map((h) => {
      if (h.i == null) return { ...h, connected: false, roadId: null };
      const e = entranceTile(h);
      return { ...h, connected: reach.has(key(e.i, e.j)), roadId: roads.get(key(e.i, e.j)) || null };
    }),
    civic: (town.civic || []).map((c) => {
      const e = entranceTile(c);
      return { ...c, connected: reach.has(key(e.i, e.j)), roadId: roads.get(key(e.i, e.j)) || null };
    }),
  };
}

export function addRoad(town, a, b, { bend = 'x', name } = {}) {
  const plan = planRoad(town, a, b, { bend });
  if (!plan.ok) throw Error(plan.reason);
  const taken = ids(town);
  const streetId = uid('street', new Set(town.roads.map((r) => r.streetId)));
  const streetName = String(name || '').trim().slice(0, 40) || nextName(town);
  const roads = [...town.roads];
  for (const s of plan.segments) {
    const id = uid('road', taken);
    taken.add(id);
    roads.push({ id, streetId, name: streetName, ...s });
  }
  return withNetwork({ ...town, roads, revision: town.revision + 1 });
}

export function removeRoad(town, a, b) {
  const plan = planRoadRemoval(town, a, b);
  if (!plan.ok) throw Error(plan.reason);
  const gone = new Set(plan.tiles.filter((t) => t.state === 'remove').map((t) => key(t.i, t.j)));
  const taken = ids(town);
  const roads = [];
  for (const r of town.roads) {
    const tiles = segTiles(r).filter(([i, j]) => !gone.has(key(i, j)));
    if (tiles.length === segTiles(r).length) { roads.push(r); continue; }
    // Split into the runs that remain; the first keeps the segment's id.
    let run = null;
    const runs = [];
    for (const [i, j] of tiles) {
      if (run && Math.abs(i - run.i1) + Math.abs(j - run.j1) === 1) { run.i1 = i; run.j1 = j; } else { run = { i0: i, j0: j, i1: i, j1: j }; runs.push(run); }
    }
    runs.forEach((s, n) => {
      const id = n === 0 ? r.id : uid('road', taken);
      taken.add(id);
      roads.push({ ...r, id, i0: Math.min(s.i0, s.i1), j0: Math.min(s.j0, s.j1), i1: Math.max(s.i0, s.i1), j1: Math.max(s.j0, s.j1) });
    });
  }
  return withNetwork({ ...town, roads, revision: town.revision + 1 });
}

export function renameStreet(town, streetId, name) {
  const value = String(name ?? '').replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, 40);
  if (!value) throw Error('Enter a street name.');
  if (!town.roads.some((r) => r.streetId === streetId)) throw Error('That street no longer exists.');
  return { ...town, roads: town.roads.map((r) => (r.streetId === streetId ? { ...r, name: value } : r)), revision: town.revision + 1 };
}

/** Place a new home, or move an existing one (identity and every other field preserved). */
export function placeHome(town, project, p) {
  if (typeof project !== 'string' || !project) throw Error('Choose a project.');
  const check = checkPlacement(town, p, { project });
  if (!check.ok) throw Error(check.reason);
  const existing = town.homes.find((h) => h.project === project);
  const at = { i: check.placement.i, j: check.placement.j, rot: check.placement.rot };
  const homes = existing
    ? town.homes.map((h) => (h.project === project ? { ...h, ...at, movedAt: new Date().toISOString() } : h))
    : [...town.homes, { id: uid('home', ids(town)), project, ...at, placedAt: new Date().toISOString() }];
  const clean = homes.map(({ repair, from, ...h }) => (h.project === project ? h : { ...h, ...(repair ? { repair } : {}), ...(from ? { from } : {}) }));
  return withNetwork({ ...town, homes: clean, retired: (town.retired || []).filter((r) => r.project !== project), revision: town.revision + 1 });
}

const tierOf = (tier) => Math.max(1, Math.floor(Number(tier)) || 1);
/** Civic buildings a town tier unlocks, in unlock order. */
export const civicUnlocked = (tier) => CIVIC_KINDS.filter((k) => CIVIC[k].townTier <= tierOf(tier));
/** Recreation venues a town tier unlocks, in unlock order. */
export const recreationUnlocked = (tier) => RECREATION_KINDS.filter((k) => RECREATION[k].townTier <= tierOf(tier));
/** The highest recreation group with at least one venue open at this town tier. */
export const recreationTier = (tier) => Math.max(0, ...recreationUnlocked(tier).map((k) => RECREATION[k].tier));

/** Place a civic building or recreation venue, or move one already placed. One of each kind; `tier` is the town tier. */
export function placeCivic(town, kind, p, { tier = 1 } = {}) {
  const def = Object.hasOwn(PUBLIC_BUILDINGS, kind) ? PUBLIC_BUILDINGS[kind] : null;
  if (!def) throw Error('Choose a civic building.');
  const existing = (town.civic || []).find((c) => c.kind === kind);
  if (!existing && def.townTier > tier) throw Error(`The ${def.name.toLowerCase()} unlocks at town tier ${def.townTier}.`);
  const check = checkPlacement(town, p, { civic: kind });
  if (!check.ok) throw Error(check.reason);
  const at = { i: check.placement.i, j: check.placement.j, rot: check.placement.rot };
  const civic = existing
    ? town.civic.map((c) => (c.kind === kind ? { ...c, ...at, movedAt: new Date().toISOString() } : c))
    : [...(town.civic || []), { id: uid('civic', ids(town)), kind, ...at, placedAt: new Date().toISOString() }];
  return withNetwork({ ...town, civic, revision: town.revision + 1 });
}

/** Take a civic building off the map (it can be placed again later). */
export function removeCivic(town, kind) {
  if (!(town.civic || []).some((c) => c.kind === kind)) throw Error('That building isn’t in your town.');
  return withNetwork({ ...town, civic: town.civic.filter((c) => c.kind !== kind), revision: town.revision + 1 });
}

// ---- Props: 1×1, many of each, no street needed ------------------------------------------------------

/** Can a prop stand on this tile? `exceptId` ignores the prop being moved. */
export function checkProp(town, at, { exceptId = null } = {}) {
  const i = Math.round(Number(at?.i)), j = Math.round(Number(at?.j));
  const o = occupancy(town, { exceptProp: exceptId }).get(key(i, j));
  const pr = protectedAt(i, j);
  const reason = !Number.isFinite(i) || !Number.isFinite(j) || !inBuildable(i, j) ? 'That tile is outside buildable land.'
    : pr ? `Keeps clear of ${pr.name}.` : o ? `That tile has ${label(o)}.` : '';
  return { ok: !reason, reason, i, j };
}

/** Place a new prop of `kind` (tier-checked, at most MAX_PROPS). Civic Pride is charged by shared/civic-pride.mjs. */
export function placeProp(town, kind, at, { tier = 1 } = {}) {
  const def = Object.hasOwn(TOWN_PROPS, kind) ? TOWN_PROPS[kind] : null;
  if (!def) throw Error('Choose a prop.');
  if (def.townTier > tier) throw Error(`The ${def.name.toLowerCase()} unlocks at town tier ${def.townTier}.`);
  if ((town.props || []).length >= MAX_PROPS) throw Error(`Your town has the most props it can hold (${MAX_PROPS}). Remove one first.`);
  const check = checkProp(town, at);
  if (!check.ok) throw Error(check.reason);
  const prop = { id: uid('prop', ids(town)), kind, i: check.i, j: check.j, placedAt: new Date().toISOString() };
  return { ...town, props: [...(town.props || []), prop], revision: town.revision + 1 };
}

/** Move a placed prop to another free tile (free of charge). */
export function moveProp(town, id, at) {
  const prop = (town.props || []).find((p) => p.id === id);
  if (!prop) throw Error('That prop isn’t in your town.');
  const check = checkProp(town, at, { exceptId: id });
  if (!check.ok) throw Error(check.reason);
  return { ...town, props: town.props.map((p) => (p.id === id ? { ...p, i: check.i, j: check.j, movedAt: new Date().toISOString() } : p)), revision: town.revision + 1 };
}

/** Take a prop off the map (shared/civic-pride.mjs refunds half its cost). */
export function removeProp(town, id) {
  if (!(town.props || []).some((p) => p.id === id)) throw Error('That prop isn’t in your town.');
  return { ...town, props: town.props.filter((p) => p.id !== id), revision: town.revision + 1 };
}

/** Take a home off the grid (its project became inactive). Its last plot is remembered as a suggestion. */
export function retireHome(town, project) {
  const h = town.homes.find((x) => x.project === project);
  if (!h) return town;
  const retired = [...(town.retired || []).filter((r) => r.project !== project), { id: h.id, project, i: h.i, j: h.j, rot: h.rot, removedAt: new Date().toISOString() }].slice(-100);
  return withNetwork({ ...town, homes: town.homes.filter((x) => x.project !== project), retired, revision: town.revision + 1 });
}

// ---- Permits: player level → how many active projects (each needs exactly one home) -------------

/** Levels 1, 2, 3 grant 1, 2, 3 permits; then one more every two levels (5, 7, 9, …). */
export function projectAllowance(level) {
  const l = Math.max(1, Math.floor(Number(level)) || 1);
  return l <= 3 ? l : 3 + Math.floor((l - 3) / 2);
}
/** Total player XP needed to reach a level (the existing curve: 100, then +50 per level). */
export function xpForLevel(level) {
  let xp = 0;
  for (let l = 1; l < level; l++) xp += 100 + (l - 1) * 50;
  return xp;
}
/** The next level that grants another permit. */
export function nextPermitLevel(level) {
  const now = projectAllowance(level);
  let l = Math.max(1, Math.floor(level));
  while (projectAllowance(l) <= now) l++;
  return l;
}

/** Capacity summary for the Projects view and every activation check. */
export function permitStatus(playerXp, active) {
  const p = xpLevel(playerXp);
  const allowed = projectAllowance(p.level);
  const nextLevel = nextPermitLevel(p.level);
  return { level: p.level, xp: p.xp, active, allowed, available: Math.max(0, allowed - active), atCapacity: active >= allowed, overCapacity: active > allowed, nextLevel, nextAllowed: allowed + 1, xpToNext: xpForLevel(nextLevel) - p.xp };
}
export const permitsFor = (runs, active) => permitStatus(experience(runs).player.xp, active);

/** "Next permit at player level 5 · 340 XP to go" */
export function permitHint(s) {
  return `Next permit at player level ${s.nextLevel} · ${s.xpToNext.toLocaleString('en-US')} XP to go`;
}

// ---- Migration from the row layout (style.layout: three plots per row) -------------------------

/**
 * Old layouts placed plot n at column n % 3, row ⌊n / 3⌋, 26 m apart across and 24 m down, with one street in
 * front of each row. The grid keeps the same order: column c → tiles 3c − 1…3c + 1 (homes side by side), row r →
 * tiles 4r − 2…4r, its street on row 4r + 1, and a cross street east of the homes joining every row to Main
 * Street. Street names carry over. A plot that can't fit is kept for a repair choice, never moved silently.
 */
export function migrateRows({ layout = [], streets = {}, active = [] }) {
  const town = emptyTown();
  const plots = (Array.isArray(layout) ? layout : []).map((p) => (typeof p === 'string' ? p : null));
  for (const project of active) if (!plots.includes(project)) {
    const free = plots.indexOf(null);
    if (free >= 0) plots[free] = project;
    else plots.push(project);
  }
  const rows = Math.max(1, Math.ceil(plots.length / 3));
  town.roads[0].name = String(streets?.[0] || streets?.['0'] || 'Main Street').slice(0, 40);
  const report = { placed: [], retired: [], repairs: [] };
  let maxRow = 0;
  plots.forEach((project, n) => { if (project) maxRow = Math.max(maxRow, Math.floor(n / 3)); });
  for (let row = 1; row < rows && row <= maxRow; row++) {
    const j = 4 * row + 1;
    if (j > BUILDABLE.j1) break;
    town.roads.push({ id: `road-row-${row}`, streetId: `street-row-${row}`, name: String(streets?.[row] || DEFAULT_STREETS[row % DEFAULT_STREETS.length]).slice(0, 40), i0: -1, j0: j, i1: 7, j1: j });
  }
  const lastRoad = town.roads.at(-1);
  if (lastRoad.id !== MAIN_STREET.id) town.roads.push({ id: 'road-cross', streetId: 'street-cross', name: 'Cross Street', i0: 8, j0: 2, i1: 8, j1: lastRoad.j0 });
  plots.forEach((project, n) => {
    if (!project) return;
    const col = n % 3, row = Math.floor(n / 3);
    const p = { i: 3 * col - 1, j: 4 * row - 2, rot: 0 };
    const entry = { id: `home-${n + 1}`, project, ...p };
    if (!active.includes(project)) {
      town.retired.push({ ...entry, removedAt: null });
      report.retired.push(project);
      return;
    }
    const check = checkPlacement({ ...town, homes: town.homes }, p, { project });
    if (check.ok) {
      town.homes.push(entry);
      report.placed.push(project);
    } else {
      // Preserve the home with no plot and ask the player to choose one.
      town.homes.push({ id: entry.id, project, i: null, j: null, rot: 0, repair: `Old plot ${n + 1} no longer fits the town grid: ${check.reason}`, from: p });
      report.repairs.push(project);
    }
  });
  return { town: withNetwork(town), report };
}

/** Structural validation of a saved layout (used after loading or migrating). */
export function layoutProblems(town) {
  const problems = [];
  if (town?.version !== TOWN_VERSION) problems.push('Unknown layout version.');
  const main = town.roads?.find((r) => r.id === MAIN_STREET.id);
  if (!main || main.i0 !== MAIN_STREET.i0 || main.i1 !== MAIN_STREET.i1 || main.j0 !== MAIN_STREET.j0) problems.push('Main Street is missing or changed.');
  const seen = new Map();
  for (const r of town.roads || []) {
    if (r.i0 !== r.i1 && r.j0 !== r.j1) problems.push(`Street ${r.id} is not straight.`);
    for (const [i, j] of segTiles(r)) {
      if (r.id !== MAIN_STREET.id && (!inBuildable(i, j) || protectedAt(i, j))) problems.push(`Street ${r.id} leaves buildable land.`);
      if (seen.has(key(i, j))) problems.push(`Streets ${seen.get(key(i, j))} and ${r.id} overlap.`);
      seen.set(key(i, j), r.id);
    }
  }
  const projects = new Set();
  for (const h of town.homes || []) {
    if (projects.has(h.project)) problems.push(`Two homes for ${h.project}.`);
    projects.add(h.project);
    if (h.i == null) continue;
    const others = { ...town, homes: town.homes.filter((x) => x !== h) };
    const c = checkPlacement(others, h, { project: h.project });
    if (!c.ok) problems.push(`${h.project}: ${c.reason}`);
  }
  const kinds = new Set();
  for (const b of town.civic || []) {
    const def = Object.hasOwn(PUBLIC_BUILDINGS, b.kind) ? PUBLIC_BUILDINGS[b.kind] : null;
    if (!def) { problems.push(`Unknown civic building ${b.kind}.`); continue; }
    if (kinds.has(b.kind)) problems.push(`Two ${def.name.toLowerCase()} buildings.`);
    kinds.add(b.kind);
    const c = checkPlacement(town, b, { civic: b.kind });
    if (!c.ok) problems.push(`${def.name}: ${c.reason}`);
  }
  for (const p of town.props || []) {
    if (!Object.hasOwn(TOWN_PROPS, p.kind)) { problems.push(`Unknown prop ${p.kind}.`); continue; }
    const c = checkProp(town, p, { exceptId: p.id });
    if (!c.ok) problems.push(`${TOWN_PROPS[p.kind].name}: ${c.reason}`);
  }
  if ((town.props || []).length > MAX_PROPS) problems.push(`More than ${MAX_PROPS} props.`);
  return [...new Set(problems)];
}

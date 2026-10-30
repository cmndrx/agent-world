// Town influence (simulation layer): what each placed public building spreads over the tiles around it. Pure data
// and pure functions of `town.json`, shared by the bridge and the client. Nothing here reads observed agent work,
// and nothing here changes the town; later passes turn these layers into home satisfaction and overlays.
// See docs/TOWN_SIM_PLAN.md.
//
// A building stamps each of its layers from its footprint outward. Tiles inside the footprint get the full amount;
// beyond it the amount falls off with the straight-line distance (in tiles) to the footprint's nearest edge, out to
// `reach` tiles. Layers combine stamps by `max` (one fire station is enough cover) or `sum` (two dumps smell worse
// than one), and every value stays within 0…1.

import { BUILDABLE, PUBLIC_BUILDINGS, RECREATION_KINDS, TOWN_PROPS, homeTiles } from './town.mjs';

export const INFLUENCE_VERSION = 1;

/** Influence layers: how stamps combine and how the layer reads to the player. */
export const INFLUENCE_LAYERS = Object.freeze({
  fire: { label: 'Fire cover', combine: 'max' },
  police: { label: 'Police cover', combine: 'max' },
  education: { label: 'Education', combine: 'max' },
  health: { label: 'Health care', combine: 'max' },
  garbage: { label: 'Garbage pickup', combine: 'max' },
  water: { label: 'Water supply', combine: 'max' },
  power: { label: 'Power supply', combine: 'max' },
  beauty: { label: 'Green space', combine: 'sum' },
  nuisance: { label: 'Noise and smell', combine: 'sum' },
  ...Object.fromEntries(RECREATION_KINDS.map((kind) => [venueLayer(kind), { label: `Near ${PUBLIC_BUILDINGS[kind].name}`, combine: 'max', venue: kind }])),
});

/** Falloff from 1 (at the footprint) towards 0 (just past reach); t runs 0…1. */
export const CURVES = Object.freeze({
  flat: () => 1,
  linear: (t) => 1 - t,
  ease: (t) => 1 - t * t,
});

const stamp = (layer, amount, reach, curve) => Object.freeze({ layer, amount, reach, curve });
const venue = (kind, reach = 5, extra = []) => [stamp(venueLayer(kind), 1, reach, 'flat'), ...extra];

/**
 * Tuning: what each public building kind stamps. Reach is in tiles beyond the footprint (homes are 3 × 3 tiles).
 * Placeholder values for the first pass; balance them here, not in code.
 */
export const INFLUENCE_RULES = Object.freeze({
  fire_station: [stamp('fire', 1, 6, 'ease')],
  police: [stamp('police', 1, 6, 'ease')],
  library: [stamp('education', 0.9, 4, 'ease')], // strong but short: next to a home it just reaches good (Phase 7)
  school: [stamp('education', 1, 6, 'ease')],
  hospital: [stamp('health', 1, 8, 'ease')],
  city_dump: [stamp('garbage', 1, 8, 'ease'), stamp('nuisance', 0.6, 3, 'linear')],
  water_tower: [stamp('water', 1, 7, 'ease')],
  power_plant: [stamp('power', 1, 10, 'ease'), stamp('nuisance', 0.7, 4, 'linear')],
  park: venue('park', 5, [stamp('beauty', 0.8, 5, 'ease')]),
  ice_cream: venue('ice_cream'),
  arcade: venue('arcade', 5, [stamp('nuisance', 0.15, 1, 'linear')]),
  restaurant: venue('restaurant'),
  community_garden: venue('community_garden', 5, [stamp('beauty', 0.6, 4, 'ease')]),
  gym: venue('gym'),
  cinema: venue('cinema', 6),
  music_lounge: venue('music_lounge', 5, [stamp('nuisance', 0.2, 2, 'linear')]),
  pool: venue('pool', 6, [stamp('beauty', 0.2, 2, 'linear')]),
  sports_complex: venue('sports_complex', 7, [stamp('nuisance', 0.2, 2, 'linear')]),
});

/**
 * Tuning: what each 1×1 prop adds. A prop applies its full amount to every tile within `reach` tiles of it, as a
 * square (reach 1 covers 3 × 3), so it matters to a 3 × 3 home's average. Green space is summed and capped at
 * PROP_GREEN_CAP per tile (props alone reach "thin", never "good"); hedge buffers are summed and capped at
 * PROP_BUFFER_CAP.
 */
export const PROP_RULES = Object.freeze({
  tree: { beauty: 0.15, reach: 1 },
  flower_bed: { beauty: 0.2, reach: 1 },
  bench: { beauty: 0.1, reach: 1 },
  hedge: { beauty: 0.1, reach: 1, buffer: 0.15 },
  fountain: { beauty: 0.3, reach: 2 },
  gazebo: { beauty: 0.3, reach: 2 },
  statue: { beauty: 0.35, reach: 3 },
});
export const PROP_GREEN_CAP = 0.3;
export const PROP_BUFFER_CAP = 0.3;

/** The layer that says a venue kind is within reach. */
export function venueLayer(kind) {
  return `venue:${kind}`;
}

/**
 * Services travel along the streets (Phase 6): a building only serves homes within its street limit — its longest
 * service reach (with upgrades) plus STREET_REACH_EXTRA tiles, counted along connected streets between entrances.
 * Noise and smell still spread through the air.
 */
export const STREET_REACH_EXTRA = 4;
export function streetLimit(building) {
  const reach = influenceStamps(building).filter((s) => s.layer !== 'nuisance').map((s) => s.reach);
  return reach.length ? Math.max(...reach) + STREET_REACH_EXTRA : 0;
}

/** Extra reach (tiles) per upgrade level; level 1 is the building as placed (shared/civic-pride.mjs sells upgrades). */
export const UPGRADE_REACH = Object.freeze({ 1: 0, 2: 2, 3: 4 });
export const MAX_UPGRADE = 3;
export const upgradeLevel = (building) => Math.max(1, Math.min(MAX_UPGRADE, Math.floor(Number(building?.upgrade)) || 1));

/** The stamps a placed building makes ([] for homes, unplaced buildings and unknown kinds); upgrades add service reach. */
export function influenceStamps(building) {
  if (building?.i == null || building?.j == null) return [];
  const stamps = Object.hasOwn(INFLUENCE_RULES, building.kind) ? INFLUENCE_RULES[building.kind] : [];
  const extra = UPGRADE_REACH[upgradeLevel(building)];
  // Upgrades widen service cover only; noise and smell stay where they were.
  return extra ? stamps.map((s) => (s.layer === 'nuisance' ? s : { ...s, reach: s.reach + extra })) : stamps;
}

/** An empty grid over the buildable land, one zeroed layer per influence layer (64-bit so sums are order-free). */
export function emptyInfluence() {
  const w = BUILDABLE.i1 - BUILDABLE.i0 + 1, h = BUILDABLE.j1 - BUILDABLE.j0 + 1;
  const layers = Object.fromEntries(Object.keys(INFLUENCE_LAYERS).map((name) => [name, new Float64Array(w * h)]));
  return { version: INFLUENCE_VERSION, i0: BUILDABLE.i0, j0: BUILDABLE.j0, w, h, layers };
}

const indexOf = (grid, i, j) => {
  const x = i - grid.i0, y = j - grid.j0;
  return x < 0 || y < 0 || x >= grid.w || y >= grid.h ? -1 : y * grid.w + x;
};

/** Tile rectangle a building covers: inclusive [i0, j0, i1, j1]. */
function footprintRect(building) {
  const tiles = homeTiles(building);
  const is = tiles.map(([i]) => i), js = tiles.map(([, j]) => j);
  return [Math.min(...is), Math.min(...js), Math.max(...is), Math.max(...js)];
}

/** Straight-line distance in tiles from (i, j) to the nearest tile of a rectangle (0 inside it). */
function distanceToRect([i0, j0, i1, j1], i, j) {
  const dx = Math.max(i0 - i, 0, i - i1), dy = Math.max(j0 - j, 0, j - j1);
  return Math.hypot(dx, dy);
}

/** The value one stamp gives a tile `d` tiles from its footprint (0 beyond reach). */
export function stampValue(s, d) {
  if (d > s.reach) return 0;
  const curve = CURVES[s.curve] || CURVES.linear;
  return Math.max(0, Math.min(1, s.amount * curve(d / (s.reach + 1))));
}

function applyStamp(grid, rect, s) {
  const layer = grid.layers[s.layer];
  if (!layer) return;
  const sum = INFLUENCE_LAYERS[s.layer].combine === 'sum';
  const [i0, j0, i1, j1] = rect;
  for (let i = i0 - s.reach; i <= i1 + s.reach; i++) {
    for (let j = j0 - s.reach; j <= j1 + s.reach; j++) {
      const k = indexOf(grid, i, j);
      if (k < 0) continue;
      const v = stampValue(s, distanceToRect(rect, i, j));
      if (v <= 0) continue;
      layer[k] = sum ? Math.min(1, layer[k] + v) : Math.max(layer[k], v);
    }
  }
}

/**
 * Every layer for a town, from its placed public buildings and props. Does not modify the town. `cutOff` (a set of
 * building ids) drops those buildings' service and venue stamps but keeps their noise and smell — used for one home's
 * view when those buildings are too far away by street.
 */
export function buildInfluence(town, { cutOff = null } = {}) {
  const grid = emptyInfluence();
  for (const b of town?.civic || []) {
    let stamps = influenceStamps(b);
    if (cutOff?.has(b.id)) stamps = stamps.filter((s) => s.layer === 'nuisance');
    if (!stamps.length) continue;
    const rect = footprintRect(b);
    for (const s of stamps) applyStamp(grid, rect, s);
  }
  applyProps(grid, town?.props || []);
  return grid;
}

/** Props: green space and hedge buffers accumulate apart, are capped, then join the beauty and nuisance layers. */
function applyProps(grid, props) {
  if (!props.length) return;
  const green = new Float64Array(grid.w * grid.h), buffer = new Float64Array(grid.w * grid.h);
  for (const p of props) {
    const rule = Object.hasOwn(PROP_RULES, p.kind) && Object.hasOwn(TOWN_PROPS, p.kind) ? PROP_RULES[p.kind] : null;
    if (!rule || p.i == null || p.j == null) continue;
    for (let i = p.i - rule.reach; i <= p.i + rule.reach; i++) {
      for (let j = p.j - rule.reach; j <= p.j + rule.reach; j++) {
        const k = indexOf(grid, i, j);
        if (k < 0) continue;
        green[k] += rule.beauty;
        if (rule.buffer) buffer[k] += rule.buffer;
      }
    }
  }
  const { beauty, nuisance } = grid.layers;
  for (let k = 0; k < green.length; k++) {
    beauty[k] = Math.min(1, beauty[k] + Math.min(PROP_GREEN_CAP, green[k]));
    nuisance[k] = Math.max(0, nuisance[k] - Math.min(PROP_BUFFER_CAP, buffer[k]));
  }
}

/** A layer's value at a tile (0 off the grid or for an unknown layer). */
export function influenceAt(grid, layer, i, j) {
  const k = indexOf(grid, i, j);
  return k < 0 || !grid.layers[layer] ? 0 : grid.layers[layer][k];
}

/**
 * How a layer reaches a building's footprint: `covered` is the share of its tiles with any influence, `mean` the
 * average value and `max` the strongest tile. Homes use this to judge each need.
 */
export function footprintInfluence(grid, layer, building) {
  const tiles = homeTiles(building);
  let covered = 0, total = 0, max = 0;
  for (const [i, j] of tiles) {
    const v = influenceAt(grid, layer, i, j);
    if (v > 0) covered++;
    total += v;
    max = Math.max(max, v);
  }
  const n = tiles.length || 1;
  return { covered: covered / n, mean: total / n, max };
}

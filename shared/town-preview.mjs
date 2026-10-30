// Town planning overlays (simulation layer): which coverage layers the planner can show, how they are coloured, and
// what a civic building or venue would change for each home before it is placed. Pure functions of `town.json` and
// the households; nothing here saves, and nothing reads observed agent work. See docs/TOWN_SIM_PLAN.md (Phase 3).

import { FACING, PUBLIC_BUILDINGS, RECREATION_KINDS, connectedRoads, entranceTile, homeTiles, key, roadMap, streetDistances } from './town.mjs';
import { INFLUENCE_RULES, buildInfluence, influenceStamps, streetLimit, venueLayer } from './town-influence.mjs';
import { SERVICE_NEEDS, townSatisfaction } from './home-satisfaction.mjs';

/** Layers the planner offers: home satisfaction, each service, noise and smell, then each venue. */
export const HEAT_LAYERS = Object.freeze([
  { id: 'satisfaction', label: 'Home satisfaction', kind: 'satisfaction' },
  ...SERVICE_NEEDS.map((n) => ({ id: n.layer, label: n.label, kind: 'cover' })),
  { id: 'nuisance', label: 'Noise and smell', kind: 'nuisance' },
  ...RECREATION_KINDS.map((k) => ({ id: venueLayer(k), label: `Near ${PUBLIC_BUILDINGS[k].name.toLowerCase()}`, kind: 'cover' })),
]);
export const heatLayer = (id) => HEAT_LAYERS.find((l) => l.id === id) || null;

/** The layer worth showing while placing a kind: its first stamp (a fire station shows fire cover). */
export function primaryLayer(kind) {
  return Object.hasOwn(INFLUENCE_RULES, kind) ? INFLUENCE_RULES[kind][0]?.layer ?? null : null;
}

// Palettes stay clear of truth colours (amber waiting, red errors, the blue street network).
const COVER = [[0xd6, 0xf5, 0xec], [0x2f, 0xb5, 0x9c], [0x0b, 0x6e, 0x66]]; // mint → teal
const NUISANCE = [[0xee, 0xe1, 0xc2], [0xb0, 0x8a, 0x4c], [0x6b, 0x4b, 0x22]]; // sand → umber
export const SATISFACTION_COLORS = Object.freeze({ good: [0x6f, 0xb1, 0x7a], low: [0xb9, 0xbf, 0xcc], bad: [0x9b, 0x84, 0xd9] });

const mix = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));
function ramp(stops, t) {
  const x = Math.max(0, Math.min(1, t)) * (stops.length - 1);
  const i = Math.min(stops.length - 2, Math.floor(x));
  return mix(stops[i], stops[i + 1], x - i);
}

/**
 * RGBA (0–255) for one tile of a layer. Zero influence is fully transparent; stronger influence is deeper and more
 * opaque. Satisfaction colours only home tiles, by level.
 */
export function heatColor(kind, value) {
  if (kind === 'satisfaction') {
    const c = SATISFACTION_COLORS[value];
    return c ? [...c, 190] : [0, 0, 0, 0];
  }
  if (!(value > 0)) return [0, 0, 0, 0];
  const c = ramp(kind === 'nuisance' ? NUISANCE : COVER, value);
  return [...c, Math.round(70 + 130 * Math.min(1, value))];
}

/**
 * Where each tile meets the street network: a home's tiles use its entrance tile (as home satisfaction does), every
 * other tile the nearest connected street tile (null when no street is connected). Indexed like `grid`.
 */
export function streetAccess(town, grid, roads = roadMap(town)) {
  const access = new Array(grid.w * grid.h).fill(null);
  const at = (i, j) => {
    const x = i - grid.i0, y = j - grid.j0;
    return x < 0 || y < 0 || x >= grid.w || y >= grid.h ? -1 : y * grid.w + x;
  };
  // Multi-source search outwards from every connected street tile, over all tiles.
  const queue = [];
  for (const k of connectedRoads(town, roads)) {
    const [i, j] = k.split(',').map(Number), n = at(i, j);
    if (n >= 0 && !access[n]) { access[n] = { i, j }; queue.push([i, j]); }
  }
  for (let q = 0; q < queue.length; q++) {
    const [i, j] = queue[q], from = access[at(i, j)];
    for (const [di, dj] of FACING) {
      const n = at(i + di, j + dj);
      if (n >= 0 && !access[n]) { access[n] = from; queue.push([i + di, j + dj]); }
    }
  }
  for (const h of town?.homes || []) {
    if (h.i == null) continue;
    const e = entranceTile(h);
    for (const [i, j] of homeTiles(h)) { const n = at(i, j); if (n >= 0) access[n] = e; }
  }
  return access;
}

/**
 * One cover layer as homes would feel it, tile by tile (Phase 6 street distance): a building counts at a tile only
 * when the tile's street access is within the building's street limit of its entrance. Nuisance is returned as is.
 * Returns a Float64Array indexed like `grid`.
 */
export function streetAwareLayer(town, layerId, { grid = buildInfluence(town), roads = roadMap(town) } = {}) {
  const base = grid.layers[layerId];
  if (!base || layerId === 'nuisance') return base;
  const providers = (town?.civic || []).filter((b) => b.i != null && influenceStamps(b).some((s) => s.layer === layerId));
  if (!providers.length) return base;
  const access = streetAccess(town, grid, roads);
  const reach = providers.map((b) => ({ id: b.id, limit: streetLimit(b), dist: streetDistances(town, entranceTile(b), roads) }));
  const views = new Map([['', base]]);
  const out = new Float64Array(base.length);
  for (let k = 0; k < base.length; k++) {
    if (!(base[k] > 0)) continue;
    const a = access[k];
    const cut = reach.filter((r) => { const d = a && r.dist.get(key(a.i, a.j)); return d == null || d > r.limit; }).map((r) => r.id);
    const id = cut.join('|');
    if (!views.has(id)) views.set(id, buildInfluence(town, { cutOff: new Set(cut) }).layers[layerId]);
    out[k] = views.get(id)[k];
  }
  return out;
}

/**
 * RGBA pixels (row-major, one pixel per tile over the grid, north row first) for a layer of `town`. `satisfaction`
 * is the Map from townSatisfaction, needed only for the satisfaction layer. Cover layers are street-aware
 * (streetAwareLayer), so the heat matches what homes feel.
 */
export function heatPixels(town, layerId, { grid = buildInfluence(town), satisfaction = null } = {}) {
  const layer = heatLayer(layerId);
  const px = new Uint8Array(grid.w * grid.h * 4);
  if (!layer) return { px, w: grid.w, h: grid.h, i0: grid.i0, j0: grid.j0 };
  const put = (i, j, rgba) => {
    const x = i - grid.i0, y = j - grid.j0;
    if (x < 0 || y < 0 || x >= grid.w || y >= grid.h) return;
    px.set(rgba, (y * grid.w + x) * 4);
  };
  if (layer.kind === 'satisfaction') {
    for (const h of town.homes || []) {
      if (h.i == null) continue;
      const s = satisfaction?.get(h.project);
      if (s) for (const [i, j] of homeTiles(h)) put(i, j, heatColor('satisfaction', s.level));
    }
  } else {
    const values = streetAwareLayer(town, layer.id, { grid });
    for (let k = 0; k < values.length; k++) px.set(heatColor(layer.kind, values[k]), k * 4);
  }
  return { px, w: grid.w, h: grid.h, i0: grid.i0, j0: grid.j0 };
}

/** The town with a public building of `kind` at `at` (moved if already placed). Does not modify `town`. */
export function withBuilding(town, kind, at) {
  const civic = (town.civic || []).filter((c) => c.kind !== kind);
  const was = (town.civic || []).find((c) => c.kind === kind);
  return { ...town, civic: [...civic, { ...(was || { id: `preview-${kind}` }), kind, i: at.i, j: at.j, rot: at.rot || 0 }] };
}

const RANK = { bad: 0, low: 1, good: 2 };
/** Smallest change in a need's value (0–1) worth listing when its level stays the same. */
export const VALUE_STEP = 0.02;
const pct = (v) => `${Math.round(v * 100)}%`;

/** The town with a prop of `kind` at `at` (the prop `movingId` moved there, if given). Does not modify `town`. */
export function withProp(town, kind, at, movingId = null) {
  const props = (town.props || []).filter((p) => p.id !== movingId);
  return { ...town, props: [...props, { id: movingId || `preview-prop`, kind, i: at.i, j: at.j }] };
}

/**
 * What placing (or moving) `kind` at `at` would change, home by home: needs that start, end or change level, and
 * each home's score before and after. Homes with no change are left out; better homes first.
 */
export function placementPreview(town, households, kind, at) {
  return changePreview(town, withBuilding(town, kind, at), households);
}

/** The same preview for placing a prop (or moving one, with `movingId`). */
export function propPreview(town, households, kind, at, movingId = null) {
  return changePreview(town, withProp(town, kind, at, movingId), households);
}

/** Home-by-home differences between two versions of a town. */
export function changePreview(town, nextTown, households) {
  const before = townSatisfaction(town, households);
  const after = townSatisfaction(nextTown, households);
  const homes = [];
  for (const [project, next] of after) {
    const prev = before.get(project);
    const was = new Map((prev?.needs || []).map((n) => [n.id, n]));
    const changes = [];
    for (const n of next.needs) {
      const o = was.get(n.id);
      if (!o) changes.push({ id: n.id, label: n.label, from: null, to: n.level, hint: n.hint });
      else if (o.level !== n.level) changes.push({ id: n.id, label: n.label, from: o.level, to: n.level, hint: n.hint });
      // Progress within a level (a prop nudging green space up) is shown too, so small steps are visible.
      else if (Math.abs(n.value - o.value) >= VALUE_STEP) changes.push({ id: n.id, label: n.label, from: o.level, to: n.level, hint: n.hint, value: [o.value, n.value] });
      was.delete(n.id);
    }
    for (const o of was.values()) changes.push({ id: o.id, label: o.label, from: o.level, to: null, hint: o.hint });
    if (!changes.length && prev?.score === next.score) continue;
    const better = changes.filter((c) => c.to && (c.from == null ? c.to === 'good' : RANK[c.to] > RANK[c.from] || (c.value && c.value[1] > c.value[0]))).length;
    const worse = changes.filter((c) => c.to && c.from != null && (RANK[c.to] < RANK[c.from] || (c.value && c.value[1] < c.value[0]))).length
      + changes.filter((c) => c.from == null && c.to && c.to !== 'good').length;
    homes.push({ project, before: { score: prev?.score ?? 100, level: prev?.level ?? 'good' }, after: { score: next.score, level: next.level }, changes, better, worse });
  }
  homes.sort((a, b) => (b.better - b.worse) - (a.better - a.worse) || b.after.score - a.after.score);
  return { homes, helped: homes.filter((h) => h.better > h.worse).length, hurt: homes.filter((h) => h.worse > h.better).length };
}

/** One line per home for the planner card, at most `limit` lines. */
export function previewLines(preview, homeName, limit = 3) {
  const describe = (c) => (c.to == null ? `${c.label} no longer needed`
    : c.from == null ? (c.to === 'good' ? `${c.label} met` : `new need: ${c.label.toLowerCase()} (${c.to})`)
      : c.value ? `${c.label.toLowerCase()} ${pct(c.value[0])} → ${pct(c.value[1])} (${c.to})`
        : `${c.label.toLowerCase()} ${c.from} → ${c.to}`);
  const lines = preview.homes.slice(0, limit).map((h) => {
    const what = h.changes.map(describe).join(', ') || 'small change';
    return `${homeName(h.project)}: ${what} · ${h.before.score} → ${h.after.score}`;
  });
  if (preview.homes.length > limit) lines.push(`+${preview.homes.length - limit} more home${preview.homes.length - limit === 1 ? '' : 's'}`);
  return lines;
}

/** A short headline: "Helps 2 homes · 1 home worse" or "No home changes". */
export function previewHeadline(preview) {
  const parts = [];
  if (preview.helped) parts.push(`Helps ${preview.helped} home${preview.helped === 1 ? '' : 's'}`);
  if (preview.hurt) parts.push(`${preview.hurt} home${preview.hurt === 1 ? '' : 's'} worse off`);
  const mixed = preview.homes.length - preview.helped - preview.hurt;
  if (mixed > 0) parts.push(`${mixed} mixed`);
  return parts.join(' · ') || 'No home changes';
}

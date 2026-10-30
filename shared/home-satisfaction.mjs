// Home satisfaction (simulation layer): how well the town layout serves each home. Pure functions of `town.json`
// and the households; nothing here reads observed agent work, changes the town or decays over time. A home's
// satisfaction is its weakest need, so the player always knows what to build next. See docs/TOWN_SIM_PLAN.md.
// Each need is scored against its own "good" target (value ÷ target, capped at 100%), so a home whose needs are all
// good scores 100 even though targets differ (green space is good at 0.45, fire cover at 0.7).
//
// Needs come in three kinds:
//   service  — cover from a civic building or park (fire station, school, …), read from the influence grid;
//   quiet    — distance from noisy or smelly buildings (dump, power plant), only when one reaches the home;
//   interest — a resident's interest served by a venue in range (Rosa likes arcade games → an arcade nearby).
// A need only counts once the player could build something that meets it (unlocked at the town tier, or placed).
// Services and venues reach a home along the streets (Phase 6): a building further than its street limit from the
// home gives it no cover, however close it looks (its noise and smell still spread through the air).

import { PUBLIC_BUILDINGS, RECREATION_KINDS, entranceTile, key, roadMap, streetDistances } from './town.mjs';
import { buildInfluence, footprintInfluence, streetLimit, venueLayer } from './town-influence.mjs';
import { residentCharacters } from './foundation.mjs';
import { INTEREST_BY_ID } from './catalogs/index.js';

/** Service needs: which influence layer meets them and which buildings provide it. Thresholds are 0…1. */
export const SERVICE_NEEDS = Object.freeze([
  { id: 'fire', layer: 'fire', label: 'Fire cover', providers: ['fire_station'], low: 0.3, high: 0.7 },
  { id: 'police', layer: 'police', label: 'Police cover', providers: ['police'], low: 0.3, high: 0.7 },
  { id: 'education', layer: 'education', label: 'Education', providers: ['school', 'library'], low: 0.3, high: 0.7 },
  { id: 'health', layer: 'health', label: 'Health care', providers: ['hospital'], low: 0.3, high: 0.7 },
  { id: 'garbage', layer: 'garbage', label: 'Garbage pickup', providers: ['city_dump'], low: 0.3, high: 0.7 },
  { id: 'water', layer: 'water', label: 'Water supply', providers: ['water_tower'], low: 0.3, high: 0.7 },
  { id: 'power', layer: 'power', label: 'Power supply', providers: ['power_plant'], low: 0.3, high: 0.7 },
  { id: 'green', layer: 'beauty', label: 'Green space', providers: ['park', 'community_garden'], low: 0.15, high: 0.45 },
]);
/** Quiet: 1 − noise and smell. Only listed when some nuisance reaches the home. */
export const QUIET_NEED = Object.freeze({ id: 'quiet', layer: 'nuisance', label: 'Peace and quiet', low: 0.5, high: 0.8 });
/** Interest needs are met (1) or not (0). */
export const INTEREST_THRESHOLDS = Object.freeze({ low: 0.5, high: 1 });

/** Venue kinds whose visitors can enjoy an interest. */
export function venuesForInterest(interestId) {
  return RECREATION_KINDS.filter((k) => PUBLIC_BUILDINGS[k].interests.includes(interestId));
}

/** Can the player build (or have they built) this kind? Placed buildings always count. */
function available(kind, tier, placed) {
  return placed.has(kind) || (PUBLIC_BUILDINGS[kind]?.townTier ?? Infinity) <= tier;
}

/** Progress (0…1) of a value towards its "good" target. */
export const needProgress = (value, high) => (high > 0 ? Math.max(0, Math.min(1, value / high)) : 1);

/** good when the value reaches `high`, bad below `low`, low in between. */
export function needLevel(value, { low, high }) {
  return value >= high ? 'good' : value < low ? 'bad' : 'low';
}

const article = (name) => (/^[aeiou]/i.test(name) ? 'an' : 'a');
const lower = (kind) => PUBLIC_BUILDINGS[kind].name.toLowerCase();

/**
 * Satisfaction for one placed home. `grid` is this home's view of the influence grid (buildings too far by street
 * left out), `residents` its active characters, `tier` the town tier and `placed` the set of public kinds in the town.
 * `far` maps kinds too far by street to { distance, limit }, and `baseGrid` (straight-line, everything counted) lets
 * hints say when a street connection is what is missing.
 * Returns { score 0…100, level, needs: [{ id, kind, label, value, target, progress, level, hint, residentId? }], worst }.
 * `score` is the worst need's progress towards its own target.
 */
export function homeSatisfaction({ grid, home, residents = [], tier = 1, placed = new Set(), far = new Map(), baseGrid = grid }) {
  const needs = [];
  // A far building that would have helped this home: the hint names the street distance instead.
  const streetHint = (kinds, layer, better) => {
    const k = kinds.find((x) => far.has(x) && better(layer(x)));
    if (!k) return null;
    const f = far.get(k);
    return `${PUBLIC_BUILDINGS[k].name} is ${f.distance == null ? 'not connected' : `${f.distance} street tiles away`} · add a connecting street`;
  };
  for (const need of SERVICE_NEEDS) {
    const providers = need.providers.filter((k) => available(k, tier, placed));
    if (!providers.length) continue;
    const value = footprintInfluence(grid, need.layer, home).mean;
    const lvl = needLevel(value, need);
    const name = lower(providers.find((k) => placed.has(k)) || providers[0]);
    const viaStreet = lvl === 'good' ? null : streetHint(providers, () => need.layer, (layer) => footprintInfluence(baseGrid, layer, home).mean > value + 0.01);
    const hint = lvl === 'good' ? `${need.label} in range` : viaStreet || (lvl === 'low' ? `${need.label} is thin here`
      : value > 0 ? `Move ${article(name)} ${name} closer` : `No ${name} in range`);
    needs.push({ id: need.id, kind: 'service', label: need.label, value, target: need.high, progress: needProgress(value, need.high), level: lvl, hint });
  }
  const noise = footprintInfluence(grid, QUIET_NEED.layer, home).mean;
  if (noise > 0) {
    const value = 1 - noise, lvl = needLevel(value, QUIET_NEED);
    const hint = lvl === 'good' ? 'Quiet enough' : lvl === 'low' ? 'A little noisy here' : 'Too noisy and smelly here';
    needs.push({ id: QUIET_NEED.id, kind: 'quiet', label: QUIET_NEED.label, value, target: QUIET_NEED.high, progress: needProgress(value, QUIET_NEED.high), level: lvl, hint });
  }
  for (const r of residents) {
    for (const interest of r.interestIds || []) {
      const venues = venuesForInterest(interest).filter((k) => available(k, tier, placed));
      if (!venues.length) continue;
      const inRange = venues.filter((k) => footprintInfluence(grid, venueLayer(k), home).max > 0);
      const value = inRange.length ? 1 : 0;
      const lvl = needLevel(value, INTEREST_THRESHOLDS);
      const label = INTEREST_BY_ID[interest]?.label || interest;
      const name = lower(venues.find((k) => placed.has(k)) || venues[0]);
      const who = r.name || 'A resident';
      const viaStreet = lvl === 'good' ? null : streetHint(venues, venueLayer, (layer) => footprintInfluence(baseGrid, layer, home).max > 0);
      const hint = lvl === 'good' ? `${who} enjoys ${label.toLowerCase()} nearby` : viaStreet ? `${who}: ${viaStreet[0].toLowerCase()}${viaStreet.slice(1)}` : `${who} wants ${article(name)} ${name} nearby`;
      needs.push({ id: `interest:${r.id}:${interest}`, kind: 'interest', label, value, target: INTEREST_THRESHOLDS.high, progress: value, level: lvl, hint, residentId: r.id, interest, venues: inRange });
    }
  }
  if (!needs.length) return { score: 100, level: 'good', needs, worst: null };
  // Weakest link: the most urgent level first, then the least progress towards its target; ties keep the listed order
  // (services, quiet, then interests).
  const rank = { bad: 0, low: 1, good: 2 };
  const worst = needs.reduce((a, b) => (rank[b.level] < rank[a.level] || (rank[b.level] === rank[a.level] && b.progress < a.progress) ? b : a));
  const score = Math.round(Math.min(...needs.map((n) => n.progress)) * 100);
  return { score, level: worst.level, needs, worst };
}

/** Satisfaction for every placed home, keyed by project. `households` is a Map, an array or an object by project. */
export function townSatisfaction(town, households, { grid = buildInfluence(town) } = {}) {
  const byProject = households instanceof Map ? households
    : new Map((Array.isArray(households) ? households : Object.values(households || {})).map((h) => [h.project, h]));
  const buildings = (town?.civic || []).filter((c) => c.i != null);
  const placed = new Set(buildings.map((c) => c.kind));
  const tier = town?.tier?.current ?? 1;
  const roads = roadMap(town || {});
  const out = new Map();
  for (const home of town?.homes || []) {
    if (home.i == null) continue;
    const { far, cutOff } = streetReach(town, home, buildings, roads);
    const view = cutOff.size ? buildInfluence(town, { cutOff }) : grid;
    out.set(home.project, homeSatisfaction({ grid: view, home, residents: residentCharacters(byProject.get(home.project)), tier, placed, far, baseGrid: grid }));
  }
  return out;
}

/**
 * Which buildings are too far from a home by street: `far` maps kind → { distance (tiles, null if unreachable),
 * limit }, `cutOff` holds their ids for buildInfluence.
 */
export function streetReach(town, home, buildings = (town?.civic || []).filter((c) => c.i != null), roads = roadMap(town)) {
  const dist = streetDistances(town, entranceTile(home), roads);
  const far = new Map(), cutOff = new Set();
  for (const b of buildings) {
    const limit = streetLimit(b);
    if (!limit) continue;
    const e = entranceTile(b);
    const d = dist.get(key(e.i, e.j));
    if (d == null || d > limit) { far.set(b.kind, { distance: d ?? null, limit }); cutOff.add(b.id); }
  }
  return { far, cutOff };
}

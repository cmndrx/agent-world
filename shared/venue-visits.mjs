// Venue visits (simulation layer): idle residents occasionally walk to a placed venue that meets one of their
// interests, along connected streets, and walk home again. Pure planning helpers; the client animates the trip.
// Visits never create, imply or hide observed agent work, have no game effect and are not saved. Observed work
// always brings a resident straight back to their desk. See docs/TOWN_SIM_PLAN.md (Phase 5, decision 11).

import { FACING, connectedRoads, entranceTile, key, roadMap } from './town.mjs';

/** Tuning: how often visits happen and how long they last. */
export const VISIT_RULES = Object.freeze({
  cooldownMs: 10 * 60_000, // per resident, after they get home
  stayMs: [30_000, 60_000], // time spent at the venue
  checkEveryMs: 15_000, // how often the town considers a new visit
  chance: 0.35, // chance that a check starts one visit (when someone is eligible)
});

/**
 * Street tiles from one street tile to another over connected streets (4-neighbour), including both ends, or null
 * when either end is not a connected street or no route exists.
 */
export function streetRoute(town, from, to) {
  const roads = roadMap(town);
  const reach = connectedRoads(town, roads);
  const a = key(from.i, from.j), b = key(to.i, to.j);
  if (!reach.has(a) || !reach.has(b)) return null;
  const prev = new Map([[a, null]]);
  const queue = [a];
  while (queue.length) {
    const k = queue.shift();
    if (k === b) break;
    const [i, j] = k.split(',').map(Number);
    for (const [di, dj] of FACING) {
      const n = key(i + di, j + dj);
      if (reach.has(n) && !prev.has(n)) { prev.set(n, k); queue.push(n); }
    }
  }
  if (!prev.has(b)) return null;
  const out = [];
  for (let k = b; k != null; k = prev.get(k)) out.unshift(k.split(',').map(Number));
  return out.map(([i, j]) => ({ i, j }));
}

/** Venue kinds that meet one of this resident's interests at their home right now (from home satisfaction). */
export function metVenues(satisfaction, residentId) {
  const out = new Set();
  for (const n of satisfaction?.needs || []) {
    if (n.kind === 'interest' && n.residentId === residentId && n.level === 'good') for (const k of n.venues || []) out.add(k);
  }
  return [...out];
}

/**
 * Choose at most one visit to start now. `residents` lists candidates as { project, id, idle, groundFloor, away };
 * `lastVisit` maps resident id → when they last got home (ms). Returns { project, residentId, venue, route, stayMs }
 * or null. One resident per home at a time, never at night, only to placed venues reachable by street.
 */
export function chooseVisit({ town, satisfaction, residents, lastVisit = new Map(), now = Date.now(), night = false, random = Math.random }) {
  if (night || random() >= VISIT_RULES.chance) return null;
  const awayHomes = new Set(residents.filter((r) => r.away).map((r) => r.project));
  const homes = new Map((town?.homes || []).filter((h) => h.i != null).map((h) => [h.project, h]));
  const civic = new Map((town?.civic || []).filter((c) => c.i != null).map((c) => [c.kind, c]));
  const options = [];
  for (const r of residents) {
    if (!r.idle || !r.groundFloor || r.away || awayHomes.has(r.project)) continue;
    if (now - (lastVisit.get(r.id) ?? -Infinity) < VISIT_RULES.cooldownMs) continue;
    const home = homes.get(r.project);
    if (!home) continue;
    for (const venue of metVenues(satisfaction?.get(r.project), r.id)) {
      const building = civic.get(venue);
      if (!building) continue;
      const route = streetRoute(town, entranceTile(home), entranceTile(building));
      if (route) options.push({ project: r.project, residentId: r.id, venue, route });
    }
  }
  if (!options.length) return null;
  const pick = options[Math.floor(random() * options.length) % options.length];
  const [lo, hi] = VISIT_RULES.stayMs;
  return { ...pick, stayMs: Math.round(lo + random() * (hi - lo)) };
}

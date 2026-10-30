// Town tiers (simulation layer): a healthy, growing town unlocks more civic buildings and venues. A tier needs a
// size gate (homes, or active residents, whichever comes first) and a quality bar (no home with a bad need and a
// town average at least X). Pure functions; the bridge stores the highest tier reached so a tier never drops.
// Nothing here reads observed agent work. See docs/TOWN_SIM_PLAN.md (Phase 4).

import { PUBLIC_BUILDINGS, PUBLIC_KINDS } from './town.mjs';
import { residentCharacters } from './foundation.mjs';

/** Tuning: tier thresholds. `residents: null` means only the home count opens that tier. */
export const TOWN_TIERS = Object.freeze([
  { tier: 1, name: 'Hamlet', homes: 0, residents: null, average: 0 },
  { tier: 2, name: 'Village', homes: 1, residents: null, average: 40 },
  { tier: 3, name: 'Town', homes: 2, residents: 3, average: 50 },
  { tier: 4, name: 'Borough', homes: 2, residents: 5, average: 60 },
  { tier: 5, name: 'City', homes: 3, residents: 7, average: 70 },
  { tier: 6, name: 'Metropolis', homes: 4, residents: 10, average: 75 },
]);
export const MAX_TIER = TOWN_TIERS.length;
export const tierName = (tier) => TOWN_TIERS[Math.max(1, Math.min(MAX_TIER, tier)) - 1].name;
/** Public building kinds a tier opens, in catalog order. */
export const tierUnlocks = (tier) => PUBLIC_KINDS.filter((k) => PUBLIC_BUILDINGS[k].townTier === tier);

/** Size and quality of the town: placed homes, their active residents, average score and homes with a bad need. */
export function tierStats(town, households, satisfaction) {
  const byProject = households instanceof Map ? households
    : new Map((Array.isArray(households) ? households : Object.values(households || {})).map((h) => [h.project, h]));
  const placed = (town?.homes || []).filter((h) => h.i != null);
  const scores = placed.map((h) => satisfaction?.get(h.project)).filter(Boolean);
  return {
    homes: placed.length,
    residents: placed.reduce((n, h) => n + residentCharacters(byProject.get(h.project)).length, 0),
    average: scores.length ? Math.round(scores.reduce((n, s) => n + s.score, 0) / scores.length) : 0,
    badHomes: placed.filter((h) => satisfaction?.get(h.project)?.level === 'bad').map((h) => h.project),
  };
}

/** Each requirement of a tier against the stats: [{ id, label, met }]. */
export function tierRequirements(tier, stats) {
  const t = TOWN_TIERS[tier - 1];
  if (!t || tier === 1) return [];
  const size = t.residents == null
    ? { id: 'size', label: `${t.homes} home${t.homes === 1 ? '' : 's'}`, met: stats.homes >= t.homes }
    : { id: 'size', label: `${t.homes} homes or ${t.residents} residents`, met: stats.homes >= t.homes || stats.residents >= t.residents };
  return [
    size,
    { id: 'average', label: `Average satisfaction ${t.average}+`, met: stats.average >= t.average },
    { id: 'no-bad', label: 'No home needs attention', met: stats.homes > 0 && stats.badHomes.length === 0 },
  ];
}

/** The highest tier the town meets now, climbing one tier at a time from 1. */
export function earnedTier(stats) {
  let tier = 1;
  while (tier < MAX_TIER && tierRequirements(tier + 1, stats).every((r) => r.met)) tier++;
  return tier;
}

/** For an existing town: the highest unlock tier among buildings already placed, so none sits above the town's tier. */
export function placedTier(town) {
  return Math.max(1, ...(town?.civic || []).map((c) => PUBLIC_BUILDINGS[c.kind]?.townTier || 1));
}

/**
 * Tier status: `current` never drops below `reached` (the highest stored), `earned` is what the layout meets now,
 * `next` lists the next tier's requirements and unlocks.
 */
export function tierStatus(stats, reached = 1) {
  const earned = earnedTier(stats);
  const current = Math.max(earned, reached || 1);
  const nextTier = current < MAX_TIER ? current + 1 : null;
  return {
    current, name: tierName(current), earned, reached: Math.max(reached || 1, earned), stats,
    next: nextTier && { tier: nextTier, name: tierName(nextTier), requirements: tierRequirements(nextTier, stats), unlocks: tierUnlocks(nextTier) },
  };
}

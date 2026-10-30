// Civic Pride (simulation layer): the town currency. It is earned once per milestone a well-served town reaches
// (a need first met for a home, a home first fully satisfied, a tier reached) and spent on civic building upgrades
// and small town props (removing a prop refunds half its cost, rounded down).
// Never earned from agent work, no timers, no caps. Each milestone pays once, so moving a building away and back
// earns nothing. Gems stay separate and tied to real work. See docs/TOWN_SIM_PLAN.md (Phase 4).

import { CIVIC, CIVIC_KINDS, TOWN_PROPS, placeProp, removeProp } from './town.mjs';
import { MAX_UPGRADE, UPGRADE_REACH, upgradeLevel } from './town-influence.mjs';

/** Tuning: what each kind of milestone pays. */
export const PRIDE_REWARDS = Object.freeze({ need: 5, home: 25, tier: 40 });
/** Tuning: Civic Pride to reach each upgrade level (from the level below). Civic services only. */
export const UPGRADE_COSTS = Object.freeze({ 2: 60, 3: 150 });

export const emptyPride = () => ({ version: 1, milestones: {}, spent: [] });

/**
 * Every milestone the town meets now, as { key, amount, label }. Keys are stable, so recording is idempotent.
 * Tier milestones start above `startTier`: a town that began at a tier (migration) gets no grants for reaching it.
 */
export function prideMilestones(satisfaction, tierCurrent, homeName = (p) => p, { startTier = 1 } = {}) {
  const out = [];
  for (const [project, s] of satisfaction || []) {
    for (const n of s.needs) {
      if (n.level === 'good') out.push({ key: `need:${project}:${n.id}`, amount: PRIDE_REWARDS.need, label: `${homeName(project)}: ${n.label} met` });
    }
    if (s.needs.length && s.level === 'good') out.push({ key: `home:${project}`, amount: PRIDE_REWARDS.home, label: `${homeName(project)} fully satisfied` });
  }
  for (let t = Math.max(2, (startTier || 1) + 1); t <= (tierCurrent || 1); t++) out.push({ key: `tier:${t}`, amount: PRIDE_REWARDS.tier, label: `Reached town tier ${t}` });
  return out;
}

/** Record milestones not paid before. Returns { pride, added } and never mutates the input. */
export function recordPride(pride, milestones, now = new Date().toISOString()) {
  const base = pride?.milestones ? pride : emptyPride();
  const added = milestones.filter((m) => !Object.hasOwn(base.milestones, m.key));
  if (!added.length) return { pride: base, added };
  const next = { ...base, milestones: { ...base.milestones } };
  for (const m of added) next.milestones[m.key] = { amount: m.amount, label: m.label, at: now };
  return { pride: next, added };
}

export function prideBalance(pride) {
  const earned = Object.values(pride?.milestones || {}).reduce((n, m) => n + (m.amount || 0), 0);
  const spent = (pride?.spent || []).reduce((n, s) => n + (s.cost || 0), 0);
  return { earned, spent, balance: earned - spent };
}

/** The most recent milestones, newest first. */
export const recentPride = (pride, limit = 5) => Object.entries(pride?.milestones || {})
  .map(([key, m]) => ({ key, ...m })).sort((a, b) => String(b.at).localeCompare(String(a.at)) || a.key.localeCompare(b.key)).slice(0, limit);

/** The next upgrade for a placed civic building: { level, cost, reach } or null at the top (or for venues). */
export function nextUpgrade(building) {
  if (!building || !Object.hasOwn(CIVIC, building.kind)) return null;
  const level = upgradeLevel(building) + 1;
  return level > MAX_UPGRADE ? null : { level, cost: UPGRADE_COSTS[level], reach: UPGRADE_REACH[level] };
}
export const upgradable = (kind) => CIVIC_KINDS.includes(kind);

/**
 * Buy the next upgrade for a placed civic building. Returns { town, pride, upgrade } with the town's revision bumped;
 * throws (changing nothing) when the building is missing, at the top level, or the balance is too low.
 */
export function buyUpgrade(town, pride, kind, now = new Date().toISOString()) {
  const building = (town.civic || []).find((c) => c.kind === kind);
  if (!building || !upgradable(kind)) throw Error('Choose a civic building in your town.');
  const up = nextUpgrade(building);
  if (!up) throw Error(`The ${CIVIC[kind].name.toLowerCase()} is fully upgraded.`);
  const { balance } = prideBalance(pride);
  if (balance < up.cost) throw Error(`Needs ${up.cost} Civic Pride (you have ${balance}).`);
  const base = pride?.milestones ? pride : emptyPride();
  return {
    town: { ...town, civic: town.civic.map((c) => (c.kind === kind ? { ...c, upgrade: up.level } : c)), revision: town.revision + 1 },
    pride: { ...base, spent: [...base.spent, { kind, level: up.level, cost: up.cost, at: now }] },
    upgrade: up,
  };
}

/** What removing a prop gives back: half its cost, rounded down (never more than was paid). */
export const propRefund = (kind) => Math.floor((TOWN_PROPS[kind]?.cost || 0) / 2);

/** Buy and place a prop. Returns { town, pride, prop }; throws (changing nothing) if locked, full, blocked or unaffordable. */
export function buyProp(town, pride, kind, at, { tier = 1, now = new Date().toISOString() } = {}) {
  const def = Object.hasOwn(TOWN_PROPS, kind) ? TOWN_PROPS[kind] : null;
  if (!def) throw Error('Choose a prop.');
  const { balance } = prideBalance(pride);
  const next = placeProp(town, kind, at, { tier });
  if (balance < def.cost) throw Error(`Needs ${def.cost} Civic Pride (you have ${balance}).`);
  const prop = next.props[next.props.length - 1];
  const base = pride?.milestones ? pride : emptyPride();
  return { town: next, pride: { ...base, spent: [...base.spent, { kind: `prop:${kind}`, prop: prop.id, cost: def.cost, at: now }] }, prop };
}

/** Remove a prop and refund half its cost, recorded as a negative spend. Returns { town, pride, refund }. */
export function sellProp(town, pride, id, { now = new Date().toISOString() } = {}) {
  const prop = (town.props || []).find((p) => p.id === id);
  if (!prop) throw Error('That prop isn’t in your town.');
  const refund = propRefund(prop.kind);
  const base = pride?.milestones ? pride : emptyPride();
  return {
    town: removeProp(town, id),
    pride: refund ? { ...base, spent: [...base.spent, { kind: `prop:${prop.kind}`, prop: id, cost: -refund, refund: true, at: now }] } : base,
    refund,
  };
}

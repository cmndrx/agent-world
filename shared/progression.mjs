// Progression (phase 2, docs/GAMEPLAY.md): bricks and home levels, derived from human decisions only.
//
// - Bricks come from tasks YOU accepted that have review notes, and from outcomes YOU marked reached.
//   They are recomputed from productivity.json every time; there is no stored balance to edit or farm.
// - Agent activity (tool calls, tokens, sessions, time) never counts. Agents cannot accept tasks or mark
//   outcomes reached through the Agent World helper.
// - Spending only unlocks cosmetic catalog items (style.unlocks). Un-accepting a task removes its bricks;
//   items you already unlocked stay yours, but a negative balance blocks new unlocks until it recovers.

import { DECOR } from './style.mjs';

export const BRICKS = { acceptedTask: 10, outcomeReached: 25 };

export const LEVELS = [
  { level: 1, name: 'Cottage' },
  { level: 2, name: 'House' },
  { level: 3, name: 'Villa' },
  { level: 4, name: 'Manor' },
  { level: 5, name: 'Estate' },
];
export const MAX_LEVEL = LEVELS.length;

/**
 * Neighborhood milestones (phase 3): public spaces in the town square. Each opens when EITHER count is
 * reached across all homes: outcomes you marked reached, or tasks you accepted with review notes.
 */
export const COMMONS = [
  { id: 'park', name: 'Park', outcomes: 1, tasks: 3 },
  { id: 'cafe', name: 'Café', tasks: 5 },
  { id: 'plaza', name: 'Plaza fountain', outcomes: 3 },
  { id: 'townhall', name: 'Town hall', outcomes: 5, tasks: 15 },
];

/** "Reach 1 outcome, or accept 3 tasks with review notes" */
export function commonsHint(c) {
  const parts = [];
  if (c.outcomes) parts.push(`reach ${c.outcomes} outcome${c.outcomes === 1 ? '' : 's'}`);
  if (c.tasks) parts.push(`earn ${c.tasks} task review credits`);
  const s = parts.join(', or ');
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export const levelName = (level) => LEVELS[Math.min(MAX_LEVEL, Math.max(1, level)) - 1].name;

/** A home's level: 1 + outcomes you marked reached (capped). */
export function homeLevel(plan) {
  return Math.min(MAX_LEVEL, 1 + (plan?.milestones?.length || 0));
}

/** True when an accepted task carries review notes (the "evidence" field). */
export const hasReviewNotes = (task) => (typeof task.evidence === 'string' && task.evidence.trim().length > 0) || (task.references || []).some(r => ['output', 'check'].includes(r.kind) && r.value?.trim());

export const itemPrice = (item) => DECOR[item]?.price || 0;
export const itemLevel = (item) => DECOR[item]?.level || 1;

/**
 * Everything earned and spent, recomputed from the board and the style document.
 * @returns {{ earned:number, spent:number, balance:number, levels:Object<string,number>, ledger:Array }}
 */
export function progress({ tasks = [], plans = [] } = {}, style = {}) {
  const ledger = [];
  const rewardedDays = new Set();
  for (const t of [...tasks].sort((a, b) => String(a.acceptedAt || a.updatedAt || '').localeCompare(String(b.acceptedAt || b.updatedAt || '')) || a.id.localeCompare(b.id))) {
    if (t.status !== 'accepted') continue;
    const notes = hasReviewNotes(t);
    const day = t.rewardDay || String(t.acceptedAt || '').slice(0, 10);
    const bucket = JSON.stringify([t.project, day]);
    const capped = t.rewardPolicy === 'daily-v1' && rewardedDays.has(bucket);
    const bricks = notes && !capped ? BRICKS.acceptedTask : 0;
    if (notes && t.rewardPolicy === 'daily-v1') rewardedDays.add(bucket);
    ledger.push({
      kind: notes ? 'task' : 'task-no-notes',
      id: t.id,
      project: t.project,
      title: t.title,
      bricks, capped, policy: t.rewardPolicy || 'legacy',
      at: t.acceptedAt || t.updatedAt,
    });
  }
  const levels = {};
  for (const p of plans) {
    levels[p.project] = homeLevel(p);
    (p.milestones || []).forEach((m, i) => {
      ledger.push({ kind: 'outcome', id: `${p.project}#${i}`, project: p.project, title: m.outcome, bricks: BRICKS.outcomeReached, at: m.reachedAt, level: Math.min(MAX_LEVEL, i + 2) });
    });
  }
  ledger.sort((a, b) => Date.parse(b.at || 0) - Date.parse(a.at || 0));
  const earned = ledger.reduce((n, e) => n + e.bricks, 0);
  const spent = (style.unlocks || []).reduce((n, item) => n + itemPrice(item), 0);
  const counts = { outcomes: ledger.filter((e) => e.kind === 'outcome').length, tasks: ledger.filter((e) => e.kind === 'task' && !e.capped).length };
  const commons = COMMONS.filter((c) => (c.outcomes && counts.outcomes >= c.outcomes) || (c.tasks && counts.tasks >= c.tasks)).map((c) => c.id);
  return { earned, spent, balance: earned - spent, levels, ledger, counts, commons };
}

/**
 * Why an item can't be placed in a home right now, or null if it can.
 * @param {string} item
 * @param {{ unlocks?: string[], level?: number, found?: Object<string, number>, harvest?: Object<string, number> }} ctx
 */
export function lockReason(item, { unlocks = [], level = 1, found = {}, harvest = {} } = {}) {
  if (!DECOR[item]) return 'unknown';
  if (DECOR[item].grown && !(harvest[DECOR[item].grown] > 0)) return 'grown';
  if (DECOR[item].found && !(found[DECOR[item].found] > 0)) return 'found';
  if (itemPrice(item) > 0 && !unlocks.includes(item)) return 'locked';
  if (level < itemLevel(item)) return 'level';
  return null;
}

// Game participation XP, independent of reviewed task quality, gems and home levels.
import { agentForRecord } from './foundation.mjs';
export const RESPONSE_XP = 25;
export const residentKey = (project, slot) => JSON.stringify([project, Number(slot)]);
export function xpLevel(xp = 0) {
  xp = Number.isFinite(Number(xp)) ? Math.max(0, Math.floor(Number(xp))) : 0;
  let level = 1, floor = 0, required = 100;
  while (xp - floor >= required) { floor += required; level++; required = 100 + (level - 1) * 50; }
  return { xp, level, current: xp - floor, required, remaining: required - (xp - floor), percent: (xp - floor) / required * 100 };
}
export function experience(runs = [], households = []) {
  const seen = new Set(), residents = {}, agents = {}, awards = [];
  for (const run of runs) {
    if (!run.id || seen.has(run.id) || run.status !== 'completed' || !run.result?.summary?.trim() || typeof run.project !== 'string' || !Number.isInteger(run.slot) || run.slot < 1) continue;
    seen.add(run.id);
    const key = residentKey(run.project, run.slot);
    residents[key] = (residents[key] || 0) + RESPONSE_XP;
    const agentId = run.agentId || agentForRecord(households, run)?.id;
    if (agentId) agents[agentId] = (agents[agentId] || 0) + RESPONSE_XP;
    awards.push({ id: run.id, project: run.project, slot: run.slot, xp: RESPONSE_XP, ...(agentId ? { agentId } : {}) });
  }
  const levels = values => Object.fromEntries(Object.entries(values).map(([key, xp]) => [key, xpLevel(xp)]));
  return { player: xpLevel(awards.length * RESPONSE_XP), residents: levels(residents), agents: levels(agents), awards };
}

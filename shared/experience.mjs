// Game participation XP, independent of reviewed task quality, gems and home levels.
export const RESPONSE_XP = 25;
export const residentKey = (project, slot) => JSON.stringify([project, Number(slot)]);
export function xpLevel(xp = 0) {
  xp = Number.isFinite(Number(xp)) ? Math.max(0, Math.floor(Number(xp))) : 0;
  let level = 1, floor = 0, required = 100;
  while (xp - floor >= required) { floor += required; level++; required = 100 + (level - 1) * 50; }
  return { xp, level, current: xp - floor, required, remaining: required - (xp - floor), percent: (xp - floor) / required * 100 };
}
export function experience(runs = []) {
  const seen = new Set(), residents = {}, awards = [];
  for (const run of runs) {
    if (!run.id || seen.has(run.id) || run.status !== 'completed' || !run.result?.summary?.trim() || typeof run.project !== 'string' || !Number.isInteger(run.slot) || run.slot < 1) continue;
    seen.add(run.id);
    const key = residentKey(run.project, run.slot);
    residents[key] = (residents[key] || 0) + RESPONSE_XP;
    awards.push({ id: run.id, project: run.project, slot: run.slot, xp: RESPONSE_XP });
  }
  return { player: xpLevel(awards.length * RESPONSE_XP), residents: Object.fromEntries(Object.entries(residents).map(([key, xp]) => [key, xpLevel(xp)])), awards };
}

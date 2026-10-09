// Player chosen town actions. Agent observations never mutate this record.
export const TOWN_HALL = { cost: 30, durationMs: 5 * 60_000, expediteGems: 5, expediteMs: 60_000 };
export const CONNECTION_GEMS = 50;

export const emptyGameplay = () => ({ version: 1, connection: null, townhall: null });

export function visibleResidents(gameplay, households, sessions) {
  return gameplay?.connection ? { households, sessions } : { households: [], sessions: [] };
}

export function townHallState(gameplay = {}, now = Date.now()) {
  const build = gameplay.townhall;
  if (!build) return { status: 'empty', remainingMs: 0 };
  const remainingMs = Math.max(0, Date.parse(build.readyAt) - now);
  return { status: remainingMs ? 'building' : 'built', remainingMs, readyAt: build.readyAt };
}

export function gameplaySpent(gameplay = {}) {
  return (gameplay.townhall ? TOWN_HALL.cost + (gameplay.townhall.expedites || 0) * TOWN_HALL.expediteGems : 0);
}

export function applyGameplayAction(gameplay, input, balance, now = Date.now()) {
  const next = structuredClone(gameplay);
  if (input.action === 'claim') {
    if (next.connection) throw new Error('Connection reward already claimed.');
    if (!['codex', 'claude'].includes(input.provider)) throw new Error('Choose Codex or Claude Code.');
    next.connection = { provider: input.provider, at: new Date(now).toISOString() };
  } else if (input.action === 'start') {
    if (!next.connection) throw new Error('Connect an agent first.');
    if (next.townhall) throw new Error('Town Hall construction already started.');
    if (balance < TOWN_HALL.cost) throw new Error('Not enough gems to build Town Hall.');
    next.townhall = { startedAt: new Date(now).toISOString(), readyAt: new Date(now + TOWN_HALL.durationMs).toISOString(), expedites: 0 };
  } else if (input.action === 'expedite') {
    if (townHallState(next, now).status !== 'building') throw new Error('Town Hall is not under construction.');
    if (balance < TOWN_HALL.expediteGems) throw new Error('Not enough gems to speed up construction.');
    next.townhall.readyAt = new Date(Math.max(now, Date.parse(next.townhall.readyAt) - TOWN_HALL.expediteMs)).toISOString();
    next.townhall.expedites = (next.townhall.expedites || 0) + 1;
  } else throw new Error('Unknown town action.');
  return next;
}

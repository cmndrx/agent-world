// Player chosen town actions. Agent observations never mutate this record.
export const TOWN_HALL = { cost: 30, durationMs: 5 * 60_000, expediteGems: 1, expediteMs: 60_000 };
export const CONNECTION_GEMS = 50;

export const emptyGameplay = () => ({ version: 1, connection: null, townhall: null });

export function visibleResidents(gameplay, households, sessions) {
  if (!gameplay?.connection) return { households: [], sessions: [] };
  const building = new Set(households.filter(h => homeBuildState(gameplay, h.project).status === 'building').map(h => h.project));
  return { households: households.map(h => building.has(h.project) ? { ...h, characters: [] } : h),
    sessions: sessions.filter(s => !building.has(s.project)) };
}

export const homeBuildState = (gameplay, project, now = Date.now()) =>
  gameplay?.homes?.[project] ? townHallState({ townhall: gameplay.homes[project] }, now) : { status: 'built', remainingMs: 0 };

export function startHomeConstruction(gameplay, project, now = Date.now()) {
  if (townHallState(gameplay, now).status !== 'built') throw Error('Build Town Hall before building a home.');
  if (Object.hasOwn(gameplay.homes || {}, project)) return gameplay;
  return { ...gameplay, homes: { ...gameplay.homes, [project]: { startedAt: new Date(now).toISOString(),
    readyAt: new Date(now + TOWN_HALL.durationMs).toISOString(), expediteSpent: 0 } } };
}

export const homeCompletionCost = (gameplay, project, now = Date.now()) =>
  Math.ceil(homeBuildState(gameplay, project, now).remainingMs / TOWN_HALL.expediteMs) * TOWN_HALL.expediteGems;

export function townHallState(gameplay = {}, now = Date.now()) {
  const build = gameplay.townhall;
  if (!build) return { status: 'empty', remainingMs: 0 };
  const remainingMs = Math.max(0, Date.parse(build.readyAt) - now);
  return { status: remainingMs ? 'building' : 'built', remainingMs, readyAt: build.readyAt };
}

export function mayorStage(gameplay, households = [], runs = [], now = Date.now()) {
  if (!gameplay?.connection) return 'link';
  const hall = townHallState(gameplay, now).status;
  if (hall !== 'built') return hall === 'building' ? 'townhall_building' : 'townhall';
  if (!households.length) return 'home';
  if (households.every(h => homeBuildState(gameplay, h.project, now).status === 'building')) return 'home_building';
  const home = households.find(h => homeBuildState(gameplay, h.project, now).status === 'built') || households[0], owner = home.characters?.find(c => c.id === home.ownerAgentId) || home.characters?.[0];
  const responded = runs.some(r => r.project === home.project && (r.agentId ? r.agentId === owner?.id : r.slot === owner?.slot)
    && r.status === 'completed' && r.result?.summary?.trim());
  return responded ? 'settled' : 'owner';
}

export function gameplaySpent(gameplay = {}) {
  return (gameplay.townhall ? TOWN_HALL.cost + (gameplay.townhall.expediteSpent ?? (gameplay.townhall.expedites || 0) * 5) : 0)
    + Object.values(gameplay.homes || {}).reduce((sum, build) => sum + (build.expediteSpent || 0), 0);
}

export const completionCost = (gameplay, now = Date.now()) =>
  Math.ceil(townHallState(gameplay, now).remainingMs / TOWN_HALL.expediteMs) * TOWN_HALL.expediteGems;

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
    next.townhall = { startedAt: new Date(now).toISOString(), readyAt: new Date(now + TOWN_HALL.durationMs).toISOString(), expedites: 0, expediteSpent: 0 };
  } else if (input.action === 'expedite') {
    if (townHallState(next, now).status !== 'building') throw new Error('Town Hall is not under construction.');
    const cost = completionCost(next, now);
    if (balance < cost) throw new Error('Not enough gems to finish construction.');
    next.townhall.expediteSpent = (next.townhall.expediteSpent ?? (next.townhall.expedites || 0) * 5) + cost;
    next.townhall.readyAt = new Date(now).toISOString();
    next.townhall.expedites = (next.townhall.expedites || 0) + 1;
  } else if (input.action === 'expedite-home') {
    if (!Object.hasOwn(next.homes || {}, input.project) || homeBuildState(next, input.project, now).status !== 'building') throw Error('Home is not under construction.');
    const cost = homeCompletionCost(next, input.project, now);
    if (balance < cost) throw Error('Not enough gems to finish construction.');
    next.homes[input.project].expediteSpent += cost;
    next.homes[input.project].readyAt = new Date(now).toISOString();
  } else throw new Error('Unknown town action.');
  return next;
}

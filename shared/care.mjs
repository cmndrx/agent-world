// Player-directed simulation only. No provider, observation or XP dependencies.
export const CARE_VERSION = 1;
export const CARE_INTERESTS = Object.freeze([
  { id: 'praise', label: 'Encouragement' },
  { id: 'snacks', label: 'Snacks' },
  { id: 'reading', label: 'Reading' },
]);
export const CARE_ACTIONS = Object.freeze({
  praise: { label: 'Praise', interest: 'praise', base: 3, bonus: 5, duration: 0 },
  snack: { label: 'Give snack', interest: 'snacks', base: 3, bonus: 5, duration: 0 },
  read: { label: 'Read a book', interest: 'reading', base: 0, bonus: 5, duration: 10000 },
});
export const CARE_COOLDOWN = 30000;
const known = id => CARE_INTERESTS.some(i => i.id === id);
const bounded = value => Math.max(0, Math.min(100, value));
function record(c, event) {
  c.care.history = [...c.care.history, event].slice(-20);
}
export function initializeCare(c, now = Date.now()) {
  if (c.care?.version === CARE_VERSION) return false;
  if (c.care) throw Error('Unsupported care version.');
  if (!c.interestIds?.length) {
    let hash = 0;
    for (const ch of c.id) hash = (Math.imul(hash, 31) + ch.charCodeAt(0)) >>> 0;
    c.interestIds = CARE_INTERESTS.filter((_, i) => i !== hash % 3).map(i => i.id);
  }
  c.happiness = Number.isFinite(c.happiness) ? bounded(c.happiness) : 50;
  c.care = { version: CARE_VERSION, revision: 1, cooldowns: {}, receipts: {}, pending: null, history: [] };
  record(c, { at: now, label: 'Character care initialized', delta: 0, happiness: c.happiness });
  return true;
}
export function careBenefit(c, action) {
  const rule = CARE_ACTIONS[action];
  return rule ? rule.base + (c.interestIds.includes(rule.interest) ? rule.bonus : 0) : 0;
}
function reward(c, action, id, now) {
  const before = c.happiness;
  c.happiness = bounded(before + careBenefit(c, action));
  c.care.cooldowns[action] = now + CARE_COOLDOWN;
  record(c, { id, at: now, action, label: CARE_ACTIONS[action].label,
    matchedInterest: c.interestIds.includes(CARE_ACTIONS[action].interest) ? CARE_ACTIONS[action].interest : null,
    delta: c.happiness - before, happiness: c.happiness });
}
// Validate on a clone so rejected requests never partially mutate live metadata.
export function applyCare(character, input, { now = Date.now(), busy = false } = {}) {
  const c = structuredClone(character);
  initializeCare(c, now);
  if (typeof input.id !== 'string' || !/^[a-zA-Z0-9_-]{8,100}$/.test(input.id)) throw Error('Supply a valid care action ID.');
  const fingerprint = JSON.stringify([input.action, input.interestIds || null]);
  if (Object.hasOwn(c.care.receipts, input.id)) {
    if (c.care.receipts[input.id] !== fingerprint) throw Error('Care action ID already used.');
    return { character, duplicate: true };
  }
  if (input.revision !== c.care.revision) throw Error('Character changed. Refresh and try again.');
  if (input.action === 'interests') {
    const ids = input.interestIds;
    if (!Array.isArray(ids) || ids.length < 1 || ids.length > 3 || new Set(ids).size !== ids.length || ids.some(id => !known(id))) throw Error('Choose one to three supported interests.');
    if (c.care.pending) throw Error('Finish or cancel reading before changing interests.');
    c.interestIds = [...ids];
    record(c, { id: input.id, at: now, label: 'Interests changed', delta: 0, happiness: c.happiness });
  } else if (input.action === 'cancel') {
    if (!c.care.pending) throw Error('No reading activity to cancel.');
    record(c, { id: c.care.pending.id, at: now, label: 'Reading cancelled', delta: 0, happiness: c.happiness });
    c.care.pending = null;
  } else {
    const rule = Object.hasOwn(CARE_ACTIONS, input.action) && CARE_ACTIONS[input.action];
    if (!rule) throw Error('Choose a supported care action.');
    if (c.care.pending) throw Error('Finish or cancel reading first.');
    if (now < (c.care.cooldowns[input.action] || 0)) throw Error('This care action is cooling down.');
    if (rule.duration) {
      if (busy) throw Error('Wait until this resident is free before reading.');
      if (!c.interestIds.includes(rule.interest)) throw Error('Choose Reading as an interest first.');
      c.care.pending = { id: input.id, action: input.action, startedAt: now, readyAt: now + rule.duration };
    } else reward(c, input.action, input.id, now);
  }
  c.care.receipts[input.id] = fingerprint;
  c.care.revision++;
  return { character: c, duplicate: false };
}
export function advanceCare(c, { now = Date.now(), busy = false, restart = false, unavailable = false } = {}) {
  const pending = c.care?.pending;
  if (!pending) return false;
  if (busy || restart || unavailable) {
    record(c, { id: pending.id, at: now, label: restart ? 'Reading cancelled on restart' : unavailable ? 'Reading cancelled: resident unavailable' : 'Reading interrupted by agent activity', delta: 0, happiness: c.happiness });
  } else if (now >= pending.readyAt) reward(c, pending.action, pending.id, now);
  else return false;
  c.care.pending = null;
  c.care.revision++;
  return true;
}

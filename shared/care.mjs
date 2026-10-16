// Player-directed simulation only. No provider, observation or XP dependencies.
import { INTEREST_CARE } from './interest-care.mjs';
export const CARE_VERSION = 1;
export const CARE_INTERESTS = Object.freeze(Object.values(INTEREST_CARE));
const actionId = id => ({reading:'read',snacks:'snack'}[id] || id);
export const CARE_ACTIONS = Object.freeze(Object.fromEntries(CARE_INTERESTS.filter(i=>!i.unsupported).map(i=>
  [actionId(i.id), {label:i.label,interest:i.id,activityId:i.activityId,base:0,bonus:5,duration:10000}])));
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
    c.interestIds = ['sweets','board_games','personal_goals'].filter((_, i) => i !== hash % 3);
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
export function applyCare(character, input, { now = Date.now(), busy = false, eligibility = null } = {}) {
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
    if (c.care.pending) throw Error('Finish or cancel care before changing interests.');
    c.interestIds = [...ids];
    record(c, { id: input.id, at: now, label: 'Interests changed', delta: 0, happiness: c.happiness });
  } else if (input.action === 'cancel') {
    if (!c.care.pending) throw Error('No care activity to cancel.');
    record(c, { id: c.care.pending.id, at: now, label: 'Care cancelled', delta: 0, happiness: c.happiness });
    c.care.pending = null;
  } else {
    const rule = Object.hasOwn(CARE_ACTIONS, input.action) && CARE_ACTIONS[input.action];
    if (!rule) throw Error('Choose a supported care action.');
    if (c.care.pending) throw Error('Finish or cancel care first.');
    if (now < (c.care.cooldowns[input.action] || 0)) throw Error('This care action is cooling down.');
    if (rule.duration) {
      if (busy) throw Error('Wait until this resident is free before care.');
      if (!c.interestIds.includes(rule.interest)) throw Error('Choose the matching interest first.');
      if (!eligibility?.plan || eligibility.reason) throw Error(eligibility?.reason || 'A validated reachable care station is required.');
      c.care.pending = { id: input.id, action: input.action, startedAt: now, readyAt: null,
        plan: eligibility.plan, layout: eligibility.layout, floor: eligibility.floor,
        activeMs:0, sequence:0, lastPulse:null, notBefore:now+(eligibility.approachMs || 0), deadline:now+60000 };
    } else reward(c, input.action, input.id, now);
  }
  c.care.receipts[input.id] = fingerprint;
  c.care.revision++;
  return { character: c, duplicate: false };
}
export function advanceCare(c, { now = Date.now(), busy = false, restart = false, unavailable = false } = {}) {
  const pending = c.care?.pending;
  if (!pending) return false;
  if (busy || restart || unavailable || now > pending.deadline || (pending.lastPulse && now-pending.lastPulse>2500)) {
    record(c, { id: pending.id, at: now, label: restart ? 'Care cancelled on restart' : busy ? 'Care interrupted by agent activity' : 'Care cancelled: scene or resource unavailable', delta: 0, happiness: c.happiness });
  } else if (pending.activeMs >= CARE_ACTIONS[pending.action]?.duration) reward(c, pending.action, pending.id, now);
  else return false;
  c.care.pending = null;
  c.care.revision++;
  return true;
}

// Only server-owned eligibility is passed here. A client timer or eligibility flag cannot complete care.
export function pulseCare(character, input, {now=Date.now(), busy=false, eligibility}={}) {
  const c=structuredClone(character), p=c.care?.pending;
  if (!p || input.pendingId!==p.id || input.sequence!==p.sequence+1) throw Error('Stale or invalid care scene.');
  if (now < p.notBefore) throw Error('Resident is still approaching the care station.');
  if (busy || !eligibility?.plan || eligibility.reason || eligibility.layout!==p.layout || eligibility.floor!==p.floor) throw Error('Care station is no longer available.');
  if (input.floor!==p.floor || !Number.isFinite(input.x) || !Number.isFinite(input.z) || Math.hypot(input.x-p.plan.spot.x,input.z-p.plan.spot.z)>.4) throw Error('Resident has not reached the care station.');
  if (now>p.deadline || p.lastPulse && now-p.lastPulse>2500) throw Error('Care scene expired.');
  if (p.lastPulse) p.activeMs+=Math.min(1000,Math.max(0,now-p.lastPulse));
  p.lastPulse=now;p.sequence++;p.readyAt=now+Math.max(0,10000-p.activeMs);
  advanceCare(c,{now});
  // Heartbeats also revise authoritative state; duplicate sequence never advances time.
  c.care.revision++;
  return {character:c,duplicate:false};
}

// Saved identities without care keep their uninitialized happiness/history exactly as stored.
// This operation edits preferences only; it never recruits, activates or initializes care.
export function applySavedInterests(character,input) {
  if (character.care) return applyCare(character,input);
  if(input.action!=='interests' || typeof input.id!=='string' || !/^[a-zA-Z0-9_-]{8,100}$/.test(input.id))throw Error('Supply a valid interest edit.');
  const ids=input.interestIds;
  if(!Array.isArray(ids)||ids.length<1||ids.length>3||new Set(ids).size!==ids.length||ids.some(id=>!known(id)))throw Error('Choose one to three supported interests.');
  const meta=character.interestPreferences || {revision:0,receipts:{}};
  const fingerprint=JSON.stringify(ids);
  if(Object.hasOwn(meta.receipts,input.id)) {
    if(meta.receipts[input.id]!==fingerprint)throw Error('Interest edit ID already used.');
    return {character,duplicate:true};
  }
  if(input.revision!==meta.revision)throw Error('Character changed. Refresh and try again.');
  const c=structuredClone(character);c.interestIds=[...ids];
  c.interestPreferences={revision:meta.revision+1,receipts:{...meta.receipts,[input.id]:fingerprint}};
  return {character:c,duplicate:false};
}

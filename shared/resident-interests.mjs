// Resident interests (simulation layer): what each resident enjoys. Interests served by a venue become needs for
// their home (shared/home-satisfaction.mjs); interests that happen at home only shape ambient activities. Editing
// interests is player-led and never touches observed work, XP or recruitment.

import { RECREATION, RECREATION_KINDS } from './town.mjs';
import { INTEREST_CARE } from './interest-care.mjs';
import { INTEREST_BY_ID } from './catalogs/index.js';

/** Interests a venue serves: these become home needs. */
export const VENUE_INTERESTS = Object.freeze([...new Set(RECREATION_KINDS.flatMap((k) => RECREATION[k].interests))]);
/** Interests residents enjoy at home (ambient activities only). */
export const HOME_INTERESTS = Object.freeze(Object.values(INTEREST_CARE).filter((i) => !i.unsupported).map((i) => i.id));
/** Every interest a player may choose, venue interests first. */
export const INTEREST_CHOICES = Object.freeze([...new Set([...VENUE_INTERESTS, ...HOME_INTERESTS])]
  .map((id) => ({ id, label: INTEREST_BY_ID[id]?.label || id, venue: VENUE_INTERESTS.includes(id) })));
export const MAX_INTERESTS = 3;

const choosable = (id) => INTEREST_CHOICES.some((i) => i.id === id);
const hash = (s) => { let h = 0; for (const ch of String(s)) h = (Math.imul(h, 31) + ch.charCodeAt(0)) >>> 0; return h; };

/**
 * Give a resident without interests two deterministic venue interests: one a park serves (available from the
 * start) and one from any venue. Residents who already have interests keep them exactly. Returns true if changed.
 */
export function ensureInterests(character) {
  if (character.interestIds?.length) return false;
  const park = RECREATION.park.interests, rest = VENUE_INTERESTS.filter((id) => !park.includes(id));
  const h = hash(character.id);
  character.interestIds = [park[h % park.length], rest[(h >>> 8) % rest.length]];
  return true;
}

/**
 * Apply a player's interest edit: 1–3 distinct choosable interests, deduplicated by request id and guarded by a
 * revision. Returns { character, duplicate } and never mutates the input.
 */
export function editInterests(character, input) {
  if (input?.action !== 'interests' || typeof input.id !== 'string' || !/^[a-zA-Z0-9_-]{8,100}$/.test(input.id)) throw Error('Supply a valid interest edit.');
  const ids = input.interestIds;
  if (!Array.isArray(ids) || ids.length < 1 || ids.length > MAX_INTERESTS || new Set(ids).size !== ids.length || ids.some((id) => !choosable(id))) {
    throw Error(`Choose one to ${MAX_INTERESTS} supported interests.`);
  }
  const meta = character.interestPreferences || { revision: 0, receipts: {} };
  const fingerprint = JSON.stringify(ids);
  if (Object.hasOwn(meta.receipts, input.id)) {
    if (meta.receipts[input.id] !== fingerprint) throw Error('Interest edit ID already used.');
    return { character, duplicate: true };
  }
  if (input.revision !== meta.revision) throw Error('Character changed. Refresh and try again.');
  const c = structuredClone(character);
  c.interestIds = [...ids];
  c.interestPreferences = { revision: meta.revision + 1, receipts: { ...meta.receipts, [input.id]: fingerprint } };
  return { character: c, duplicate: false };
}

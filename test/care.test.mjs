import test from 'node:test';
import assert from 'node:assert/strict';
import { initializeCare, applyCare, advanceCare, careBenefit, CARE_INTERESTS } from '../shared/care.mjs';
const resident = () => {
  const c = { id: 'resident-1', name: 'Fixture', interestIds: [], happiness: null };
  initializeCare(c, 1000);
  return c;
};
const action = (c, name, at = 1000, extra = {}) => applyCare(c, { id: `request-${name}-${at}`, action: name, revision: c.care.revision, ...extra }, { now: at }).character;

test('care migration is deterministic, bounded, idempotent and preserves saved preferences', () => {
  const c = resident(), other = resident();
  assert.deepEqual(c, other);
  assert.equal(c.interestIds.length, 2);
  assert.equal(c.happiness, 50);
  assert.equal(initializeCare(c, 4000), false);
  const saved = { id: 'saved', interestIds: ['dog_companionship'], happiness: 120 };
  initializeCare(saved, 0);
  assert.deepEqual(saved.interestIds, ['dog_companionship']);
  assert.equal(saved.happiness, 100);
  assert.ok(CARE_INTERESTS.every(i => ['praise','snacks','reading'].includes(i.id)));
});
test('general care works without an interest and matching care gives a larger benefit', () => {
  let c = resident(); c.interestIds = ['reading'];
  assert.equal(careBenefit(c, 'praise'), 3);
  c = action(c, 'praise'); assert.equal(c.happiness, 53);
  c = action(c, 'snack'); assert.equal(c.happiness, 56);
  c.interestIds = ['praise','snacks'];
  c = action(c, 'praise', 32000); assert.equal(c.happiness, 64);
  c = action(c, 'snack', 32000); assert.equal(c.happiness, 72);
  assert.equal(c.care.history.at(-1).matchedInterest, 'snacks');
});
test('duplicates do not award twice, cooldowns survive edits, stale and forged requests cannot mutate', () => {
  let c = resident();
  const request = { id:'duplicate-1', action:'praise', revision:c.care.revision };
  c = applyCare(c, request, { now:1000 }).character;
  assert.equal(applyCare(c, request, { now:50000 }).duplicate, true);
  const before = structuredClone(c);
  assert.throws(() => applyCare(c, { ...request, action:'snack' }), /already used/);
  assert.throws(() => action(c, 'praise', 2000), /cooling/);
  assert.throws(() => action(c, 'snack', 2000, { revision:0 }), /Refresh/);
  assert.throws(() => action(c, '__proto__', 2000), /supported/);
  assert.throws(() => action(c, 'interests', 2000, { interestIds:[] }), /one to three/);
  assert.deepEqual(c, before);
  c = action(c, 'interests', 2000, { interestIds:['reading'] });
  assert.equal(c.happiness, before.happiness);
  assert.throws(() => action(c, 'praise', 3000), /cooling/);
});
test('reading rewards only once after completion; busy, cancel and restart grant nothing', () => {
  let c = resident(); c.interestIds = ['reading'];
  c = action(c, 'read'); assert.equal(c.happiness, 50);
  assert.equal(advanceCare(c, { now:10999 }), false);
  assert.equal(advanceCare(c, { now:11000 }), true);
  assert.equal(c.happiness, 55);
  assert.equal(advanceCare(c, { now:50000 }), false);
  for (const reason of ['busy','restart','unavailable','cancel']) {
    let r = resident(); r.interestIds = ['reading']; r = action(r, 'read');
    if (reason === 'cancel') r = action(r, 'cancel', 2000);
    else advanceCare(r, { now:15000, [reason]:true });
    assert.equal(r.happiness, 50); assert.equal(r.care.pending, null);
  }
  const r = resident(); r.interestIds = ['reading'];
  assert.throws(() => applyCare(r, { id:'busy-read', action:'read', revision:1 }, { busy:true }), /free/);
});
test('happiness clamps and records actual delta; passive time and unsupported interests do not earn', () => {
  let c = resident(); c.happiness = 99; c.interestIds = ['praise'];
  c = action(c, 'praise'); assert.equal(c.happiness, 100); assert.equal(c.care.history.at(-1).delta, 1);
  const before = structuredClone(c); advanceCare(c, { now:9999999 }); assert.deepEqual(c, before);
  c.interestIds = ['dog_companionship'];
  assert.throws(() => action(c, 'read', 40000), /Reading/);
});

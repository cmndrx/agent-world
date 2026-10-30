import assert from 'node:assert/strict';
import { test } from 'node:test';
import { RECREATION } from '../shared/town.mjs';
import { HOME_INTERESTS, INTEREST_CHOICES, MAX_INTERESTS, VENUE_INTERESTS, editInterests, ensureInterests } from '../shared/resident-interests.mjs';

test('choices are venue interests first, then home interests, each once', () => {
  assert.ok(VENUE_INTERESTS.length > 0 && HOME_INTERESTS.length === 15);
  const ids = INTEREST_CHOICES.map((i) => i.id);
  assert.equal(new Set(ids).size, ids.length);
  assert.ok(INTEREST_CHOICES.slice(0, VENUE_INTERESTS.length).every((i) => i.venue));
  assert.ok(ids.includes('reading') && ids.includes('arcade_games'));
  assert.ok(!ids.includes('cat_companionship'));
});

test('residents without interests get a park interest and another venue interest, deterministically', () => {
  const a = { id: 'resident-a' }, b = { id: 'resident-a' };
  assert.equal(ensureInterests(a), true); ensureInterests(b);
  assert.deepEqual(a.interestIds, b.interestIds);
  assert.equal(a.interestIds.length, 2);
  assert.ok(RECREATION.park.interests.includes(a.interestIds[0]));
  assert.ok(VENUE_INTERESTS.includes(a.interestIds[1]) && !RECREATION.park.interests.includes(a.interestIds[1]));
  const kept = { id: 'x', interestIds: ['sweets'], happiness: 40 };
  assert.equal(ensureInterests(kept), false);
  assert.deepEqual(kept.interestIds, ['sweets']); assert.equal(kept.happiness, 40);
});

test('edits validate size, duplicates and choices, deduplicate by id and guard the revision', () => {
  const c = { id: 'r', interestIds: ['sweets'] };
  const input = { action: 'interests', id: 'edit-0001', revision: 0, interestIds: ['movies', 'reading'] };
  const { character, duplicate } = editInterests(c, input);
  assert.equal(duplicate, false);
  assert.deepEqual(character.interestIds, ['movies', 'reading']);
  assert.equal(character.interestPreferences.revision, 1);
  assert.deepEqual(c.interestIds, ['sweets'], 'input is never mutated');
  assert.equal(editInterests(character, input).duplicate, true);
  assert.throws(() => editInterests(character, { ...input, interestIds: ['music'] }), /already used/);
  assert.throws(() => editInterests(character, { ...input, id: 'edit-stale' }), /Refresh/);
  const next = { ...input, id: 'edit-0002', revision: 1 };
  assert.throws(() => editInterests(character, { ...next, interestIds: [] }), /one to 3/);
  assert.throws(() => editInterests(character, { ...next, interestIds: Array(MAX_INTERESTS + 1).fill(0).map((_, i) => VENUE_INTERESTS[i]) }), /one to 3/);
  assert.throws(() => editInterests(character, { ...next, interestIds: ['movies', 'movies'] }), /one to 3/);
  assert.throws(() => editInterests(character, { ...next, interestIds: ['cat_companionship'] }), /one to 3/);
  assert.throws(() => editInterests(character, { ...next, id: 'x' }), /valid interest edit/);
  assert.throws(() => editInterests(character, { ...next, action: 'praise' }), /valid interest edit/);
});

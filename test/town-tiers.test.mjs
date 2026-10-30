import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CIVIC_KINDS, PUBLIC_BUILDINGS, PUBLIC_KINDS, RECREATION_KINDS, emptyTown, placeCivic, placeHome } from '../shared/town.mjs';
import { MAX_TIER, TOWN_TIERS, earnedTier, placedTier, tierRequirements, tierStats, tierStatus, tierUnlocks } from '../shared/town-tiers.mjs';

const stats = (o) => ({ homes: 0, residents: 0, average: 0, badHomes: [], ...o });

test('every public building unlocks at exactly one tier, matching the approved table', () => {
  assert.equal(MAX_TIER, 6);
  assert.deepEqual(TOWN_TIERS.map((t) => t.name), ['Hamlet', 'Village', 'Town', 'Borough', 'City', 'Metropolis']);
  for (const k of PUBLIC_KINDS) assert.ok(PUBLIC_BUILDINGS[k].townTier >= 1 && PUBLIC_BUILDINGS[k].townTier <= MAX_TIER, k);
  assert.deepEqual(tierUnlocks(1), ['fire_station', 'park', 'ice_cream']);
  assert.deepEqual(tierUnlocks(2), ['police', 'library', 'arcade']);
  assert.deepEqual(tierUnlocks(3), ['school', 'restaurant', 'community_garden', 'gym']);
  assert.deepEqual(tierUnlocks(4), ['hospital', 'city_dump', 'cinema']);
  assert.deepEqual(tierUnlocks(5), ['water_tower', 'music_lounge', 'pool']);
  assert.deepEqual(tierUnlocks(6), ['power_plant', 'sports_complex']);
  assert.equal([1, 2, 3, 4, 5, 6].flatMap(tierUnlocks).length, CIVIC_KINDS.length + RECREATION_KINDS.length);
});

test('requirements: homes or residents, the average and no bad homes', () => {
  assert.deepEqual(tierRequirements(1, stats()), []);
  const village = tierRequirements(2, stats({ homes: 1, average: 40 }));
  assert.deepEqual(village.map((r) => [r.id, r.met]), [['size', true], ['average', true], ['no-bad', true]]);
  assert.equal(village[0].label, '1 home');
  const town = tierRequirements(3, stats({ homes: 1, residents: 3, average: 55 }));
  assert.equal(town[0].label, '2 homes or 3 residents');
  assert.equal(town[0].met, true, 'residents open the size gate for a single-project player');
  assert.equal(tierRequirements(3, stats({ homes: 2, average: 55, badHomes: ['/a'] }))[2].met, false);
  assert.equal(tierRequirements(2, stats({ homes: 0, average: 100 }))[2].met, false, 'an empty town has nothing to satisfy');
});

test('tiers are earned one at a time and never drop below the highest reached', () => {
  assert.equal(earnedTier(stats()), 1);
  assert.equal(earnedTier(stats({ homes: 1, average: 45 })), 2);
  assert.equal(earnedTier(stats({ homes: 1, residents: 5, average: 65 })), 4);
  assert.equal(earnedTier(stats({ homes: 4, residents: 10, average: 80 })), 6);
  // A high average with a bad home stops at tier 1.
  assert.equal(earnedTier(stats({ homes: 4, residents: 10, average: 80, badHomes: ['/x'] })), 1);
  const kept = tierStatus(stats({ homes: 1, average: 10, badHomes: ['/x'] }), 3);
  assert.deepEqual([kept.current, kept.earned, kept.reached, kept.name], [3, 1, 3, 'Town']);
  assert.equal(kept.next.tier, 4);
  assert.deepEqual(kept.next.unlocks, tierUnlocks(4));
  assert.equal(tierStatus(stats({ homes: 4, residents: 10, average: 90 }), 1).next, null);
});

test('stats count placed homes and active residents; an existing town starts at its placed buildings’ tier', () => {
  let t = placeHome(placeHome(emptyTown(), '/a', { i: 2, j: -2, rot: 0 }), '/b', { i: 10, j: -2, rot: 0 });
  t = { ...t, homes: [...t.homes, { id: 'h-x', project: '/c', i: null, j: null, rot: 0 }] };
  const hs = [
    { project: '/a', residentAgentIds: ['r1', 'r2'], characters: [{ id: 'r1' }, { id: 'r2' }, { id: 'saved' }] },
    { project: '/b', characters: [{ id: 'r3' }] },
    { project: '/c', characters: [{ id: 'r4' }] },
  ];
  const sat = new Map([['/a', { score: 80, level: 'good' }], ['/b', { score: 20, level: 'bad' }]]);
  assert.deepEqual(tierStats(t, hs, sat), { homes: 2, residents: 3, average: 50, badHomes: ['/b'] });
  assert.equal(placedTier(emptyTown()), 1);
  const placed = placeCivic(placeCivic(emptyTown(), 'park', { i: -1, j: -2, rot: 0 }, { tier: 9 }), 'hospital', { i: 4, j: 2, rot: 2 }, { tier: 9 });
  assert.equal(placedTier(placed), 4);
});

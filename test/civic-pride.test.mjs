import assert from 'node:assert/strict';
import { test } from 'node:test';
import { emptyTown, placeCivic, placeHome } from '../shared/town.mjs';
import { INFLUENCE_RULES, buildInfluence, influenceAt, influenceStamps } from '../shared/town-influence.mjs';
import { PRIDE_REWARDS, UPGRADE_COSTS, buyUpgrade, emptyPride, nextUpgrade, prideBalance, prideMilestones, recentPride, recordPride } from '../shared/civic-pride.mjs';

const sat = (needs, level = 'good') => new Map([['/a', { level, needs }]]);
const good = (id) => ({ id, label: id, level: 'good' });

test('milestones: each good need, a fully satisfied home and each tier above 1, with stable keys', () => {
  const m = prideMilestones(sat([good('fire'), { id: 'green', label: 'green', level: 'low' }], 'low'), 3, () => 'Rosa’s home');
  assert.deepEqual(m.map((x) => x.key), ['need:/a:fire', 'tier:2', 'tier:3']);
  assert.equal(m[0].amount, PRIDE_REWARDS.need);
  assert.equal(m[0].label, 'Rosa’s home: fire met');
  const full = prideMilestones(sat([good('fire'), good('green')]), 1);
  assert.ok(full.some((x) => x.key === 'home:/a' && x.amount === PRIDE_REWARDS.home));
  assert.equal(prideMilestones(sat([], 'good'), 1).length, 0, 'a home with no needs earns nothing');
  // A town that started at tier 4 (migration) earns tier grants only from tier 5.
  assert.deepEqual(prideMilestones(new Map(), 5, undefined, { startTier: 4 }).map((x) => x.key), ['tier:5']);
  assert.deepEqual(prideMilestones(new Map(), 4, undefined, { startTier: 4 }), []);
});

test('recording is idempotent: each milestone pays once, even after it is lost and met again', () => {
  const first = recordPride(undefined, prideMilestones(sat([good('fire')]), 2), '2026-10-27T00:00:00Z');
  assert.deepEqual(first.added.map((a) => a.key), ['need:/a:fire', 'home:/a', 'tier:2']);
  assert.deepEqual(prideBalance(first.pride), { earned: PRIDE_REWARDS.need + PRIDE_REWARDS.home + PRIDE_REWARDS.tier, spent: 0, balance: 70 });
  const again = recordPride(first.pride, prideMilestones(sat([good('fire')]), 2));
  assert.equal(again.added.length, 0);
  assert.equal(again.pride, first.pride);
  assert.equal(recentPride(first.pride, 2).length, 2);
  assert.deepEqual(emptyPride(), { version: 1, milestones: {}, spent: [] });
});

test('upgrades: civic services only, levels 2 and 3, cost checked, recorded as spending and adding reach', () => {
  let town = placeHome(emptyTown(), '/a', { i: 2, j: -2, rot: 0 });
  town = placeCivic(placeCivic(town, 'fire_station', { i: 13, j: 2, rot: 2 }, { tier: 9 }), 'park', { i: 6, j: 2, rot: 2 }, { tier: 9 });
  const fire = town.civic.find((c) => c.kind === 'fire_station');
  assert.deepEqual(nextUpgrade(fire), { level: 2, cost: UPGRADE_COSTS[2], reach: 2 });
  assert.equal(nextUpgrade(town.civic.find((c) => c.kind === 'park')), null, 'venues are not upgraded');
  const rich = { ...emptyPride(), milestones: { a: { amount: 300 } } };
  assert.throws(() => buyUpgrade(town, emptyPride(), 'fire_station'), /Needs 60 Civic Pride \(you have 0\)/);
  assert.throws(() => buyUpgrade(town, rich, 'park'), /civic building/);
  assert.throws(() => buyUpgrade(town, rich, 'police'), /civic building/);
  const one = buyUpgrade(town, rich, 'fire_station', 'now');
  assert.equal(one.town.civic.find((c) => c.kind === 'fire_station').upgrade, 2);
  assert.equal(one.town.revision, town.revision + 1);
  assert.deepEqual(one.pride.spent, [{ kind: 'fire_station', level: 2, cost: 60, at: 'now' }]);
  assert.equal(prideBalance(one.pride).balance, 240);
  const two = buyUpgrade(one.town, one.pride, 'fire_station');
  assert.throws(() => buyUpgrade(two.town, two.pride, 'fire_station'), /fully upgraded/);
  assert.equal(town.civic.find((c) => c.kind === 'fire_station').upgrade, undefined, 'input never mutated');
  // Reach grows by 2 tiles per level for service layers.
  const base = INFLUENCE_RULES.fire_station[0].reach;
  assert.equal(influenceStamps({ ...fire, upgrade: 2 })[0].reach, base + 2);
  assert.equal(influenceStamps({ ...fire, upgrade: 3 })[0].reach, base + 4);
  const edge = 13 - base - 2; // a tile just outside level-1 reach, west of the station
  assert.equal(influenceAt(buildInfluence(town), 'fire', edge, 3), 0);
  assert.ok(influenceAt(buildInfluence(one.town), 'fire', edge, 3) > 0);
});

test('upgrading a dump widens garbage pickup but not its smell', () => {
  const dump = { kind: 'city_dump', i: 2, j: 2, rot: 2, upgrade: 3 };
  const [garbage, smell] = influenceStamps(dump);
  assert.equal(garbage.reach, INFLUENCE_RULES.city_dump[0].reach + 4);
  assert.equal(smell.reach, INFLUENCE_RULES.city_dump[1].reach);
});

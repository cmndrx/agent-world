import assert from 'node:assert/strict';
import { test } from 'node:test';
import { MAX_PROPS, PROP_KINDS, TOWN_PROPS, checkPlacement, checkProp, emptyTown, layoutProblems, moveProp, placeCivic, placeHome, placeProp, planRoad, removeProp } from '../shared/town.mjs';
import { PROP_GREEN_CAP, PROP_RULES, buildInfluence, influenceAt } from '../shared/town-influence.mjs';
import { buyProp, emptyPride, prideBalance, propRefund, sellProp } from '../shared/civic-pride.mjs';
import { previewLines, propPreview, withProp } from '../shared/town-preview.mjs';

const rich = (amount = 1000) => ({ ...emptyPride(), milestones: { seed: { amount } } });

test('the approved props, prices and tiers, each with a rule', () => {
  assert.deepEqual(PROP_KINDS, ['tree', 'flower_bed', 'bench', 'hedge', 'fountain', 'gazebo', 'statue']);
  assert.deepEqual(PROP_KINDS.map((k) => [TOWN_PROPS[k].cost, TOWN_PROPS[k].townTier]), [[10, 1], [15, 1], [10, 1], [15, 2], [30, 2], [35, 3], [40, 4]]);
  assert.deepEqual(PROP_KINDS.map((k) => [PROP_RULES[k].beauty, PROP_RULES[k].reach]), [[0.15, 1], [0.2, 1], [0.1, 1], [0.1, 1], [0.3, 2], [0.3, 2], [0.35, 3]]);
  assert.equal(PROP_RULES.hedge.buffer, 0.15);
  assert.equal(MAX_PROPS, 60);
  assert.deepEqual(PROP_KINDS.map(propRefund), [5, 7, 5, 7, 15, 17, 20]);
});

test('props take one free tile, need no street, and block homes, buildings and roads in turn', () => {
  let town = placeHome(emptyTown(), '/a', { i: 2, j: -2, rot: 0 });
  assert.match(checkProp(town, { i: 3, j: -1 }).reason, /a home/);
  assert.match(checkProp(town, { i: 3, j: 1 }).reason, /a street/);
  assert.match(checkProp(town, { i: -4, j: -2 }).reason, /town square/);
  assert.match(checkProp(town, { i: 99, j: 0 }).reason, /outside buildable/);
  assert.equal(checkProp(town, { i: 8, j: 10 }).ok, true, 'far from any street is fine');
  town = placeProp(town, 'tree', { i: 8, j: 10 });
  assert.equal(town.props.length, 1);
  assert.match(checkProp(town, { i: 8, j: 10 }).reason, /a tree/);
  assert.match(checkPlacement(town, { i: 7, j: 8, rot: 2 }, { project: '/b' }).reason, /tree/);
  assert.match(planRoad(town, { i: 8, j: 2 }, { i: 8, j: 12 }).reason, /a tree/);
  assert.throws(() => placeCivic(town, 'park', { i: 7, j: 8, rot: 2 }, { tier: 9 }));
  assert.deepEqual(layoutProblems(town), []);
});

test('tier gates, the 60-prop cap, moving and removing', () => {
  let town = emptyTown();
  assert.throws(() => placeProp(town, 'hedge', { i: 8, j: 10 }, { tier: 1 }), /hedge row unlocks at town tier 2/);
  assert.throws(() => placeProp(town, 'castle', { i: 8, j: 10 }), /Choose a prop/);
  const full = { ...town, props: Array.from({ length: MAX_PROPS }, (_, n) => ({ id: `p${n}`, kind: 'tree', i: -7 + (n % 20), j: 10 + Math.floor(n / 20) })) };
  assert.throws(() => placeProp(full, 'tree', { i: 8, j: 16 }), /most props it can hold \(60\)/);
  town = placeProp(town, 'tree', { i: 8, j: 10 });
  const id = town.props[0].id;
  assert.throws(() => moveProp(town, 'nope', { i: 9, j: 10 }), /isn’t in your town/);
  const moved = moveProp(town, id, { i: 9, j: 10 });
  assert.deepEqual([moved.props[0].i, moved.props[0].j, moved.props[0].id], [9, 10, id]);
  assert.equal(moved.revision, town.revision + 1);
  assert.deepEqual(removeProp(moved, id).props, []);
});

test('props cover a square of tiles; green space is capped at 0.3 per tile and hedges buffer noise next to them', () => {
  let town = emptyTown();
  // A ring of fountains around one tile would add 2.4 without the cap.
  for (const [i, j] of [[7, 9], [8, 9], [9, 9], [7, 10], [9, 10], [7, 11], [8, 11], [9, 11]]) town = placeProp(town, 'fountain', { i, j }, { tier: 9 });
  assert.ok(Math.abs(influenceAt(buildInfluence(town), 'beauty', 8, 10) - PROP_GREEN_CAP) < 1e-9);
  // A park plus props can pass the cap: civic green space and prop green space add up (to 1).
  const park = placeCivic(emptyTown(), 'park', { i: 2, j: 2, rot: 2 }, { tier: 9 });
  const parkOnly = influenceAt(buildInfluence(park), 'beauty', 5, 3);
  const withTree = influenceAt(buildInfluence(placeProp(park, 'tree', { i: 5, j: 3 })), 'beauty', 5, 3);
  assert.ok(withTree > parkOnly && withTree <= Math.min(1, parkOnly + PROP_GREEN_CAP) + 1e-9);
  // Hedges next to a dump's smell lower it; two hedges stack only to the buffer cap.
  const dump = placeCivic(emptyTown(), 'city_dump', { i: 2, j: 2, rot: 2 }, { tier: 9 });
  const smell = influenceAt(buildInfluence(dump), 'nuisance', 7, 3);
  const one = placeProp(dump, 'hedge', { i: 7, j: 4 }, { tier: 9 });
  assert.ok(Math.abs(influenceAt(buildInfluence(one), 'nuisance', 7, 3) - Math.max(0, smell - 0.15)) < 1e-9);
  assert.ok(influenceAt(buildInfluence(one), 'nuisance', 6, 3) < influenceAt(buildInfluence(dump), 'nuisance', 6, 3), 'diagonal neighbours are shielded too');
  assert.ok(influenceAt(buildInfluence(one), 'nuisance', 9, 3) === influenceAt(buildInfluence(dump), 'nuisance', 9, 3), 'two tiles away is not shielded');
});

test('buying charges the price after every check; removing refunds half as a negative spend', () => {
  const town = emptyTown();
  assert.throws(() => buyProp(town, emptyPride(), 'tree', { i: 8, j: 10 }), /Needs 10 Civic Pride \(you have 0\)/);
  assert.throws(() => buyProp(town, rich(), 'tree', { i: 3, j: 1 }), /street/);
  assert.throws(() => buyProp(town, rich(), 'statue', { i: 8, j: 10 }, { tier: 3 }), /tier 4/);
  const bought = buyProp(town, rich(100), 'fountain', { i: 8, j: 10 }, { tier: 2, now: 't1' });
  assert.equal(prideBalance(bought.pride).balance, 70);
  assert.deepEqual(bought.pride.spent, [{ kind: 'prop:fountain', prop: bought.prop.id, cost: 30, at: 't1' }]);
  const sold = sellProp(bought.town, bought.pride, bought.prop.id, { now: 't2' });
  assert.equal(sold.refund, 15);
  assert.deepEqual(sold.town.props, []);
  assert.equal(prideBalance(sold.pride).balance, 85);
  assert.equal(sold.pride.spent.at(-1).cost, -15);
  assert.throws(() => sellProp(sold.town, sold.pride, bought.prop.id), /isn’t in your town/);
  assert.equal(town.props.length, 0, 'inputs never mutated');
});

test('prop previews show green space changes for nearby homes', () => {
  const town = { ...placeHome(emptyTown(), '/a', { i: 2, j: -2, rot: 0 }), tier: { current: 1 } };
  const hs = [{ project: '/a', characters: [{ id: 'r', name: 'Rosa', interestIds: [] }] }];
  // A fountain beside the home lifts its green space from nothing.
  const p = propPreview(town, hs, 'fountain', { i: 5, j: -1 });
  const rosa = p.homes.find((h) => h.project === '/a');
  // One fountain beside the home covers two of its three columns: green space goes from bad to thin.
  assert.ok(rosa.changes.some((c) => c.id === 'green' && c.from === 'bad' && c.to === 'low'));
  // A tree is a smaller step that stays "bad", shown as progress rather than nothing.
  const tree = propPreview(town, hs, 'tree', { i: 5, j: -1 }).homes[0].changes.find((c) => c.id === 'green');
  assert.ok(tree.value[1] > tree.value[0] && tree.from === 'bad' && tree.to === 'bad');
  assert.match(previewLines(propPreview(town, hs, 'tree', { i: 5, j: -1 }), () => 'Rosa’s home')[0], /green space 0% → \d+% \(bad\)/);
  // Props alone never make green space good: a statue covering the whole plot stops at the cap.
  const statue = propPreview(town, hs, 'statue', { i: 5, j: -1 }).homes[0].changes.find((c) => c.id === 'green');
  assert.equal(statue.to, 'low');
  // Moving an existing prop replaces it rather than adding a second one.
  const placed = placeProp(town, 'tree', { i: 8, j: 10 });
  assert.equal(withProp(placed, 'tree', { i: 5, j: -1 }, placed.props[0].id).props.length, 1);
});

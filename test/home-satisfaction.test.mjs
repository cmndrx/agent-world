import assert from 'node:assert/strict';
import { test } from 'node:test';
import { emptyTown, placeCivic, placeHome } from '../shared/town.mjs';
import { buildInfluence } from '../shared/town-influence.mjs';
import { SERVICE_NEEDS, homeSatisfaction, needLevel, townSatisfaction, venuesForInterest } from '../shared/home-satisfaction.mjs';

const HOME = { i: 2, j: -2, rot: 0 }; // north of Main Street, facing it
const town = (tier, ...civic) => {
  let t = placeHome(emptyTown(), '/p', HOME);
  for (const [kind, at] of civic) t = placeCivic(t, kind, at, { tier: Infinity });
  return { ...t, tier: { current: tier } };
};
const residents = (...interestIds) => [{ project: '/p', residentAgentIds: ['rosa'], characters: [{ id: 'rosa', name: 'Rosa', interestIds }] }];
const sat = (t, ...interests) => townSatisfaction(t, residents(...interests)).get('/p');
const need = (s, id) => s.needs.find((n) => n.id === id);

test('levels: good at or above high, bad below low, low in between', () => {
  assert.equal(needLevel(0.7, { low: 0.3, high: 0.7 }), 'good');
  assert.equal(needLevel(0.5, { low: 0.3, high: 0.7 }), 'low');
  assert.equal(needLevel(0.29, { low: 0.3, high: 0.7 }), 'bad');
});

test('a new town at tier 1 asks only for fire cover and green space', () => {
  const s = sat(town(1));
  assert.deepEqual(s.needs.map((n) => n.id), ['fire', 'green']);
  assert.equal(s.worst.id, 'fire');
  assert.equal(s.worst.hint, 'No fire station in range');
  assert.equal(s.score, 0);
});

test('needs switch on as their buildings unlock, and placed buildings always count', () => {
  const ids = (s) => s.needs.filter((n) => n.kind === 'service').map((n) => n.id);
  assert.deepEqual(ids(sat(town(1))), ['fire', 'green']);
  assert.deepEqual(ids(sat(town(2))), ['fire', 'police', 'education', 'green']);
  assert.deepEqual(ids(sat(town(4))), ['fire', 'police', 'education', 'health', 'garbage', 'green']);
  assert.deepEqual(ids(sat(town(6))), SERVICE_NEEDS.map((n) => n.id));
  // A hospital placed above the town's tier still makes health a need it meets.
  const placed = sat(town(1, ['hospital', { i: 5, j: 2, rot: 2 }]));
  assert.ok(need(placed, 'health'));
  assert.equal(need(placed, 'health').level, 'good');
});

test('distance decides service levels and hints name the fix', () => {
  const near = sat(town(2, ['fire_station', { i: 2, j: 2, rot: 2 }]));
  assert.equal(need(near, 'fire').level, 'good');
  assert.equal(need(near, 'fire').hint, 'Fire cover in range');
  const far = sat(town(2, ['fire_station', { i: 13, j: 2, rot: 2 }]));
  assert.equal(need(far, 'fire').value, 0);
  assert.equal(need(far, 'fire').hint, 'No fire station in range');
  const park = sat(town(1, ['park', { i: 6, j: 2, rot: 2 }]));
  assert.ok(need(park, 'green').value > 0 && need(park, 'green').level !== 'good');
});

test('nuisance appears only when it reaches the home and lowers quiet', () => {
  assert.equal(need(sat(town(6)), 'quiet'), undefined);
  const s = sat(town(6, ['city_dump', { i: 2, j: 2, rot: 2 }]));
  const quiet = need(s, 'quiet');
  assert.ok(quiet && quiet.value < 1);
  assert.equal(quiet.kind, 'quiet');
  assert.equal(need(s, 'garbage').level, 'good', 'the same dump still collects garbage');
});

test('venue interests become needs once a serving venue is available; home interests never do', () => {
  assert.ok(venuesForInterest('arcade_games').includes('arcade'));
  const locked = sat(town(1), 'arcade_games', 'reading');
  assert.equal(locked.needs.filter((n) => n.kind === 'interest').length, 0);
  const wanted = sat(town(2), 'arcade_games', 'reading');
  const arcade = need(wanted, 'interest:rosa:arcade_games');
  assert.equal(arcade.level, 'bad');
  assert.equal(arcade.hint, 'Rosa wants an arcade nearby');
  assert.equal(wanted.needs.filter((n) => n.kind === 'interest').length, 1);
  const met = sat(town(2, ['arcade', { i: 5, j: 2, rot: 2 }]), 'arcade_games');
  assert.equal(need(met, 'interest:rosa:arcade_games').level, 'good');
  assert.match(need(met, 'interest:rosa:arcade_games').hint, /Rosa enjoys arcade games nearby/i);
});

test('the worst need is the most urgent level first, then the least progress; the score is the weakest progress', () => {
  // Fire is bad (no station); green is low (park two tiles away) even though its value may be lower than fire's.
  const s = sat(town(2, ['park', { i: 6, j: 2, rot: 2 }]));
  assert.equal(s.worst.level, 'bad');
  assert.equal(s.level, 'bad');
  const all = sat(town(1, ['park', { i: 2, j: 2, rot: 2 }], ['fire_station', { i: 6, j: 2, rot: 2 }]));
  assert.ok(['good', 'low'].includes(all.level));
  assert.equal(all.score, Math.round(Math.min(...all.needs.map((n) => n.progress)) * 100));
  for (const n of all.needs) assert.equal(n.progress, Math.min(1, n.value / n.target));
});

test('only active residents count, unplaced homes are skipped and a home with no needs is content', () => {
  const t = town(2);
  const hs = [{ project: '/p', residentAgentIds: ['eli'], characters: [{ id: 'rosa', name: 'Rosa', interestIds: ['arcade_games'] }, { id: 'eli', name: 'Eli', interestIds: [] }] }];
  assert.equal(townSatisfaction(t, hs).get('/p').needs.filter((n) => n.kind === 'interest').length, 0);
  const unplaced = { ...t, homes: [{ ...t.homes[0], i: null, j: null }] };
  assert.equal(townSatisfaction(unplaced, hs).size, 0);
  const grid = buildInfluence(emptyTown());
  assert.deepEqual(homeSatisfaction({ grid, home: { i: 2, j: -2, rot: 0 }, tier: 0 }), { score: 100, level: 'good', needs: [], worst: null });
});

test('households may be a Map, an array or an object, and the town is never modified', () => {
  const t = town(2, ['arcade', { i: 5, j: 2, rot: 2 }]);
  const before = JSON.stringify(t);
  const list = residents('arcade_games');
  const a = townSatisfaction(t, list).get('/p');
  const b = townSatisfaction(t, new Map([['/p', list[0]]])).get('/p');
  const c = townSatisfaction(t, { '/p': list[0] }).get('/p');
  assert.deepEqual(a, b); assert.deepEqual(a, c);
  assert.equal(JSON.stringify(t), before);
});

test('a home whose every need is good scores 100, whatever each need’s own target', () => {
  // Fire station and park right by the home: fire cover 0.71 (target 0.7) and green space 0.59 (target 0.45).
  const s = sat(town(1, ['park', { i: 2, j: 2, rot: 2 }], ['fire_station', { i: 5, j: 2, rot: 2 }]));
  assert.ok(s.needs.every((n) => n.level === 'good'));
  assert.equal(s.score, 100);
  assert.ok(need(s, 'green').value < 0.7, 'raw green space is well below 0.7 yet counts fully');
});

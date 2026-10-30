// Phase 6: services and venues reach homes along the streets (docs/TOWN_SIM_PLAN.md).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { addRoad, emptyTown, entranceTile, key, placeCivic, placeHome, streetDistances } from '../shared/town.mjs';
import { INFLUENCE_RULES, STREET_REACH_EXTRA, streetLimit } from '../shared/town-influence.mjs';
import { streetReach, townSatisfaction } from '../shared/home-satisfaction.mjs';
import { metVenues } from '../shared/venue-visits.mjs';
import { buildInfluence, footprintInfluence, influenceAt } from '../shared/town-influence.mjs';
import { heatColor, heatPixels, streetAccess, streetAwareLayer } from '../shared/town-preview.mjs';

const HOME = { i: 2, j: -2, rot: 0 }; // north of Main Street, its entrance street tile is (3, 1)
// A back street (j 4) that joins Main Street only far east, at i 14.
const backStreet = () => addRoad(placeHome(emptyTown(), '/a', HOME), { i: 14, j: 1 }, { i: 0, j: 4 }, { bend: 'z' });
const households = [{ project: '/a', characters: [{ id: 'rosa', name: 'Rosa', interestIds: ['arcade_games'] }] }];
const sat = (town, tier = 2) => townSatisfaction({ ...town, tier: { current: tier } }, households).get('/a');
const need = (s, id) => s.needs.find((n) => n.id === id);

test('street distances count tiles along connected streets', () => {
  const t = backStreet();
  const d = streetDistances(t, { i: 3, j: 1 });
  assert.equal(d.get(key(3, 1)), 0);
  assert.equal(d.get(key(14, 1)), 11);
  assert.equal(d.get(key(14, 4)), 14);
  assert.equal(d.get(key(3, 4)), 25);
  assert.equal(streetDistances(t, { i: 30, j: 30 }).size, 0, 'off the network: nothing reachable');
});

test('a building’s street limit is its longest service reach plus 4, and upgrades extend it', () => {
  assert.equal(STREET_REACH_EXTRA, 4);
  const fire = { kind: 'fire_station', i: 0, j: 0, rot: 0 };
  assert.equal(streetLimit(fire), INFLUENCE_RULES.fire_station[0].reach + 4);
  assert.equal(streetLimit({ ...fire, upgrade: 3 }), INFLUENCE_RULES.fire_station[0].reach + 4 + 4);
  assert.equal(streetLimit({ kind: 'city_dump', i: 0, j: 0, rot: 0 }), INFLUENCE_RULES.city_dump[0].reach + 4, 'the smell does not count');
  assert.equal(streetLimit({ kind: 'toString', i: 0, j: 0 }), 0);
});

test('close as the crow flies but far by street: no cover until a connecting street is built', () => {
  // The fire station sits right behind Main Street, facing the back street (entrance at 3, 4).
  let town = placeCivic(backStreet(), 'fire_station', { i: 2, j: 2, rot: 0 }, { tier: 9 });
  assert.deepEqual(entranceTile(town.civic[0]), { i: 3, j: 4 });
  const far = sat(town);
  assert.equal(need(far, 'fire').value, 0);
  assert.equal(need(far, 'fire').hint, 'Fire station is 25 street tiles away · add a connecting street');
  assert.deepEqual([...streetReach(town, town.homes[0]).far.entries()], [['fire_station', { distance: 25, limit: 10 }]]);
  // A three-tile link between the streets brings it within reach.
  town = addRoad(town, { i: 6, j: 1 }, { i: 6, j: 4 });
  const near = sat(town);
  assert.equal(streetReach(town, town.homes[0]).far.size, 0);
  assert.equal(need(near, 'fire').level, 'good');
});

test('noise and smell still travel through the air from a building too far by street', () => {
  // The dump is 3 tiles deep: a back street at j 5 leaves room for it right behind Main Street.
  const deeper = addRoad(placeHome(emptyTown(), '/a', HOME), { i: 14, j: 1 }, { i: 0, j: 5 }, { bend: 'z' });
  const town = placeCivic(deeper, 'city_dump', { i: 2, j: 2, rot: 0 }, { tier: 9 });
  const s = sat(town, 4);
  assert.equal(need(s, 'garbage').value, 0, 'no garbage pickup by street');
  assert.ok(need(s, 'quiet') && need(s, 'quiet').value < 1, 'but the smell reaches the home');
});

test('venues too far by street meet no interest, say why, and send nobody visiting', () => {
  let town = placeCivic(backStreet(), 'arcade', { i: 3, j: 2, rot: 0 }, { tier: 9 });
  const s = sat(town);
  const arcade = need(s, 'interest:rosa:arcade_games');
  assert.equal(arcade.level, 'bad');
  assert.match(arcade.hint, /^Rosa: arcade is \d+ street tiles away · add a connecting street$/);
  assert.deepEqual(metVenues(s, 'rosa'), []);
  town = addRoad(town, { i: 6, j: 1 }, { i: 6, j: 4 });
  assert.deepEqual(metVenues(sat(town), 'rosa'), ['arcade']);
});

test('the coverage heatmap is street-aware: it matches what each home feels, and a link street lights it up', () => {
  let town = placeCivic(backStreet(), 'fire_station', { i: 2, j: 2, rot: 0 }, { tier: 9 });
  const grid = buildInfluence(town);
  const idx = (i, j) => (j - grid.j0) * grid.w + (i - grid.i0);
  const access = streetAccess(town, grid);
  assert.deepEqual(access[idx(2, -2)], { i: 3, j: 1 }, 'home tiles use the home entrance');
  assert.deepEqual(access[idx(3, 6)], { i: 3, j: 4 }, 'other tiles use the nearest connected street');
  const fire = streetAwareLayer(town, 'fire', { grid });
  // Straight-line cover reaches the home, but street-aware heat over it is empty, like its fire need.
  assert.ok(footprintInfluence(grid, 'fire', town.homes[0]).mean > 0);
  for (const [i, j] of [[2, -2], [3, -1], [4, 0]]) assert.equal(fire[idx(i, j)], 0, `${i},${j}`);
  // Tiles served from the back street keep the full straight-line value.
  assert.equal(fire[idx(3, 6)], influenceAt(grid, 'fire', 3, 6));
  const { px } = heatPixels(town, 'fire', { grid });
  assert.deepEqual([...px.slice(idx(3, -1) * 4, idx(3, -1) * 4 + 4)], [0, 0, 0, 0]);
  assert.deepEqual([...px.slice(idx(3, 6) * 4, idx(3, 6) * 4 + 4)], heatColor('cover', influenceAt(grid, 'fire', 3, 6)));
  assert.equal(streetAwareLayer(town, 'nuisance', { grid }), grid.layers.nuisance, 'noise and smell unchanged');
  // With the link street the home's tiles light up again.
  town = addRoad(town, { i: 6, j: 1 }, { i: 6, j: 4 });
  const linked = streetAwareLayer(town, 'fire');
  assert.ok(linked[idx(3, -1)] > 0);
  assert.equal(linked[idx(3, -1)], influenceAt(buildInfluence(town), 'fire', 3, -1));
});

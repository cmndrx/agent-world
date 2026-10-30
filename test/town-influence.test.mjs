import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BUILDABLE, CIVIC_KINDS, RECREATION_KINDS, emptyTown, homeTiles } from '../shared/town.mjs';
import {
  CURVES, INFLUENCE_LAYERS, INFLUENCE_RULES, buildInfluence, footprintInfluence, influenceAt, influenceStamps,
  stampValue, venueLayer,
} from '../shared/town-influence.mjs';

const townWith = (...civic) => ({ ...emptyTown(), civic });
const at = (kind, i, j, rot = 0) => ({ id: `${kind}-${i}-${j}`, kind, i, j, rot });

test('every civic building and venue has stamps on known layers, and every venue has its own layer', () => {
  for (const kind of [...CIVIC_KINDS, ...RECREATION_KINDS]) {
    assert.ok(INFLUENCE_RULES[kind]?.length, `${kind} has stamps`);
    for (const s of INFLUENCE_RULES[kind]) {
      assert.ok(INFLUENCE_LAYERS[s.layer], `${kind} stamps a known layer (${s.layer})`);
      assert.ok(CURVES[s.curve], `${kind} uses a known curve`);
      assert.ok(s.amount > 0 && s.amount <= 1 && Number.isInteger(s.reach) && s.reach >= 0);
    }
  }
  for (const kind of RECREATION_KINDS) {
    assert.equal(INFLUENCE_LAYERS[venueLayer(kind)].venue, kind);
    assert.ok(INFLUENCE_RULES[kind].some((s) => s.layer === venueLayer(kind)));
  }
});

test('homes, unplaced buildings and unknown kinds stamp nothing', () => {
  assert.deepEqual(influenceStamps({ id: 'h', project: 'p', i: 2, j: 4, rot: 0 }), []);
  assert.deepEqual(influenceStamps({ kind: 'fire_station', i: null, j: null }), []);
  assert.deepEqual(influenceStamps(at('toString', 2, 4)), []);
  const grid = buildInfluence(townWith(at('toString', 2, 4), { kind: 'fire_station', i: null, j: null, rot: 0 }));
  for (const layer of Object.values(grid.layers)) assert.ok(layer.every((v) => v === 0));
});

test('the footprint gets the full amount and the value falls off with distance to zero past reach', () => {
  const station = at('fire_station', 4, 6);
  const grid = buildInfluence(townWith(station));
  const [s] = INFLUENCE_RULES.fire_station;
  for (const [i, j] of homeTiles(station)) assert.equal(influenceAt(grid, 'fire', i, j), s.amount);
  // Walk east from the footprint's east edge (fire station is 3 × 2 at rot 0: i 4…6).
  const values = [];
  for (let d = 0; d <= s.reach + 2; d++) values.push(influenceAt(grid, 'fire', 6 + d, 6));
  for (let d = 1; d < values.length; d++) assert.ok(values[d] <= values[d - 1], `non-increasing at ${d}`);
  assert.ok(values[s.reach] > 0, 'the last tile within reach still has cover');
  assert.equal(values[s.reach + 1], 0, 'nothing past reach');
  assert.ok(Math.abs(values[1] - stampValue(s, 1)) < 1e-6);
});

test('distance is straight-line to the nearest footprint edge, so cover is round rather than square', () => {
  const grid = buildInfluence(townWith(at('fire_station', 4, 6)));
  const reach = INFLUENCE_RULES.fire_station[0].reach;
  // Diagonally from the north-east corner (6, 6): straight 6 tiles east is in reach, 5 east + 5 north is not.
  assert.ok(influenceAt(grid, 'fire', 6 + reach, 6) > 0);
  assert.equal(influenceAt(grid, 'fire', 6 + 5, 6 - 5), 0);
});

test('rotation turns the footprint the stamp starts from', () => {
  const flat = buildInfluence(townWith(at('school', 2, 6, 0))); // 4 × 3
  const turned = buildInfluence(townWith(at('school', 2, 6, 1))); // 3 × 4
  assert.equal(influenceAt(flat, 'education', 5, 6), 1); // inside the 4-wide footprint
  assert.ok(influenceAt(turned, 'education', 5, 6) < 1); // one tile outside the 3-wide footprint
  assert.equal(influenceAt(turned, 'education', 4, 9), 1); // inside the 4-deep footprint
});

test('max layers keep the strongest stamp; sum layers add up and stay within 1', () => {
  const one = buildInfluence(townWith(at('school', 2, 6)));
  const both = buildInfluence(townWith(at('school', 2, 6), at('library', 7, 6)));
  for (let i = BUILDABLE.i0; i <= BUILDABLE.i1; i++) {
    for (let j = BUILDABLE.j0; j <= BUILDABLE.j1; j++) {
      const v = influenceAt(both, 'education', i, j);
      assert.ok(v >= influenceAt(one, 'education', i, j) && v <= 1);
    }
  }
  const dump = at('city_dump', 2, 6), plant = at('power_plant', 6, 6);
  const sumGrid = buildInfluence(townWith(dump, plant));
  const dumpOnly = buildInfluence(townWith(dump)), plantOnly = buildInfluence(townWith(plant));
  const [i, j] = [6, 7]; // inside the plant, within the dump's nuisance reach
  const expected = Math.min(1, influenceAt(dumpOnly, 'nuisance', i, j) + influenceAt(plantOnly, 'nuisance', i, j));
  assert.ok(influenceAt(dumpOnly, 'nuisance', i, j) > 0);
  assert.ok(Math.abs(influenceAt(sumGrid, 'nuisance', i, j) - expected) < 1e-6);
  for (const v of sumGrid.layers.nuisance) assert.ok(v >= 0 && v <= 1);
});

test('stamps are clipped to buildable land and lookups off the grid read 0', () => {
  const grid = buildInfluence(townWith(at('power_plant', BUILDABLE.i1 - 3, BUILDABLE.j1 - 3)));
  assert.equal(grid.w, BUILDABLE.i1 - BUILDABLE.i0 + 1);
  assert.equal(grid.h, BUILDABLE.j1 - BUILDABLE.j0 + 1);
  assert.equal(influenceAt(grid, 'power', BUILDABLE.i1 + 1, BUILDABLE.j1), 0);
  assert.equal(influenceAt(grid, 'power', BUILDABLE.i0 - 1, BUILDABLE.j0), 0);
  assert.equal(influenceAt(grid, 'no-such-layer', 0, 0), 0);
  assert.equal(influenceAt(grid, 'power', BUILDABLE.i1, BUILDABLE.j1), 1);
});

test('the grid does not depend on placement order and building it leaves the town untouched', () => {
  const civic = [at('park', 0, 6), at('city_dump', 8, 9), at('fire_station', 4, 3), at('arcade', 12, 6)];
  const town = townWith(...civic);
  const before = JSON.stringify(town);
  const a = buildInfluence(town);
  const b = buildInfluence(townWith(...[...civic].reverse()));
  assert.equal(JSON.stringify(town), before);
  for (const name of Object.keys(INFLUENCE_LAYERS)) assert.deepEqual([...a.layers[name]], [...b.layers[name]], name);
});

test('footprint influence reports covered share, mean and strongest tile for a home', () => {
  const grid = buildInfluence(townWith(at('arcade', 0, 6)));
  const reach = INFLUENCE_RULES.arcade[0].reach;
  const near = { project: 'p', i: 2, j: 6, rot: 0 }; // touches the 2 × 2 arcade's east edge
  const far = { project: 'q', i: 1 + reach + 1, j: 6, rot: 0 }; // west column of this home is exactly past reach
  const layer = venueLayer('arcade');
  assert.deepEqual(footprintInfluence(grid, layer, near), { covered: 1, mean: 1, max: 1 });
  const edge = footprintInfluence(grid, layer, { project: 'r', i: 1 + reach - 1, j: 6, rot: 0 });
  assert.ok(edge.covered > 0 && edge.covered < 1, 'a home straddling the edge is partly covered');
  assert.deepEqual(footprintInfluence(grid, layer, far), { covered: 0, mean: 0, max: 0 });
});

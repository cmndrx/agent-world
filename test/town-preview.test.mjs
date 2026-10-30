import assert from 'node:assert/strict';
import { test } from 'node:test';
import { emptyTown, placeCivic, placeHome } from '../shared/town.mjs';
import { buildInfluence, influenceAt } from '../shared/town-influence.mjs';
import { townSatisfaction } from '../shared/home-satisfaction.mjs';
import {
  HEAT_LAYERS, SATISFACTION_COLORS, heatColor, heatLayer, heatPixels, placementPreview, previewHeadline, previewLines,
  primaryLayer, withBuilding,
} from '../shared/town-preview.mjs';

const base = (tier = 6) => ({ ...placeHome(placeHome(emptyTown(), '/a', { i: 2, j: -2, rot: 0 }), '/b', { i: 10, j: -2, rot: 0 }), tier: { current: tier } });
const households = [
  { project: '/a', residentAgentIds: ['rosa'], characters: [{ id: 'rosa', name: 'Rosa', interestIds: ['arcade_games'] }] },
  { project: '/b', residentAgentIds: ['eli'], characters: [{ id: 'eli', name: 'Eli', interestIds: [] }] },
];
const name = (p) => ({ '/a': 'Rosa’s home', '/b': 'Eli’s home' }[p]);

test('the picker lists satisfaction, every service, noise and every venue once, and primary layers match', () => {
  const ids = HEAT_LAYERS.map((l) => l.id);
  assert.equal(new Set(ids).size, ids.length);
  assert.equal(ids[0], 'satisfaction');
  for (const id of ['fire', 'police', 'education', 'health', 'garbage', 'water', 'power', 'beauty', 'nuisance', 'venue:arcade']) assert.ok(heatLayer(id), id);
  assert.equal(primaryLayer('fire_station'), 'fire');
  assert.equal(primaryLayer('arcade'), 'venue:arcade');
  assert.equal(primaryLayer('toString'), null);
});

test('heat colours: transparent at zero, deeper and more opaque with value, satisfaction by level', () => {
  assert.deepEqual(heatColor('cover', 0), [0, 0, 0, 0]);
  const weak = heatColor('cover', 0.1), strong = heatColor('cover', 1);
  assert.ok(strong[3] > weak[3]);
  assert.ok(strong[0] + strong[1] + strong[2] < weak[0] + weak[1] + weak[2], 'stronger is darker');
  assert.notDeepEqual(heatColor('nuisance', 0.5).slice(0, 3), heatColor('cover', 0.5).slice(0, 3));
  assert.deepEqual(heatColor('satisfaction', 'bad').slice(0, 3), SATISFACTION_COLORS.bad);
  assert.deepEqual(heatColor('satisfaction', undefined), [0, 0, 0, 0]);
});

test('heat pixels follow the influence grid tile for tile, and satisfaction paints only home tiles', () => {
  const town = placeCivic(base(), 'fire_station', { i: 4, j: 2, rot: 2 }, { tier: 10 });
  const grid = buildInfluence(town);
  const { px, w, h, i0, j0 } = heatPixels(town, 'fire', { grid });
  assert.equal(px.length, w * h * 4);
  for (const [i, j] of [[5, 3], [5, 9], [20, 15]]) {
    const k = ((j - j0) * w + (i - i0)) * 4;
    assert.deepEqual([...px.slice(k, k + 4)], heatColor('cover', influenceAt(grid, 'fire', i, j)), `${i},${j}`);
  }
  const sat = townSatisfaction(town, households);
  const s = heatPixels(town, 'satisfaction', { grid, satisfaction: sat });
  const at = (i, j) => [...s.px.slice(((j - s.j0) * s.w + (i - s.i0)) * 4, ((j - s.j0) * s.w + (i - s.i0)) * 4 + 4)];
  assert.deepEqual(at(3, -1), heatColor('satisfaction', sat.get('/a').level));
  assert.deepEqual(at(7, 6), [0, 0, 0, 0]);
  assert.ok(heatPixels(town, 'no-such-layer').px.every((v) => v === 0));
});

test('withBuilding adds or moves a building without touching the town', () => {
  const town = placeCivic(base(), 'park', { i: 2, j: 2, rot: 2 }, { tier: 10 });
  const before = JSON.stringify(town);
  const moved = withBuilding(town, 'park', { i: 12, j: 2, rot: 2 });
  assert.equal(moved.civic.filter((c) => c.kind === 'park').length, 1);
  assert.equal(moved.civic.find((c) => c.kind === 'park').i, 12);
  assert.equal(moved.civic.find((c) => c.kind === 'park').id, town.civic[0].id);
  assert.equal(withBuilding(town, 'arcade', { i: 6, j: 2, rot: 2 }).civic.length, 2);
  assert.equal(JSON.stringify(town), before);
});

test('preview lists homes a placement helps, with need changes and scores, and leaves far homes out', () => {
  const town = base(2); // fire, police, education, green and arcade are needs; nothing placed yet
  const p = placementPreview(town, households, 'fire_station', { i: 2, j: 2, rot: 2 });
  const rosa = p.homes.find((h) => h.project === '/a');
  assert.ok(rosa, 'the near home changes');
  assert.ok(rosa.changes.some((c) => c.id === 'fire' && c.from === 'bad' && c.to === 'good'));
  assert.ok(rosa.better >= 1 && p.helped >= 1);
  assert.equal(p.homes.find((h) => h.project === '/b'), undefined, 'a home 8 tiles away keeps its needs');
  assert.match(previewHeadline(p), /Helps 1 home/);
  assert.match(previewLines(p, name)[0], /^Rosa’s home: fire cover bad → good · \d+ → \d+$/);
});

test('preview reports a nuisance that makes a home worse and a venue that meets an interest', () => {
  const town = placeCivic(placeCivic(base(6), 'fire_station', { i: 2, j: 2, rot: 2 }, { tier: 10 }), 'park', { i: 6, j: 2, rot: 2 }, { tier: 10 });
  // A dump on a real plot facing Main Street (one behind other buildings, with no street, would serve nobody).
  const dump = placementPreview(town, households, 'city_dump', { i: 9, j: 2, rot: 2 });
  assert.ok(dump.homes.length >= 1);
  assert.equal(placementPreview(town, households, 'city_dump', { i: 2, j: 5, rot: 2 }).homes.length, 0, 'an unconnected dump changes nothing');
  const arcade = placementPreview(town, households, 'arcade', { i: 5, j: 2, rot: 2 });
  const rosa = arcade.homes.find((h) => h.project === '/a');
  assert.ok(rosa.changes.some((c) => c.id === 'interest:rosa:arcade_games' && c.from === 'bad' && c.to === 'good'));
  assert.equal(previewHeadline({ homes: [], helped: 0, hurt: 0 }), 'No home changes');
  const many = { homes: Array.from({ length: 5 }, (_, i) => ({ project: '/a', changes: [], before: { score: 1 }, after: { score: 2 } })) };
  assert.equal(previewLines(many, name).at(-1), '+2 more homes');
});

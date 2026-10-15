import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  BUILDABLE, MAIN_STREET, addRoad, checkPlacement, connectedRoads, eligiblePlots, emptyTown, entranceTile, homeTransform, key,
  layoutProblems, localToWorld, migrateRows, nextPermitLevel, permitHint, permitStatus, placeHome, planRoad, planRoadRemoval, projectAllowance,
  removeRoad, renameStreet, retireHome, roadMap, roadShape, worldToLocal, xpForLevel,
} from '../shared/town.mjs';

test('permits: levels 1, 2, 3, 5, 7, 9, 11, 13 grant 1 … 8 projects', () => {
  const expected = { 1: 1, 2: 2, 3: 3, 4: 3, 5: 4, 6: 4, 7: 5, 8: 5, 9: 6, 10: 6, 11: 7, 12: 7, 13: 8, 21: 12 };
  for (const [level, n] of Object.entries(expected)) assert.equal(projectAllowance(Number(level)), n, `level ${level}`);
  assert.deepEqual([1, 2, 3, 4, 5, 6, 7, 8, 9].map(nextPermitLevel), [2, 3, 5, 5, 7, 7, 9, 9, 11]);
  // The existing curve: 100, then +50 per level.
  assert.deepEqual([1, 2, 3, 4, 5].map(xpForLevel), [0, 100, 250, 450, 700]);
});

test('permit status reports active / allowed, the next permit level and the exact XP to it', () => {
  const s = permitStatus(125, 2);
  assert.equal(s.level, 2);
  assert.equal(s.allowed, 2);
  assert.ok(s.atCapacity && !s.overCapacity);
  assert.equal(s.nextLevel, 3);
  assert.equal(s.xpToNext, 125); // 250 − 125
  assert.equal(permitHint(s), 'Next permit at player level 3 · 125 XP to go');
  const l3 = permitStatus(250, 1);
  assert.deepEqual([l3.level, l3.allowed, l3.available, l3.nextLevel, l3.xpToNext], [3, 3, 2, 5, 450]);
  assert.ok(permitStatus(0, 2).overCapacity);
  assert.equal(permitStatus(699, 0).xpToNext, 1);
});

test('placement transforms put the entrance on its street for every rotation', () => {
  for (let rot = 0; rot < 4; rot++) {
    const h = { i: 2, j: 4, rot };
    const door = entranceTile(h);
    // Lot-local (0, 12) is the street centre in front of the gate in every tier.
    const p = localToWorld(h, 0, 12);
    assert.equal(Math.round(p.x), door.i * 8);
    assert.equal(Math.round(p.z), door.j * 8 + 4);
    const back = worldToLocal(h, p.x, p.z);
    assert.ok(Math.abs(back.x) < 1e-9 && Math.abs(back.z - 12) < 1e-9);
  }
  assert.deepEqual(homeTransform({ i: -1, j: -2, rot: 0 }), { x: 0, z: 0, yaw: 0, rot: 0 });
});

test('roads: straight runs, 90° turns, T-junctions and crossroads join one network', () => {
  let town = emptyTown();
  const blocked = planRoad(town, { i: 3, j: 4 }, { i: 6, j: 4 });
  assert.equal(blocked.ok, false);
  assert.match(blocked.reason, /Connect new streets/);
  // A T-junction south off Main Street, then an L that turns east.
  town = addRoad(town, { i: 0, j: 2 }, { i: 0, j: 6 });
  assert.equal(roadShape(roadMap(town), 0, 1).kind, 'tee');
  const l = planRoad(town, { i: 0, j: 6 }, { i: 5, j: 9 }, { bend: 'z' });
  assert.ok(l.ok, l.reason);
  assert.equal(l.segments.length, 2, 'one segment per leg of the turn');
  town = addRoad(town, { i: 0, j: 6 }, { i: 5, j: 9 }, { bend: 'z' });
  assert.equal(roadShape(roadMap(town), 0, 9).kind, 'corner');
  // Crossing an existing street makes a crossroads instead of overlapping it.
  town = addRoad(town, { i: -3, j: 4 }, { i: 3, j: 4 });
  const roads = roadMap(town);
  assert.equal(roadShape(roads, 0, 4).kind, 'cross');
  assert.equal(roads.get(key(0, 4)), town.roads.find((r) => r.i0 === 0 && r.j0 === 2).id, 'the crossing tile keeps its original street');
  assert.deepEqual(layoutProblems(town), []);
  assert.ok(town.roads.every((r) => r.connected));
  // Renaming a street renames every segment drawn with it.
  const street = town.roads.find((r) => r.j0 === 9).streetId;
  town = renameStreet(town, street, 'Harbor Road');
  assert.ok(town.roads.filter((r) => r.streetId === street).every((r) => r.name === 'Harbor Road'));
});

test('roads refuse protected civic land, buildable edges and homes, with a reason', () => {
  let town = emptyTown();
  assert.match(planRoad(town, { i: -4, j: 1 }, { i: -4, j: -1 }).reason, /town square/);
  assert.equal(planRoad(town, { i: 10, j: 1 }, { i: 10, j: 0 }).ok, true); // the old downtown strip is open land now
  assert.match(planRoad(town, { i: 0, j: 2 }, { i: 0, j: BUILDABLE.j1 + 1 }).reason, /Outside buildable land/);
  town = placeHome(town, '/p/a', { i: -1, j: -2, rot: 0 });
  const r = planRoad(town, { i: 0, j: 1 }, { i: 0, j: -1 });
  assert.equal(r.ok, false);
  assert.match(r.reason, /a home/);
  assert.equal(r.tiles.find((t) => t.j === -1).state, 'blocked');
});

test('homes need buildable land, no overlap and an entrance on a connected street', () => {
  let town = emptyTown();
  assert.ok(checkPlacement(town, { i: -1, j: -2, rot: 0 }).ok);
  assert.match(checkPlacement(town, { i: -1, j: -1, rot: 0 }).reason, /overlaps a street/);
  assert.match(checkPlacement(town, { i: -1, j: -2, rot: 2 }).reason, /entrance/);
  assert.ok(checkPlacement(town, { i: 9, j: -2, rot: 0 }).ok);
  assert.match(checkPlacement(town, { i: -4, j: -2, rot: 0 }).reason, /town square/);
  town = placeHome(town, '/p/a', { i: -1, j: -2, rot: 0 });
  assert.match(checkPlacement(town, { i: 0, j: -2, rot: 0 }, { project: '/p/b' }).reason, /another home/);
  // A rotated home facing a side street.
  town = addRoad(town, { i: 5, j: 2 }, { i: 5, j: 8 });
  const side = checkPlacement(town, { i: 6, j: 3, rot: 3 }, { project: '/p/b' });
  assert.ok(side.ok, side.reason);
  assert.deepEqual(side.entrance, { i: 5, j: 4 });
  // Disconnected street: removing the joint later is refused, so build a separate stub by editing directly.
  const island = { ...town, roads: [...town.roads, { id: 'x', streetId: 'x', name: 'Island', i0: 12, j0: 10, i1: 14, j1: 10 }] };
  assert.match(checkPlacement(island, { i: 12, j: 7, rot: 0 }, { project: '/p/c' }).reason, /isn’t connected/);
  const plots = eligiblePlots(town, { project: '/p/b' });
  assert.ok(plots.length > 5);
  assert.ok(plots.every((p) => checkPlacement(town, p, { project: '/p/b' }).ok));
});

test('moving a home preserves its id and other fields; retiring frees its land', () => {
  let town = placeHome(emptyTown(), '/p/a', { i: -1, j: -2, rot: 0 });
  const id = town.homes[0].id;
  town = { ...town, homes: [{ ...town.homes[0], note: 'kept' }] };
  town = addRoad(town, { i: 3, j: 2 }, { i: 3, j: 6 });
  town = placeHome(town, '/p/a', { i: 4, j: 3, rot: 3 });
  assert.equal(town.homes.length, 1);
  assert.equal(town.homes[0].id, id);
  assert.equal(town.homes[0].note, 'kept');
  assert.equal(town.homes[0].rot, 3);
  assert.ok(town.homes[0].connected);
  town = retireHome(town, '/p/a');
  assert.equal(town.homes.length, 0);
  assert.deepEqual(town.retired.map((r) => [r.project, r.i, r.j, r.rot]), [['/p/a', 4, 3, 3]]);
  assert.ok(checkPlacement(town, { i: 4, j: 3, rot: 3 }, { project: '/p/b' }).ok);
});

test('road removal refuses Main Street and anything that cuts off a home, naming the homes', () => {
  let town = addRoad(emptyTown(), { i: 3, j: 2 }, { i: 3, j: 9 });
  town = placeHome(town, '/p/a', { i: 4, j: 6, rot: 3 }); // entrance on (3, 7)
  assert.match(planRoadRemoval(town, { i: 0, j: 1 }, { i: 2, j: 1 }).reason, /Main Street/);
  const cut = planRoadRemoval(town, { i: 3, j: 3 }, { i: 3, j: 4 });
  assert.equal(cut.ok, false);
  assert.deepEqual(cut.affected, ['/p/a']);
  assert.match(cut.reason, /A home would lose its connection to Main Street/);
  // The dead end beyond the home can go; the segment splits and keeps its id on the remaining run.
  const before = town.roads.find((r) => r.i0 === 3).id;
  const ok = planRoadRemoval(town, { i: 3, j: 8 }, { i: 3, j: 9 });
  assert.ok(ok.ok, ok.reason);
  town = removeRoad(town, { i: 3, j: 8 }, { i: 3, j: 9 });
  const remaining = town.roads.find((r) => r.i0 === 3);
  assert.equal(remaining.id, before);
  assert.deepEqual([remaining.j0, remaining.j1], [2, 7]);
  // Removing a middle piece splits the segment in two.
  town = addRoad(town, { i: 3, j: 8 }, { i: 3, j: 12 });
  town = removeRoad(town, { i: 3, j: 10 }, { i: 3, j: 10 });
  assert.equal(town.roads.filter((r) => r.i0 === 3 && r.i1 === 3).length, 3);
  assert.deepEqual(layoutProblems(town), []);
});

test('migrating the row layout keeps order, street names and inactive plots, and connects every row', () => {
  const layout = ['/p/a', null, '/p/b', '/p/c', '/p/old', null, '/p/d'];
  const { town, report } = migrateRows({ layout, streets: { 0: 'High Street', 1: 'Second Avenue' }, active: ['/p/a', '/p/b', '/p/c', '/p/d', '/p/new'] });
  assert.deepEqual(layoutProblems(town), []);
  const at = (p) => { const h = town.homes.find((x) => x.project === p); return [h.i, h.j, h.rot]; };
  assert.deepEqual(at('/p/a'), [-1, -2, 0]);
  assert.deepEqual(at('/p/b'), [5, -2, 0]);
  assert.deepEqual(at('/p/c'), [-1, 2, 0]);
  assert.deepEqual(at('/p/new'), [2, -2, 0], 'new homes fill the first free plot, as the old client did');
  assert.deepEqual(at('/p/d'), [-1, 6, 0]);
  assert.deepEqual(report.retired, ['/p/old']);
  assert.equal(town.retired[0].project, '/p/old');
  assert.equal(town.roads.find((r) => r.id === MAIN_STREET.id).name, 'High Street');
  assert.equal(town.roads.find((r) => r.id === 'road-row-1').name, 'Second Avenue');
  assert.ok(town.homes.every((h) => h.connected), 'every migrated home reaches Main Street');
  const reach = connectedRoads(town);
  assert.ok(reach.has(key(8, 5)) && reach.has(key(0, 9)));
  // Repeatable: the same input gives the same layout.
  assert.deepEqual(migrateRows({ layout, streets: { 0: 'High Street', 1: 'Second Avenue' }, active: ['/p/a', '/p/b', '/p/c', '/p/d', '/p/new'] }).town, town);
  // A plot that can't fit the grid is preserved for repair, not moved.
  const big = migrateRows({ layout: Array.from({ length: 18 }, (_, n) => `/p/${n}`), active: Array.from({ length: 18 }, (_, n) => `/p/${n}`) });
  const repairs = big.town.homes.filter((h) => h.repair);
  assert.ok(repairs.length > 0);
  assert.ok(repairs.every((h) => h.i == null && h.from));
  assert.deepEqual(big.report.repairs.length, repairs.length);
});

test('civic buildings unlock by player level, one of each, on a plot facing a connected street', async () => {
  const { CIVIC, CIVIC_KINDS, civicUnlocked, placeCivic, removeCivic } = await import('../shared/town.mjs');
  assert.equal(CIVIC_KINDS[0], 'fire_station');
  assert.deepEqual(civicUnlocked(1), []);
  assert.deepEqual(civicUnlocked(3), ['fire_station', 'police']);
  assert.equal(civicUnlocked(99).length, Object.keys(CIVIC).length);
  let town = emptyTown();
  assert.throws(() => placeCivic(town, 'hospital', { i: -1, j: -2, rot: 0 }, { level: 5 }), /level 6/);
  assert.throws(() => placeCivic(town, 'castle', { i: -1, j: -2, rot: 0 }, { level: 99 }), /Choose a civic building/);
  assert.throws(() => placeCivic(town, 'fire_station', { i: -1, j: -2, rot: 2 }, { level: 2 }), /entrance/);
  town = placeCivic(town, 'fire_station', { i: -1, j: -1, rot: 0 }, { level: 2 }); // 3 × 2, facing Main Street
  assert.equal(town.civic.length, 1);
  assert.equal(town.civic[0].connected, true);
  // Homes and other buildings can't overlap it; it moves (never duplicates), and a level drop never removes it.
  assert.match(checkPlacement(town, { i: 0, j: -2, rot: 0 }, { project: '/p/a' }).reason, /fire station/);
  town = placeCivic(town, 'fire_station', { i: 2, j: -1, rot: 0 }, { level: 1 });
  assert.equal(town.civic.length, 1);
  assert.equal(town.civic[0].i, 2);
  assert.deepEqual(layoutProblems(town), []);
  town = removeCivic(town, 'fire_station');
  assert.deepEqual(town.civic, []);
  assert.throws(() => removeCivic(town, 'fire_station'), /isn’t in your town/);
});

test('removing a street never cuts a civic building off from Main Street', async () => {
  const { placeCivic } = await import('../shared/town.mjs');
  let town = addRoad(emptyTown(), { i: 4, j: 2 }, { i: 4, j: 8 });
  const { eligiblePlots: plots, entranceTile: door } = await import('../shared/town.mjs');
  const spot = plots(town, { civic: 'library', limit: 400 }).find((p) => p.rot === 3 && door({ kind: 'library', ...p }).i === 4 && door({ kind: 'library', ...p }).j === 3);
  town = placeCivic(town, 'library', spot, { level: 4 }); // entrance west onto the new street
  assert.equal(town.civic[0].connected, true);
  const plan = planRoadRemoval(town, { i: 4, j: 2 }, { i: 4, j: 3 });
  assert.equal(plan.ok, false);
  assert.deepEqual(plan.civic, ['library']);
  assert.match(plan.reason, /library would lose its connection/);
});

test('civic buildings have their own sizes; entrances sit mid-front for every size and turn', async () => {
  const { CIVIC, CIVIC_KINDS, FACING, centeredAt, extents, footprintSize, homeTiles } = await import('../shared/town.mjs');
  const area = (k) => footprintSize({ kind: k }).w * footprintSize({ kind: k }).d;
  assert.ok(area('hospital') > area(null)); // bigger than a home
  assert.ok(area('police') < area(null));
  assert.ok(area('hospital') > area('police'));
  assert.deepEqual(extents({ kind: 'fire_station', rot: 1 }), { ex: 2, ez: 3 });
  for (const k of [null, ...CIVIC_KINDS]) for (let rot = 0; rot < 4; rot++) {
    const tiles = homeTiles({ kind: k, i: 0, j: 0, rot });
    assert.equal(tiles.length, k ? CIVIC[k].size.w * CIVIC[k].size.d : 9);
    const e = entranceTile({ kind: k, i: 0, j: 0, rot });
    const [fx, fz] = FACING[rot];
    assert.ok(!tiles.some(([i, j]) => i === e.i && j === e.j));
    assert.ok(tiles.some(([i, j]) => i === e.i - fx && j === e.j - fz), `${k} ${rot}`);
    const c = centeredAt({ i: 5, j: 5 }, rot, k);
    assert.ok(homeTiles({ kind: k, ...c }).some(([i, j]) => i === 5 && j === 5));
  }
});

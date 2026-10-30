import assert from 'node:assert/strict';
import { test } from 'node:test';
import fs from 'node:fs';
import { addRoad, emptyTown, entranceTile, placeCivic, placeHome, tileCenter, worldToLocal } from '../shared/town.mjs';
import { townSatisfaction } from '../shared/home-satisfaction.mjs';
import { VISIT_RULES, chooseVisit, metVenues, streetRoute } from '../shared/venue-visits.mjs';
import { visitWaypoints } from '../web/src/visits.js';

const HOME = { i: 2, j: -2, rot: 0 };
const town = () => ({ ...placeCivic(placeHome(emptyTown(), '/a', HOME), 'arcade', { i: 6, j: 2, rot: 2 }, { tier: 9 }), tier: { current: 2 } });
const households = [{ project: '/a', residentAgentIds: ['rosa', 'eli'], characters: [{ id: 'rosa', name: 'Rosa', interestIds: ['arcade_games'] }, { id: 'eli', name: 'Eli', interestIds: ['arcade_games'] }] }];
const resident = (o) => ({ project: '/a', id: 'rosa', idle: true, groundFloor: true, away: false, ...o });
const always = () => 0; // random() → 0: passes the chance roll and picks the first option

test('street routes follow connected streets end to end, or are null', () => {
  const t = town();
  const from = entranceTile(t.homes[0]), to = entranceTile(t.civic[0]);
  const route = streetRoute(t, from, to);
  assert.deepEqual(route[0], from); assert.deepEqual(route.at(-1), to);
  for (let n = 1; n < route.length; n++) assert.equal(Math.abs(route[n].i - route[n - 1].i) + Math.abs(route[n].j - route[n - 1].j), 1, 'steps are neighbours');
  assert.equal(streetRoute(t, from, { i: 20, j: 20 }), null);
  // A detour street is used when it is the way there.
  const branched = addRoad(t, { i: 10, j: 1 }, { i: 10, j: 6 });
  assert.ok(streetRoute(branched, from, { i: 10, j: 6 }).some((s) => s.i === 10 && s.j === 4));
});

test('met venues come from good interest needs and name the venue in range', () => {
  const sat = townSatisfaction(town(), households).get('/a');
  assert.deepEqual(metVenues(sat, 'rosa'), ['arcade']);
  assert.deepEqual(metVenues(sat, 'nobody'), []);
  const far = { ...placeCivic(placeHome(emptyTown(), '/a', HOME), 'arcade', { i: 14, j: 2, rot: 2 }, { tier: 9 }), tier: { current: 2 } };
  assert.deepEqual(metVenues(townSatisfaction(far, households).get('/a'), 'rosa'), [], 'an arcade out of reach meets nothing');
});

test('choosing a visit: idle, ground floor, met interest, reachable, one per home, cooldown, daytime, chance', () => {
  const t = town();
  const satisfaction = townSatisfaction(t, households);
  const base = { town: t, satisfaction, now: 1_000_000, random: always };
  const plan = chooseVisit({ ...base, residents: [resident()] });
  assert.equal(plan.venue, 'arcade'); assert.equal(plan.residentId, 'rosa');
  assert.ok(plan.stayMs >= VISIT_RULES.stayMs[0] && plan.stayMs <= VISIT_RULES.stayMs[1]);
  assert.ok(plan.route.length > 1);
  assert.equal(chooseVisit({ ...base, night: true, residents: [resident()] }), null, 'night keeps everyone home');
  assert.equal(chooseVisit({ ...base, random: () => 0.99, residents: [resident()] }), null, 'most checks start nothing');
  assert.equal(chooseVisit({ ...base, residents: [resident({ idle: false })] }), null, 'busy residents stay');
  assert.equal(chooseVisit({ ...base, residents: [resident({ groundFloor: false })] }), null, 'upper floors stay');
  assert.equal(chooseVisit({ ...base, residents: [resident(), resident({ id: 'eli', away: true })] }), null, 'one resident per home at a time');
  const cooling = new Map([['rosa', base.now - VISIT_RULES.cooldownMs + 1]]);
  assert.equal(chooseVisit({ ...base, lastVisit: cooling, residents: [resident()] }), null, 'cooldown after getting home');
  assert.ok(chooseVisit({ ...base, lastVisit: new Map([['rosa', base.now - VISIT_RULES.cooldownMs]]), residents: [resident()] }));
  const noArcade = { ...t, civic: [] };
  assert.equal(chooseVisit({ ...base, town: noArcade, residents: [resident()] }), null);
});

test('waypoints leave by the gate, follow the streets in lot-local space, end inside the venue and come back the same way', () => {
  const t = town();
  const home = t.homes[0], venue = t.civic[0];
  const route = streetRoute(t, entranceTile(home), entranceTile(venue));
  const w = visitWaypoints(home, venue, route);
  assert.deepEqual(w.out.slice(0, 2), [{ x: 0, z: 8.6 }, { x: 0, z: 12 }]);
  const second = worldToLocal(home, tileCenter(route[1].i, route[1].j).x, tileCenter(route[1].i, route[1].j).z);
  assert.ok(Math.abs(w.out[2].x - second.x) < 1e-9 && Math.abs(w.out[2].z - second.z) < 1e-9);
  assert.deepEqual(w.back, w.out.slice(0, -1).reverse());
  assert.ok(Number.isFinite(w.face));
  // The street in front of the gate (local z 12) is the home's entrance street tile.
  const gateStreet = tileCenter(route[0].i, route[0].j), local = worldToLocal(home, gateStreet.x, gateStreet.z);
  assert.ok(Math.abs(local.x) < 1e-9 && Math.abs(local.z - 12) < 1e-9);
});

// Sim.decide / updateVisit / endVisit, extracted the way card-layout tests read sim.js (it needs a browser to import).
const source = fs.readFileSync(new URL('../web/src/sim.js', import.meta.url), 'utf8');
const method = (head) => {
  const start = source.indexOf(`  ${head} {`) + `  ${head} {`.length;
  return source.slice(start, source.indexOf('\n  }\n', start));
};
const updateVisit = new Function('now', method('updateVisit(now)'));
const endVisit = new Function('snap', method('endVisit(snap)'));

test('a visit walks out, stays, walks home and then resumes home life', () => {
  const ended = [];
  const sim = { arrived: true, visit: { phase: 'out', stayMs: 30_000, label: 'arcade', back: [{ x: 1, z: 1 }], face: 1 }, activity: { label: '' },
    stations: { entrance: { x: 0, z: 5 } }, path: [], endVisit, onVisitEnd: (s, v) => ended.push(v) };
  updateVisit.call(sim, 10);
  assert.equal(sim.visit.phase, 'stay'); assert.equal(sim.activity.label, 'At the arcade · simulated'); assert.equal(sim.targetFacing, 1);
  updateVisit.call(sim, 20); assert.equal(sim.visit.phase, 'stay', 'still enjoying it');
  updateVisit.call(sim, 41);
  assert.equal(sim.visit.phase, 'back'); assert.equal(sim.activity.label, 'Walking home · simulated');
  assert.deepEqual(sim.path, [{ x: 1, z: 1 }, { x: 0, z: 5 }]); assert.equal(sim.arrived, false);
  sim.arrived = true; updateVisit.call(sim, 60);
  assert.equal(sim.visit, null); assert.equal(sim.activity, null); assert.equal(ended.length, 1);
});

test('observed work ends a visit at once and puts the resident back home', () => {
  const sim = { visit: { phase: 'stay' }, activity: { label: 'At the arcade' }, path: [{ x: 9, z: 9 }], placed: true, arrived: false, onVisitEnd: null };
  endVisit.call(sim, true);
  assert.deepEqual([sim.visit, sim.activity, sim.path, sim.placed, sim.arrived], [null, null, [], false, true]);
  // decide() keeps a visit going while there is no truth target, and ends it when one appears.
  const decideHead = method('decide()');
  assert.match(decideHead, /if \(this\.visit\) \{\s*if \(!this\.truthTarget\(\)\) return;\s*this\.endVisit\(true\);/);
});

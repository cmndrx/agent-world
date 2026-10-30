// Balance targets for the town simulation (docs/TOWN_SIM_PLAN.md, Phase 7). These pin down the design intent behind
// the tuning tables so later tweaks can't quietly break the loop.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { addRoad, eligiblePlots, emptyTown, placeCivic, placeHome } from '../shared/town.mjs';
import { buildInfluence, footprintInfluence } from '../shared/town-influence.mjs';
import { SERVICE_NEEDS, townSatisfaction } from '../shared/home-satisfaction.mjs';
import { tierStats, tierStatus } from '../shared/town-tiers.mjs';
import { PRIDE_REWARDS, UPGRADE_COSTS, prideBalance, prideMilestones, recordPride } from '../shared/civic-pride.mjs';
import { TOWN_PROPS } from '../shared/town.mjs';

const HOME = { i: 2, j: -2, rot: 0 };
const oneHome = () => placeHome(emptyTown(), '/a', HOME);
const resident = (id, interestIds = []) => ({ id, name: id, interestIds });

test('every provider, placed well, can make its need good for a neighbouring home', () => {
  const base = oneHome(), home = base.homes[0];
  for (const need of SERVICE_NEEDS) {
    for (const kind of need.providers) {
      let best = 0;
      for (const p of eligiblePlots(base, { civic: kind, limit: 80 })) {
        best = Math.max(best, footprintInfluence(buildInfluence(placeCivic(base, kind, p, { tier: 9 })), need.layer, home).mean);
      }
      // A community garden is a smaller green space: it only needs to make green space thin-to-good with help.
      if (kind === 'community_garden') assert.ok(best >= need.low, `${kind} at least lifts green space off "bad" (${best.toFixed(2)})`);
      else assert.ok(best >= need.high, `${kind} can make ${need.id} good (${best.toFixed(2)} ≥ ${need.high})`);
    }
  }
});

test('starter path: one home with a park and a fire station reaches tier 2 and can afford the first upgrade', () => {
  let town = placeCivic(placeCivic(oneHome(), 'park', { i: 2, j: 2, rot: 2 }, { tier: 1 }), 'fire_station', { i: 5, j: 2, rot: 2 }, { tier: 1 });
  const hs = [{ project: '/a', characters: [resident('rosa', ['park_walks'])] }];
  const sat = townSatisfaction({ ...town, tier: { current: 1 } }, hs);
  assert.equal(sat.get('/a').score, 100);
  const status = tierStatus(tierStats(town, hs, sat), 1);
  assert.equal(status.current, 2);
  const { pride } = recordPride(undefined, prideMilestones(sat, status.current));
  assert.ok(prideBalance(pride).balance >= UPGRADE_COSTS[2], `first upgrade affordable (${prideBalance(pride).balance} ≥ ${UPGRADE_COSTS[2]})`);
  assert.ok(prideBalance(pride).balance >= TOWN_PROPS.tree.cost);
});

test('a single-project player reaches tier 3 by recruiting, once tier-2 needs are met', () => {
  // A short side street beside the home gives the library a plot right next to it.
  let town = addRoad(oneHome(), { i: 5, j: 1 }, { i: 5, j: -2 });
  for (const [kind, at] of [['park', { i: 2, j: 2, rot: 2 }], ['fire_station', { i: -1, j: 2, rot: 2 }], ['police', { i: 6, j: 2, rot: 2 }], ['library', { i: 6, j: -2, rot: 3 }]]) town = placeCivic(town, kind, at, { tier: 2 });
  const hs = (n) => [{ project: '/a', characters: Array.from({ length: n }, (_, k) => resident(`r${k}`)) }];
  const at = (n) => { const sat = townSatisfaction({ ...town, tier: { current: 2 } }, hs(n)); return { sat, status: tierStatus(tierStats(town, hs(n), sat), 2) }; };
  const two = at(2), three = at(3);
  assert.ok(two.sat.get('/a').needs.every((n) => n.level !== 'bad'), JSON.stringify(two.sat.get('/a').needs.map((n) => [n.id, n.level, n.value.toFixed(2)])));
  assert.equal(two.status.current, 2, 'two residents are not enough');
  assert.equal(three.status.current, 3, 'three residents open the size gate');
});

test('a fully good home earns enough Civic Pride for a few props, and tiers stay the biggest reward', () => {
  assert.ok(PRIDE_REWARDS.tier > PRIDE_REWARDS.home && PRIDE_REWARDS.home > PRIDE_REWARDS.need);
  assert.ok(UPGRADE_COSTS[3] > UPGRADE_COSTS[2]);
  const cheapest = Math.min(...Object.values(TOWN_PROPS).map((p) => p.cost));
  assert.ok(PRIDE_REWARDS.home >= 2 * cheapest, 'a satisfied home pays for at least two cheap props');
});

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { NavGrid } from '../web/src/nav.js';
import { TIER_PLANS, YARD_Z, doorsOf, frontWallBlocks, planProblems, tierPlan, yardProps } from '../web/src/home-tier-plans.js';
import { FLOORPLANS, floorplanFor } from '../web/src/home-floorplans.js';
import { BUILDING_TIERS, BUILDING_UNLOCK_LEVELS, MAX_LEVEL } from '../shared/progression.mjs';

/** The studio shell and fence as lot.js builds them, plus one tier's own obstacles. */
function navFor(plan, decor = []) {
  const nav = new NavGrid({ x0: -11, z0: -5, x1: 11, z1: 11.5 }, 0.25, 0.25);
  nav.addRect([-7.25, -5.25, -6.95, 5.25]);
  nav.addRect([-7.25, -5.25, 7.25, -4.95]);
  nav.addRect([6.95, -5.25, 7.25, 5.25]);
  for (const [x0, z0, x1, z1] of [[-10.8, YARD_Z, -1.2, YARD_Z], [1.2, YARD_Z, 10.8, YARD_Z], [-10.8, -YARD_Z, -10.8, YARD_Z], [10.8, -YARD_Z, 10.8, YARD_Z]]) {
    nav.addRect([Math.min(x0, x1) - 0.12, Math.min(z0, z1) - 0.12, Math.max(x0, x1) + 0.12, Math.max(z0, z1) + 0.12]);
  }
  for (const r of frontWallBlocks(plan)) nav.addRect(r);
  for (const r of floorplanFor(plan.key).obstacles) nav.addRect(r);
  for (const [, ...r] of yardProps(plan, decor).blocking) nav.addRect(r);
  return nav;
}

const reachable = (nav, from, to) => {
  const seen = nav.reachableFrom(from);
  const cell = nav.nearestFree(...nav.toCell(to.x, to.z), 2);
  return !!cell && !!seen[cell[1] * nav.w + cell[0]];
};

test('eight building tiers unlock at their specified home levels', () => {
  assert.equal(TIER_PLANS.length, BUILDING_TIERS.length);
  TIER_PLANS.forEach((plan, i) => {
    assert.equal(plan.level, i + 1);
    assert.equal(tierPlan(BUILDING_UNLOCK_LEVELS[i]), plan);
    assert.equal(plan.key, BUILDING_TIERS[i].name.toLowerCase().replace(/ /g, '-').replace('-building', ''));
  });
  assert.equal(tierPlan(0).level, 1);
  assert.equal(tierPlan(99).level, 8);
  // Taller tiers really are taller.
  for (let i = 1; i < TIER_PLANS.length; i++) assert.ok(TIER_PLANS[i].height >= TIER_PLANS[i - 1].height);
});

test('plans keep doors on the wall, the gate open and props inside the yard', () => {
  for (const plan of TIER_PLANS) assert.deepEqual(planProblems(plan), [], plan.key);
});

test('every door of every tier can be walked through from the street', () => {
  for (const plan of TIER_PLANS) {
    const nav = navFor(plan);
    const street = { x: 0, z: 10.6 };
    assert.ok(reachable(nav, street, { x: 0, z: 0 }), `${plan.key}: studio reachable`);
    for (const d of doorsOf(plan)) {
      const from = { x: d.x - 0.25, z: 6.3 };
      const path = nav.findPath(from, { x: d.x - 0.25, z: 4.0 });
      let len = 0;
      let a = from;
      for (const b of path || []) len += Math.hypot(b.x - a.x, b.z - a.z), (a = b);
      assert.ok(path && len < 3.2, `${plan.key}: door at ${d.x} is passable (path ${len.toFixed(2)})`);
      assert.ok(reachable(nav, street, from), `${plan.key}: path to the door at ${d.x}`);
    }
    // Front wall obstacles leave exactly one gap per door.
    assert.equal(frontWallBlocks(plan).length, doorsOf(plan).length * 2 + 1);
  }
});

test('landscaping yields to placed decor', () => {
  const plan = tierPlan(1);
  const bed = plan.yard.find(([kind]) => kind === 'vegBed');
  const kept = yardProps(plan, [[4.0, 5.7, 5.6, 6.3]]).blocking;
  assert.ok(!kept.includes(bed));
  assert.equal(kept.length, plan.yard.length - 1);
  assert.equal(yardProps(plan, []).blocking.length, plan.yard.length);
});

const ov = (a, b) => a[0] < b[2] - 1e-6 && a[2] > b[0] + 1e-6 && a[1] < b[3] - 1e-6 && a[3] > b[1] + 1e-6;

test('every tier has its own floor plan that fits the ground floor', () => {
  const signatures = new Set();
  for (const plan of TIER_PLANS) {
    assert.ok(FLOORPLANS[plan.key], `${plan.key} has a floor plan`);
    const fp = floorplanFor(plan.key);
    const pieces = [
      ...fp.partitions.map((r, i) => [`wall ${i}`, r]),
      ...fp.items.filter((it) => it.rect).map((it) => [`${it.kind} at ${it.x},${it.z}`, it.rect]),
      ...fp.desks.map((d, i) => [`desk ${i + 1}`, d.block]),
    ];
    for (const [name, r] of pieces) {
      assert.ok(r[0] >= -6.96 && r[2] <= 6.96 && r[1] >= -4.96 && r[3] <= 4.96, `${plan.key}: ${name} stays inside`);
      for (const f of frontWallBlocks(plan)) assert.ok(!ov(r, f), `${plan.key}: ${name} clears the front wall and door leaves`);
    }
    for (let i = 0; i < pieces.length; i++) for (let j = i + 1; j < pieces.length; j++) {
      if (pieces[i][0].startsWith('wall') && pieces[j][0].startsWith('wall')) continue;
      assert.ok(!ov(pieces[i][1], pieces[j][1]), `${plan.key}: ${pieces[i][0]} overlaps ${pieces[j][0]}`);
    }
    assert.ok(fp.desks.length >= plan.level, `${plan.key}: a desk for every resident slot`);
    signatures.add(JSON.stringify([fp.partitions, fp.items.map((it) => it.kind).sort()]));
  }
  assert.equal(signatures.size, TIER_PLANS.length, 'no two tiers share a floor plan');
});

test('residents can reach every desk and each kind of station from the street', () => {
  for (const plan of TIER_PLANS) {
    const fp = floorplanFor(plan.key, yardProps(plan).blocking.map(([, ...r]) => r));
    const nav = navFor(plan);
    const street = fp.stations.entrance;
    fp.desks.forEach((d, i) => {
      for (const k of ['chair', 'wait', 'visitorWait']) assert.ok(reachable(nav, street, d[k]), `${plan.key}: desk ${i + 1} ${k}`);
      assert.ok(reachable(nav, street, d.guests[0]), `${plan.key}: desk ${i + 1} visitor spot`);
    });
    for (const st of ['bookshelf', 'whiteboard', 'globe', 'rack', 'coffee']) {
      assert.ok(fp.stations[st].some((s) => reachable(nav, street, s)), `${plan.key}: a reachable ${st}`);
    }
    // Couch seats sit inside the couch's footprint; Sims walk to the nearest free cell (sim.js).
    const seat = (s) => { const c = nav.nearestFree(...nav.toCell(s.x, s.z), 4); return !!c && !!nav.reachableFrom(street)[c[1] * nav.w + c[0]]; };
    assert.ok(fp.stations.couch.filter(seat).length >= 3, `${plan.key}: three couch seats for off-duty residents`);
    assert.ok(fp.stations.wander.filter((s) => !s.yard).every((s) => reachable(nav, street, s)), `${plan.key}: indoor strolling spots`);
  }
});

 test('all fifteen home levels have unique reachable work seats at unlocked capacity',()=>{
 for(let level=1;level<=MAX_LEVEL;level++){
  const plan=tierPlan(level),fp=floorplanFor(plan.key,[],level);
  assert.ok(fp.desks.length>=level,`level ${level} seat count`);
  assert.equal(new Set(fp.desks.map(d=>`${d.x},${d.z}`)).size,fp.desks.length);
  const nav=new NavGrid({x0:-11,z0:-5,x1:11,z1:11.5},.25,.25);
  for(const r of [[-7.25,-5.25,-6.95,5.25],[-7.25,-5.25,7.25,-4.95],[6.95,-5.25,7.25,5.25],...frontWallBlocks(plan),...fp.obstacles,...yardProps(plan,[]).blocking.map(([, ...r])=>r)])nav.addRect(r);
  const from={x:0,z:10.6};
  for(const [i,d]of fp.desks.entries())for(const k of ['chair','wait','visitorWait'])assert.ok(reachable(nav,from,d[k]),`level ${level} desk ${i+1} ${k}`);
  for(const [station,spots]of Object.entries(fp.stations))if(station!=='wander'&&station!=='entrance')assert.ok(spots.some(s=>{const c=nav.nearestFree(...nav.toCell(s.x,s.z),station==='couch'?4:2);return c&&nav.reachableFrom(from)[c[1]*nav.w+c[0]];}),`level ${level} ${station} reachable`);
 }
 });

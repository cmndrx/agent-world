import { resourceReason, interestForActivity } from '../shared/interest-care.mjs';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ACTIVITIES } from '../shared/catalogs/activities.js';
import { HOME_ACTIVITIES, planHomeActivity, copyNav, overlaps } from '../web/src/home-activities.js';
import { buildingPlanFor, floorBounds } from '../web/src/home-floors.js';
import { TIER_PLANS } from '../web/src/home-tier-plans.js';
import { TIER_CAPACITY } from '../web/src/home-floors.js';
import { NavGrid } from '../web/src/nav.js';

function fixture(floor,desks=floor.desks) {
  const b=floorBounds(floor.rects);
  const nav=new NavGrid(floor.index?{x0:b.x0-.25,z0:b.z0-.25,x1:b.x1+.25,z1:b.z1+.25}:{x0:-11,z0:-5,x1:11,z1:11.5});
  const deskRects=new Set(floor.desks.map(d=>d.block));
  const solidRects=floor.index ? floor.obstacles : floor.obstacles.filter(r=>!deskRects.has(r)||desks.some(d=>d.block===r));
  for(const r of solidRects)nav.addRect(r);
  const protectedSpots=[...desks.flatMap(d=>[d.chair,d.wait,d.visitorWait,...d.guests]),...(floor.index?floor.landings:[])];
  // Ground plans enter from the street; this fixture starts at the first desk's room.
  return {floor,nav,from:floor.desks[0].chair,protectedSpots,occupied:[],solidRects};
}
test('home scene mappings exactly cover the live catalog without changing venue eligibility',()=>{
  assert.deepEqual(HOME_ACTIVITIES.map(a=>a.id),ACTIVITIES.filter(a=>a.buildingIds.includes('home')).map(a=>a.id));
  assert.equal(HOME_ACTIVITIES.length,19);
  for(const a of HOME_ACTIVITIES){assert.ok(a.mode,a.id);assert.match(a.label,/simulated/);}
  for(const id of ['complete_a_personal_goal','earn_an_award','celebrate_an_achievement','receive_praise'])assert.match(HOME_ACTIVITIES.find(a=>a.id===id).label,/scene|response/);
});
test('inventory placement across eight tiers respects real requirements without portable substitutes',()=>{
  const gaps=[];
  for(const tier of TIER_PLANS){
    const bp=buildingPlanFor(tier.key),floors=bp.floors;
    const seats=bp.seats.slice(0,TIER_CAPACITY[tier.key]);
    for(const a of HOME_ACTIVITIES){
      const plans=floors.map(f=>planHomeActivity({...fixture(f,seats.filter(s=>s.floor===f.index).map(s=>s.desk)),id:a.id}));
      for(const [i,plan] of plans.entries())if(resourceReason(interestForActivity(a.id),{items:floors[i].items,floor:i}))assert.equal(plan,null,a.id);
      for(const [i,p] of plans.entries())if(p){assert.ok(p.rect.every(Number.isFinite));assert.ok(p.def.mode);if(!p.existing)assert.ok(!floors[i].items.some(it=>it.rect&&overlaps(it.rect,p.rect)));}
    }
  }
  assert.deepEqual(gaps,[]);
});
test('occupied stations and blocked rooms decline instead of overlapping or walking through walls',()=>{
  const f=buildingPlanFor('cottage').floors[0],args=fixture(f);
  assert.equal(planHomeActivity({...args,id:'not_a_home_activity'}),null);
  assert.equal(planHomeActivity({...args,id:'read_a_book',occupied:[[-20,-20,20,20]]}),null);
  const nav=copyNav(args.nav,[-20,-20,20,20]);
  assert.equal(planHomeActivity({...args,nav,id:'read_a_book'}),null);
  const first=planHomeActivity({...args,id:'read_a_book'});
  assert.ok(first);
  const second=planHomeActivity({...args,id:'read_a_book',occupied:[first.rect]});
  assert.ok(!second||!overlaps(first.rect,second.rect));
});

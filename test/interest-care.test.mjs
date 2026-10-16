import test from 'node:test';
import assert from 'node:assert/strict';
import {initializeCare,applyCare,advanceCare,pulseCare,applySavedInterests,CARE_ACTIONS,CARE_INTERESTS} from '../shared/care.mjs';
import {careEligibility,validateTelevisions} from '../bridge/care-resources.mjs';
import {resourceReason,INTEREST_CARE} from '../shared/interest-care.mjs';
import {buildingPlanFor} from '../web/src/home-floors.js';
import {tvMounts} from '../shared/tv-mounts.mjs';
import {sanitizeHome} from '../shared/style.mjs';
const resident=()=>{const c={id:'fixture-resident',slot:1,interestIds:['sweets'],happiness:50};initializeCare(c,1000);return c;};
const home=c=>({project:'fixture',characters:[c],residentAgentIds:[c.id]});
const eligibility=c=>careEligibility({home:home(c),character:c,interest:'sweets'});
const start=(c=resident())=>applyCare(c,{id:'fixture-action',action:'sweets',revision:c.care.revision},{now:1000,eligibility:eligibility(c)}).character;
function pulse(c,now,extra={}){const p=c.care.pending;return pulseCare(c,{pendingId:p.id,sequence:p.sequence+1,floor:p.floor,x:p.plan.spot.x,z:p.plan.spot.z,...extra},{now,eligibility:eligibility(c)}).character;}
test('68 reviewed policies; unsupported venues and resources never imply a care action',()=>{
  assert.equal(CARE_INTERESTS.length,68);assert.equal(Object.keys(CARE_ACTIONS).length,15);
  assert.match(resourceReason('cat_companionship',{pet:'bunny'}),/cat/);
  assert.match(resourceReason('cat_companionship',{pet:'cat'}),/not implemented/);
  assert.match(resourceReason('dog_companionship',{pet:'dog'}),/venue/);
  assert.match(resourceReason('aquatic_pets',{items:[{kind:'aquarium'}]}),/not implemented/);
  for(const p of Object.values(INTEREST_CARE))assert.ok(p.activityId);
  for(const id of ['television','bubble_baths','naps','sleeping_in','snacks','reading'])assert.ok(resourceReason(id));
  assert.equal(resourceReason('television',{items:[{kind:'tv',floor:0}],floor:0}),null);
  assert.ok(resourceReason('television',{items:[{kind:'tv',floor:1}],floor:0}));
});
test('validated active scene time rewards once; passive and wall-clock time never reward',()=>{
  let c=start();assert.equal(c.happiness,50);
  assert.equal(advanceCare(c,{now:11000}),false);assert.equal(c.happiness,50);
  for(let i=0;i<=10;i++)c=pulse(c,1100+i*1000);
  assert.equal(c.happiness,55);assert.equal(c.care.pending,null);
  assert.equal(c.care.history.at(-1).delta,5);
  assert.equal(advanceCare(c,{now:999999}),false);
  assert.equal(applyCare(c,{id:'fixture-action',action:'sweets',revision:1},{now:999999}).duplicate,true);
  assert.throws(()=>applyCare(c,{id:'another-action',action:'sweets',revision:c.care.revision},{now:12000,eligibility:eligibility(c)}),/cooling/);
});
test('forged eligibility, progress, duplicate sequence, wrong floors and stale revisions fail atomically',()=>{
  const c=resident(),input={id:'forged-action',action:'sweets',revision:1,eligibility:{plan:{}},activeMs:10000};
  assert.throws(()=>applyCare(c,input,{now:1000}),/validated/);assert.equal(c.care.pending,null);
  let r=start();const before=structuredClone(r);
  assert.throws(()=>pulse(r,2000,{sequence:99}),/invalid/);
  assert.throws(()=>pulse(r,2000,{floor:1}),/reached/);
  assert.throws(()=>pulse(r,2000,{x:999}),/reached/);assert.deepEqual(r,before);
  r=pulse(r,2000);assert.throws(()=>pulse(r,2100,{sequence:1}),/invalid/);
  assert.throws(()=>pulseCare(r,{pendingId:r.care.pending.id,sequence:2},{now:2500,eligibility:{...eligibility(r),layout:'forged'}}),/no longer/);
  assert.throws(()=>applyCare(c,{...input,revision:0}),/Refresh/);
});
test('interruptions, restart, disconnect, cancellation and resource loss give zero happiness',()=>{
  for(const reason of ['busy','restart','unavailable','disconnect','cancel']){
    let c=start();c=pulse(c,2000);
    if(reason==='cancel')c=applyCare(c,{id:'cancel-action',action:'cancel',revision:c.care.revision},{now:3000}).character;
    else advanceCare(c,{now:reason==='disconnect'?5001:3000,[reason]:true});
    assert.equal(c.care.pending,null,reason);assert.equal(c.happiness,50);assert.equal(c.care.cooldowns.sweets,undefined);
  }
});
test('assignment preserves identity, happiness, cooldowns and history; capped completion records delta',()=>{
  let c=resident();const old=structuredClone(c);c=applyCare(c,{id:'preferences-id',action:'interests',revision:1,interestIds:['sweets','board_games','personal_goals']}).character;
  assert.equal(c.id,old.id);assert.equal(c.happiness,old.happiness);assert.deepEqual(c.care.cooldowns,old.care.cooldowns);assert.deepEqual(c.care.history[0],old.care.history[0]);assert.equal(c.care.history.at(-1).delta,0);
  c.happiness=99;c=start(c);for(let i=0;i<=10;i++)c=pulse(c,1100+i*1000);assert.equal(c.happiness,100);assert.equal(c.care.history.at(-1).delta,1);
});
test('uninitialized inactive saved identities change preferences without initializing happiness or care',()=>{
  const c={id:'inactive',slot:8,interestIds:[]},input={action:'interests',id:'inactive-edit',revision:0,interestIds:['sweets','board_games']};
  const next=applySavedInterests(c,input).character;assert.equal(next.happiness,undefined);assert.equal(next.care,undefined);assert.equal(next.id,c.id);
  assert.equal(applySavedInterests(next,input).duplicate,true);
  assert.throws(()=>applySavedInterests(next,{...input,id:'stale-edit'}),/Refresh/);
});
test('actual upper-floor bath is reachable only on its floor and reserves the real fixture exclusively',()=>{
  const chars=Array.from({length:4},(_,i)=>({id:'resident'+i,slot:i+1}));
  const h={project:'fixture',characters:chars};
  const owner=careEligibility({home:h,character:chars[0],level:4,interest:'bubble_baths'});
  assert.ok(owner.reason); // existing ground-floor bath has no safe supported approach
  const upstairs=careEligibility({home:h,character:chars[1],level:4,interest:'bubble_baths'});
  assert.equal(upstairs.reason,null);assert.equal(upstairs.floor,1);assert.equal(upstairs.plan.fixture,'bath');assert.equal(upstairs.plan.existing,true);
  chars[1].care={pending:{floor:1,plan:upstairs.plan}};
  assert.ok(careEligibility({home:h,character:chars[3],level:4,interest:'bubble_baths'}).reason);
});
test('TV placement and fireplace anchor round-trip; forged mounts, overlap and floor violations reject',()=>{
  const f=buildingPlanFor('cottage').floors[0],m=tvMounts(f.items)[0];assert.ok(m);
  const d={id:'tvfixture',item:'fireplace_tv',x:m.x,z:m.z,rot:m.rot,anchor:m.anchor};
  const clean=sanitizeHome({decor:[d]});assert.deepEqual(JSON.parse(JSON.stringify(clean)).decor[0],d);
  validateTelevisions(clean,null,1);
  assert.throws(()=>validateTelevisions({decor:[{...d,anchor:'fireplace:0:0:s'}]},null,1),/mount/);
  assert.throws(()=>validateTelevisions({decor:[d,{...d,id:'tvsecond'}]},null,1),/already/);
  assert.throws(()=>validateTelevisions({decor:[{id:'tvbad',item:'television',x:99,z:0,rot:0}]},null,1),/inside/);
  const bed=f.items.find(i=>i.kind==='bed');assert.throws(()=>validateTelevisions({decor:[{id:'tvbad',item:'television',x:bed.x,z:bed.z,rot:0}]},null,1),/overlaps/);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import '../scripts/test-web-assets.mjs';
import * as THREE from 'three';
const {Sim}=await import('../web/src/sim.js');
import {NavGrid} from '../web/src/nav.js';
import {initializeCare,applyCare,pulseCare} from '../shared/care.mjs';
import {careEligibility} from '../bridge/care-resources.mjs';
import {CarePanel} from '../web/src/care.js';
import {CareFeedback} from '../web/src/care-feedback.js';

function rig() {
  const c={id:'isolated-resident',slot:1,interestIds:['sweets'],happiness:50};initializeCare(c,1000);
  const s=Object.create(Sim.prototype), nav=new NavGrid({x0:-10,z0:-10,x1:10,z1:10});
  const chair={x:0,z:0,face:0},stations={entrance:chair,wander:[chair],bookshelf:[{x:1,z:0,face:0}],coffee:[{x:2,z:0,face:0}],globe:[{x:3,z:0,face:0}],couch:[],doodle:[]};
  Object.defineProperty(s,'state',{value:'off_duty',writable:true});
  Object.assign(s,{character:c,hash:0,pos:new THREE.Vector2(),placed:true,parts:null,needs:{energy:1,fun:1},act:{at:'idle'},lot:{project:'fixture',desk:()=>({floor:0,chair,entrance:chair,guests:[]}),stations,claims:new Map(),homeActivityClaims:new Map(),getNav:()=>nav,building:{floors:[{index:0,items:[],partitions:[],obstacles:[],rooms:[]}]},decor:{items:[],obstacles:[]},desks:[],obstacles:[],levelObstacles:[],deskBlocks:[]}});
  return s;
}
test('pending candy uses its validated station and scene, never a reading shortcut',()=>{
  const s=rig(),h={project:'fixture',characters:[s.character]};
  const e=careEligibility({home:h,character:s.character,interest:'sweets'});
  s.character=applyCare(s.character,{action:'sweets',id:'fixture-candy',revision:1},{now:1000,eligibility:e}).character;
  s.decide();
  assert.equal(s.activity.homeId,'enjoy_candy_or_chocolate');
  assert.equal(s.homePlan.def.mode,'candy');
  assert.deepEqual(s.activity.spot,e.plan.spot);
  assert.equal(s.lot.homeActivityClaims.get(s).floor,0);
});
test('generic coffee and globe coexist fairly with interest scenes without matching interests',()=>{
  const s=rig(),kinds=[];s.character.interestIds=['sweets'];
  s.startHomeActivity=function(id){this.activity={kind:id,flavor:true};return true;};
  for(let i=0;i<24;i++){s.decide();kinds.push(s.activity.kind);}
  assert.ok(kinds.includes('coffee'),JSON.stringify(kinds));
  assert.ok(kinds.includes('globe'),JSON.stringify(kinds));
  assert.ok(kinds.includes('enjoy_candy_or_chocolate'));
  assert.equal(s.character.happiness,50);
  s.truth={state:'editing'};s.state='editing';s.act={at:'desk',pose:'type'};s.decide();
  assert.equal(s.activity.pose,'type');assert.equal(s.activity.flavor,false);
});
test('care rejects a blocked approach despite NavGrid direct fallback and releases reservations',()=>{
  const s=rig(),nav=s.lot.getNav();nav.addRect([.5,-10,1,10]);
  const e=careEligibility({home:{project:'fixture',characters:[s.character]},character:s.character,interest:'sweets'});
  const p={...e.plan,spot:{x:3,z:0,face:0}};
  assert.ok(nav.findPath({x:0,z:0},p.spot).length); // legacy best-effort path API
  assert.equal(s.startHomeActivity(p.def.id,{id:'blocked-care',plan:p,floor:0}),false);
  assert.equal(s.lot.homeActivityClaims.size,0);
});
test('care pulse failures are visible instead of silently retrying',async()=>{
  const s=rig();s.character.care.pending={id:'fixture-pending',sequence:0};s.activity={careId:'fixture-pending'};
  const oldFetch=globalThis.fetch,oldDocument=globalThis.document;
  globalThis.document={hidden:false};globalThis.fetch=async()=>({ok:false,json:async()=>({error:'Care station is no longer available.'})});
  try {s.pulseCareScene(true);await new Promise(r=>setImmediate(r));assert.match(s.careError || '',/no longer available/);}
  finally {globalThis.fetch=oldFetch;globalThis.document=oldDocument;}
});
test('care preempts a generic passive occupant of its reserved station',()=>{
  const s=rig(), e=careEligibility({home:{project:'fixture',characters:[s.character]},character:s.character,interest:'sweets'});
  const other=rig();other.lot=s.lot;other.activity={flavor:true};other.claim(e.plan.spot);
  assert.equal(s.startHomeActivity(e.plan.def.id,{id:'priority-care',plan:e.plan,floor:0}),true);
  assert.equal(other.claimed,null);assert.equal(other.activity,null);
});
test('a fixed care reservation rejects another resident on its floor but not an upper floor',()=>{
  const s=rig(),e=careEligibility({home:{project:'fixture',characters:[s.character]},character:s.character,interest:'sweets'});
  const other=rig();other.lot=s.lot;s.lot.homeActivityClaims.set(other,{...e.plan,floor:0});other.activity={flavor:false};
  assert.equal(s.startHomeActivity(e.plan.def.id,{id:'conflict-care',plan:e.plan,floor:0}),false);
  s.lot.homeActivityClaims.get(other).floor=1;
  assert.equal(s.startHomeActivity(e.plan.def.id,{id:'separate-care',plan:e.plan,floor:0}),true);
  s.stopHomeActivity();assert.equal(s.lot.homeActivityClaims.has(s),false);
});
test('UI request through reserved arrival and client heartbeats completes once; duplicate clicks coalesce',async()=>{
  const s=rig(),home={project:'fixture',characters:[s.character]};let authoritative=s.character,now=1000,posts=0;
  const eligibility=()=>careEligibility({home:{...home,characters:[authoritative]},character:authoritative,interest:'sweets'});
  const status={textContent:''},panel=Object.assign(Object.create(CarePanel.prototype),{sim:s,connected:true,root:{querySelector:()=>status},render(){}});
  const oldFetch=globalThis.fetch,oldDocument=globalThis.document,oldMedia=globalThis.matchMedia;
  globalThis.document={hidden:false};globalThis.matchMedia=()=>({matches:false});s.careFeedback=new CareFeedback(s.character);
  let release;const gate=new Promise(r=>{release=r;});
  globalThis.fetch=async(_url,request)=>{
    posts++;await gate;
    const input=JSON.parse(request.body);
    const result=input.action==='scene'?pulseCare(authoritative,input,{now,eligibility:eligibility()}):applyCare(authoritative,input,{now,eligibility:eligibility()});
    authoritative=result.character;return {ok:true,json:async()=>result};
  };
  try {
    const first=panel.send('sweets');await panel.send('sweets');assert.equal(posts,1);release();await first;
    assert.match(status.textContent,/arrival/);assert.equal(s.character.happiness,50);s.decide();
    s.pulseCareScene(false);assert.equal(posts,1); // approaching cannot advance
    s.pos.set(s.activity.spot.x,s.activity.spot.z); // consume the tested navigation path
    for(let i=0;i<=10;i++) {
      now=2000+i*1000;s.nextCarePulse=0;s.pulseCareScene(true);await new Promise(r=>setImmediate(r));
    }
    assert.equal(s.character.happiness,55);assert.equal(s.character.care.pending,null);
    assert.equal(s.character.care.history.filter(h=>h.action==='sweets').length,1);
    assert.equal(s.careFeedback.receive(s.character),false); // completion was already delivered
    const count=posts;s.pulseCareScene(true);assert.equal(posts,count);
    s.decide();assert.equal(s.lot.homeActivityClaims.has(s),false);
  } finally {globalThis.fetch=oldFetch;globalThis.document=oldDocument;globalThis.matchMedia=oldMedia;}
});
test('blocked request cancels through revision/receipt API and keeps the visible failure',async()=>{
  const s=rig(),e=careEligibility({home:{project:'fixture',characters:[s.character]},character:s.character,interest:'sweets'});
  s.character=applyCare(s.character,{id:'blocked-request',action:'sweets',revision:1},{now:1000,eligibility:e}).character;
  s.lot.getNav().addRect([-10,-10,10,10]);
  const oldFetch=globalThis.fetch;let request;
  globalThis.fetch=async(_url,options)=>{request=JSON.parse(options.body);return {ok:true,json:async()=>applyCare(s.character,request,{now:2000})};};
  try {s.decide();await new Promise(r=>setImmediate(r));assert.equal(request.action,'cancel');assert.equal(s.character.care.pending,null);assert.equal(s.character.happiness,50);assert.match(s.careError,/blocked/);assert.equal(s.lot.homeActivityClaims.size,0);}
  finally {globalThis.fetch=oldFetch;}
});
test('disconnect releases the local care scene and reservations without sending progress or cancelling real work',()=>{
  const s=rig();let disposed=0;
  s.character.care.pending={id:'disconnect-care'};s.activity={careId:'disconnect-care',pose:'home'};
  s.homeScene={dispose(){disposed++;}};s.lot.homeActivityClaims.set(s,{floor:0,rect:[0,0,2,2]});s.claim({x:1,z:1});
  s.truth={state:'idle'};s.plumbob={userData:{material:{color:{setHex(){}},emissive:{setHex(){}}}}};
  s.observationConnected=false;s.layoutVersion=s.lot.layoutVersion=1;s.clickReaction={active:null,tick(){}};
  s.updateLabel=()=>{};const oldFetch=globalThis.fetch;globalThis.fetch=()=>{throw Error('No offline request allowed');};
  try {s.update(.1,1);assert.equal(disposed,1);assert.equal(s.claimed,null);assert.equal(s.lot.homeActivityClaims.size,0);assert.equal(s.homeScene,null);assert.equal(s.activity,null);}
  finally {globalThis.fetch=oldFetch;}
});

import {HOME_XP_THRESHOLDS} from '../shared/progression.mjs';
import {PROFESSIONS} from '../shared/catalogs/index.js';
import test from 'node:test';import assert from 'node:assert/strict';
import {initializeHousehold, residentCharacters} from '../shared/foundation.mjs';
import {roommateView, recruitCandidate, roommateRoles, inspectionInstruction} from '../shared/roommates.mjs';
import {projectTeam} from '../shared/team.mjs';import {validateHandoffs,recordHandoffs} from '../bridge/handoffs.mjs';
import {passResult} from '../bridge/passes.mjs';
const home=()=>{const h=initializeHousehold({project:'/p',name:'Home',characters:[{slot:1,id:'owner',name:'Otto',assignedRole:'personal_assistant'},{slot:2,id:'retired',name:'Old',assignedRole:'researcher'}]});h.residentAgentIds=['owner'];return h;};
const runs=()=>Array.from({length:12},(_,i)=>({id:`r${i}`,project:'/p',slot:1,status:'completed',result:{summary:'Returned'}}));
const report={id:'inspection',kind:'roommate_inspection',project:'/p',slot:1,status:'completed',startedAt:'2026-10-10',result:{summary:'Needs visual design',checks:['Read README'],limitations:[],next:null,roommateRoles:[{roleId:'graphic_design_assistant',reason:'Improve the project interface.'},{roleId:'researcher',reason:'Research is the next priority after design.'}]}};
test('overview gates slot 2 at pooled 100 XP and slot 3 at pooled 750 XP',()=>{
 const h=home();assert.equal(roommateView(h,[]).capacity,1);const v=roommateView(h,runs().slice(0,4));assert.equal(v.xp.xp,100);assert.equal(v.capacity,2);assert.equal(roommateView(h,runs().slice(0,3)).capacity,1);assert.equal(v.slots[1].locked,false);assert.equal(v.slots[2].locked,true);
 const retired=Array.from({length:99},(_,i)=>({...runs()[0],id:`old${i}`,slot:2}));assert.equal(roommateView(h,retired).xp.xp,0);
});
test('recommendations are validated and candidates have stable distinct identities',()=>{
 for(const roleId of ['invented','constructor','toString','__proto__'])assert.throws(()=>roommateRoles([{roleId,reason:'x'}]));assert.throws(()=>validateHandoffs([{id:'bad',role:'constructor',title:'Bad',instruction:'No',dependsOn:[]}]));assert.throws(()=>roommateRoles([{roleId:'researcher',reason:''}]));
 const v=roommateView(home(),[...runs(),report]);assert.equal(v.candidates.length,2);assert.deepEqual(v.candidates.map(c=>c.roleId),['graphic_design_assistant','researcher']);assert.deepEqual(v.candidates.map(c=>c.rank),[1,2]);assert.equal(new Set(v.candidates.map(c=>c.roleId)).size,2);assert.equal(v.candidates[0].id,'candidate:inspection:graphic_design_assistant:0');assert.notEqual(v.candidates[0].id,v.candidates[1].id);assert.deepEqual(v.candidates,roommateView(home(),[...runs(),report]).candidates);
 assert.deepEqual(passResult(report.result).roommateRoles,report.result.roommateRoles);
});
test('only player-selected current candidate recruits; preserve old identities and block stale/full requests',()=>{
 const h=home(),v=roommateView(h,[...runs(),report]);assert.throws(()=>recruitCandidate(h,v,'unknown'));
 assert.throws(()=>recruitCandidate(h,roommateView(h,[report]),v.candidates[0].id),/level 2/);
 const c=recruitCandidate(h,v,v.candidates[0].id);assert.equal(c.slot,3);assert.equal(c.professionId,'graphic_design_assistant');assert.equal(h.characters.find(c=>c.id==='retired').name,'Old');assert.equal(residentCharacters(h).length,2);
 assert.throws(()=>recruitCandidate(h,roommateView(h,[...runs(),report]),v.candidates[1].id),/No open/);
 const team=projectTeam(h);assert.deepEqual(team.map(m=>m.role),['assistant','graphic_design_assistant']);
 const value=[{id:'design',role:'graphic_design_assistant',title:'Design',instruction:'Inspect layout',dependsOn:[]}];assert.equal(validateHandoffs(value).length,1);
 const root={id:'root',slot:1,project:'/p',team,conversationSession:'12345678-1234-1234-1234-123456789abc'};const data={runs:[root],proposals:[]};recordHandoffs(data,root,{handoffs:value});assert.equal(data.proposals[0].slot,c.slot);
 assert.throws(()=>recordHandoffs({runs:[root],proposals:[]},root,{handoffs:[{...value[0],role:'researcher'}]}),/another assigned/);
});

test('one candidate per role and inspection asks for project-specific priority',()=>{
 const single={...report,result:{...report.result,roommateRoles:report.result.roommateRoles.slice(0,1)}};assert.equal(roommateView(home(),[...runs(),single]).candidates.length,1);
 assert.throws(()=>roommateRoles([report.result.roommateRoles[0],report.result.roommateRoles[0]]),/distinct/);
 assert.match(inspectionInstruction(),/each role only once/);assert.match(inspectionInstruction(),/most helpful to least helpful/);assert.match(inspectionInstruction(),/not catalog order/);
});

test('re-recruiting a removed candidate reuses their identity and slot',()=>{
 const h=home(),v=roommateView(h,[...runs(),report]);const first=recruitCandidate(h,v,v.candidates[0].id);
 h.residentAgentIds=['owner'];const count=h.characters.length;
 const again=recruitCandidate(h,roommateView(h,[...runs(),report]),first.id);
 assert.strictEqual(again,first);assert.equal(h.characters.length,count);assert.equal(again.slot,first.slot);
 assert.equal(h.characters.filter(c=>c.id===first.id).length,1);assert.equal(residentCharacters(h).length,2);
 assert.throws(()=>recruitCandidate(h,roommateView(h,[...runs(),report]),first.id),/No open|already represented/);
 assert.equal(h.characters.length,count);
 const reloaded=initializeHousehold(JSON.parse(JSON.stringify(h)));assert.equal(residentCharacters(reloaded).length,2);
});

test('third roommate unlocks at level 3 and the next slot stays locked until level 4',()=>{
 const h=home();const earned=Array.from({length:14},(_,i)=>({...runs()[0],id:`earned${i}`}));
 assert.equal(roommateView(h,earned.slice(0,13)).capacity,2);
 const fixture={...report,xpExcluded:true};const v=roommateView(h,[...earned,fixture]);assert.equal(v.xp.xp,350);assert.equal(v.capacity,3);assert.equal(v.slots[2].locked,false);
 const below=roommateView(h,earned.slice(0,13));assert.match(below.slots[2].requirement,/Home level 3.*350 pooled XP/);
 recruitCandidate(h,v,v.candidates[0].id);
 recruitCandidate(h,roommateView(h,[...earned,fixture]),v.candidates[1].id);
 assert.equal(residentCharacters(h).length,3);
 assert.throws(()=>recruitCandidate(h,roommateView(h,[...earned,fixture]),v.candidates[0].id),/No open.*Slot 4/);
});

test('all fifteen levels expose exactly one additional recruit slot per level',()=>{
 const h=home();const thresholds=HOME_XP_THRESHOLDS;
 for(let i=0;i<thresholds.length;i++){
  const earned=Array.from({length:thresholds[i]/25},(_,j)=>({...runs()[0],id:`tier-${j}`}));
  const v=roommateView(h,earned);assert.equal(v.capacity,i+1);assert.equal(v.slots.length,15);
  assert.equal(v.slots.filter(s=>!s.locked).length,i+1);
  if(i<14)assert.match(v.slots[i+1].requirement,new RegExp(`Home level ${i+2}.*${thresholds[i+1]} pooled XP`));
 }
 const earned=Array.from({length:640},(_,i)=>({...runs()[0],id:`max-${i}`}));
 // Distinct catalog roles keep explicit recruitment gates intact at maximum capacity.
 const roles=PROFESSIONS.filter(p=>p.id!=='personal_assistant').slice(0,14).map(p=>p.id);
 for(const roleId of roles){const r={...report,id:`report-${roleId}`,xpExcluded:true,result:{...report.result,roommateRoles:[{roleId,reason:'Fixture recommendation'}]}};const v=roommateView(h,[...earned,r]);recruitCandidate(h,v,v.candidates[0].id);}
 assert.equal(residentCharacters(h).length,15);
 const v=roommateView(h,[...earned,report]);assert.throws(()=>recruitCandidate(h,v,v.candidates[0].id),/All 15.*full/);
});

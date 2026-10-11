import test from 'node:test';
import assert from 'node:assert/strict';
import {mentionSuggestions,handoffMember} from '../shared/mentions.mjs';
import {recordHandoffs,teamPrompt,validateHandoffs} from '../bridge/handoffs.mjs';
const team=[{slot:1,name:'Rosa',role:'assistant'},{slot:4,name:'Olive',role:'software_developer'},{slot:5,name:'Tyler',role:'graphic_design_assistant'},{slot:6,name:'Dana',role:'software_developer'}];
test('composer suggests exact project names at the caret, not email addresses',()=>{
 assert.deepEqual(mentionSuggestions('Have @Ty',8,team).members.map(m=>m.name),['Tyler']);
 assert.equal(mentionSuggestions('mail@Ty',7,team),null);
 assert.equal(mentionSuggestions('Have @Unknown',13,team).members.length,0);
 assert.equal(mentionSuggestions('@olive',6,team).members[0].slot,4);
});
test('names disambiguate professions; missing, duplicate and self targets fail atomically',()=>{
 assert.equal(handoffMember(team,'@OLIVE').slot,4);
 assert.throws(()=>handoffMember(team,'software_developer'),/ambiguous/);
 assert.throws(()=>handoffMember(team,'@Nobody'),/unknown/);
 assert.throws(()=>handoffMember([...team,{...team[1],slot:8}],'@Olive'),/ambiguous/);
 const root={id:'root',slot:1,team,project:'/fixture',conversationSession:'11111111-1111-1111-1111-111111111111'};
 const data={runs:[root],proposals:[]};
 const task=(id,role,dependsOn=[])=>({id,role,title:id,instruction:'Scoped fixture work',dependsOn});
 assert.throws(()=>recordHandoffs(data,root,{handoffs:[task('design','@Tyler'),task('bad','@Nobody')]}));
 assert.equal(data.proposals.length,0);
 assert.throws(()=>recordHandoffs(data,root,{handoffs:[task('self','@Rosa')]}),/another assigned/);
 recordHandoffs(data,root,{handoffs:[task('design','@Tyler'),task('code','@Olive',['design'])]});
 assert.deepEqual(data.proposals.map(p=>p.slot),[5,4]);
 assert.deepEqual(data.proposals[1].teamDependencies,[data.proposals[0].id]);
 assert.equal(data.proposals[1].teamRole,'software_developer');
 assert.equal(validateHandoffs([task('name','@Tyler')])[0].role,'@Tyler');
 assert.match(teamPrompt(root),/instructions to handle everything yourself do not authorize handoffs/);
});

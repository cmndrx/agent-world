import test from 'node:test';
import assert from 'node:assert/strict';
import { projectSetup, taskHandoff } from '../shared/onboarding.mjs';

const data={households:[{project:'/p',name:'Project'}],plans:[{project:'/p',outcome:'Ship feature',nextAction:'Review output'}],conversations:[{project:'/p',key:'same',app:'Claude',url:'https://claude.ai/chat/one'},{project:'/other',key:'other',id:'PRIVATE'}],tasks:[]};
test('setup uses recorded progress and keeps optional chat links separate from review decisions',()=>{
  assert.equal(projectSetup('/p',data).next,'task');
  const task={id:'t',project:'/p',status:'needs_review',conversationKeys:['other']};
  const initial=projectSetup('/p',{...data,tasks:[task],sessions:[{state:'done'}]});
  assert.equal(initial.done,2);assert.equal(initial.linked,false);assert.equal(initial.next,'review');
  assert.equal(projectSetup('/p',{...data,tasks:[{...task,reviews:[{decision:'return'}]}]}).done,3);
  assert.equal(projectSetup('/p',{...data,tasks:[{...task,conversationKeys:['same']}]}).linked,true);
  assert.equal(projectSetup('/empty',{...data,tasks:[task]}).done,0);
});
test('task handoff retains evidence, reported check provenance and latest feedback without other-home chat leakage',()=>{
  const t={id:'t',project:'/p',title:'Fix link',status:'in_progress',version:2,notes:'Preserve work',evidence:'Recorded build result',conversationKeys:['same','other'],reviews:[{decision:'return',feedback:'Fix keyboard flow',recordedAt:'now'}],references:[{kind:'check',value:'npm test',result:'passed',recordedBy:'Codex',recordedAt:'now'}]};
  const handoff=taskHandoff(t,data);
  assert.match(handoff,/Fix keyboard flow/);assert.match(handoff,/reported passed/);assert.match(handoff,/Recorded version: 2/);assert.match(handoff,/Do not accept your own work/);assert.match(handoff,/https:\/\/claude.ai\/chat\/one/);assert.doesNotMatch(handoff,/PRIVATE/);
  assert.match(taskHandoff({...t,status:'accepted'},data),/Inspect its records only/);
  assert.equal(t.status,'in_progress');assert.throws(()=>taskHandoff({...t,project:'/missing'},data),/existing home/);
});

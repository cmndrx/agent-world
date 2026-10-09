import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {PassStore,passResult} from '../bridge/passes.mjs';
import {PassRunner} from '../bridge/pass-runner.mjs';
import {World} from '../bridge/world.mjs';
import {threadOwner} from '../shared/pass-conversations.mjs';
function fixture(t){const dir=fs.mkdtempSync(path.join(os.tmpdir(),'aw-pass-test-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));return {dir,store:new PassStore(path.join(dir,'passes.json')),homes:{[fs.realpathSync(dir)]:{}},project:fs.realpathSync(dir)};}
test('specific version approval claims once and next proposal never inherits approval',t=>{
 const {store,homes,project}=fixture(t);const p=store.propose({project,slot:1,title:'One',instruction:'Do one'},homes);
 assert.throws(()=>store.decide({id:p.id,version:p.version,action:'approve'},homes),/Confirm/);
 const changed=store.propose({project,slot:1,title:'Changed',instruction:'New instruction',version:p.version},homes);
 assert.throws(()=>store.decide({id:p.id,version:p.version,action:'approve',confirmed:true},homes),/changed/);
 store.decide({id:changed.id,version:changed.version,action:'approve',confirmed:true},homes);
 const run=store.claim();assert.ok(run);assert.equal(store.claim(),null);
 assert.throws(()=>store.propose({project,slot:1,title:'Other',instruction:'Other',version:4},homes),/already queued/);
 store.finish(run.id,'completed',passResult({summary:'Reported result',checks:['actual command'],limitations:['not verified'],next:{title:'Two',instruction:'Do two'}}));
 assert.equal(store.snapshot().proposals[0].status,'proposed');assert.equal(store.claim(),null);assert.equal(store.snapshot().runs.length,1);
 const restored=new PassStore(store.file);assert.equal(restored.snapshot().runs[0].result.summary,'Reported result');
});
test('paused, interrupted and invalid outputs do not run or silently retry',t=>{
 const {store,homes,project}=fixture(t);const p=store.propose({project,slot:1,title:'One',instruction:'Do one'},homes);
 const paused=store.decide({id:p.id,version:p.version,action:'pause'},homes);assert.equal(store.claim(),null);
 store.decide({id:paused.id,version:paused.version,action:'approve',confirmed:true},homes);const run=store.claim();store.interrupt();assert.equal(store.claim(),null);
 const next=store.propose({project,slot:1,title:'Another',instruction:'Another',version:store.snapshot().proposals[0].version},homes);
 assert.throws(()=>store.decide({id:next.id,version:next.version,action:'approve',confirmed:true},homes),/interrupted/);
 store.child(run.id,process.pid); // child() only updates running records, so use recorded fixture directly below
 store.change(d=>{d.runs[0].childPid=process.pid;});assert.throws(()=>store.resolve({id:run.id,confirmed:true}),/still active/);
 store.change(d=>{delete d.runs[0].childPid;});store.resolve({id:run.id,confirmed:true});assert.equal(store.snapshot().runs[0].status,'failed');
 for(const v of [{summary:'Missing fields'},{summary:'x',checks:[{}],limitations:[],next:null},{summary:'x',checks:[],limitations:[],next:{title:'',instruction:''}}])assert.throws(()=>passResult(v));
});
test('runner failure persists once; a second runner cannot claim the same home',async t=>{
 const {store,homes,project}=fixture(t);const p=store.propose({project,slot:1,title:'One',instruction:'Do one'},homes);store.decide({id:p.id,version:p.version,action:'approve',confirmed:true},homes);
 const runner=new PassRunner(store,{enabled:true,command:path.join(project,'missing-cli')});runner.start();t.after(()=>runner.stop());
 const other=new PassRunner(store,{enabled:true});other.start();assert.equal(other.enabled,false);
 while(runner.busy)await new Promise(r=>setTimeout(r,10));
 assert.equal(store.snapshot().runs[0].status,'failed');await runner.tick();assert.equal(store.snapshot().runs.length,1);
});


test('approval pins a resolved directory and queued pauses revoke execution',t=>{
 const {store,homes,project,dir}=fixture(t);const alias=path.join(dir,'alias');const target=path.join(dir,'target');fs.mkdirSync(target);fs.symlinkSync(target,alias);homes[alias]={};
 const p=store.propose({project:alias,slot:1,title:'Inspect alias',instruction:'Read the local marker'},homes);
 const approved=store.decide({id:p.id,version:p.version,action:'approve',confirmed:true},homes);assert.equal(approved.executionProject,fs.realpathSync(target));
 store.decide({id:p.id,version:approved.version,action:'pause'},homes);assert.equal(store.claim(),null);
});

test('interrupted execution blocks other projects until inspected and result next is strict',t=>{
 const {store,homes,project,dir}=fixture(t);const other=path.join(dir,'other');fs.mkdirSync(other);homes[other]={};
 const p=store.propose({project,slot:1,title:'One',instruction:'Do one'},homes);store.decide({id:p.id,version:p.version,action:'approve',confirmed:true},homes);const first=store.claim();store.child(first.id,process.pid);
 const q=store.propose({project:other,slot:1,title:'Two',instruction:'Do two'},homes);store.decide({id:q.id,version:q.version,action:'approve',confirmed:true},homes);
 store.interrupt();assert.equal(store.claim(),null);assert.throws(()=>store.resolve({id:first.id,confirmed:true}),/still active/);
 store.change(d=>{delete d.runs[0].childPid;});store.resolve({id:first.id,confirmed:true});assert.equal(store.claim().project,other);
 for(const next of [false,0,'',[],undefined])assert.throws(()=>passResult({summary:'x',checks:[],limitations:[],next}));
});

test('runner captures exact thread identity without saving event contents',async t=>{
 const {store,homes,project}=fixture(t);const cli=path.join(project,'mock-cli');const id='12345678-1234-1234-1234-123456789abc';
 fs.writeFileSync(cli,`#!/usr/bin/env node\nconst fs=require('fs');const args=process.argv;process.stdin.resume();process.stdin.on('end',()=>{console.log(JSON.stringify({type:'thread.started',thread_id:'${id}'}));console.log(JSON.stringify({type:'item.completed',text:'private content'}));fs.writeFileSync(args[args.indexOf('--output-last-message')+1],JSON.stringify({summary:'Reported',checks:[],limitations:[],next:null}));});`,{mode:0o700});
 const p=store.propose({project,slot:1,title:'One',instruction:'Do one'},homes);store.decide({id:p.id,version:p.version,action:'approve',confirmed:true},homes);
 const runner=new PassRunner(store,{enabled:true,command:cli});runner.start();t.after(()=>runner.stop());while(runner.busy)await new Promise(r=>setTimeout(r,10));
 const run=store.snapshot().runs[0];assert.equal(run.status,'completed');assert.equal(run.conversationSession,id);assert.equal(fs.readFileSync(store.file,'utf8').includes('private content'),false);
});

test('continued prompts pin the conversation through approval, execution and follow-up',t=>{
 const {store,homes,project}=fixture(t);const id='12345678-1234-1234-1234-123456789abc';
 const p=store.propose({project,slot:1,title:'Continue',instruction:'Follow up',resumeSession:id},homes);store.decide({id:p.id,version:p.version,action:'approve',confirmed:true},homes);
 assert.equal(store.claim(()=>false),null);const run=store.claim();assert.equal(run.resumeSession,id);store.conversation(run.id,id);store.finish(run.id,'completed',passResult({summary:'Done',checks:[],limitations:[],next:{title:'Next',instruction:'One more'}}));assert.equal(store.snapshot().proposals[0].resumeSession,id);
 assert.throws(()=>store.propose({project,slot:2,title:'x',instruction:'x',resumeSession:'--last'},homes),/valid conversation/);
});

test('resume CLI preserves explicit identity and never uses last or fresh fallback',async t=>{
 const {store,homes,project}=fixture(t);const id='12345678-1234-1234-1234-123456789abc';const cli=path.join(project,'resume-cli');
 fs.writeFileSync(cli,`#!/usr/bin/env node\nconst fs=require('fs');const a=process.argv.slice(2);fs.writeFileSync('args.json',JSON.stringify(a));process.stdin.resume();process.stdin.on('end',()=>{console.log(JSON.stringify({type:'thread.started',thread_id:'${id}'}));fs.writeFileSync(a[a.indexOf('--output-last-message')+1],JSON.stringify({summary:'Continued',checks:[],limitations:[],next:null}));});`,{mode:0o700});
 const p=store.propose({project,slot:1,title:'Continue',instruction:'Follow up',resumeSession:id},homes);store.decide({id:p.id,version:p.version,action:'approve',confirmed:true},homes);const runner=new PassRunner(store,{enabled:true,command:cli});runner.start();t.after(()=>runner.stop());while(runner.busy)await new Promise(r=>setTimeout(r,10));const a=JSON.parse(fs.readFileSync(path.join(project,'args.json')));assert.deepEqual(a.slice(0,4),['exec','--sandbox','workspace-write','resume']);assert.equal(a.at(-2),id);assert.equal(a.includes('--last'),false);assert.equal(store.snapshot().runs[0].conversationSession,id);
});

test('desktop writer conflicts are actionable, private and never retried',async t=>{
 const {store,homes,project}=fixture(t);const id='12345678-1234-1234-1234-123456789abc',cli=path.join(project,'locked-cli');
 fs.writeFileSync(cli,`#!/usr/bin/env node\nprocess.stdin.resume();process.stdin.on('end',()=>{process.stderr.write('thread-store conflict: thread already has an active writer; private-secret');process.exit(1);});`,{mode:0o700});
 const p=store.propose({project,slot:1,title:'Prompt',instruction:'Do work',resumeSession:id},homes);store.decide({id:p.id,version:p.version,action:'approve',confirmed:true},homes);const runner=new PassRunner(store,{enabled:true,command:cli});runner.start();t.after(()=>runner.stop());while(runner.busy)await new Promise(r=>setTimeout(r,10));const run=store.snapshot().runs[0];assert.equal(run.status,'failed');assert.equal(run.result,null);assert.match(run.error,/Codex currently owns/);assert.equal(run.error.includes('private-secret'),false);await runner.tick();assert.equal(store.snapshot().runs.length,1);
});

test('selected model stays pinned to the approved run and CLI resume',async t=>{
 const {store,homes,project}=fixture(t);const cli=path.join(project,'model-cli'),id='12345678-1234-1234-1234-123456789abc';fs.writeFileSync(cli,`#!/usr/bin/env node\nconst fs=require('fs');const a=process.argv.slice(2);fs.writeFileSync('args.json',JSON.stringify(a));process.stdin.resume();process.stdin.on('end',()=>{console.log(JSON.stringify({type:'thread.started',thread_id:'${id}'}));fs.writeFileSync(a[a.indexOf('--output-last-message')+1],JSON.stringify({summary:'Done',checks:[],limitations:[],next:null}));});`,{mode:0o700});const p=store.propose({project,slot:1,title:'x',instruction:'x',model:'gpt-6.1-sol',resumeSession:id},homes);store.decide({id:p.id,version:p.version,action:'approve',confirmed:true},homes);const runner=new PassRunner(store,{enabled:true,command:cli});runner.start();t.after(()=>runner.stop());while(runner.busy)await new Promise(r=>setTimeout(r,10));const args=JSON.parse(fs.readFileSync(path.join(project,'args.json')));assert.equal(args[args.indexOf('--model')+1],'gpt-6.1-sol');assert.equal(store.snapshot().runs[0].model,'gpt-6.1-sol');assert.throws(()=>store.propose({project,slot:2,title:'x',instruction:'x',model:'--inject'},homes),/valid model/);
});

test('runner streams public summaries, updates items, and drops raw/unrelated content',async t=>{
 const {store,homes,project}=fixture(t),cli=path.join(project,'summary-cli'),thread='12345678-1234-1234-1234-123456789abc';
 fs.writeFileSync(cli,`#!/usr/bin/env node
const fs=require('fs'),args=process.argv;
process.stdin.resume();process.stdin.on('end',()=>{
 console.log(JSON.stringify({type:'item.completed',item:{id:'early',type:'reasoning',text:'Before thread identity'}}));
 console.log(JSON.stringify({type:'thread.started',thread_id:'${thread}'}));
 const events=[{type:'item.updated',item:{id:'r1',type:'reasoning',text:'Checking the',raw_content:'RAW_SECRET'}},{type:'item.completed',item:{id:'r1',type:'reasoning',text:'Checking the public result.'}},{type:'item.completed',item:{id:'raw',type:'reasoning',raw_content:'RAW_SECRET'}},{type:'item.completed',item:{id:'message',type:'agent_message',text:'OTHER_SECRET'}}];
 const payload=events.map(e=>JSON.stringify(e)).join('\\n')+'\\n';process.stdout.write(payload.slice(0,20));setTimeout(()=>{process.stdout.write(payload.slice(20));fs.writeFileSync(args[args.indexOf('--output-last-message')+1],JSON.stringify({summary:'Done',checks:[],limitations:[],next:null}));},20);
});`,{mode:0o700});
 const p=store.propose({project,slot:1,title:'Test',instruction:'Test'},homes);store.decide({id:p.id,version:p.version,action:'approve',confirmed:true},homes);
 const updates=[];const runner=new PassRunner(store,{enabled:true,command:cli,onChange:()=>updates.push(store.snapshot())});runner.start();t.after(()=>runner.stop());while(runner.busy)await new Promise(r=>setTimeout(r,10));
 const run=store.snapshot().runs[0];assert.equal(run.status,'completed');assert.deepEqual(run.reasoningSummaries,[{id:'r1',text:'Checking the public result.'}]);assert.ok(updates.some(s=>s.runs[0]?.status==='running'&&s.runs[0]?.reasoningSummaries?.length));assert.doesNotMatch(fs.readFileSync(store.file,'utf8'),/RAW_SECRET|OTHER_SECRET|Before thread/);
 assert.equal(store.reasoning(run.id,{id:'late',type:'reasoning',text:'Late'}),false);
});
test('public summary storage is bounded and never belongs to a different run',t=>{
 const {store,homes,project}=fixture(t);const p=store.propose({project,slot:1,title:'x',instruction:'x'},homes);store.decide({id:p.id,version:p.version,action:'approve',confirmed:true},homes);const run=store.claim();store.conversation(run.id,'12345678-1234-1234-1234-123456789abc');
 assert.equal(store.reasoning('other',{id:'x',type:'reasoning',text:'Wrong run'}),false);
 for(let i=0;i<100;i++)store.reasoning(run.id,{id:String(i),type:'reasoning',text:'x'.repeat(5000)});
 const summaries=store.snapshot().runs[0].reasoningSummaries;assert.ok(summaries.length<=32);assert.ok(summaries.reduce((n,s)=>n+s.text.length,0)<=64000);assert.equal(summaries.at(-1).text.length,4000);
});

test('Claude routes one pass, pins provider and resumes exact session without bypassing permissions',async t=>{
 const {store,homes,project}=fixture(t),cli=path.join(project,'claude-mock'),id='12345678-1234-1234-1234-123456789abc';
 fs.writeFileSync(cli,`#!/usr/bin/env node
const fs=require('fs'),a=process.argv.slice(2);fs.writeFileSync('claude-args.json',JSON.stringify(a));process.stdin.resume();process.stdin.on('end',()=>{console.log(JSON.stringify({type:'system',subtype:'init',session_id:'${id}',model:'claude-sonnet-observed'}));console.log(JSON.stringify({type:'assistant',message:{content:[{type:'thinking',thinking:'PRIVATE_THOUGHT'}]}}));console.log(JSON.stringify({type:'result',session_id:'${id}',is_error:false,structured_output:{summary:'Claude response',checks:[],limitations:[],next:{title:'Next',instruction:'Follow up'}}}));});`,{mode:0o700});
 let p=store.propose({project,slot:1,title:'Claude',instruction:'Work',provider:'claude',model:'sonnet',effort:'xhigh'},homes);store.decide({id:p.id,version:p.version,action:'approve',confirmed:true},homes);
 const runner=new PassRunner(store,{enabled:true,command:path.join(project,'not-codex'),claude:cli});runner.start();t.after(()=>runner.stop());while(runner.busy)await new Promise(r=>setTimeout(r,10));
 let run=store.snapshot().runs[0];assert.equal(run.status,'completed');assert.equal(run.provider,'claude');assert.equal(run.observedModel,'claude-sonnet-observed');assert.equal(run.result.summary,'Claude response');assert.equal(run.conversationSession,id);assert.doesNotMatch(fs.readFileSync(store.file,'utf8'),/PRIVATE_THOUGHT/);
 p=store.snapshot().proposals[0];assert.equal(p.provider,'claude');assert.equal(p.resumeSession,id);assert.equal(p.status,'proposed');store.decide({id:p.id,version:p.version,action:'approve',confirmed:true},homes);await runner.tick();
 const args=JSON.parse(fs.readFileSync(path.join(project,'claude-args.json')));assert.equal(args[args.indexOf('--model')+1],'sonnet');assert.equal(args[args.indexOf('--effort')+1],'xhigh');assert.equal(args[args.indexOf('--resume')+1],id);assert.equal(args[args.indexOf('--permission-mode')+1],'dontAsk');assert.equal(args.includes('--dangerously-skip-permissions'),false);assert.ok(args.includes('--json-schema'));assert.equal(store.snapshot().runs[1].provider,'claude');
 p=store.propose({project,slot:1,version:store.snapshot().proposals.at(-1).version,title:'Default effort',instruction:'Fixture',provider:'claude',model:'sonnet',effort:null,resumeSession:id},homes);store.decide({id:p.id,version:p.version,action:'approve',confirmed:true},homes);await runner.tick();const defaultArgs=JSON.parse(fs.readFileSync(path.join(project,'claude-args.json')));assert.equal(defaultArgs.includes('--effort'),false);assert.equal(defaultArgs[defaultArgs.indexOf('--resume')+1],id);
 assert.throws(()=>store.propose({project,slot:2,title:'x',instruction:'x',provider:'other'},homes),/Choose Codex/);assert.throws(()=>store.propose({project,slot:2,title:'x',instruction:'x',provider:'claude',model:'gpt-test'},homes),/supported Claude|configured default/);
});
test('Claude permission denials and mismatched sessions cannot become completed runs',async t=>{
 for(const kind of ['denied','mismatch']){
 const {store,homes,project}=fixture(t),cli=path.join(project,'claude-error'),id='12345678-1234-1234-1234-123456789abc';
 fs.writeFileSync(cli,`#!/usr/bin/env node
process.stdin.resume();process.stdin.on('end',()=>{console.log(JSON.stringify({type:'system',subtype:'init',session_id:'${id}'}));console.log(JSON.stringify({type:'result',session_id:'${kind==='mismatch'?'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee':id}',permission_denials:${kind==='denied'?'[{tool_name:"Bash"}]':'[]'},structured_output:{summary:'Should not succeed',checks:[],limitations:[],next:null}}));});`,{mode:0o700});
 const p=store.propose({project,slot:1,title:'x',instruction:'x',provider:'claude'},homes);store.decide({id:p.id,version:p.version,action:'approve',confirmed:true},homes);const runner=new PassRunner(store,{enabled:true,claude:cli});runner.start();t.after(()=>runner.stop());while(runner.busy)await new Promise(r=>setTimeout(r,10));const run=store.snapshot().runs[0];assert.equal(run.status,'failed');assert.equal(run.result,null);assert.match(run.error,/permissions|different conversation/);
 }
});

test('cross-resident resumes and returned identities are refused without changing owner',t=>{
 const {store,homes,project}=fixture(t),id='12345678-1234-1234-1234-123456789abc';
 homes[project]={characters:[{slot:1},{slot:2}]};
 assert.throws(()=>store.propose({project,slot:3,title:'Missing',instruction:'Missing'},homes),/existing resident/);
 const p=store.propose({project,slot:2,title:'Second',instruction:'Work'},homes);
 store.decide({id:p.id,version:p.version,action:'approve',confirmed:true},homes);
 const first=store.claim();store.conversation(first.id,id);store.finish(first.id,'completed',{summary:'Done',checks:[],limitations:[],next:null});
 assert.throws(()=>store.propose({project,slot:1,title:'Wrong',instruction:'Wrong',resumeSession:id},homes),/does not belong/);
 const q=store.propose({project,slot:1,title:'Fresh',instruction:'Fresh'},homes);store.decide({id:q.id,version:q.version,action:'approve',confirmed:true},homes);
 const second=store.claim();assert.throws(()=>store.conversation(second.id,id),/does not belong/);
 assert.equal(store.snapshot().runs[1].conversationSession,undefined);
});

test('a prompt for resident two executes its exact thread and reconciles early observer activity',async t=>{
 const {store,homes,project}=fixture(t),cli=path.join(project,'selected-resident-cli'),id='12345678-1234-1234-1234-123456789abc';
 const world=new World({residentOwner:(p,source,thread)=>threadOwner(store.snapshot().runs,[],p,thread)});
 const observed={source:'codex',provider:'openai',project,session:id,kind:'state',state:'thinking',ts:new Date().toISOString(),conversation:{id}};
 // Observer wins the race and initially picks the lowest free desk.
 world.apply(observed);assert.equal(world.sessions.get(id).slot,1);
 fs.writeFileSync(cli,`#!/usr/bin/env node
const fs=require('fs'),a=process.argv.slice(2);fs.writeFileSync('selected-args.json',JSON.stringify(a));process.stdin.resume();process.stdin.on('end',()=>{console.log(JSON.stringify({type:'thread.started',thread_id:'${id}'}));fs.writeFileSync(a[a.indexOf('--output-last-message')+1],JSON.stringify({summary:'Second resident response',checks:[],limitations:[],next:null}));});`,{mode:0o700});
 const p=store.propose({project,slot:2,title:'Second',instruction:'Task for second'},homes);store.decide({id:p.id,version:p.version,action:'approve',confirmed:true},homes);
 const runner=new PassRunner(store,{enabled:true,command:cli,onChange:()=>world.syncResidentOwnership()});runner.start();t.after(()=>runner.stop());while(runner.busy)await new Promise(r=>setTimeout(r,10));
 const run=store.snapshot().runs[0],args=JSON.parse(fs.readFileSync(path.join(project,'selected-args.json')));
 assert.equal(run.status,'completed');assert.equal(run.slot,2);assert.equal(run.conversationSession,id);assert.equal(args.includes('resume'),false);
 assert.equal(world.sessions.get(id).slot,2);assert.equal(world.catalog.snapshot().conversations[0].residentSlot,2);
 assert.equal(store.snapshot().runs.length,1);
});

test('human follow-ups queue in order, preserve approval, and resume the established thread',t=>{
 const {store,homes,project}=fixture(t);const thread='12345678-1234-1234-1234-123456789abc';
 const first=store.propose({project,slot:1,title:'First',instruction:'First'},homes);
 store.decide({id:first.id,version:first.version,action:'approve',confirmed:true},homes);const running=store.claim();
 const follow=store.propose({project,slot:1,title:'Follow',instruction:'Follow',enqueue:true,afterProposal:first.id,version:store.snapshot().proposals.at(-1).version},homes);
 store.decide({id:follow.id,version:follow.version,action:'approve',confirmed:true},homes);assert.equal(store.claim(),null);
 const third=store.propose({project,slot:1,title:'Third',instruction:'Third',enqueue:true,afterProposal:follow.id,version:store.snapshot().proposals.at(-1).version},homes);
 store.decide({id:third.id,version:third.version,action:'approve',confirmed:true},homes);
 store.conversation(running.id,thread);store.finish(running.id,'completed',{summary:'Done',checks:[],limitations:[],next:{title:'Suggestion',instruction:'Never replace human queue'}});
 const next=store.claim();assert.equal(next.proposalId,follow.id);assert.equal(next.resumeSession,thread);assert.equal(store.snapshot().proposals.find(p=>p.id===third.id).status,'approved');
 store.conversation(next.id,thread);store.finish(next.id,'completed',null);assert.equal(store.claim().resumeSession,thread);
});
test('failed first prompt cannot turn a queued follow-up into a fresh conversation',t=>{
 const {store,homes,project}=fixture(t);const first=store.propose({project,slot:1,title:'First',instruction:'First'},homes);store.decide({id:first.id,version:first.version,action:'approve',confirmed:true},homes);const running=store.claim();
 const follow=store.propose({project,slot:1,title:'Follow',instruction:'Follow',enqueue:true,afterProposal:first.id,version:store.snapshot().proposals.at(-1).version},homes);store.decide({id:follow.id,version:follow.version,action:'approve',confirmed:true},homes);
 store.finish(running.id,'failed',null);assert.equal(store.claim(),null);assert.equal(store.snapshot().proposals.find(p=>p.id===follow.id).status,'paused');
});
test('selected reasoning effort is validated, pinned to the run and passed to Codex',async t=>{
 const {store,homes,project}=fixture(t);const cli=path.join(project,'effort-cli');fs.writeFileSync(cli,`#!/usr/bin/env node\nconst fs=require('fs');const a=process.argv.slice(2);fs.writeFileSync('args.json',JSON.stringify(a));process.stdin.resume();process.stdin.on('end',()=>{fs.writeFileSync(a[a.indexOf('--output-last-message')+1],JSON.stringify({summary:'Done',checks:[],limitations:[],next:null}));});`,{mode:0o700});
 assert.throws(()=>store.propose({project,slot:2,title:'x',instruction:'x',effort:'turbo'},homes),/reasoning effort/);
 assert.throws(()=>store.propose({project,slot:2,title:'x',instruction:'x',provider:'claude',effort:'ultra'},homes),/supported Claude effort/);
 const p=store.propose({project,slot:1,title:'x',instruction:'x',model:'gpt-6.1-sol',effort:'high'},homes);store.decide({id:p.id,version:p.version,action:'approve',confirmed:true},homes);
 const runner=new PassRunner(store,{enabled:true,command:cli});runner.start();t.after(()=>runner.stop());while(runner.busy)await new Promise(r=>setTimeout(r,10));
 const args=JSON.parse(fs.readFileSync(path.join(project,'args.json')));assert.equal(args[args.indexOf('model_reasoning_effort=high')-1],'-c');assert.equal(store.snapshot().runs[0].effort,'high');
});

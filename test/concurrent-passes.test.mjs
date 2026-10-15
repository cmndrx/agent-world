import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {PassStore} from '../bridge/passes.mjs';
import {PassRunner} from '../bridge/pass-runner.mjs';
const wait=async predicate=>{const until=Date.now()+8000;while(!predicate()){if(Date.now()>until)throw Error('Fixture timed out');await new Promise(r=>setTimeout(r,15));}};
for(const providers of [['codex','codex'],['claude','claude'],['codex','claude']])test(`independent ${providers.join(' + ')} prompts overlap; Stop is run scoped`,async t=>{
 const home=fs.mkdtempSync(path.join(os.tmpdir(),'aw-concurrent-'));t.after(()=>fs.rmSync(home,{recursive:true,force:true}));
 const project=fs.realpathSync(home),store=new PassStore(path.join(home,'passes.json')),homes={[project]:{}};
 const cli=path.join(home,'fixture-cli');
 fs.writeFileSync(cli,`#!${process.execPath}
const fs=require('fs'),crypto=require('crypto'),a=process.argv.slice(2),claude=a.includes('--print'),id=crypto.randomUUID();
process.stdin.resume();process.stdin.on('end',()=>{
 console.log(JSON.stringify(claude?{type:'system',subtype:'init',session_id:id}:{type:'thread.started',thread_id:id}));
 const timer=setInterval(()=>{if(!fs.existsSync('release-fixture'))return;clearInterval(timer);const result={summary:id,checks:[],limitations:[],next:null};if(claude)console.log(JSON.stringify({type:'result',subtype:'success',session_id:id,structured_output:result}));else fs.writeFileSync(a[a.indexOf('--output-last-message')+1],JSON.stringify(result));},20);
});`,{mode:0o700});
 const approve=(slot,provider,extra={})=>{const previous=store.snapshot().proposals.filter(p=>p.slot===slot).at(-1);const p=store.propose({project,slot,provider,title:'Fixture',instruction:'Fixture only',version:previous?.version,...extra},homes);return store.decide({id:p.id,version:p.version,action:'approve',confirmed:true},homes);};
 approve(1,providers[0]);
 const runner=new PassRunner(store,{enabled:true,command:cli,claude:cli});runner.start();t.after(()=>runner.stop());
 await wait(()=>store.snapshot().runs[0]?.conversationSession);
 // Approve a second resident while the first is still executing in the same project.
 approve(2,providers[1]);const dispatch=runner.tick();
 await wait(()=>store.snapshot().runs.length===2&&store.snapshot().runs.every(r=>r.conversationSession));
 const [first,second]=store.snapshot().runs;assert.equal(first.status,'running');assert.equal(second.status,'running');assert.notEqual(first.conversationSession,second.conversationSession);
 const follow=approve(2,providers[1],{enqueue:true,resumeSession:second.conversationSession});assert.equal(store.claim(),null);
 const actionStates=[first,second].map(r=>runner.actions.runs.get(r.id));
 for(const state of actionStates)if(state)assert.ok(runner.actions.authorized(state.token));
 runner.cancel(first.id);
 if(actionStates[0])assert.equal(runner.actions.authorized(actionStates[0].token),undefined);
 if(actionStates[1])assert.ok(runner.actions.authorized(actionStates[1].token));
 await wait(()=>store.snapshot().runs[0].status==='cancelled');
 assert.equal(store.snapshot().runs[1].status,'running');assert.ok(runner.executions.has(second.id));
 fs.writeFileSync(path.join(home,'release-fixture'),'ok');await dispatch;
 assert.equal(store.snapshot().runs[1].status,'completed');assert.equal(store.snapshot().runs[1].result.summary,second.conversationSession);
 assert.equal(store.snapshot().proposals.find(p=>p.id===follow.id).status,'approved');
 // Verify the waiting follow-up can be claimed only after that resident finishes.
 assert.equal(store.claim().proposalId,follow.id);
});

test('Stop from a queued delegated task stops concurrent siblings and preserves unrelated work',t=>{
 const home=fs.mkdtempSync(path.join(os.tmpdir(),'aw-team-stop-'));t.after(()=>fs.rmSync(home,{recursive:true,force:true}));
 const store=new PassStore(path.join(home,'passes.json'));
 store.change(d=>{d.runs.push({id:'root',status:'completed',teamDelegated:true},{id:'a',teamRoot:'root',status:'running'},{id:'b',teamRoot:'root',status:'running'},{id:'unrelated',status:'running'});d.proposals.push({id:'queued',teamRoot:'root',status:'approved',version:1});});
 const runner=new PassRunner(store),stopped=[];
 for(const id of ['a','b','unrelated'])runner.executions.set(id,{cancel:run=>{stopped.push(run);return store.requestStop(run);}});
 assert.equal(runner.cancel('queued').status,'cancelled');assert.deepEqual(stopped,['a','b']);
 assert.equal(store.snapshot().runs.find(r=>r.id==='unrelated').stopRequestedAt,undefined);
 assert.equal(store.snapshot().runs.find(r=>r.id==='root').teamStopped,true);
});

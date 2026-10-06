import test from 'node:test';
import assert from 'node:assert/strict';
import {canPromptFromStatus,observedChatActivity} from '../shared/agent-view.mjs';
const event=(state,ts,detail={})=>({kind:'state',state,ts,detail});
const session={session:'exact',project:'/sample',source:'codex',state:'thinking',since:'2026-10-06T12:01:00Z',detail:null,history:[event('reading','2026-10-06T12:00:00Z',{tool:'Read',target:'OLD.md'}),event('waiting_for_user','2026-10-06T12:00:30Z',{reason:'turn_complete'}),event('reading','2026-10-06T12:00:40Z',{tool:'rg',target:'README.md',summary:'private text'}),event('thinking','2026-10-06T12:01:00Z',{reasoning:'private reasoning',summary:'private summary'})]};
test('inactive status can open chat while work statuses remain informational',()=>{
 for(const state of ['idle','done','waiting_for_user','error'])assert.equal(canPromptFromStatus({state}),true);
 assert.equal(canPromptFromStatus(null),true);
 for(const state of ['thinking','reading','editing','running','searching','delegating'])assert.equal(canPromptFromStatus({state}),false);
});
test('thinking view matches only the exact observed thread and project, excluding prior turns and reasoning',()=>{
 const activity=observedChatActivity([session],{project:'/sample',thread:'exact',connected:true});
 assert.equal(activity.label,'Thinking');assert.equal(activity.thinking,true);assert.equal(activity.active,true);
 assert.match(JSON.stringify(activity),/README.md/);assert.doesNotMatch(JSON.stringify(activity),/OLD.md|private/);
 for(const input of [{project:'/other',thread:'exact'},{project:'/sample',thread:'other'},{project:'/sample',thread:null}])assert.equal(observedChatActivity([session],input),null);
 assert.equal(observedChatActivity([{...session,source:'claude-code'}],{project:'/sample',thread:'exact'}),null);
});
test('disconnect preserves last-known metadata without presenting live thinking; turn boundaries honor the run start',()=>{
 const activity=observedChatActivity([session],{project:'/sample',thread:'exact',connected:false});
 assert.equal(activity.label,'Last known: Thinking');assert.equal(activity.thinking,false);assert.equal(activity.active,false);
 const current=observedChatActivity([session],{project:'/sample',thread:'exact',connected:true,after:'2026-10-06T12:00:50Z'});
 assert.equal(current.steps.length,1);assert.equal(current.steps[0].label,'Thinking');
 const done=observedChatActivity([{...session,state:'waiting_for_user',detail:{reason:'turn_complete'}}],{project:'/sample',thread:'exact',connected:true});
 const stale=observedChatActivity([session],{project:'/sample',thread:'exact',connected:true,after:'2026-10-06T12:02:00Z'});assert.equal(stale.active,false);assert.deepEqual(stale.steps,[]);
 assert.equal(done.active,false);assert.equal(done.label,'Done, your turn');
});

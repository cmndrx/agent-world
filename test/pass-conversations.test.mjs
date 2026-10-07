import test from 'node:test';import assert from 'node:assert/strict';import {residentThread,threadBusy} from '../shared/pass-conversations.mjs';
test('resident continuity prefers its own latest run and busy states block continuation',()=>{
 const a='11111111-2222-3333-4444-555555555555',b='aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
 const observed={source:'codex',session:b};assert.equal(residentThread([], '/p',1,observed),b);assert.equal(residentThread([{project:'/p',slot:1,conversationSession:a},{project:'/p',slot:2,conversationSession:b}],'/p',1,observed),a);
 assert.equal(residentThread([],'/p',1,{source:'claude-code',session:a}),null);
 for(const state of ['reading','editing','running','thinking','error'])assert.equal(threadBusy([{session:a,state}],a),true);
 for(const state of ['waiting_for_user','done','idle'])assert.equal(threadBusy([{session:a,state}],a),false);
});

test('Claude continuity uses only its own game sessions, never Codex or desktop sessions',()=>{
 const a='11111111-2222-3333-4444-555555555555',b='aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
 const runs=[{project:'/p',slot:1,provider:'claude',conversationSession:a},{project:'/p',slot:1,provider:'codex',conversationSession:b}];
 assert.equal(residentThread(runs,'/p',1,null,'claude'),a);assert.equal(residentThread(runs,'/p',1,null,'codex'),b);assert.equal(residentThread([],'/p',1,{source:'claude-code',session:a},'claude'),null);
});

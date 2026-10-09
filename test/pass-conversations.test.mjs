import test from 'node:test';import assert from 'node:assert/strict';import {residentThread,threadBusy,threadOwner,ownsThread,promptResident,residentBusy} from '../shared/pass-conversations.mjs';
test('resident continuity prefers its own latest run and busy states block continuation',()=>{
 const a='11111111-2222-3333-4444-555555555555',b='aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
 const observed={project:'/p',slot:1,source:'codex',session:b};assert.equal(residentThread([], '/p',1,observed),b);assert.equal(residentThread([{project:'/p',slot:1,conversationSession:a},{project:'/p',slot:2,conversationSession:b}],'/p',1,observed),a);
 assert.equal(residentThread([],'/p',1,{source:'claude-code',session:a}),null);
 for(const state of ['reading','editing','running','thinking','error'])assert.equal(threadBusy([{session:a,state}],a),true);
 for(const state of ['waiting_for_user','done','idle'])assert.equal(threadBusy([{session:a,state}],a),false);
});

test('Claude continuity uses only its own game sessions, never Codex or desktop sessions',()=>{
 const a='11111111-2222-3333-4444-555555555555',b='aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
 const runs=[{project:'/p',slot:1,provider:'claude',conversationSession:a},{project:'/p',slot:1,provider:'codex',conversationSession:b}];
 assert.equal(residentThread(runs,'/p',1,null,'claude'),a);assert.equal(residentThread(runs,'/p',1,null,'codex'),b);assert.equal(residentThread([],'/p',1,{source:'claude-code',session:a},'claude'),null);
});

test('ownership never borrows another resident or home and legacy duplicates have one owner',()=>{
 const id='11111111-2222-3333-4444-555555555555';
 const runs=[{project:'/p',slot:2,conversationSession:id},{project:'/p',slot:1,resumeSession:id}];
 const conversations=[{source:'codex',project:'/p',id,residentSlot:1}];
 assert.equal(threadOwner(runs,conversations,'/p',id),2);
 assert.equal(ownsThread(runs,conversations,'/p',1,id),false);
 assert.equal(ownsThread(runs,conversations,'/p',2,id),true);
 assert.equal(ownsThread(runs,conversations,'/other',2,id),false);
 assert.equal(ownsThread(runs,conversations,'/p',2,id,'claude'),false);
 assert.equal(residentThread([],'/p',1,{project:'/p',slot:2,source:'codex',session:id}),null);
 const resident={lot:{project:'/p'},character:{slot:2},name:'Second'};
 assert.deepEqual(promptResident(resident),{project:'/p',slot:2,name:'Second'});
 assert.deepEqual(promptResident({isVisitor:true,parent:resident}),promptResident(resident));
});

test('new and continued chats wait for work on the selected resident only',()=>{
 const sessions=[{session:'active',project:'/p',slot:2,state:'thinking'}];
 assert.equal(residentBusy(sessions,'/p',2),true);
 assert.equal(residentBusy(sessions,'/p',1),false);
 assert.equal(residentBusy(sessions,'/other',2),false);
 assert.equal(residentBusy([{...sessions[0],state:'waiting_for_user'}],'/p',2),false);
});

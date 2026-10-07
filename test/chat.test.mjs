import test from 'node:test';
import assert from 'node:assert/strict';
import {chatThreads,chatMessages,responseText,runThread,chatConversation} from '../shared/chat.mjs';
const one='11111111-1111-1111-1111-111111111111',two='22222222-2222-2222-2222-222222222222';
const run=(id,thread,extra={})=>({id,project:'/sample',slot:1,conversationSession:thread,instruction:'Prompt '+id,status:'completed',result:{summary:'Answer '+id,checks:['Reported test'],limitations:['Unknown'],next:null},...extra});
test('chat groups only the selected resident and exact thread, preserving prompt/response pairs',()=>{
 const runs=[run('a',one),run('b',two),run('c',one),run('foreign',one,{project:'/other'}),run('visitor',one,{slot:2})];
 const threads=chatThreads(runs,'/sample',1);
 assert.equal(threads.length,2);assert.deepEqual(threads.find(t=>t.id===one).runs.map(r=>r.id),['a','c']);
 const msgs=chatMessages(threads.find(t=>t.id===one).runs);
 assert.deepEqual(msgs.map(m=>m.role),['user','assistant','user','assistant']);assert.equal(msgs[0].text,'Prompt a');assert.match(msgs[1].text,/Answer a.*Checks.*Reported test.*Limitations.*Unknown/s);
});
test('failed continuations retain the target and their own error without borrowing an answer',()=>{
 const failed=run('failure',null,{resumeSession:one,result:null,status:'failed',error:'Thread owned by desktop'});
 assert.equal(runThread(failed),one);const msgs=chatMessages([failed]);assert.equal(msgs[1].failed,true);assert.match(msgs[1].text,/Thread owned by desktop/);assert.doesNotMatch(msgs[1].text,/Answer/);
 assert.equal(runThread({...failed,resumeSession:'invalid'}),null);
});
test('queued human message appears once and running/completed states retain recorded content',()=>{
 const p={id:'p',status:'approved',instruction:'Human message'};
 assert.deepEqual(chatMessages([],p).map(m=>m.text),['Human message','Your message is queued.']);
 const running=run('r',one,{proposalId:'p',instruction:'Human message',status:'running',result:null});
 const msgs=chatMessages([running],p);assert.equal(msgs.length,2);assert.equal(msgs[1].pending,true);
 assert.match(responseText(run('done',one,{result:{summary:'Done',checks:[],limitations:[],next:{title:'Suggestion',instruction:'Do later'}}})),/Next\nSuggestion\nDo later/);
 assert.deepEqual(chatMessages([]),[]);
});

test('public summaries remain attached to their exact reply after completion',()=>{
 const msgs=chatMessages([run('a',one,{reasoningSummaries:[{id:'r',text:'Public summary',raw_content:'PRIVATE'}]}),run('b',one)]);
 assert.deepEqual(msgs[1].reasoningSummaries,[{id:'r',text:'Public summary'}]);assert.deepEqual(msgs[3].reasoningSummaries,[]);assert.doesNotMatch(JSON.stringify(msgs),/PRIVATE/);
});

test('saved chat names follow exact project/source/thread identity without altering messages',()=>{
 const runs=[run('a',one),run('b',two),run('c',one)];
 const conversations=[{key:'wrong-source',source:'claude',project:'/sample',id:one,title:'Foreign provider'},
  {key:'wrong-home',source:'codex',project:'/other',id:one,title:'Foreign project'},
  {key:'exact',source:'codex',project:'/sample',id:one,title:'My renamed chat'}];
 const before=chatMessages(runs);const threads=chatThreads(runs,'/sample',1,conversations);
 assert.equal(threads.find(t=>t.id===one).title,'My renamed chat');assert.equal(threads.find(t=>t.id===one).conversation.key,'exact');
 assert.equal(threads.find(t=>t.id===two).title,'Prompt b');assert.deepEqual(chatMessages(runs),before);
 assert.equal(chatConversation(conversations,'/sample','unstarted'),null);
 assert.equal(chatConversation(conversations,'/missing',one),null);
});

test('provider identity separates same UUID chats, titles and replies',()=>{
 const runs=[run('codex',one),run('claude',one,{provider:'claude'})];
 const conversations=[{source:'codex',project:'/sample',id:one,title:'Codex title'},{source:'claude-code',project:'/sample',id:one,title:'Claude title'}];
 assert.equal(chatThreads(runs,'/sample',1,conversations)[0].title,'Codex title');assert.equal(chatThreads(runs,'/sample',1,conversations,'claude')[0].title,'Claude title');assert.equal(chatMessages([runs[1]])[1].provider,'claude');
});

import test from 'node:test';import assert from 'node:assert/strict';
import {markdown,progressHtml} from '../web/src/chat-markdown.js';
import {publicAction,conversationalInstruction} from '../shared/chat-progress.mjs';
import {passResult} from '../bridge/passes.mjs';
import {CodexTurn} from '../bridge/codex-turn.mjs';
test('assistant Markdown formats emphasis, lists, code, links, tables and quotes without executable HTML',()=>{
 const html=markdown('**Answer**\n\n- One\n- Two\n\n```js\n<img onerror=evil()>\n```\n\n[Safe](https://example.com) [Unsafe](javascript:evil)\n\n> Note\n\n| A | B |\n| --- | --- |\n| 1 | 2 |\n\n<script>evil()</script>');
 for(const expected of ['<strong>Answer</strong>','<ul><li>One</li><li>Two</li></ul>','<pre><code','<table>','<blockquote>','&lt;script&gt;'])assert.ok(html.includes(expected),expected);
 assert.doesNotMatch(html,/<img|<script|href="javascript:/);assert.match(html,/rel="noopener noreferrer"/);
});
test('presentation retains consecutive action counts and text in observed order',()=>{
 const html=progressHtml([{text:'I will check **this**.',kind:'commentary'},{text:'Ran a command',kind:'action'},{text:'Ran a command',kind:'action'},{text:'Found the problem.',kind:'commentary'}]);
 assert.match(html,/I will check <strong>this<\/strong>.*Ran a command × 2.*Found the problem/s);
});
test('action projection drops all arguments, outputs, paths, URLs and unknown events',()=>{
 assert.deepEqual(publicAction({id:'x',type:'commandExecution',command:'SECRET',output:'SECRET'},true),{id:'action:x',type:'reasoning',kind:'action',text:'Ran a command'});
 assert.equal(publicAction({id:'x',type:'reasoning',raw_content:'SECRET'},true),null);
 assert.match(conversationalInstruction,/natural answer/);
 const text='Long useful answer. '.repeat(500);assert.equal(passResult({summary:text,checks:[],limitations:[],next:null}).summary,text.trim());
});
test('Codex commentary and actual actions stream only for the exact turn, without tool payloads or final JSON',()=>{
 const entries=[],turn=new CodexTurn({onReasoning:e=>entries.push(e)});turn.thread='thread';turn.turn='turn';
 const emit=(method,item,more={})=>turn.message({method,params:{threadId:'thread',turnId:'turn',item,...more}});
 emit('item/started',{id:'c',type:'agentMessage',phase:'commentary'});
 emit('item/agentMessage/delta',undefined,{itemId:'c',delta:'Checking files.'});
 emit('item/completed',{id:'c',type:'agentMessage',phase:'commentary',text:'Checking files.'});
 emit('item/completed',{id:'cmd',type:'commandExecution',command:'SECRET',aggregatedOutput:'SECRET'});
 turn.message({method:'item/completed',params:{threadId:'foreign',turnId:'turn',item:{id:'bad',type:'commandExecution'}}});
 emit('item/completed',{id:'final',type:'agentMessage',phase:'final_answer',text:'{"summary":"Answer"}'});
 assert.equal(entries[0].kind,'commentary');assert.equal(entries.at(-1).text,'Ran a command');assert.doesNotMatch(JSON.stringify(entries),/SECRET|bad|summary/);
});

test('public commentary takes precedence over duplicate model summaries without rewriting it',()=>{
 const html=progressHtml([{text:'I am thinking about checking',id:'r'},{text:'I found the issue.',kind:'commentary'},{text:'Viewed an image',kind:'action'}]);assert.doesNotMatch(html,/thinking/);assert.match(html,/I found the issue.*Viewed an image/s);
});
test('Claude actions expose fixed labels and wait for tool results before completion',async()=>{
 const {ClaudeProgress}=await import('../bridge/claude-progress.mjs');const out=[],p=new ClaudeProgress(e=>out.push(e));
 p.consume({type:'assistant',message:{role:'assistant',id:'m',content:[{type:'tool_use',id:'call',name:'Bash',input:{command:'SECRET'}}]}});
 assert.equal(out.at(-1).text,'Using a tool');p.consume({type:'user',message:{content:[{type:'tool_result',tool_use_id:'call',content:'SECRET'}]}});assert.equal(out.at(-1).text,'Ran a command');assert.doesNotMatch(JSON.stringify(out),/SECRET/);
});

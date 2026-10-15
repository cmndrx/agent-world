import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {ClaudeProgress} from '../bridge/claude-progress.mjs';
import {PassStore} from '../bridge/passes.mjs';
import {PassRunner} from '../bridge/pass-runner.mjs';
import {chatMessages} from '../shared/chat.mjs';

const session='12345678-1234-1234-1234-123456789abc';
const stream=event=>({type:'stream_event',session_id:session,parent_tool_use_id:null,event});
const start=(id='msg_public')=>stream({type:'message_start',message:{id,role:'assistant'}});
const block=(index,type='text',text='')=>stream({type:'content_block_start',index,content_block:{type,text}});
const delta=(index,text,type='text_delta')=>stream({type:'content_block_delta',index,delta:{type,text,thinking:'PRIVATE',partial_json:'PRIVATE'}});
const complete={type:'assistant',session_id:session,parent_tool_use_id:null,message:{id:'msg_public',role:'assistant',content:[{type:'text',text:'Checking the files.'}]}};

test('public text deltas are bounded, deduplicated and exclude thinking, signatures, tools and subagents',()=>{
 const output=[],p=new ClaudeProgress(item=>output.push(item));
 p.consume(delta(0,'PRIVATE'));p.consume(start());p.consume(block(0));p.consume(delta(0,'Checking '));p.consume(delta(0,'the files.'));p.consume(complete);
 assert.equal(output.length,2);assert.equal(output.at(-1).text,'Checking the files.');
 for(const type of ['thinking','redacted_thinking','tool_use','tool_result']){p.consume(block(1,type));p.consume(delta(1,'PRIVATE'));}
 p.consume(delta(0,'PRIVATE','thinking_delta'));p.consume(delta(0,'PRIVATE','signature_delta'));p.consume(delta(0,'PRIVATE','input_json_delta'));
 p.consume({...delta(0,'PRIVATE'),parent_tool_use_id:'tool_child'});p.consume(stream({type:'content_block_stop',index:0}));p.consume(delta(0,'PRIVATE'));
 assert.equal(output.length,2);assert.doesNotMatch(JSON.stringify(p),/PRIVATE/);
 p.consume(start('msg_bounded'));p.consume(block(0));for(let i=0;i<100;i++)p.consume(delta(0,'x'.repeat(5000)));
 assert.equal(output.at(-1).text.length,4000);
 for(let i=0;i<100;i++){p.consume(start('msg_'+i));for(let b=0;b<100;b++)p.consume(block(b,'text','bounded'));}
 assert.equal(p.messages.size,32);assert.equal(p.current.blocks.size,32);
});
test('complete public blocks work without partial frames, deduplicate replays and ignore unknown shapes',()=>{
 const output=[],p=new ClaudeProgress(x=>output.push(x));p.consume(complete);p.consume(complete);
 p.consume({...complete,message:{...complete.message,content:[{type:'text',text:'Another public update.'}]}});
 for(const type of ['thinking','summary','stdout','tool_result'])p.consume({type,text:'PRIVATE'});
 assert.deepEqual(output.map(x=>x.text),['Checking the files.','Another public update.']);
});

for(const mode of ['completed','cut-off','missing','wrong-session','changed-init','before-init'])test('isolated Claude runner progress: '+mode,async t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'aw-claude-progress-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 const project=fs.realpathSync(dir),store=new PassStore(path.join(dir,'passes.json')),cli=path.join(dir,'fixture.cjs');
 const frames=[{type:'system',subtype:'init',session_id:session}];
 if(mode==='before-init')frames.unshift(start(),block(0),delta(0,'PRIVATE_BEFORE_INIT'));
 if(mode!=='missing'&&mode!=='before-init')frames.push(start(),block(0),delta(0,'Checking '),delta(0,'the files.'),complete,block(1,'thinking'),delta(1,'PRIVATE_THINKING'),block(2,'tool_use'),delta(2,'PRIVATE_TOOL'));
 if(mode==='wrong-session')frames.push({...delta(0,'PRIVATE_WRONG_SESSION'),session_id:'22345678-1234-1234-1234-123456789abc'});
 if(mode==='changed-init')frames.push({type:'system',subtype:'init',session_id:'22345678-1234-1234-1234-123456789abc'});
 const result={type:'result',session_id:session,subtype:'success',structured_output:{summary:'Fixture report',checks:[],limitations:[],next:null}};
 fs.writeFileSync(cli,`#!/usr/bin/env node
process.stdin.resume();process.stdin.on('end',()=>{
 if(!process.argv.includes('--include-partial-messages'))process.exit(2);
 process.stdout.write('ARBITRARY_PRIVATE_STDOUT\\n');
 const frames=${JSON.stringify(frames)};for(const frame of frames){const line=JSON.stringify(frame)+'\\n';process.stdout.write(line.slice(0,11));process.stdout.write(line.slice(11));}
 setTimeout(()=>{${mode==='cut-off'?'process.exit(1)':`console.log(JSON.stringify(${JSON.stringify(result)}))`}},80);
});`,{mode:0o700});
 const p=store.propose({project,slot:1,title:'Fixture',instruction:'Fixture only',provider:'claude'},{[project]:{}});
 store.decide({id:p.id,version:p.version,action:'approve',confirmed:true},{[project]:{}});
 const updates=[],runner=new PassRunner(store,{enabled:true,claude:cli,onChange:()=>updates.push(store.snapshot())});t.after(()=>runner.stop());await runner.tick();
 const run=store.snapshot().runs[0];assert.equal(run.status,['cut-off','wrong-session','changed-init'].includes(mode)?'failed':'completed',run.error);
 if(['missing','before-init'].includes(mode))assert.equal(run.reasoningSummaries,undefined);
 else{
  assert.ok(updates.some(s=>s.runs[0]?.status==='running'&&s.runs[0]?.reasoningSummaries?.[0]?.text==='Checking'));
  assert.deepEqual(run.reasoningSummaries,[{id:'claude:msg_public:0',text:'Checking the files.'}]);
  assert.equal(chatMessages([run],[])[1].reasoningSummaries[0].text,'Checking the files.');
  assert.deepEqual(new PassStore(store.file).snapshot().runs[0].reasoningSummaries,run.reasoningSummaries);
 }
 if(['wrong-session','changed-init'].includes(mode)){assert.match(run.error,/different conversation/);assert.equal(run.result,null);}
 assert.doesNotMatch(fs.readFileSync(store.file,'utf8'),/PRIVATE|ARBITRARY/);
});

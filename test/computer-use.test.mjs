import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {PassThrough} from 'node:stream';
import os from 'node:os';
import {ComputerUse} from '../bridge/computer-use.mjs';
function fixture({unknown=false,documentation=false}={}){
 const child=new EventEmitter();child.stdin=new PassThrough();child.stdout=new PassThrough();child.kill=()=>{};const sent=[];
 child.stdin.on('data',chunk=>{const m=JSON.parse(chunk);sent.push(m);queueMicrotask(()=>{
  const reply=result=>child.stdout.write(JSON.stringify({id:m.id,result})+'\n');
  if(m.method==='initialize')reply({});
  if(m.method==='thread/start')reply({thread:{id:'test-thread'}});
  if(m.method==='mcpServer/tool/call')child.stdout.write(JSON.stringify({id:0,method:'mcpServer/elicitation/request',params:{threadId:'test-thread',serverName:'cua_repl',mode:'form',message:'Allow app?',_meta:{connector_id:unknown?'other':'computer-use',tool_name:'get_app_state',tool_params:{app:'dev.agentworld.app'},persist:['session','always']}}})+'\n');
  if(!m.method&&m.id===0){const call=sent.find(s=>s.method==='mcpServer/tool/call');child.stdout.write(JSON.stringify({id:call.id,result:{content:[...(documentation?[{type:'text',text:'## Computer Use\nControls and documentation.'}]:[]),{type:'text',text:m.result.action==='accept'?'Window: Agent World, App: Agent World.':'Computer Use was not approved to use Agent World'}]}})+'\n');}
 });});
 const service=new ComputerUse({spawnChild:()=>child,timeoutMs:10000});return {service,sent,child};
}
const settle=()=>new Promise(r=>setTimeout(r,20));
test('native approval is delivered and never accepted until a human decision',async()=>{
 const {service,sent}=fixture();service.start({project:'/tmp',slot:1,app:'Agent World'});await settle();
 assert.equal(service.snapshot().status,'approval');assert.equal(sent.some(m=>m.result?.action==='accept'),false);
 const state=service.snapshot();assert.throws(()=>service.decide({id:state.id,approvalId:'stale',action:'always'}),/no longer/);
 service.decide({id:state.id,approvalId:state.approval.id,action:'always'});await settle();
 assert.equal(service.snapshot().status,'verified');assert.deepEqual(sent.find(m=>m.result?.action==='accept').result,{action:'accept',content:{},_meta:{persist:'always'}});
 assert.equal(sent.some(m=>m.method==='turn/start'),false);assert.equal(sent.find(m=>m.method==='thread/start').params.ephemeral,true);assert.equal(sent.find(m=>m.method==='thread/start').params.cwd,os.tmpdir());
});
test('denial produces unavailable and no interface success',async()=>{
 const {service}=fixture();service.start({project:'/tmp',slot:1,app:'Agent World'});await settle();const s=service.snapshot();service.decide({id:s.id,approvalId:s.approval.id,action:'deny'});await settle();assert.equal(service.snapshot().status,'unavailable');assert.match(service.snapshot().message,/not approved/);
});
test('unrelated elicitation is declined instead of surfaced or granted',async()=>{
 const {service,sent}=fixture({unknown:true});service.start({project:'/tmp',slot:1,app:'Agent World'});await settle();assert.equal(service.snapshot().status,'unavailable');assert.equal(sent.find(m=>m.id===0&&m.result).result.action,'decline');
});
test('cancel resolves pending provider approval and stale decisions fail',async()=>{
 const {service,sent}=fixture();service.start({project:'/tmp',slot:1,app:'Agent World'});await settle();const s=service.snapshot();service.cancel();await settle();assert.equal(service.snapshot().status,'cancelled');assert.equal(sent.find(m=>m.id===0&&m.result).result.action,'cancel');assert.throws(()=>service.decide({id:s.id,approvalId:s.approval.id,action:'always'}));
});
test('only one connection waits at a time and app input cannot inject code',async()=>{
 const {service,sent}=fixture();assert.throws(()=>service.start({project:'/tmp',slot:1,app:'bad\nname'}));service.start({project:'/tmp',slot:1,app:'app"; malicious()'});assert.throws(()=>service.start({project:'/tmp',slot:1,app:'other'}),/already waiting/);await settle();assert.equal(sent.find(m=>m.method==='mcpServer/tool/call').params.arguments.code,'let app = await cua.getApp("app\\\"; malicious()");');service.cancel();
});
test('an old connection closing cannot cancel a replacement connection',async()=>{
 const children=[];const service=new ComputerUse({spawnChild:()=>{const f=fixture();children.push(f.child);return f.child;},timeoutMs:10000});
 service.start({project:'/tmp',slot:1,app:'First'});await settle();service.cancel();service.start({project:'/tmp',slot:1,app:'Second'});children[0].emit('close');await settle();assert.equal(service.snapshot().status,'approval');service.cancel();
});
test('setup drops parent chat identity while retaining CLI configuration and runtime',async()=>{
 const original=process.env.CODEX_THREAD_ID;process.env.CODEX_THREAD_ID='stale-parent-thread';let options;const f=fixture();const s=new ComputerUse({spawnChild:(command,args,o)=>{options=o;return f.child;}});
 try{s.start({project:'/tmp',slot:1,app:'Agent World'});await settle();assert.equal(options.cwd,os.tmpdir());assert.equal(options.env.CODEX_THREAD_ID,undefined);assert.equal(options.env.HOME,process.env.HOME);assert.equal(options.env.CODEX_HOME,process.env.CODEX_HOME);assert.equal(options.env.CODEX_MCP_NODE_PATH,process.env.CODEX_MCP_NODE_PATH);}finally{s.cancel();if(original===undefined)delete process.env.CODEX_THREAD_ID;else process.env.CODEX_THREAD_ID=original;}
});

test('startup timeout fails without accepting anything or leaving a waiting process',async()=>{
 const child=new EventEmitter();child.stdin=new PassThrough();child.stdout=new PassThrough();let stopped=false;child.kill=()=>{stopped=true;};
 const service=new ComputerUse({spawnChild:()=>child,startupTimeoutMs:5});service.start({project:'/tmp',slot:1,app:'Agent World'});await settle();assert.equal(service.snapshot().status,'unavailable');assert.match(service.snapshot().message,/No app access was granted/);assert.equal(stopped,true);assert.equal(service.child,null);
});

test('first-use documentation before native state is recognized as verified',async()=>{
 const {service}=fixture({documentation:true});service.start({project:'/tmp',slot:1,app:'Agent World'});await settle();const s=service.snapshot();service.decide({id:s.id,approvalId:s.approval.id,action:'always'});await settle();assert.equal(service.snapshot().status,'verified');assert.equal(service.snapshot().message,'Native app access verified.');
});

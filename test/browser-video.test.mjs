import test from 'node:test';import assert from 'node:assert/strict';import {EventEmitter} from 'node:events';
import {BrowserVideo} from '../bridge/browser-video.mjs';
import {createRequire} from 'node:module';const require=createRequire(import.meta.url);const {taskUrl,TaskBrowsers}=require('../electron/task-browser.cjs');
test('video tokens are per active run, expire on stop, and never appear in metadata',async()=>{
 const active=new Set(['a','b']),sent=[];const video=new BrowserVideo({send:m=>sent.push(m),isActive:id=>active.has(id)});
 const a=video.register('a'),b=video.register('b');assert.notEqual(a,b);assert.equal(video.authorized(a),'a');assert.equal(video.authorized('wrong'),undefined);assert.doesNotMatch(JSON.stringify(video.view('a')),new RegExp(a));
 const result=video.control(a,'inspect');const message=sent.at(-1);video.receive({type:'browser-response',runId:'b',requestId:message.requestId,result:{wrong:true}});assert.equal(video.pending.size,1);video.receive({type:'browser-response',runId:'a',requestId:message.requestId,result:{ok:true}});assert.deepEqual(await result,{ok:true});
 active.delete('a');await assert.rejects(video.control(a,'open'),/expired/);video.end('a');assert.equal(video.authorized(a),undefined);assert.equal(video.view('a').status,'ended');video.close();
});
test('MJPEG frames remain scoped, bound buffering and close all consumers on run end',()=>{
 let now=10000;const sent=[];const video=new BrowserVideo({send:m=>sent.push(m),isActive:()=>true,now:()=>now});video.register('a');video.register('b');
 const res=new EventEmitter();Object.assign(res,{writableLength:0,writeHead(code,headers){this.headers=headers;},parts:[],write(part){this.parts.push(part)},end(part){this.parts.push(part);this.ended=true;}});
 assert.equal(video.stream('a',res),true);assert.match(res.headers['Content-Type'],/multipart/);
 video.receive({type:'browser-video-frame',runId:'b',data:'aGVsbG8='});assert.equal(res.parts.length,0);
 video.receive({type:'browser-video-frame',runId:'a',data:'aGVsbG8='});assert.equal(video.view('a').sequence,1);assert.match(res.parts[0],/Content-Length: 5/);assert.equal(res.parts[1].toString(),'hello');
 res.writableLength=3*1024*1024;video.receive({type:'browser-video-frame',runId:'a',data:'aGVsbG8='});assert.equal(res.parts.length,3);
 now+=6000;assert.equal(video.view('a').status,'disconnected');video.end('a');assert.equal(res.ended,true);assert.equal(video.runs.get('a').clients.size,0);assert.equal(video.stream('a',res),false);video.close();
});
test('task browser refuses credential/file/native targets and empty standalone IPC runtime',()=>{
 for(const url of ['file:///etc/passwd','javascript:alert(1)','https://user:secret@example.com','codex://threads/123'])assert.throws(()=>taskUrl(url));
 assert.equal(taskUrl('http://127.0.0.1:4798/'),'http://127.0.0.1:4798/');const video=new BrowserVideo();assert.equal(video.register('a'),null);assert.equal(video.view('a').available,false);
});

test('viewer arriving before browser open still receives continuous painting and close clears it',async()=>{
 const sent=[];let wc;
 class Window{constructor(){wc=new EventEmitter();Object.assign(wc,{session:{setPermissionRequestHandler(){},setPermissionCheckHandler(){},on(){}},setWindowOpenHandler(){},setFrameRate(){},stopPainting(){this.paused=true},startPainting(){this.paused=false},invalidate(){},getURL:()=> 'http://localhost/',getTitle:()=> 'Fixture'});this.webContents=wc;}async loadURL(){}destroy(){this.destroyed=true}isDestroyed(){return !!this.destroyed}}
 const browser=new TaskBrowsers({BrowserWindow:Window,send:(m,cb)=>{sent.push(m);cb?.();}});
 await browser.command({type:'browser-command',runId:'a',operation:'watch',args:{enabled:true}});
 await browser.command({type:'browser-command',runId:'a',operation:'open',args:{url:'http://localhost/'}});
 assert.equal(browser.runs.get('a').watch,true);wc.emit('paint',null,{}, {toJPEG:()=>Buffer.from('frame')});assert.equal(wc.paused,undefined);assert.ok(sent.some(m=>m.type==='browser-video-frame'));
 await browser.command({type:'browser-command',runId:'a',operation:'watch',args:{enabled:false}});assert.equal(wc.paused,true);browser.shutdown();assert.equal(browser.runs.size,0);assert.equal(browser.watching.size,0);
});
test('human approval grants only the exact action once and rejects changed targets',async()=>{
 const video=new BrowserVideo({send:()=>{},isActive:()=>true});const token=video.register('a');let sent=[];
 video.request=async(id,op,args)=>{sent.push(op);return op==='context'?{pageId:'page',url:'http://localhost/test?secret=not-public',title:'Owned page',target:'target',targetLabel:'Test button'}:{ok:true};};
 await assert.rejects(video.control(token,'click',{x:10,y:20}),/needs your approval/);
 const wait=video.approval('a',{tool:'click',args:{x:10,y:20},message:'Provider asks'});await new Promise(r=>setImmediate(r));const approval=video.approvalView('a');assert.equal(approval.page,'http://localhost/test');
 await assert.rejects(video.decide('a','stale',true),/no longer waiting/);await video.decide('a',approval.id,true);assert.equal(await wait,true);
 await video.control(token,'click',{x:10,y:20});assert.equal(sent.at(-1),'click');await assert.rejects(video.control(token,'click',{x:10,y:20}),/needs your approval/);
 const second=video.approval('a',{tool:'fill',args:{selector:'#field',text:'value'},message:'Fill?'});await new Promise(r=>setImmediate(r));const id=video.approvalView('a').id;video.request=async()=>({pageId:'different',url:'http://localhost/',target:'changed'});await assert.rejects(video.decide('a',id,true),/changed/);assert.equal(await second,false);video.close();
});
test('pointer subscribers receive only actual scoped input and close with the run',()=>{
 const video=new BrowserVideo({send:()=>{},isActive:()=>true});video.register('a');video.register('b');const res=new EventEmitter();res.parts=[];res.writableLength=0;res.writeHead=()=>{};res.write=p=>res.parts.push(p);res.end=()=>{res.ended=true;res.emit('close');};video.pointerStream('a',res);
 video.receive({type:'browser-pointer',runId:'b',x:20,y:30,kind:'click'});assert.equal(res.parts.length,0);video.receive({type:'browser-pointer',runId:'a',x:20,y:30,kind:'click'});assert.match(res.parts[0],/"kind":"click"/);video.receive({type:'browser-pointer',runId:'a',x:9000,y:30,kind:'click'});assert.equal(res.parts.length,1);video.end('a');assert.equal(res.ended,true);video.close();
});
test('native pointer telemetry comes after dispatched inputs and stale approval prevents a click',async()=>{
 const sent=[],inputs=[];let wc;
 class Window{constructor(){wc=new EventEmitter();Object.assign(wc,{session:{setPermissionRequestHandler(){},setPermissionCheckHandler(){},on(){}},setWindowOpenHandler(){},setFrameRate(){},getURL:()=> 'http://localhost/',getTitle:()=> 'Owned',executeJavaScript:async()=>({target:'button',targetLabel:'Test'}),debugger:{isAttached:()=>true,sendCommand:async(_method,event)=>inputs.push(event)}});this.webContents=wc;}async loadURL(){}destroy(){this.destroyed=true}isDestroyed(){return !!this.destroyed}}
 const browser=new TaskBrowsers({BrowserWindow:Window,send:(m,cb)=>{sent.push(m);cb?.();}});await browser.command({type:'browser-command',runId:'a',operation:'open',args:{url:'http://localhost/'}});
 await browser.command({type:'browser-command',runId:'a',requestId:'no',operation:'click',args:{x:10,y:20,_pageId:'old',_target:'button',_url:'http://localhost/'}});assert.equal(inputs.length,0);assert.match(sent.at(-1).error,/changed/);
 const pageId=browser.runs.get('a').pageId;await browser.command({type:'browser-command',runId:'a',requestId:'yes',operation:'click',args:{x:10,y:20,_pageId:pageId,_target:'button',_url:'http://localhost/'}});
 assert.equal(inputs.filter(e=>e.type==='mouseMoved').length,16);assert.equal(inputs.filter(e=>e.type==='mousePressed').length,1);assert.equal(sent.filter(e=>e.type==='browser-pointer'&&e.kind==='move').length,16);assert.equal(sent.find(e=>e.kind==='click').x,10);browser.shutdown();
});

test('Claude browser writes wait for a human decision; deny and stop send no input',async()=>{
 const video=new BrowserVideo({send:()=>{},isActive:()=>true});const token=video.register('claude-run','claude');const inputs=[];
 video.request=async(id,op,args)=>{if(op==='context')return {pageId:'page',url:'http://localhost/',title:'Fixture',target:'button',targetLabel:'Test'};inputs.push({op,args});return {ok:true};};
 const denied=video.control(token,'click',{x:10,y:20});await new Promise(r=>setImmediate(r));assert.equal(inputs.length,0);await video.decide('claude-run',video.approvalView('claude-run').id,false);await assert.rejects(denied,/declined/);assert.equal(inputs.length,0);
 const approved=video.control(token,'click',{x:10,y:20});await new Promise(r=>setImmediate(r));await video.decide('claude-run',video.approvalView('claude-run').id,true);await approved;assert.equal(inputs.length,1);assert.equal(inputs[0].args._pageId,'page');assert.equal(video.runs.get('claude-run').grant,null);
 const stopped=video.control(token,'fill',{selector:'#field',text:'test'});await new Promise(r=>setImmediate(r));video.end('claude-run');await assert.rejects(stopped,/declined/);assert.equal(inputs.filter(i=>i.op==='fill').length,0);
});

test('explicit Claude full access skips per-action approval while binding the actual browser target',async()=>{
 const active=new Set(['full','ask']);const video=new BrowserVideo({send:()=>{},isActive:id=>active.has(id)});const token=video.register('full','claude','full');const sent=[];
 video.request=async(id,op,args)=>{sent.push({id,op,args});return op==='context'?{pageId:'page1',url:'http://localhost/fixture',target:'button1'}:{ok:true};};
 assert.deepEqual(await video.control(token,'click',{selector:'#test'}),{ok:true});assert.equal(video.approvalView('full'),null);assert.deepEqual(sent.map(s=>s.op),['context','click']);assert.equal(sent[1].args._target,'button1');assert.equal(sent[1].args._pageId,'page1');
 video.request=async()=>{active.delete('full');return {pageId:'page1',url:'http://localhost/fixture',target:'button1'};};await assert.rejects(video.control(token,'fill',{selector:'#test',value:'fixture'}),/expired/);video.close();
});

test('Codex Full access config and browser actions skip UI while keeping current target and Stop checks',async()=>{
 let active=true;const video=new BrowserVideo({send:()=>{},isActive:()=>active}),token=video.register('full-codex','codex','full');video.request=async(id,op,args)=>op==='context'?{pageId:'page',url:'http://localhost/test',target:'target'}:{ok:true};assert.match(video.args(true).join(' '),/default_tools_approval_mode="approve"/);assert.match(video.args().join(' '),/default_tools_approval_mode="writes"/);assert.equal(await video.approval('full-codex',{tool:'click',args:{selector:'#test'}}),true);assert.equal(video.approvalView('full-codex'),null);assert.deepEqual(await video.control(token,'click',{selector:'#test'}),{ok:true});active=false;await assert.rejects(video.control(token,'click',{selector:'#test'}),/expired/);video.close();
});

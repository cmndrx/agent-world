import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import os from 'node:os';import path from 'node:path';
import {browserFrames,previewServer} from '../scripts/browser-preview.mjs';
const item=content=>({type:'item.completed',item:{type:'mcp_tool_call',server:'cua_repl',tool:'js',arguments:{code:'await tab.getScreenshot();'},result:{content}}});
const fixture={type:'image',mimeType:'image/png',data:'aXNvbGF0ZWQtdGVzdA=='};
test('viewer accepts only completed screenshot images and distinguishes ended runs',()=>{
 const valid=item([fixture]);assert.equal(browserFrames(JSON.stringify(valid)).frames.length,1);
 for(const invalid of [{...valid,type:'item.started'},{...valid,item:{...valid.item,error:'failed'}},item([{...fixture,mimeType:'image/svg+xml'}]),item([{...fixture,data:'<script>'}]),{...valid,item:{...valid.item,arguments:{code:'await cua.getState();'}}}])assert.equal(browserFrames(JSON.stringify(invalid)).frames.length,0);
 assert.equal(browserFrames(JSON.stringify(valid)+'\r\n'+JSON.stringify({type:'turn.completed'})+'\npartial').ended,true);
 assert.equal(browserFrames(JSON.stringify({type:'turn.completed'})+'\n'+JSON.stringify({type:'turn.started'})).ended,false);
});
test('loopback viewer exposes bounded frames, refuses writes and reports missing sources',async t=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'aw-browser-preview-')),file=path.join(root,'events.jsonl');fs.writeFileSync(file,JSON.stringify(item([fixture])));const server=previewServer(file);await new Promise(r=>server.listen(0,'127.0.0.1',r));t.after(async()=>{server.closeAllConnections();await new Promise(r=>server.close(r));fs.rmSync(root,{recursive:true,force:true});});const base='http://127.0.0.1:'+server.address().port;
 assert.equal((await(await fetch(base+'/status')).json()).count,1);assert.equal(await(await fetch(base+'/frame?index=0')).text(),'isolated-test');assert.equal((await fetch(base+'/frame?index=-1')).status,404);assert.equal((await fetch(base,{method:'POST'})).status,405);assert.equal((await fetch(base+'/../package.json')).status,404);fs.unlinkSync(file);assert.equal((await(await fetch(base+'/status')).json()).error,true);
});

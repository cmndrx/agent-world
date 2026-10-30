import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import ready from '../electron/bridge-ready.cjs';
async function server(t,handler){const s=http.createServer(handler);await new Promise(r=>s.listen(0,'127.0.0.1',r));t.after(()=>{s.closeAllConnections();s.close();});return s.address().port;}
test('desktop cold start accepts responses slower than the former 800ms probe',async t=>{
 const port=await server(t,(req,res)=>setTimeout(()=>res.end(req.url==='/'?'<html>Game</html>':JSON.stringify({households:[]})),900));
 assert.equal(await ready.waitForBridge(port,{timeoutMs:3000,requestMs:1200}),true);
});
test('readiness retries a warming server and requires both game HTML and valid state',async t=>{
 let pages=0;const port=await server(t,(req,res)=>{if(req.url==='/'){pages++;res.statusCode=pages<3?503:200;res.end('<html>Game</html>');}else res.end(JSON.stringify({households:[]}));});
 assert.equal(await ready.waitForBridge(port,{timeoutMs:1000,intervalMs:5}),true);assert.equal(pages,3);
});
test('hung and foreign services fail within the total deadline and permit retrying the same server',async t=>{
 let healthy=false;const port=await server(t,(req,res)=>{if(healthy)res.end(req.url==='/'?'<html>Game</html>':JSON.stringify({households:[]}));});
 const start=Date.now();assert.equal(await ready.waitForBridge(port,{timeoutMs:100,requestMs:1000,intervalMs:5}),false);assert.ok(Date.now()-start<500);
 healthy=true;assert.equal(await ready.waitForBridge(port,{timeoutMs:1000}),true);
 const foreign=await server(t,(req,res)=>res.end(req.url==='/'?'Other service':JSON.stringify({households:[]})));
 assert.equal(await ready.waitForBridge(foreign,{timeoutMs:50,intervalMs:5}),false);
});
test('readiness stops when its owned process exits',async t=>{
 const port=await server(t,(req,res)=>res.end('<html>Game</html>'));
 assert.equal(await ready.waitForBridge(port,{alive:()=>false}),false);
});

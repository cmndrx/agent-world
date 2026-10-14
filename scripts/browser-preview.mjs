// Read-only prototype: render real screenshot blocks from a Codex CLI JSONL stream.
// No model calls, browser commands, user actions, credentials or game-state writes.
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export function browserFrames(jsonl) {
  const frames=[];let ended=false;
  for (const line of jsonl.split(/\r?\n/)) {
    let event;try{event=JSON.parse(line);}catch{continue;}
    if(event.type==='turn.started')ended=false;
    if(['turn.completed','turn.failed'].includes(event.type))ended=true;
    const item=event.item;
    if(event.type!=='item.completed'||item?.type!=='mcp_tool_call'||item.server!=='cua_repl'||item.tool!=='js'||item.error||item.result?.isError||!item.arguments?.code?.includes('getScreenshot'))continue;
    for(const block of item.result?.content||[]) {
      if(block.type!=='image'||!['image/png','image/jpeg','image/webp'].includes(block.mimeType)||typeof block.data!=='string'||block.data.length>16*1024*1024||!/^[A-Za-z0-9+/]+={0,2}$/.test(block.data))continue;
      frames.push({mimeType:block.mimeType,data:block.data});
    }
  }
  return {frames,ended};
}

const html=`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Agent World · Browser preview prototype</title>
<style>body{margin:0;background:#161b2d;color:#f3f4fb;font:16px system-ui}main{max-width:1150px;margin:30px auto;padding:20px}h1{font-size:24px}p,small{color:#c1c8df}header{display:flex;justify-content:space-between;gap:20px;align-items:center}.chip{padding:8px 14px;border-radius:20px;background:#343d63;font-size:13px}img{width:100%;border-radius:18px;border:1px solid #525c80;background:#20273f}button{padding:10px 16px;margin:10px 8px 10px 0;border:1px solid #64719b;border-radius:12px;background:#303b65;color:white;font:inherit;cursor:pointer}button:disabled{opacity:.4;cursor:default}</style>
<main><header><h1>Browser preview · Prototype</h1><span class="chip">View only</span></header>
<p>Real screenshots returned by Codex’s existing browser tools. No recreated cursor or simulated browser activity.</p>
<p id="status" role="status">Reading screenshot stream…</p><img id="frame" alt="Captured browser frame" hidden>
<div><button id="previous">Previous frame</button><button id="next">Next frame</button><button id="latest">Follow newest frame</button></div><small id="label"></small>
<p>This prototype receives screenshots only when a browser tool emits them. It does not continuously record the browser or bind itself to an agent conversation.</p></main>
<script>let count=0,index=0,follow=true,last='';const el=id=>document.getElementById(id);
function show(){el('previous').disabled=index<=0;el('next').disabled=index>=count-1;el('frame').hidden=!count;if(count){const key=index+':'+count;if(last!==key){el('frame').src='/frame?index='+index;last=key;}el('label').textContent='Frame '+(index+1)+' of '+count+' · source: Codex MCP screenshot';}}
el('previous').onclick=()=>{follow=false;index=Math.max(0,index-1);show();};el('next').onclick=()=>{follow=false;index=Math.min(count-1,index+1);show();};el('latest').onclick=()=>{follow=true;index=Math.max(0,count-1);show();};
async function refresh(){try{const r=await fetch('/status',{cache:'no-store'});if(!r.ok)throw Error();const s=await r.json();count=s.count;if(follow)index=Math.max(0,count-1);el('status').textContent=s.error?'Source unavailable — last frames may be stale.':s.ended?'Recorded test frames — run ended.':count?'Receiving tool-emitted frames; continuous video is not enabled.':'Waiting for a real screenshot.';show();}catch{el('status').textContent='Viewer disconnected — displayed frame may be stale.';}}
refresh();setInterval(refresh,2000);</script>`;

export function previewServer(eventsFile) {
  let state={frames:[],ended:false};let error=false;
  const load=()=>{try{const stat=fs.statSync(eventsFile);if(stat.size>64*1024*1024)throw Error('Stream exceeds prototype limit');state=browserFrames(fs.readFileSync(eventsFile,'utf8'));error=false;}catch{error=true;}};
  const server=http.createServer((req,res)=>{
    res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');
    if(req.method!=='GET'){res.writeHead(405);return res.end();}
    load();const url=new URL(req.url,'http://127.0.0.1');
    if(url.pathname==='/'){res.setHeader('Content-Type','text/html; charset=utf-8');return res.end(html);}
    if(url.pathname==='/status'){res.setHeader('Content-Type','application/json');return res.end(JSON.stringify({count:state.frames.length,ended:state.ended,error}));}
    if(url.pathname==='/frame'){const index=Number(url.searchParams.get('index'));const frame=Number.isInteger(index)&&index>=0?state.frames[index]:null;if(!frame){res.writeHead(404);return res.end();}res.setHeader('Content-Type',frame.mimeType);return res.end(Buffer.from(frame.data,'base64'));}
    res.writeHead(404);res.end();
  });return server;
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  const args=process.argv.slice(2),source=args[args.indexOf('--events')+1];
  if(!args.includes('--events')||!source){console.error('Usage: node scripts/browser-preview.mjs --events /path/to/codex-events.jsonl [--port 4795]');process.exitCode=1;}
  else {const port=args.includes('--port')?Number(args[args.indexOf('--port')+1]):4795;const server=previewServer(path.resolve(source));server.on('error',e=>{console.error(e.message);process.exitCode=1;});server.listen(port,'127.0.0.1',()=>console.log('Read-only browser viewer: http://127.0.0.1:'+server.address().port));for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>server.close());}
}

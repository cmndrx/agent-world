// Isolated, ephemeral care-only API. No observer, provider, runner, queue or real household writes.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {build} from 'vite';
import http from 'node:http';
import {initializeCare,applyCare,pulseCare,advanceCare,CARE_ACTIONS} from '../shared/care.mjs';
import {careEligibility} from '../bridge/care-resources.mjs';
import {buildingPlanFor} from '../web/src/home-floors.js';
import {tvMounts} from '../shared/tv-mounts.mjs';
const fixtureHome=fs.mkdtempSync(path.join(os.tmpdir(),'aw-interest-care-'));
process.env.AGENT_WORLD_HOME=fixtureHome;process.env.CODEX_HOME=path.join(fixtureHome,'codex');
let c={id:'fixture-resident',slot:1,name:'Care Tester',seed:42,interestIds:['sweets','television','bubble_baths'],happiness:50};initializeCare(c);
const home={project:'isolated-interest-care',name:'Care fixture',characters:[c],residentAgentIds:[c.id]};
let style={homes:{[home.project]:{decor:[]}}};
const eligibility=interest=>careEligibility({home,character:c,interest,style,level:1});
const out=path.join(fixtureHome,'web');
await build({configFile:false,root:path.resolve('web'),build:{target:"esnext",outDir:out,rollupOptions:{input:path.resolve('web/interest-care-fixture.html')}}});
const server=http.createServer(async(req,res)=>{
  const url=new URL(req.url,'http://fixture');
  if(!url.pathname.startsWith('/api/')) {
    const file=path.resolve(out,'.'+decodeURIComponent(url.pathname));
    if(!file.startsWith(out+path.sep)||!fs.existsSync(file)){res.statusCode=404;return res.end();}
    res.setHeader('content-type',file.endsWith('.js')?'text/javascript':file.endsWith('.html')?'text/html':'application/octet-stream');return res.end(fs.readFileSync(file));
  }
  res.setHeader('content-type','application/json');
  try {
    if(url.pathname==='/api/care-options')return res.end(JSON.stringify({protocol:2,options:Object.fromEntries(Object.entries(CARE_ACTIONS).map(([id,r])=>[id,eligibility(r.interest).reason]))}));
    if(url.pathname==='/api/fixture') {
      if(url.searchParams.get('mount')==='1') {
        const m=tvMounts(buildingPlanFor('cottage').floors[0].items)[0];
        style.homes[home.project].decor=[{id:'fixturetv',item:'fireplace_tv',anchor:m.anchor,x:m.x,z:m.z,rot:m.rot}];
      }
      return res.end(JSON.stringify({character:c,home:{...home,characters:[c]},style}));
    }
    if(url.pathname==='/api/care'&&req.method==='POST') {
      let text='';for await(const chunk of req)text+=chunk;
      const input=JSON.parse(text),interest=CARE_ACTIONS[input.action]?.interest || CARE_ACTIONS[c.care.pending?.action]?.interest;
      const context={eligibility:eligibility(interest)};
      const result=input.action==='scene'?pulseCare(c,input,context):applyCare(c,input,context);
      c=result.character;home.characters=[c];return res.end(JSON.stringify(result));
    }
    res.statusCode=404;res.end('{}');
  }catch(e){res.statusCode=400;res.end(JSON.stringify({error:e.message}));}
});
const timer=setInterval(()=>{if(advanceCare(c))home.characters=[c];},500);
await new Promise(resolve=>server.listen(4795,'127.0.0.1',resolve));console.log(`Isolated care fixture ${fixtureHome}: http://127.0.0.1:4795/interest-care-fixture.html`);
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,async()=>{clearInterval(timer);await new Promise(resolve=>server.close(resolve));process.exit(0);});


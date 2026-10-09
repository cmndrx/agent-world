import { readConnections } from './connections.mjs';
import {projectTeam} from '../shared/team.mjs';
import {Schedules} from './schedules.mjs';
import {LocalProjects} from './local-projects.mjs';
import {integrationCatalog} from './integrations.mjs';
import {readModels,observedModel,claudeModelCatalog,validClaudeModel} from './models.mjs';
import { usageReader } from './usage.mjs';
import {threadBusy,ownsThread,threadOwner,residentBusy} from '../shared/pass-conversations.mjs';
import { PassStore } from './passes.mjs';
import { PassRunner } from './pass-runner.mjs';
import {Attachments} from './attachments.mjs';
import {VoiceSession} from './voice.mjs';
import {ComputerUse} from './computer-use.mjs';
import { previewArtifact } from './artifacts.mjs';
// The bridge: watches the event inbox, maintains the truth model, and streams it to clients.
//
//   GET  /api/state    full snapshot
//   GET  /api/stream   Server-Sent Events: snapshot, then incremental changes
//   POST /api/rename   { project, slot, name }
//   GET  /api/photos   photo album (photo mode); POST /api/photos with a JPEG body adds one
//
// Usage: node bridge/server.mjs [--port 4777] [--serve dist]

import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { homeDir, cityFile, ensureHome, eventsDir, householdsFile, catalogFile, productivityFile, readConfig, styleFile } from '../shared/home.mjs';
import { emptyCity, helperKey, helperType, mergeCity, recordEvent, residentKey } from '../shared/city.mjs';
import { applyStyleChange, emptyStyle, removePhoto } from '../shared/style.mjs';
import { MAX_PHOTO_BYTES, deletePhoto, listPhotos, photoIds, photoPath, savePhoto } from './photos.mjs';
import { progress } from '../shared/progression.mjs';
import { dayKey, spawnsFor } from '../shared/collectibles.mjs';
import { appProjectID } from '../shared/conversations.mjs';
import { Inbox } from './inbox.mjs';
import { Productivity } from './productivity.mjs';
import { World } from './world.mjs';

const args = process.argv.slice(2);
const arg = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : fallback;
};
const PORT = Number(arg('port', process.env.AGENT_WORLD_PORT || 4777));
const STATIC_DIR = arg('serve', null);

ensureHome();
const config = readConfig();
const passes=new PassStore(path.join(homeDir(),'passes.json'));
const localProjects=new LocalProjects();
const selectedFile=path.join(homeDir(),'selected-projects.json');
let selectedProjects=[];
try{const saved=JSON.parse(fs.readFileSync(selectedFile,'utf8'));if(Array.isArray(saved))selectedProjects=saved.filter(p=>typeof p==='string');}catch{}
function selectProject(project){if(!selectedProjects.includes(project)){selectedProjects.push(project);fs.writeFileSync(selectedFile+'.tmp',JSON.stringify(selectedProjects));fs.renameSync(selectedFile+'.tmp',selectedFile);}broadcast({type:'selected-projects',projects:selectedProjects});}
const attachments=new Attachments(path.join(homeDir(),'attachments'));
const computerUse=new ComputerUse({onDiagnostic:d=>console.error('[computer-use]',JSON.stringify(d))});
const runner=new PassRunner(passes,{canRun:p=>!threadBusy(world.snapshot().sessions,p.resumeSession)&&!residentBusy(world.snapshot().sessions,p.project,p.slot),enabled:process.env.AGENT_WORLD_RUNNER==='1',onChange:()=>{world.syncResidentOwnership();broadcast({type:'passes',passes:passes.snapshot(),runner:runner.status()});}});

const schedules=new Schedules(passes,{teamFor:project=>projectTeam(world.households[project]),allowed:(s,data)=>{
 if(!runner.enabled)return 'Runner unavailable.';
 if(!selectedProjects.includes(s.project))return 'Project is not in your world.';
 if(!runner.status().providers[s.provider]?.installed)return 'Provider CLI unavailable.';
 if(!world.households[s.project]?.characters.some(c=>c.slot===s.slot))return 'Resident unavailable.';
 if(s.thread&&!ownsThread(data.runs,s.provider==='codex'?world.catalog.snapshot().conversations:[],s.project,s.slot,s.thread,s.provider))return 'Conversation no longer belongs to this resident.';
 if(data.chatSettings?.some(c=>c.project===s.project&&c.thread===s.thread&&c.archived))return 'Conversation is archived.';
 return null;
},onChange:()=>broadcast({type:'passes',passes:passes.snapshot(),runner:runner.status()})});
function authorizeSchedule(s){
 if(!selectedProjects.includes(s.project)||!world.households[s.project]?.characters.some(c=>c.slot===Number(s.slot)))throw Error('Choose a resident in an added project.');
 if(!runner.enabled||!runner.status().providers[s.provider]?.installed)throw Error('This provider runner is unavailable.');
 if(s.thread&&!ownsThread(passes.snapshot().runs,s.provider==='codex'?world.catalog.snapshot().conversations:[],s.project,Number(s.slot),s.thread,s.provider))throw Error('Conversation does not belong to this resident.');
 if(passes.snapshot().chatSettings?.some(c=>c.project===s.project&&c.thread===s.thread&&c.archived))throw Error('Restore the conversation before scheduling.');
}
const voice=new VoiceSession({
 onThread:s=>{voice.run=passes.voiceStart({project:s.project,slot:s.slot,thread:s.thread});world.syncResidentOwnership();broadcast({type:'passes',passes:passes.snapshot(),runner:runner.status()});},
 onTranscript:(s,item)=>{if(voice.run)passes.voiceTranscript(voice.run.id,item);broadcast({type:'passes',passes:passes.snapshot(),runner:runner.status()});},
 onFinish:s=>{if(voice.run)passes.voiceFinish(voice.run.id,s);voice.run=null;broadcast({type:'passes',passes:passes.snapshot(),runner:runner.status()});}
});


function loadCatalog() {
  try { return JSON.parse(fs.readFileSync(catalogFile(), 'utf8')); } catch { return {}; }
}

function loadHouseholds() {
  try {
    return JSON.parse(fs.readFileSync(householdsFile(), 'utf8'));
  } catch {
    return {};
  }
}

let saveTimer = null;
function persistHouseholds() {
  clearTimeout(saveTimer);
  for (const [file, data] of [[householdsFile(), world.households], [catalogFile(), world.catalog.snapshot()]]) {
    fs.writeFileSync(file + '.tmp', JSON.stringify(data, null, 2));
    fs.renameSync(file + '.tmp', file);
  }
}
function saveHouseholds() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(persistHouseholds, 250);
}

const world = new World({
  households: loadHouseholds(),
  catalog: loadCatalog(),
  projectHome: (directory,source,id) => passes.snapshot().runs.find(r=>r.workspace?.path===directory&&(r.provider==='claude'?'claude-code':'codex')===source&&(r.conversationSession===id||(!r.conversationSession&&r.status==='running')))?.project||null,
  residentOwner: (project,source,id) => ['codex','claude-code'].includes(source)?threadOwner(passes.snapshot().runs,[],project,id,source==='claude-code'?'claude':'codex'):null,
  staleAfterMs: config.staleAfterMinutes * 60 * 1000,
});

if(selectedProjects[0]){world.ensureStarterTeam(selectedProjects[0]);persistHouseholds();}

const productivity = new Productivity(loadProductivity());
function loadProductivity() {
  try { return JSON.parse(fs.readFileSync(productivityFile(), 'utf8')); } catch { return {}; }
}
// Customization (simulation layer only): decor, paint and wardrobe. See docs/GAMEPLAY.md.
let style = loadStyle();
function loadStyle() {
  try { return { ...emptyStyle(), ...JSON.parse(fs.readFileSync(styleFile(), 'utf8')) }; } catch { return emptyStyle(); }
}
// The city (play layer): a projection of observed work by kind and day (shared/city.mjs). Synthetic demo
// events only count in demo mode. Saved so deleting old event files never takes buildings away.
const allowSynthetic = process.env.AGENT_WORLD_DEMO === '1';
let city = emptyCity();
try { city = mergeCity(JSON.parse(fs.readFileSync(cityFile(), 'utf8')), emptyCity()); } catch {}
let citySaveTimer = null;
// Who did the work: a resident (home + desk slot) or a helper type (home + e.g. "Explore"). A helper's type
// is what its parent delegated to, or else the first target it reported.
const delegatedTo = new Map(); // parent session -> latest delegation target
const helperTypes = new Map(); // helper session -> type
function personFor(e) {
  if (delegatedTo.size > 5000) delegatedTo.clear(); // bounded; only recent sessions matter
  if (helperTypes.size > 5000) helperTypes.clear();
  if (e.kind === 'state' && e.state === 'delegating' && e.detail?.target) delegatedTo.set(e.session, e.detail.target);
  const s = world.sessions.get(e.session);
  if (!s) return null;
  if (s.slot != null) return { key: residentKey(s.project, s.slot), kind: 'resident', project: s.project, slot: s.slot };
  if (!s.parent_session) return null;
  if (!helperTypes.has(e.session)) {
    const raw = delegatedTo.get(s.parent_session) || e.detail?.target;
    if (!raw) return null;
    helperTypes.set(e.session, helperType(raw));
  }
  const type = helperTypes.get(e.session);
  return { key: helperKey(s.project, type), kind: 'helper', project: s.project, type };
}
function noteCity(e) {
  if (!recordEvent(city, e, { allowSynthetic, person: personFor(e) })) return false;
  clearTimeout(citySaveTimer);
  citySaveTimer = setTimeout(() => {
    fs.writeFileSync(cityFile() + '.tmp', JSON.stringify(city, null, 2));
    fs.renameSync(cityFile() + '.tmp', cityFile());
  }, 500);
  return true;
}
const connectionSnapshot = () => readConnections(path.join(homeDir(), 'connections'));
const snapshot = () => ({ connections: connectionSnapshot(), selectedProjects:allowSynthetic?null:selectedProjects, ...world.snapshot(), ...productivity.snapshot(), style, photos: listPhotos(), city, passes:passes.snapshot(), runner:runner.status(), computerUse:computerUse.snapshot() });
const inbox = new Inbox(eventsDir(), { onError: (err) => console.warn('[inbox]', err.message) });
for (const e of inbox.readAll()) {
  world.apply(e);
  noteCity(e);
}
world.sweep();
saveHouseholds();

const clients = new Set();
function broadcast(msg) {
  const data = `data: ${JSON.stringify(msg)}\n\n`;
  for (const res of clients) res.write(data);
}

world.on('change', (change) => {
  if (change.type === 'household' || change.type === 'catalog') saveHouseholds();
  broadcast(change);
});

inbox.watch((e) => {
  world.apply(e);
  if (noteCity(e)) broadcast({ type: 'city', city });
});
setInterval(() => world.sweep(), 30_000);
// Send fresh observer health even when there is no session activity.
setInterval(() => broadcast({ type: 'connections', connections: connectionSnapshot() }), 2000);

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.json': 'application/json', '.woff2': 'font/woff2', '.woff': 'font/woff' };

/** Requests that change local data must come from this app's own pages (or a non-browser client). */
function isLocalOrigin(req) {
  if (!req.headers.origin) return true;
  try {
    const origin = new URL(req.headers.origin);
    return origin.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(origin.hostname)
      && [5177, Number(process.env.AGENT_WORLD_WEB_PORT) || 5177, server.address().port].includes(Number(origin.port));
  } catch {
    return false;
  }
}

function writeStyle() {
  fs.writeFileSync(styleFile() + '.tmp', JSON.stringify(style, null, 2));
  fs.renameSync(styleFile() + '.tmp', styleFile());
  broadcast({ type: 'style', style });
}

const readUsage = usageReader(allowSynthetic ? async () => ({ status:'unavailable', capturedAt:null, buckets:[] }) : undefined);

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');

  if(url.pathname==='/api/voice/stream'&&req.method==='GET'){
    if(!isLocalOrigin(req)||req.headers['sec-fetch-site']==='cross-site'||url.searchParams.get('id')!==voice.snapshot().id){res.writeHead(403);return res.end();}
    res.writeHead(200,{'content-type':'text/event-stream','cache-control':'no-store','connection':'keep-alive'});
    const since=Number(req.headers['last-event-id']||0);const unsubscribe=voice.subscribe(e=>{if(e.sequence>since)res.write(`id: ${e.sequence}\ndata: ${JSON.stringify(e)}\n\n`);});
    res.write(`data: ${JSON.stringify({type:'state',...voice.snapshot()})}\n\n`);req.on('close',unsubscribe);return;
  }
  if (url.pathname === '/api/photos' && req.method === 'GET') {
    res.writeHead(200, { 'content-type': 'application/json' });
    return res.end(JSON.stringify({ photos: listPhotos() }));
  }
  const photoMatch = url.pathname.match(/^\/api\/photos\/([a-z0-9-]+)\.jpg$/);
  if (photoMatch && req.method === 'GET') {
    const file = photoPath(photoMatch[1]);
    if (!file) {
      res.writeHead(404);
      return res.end();
    }
    res.writeHead(200, { 'content-type': 'image/jpeg', 'cache-control': 'private, max-age=31536000, immutable' });
    return fs.createReadStream(file).pipe(res);
  }
  if (url.pathname === '/api/photos' && req.method === 'POST') {
    res.setHeader('content-type', 'application/json');
    // A JPEG content type can't be sent cross-site without a preflight, which this server never grants.
    if (req.headers['content-type'] !== 'image/jpeg') {
      res.writeHead(415); return res.end(JSON.stringify({ error: 'JPEG required.' }));
    }
    if (!isLocalOrigin(req)) {
      res.writeHead(403); return res.end(JSON.stringify({ error: 'Local origin required.' }));
    }
    try {
      const chunks = [];
      let size = 0;
      for await (const chunk of req) {
        size += chunk.length;
        if (size > MAX_PHOTO_BYTES) throw new Error('That photo is too large.');
        chunks.push(chunk);
      }
      const photo = savePhoto(Buffer.concat(chunks));
      broadcast({ type: 'photos', photos: listPhotos() });
      res.writeHead(200); return res.end(JSON.stringify({ ok: true, photo }));
    } catch (err) {
      res.writeHead(400); return res.end(JSON.stringify({ error: err.message }));
    }
  }

  if(url.pathname==='/api/integrations'&&req.method==='GET'){const project=url.searchParams.get('project'),provider=url.searchParams.get('provider')||'codex';if(!isLocalOrigin(req)){res.writeHead(403);return res.end(JSON.stringify({error:'Local origin required.'}));}if(!Object.hasOwn(world.households,project)||!['codex','claude'].includes(provider)){res.writeHead(400,{'content-type':'application/json'});return res.end(JSON.stringify({error:'Choose a local project and provider.'}));}res.writeHead(200,{'content-type':'application/json','cache-control':'no-store'});return res.end(JSON.stringify(await integrationCatalog(project,provider)));}
  if(url.pathname==='/api/models'&&req.method==='GET'){
    const provider=url.searchParams.get('provider')||'codex';const project=url.searchParams.get('project');const ids=(url.searchParams.get('threads')||'').split(',').filter(Boolean).slice(0,30);
    const known=id=>world.catalog.snapshot().conversations.some(c=>c.source===(provider==='claude'?'claude-code':'codex')&&c.id===id&&c.project===project)||passes.snapshot().runs.some(r=>r.project===project&&(r.provider||'codex')===provider&&(r.conversationSession===id||r.resumeSession===id));
    if(!['codex','claude'].includes(provider)||!Object.hasOwn(world.households,project)||ids.some(id=>!known(id))){res.writeHead(400);return res.end(JSON.stringify({error:'Choose conversations recorded in this project.'}));}
    const catalog=allowSynthetic?{status:'unavailable',models:[]}:provider==='claude'?claudeModelCatalog(passes.snapshot().runs,project,ids):await readModels();res.writeHead(200,{'content-type':'application/json','cache-control':'no-store'});return res.end(JSON.stringify({...catalog,observed:allowSynthetic?[]:provider==='claude'?catalog.observed:ids.map(id=>observedModel(id)).filter(Boolean)}));
  }

  if (url.pathname === '/api/usage'  && req.method === 'GET') {
    res.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' });
    return res.end(JSON.stringify(await readUsage()));
  }

  if (url.pathname === '/api/state') {
    res.writeHead(200, { 'content-type': 'application/json' });
    return res.end(JSON.stringify(snapshot()));
  }

  if (url.pathname === '/api/stream') {
    res.writeHead(200, {
      'content-type': 'text/event-stream',
      'cache-control': 'no-cache',
      connection: 'keep-alive',
    });
    res.write(`data: ${JSON.stringify({ type: 'snapshot', demo: process.env.AGENT_WORLD_DEMO === '1', ...snapshot() })}\n\n`);
    clients.add(res);
    const ping = setInterval(() => res.write(': ping\n\n'), 15_000);
    req.on('close', () => {
      clearInterval(ping);
      clients.delete(res);
    });
    return;
  }

  if (['/api/schedules','/api/codex-projects','/api/voice','/api/computer-use','/api/pass-attachment','/api/pass-cancel','/api/pass-chat','/api/pass-proposal', '/api/pass-decision', '/api/pass-resolve', '/api/projects', '/api/conversations', '/api/conversation-title', '/api/plan', '/api/task', '/api/briefing-seen', '/api/style', '/api/milestone', '/api/photo-delete', '/api/review', '/api/artifact-preview'].includes(url.pathname) && req.method === 'POST') {
    res.setHeader('content-type', 'application/json');
    // Browser forms from other websites must not alter the local catalog.
    if (!req.headers['content-type']?.startsWith('application/json')) {
      res.writeHead(415); return res.end(JSON.stringify({ error: 'JSON required.' }));
    }
    if (!isLocalOrigin(req)) {
      res.writeHead(403); return res.end(JSON.stringify({ error: 'Local origin required.' }));
    }
    try {
      let body = '';
      for await (const chunk of req) {
        body += chunk;
        if (body.length > (url.pathname==='/api/pass-attachment'?8*1024*1024:url.pathname==='/api/voice'?256*1024:16384)) throw new Error('Request is too large.');
      }
      const input = JSON.parse(body);
      let result;
      if(url.pathname==='/api/schedules'){if(allowSynthetic)throw Error('Scheduling is unavailable in the demo.');result=schedules.mutate(input,authorizeSchedule);res.writeHead(200,{'content-type':'application/json'});return res.end(JSON.stringify({ok:true,result}));}
      if(url.pathname==='/api/codex-projects'){
        if(allowSynthetic)throw new Error('Local Codex projects are unavailable in the demo.');
        const register=p=>{selectProject(p.path);const h=world.household(p.path);if(!h.codexProjectId||h.codexProjectId===p.id){h.name=p.name;h.codexProjectId=p.id;}h.codexProjectIds=[...new Set([...(h.codexProjectIds||[]),p.id])];h.codexRootCount=p.rootCount;if(!Object.values(world.households).some(h=>h.starterTeam))world.ensureStarterTeam(p.path);else world.assignSlot(p.path,Date.now(),1);broadcast({type:'household',household:h});return h;};
        if(input.action==='list'){result=await localProjects.list();result.homes=selectedProjects.map(p=>world.households[p]).filter(Boolean);}
        else if(input.action==='remove'){
          if(typeof input.project!=='string'||!selectedProjects.includes(input.project))throw new Error('Choose a project in your world.');
          const state=passes.snapshot();
          if(state.runs.some(r=>r.project===input.project&&r.status==='running')||state.proposals.some(p=>p.project===input.project&&p.status==='approved')||voice.snapshot().project===input.project&& !['ended','idle','error'].includes(voice.snapshot().status))throw new Error('Finish or stop this project’s active work before removing its home.');
          passes.change(data=>{for(const s of data.schedules||[])if(s.project===input.project&&s.status==='active'){s.status='paused';s.message='Project removed from world.';s.version++;}});
          const next=selectedProjects.filter(p=>p!==input.project);fs.writeFileSync(selectedFile+'.tmp',JSON.stringify(next));fs.renameSync(selectedFile+'.tmp',selectedFile);selectedProjects=next;
          broadcast({type:'selected-projects',projects:selectedProjects});result={project:input.project,removed:true};
        }
        else if(input.action==='import'){const list=await localProjects.list();const project=list.projects.find(p=>p.id===input.id);if(!project)throw new Error('Project unavailable. Refresh the import list.');result={project,home:register(project)};}
        else if(input.action==='create'){const project=await localProjects.create(input);result={project,home:register(project)};}
        else throw new Error('Choose list, import, create or remove.');
        persistHouseholds();res.writeHead(200,{'content-type':'application/json'});return res.end(JSON.stringify({ok:true,result}));
      }
      if(url.pathname==='/api/voice'){
        if(allowSynthetic||!runner.enabled)throw new Error('Voice requires the real Codex runner.');
        const slot=Number(input.slot);if(!world.households[input.project]?.characters.some(c=>c.slot===slot))throw new Error('Choose an existing resident.');
        if(input.action==='start'){
          const state=passes.snapshot();
          if(state.runs.some(r=>['running','interrupted'].includes(r.status))||state.proposals.some(p=>p.status==='approved')||residentBusy(world.snapshot().sessions,input.project,slot)||threadBusy(world.snapshot().sessions,input.thread))throw new Error('Finish current work before starting voice.');
          if(input.thread&&!ownsThread(state.runs,world.catalog.snapshot().conversations,input.project,slot,input.thread,'codex'))throw new Error('Conversation does not belong to this agent.');
          if(input.thread&&state.chatSettings?.some(s=>s.thread===input.thread&&s.project===input.project&&s.slot===slot&&s.archived))throw new Error('Restore this chat before starting voice.');
          const prior=state.runs.find(r=>r.project===input.project&&r.slot===slot&&(r.conversationSession||r.resumeSession)===input.thread&&r.workspace);
          if(input.model&&(await readModels()).models?.every(m=>m.id!==input.model)!==false)throw new Error('Selected model is unavailable.');
          result=voice.start({project:prior?.workspace?.path||input.project,slot,thread:input.thread,model:input.model});
          // Logical project stays tied to the resident even when the existing thread uses a worktree.
          voice.state.project=input.project;
        }else{
          const state=voice.snapshot();if(state.id!==input.id||state.project!==input.project||state.slot!==slot)throw new Error('Voice call belongs to another resident or has ended.');
          if(input.action==='audio'){await voice.audio(input.audio);result={ok:true};}
          else if(input.action==='stop')result=await voice.stop();
          else if(input.action==='read')result=state;
          else if(input.action==='approve'||input.action==='deny')result=voice.decide(input.approvalId,input.action==='approve');
          else throw new Error('Unknown voice action.');
        }
        res.writeHead(200);return res.end(JSON.stringify({ok:true,result}));
      }else if(url.pathname==='/api/computer-use'){
        if(allowSynthetic||!runner.enabled)throw new Error('App connections require the real local runner.');
        const slot=Number(input.slot);
        if(!world.households[input.project]?.characters.some(c=>c.slot===slot))throw new Error('Choose an existing resident.');
        if(input.action==='start')result=computerUse.start({project:input.project,slot,app:input.app});
        else {
          const state=computerUse.snapshot();
          if(state.project!==input.project||state.slot!==slot||state.id!==input.id)throw new Error('Connection belongs to another resident or has changed.');
          if(input.action==='read')result=state;
          else if(input.action==='cancel')result=computerUse.cancel();
          else result=computerUse.decide({...input,action:input.action});
        }
        res.writeHead(200);return res.end(JSON.stringify({ok:true,result}));
      }else if(url.pathname.startsWith('/api/pass-')) {
        if(url.pathname==='/api/pass-attachment'){
          if(!world.households[input.project]?.characters.some(c=>c.slot===Number(input.slot)))throw new Error('Choose an existing resident.');
          result=attachments.save(input);
        }else if(url.pathname==='/api/pass-cancel'){
          const state=passes.snapshot(),target=state.runs.find(r=>r.id===input.id&&r.status==='running')||state.proposals.find(p=>p.id===input.id&&p.status==='approved');
          const root=target?.teamRoot?state.runs.find(r=>r.id===target.teamRoot):null;
          if(!target||target.project!==input.project||(target.slot!==Number(input.slot)&&root?.slot!==Number(input.slot)))throw new Error('Active prompt does not belong to this agent.');
          result=target.voice?await voice.stop():runner.cancel(input.id);
        }else if(url.pathname==='/api/pass-chat'){
          const provider=input.provider||'codex',slot=Number(input.slot);
          if(!ownsThread(passes.snapshot().runs,world.catalog.snapshot().conversations,input.project,slot,input.thread,provider))throw new Error('Conversation does not belong to this agent.');
          if(input.action==='archive'&&(threadBusy(world.snapshot().sessions,input.thread)||passes.snapshot().runs.some(r=>r.project===input.project&&r.slot===slot&&(r.provider||'codex')===provider&&r.status==='running'&&(r.conversationSession||r.resumeSession)===input.thread)||passes.snapshot().proposals.some(p=>p.status==='approved'&&p.resumeSession===input.thread)))throw new Error('Stop or finish this chat before archiving it.');
          result=passes.chatSetting({project:input.project,slot,provider,thread:input.thread,action:input.action});
        }
        else if(url.pathname==='/api/pass-proposal'){if((!input.provider||input.provider==='codex')&&!runner.status().providers.codex.installed)throw new Error('Codex CLI executable was not found. Check installation or AGENT_WORLD_CODEX_COMMAND, then restart the bridge.');if(input.provider==='claude'&&!runner.status().providers.claude.installed)throw new Error('Claude Code CLI is not installed. Install it and sign in, then restart the bridge.');if(input.provider==='claude'&&input.model&&!validClaudeModel(input.model))throw new Error('Choose a supported Claude model.');if(input.model&&input.provider!=='claude'){const catalog=await readModels();if(!catalog.models?.some(m=>m.id===input.model))throw new Error('Selected model is unavailable. Refresh the model list.');}if(input.resumeSession){const provider=input.provider||'codex';const conversations=provider==='codex'?world.catalog.snapshot().conversations:[];if(!ownsThread(passes.snapshot().runs,conversations,input.project,Number(input.slot),input.resumeSession,provider))throw new Error('Conversation does not belong to this agent. Choose one of this agent’s chats or New chat.');}const attached=attachments.resolve(input.attachments||[],input.project,Number(input.slot)).map(a=>attachments.public(a));result=passes.propose({...input,team:input.teamWork===true&&!input.isolate?projectTeam(world.households[input.project]):null,attachments:attached},world.households);}
        else if(url.pathname==='/api/pass-resolve')result=passes.resolve(input);
        else {if(input.action==='approve' && !runner.enabled)throw new Error('Local runner is unavailable. Start npm run dev with the runner enabled.');const proposal=passes.snapshot().proposals.find(p=>p.id===input.id);if(input.action==='approve'&&proposal?.resumeSession&&!ownsThread(passes.snapshot().runs,proposal.provider==='claude'?[]:world.catalog.snapshot().conversations,proposal.project,proposal.slot,proposal.resumeSession,proposal.provider||'codex'))throw new Error('Conversation does not belong to this agent.');if(input.action==='approve'&&residentBusy(world.snapshot().sessions,proposal?.project,proposal?.slot))throw new Error('This agent is working. Wait for its current turn to finish.');if(input.action==='approve'&&threadBusy(world.snapshot().sessions,proposal?.resumeSession))throw new Error('This conversation is working. Wait for its current turn to finish.');result=passes.decide(input,world.households);}
        broadcast({type:'passes',passes:passes.snapshot(),runner:runner.status()});
        res.writeHead(200);return res.end(JSON.stringify({ok:true,result}));
      }
      if (url.pathname === '/api/artifact-preview') {
        const task = productivity.tasks.get(input.id);
        if (!task || task.project !== input.project) throw new Error('Task not found.');
        result = previewArtifact(task, input.path);
        res.writeHead(200); return res.end(JSON.stringify({ ok: true, result }));
      }
      if (url.pathname === '/api/style') {
        // Bricks and levels are derived from the human's board every time (docs/GAMEPLAY.md).
        const earnedNow = progress(productivity.snapshot(), style);
        const known = {
          homes: new Set(Object.keys(world.households)),
          residents: new Set(Object.values(world.households).flatMap((h) => h.characters.map((c) => `${h.project}#${c.slot}`))),
          earned: earnedNow.earned,
          levels: earnedNow.levels,
          spawns: spawnsFor(dayKey(), Object.keys(world.households)),
          photos: photoIds(),
          now: Date.now(),
        };
        style = applyStyleChange(style, input, known);
        writeStyle();
        res.writeHead(200); return res.end(JSON.stringify({ ok: true }));
      }
      if (url.pathname === '/api/photo-delete') {
        deletePhoto(String(input.id || ''));
        style = removePhoto(style, input.id);
        writeStyle();
        broadcast({ type: 'photos', photos: listPhotos() });
        res.writeHead(200); return res.end(JSON.stringify({ ok: true }));
      }
      if (['/api/plan', '/api/task', '/api/briefing-seen', '/api/milestone', '/api/review'].includes(url.pathname)) {
        if (url.pathname === '/api/plan') result = productivity.savePlan(input, world.households);
        else if (url.pathname === '/api/milestone') result = productivity.milestone(input, world.households);
        else if (url.pathname === '/api/review') result = productivity.review(input, world.households, world.catalog.conversations);
        else if (url.pathname === '/api/task') result = productivity.saveTask(input, world.households, world.catalog.conversations);
        else result = productivity.markSeen(input, world.households);
        // User plans are stored independently of the observed agent model.
        const file = productivityFile();
        fs.writeFileSync(file + '.tmp', JSON.stringify(productivity.snapshot(), null, 2));
        fs.renameSync(file + '.tmp', file);
        broadcast({ type: 'productivity', ...productivity.snapshot() });
        res.writeHead(200); return res.end(JSON.stringify({ ok: true, result }));
      } else if (url.pathname === '/api/conversation-title') {
        result = world.catalog.conversations.get(input.key);
        if (!result) throw new Error('Conversation not found.');
        if (input.title && input.allowTitle !== true) throw new Error('Allow saving the title or leave it blank.');
        result.title = String(input.title || '').trim().slice(0, 200) || null;
        result.titleOrigin = result.title ? 'user' : null;
        for (const session of world.sessions.values()) {
          if (session.conversation?.key === result.key) {
            session.conversation = result;
            broadcast({ type: 'session', session: world.publicSession(session) });
          }
        }
      } else if (url.pathname === '/api/projects') {
        const projectId = `${input.source}:${appProjectID(input.externalId, input.source)}`;
        if ([...world.sessions.values()].some(s => s.sourceProject === projectId && s.project !== (input.home || projectId))) {
          throw new Error('End the active conversation before linking this project to a different home.');
        }
        result = world.catalog.registerProject(input, world.households);
        const h = world.household(result.home);
        if (result.home === result.id) h.name = result.name;
        broadcast({ type: 'household', household: h });
      } else {
        result = world.catalog.registerConversation(input);
        const h = world.household(result.project);
        if (result.project.endsWith(':unsorted')) h.name = `Unsorted chats · ${result.app}`;
        broadcast({ type: 'household', household: h });
      }
      persistHouseholds();
      broadcast({ type: 'catalog', ...world.catalog.snapshot() });
      res.writeHead(200); return res.end(JSON.stringify({ ok: true, result }));
    } catch (err) {
      res.writeHead(400); return res.end(JSON.stringify({ error: err.message }));
    }
  }

  if (url.pathname === '/api/rename' && req.method === 'POST') {
    let body = '';
    for await (const chunk of req) body += chunk;
    try {
      const { project, slot, name } = JSON.parse(body);
      const ok = world.rename(project, Number(slot), name);
      res.writeHead(ok ? 200 : 404, { 'content-type': 'application/json' });
      return res.end(JSON.stringify({ ok }));
    } catch {
      res.writeHead(400);
      return res.end();
    }
  }

  if (STATIC_DIR) {
    const root = path.resolve(STATIC_DIR);
    const file = path.join(root, url.pathname === '/' ? 'index.html' : path.normalize(url.pathname));
    if (file.startsWith(root) && fs.existsSync(file) && fs.statSync(file).isFile()) {
      res.writeHead(200, { 'content-type': MIME[path.extname(file)] || 'application/octet-stream' });
      return fs.createReadStream(file).pipe(res);
    }
  }

  res.writeHead(404);
  res.end('not found');
});

server.listen(PORT, '127.0.0.1', () => {
  runner.start();
  setInterval(()=>{if(!runner.enabled)return;try{schedules.tick();}catch(e){console.warn('[schedules]',e.message);}},10000);
  console.log(`[bridge] watching ${eventsDir()}`);
  console.log(`[bridge] http://127.0.0.1:${server.address().port}${STATIC_DIR ? '' : '  (api only)'}`);
});

process.on('SIGTERM',()=>{voice.stop();computerUse.cancel();runner.stop();process.exit(0);});
process.on('SIGINT',()=>{computerUse.cancel();runner.stop();process.exit(0);});

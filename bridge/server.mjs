import {BrowserVideo} from './browser-video.mjs';
import { initializeCare, applyCare, advanceCare } from '../shared/care.mjs';
import {roommateView,recruitCandidate,inspectionInstruction} from '../shared/roommates.mjs';
import { readConnections } from './connections.mjs';
import { resetTown } from './game-reset.mjs';
import {projectTeam} from '../shared/team.mjs';
import { agentForRecord, foundationSnapshot, residentCharacters, residentHousehold } from '../shared/foundation.mjs';
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
import {LocalSpeech} from './local-speech.mjs';
import {ComputerUse} from './computer-use.mjs';
import { previewArtifact } from './artifacts.mjs';
import { TownStore } from './town.mjs';
import { addRoad, checkPlacement, emptyTown, permitHint, permitsFor, placeCivic, placeHome, removeCivic, removeRoad, renameStreet, retireHome } from '../shared/town.mjs';
import { randomUUID } from 'node:crypto';
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
import { progress, HOME_XP_THRESHOLDS, setHomeTestingLevel } from '../shared/progression.mjs';
import { experience } from '../shared/experience.mjs';
import { applyGameplayAction, emptyGameplay, gameplaySpent, townHallState, homeBuildState, startHomeConstruction } from '../shared/gameplay.mjs';
import { readCodexUsage } from './usage.mjs';
import {CodexLogin,codexAuth,accountBusy} from './codex-login.mjs';
import {ClaudeLogin} from './claude-login.mjs';
import { claudeAuth } from './provider-auth.mjs';
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
const passes=new PassStore(path.join(homeDir(),'passes.json'), { agentIdFor: record => agentForRecord(world.households, record)?.id || null });
const localProjects=new LocalProjects();
const selectedFile=path.join(homeDir(),'selected-projects.json');
let selectedProjects=[];
try{const saved=JSON.parse(fs.readFileSync(selectedFile,'utf8'));if(Array.isArray(saved))selectedProjects=saved.filter(p=>typeof p==='string');}catch{}
function selectProject(project){if(!selectedProjects.includes(project)){selectedProjects.push(project);fs.writeFileSync(selectedFile+'.tmp',JSON.stringify(selectedProjects));fs.renameSync(selectedFile+'.tmp',selectedFile);}broadcast({type:'selected-projects',projects:selectedProjects});}
const attachments=new Attachments(path.join(homeDir(),'attachments'));
const computerUse=new ComputerUse({onDiagnostic:d=>console.error('[computer-use]',JSON.stringify(d))});
const browserVideo=new BrowserVideo({send:typeof process.send==='function'?m=>process.send(m):null,isActive:id=>passes.snapshot().runs.some(r=>r.id===id&&r.status==='running'&&!r.stopRequestedAt)});
process.on('message',m=>browserVideo.receive(m));
const runner=new PassRunner(passes,{video:browserVideo,browserEndpoint:()=>`http://127.0.0.1:${server.address().port}/api/browser-control`,canRun:p=>!executionBlock(p.project)&&homeBuildState(gameplay,p.project).status==='built'&&residentCharacters(world.households[p.project]).some(c=>c.slot===p.slot)&&!threadBusy(world.snapshot().sessions,p.resumeSession)&&!residentBusy(world.snapshot().sessions,p.project,p.slot),enabled:process.env.AGENT_WORLD_RUNNER==='1',onChange:()=>{world.syncResidentOwnership();broadcast({type:'passes',passes:passes.snapshot(),runner:runner.status()});}});

const schedules=new Schedules(passes,{teamFor:project=>projectTeam(world.households[project]),allowed:(s,data)=>{
 if(!runner.enabled)return 'Runner unavailable.';
 const block=executionBlock(s.project);if(block)return block;
 if(homeBuildState(gameplay,s.project).status!=='built')return 'Home is under construction.';
 if(!runner.status().providers[s.provider]?.installed)return 'Provider CLI unavailable.';
 if(!residentCharacters(world.households[s.project]).some(c=>c.slot===s.slot))return 'Resident unavailable.';
 if(s.thread&&!ownsThread(data.runs,s.provider==='codex'?world.catalog.snapshot().conversations:[],s.project,s.slot,s.thread,s.provider))return 'Conversation no longer belongs to this resident.';
 if(data.chatSettings?.some(c=>c.project===s.project&&c.thread===s.thread&&c.archived))return 'Conversation is archived.';
 return null;
},onChange:()=>broadcast({type:'passes',passes:passes.snapshot(),runner:runner.status()})});
function authorizeSchedule(s){
 const block=executionBlock(s.project);if(block)throw Error(block);
 if(homeBuildState(gameplay,s.project).status!=='built')throw Error('Finish building this home first.');
 if(!selectedProjects.includes(s.project)||!residentCharacters(world.households[s.project]).some(c=>c.slot===Number(s.slot)))throw Error('Choose a resident in an added project.');
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
  for (const project of selectedProjects) for (const c of residentCharacters(world.households[project])) initializeCare(c);
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

for (const project of selectedProjects) world.ensureHomeOwner(project);
for (const home of Object.values(world.households)) for (const c of home.characters) advanceCare(c, { restart: true });
persistHouseholds();

const productivity = new Productivity(loadProductivity());
function loadProductivity() {
  try { return JSON.parse(fs.readFileSync(productivityFile(), 'utf8')); } catch { return {}; }
}
// Customization (simulation layer only): decor, paint and wardrobe. See docs/GAMEPLAY.md.
let style = loadStyle();
const gameplayFile = path.join(homeDir(), 'gameplay.json');
let gameplay = emptyGameplay();
try { gameplay = { ...gameplay, ...JSON.parse(fs.readFileSync(gameplayFile, 'utf8')) }; } catch {}
function saveGameplay() {
  fs.writeFileSync(gameplayFile + '.tmp', JSON.stringify(gameplay, null, 2));
  fs.renameSync(gameplayFile + '.tmp', gameplayFile);
  broadcast({ type: 'gameplay', gameplay });
}
function presentedHome(home) {
  const result = residentHousehold(home);
  return { ...result, construction: gameplay.homes?.[home.project] || null,
    characters: homeBuildState(gameplay, home.project).status === 'building' ? [] : result.characters };
}
const constructionStates = new Map();
for (const project of selectedProjects) constructionStates.set(project, homeBuildState(gameplay, project).status);
setInterval(() => {
  for (const project of selectedProjects) {
    const status = homeBuildState(gameplay, project).status;
    const previous = constructionStates.get(project);
    constructionStates.set(project, status);
    if (previous === 'building' && status === 'built' && world.households[project]) broadcast({ type: 'household', household: world.households[project] });
  }
}, 1000).unref();
async function providerReady(provider) {
  if (provider === 'codex') return (await codexAuth()).ready;
  if (provider === 'claude') {
    const auth = await claudeAuth();
    if (!auth.ready) throw Object.assign(new Error(auth.message), { auth });
    return true;
  }
  return false;
}
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
// Town planning (shared/town.mjs): streets and plots on the grid. Activation, removal and layout changes run
// one at a time behind the town lock, so capacity and placement checks can't race.
const townStore = new TownStore(homeDir());
const activeHomes = () => allowSynthetic ? Object.keys(world.households) : selectedProjects;
townStore.load({ style, active: Object.keys(world.households).filter(p => selectedProjects.includes(p)).concat(selectedProjects.filter(p => !world.households[p])) });
townStore.reconcile(activeHomes(), { autoPlace: allowSynthetic });
const pendingRemoval = () => townStore.town.pendingRemoval || {};
/** Player-level permits: one active project (and home) per permit. Projects being removed still hold theirs. */
function permits() { return permitsFor(passes.snapshot().runs, selectedProjects.length); }
function overCapacity() { return !allowSynthetic && selectedProjects.filter(p => !pendingRemoval()[p]).length > permits().allowed; }
/** Why a project can't start new work right now (null when it can). Running work is never interrupted. */
function executionBlock(project) {
  if(claudeLogin.signingOut||codexLogin.signingOut)return 'Wait for account sign-out to finish.';
  if (allowSynthetic) return null;
  if (!selectedProjects.includes(project)) return 'This project isn’t active in your town. Add it again from Projects to work with it.';
  if (pendingRemoval()[project]) return 'This project is being removed from your town, so no new work starts here.';
  if (overCapacity()) { const p = permits(); return `Your town has more active projects than permits (${selectedProjects.length} for ${p.allowed}). Choose which projects stay active in Projects.`; }
  return null;
}
/** Game-owned work in a project that must finish before it can leave the town. */
function runningWork(project) {
  const out = [];
  for (const r of passes.snapshot().runs) if (r.project === project && r.status === 'running') out.push({ kind: r.voice ? 'voice' : 'prompt', title: r.title || 'Prompt', slot: r.slot, id: r.id });
  const call = voice.snapshot();
  if (call.project === project && !['idle', 'ended', 'error'].includes(call.status) && !out.some(w => w.kind === 'voice')) out.push({ kind: 'voice', title: 'Voice call', slot: call.slot });
  const app = computerUse.snapshot();
  if (app.project === project && ['connecting', 'approval'].includes(app.status)) out.push({ kind: 'app', title: `App connection${app.app ? ` · ${app.app}` : ''}`, slot: app.slot });
  return out;
}
function townView() {
  const p = permits();
  return { ...townStore.town, permits: { ...p, counted: selectedProjects.filter(x => !pendingRemoval()[x]).length, overCapacity: overCapacity(), hint: permitHint(p) },
    waitingFor: Object.fromEntries(Object.keys(pendingRemoval()).map(x => [x, runningWork(x)])), problems: townStore.problems || [], loadError: townStore.loadError || null };
}
let permitKey = '';
function broadcastTown() { const view = townView(); permitKey = JSON.stringify(view.permits); broadcast({ type: 'town', town: view }); }
function capacityError(p) {
  return Object.assign(Error(`All ${p.allowed} project permit${p.allowed === 1 ? ' is' : 's are'} in use (${p.active} of ${p.allowed} active). ${permitHint(p)}. Remove a project, or replace one, to add another.`), { permits: p });
}
/** Stop anything that hasn't started for a project leaving town: pause its schedules and cancel queued prompts. */
function stopFutureWork(project, message) {
  passes.change(data => {
    for (const s of data.schedules || []) if (s.project === project && s.status === 'active') { s.status = 'paused'; s.message = message; s.version++; }
    const at = new Date().toISOString();
    for (const p of data.proposals) if (p.project === project && p.status === 'approved') {
      p.status = 'cancelled'; p.version++;
      data.runs.push({ ...p, id: randomUUID(), proposalId: p.id, status: 'cancelled', startedAt: at, finishedAt: at, result: null, error: message });
    }
  });
}
/** Take a project out of the town: history, files, residents and chats stay saved for re-adding. */
function deactivate(project, message) {
  stopFutureWork(project, message);
  for (const c of residentCharacters(world.households[project])) advanceCare(c, { unavailable: true });
  persistHouseholds();
  const next = selectedProjects.filter(p => p !== project);
  fs.writeFileSync(selectedFile + '.tmp', JSON.stringify(next)); fs.renameSync(selectedFile + '.tmp', selectedFile);
  selectedProjects = next;
  const pending = { ...pendingRemoval() }; delete pending[project];
  townStore.save(retireHome({ ...townStore.town, pendingRemoval: pending }, project));
  broadcast({ type: 'selected-projects', projects: selectedProjects });
  broadcast({ type: 'passes', passes: passes.snapshot(), runner: runner.status() });
  broadcastTown();
}
/** Removal waits for running work; nothing new starts in the meantime. */
function requestRemoval(project, message) {
  const busy = runningWork(project);
  if (!busy.length) { deactivate(project, message); return { project, removed: true }; }
  stopFutureWork(project, 'Project is being removed from your town.');
  townStore.save({ ...townStore.town, pendingRemoval: { ...pendingRemoval(), [project]: { requestedAt: new Date().toISOString(), message } }, revision: townStore.town.revision + 1 });
  broadcast({ type: 'passes', passes: passes.snapshot(), runner: runner.status() });
  broadcastTown();
  return { project, pending: true, waitingFor: busy };
}
setInterval(() => {
  for (const project of Object.keys(pendingRemoval())) {
    if (!selectedProjects.includes(project)) { const pending = { ...pendingRemoval() }; delete pending[project]; townStore.save({ ...townStore.town, pendingRemoval: pending }); broadcastTown(); continue; }
    if (!runningWork(project).length) townStore.exclusive(() => { if (pendingRemoval()[project] && !runningWork(project).length) deactivate(project, pendingRemoval()[project].message || 'Project removed from town.'); }).catch(e => console.warn('[town]', e.message));
  }
}, 2000).unref();
const connectionSnapshot = () => readConnections(path.join(homeDir(), 'connections'));
const snapshot = () => ({ town: townView(), foundation: foundationSnapshot(Object.values(world.households).map(presentedHome), gameplay), connections: connectionSnapshot(), selectedProjects:allowSynthetic?null:selectedProjects, ...world.snapshot(), households: Object.values(world.households).map(presentedHome), ...productivity.snapshot(), style, gameplay, photos: listPhotos(), city, passes:passes.snapshot(), runner:runner.status(), computerUse:computerUse.snapshot() });
const inbox = new Inbox(eventsDir(), { onError: (err) => console.warn('[inbox]', err.message) });
for (const e of inbox.readAll()) {
  world.apply(e);
  noteCity(e);
}
world.sweep();
saveHouseholds();

const clients = new Set();
function broadcast(msg) {
  if (msg.type === 'household' && selectedProjects.includes(msg.household.project)) {
    for (const c of residentCharacters(msg.household)) initializeCare(c);
  }
  if (msg.type === 'household') msg = { ...msg, household: presentedHome(msg.household) };
  const data = `data: ${JSON.stringify(msg)}\n\n`;
  for (const res of clients) res.write(data);
  if (msg.type === 'passes' && typeof townStore !== 'undefined' && JSON.stringify(townView().permits) !== permitKey) broadcastTown();
}

world.on('change', (change) => {
  if (change.type === 'session') tickCare();
  // Demo households appear from synthetic events; give each a plot so it shows in town.
  if (allowSynthetic && change.type === 'household' && !townStore.home(change.household.project)) {
    townStore.exclusive(() => { if (townStore.reconcile(activeHomes(), { autoPlace: true })) broadcastTown(); }).catch(e => console.warn('[town]', e.message));
  }
  if (change.type === 'household' || change.type === 'catalog') saveHouseholds();
  broadcast(change);
});

function careBusy(project, character) {
  const call = voice.snapshot();
  return call.project === project && Number(call.slot) === character.slot && !['idle','ended','error'].includes(call.status)
    || passes.snapshot().runs.some(r => r.project === project && r.slot === character.slot && r.status === 'running')
    || passes.snapshot().proposals.some(r => r.project === project && r.slot === character.slot && r.status === 'approved')
    || [...world.sessions.values()].some(s => s.project === project && s.slot === character.slot && world.isLive(s) && !['idle','done'].includes(s.state));
}
function tickCare() {
  for (const project of selectedProjects) {
    const home = world.households[project];
    let changed = false;
    for (const c of residentCharacters(home)) changed = advanceCare(c, { busy: careBusy(project, c) }) || changed;
    if (changed) { persistHouseholds(); broadcast({ type: 'household', household: home }); }
  }
}
setInterval(tickCare, 500).unref();

inbox.watch((e) => {
  world.apply(e);
  if (noteCity(e)) broadcast({ type: 'city', city });
});
setInterval(() => world.sweep(), 30_000);
// Send fresh observer health even when there is no session activity.
setInterval(() => broadcast({ type: 'connections', connections: connectionSnapshot() }), 2000);

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.json': 'application/json', '.woff2': 'font/woff2', '.woff': 'font/woff', '.mp3': 'audio/mpeg' };

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

const claudeLogin=new ClaudeLogin();
const codexLogin=new CodexLogin();
const localSpeech=new LocalSpeech({directory:homeDir()});
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if(url.pathname==='/api/local-speech'){
    res.setHeader('Content-Type','application/json');res.setHeader('Cache-Control','no-store');
    if(req.method!=='POST'){res.writeHead(405);return res.end(JSON.stringify({error:'POST required.'}));}
    if(!isLocalOrigin(req)||req.headers['sec-fetch-site']==='cross-site'){res.writeHead(403);return res.end(JSON.stringify({error:'Local origin required.'}));}
    if(!req.headers['content-type']?.startsWith('application/json')){res.writeHead(415);return res.end(JSON.stringify({error:'JSON required.'}));}
    const controller=new AbortController();const disconnected=()=>{if(!res.writableEnded)controller.abort();};res.on('close',disconnected);
    try{
      let body='';for await(const chunk of req){body+=chunk;if(Buffer.byteLength(body)>1300000)throw Error('Recording is too large. Record up to 30 seconds.');}
      const input=JSON.parse(body),slot=Number(input.slot);
      if(allowSynthetic)throw Error('Local speech is unavailable in demo mode.');
      if(executionBlock(input.project))throw Error(executionBlock(input.project));
      if(homeBuildState(gameplay,input.project).status!=='built'||!residentCharacters(world.households[input.project]).some(c=>c.slot===slot))throw Error('Choose an active resident in a completed home.');
      if(!['codex','claude'].includes(input.provider))throw Error('Choose Codex or Claude for this chat.');
      if(input.thread&&!ownsThread(passes.snapshot().runs,world.catalog.snapshot().conversations,input.project,slot,input.thread,input.provider))throw Error('Conversation does not belong to this agent.');
      const result=await localSpeech.perform(input.action,input,{signal:controller.signal});
      if(!res.destroyed)res.end(JSON.stringify({ok:true,result}));
    }catch(e){if(!res.destroyed){res.writeHead(400);res.end(JSON.stringify({error:e instanceof SyntaxError?'Invalid speech request.':e.message}));}}
    finally{res.removeListener('close',disconnected);}
    return;
  }
  if(url.pathname==='/api/claude-action'){
    res.setHeader('Content-Type','application/json');res.setHeader('Cache-Control','no-store');
    const token=req.headers.authorization?.replace(/^Bearer /,'');
    if(req.method!=='POST'||req.headers.origin||!token||!runner.actions.authorized(token)){res.writeHead(403);return res.end(JSON.stringify({error:'Claude action authorization expired.'}));}
    try{let body='';for await(const c of req){body+=c;if(Buffer.byteLength(body)>300*1024)throw Error('Action too large.');}const allow=await runner.actions.request(token,JSON.parse(body));res.end(JSON.stringify({allow}));}catch{res.writeHead(400);res.end(JSON.stringify({allow:false,error:'Invalid or expired Claude action.'}));}return;
  }
  if(url.pathname==='/api/claude-approvals'){
    res.setHeader('Content-Type','application/json');res.setHeader('Cache-Control','no-store');
    if(!isLocalOrigin(req)||req.headers['sec-fetch-site']==='cross-site'||req.method==='POST'&&!req.headers.origin){res.writeHead(403);return res.end(JSON.stringify({error:'Origin not allowed.'}));}
    try{let input=Object.fromEntries(url.searchParams);if(req.method==='POST'){let body='';for await(const c of req){body+=c;if(body.length>4096)throw Error('Request too large.');}input=JSON.parse(body);}else if(req.method!=='GET')throw Error('Unsupported approval request.');
      const run=passes.snapshot().runs.find(r=>r.id===input.run&&r.project===input.project&&r.slot===Number(input.slot)&&r.provider==='claude');if(!run)throw Error('This action belongs to another conversation.');
      res.end(JSON.stringify(req.method==='GET'?{approvals:runner.actions.view(run.id)}:runner.actions.decide(run.id,input.approval,input.allow)));
    }catch(e){res.writeHead(400);res.end(JSON.stringify({error:e instanceof SyntaxError?'Invalid approval request.':e.message}));}return;
  }
  if(['/api/claude-login','/api/codex-login'].includes(url.pathname)){
    const provider=url.pathname.includes('claude')?'claude':'codex';const login=provider==='claude'?claudeLogin:codexLogin;
    res.setHeader('Content-Type','application/json');res.setHeader('Cache-Control','no-store');
    if(!req.headers.origin&&req.method==='POST'||!isLocalOrigin(req)||req.headers['sec-fetch-site']==='cross-site'){res.writeHead(403);return res.end(JSON.stringify({error:'Origin not allowed.'}));}
    try{if(allowSynthetic)throw Error('Provider sign-in is unavailable in demo mode.');if(req.method==='GET')return res.end(JSON.stringify(await login.read()));if(req.method!=='POST'){res.writeHead(405);return res.end();}let body='';for await(const c of req){body+=c;if(body.length>4096)throw Error('Request too large.');}const input=JSON.parse(body);if(input.action==='logout'&&accountBusy(provider,passes.snapshot(),voice.snapshot(),computerUse.snapshot()))throw Error('Finish or stop this provider’s approved, queued or running work before signing out.');const state=input.action==='logout'?await login.signOut():input.action==='start'?await login.start():input.action==='cancel'?login.cancel():input.action==='code'?login.code(input.code):null;if(!state)throw Error('Choose a sign-in action.');res.end(JSON.stringify(state));}catch(e){res.writeHead(400);res.end(JSON.stringify({error:e instanceof SyntaxError?'Invalid sign-in request.':e.message}));}return;
  }
  if(req.method==='POST'&&url.pathname==='/api/browser-approval'){
    res.setHeader('Content-Type','application/json');res.setHeader('Cache-Control','no-store');
    if(!req.headers.origin||!isLocalOrigin(req)){res.writeHead(403);return res.end(JSON.stringify({error:'Origin not allowed.'}));}
    try{let body='';for await(const c of req){body+=c;if(body.length>4096)throw Error('Request too large.');}const input=JSON.parse(body);const run=passes.snapshot().runs.find(r=>r.id===input.run&&r.project===input.project&&r.slot===Number(input.slot));if(!run||typeof input.allow!=='boolean')throw Error('Invalid browser approval.');res.end(JSON.stringify(await browserVideo.decide(run.id,input.approval,input.allow)));}catch(e){res.writeHead(400);res.end(JSON.stringify({error:e.message}));}return;
  }
  if(req.method==='POST'&&url.pathname==='/api/browser-control'){
    res.setHeader('Cache-Control','no-store');res.setHeader('Content-Type','application/json');
    const token=req.headers.authorization?.replace(/^Bearer /,'');
    if(req.headers.origin||!token||!browserVideo.authorized(token)){res.writeHead(403);return res.end(JSON.stringify({error:'Task browser authorization expired.'}));}
    try{let body='';for await(const chunk of req){body+=chunk.toString();if(body.length>16384)throw Error('Browser request too large.');}const input=JSON.parse(body);const result=await browserVideo.control(token,input.operation,input.args);res.end(JSON.stringify(result));}catch(e){res.writeHead(400);res.end(JSON.stringify({error:e.message}));}return;
  }
  if(req.method==='GET'&&['/api/browser-feed','/api/browser-frame','/api/browser-video','/api/browser-pointer'].includes(url.pathname)){
    res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');
    const run=passes.snapshot().runs.find(r=>r.id===url.searchParams.get('run')&&r.project===url.searchParams.get('project')&&r.slot===Number(url.searchParams.get('slot'))&&['codex','claude'].includes(r.provider||'codex'));
    if(!run){res.writeHead(404);return res.end();}
    if(url.pathname==='/api/browser-feed'){res.setHeader('Content-Type','application/json');return res.end(JSON.stringify({...runner.browserFeed.view(run),video:browserVideo.view(run.id)}));}
    if(url.pathname==='/api/browser-pointer'){if(!browserVideo.pointerStream(run.id,res)){res.writeHead(404);res.end();}return;}
    if(url.pathname==='/api/browser-video'){if(!browserVideo.stream(run.id,res)){res.writeHead(404);res.end();}return;}
    const frame=browserVideo.frame(run.id)||runner.browserFeed.frame(run.id);if(!frame){res.writeHead(404);return res.end();}
    res.setHeader('Content-Type',frame.mimeType);return res.end(Buffer.from(frame.data,'base64'));
  }


  if(url.pathname==='/api/roommates'&&req.method==='GET') {
    if(!isLocalOrigin(req)){res.writeHead(403);return res.end();}
    const home=world.households[url.searchParams.get('project')];
    if(!home||!selectedProjects.includes(home.project)){res.writeHead(404);return res.end(JSON.stringify({error:'Choose a home in this town.'}));}
    const saved=passes.snapshot();
    res.writeHead(200,{'content-type':'application/json','cache-control':'no-store'});
    return res.end(JSON.stringify({...roommateView(home,[...saved.proposals,...saved.runs],Object.values(world.households).flatMap(h=>h.characters)),runner:runner.status(),built:homeBuildState(gameplay,home.project).status==='built'}));
  }
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

  if (['/api/town','/api/care','/api/home-level','/api/roommates','/api/schedules','/api/codex-projects','/api/voice','/api/computer-use','/api/pass-attachment','/api/gameplay','/api/pass-cancel','/api/pass-chat','/api/pass-proposal', '/api/pass-decision', '/api/pass-resolve', '/api/projects', '/api/conversations', '/api/conversation-title', '/api/plan', '/api/task', '/api/briefing-seen', '/api/style', '/api/milestone', '/api/photo-delete', '/api/review', '/api/artifact-preview'].includes(url.pathname) && req.method === 'POST') {
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
      if (['/api/pass-proposal','/api/pass-chat','/api/pass-attachment','/api/voice','/api/computer-use','/api/schedules'].includes(url.pathname)
        && input.project && homeBuildState(gameplay, input.project).status !== 'built') throw Error('Finish building this home before its resident can work.');
      // Inactive projects (and, while over capacity, every project) start no new work; stopping is always allowed.
      if ((['/api/pass-proposal','/api/pass-attachment'].includes(url.pathname) || (['/api/voice','/api/computer-use'].includes(url.pathname) && input.action === 'start')
        || (url.pathname === '/api/schedules' && ['create','resume','update'].includes(input.action)) || (url.pathname === '/api/roommates' && input.action === 'suggest')) && executionBlock(input.project)) throw Error(executionBlock(input.project));
      if (['/api/pass-chat','/api/roommates','/api/home-level','/api/care','/api/schedules'].includes(url.pathname) && !allowSynthetic && !selectedProjects.includes(input.project)) throw Error('This project isn’t active in your town.');
      if (['/api/pass-proposal','/api/pass-attachment','/api/voice','/api/computer-use'].includes(url.pathname)
        && !residentCharacters(world.households[input.project]).some(c => c.slot === Number(input.slot))) {
        throw Error('Choose an active resident in this home.');
      }
      if (url.pathname === '/api/pass-decision' && input.action === 'approve') {
        const proposal = passes.snapshot().proposals.find(p => p.id === input.id);
        if (proposal && homeBuildState(gameplay, proposal.project).status !== 'built') throw Error('Finish building this home before its resident can work.');
        if (proposal && executionBlock(proposal.project)) throw Error(executionBlock(proposal.project));
        if (!residentCharacters(world.households[proposal?.project]).some(c => c.slot === proposal?.slot)) throw Error('Resident is not active in this home.');
      }
      let result;
      if (url.pathname === '/api/town') {
        // Town planning: the bridge validates every change against the same rules the preview used.
        result = await townStore.exclusive(async () => {
          const town = townStore.town;
          const tile = (t) => ({ i: Math.round(Number(t?.i)), j: Math.round(Number(t?.j)) });
          const fresh = () => { if (input.revision !== town.revision) throw Error('The town changed since this preview. Check it again.'); };
          let next;
          if (input.action === 'add-road') { fresh(); next = addRoad(town, tile(input.from), tile(input.to), { bend: input.bend === 'z' ? 'z' : 'x', name: input.name }); }
          else if (input.action === 'remove-road') { fresh(); next = removeRoad(town, tile(input.from), tile(input.to)); }
          else if (input.action === 'move-home') {
            fresh();
            if (!selectedProjects.includes(input.project) && !allowSynthetic) throw Error('Choose a home in your town.');
            if (!town.homes.some(h => h.project === input.project)) throw Error('Choose a home in your town.');
            next = placeHome(town, input.project, { i: Math.round(Number(input.i)), j: Math.round(Number(input.j)), rot: Number(input.rot) || 0 });
          }
          else if (input.action === 'rename-street') next = renameStreet(town, String(input.streetId || ''), input.name);
          else if (input.action === 'place-civic') { fresh(); next = placeCivic(town, String(input.kind || ''), { i: Math.round(Number(input.i)), j: Math.round(Number(input.j)), rot: Number(input.rot) || 0 }, { level: permits().level }); }
          else if (input.action === 'remove-civic') { fresh(); next = removeCivic(town, String(input.kind || '')); }
          else if (input.action === 'choose-active') {
            // An over-capacity save: the player chooses who stays; the others leave once their running work settles.
            if (!overCapacity()) throw Error('Your town is within its permits.');
            const keep = [...new Set(Array.isArray(input.projects) ? input.projects : [])];
            const allowed = permits().allowed;
            if (keep.some(p => !selectedProjects.includes(p) || pendingRemoval()[p])) throw Error('Choose from your active projects.');
            if (keep.length > allowed) throw Error(`Choose up to ${allowed} project${allowed === 1 ? '' : 's'}.`);
            if (!keep.length) throw Error('Choose at least one project to keep.');
            const leaving = selectedProjects.filter(p => !keep.includes(p) && !pendingRemoval()[p]);
            const outcome = leaving.map(p => requestRemoval(p, 'Not chosen to stay active (over capacity).'));
            townStore.save({ ...townStore.town, activeChoice: { at: new Date().toISOString(), kept: keep, allowed, leaving }, revision: townStore.town.revision + 1 });
            broadcastTown();
            return { kept: keep, leaving: outcome };
          }
          else throw Error('Choose a town planning action.');
          townStore.save(next);
          broadcastTown();
          return { revision: next.revision };
        });
        res.writeHead(200); return res.end(JSON.stringify({ ok: true, result }));
      }
      if (url.pathname === '/api/care') {
        const home = world.households[input.project];
        if (!home || !selectedProjects.includes(input.project)) throw Error('Choose a home in this town.');
        if (homeBuildState(gameplay, input.project).status !== 'built') throw Error('Finish building this home first.');
        const character = residentCharacters(home).find(c => c.id === input.agentId);
        if (!character) throw Error('Choose an active resident in this home.');
        const changed = applyCare(character, input, { busy: careBusy(input.project, character) });
        if (!changed.duplicate) {
          home.characters[home.characters.indexOf(character)] = changed.character;
          persistHouseholds();
          broadcast({ type: 'household', household: home });
        }
        res.writeHead(200); return res.end(JSON.stringify({ ok: true, ...changed }));
      }
      if(url.pathname==='/api/schedules'){if(allowSynthetic)throw Error('Scheduling is unavailable in the demo.');result=schedules.mutate(input,authorizeSchedule);res.writeHead(200,{'content-type':'application/json'});return res.end(JSON.stringify({ok:true,result}));}
      if(url.pathname==='/api/codex-projects'){
        if(allowSynthetic)throw new Error('Local Codex projects are unavailable in the demo.');
        if (['import', 'create'].includes(input.action) && townHallState(gameplay).status !== 'built') throw new Error('Build the Town Hall with Mayor Martin before building a home.');
        const register=p=>{if(!selectedProjects.includes(p.path)){gameplay=startHomeConstruction(gameplay,p.path);saveGameplay();constructionStates.set(p.path,homeBuildState(gameplay,p.path).status);}selectProject(p.path);const h=world.ensureHomeOwner(p.path);if(!h.codexProjectId||h.codexProjectId===p.id){h.name=p.name;h.codexProjectId=p.id;}h.codexProjectIds=[...new Set([...(h.codexProjectIds||[]),p.id])];h.codexRootCount=p.rootCount;broadcast({type:'household',household:h});return presentedHome(h);};
        if(input.action==='list'){result=await localProjects.list();result.homes=selectedProjects.map(p=>world.households[p]).filter(Boolean).map(presentedHome);result.town=townView();}
        else if(input.action==='remove'){
          result=await townStore.exclusive(async()=>{
            if(typeof input.project!=='string'||!selectedProjects.includes(input.project))throw new Error('Choose a project in your world.');
            return requestRemoval(input.project,'Project removed from town.');
          });
        }
        else if(input.action==='keep'){
          result=await townStore.exclusive(async()=>{
            if(!pendingRemoval()[input.project]||!selectedProjects.includes(input.project))throw new Error('That project isn’t waiting to be removed.');
            if(selectedProjects.filter(p=>!pendingRemoval()[p]).length+1>permits().allowed)throw capacityError(permits());
            const pending={...pendingRemoval()};delete pending[input.project];townStore.save({...townStore.town,pendingRemoval:pending,revision:townStore.town.revision+1});broadcastTown();
            return {project:input.project,kept:true};
          });
        }
        else if(input.action==='import'||input.action==='create'){
          // Add project: capacity and plot are checked before anything is created, and again (under the same lock)
          // before the project becomes active. Cancelling earlier changes nothing.
          result=await townStore.exclusive(async()=>{
            let project=null;
            if(input.action==='import'){
              const list=await localProjects.list();project=list.projects.find(p=>p.id===input.id);
              if(!project)throw new Error('Project unavailable. Refresh the import list.');
              if(selectedProjects.includes(project.path))return {project,home:register(project),existing:true};
            }
            if(overCapacity())throw Object.assign(Error(`Choose which projects stay active first (${permits().allowed} permit${permits().allowed===1?'':'s'} for ${selectedProjects.length} projects).`),{permits:permits()});
            const replace=typeof input.replace==='string'?input.replace:null;
            if(replace){
              if(!selectedProjects.includes(replace)||pendingRemoval()[replace])throw new Error('Choose an active project to replace.');
              const busy=runningWork(replace);if(busy.length)throw new Error(`Finish or stop ${busy.map(w=>w.title).join(', ')} in the project you're replacing first.`);
            }
            const free=()=>replace?retireHome(townStore.town,replace):townStore.town;
            if(!replace&&selectedProjects.length>=permits().allowed)throw capacityError(permits());
            if(input.revision!=null&&input.revision!==townStore.town.revision)throw new Error('The town changed since you chose this plot. Check the plot again.');
            const placement=input.placement;
            if(!placement||!Number.isInteger(placement.i)||!Number.isInteger(placement.j))throw new Error('Choose a plot for the new home first.');
            const first=checkPlacement(free(),placement,{project:project?.path||'\0new'});if(!first.ok)throw new Error(first.reason);
            if(input.action==='create'){
              project=await localProjects.create(input);
              if(selectedProjects.includes(project.path))return {project,home:register(project),existing:true};
            }
            const kept=input.action==='create'&&!project.existing?` The new project folder ${project.path} was kept; add it from Existing project when ready.`:'';
            // Revalidate at confirmation: nothing is activated unless both still hold.
            if(!replace&&selectedProjects.length>=permits().allowed)throw Object.assign(Error(capacityError(permits()).message+kept),{permits:permits()});
            const again=checkPlacement(free(),placement,{project:project.path});if(!again.ok)throw new Error(again.reason+kept);
            if(replace)deactivate(replace,'Replaced by another project.');
            try{
              townStore.save(placeHome(townStore.town,project.path,placement));
              const home=register(project);broadcastTown();
              return {project,home};
            }catch(e){townStore.reconcile(selectedProjects);broadcastTown();throw new Error(e.message+kept);}
          });
        }
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
      if(url.pathname==='/api/home-level') {
        const home=world.households[input.project];
        if(!home||!selectedProjects.includes(input.project))throw Error('Choose a home in this town.');
        if(homeBuildState(gameplay,input.project).status!=='built')throw Error('Finish building this home first.');
        const saved=passes.snapshot();
        if([...saved.runs,...saved.proposals].some(r=>r.project===home.project&&['approved','queued','running','interrupted'].includes(r.status)))throw Error('Finish or resolve this home’s work before changing its test level.');
        setHomeTestingLevel(home,experience(saved.runs).residents,input.level);
        persistHouseholds();broadcast({type:'household',household:home});
        res.writeHead(200);return res.end(JSON.stringify({ok:true}));
      }
      if(url.pathname==='/api/roommates') {
        if(allowSynthetic)throw Error('Recruitment inspections are unavailable in the demo.');
        const home=world.households[input.project];
        if(!home||!selectedProjects.includes(input.project))throw Error('Choose a home in this town.');
        if(homeBuildState(gameplay,input.project).status!=='built')throw Error('Finish building this home first.');
        const saved=passes.snapshot(),view=roommateView(home,[...saved.proposals,...saved.runs],Object.values(world.households).flatMap(h=>h.characters));
        if(input.action==='suggest') {
          if(view.xp.level<2)throw Error(`Requires home level 2 · ${HOME_XP_THRESHOLDS[1]} pooled XP.`);
          if(!runner.enabled)throw Error('The local runner is disabled. Reopen the normal app to enable inspections.');
          if(!['codex','claude'].includes(input.provider)||!runner.status().providers[input.provider].installed)throw Error('Choose an installed provider.');
          if(!view.owner||!residentCharacters(home).some(c=>c.id===view.owner.id))throw Error('This home needs an active Personal Assistant owner.');
          if([...saved.runs,...saved.proposals].some(r=>r.project===home.project&&['approved','queued','running','interrupted'].includes(r.status)))throw Error('Finish or resolve this home’s current work before another inspection.');
          const current=[...saved.proposals].reverse().find(p=>p.project===home.project&&p.slot===view.owner.slot);
          const proposal=passes.propose({project:home.project,slot:view.owner.slot,provider:input.provider,kind:'roommate_inspection',title:'Suggest Roommates',instruction:inspectionInstruction(),recordedBy:'Human · Suggest Roommates',version:current?.version,enqueue:true},world.households);
          result=passes.decide({id:proposal.id,version:proposal.version,action:'approve',confirmed:true},world.households);
          broadcast({type:'passes',passes:passes.snapshot(),runner:runner.status()});
        } else if(input.action==='recruit') {
          result=recruitCandidate(home,view,input.candidateId);persistHouseholds();
          broadcast({type:'household',household:home});
        } else throw Error('Choose suggest or recruit.');
        res.writeHead(200);return res.end(JSON.stringify({ok:true,result}));
      }
      if (url.pathname === '/api/gameplay') {
        if (input.action === 'expedite-home' && !selectedProjects.includes(input.project)) throw Error('Choose a home in this town.');
        if (input.action === 'reset') {
          if (allowSynthetic) throw Error('Reset is unavailable in the demo.');
          const reset = resetTown(homeDir(), { confirmed: input.confirmed, passes: passes.snapshot(), voice: voice.snapshot(), computerUse: computerUse.snapshot() });
          passes.change(data => { for (const schedule of data.schedules || []) if (schedule.status === 'active') {
            schedule.status = 'paused'; schedule.message = 'Town reset by developer.'; schedule.version++;
          } });
          gameplay = reset.gameplay;
          style = reset.style;
          selectedProjects = [];
          townStore.save(emptyTown());
          res.writeHead(200); res.end(JSON.stringify({ ok: true, backup: reset.backup }));
          broadcast({ type: 'game-reset' });
          return;
        }
        if (input.action === 'claim' && !(await providerReady(input.provider))) throw new Error('Sign in to Codex or Claude Code, then try again.');
        const balance = progress({...productivity.snapshot(), households:Object.values(world.households), runs:passes.snapshot().runs}, style, gameplay).balance;
        gameplay = applyGameplayAction(gameplay, input, balance);
        saveGameplay();
        if (input.action === 'expedite-home') {
          constructionStates.set(input.project, 'built');
          broadcast({ type: 'household', household: world.households[input.project] });
        }
        res.writeHead(200); return res.end(JSON.stringify({ ok: true, gameplay }));
      }
      if (url.pathname === '/api/style') {
        if (['layout', 'street'].includes(input.kind)) throw Error('Streets and plots are planned in town planning now (Plan town).');
        // Bricks and levels are derived from the human's board every time (docs/GAMEPLAY.md).
        const earnedNow = progress({...productivity.snapshot(), households:Object.values(world.households), runs:passes.snapshot().runs}, style, gameplay);
        const known = {
          homes: new Set(Object.keys(world.households)),
          residents: new Set(Object.values(world.households).flatMap((h) => h.characters.map((c) => `${h.project}#${c.slot}`))),
          earned: earnedNow.earned - gameplaySpent(gameplay),
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
      res.writeHead(400); return res.end(JSON.stringify({ error: err.message, ...(err.auth ? { auth: err.auth } : {}), ...(err.permits ? { permits: err.permits } : {}) }));
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
    let pathname;
    try { pathname = decodeURIComponent(url.pathname); }
    catch { res.writeHead(400); return res.end('Invalid asset path'); }
    const file = path.join(root, pathname === '/' ? 'index.html' : path.normalize(pathname));
    if (file.startsWith(root + path.sep) && fs.existsSync(file) && fs.statSync(file).isFile()) {
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

process.on('SIGTERM',()=>{claudeLogin.finish();codexLogin.finish();voice.stop();localSpeech.stop();computerUse.cancel();runner.stop();process.exit(0);});
process.on('SIGINT',()=>{claudeLogin.finish();codexLogin.finish();computerUse.cancel();runner.stop();process.exit(0);});

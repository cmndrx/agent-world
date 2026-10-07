import {readModels,observedModel} from './models.mjs';
import { usageReader } from './usage.mjs';
import {threadBusy} from '../shared/pass-conversations.mjs';
import { PassStore } from './passes.mjs';
import { PassRunner } from './pass-runner.mjs';
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
const runner=new PassRunner(passes,{canRun:p=>!threadBusy(world.snapshot().sessions,p.resumeSession),enabled:process.env.AGENT_WORLD_RUNNER==='1',onChange:()=>broadcast({type:'passes',passes:passes.snapshot(),runner:runner.status()})});


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
  staleAfterMs: config.staleAfterMinutes * 60 * 1000,
});

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
const snapshot = () => ({ ...world.snapshot(), ...productivity.snapshot(), style, photos: listPhotos(), city, passes:passes.snapshot(), runner:runner.status() });
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

  if(url.pathname==='/api/models'&&req.method==='GET'){
    const project=url.searchParams.get('project');const ids=(url.searchParams.get('threads')||'').split(',').filter(Boolean).slice(0,30);
    const known=id=>world.catalog.snapshot().conversations.some(c=>c.source==='codex'&&c.id===id&&c.project===project)||passes.snapshot().runs.some(r=>r.project===project&&(r.conversationSession===id||r.resumeSession===id));
    if(!Object.hasOwn(world.households,project)||ids.some(id=>!known(id))){res.writeHead(400);return res.end(JSON.stringify({error:'Choose conversations recorded in this project.'}));}
    const catalog=allowSynthetic?{status:'unavailable',models:[]}:await readModels();res.writeHead(200,{'content-type':'application/json','cache-control':'no-store'});return res.end(JSON.stringify({...catalog,observed:allowSynthetic?[]:ids.map(id=>observedModel(id)).filter(Boolean)}));
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

  if (['/api/pass-proposal', '/api/pass-decision', '/api/pass-resolve', '/api/projects', '/api/conversations', '/api/conversation-title', '/api/plan', '/api/task', '/api/briefing-seen', '/api/style', '/api/milestone', '/api/photo-delete', '/api/review', '/api/artifact-preview'].includes(url.pathname) && req.method === 'POST') {
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
        if (body.length > 16384) throw new Error('Request is too large.');
      }
      const input = JSON.parse(body);
      let result;
      if(url.pathname.startsWith('/api/pass-')) {
        if(url.pathname==='/api/pass-proposal'){if((!input.provider||input.provider==='codex')&&!runner.status().providers.codex.installed)throw new Error('Codex CLI executable was not found. Check installation or AGENT_WORLD_CODEX_COMMAND, then restart the bridge.');if(input.provider==='claude'&&!runner.status().providers.claude.installed)throw new Error('Claude Code CLI is not installed. Install it and sign in, then restart the bridge.');if(input.provider==='claude'&&input.model)throw new Error('Claude uses its configured default model.');if(input.model){const catalog=await readModels();if(!catalog.models?.some(m=>m.id===input.model))throw new Error('Selected model is unavailable. Refresh the model list.');}if(input.resumeSession){const provider=input.provider||'codex';const known=(provider==='codex'&&world.catalog.snapshot().conversations.some(c=>c.source==='codex'&&c.id===input.resumeSession&&c.project===input.project))||passes.snapshot().runs.some(r=>r.project===input.project&&(r.provider||'codex')===provider&&r.conversationSession===input.resumeSession);if(!known)throw new Error('Conversation is not recorded in this project.');}result=passes.propose(input,world.households);}
        else if(url.pathname==='/api/pass-resolve')result=passes.resolve(input);
        else {if(input.action==='approve' && !runner.enabled)throw new Error('Local runner is unavailable. Start npm run dev with the runner enabled.');const proposal=passes.snapshot().proposals.find(p=>p.id===input.id);if(input.action==='approve'&&threadBusy(world.snapshot().sessions,proposal?.resumeSession))throw new Error('This conversation is working. Wait for its current turn to finish.');result=passes.decide(input,world.households);}
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
  console.log(`[bridge] watching ${eventsDir()}`);
  console.log(`[bridge] http://127.0.0.1:${server.address().port}${STATIC_DIR ? '' : '  (api only)'}`);
});

process.on('SIGTERM',()=>{runner.stop();process.exit(0);});
process.on('SIGINT',()=>{runner.stop();process.exit(0);});

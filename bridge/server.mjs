// The bridge: watches the event inbox, maintains the truth model, and streams it to clients.
//
//   GET  /api/state    full snapshot
//   GET  /api/stream   Server-Sent Events: snapshot, then incremental changes
//   POST /api/rename   { project, slot, name }
//
// Usage: node bridge/server.mjs [--port 4777] [--serve dist]

import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { ensureHome, eventsDir, householdsFile, readConfig } from '../shared/home.mjs';
import { Inbox } from './inbox.mjs';
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

function loadHouseholds() {
  try {
    return JSON.parse(fs.readFileSync(householdsFile(), 'utf8'));
  } catch {
    return {};
  }
}

let saveTimer = null;
function saveHouseholds() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    fs.writeFileSync(householdsFile(), JSON.stringify(world.households, null, 2));
  }, 250);
}

const world = new World({
  households: loadHouseholds(),
  staleAfterMs: config.staleAfterMinutes * 60 * 1000,
});

const inbox = new Inbox(eventsDir(), { onError: (err) => console.warn('[inbox]', err.message) });
for (const e of inbox.readAll()) world.apply(e);
world.sweep();
saveHouseholds();

const clients = new Set();
function broadcast(msg) {
  const data = `data: ${JSON.stringify(msg)}\n\n`;
  for (const res of clients) res.write(data);
}

world.on('change', (change) => {
  if (change.type === 'household') saveHouseholds();
  broadcast(change);
});

inbox.watch((e) => world.apply(e));
setInterval(() => world.sweep(), 30_000);

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png' };

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');

  if (url.pathname === '/api/state') {
    res.writeHead(200, { 'content-type': 'application/json' });
    return res.end(JSON.stringify(world.snapshot()));
  }

  if (url.pathname === '/api/stream') {
    res.writeHead(200, {
      'content-type': 'text/event-stream',
      'cache-control': 'no-cache',
      connection: 'keep-alive',
    });
    res.write(`data: ${JSON.stringify({ type: 'snapshot', demo: process.env.AGENT_WORLD_DEMO === '1', ...world.snapshot() })}\n\n`);
    clients.add(res);
    const ping = setInterval(() => res.write(': ping\n\n'), 15_000);
    req.on('close', () => {
      clearInterval(ping);
      clients.delete(res);
    });
    return;
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
  console.log(`[bridge] watching ${eventsDir()}`);
  console.log(`[bridge] http://127.0.0.1:${PORT}${STATIC_DIR ? '' : '  (api only)'}`);
});

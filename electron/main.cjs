// Agent World desktop app. It runs the exact same build as `npm start`: the bridge (serving the
// built client from dist/) and the Codex log tailer, using Electron's bundled Node, then opens the
// game in a window. Like the web version it only observes; quitting the app stops both processes.
//
//   npm run app            build the client and open the app from this checkout
//   npm run app:demo       same, with fake agents in an isolated home (never touches ~/.agent-world)
//   npm run app:build      package release/mac-arm64/Agent World.app

const { app, BrowserWindow, dialog, shell } = require('electron');
const { spawn, execFileSync } = require('node:child_process');
const fs = require('node:fs');
const http = require('node:http');
const net = require('node:net');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const DIST = path.join(ROOT, 'dist');
const DEFAULT_PORT = Number(process.env.AGENT_WORLD_PORT) || 4777;
const DEMO = process.argv.includes('--demo') || process.env.AGENT_WORLD_DEMO === '1';

app.setName('Agent World');
if (!app.requestSingleInstanceLock()) app.quit();

const children = [];
let win = null;
let quitting = false;
let logStream = null;

function log(line) {
  logStream?.write(`${new Date().toISOString()} ${line}\n`);
}

/** Apps opened from Finder get a bare PATH; borrow the login shell's so `codex`/`claude` resolve for passes. */
function loginShellPath() {
  if (process.platform === 'win32') return process.env.PATH;
  try {
    const shellPath = process.env.SHELL || '/bin/zsh';
    const out = execFileSync(shellPath, ['-ilc', 'printf "__PATH__%s" "$PATH"'], { encoding: 'utf8', timeout: 4000 });
    return out.split('__PATH__').pop().trim() || process.env.PATH;
  } catch {
    return process.env.PATH;
  }
}

function get(url, timeout = 800) {
  return new Promise((resolve) => {
    const req = http.get(url, { timeout }, (res) => {
      let body = '';
      res.on('data', (c) => (body += c));
      res.on('end', () => resolve({ status: res.statusCode, body }));
    });
    req.on('timeout', () => req.destroy());
    req.on('error', () => resolve(null));
  });
}

const isAgentWorldState = (r) => {
  try {
    return r?.status === 200 && 'households' in JSON.parse(r.body);
  } catch {
    return false;
  }
};

function portFree(port) {
  return new Promise((resolve) => {
    const s = net.createServer();
    s.once('error', () => resolve(false));
    s.listen(port, '127.0.0.1', () => s.close(() => resolve(true)));
  });
}

function freePort() {
  return new Promise((resolve) => {
    const s = net.createServer();
    s.listen(0, '127.0.0.1', () => {
      const { port } = s.address();
      s.close(() => resolve(port));
    });
  });
}

/** Run one of the project's Node scripts with Electron's own Node runtime. */
function runNode(name, script, args, env) {
  const child = spawn(process.execPath, [path.join(ROOT, script), ...args], {
    cwd: ROOT,
    env: { ...env, ELECTRON_RUN_AS_NODE: '1' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const pipe = (chunk) => chunk.toString().split('\n').filter(Boolean).forEach((l) => log(`[${name}] ${l}`));
  child.stdout.on('data', pipe);
  child.stderr.on('data', pipe);
  child.on('exit', (code, signal) => {
    log(`[${name}] exited (${code ?? signal})`);
    if (!quitting && name === 'bridge') {
      dialog.showErrorBox('Agent World stopped', `The local bridge exited unexpectedly (${code ?? signal}).\n\nDetails: ${logFile()}`);
      app.quit();
    }
  });
  children.push(child);
  return child;
}

const logFile = () => path.join(app.getPath('logs'), 'agent-world.log');

async function waitForBridge(port, ms = 30000) {
  const until = Date.now() + ms;
  while (Date.now() < until) {
    const page = await get(`http://127.0.0.1:${port}/`);
    if (page?.status === 200 && isAgentWorldState(await get(`http://127.0.0.1:${port}/api/state`))) return true;
    await new Promise((r) => setTimeout(r, 250));
  }
  return false;
}

/**
 * Where to load the game from. If Agent World is already running on this machine (`npm run dev` or
 * `npm start`), reuse it rather than starting a second bridge over the same home folder.
 */
async function resolveGameUrl() {
  if (!DEMO && isAgentWorldState(await get(`http://127.0.0.1:${DEFAULT_PORT}/api/state`, 5000))) {
    const page = await get(`http://127.0.0.1:${DEFAULT_PORT}/`, 5000);
    if (page?.status === 200 && page.body.includes('<html')) return { url: `http://127.0.0.1:${DEFAULT_PORT}/`, reused: true };
    // Vite may listen on IPv6 only ([::1]), so check both loopback addresses.
    const webPort = Number(process.env.AGENT_WORLD_WEB_PORT) || 5177;
    for (const host of ['127.0.0.1', '[::1]']) {
      const vite = await get(`http://${host}:${webPort}/`, 5000); // dev servers can be slow to answer
      if (vite?.status === 200) return { url: `http://localhost:${webPort}/`, reused: true };
    }
    return { error: 'Agent World is already running in API-only mode on this computer. Stop `npm run dev` (or start its web server) and open the app again.' };
  }

  if (!fs.existsSync(path.join(DIST, 'index.html'))) return { error: 'The game build (dist/) is missing. Run `npm run build` first.' };

  const env = { ...process.env, PATH: loginShellPath(), AGENT_WORLD_RUNNER: DEMO ? '0' : (process.env.AGENT_WORLD_RUNNER || '1') };
  if (DEMO) {
    env.AGENT_WORLD_HOME = path.join(app.getPath('userData'), 'demo-home');
    env.AGENT_WORLD_DEMO = '1';
  }
  // Keep the usual port when it's free (so Claude Code hooks and docs line up); otherwise any free one.
  const port = !DEMO && (await portFree(DEFAULT_PORT)) ? DEFAULT_PORT : await freePort();
  env.AGENT_WORLD_PORT = String(port);
  runNode('bridge', 'bridge/server.mjs', ['--port', String(port), '--serve', DIST], env);
  runNode(DEMO ? 'fake' : 'codex', DEMO ? 'adapters/fake-agent.mjs' : 'adapters/codex/tail.mjs', [], env);
  if (!(await waitForBridge(port))) return { error: `The local bridge didn't start.\n\nDetails: ${logFile()}` };
  return { url: `http://127.0.0.1:${port}/` };
}

const LOADING = `data:text/html;charset=utf-8,${encodeURIComponent(`<!doctype html><meta charset="utf-8"><title>Agent World</title>
<style>html,body{margin:0;height:100%;background:#cfe6f5;font:600 15px -apple-system,system-ui,sans-serif;color:#3a4256;display:grid;place-items:center}
.gem{width:34px;height:34px;margin:0 auto 14px;background:linear-gradient(135deg,#7be08f,#2fae5a);transform:rotate(45deg);border-radius:6px;animation:b 1.4s ease-in-out infinite}
@keyframes b{50%{transform:rotate(45deg) translate(-4px,-4px)}}</style><div><div class="gem"></div>Starting Agent World…</div>`)}`;

function createWindow() {
  win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    title: 'Agent World',
    backgroundColor: '#cfe6f5',
    show: false,
    webPreferences: { contextIsolation: true, sandbox: true, nodeIntegration: false, backgroundThrottling: false },
  });
  win.once('ready-to-show', () => win.show());
  win.loadURL(LOADING);

  // Keep the game in the window; links to anything else (chat apps, docs) open outside it.
  const isGame = (url) => {
    try {
      const u = new URL(url);
      return ['127.0.0.1', 'localhost', '[::1]'].includes(u.hostname) || u.protocol === 'data:';
    } catch {
      return false;
    }
  };
  const openOutside = (url) => {
    if (/^(https?|mailto|codex|claude|vscode|cursor):/i.test(url)) shell.openExternal(url);
  };
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (!isGame(url)) openOutside(url);
    return { action: 'deny' };
  });
  // If the game page fails to load (e.g. the bridge is still busy), try again shortly.
  win.webContents.on('did-fail-load', (_e, code, _desc, url, isMainFrame) => {
    if (isMainFrame && code !== -3 && isGame(url) && !url.startsWith('data:')) setTimeout(() => win?.loadURL(url), 1000);
  });
  win.webContents.on('will-navigate', (e, url) => {
    if (isGame(url)) return;
    e.preventDefault();
    openOutside(url);
  });
  win.on('closed', () => (win = null));
}

app.on('second-instance', () => {
  if (!win) return;
  if (win.isMinimized()) win.restore();
  win.focus();
});

app.whenReady().then(async () => {
  fs.mkdirSync(app.getPath('logs'), { recursive: true });
  logStream = fs.createWriteStream(logFile(), { flags: 'a' });
  log(`[app] starting ${DEMO ? '(demo)' : ''} from ${ROOT}`);
  createWindow();
  const target = await resolveGameUrl();
  if (target.error) {
    log(`[app] ${target.error}`);
    dialog.showErrorBox('Agent World', target.error);
    app.quit();
    return;
  }
  log(`[app] loading ${target.url}${target.reused ? ' (reusing a running Agent World)' : ''}`);
  win?.loadURL(target.url);
});

app.on('window-all-closed', () => app.quit());

app.on('before-quit', () => {
  quitting = true;
  for (const c of children) if (c.exitCode === null) c.kill('SIGTERM');
});

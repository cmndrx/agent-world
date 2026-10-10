// Runs the bridge, the Vite dev server, and the Codex log tailer together.
// --demo uses an isolated home (.demo-home/) and fake agents instead of the Codex tailer.
// --prod serves the built client (dist/) from the bridge instead of running Vite.

import { spawn } from 'node:child_process';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const demo = process.argv.includes('--demo');
const prod = process.argv.includes('--prod');
const env = { ...process.env };
env.AGENT_WORLD_RUNNER = demo ? '0' : (process.env.AGENT_WORLD_RUNNER || '1');
if (demo) {
  env.AGENT_WORLD_HOME = path.join(root, '.demo-home');
  env.AGENT_WORLD_DEMO = '1';
}

async function main() {
  // Inspect the port before starting any observer/fake-agent process. Never kill
  // an existing bridge: it may own approved or running work.
  const port = Number(env.AGENT_WORLD_PORT || 4777);
  const available = await new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.once('error', error => error.code === 'EADDRINUSE' ? resolve(false) : reject(error));
    probe.listen(port, '127.0.0.1', () => probe.close(() => resolve(true)));
  });
  if (!available) {
    const base = `http://127.0.0.1:${port}`;
    let reusable = false;
    if (prod && !demo && !process.env.AGENT_WORLD_HOME) {
      try {
        const stateResponse = await fetch(`${base}/api/state`, { signal: AbortSignal.timeout(3000), redirect: 'error' });
        const state = stateResponse.ok ? await stateResponse.json() : null;
        if (Array.isArray(state?.households) && Array.isArray(state?.sessions)) {
          // /api/state omits demo mode; the first SSE snapshot declares it.
          const stream = await fetch(`${base}/api/stream`, { signal: AbortSignal.timeout(3000), redirect: 'error' });
          const reader = stream.body.getReader();
          let initial = '';
          try {
            const decoder = new TextDecoder();
            while (!initial.includes('\n\n') && initial.length < 2 * 1024 * 1024) {
              const { done, value } = await reader.read();
              if (done) break;
              initial += decoder.decode(value, { stream: true });
            }
          } finally { await reader.cancel(); }
          const data = initial.split('\n').find(line => line.startsWith('data: '));
          const snapshot = data ? JSON.parse(data.slice(6)) : null;
          const page = await fetch(base, { signal: AbortSignal.timeout(3000), redirect: 'error' });
          reusable = stream.ok && snapshot?.type === 'snapshot' && snapshot.demo === false
            && page.ok && (await page.text()).includes('<html');
        }
      } catch {}
    }
    if (reusable) {
      console.log(`Agent World is already running. Open ${base}/`);
      console.log('Reusing the existing bridge; no additional observer or runner was started.');
      return;
    }
    console.error(`Port ${port} is already in use. No Agent World processes were started.`);
    console.error(`If Agent World is already open, use ${base}/. Before stopping its existing server, check for approved, queued or running work.`);
    process.exitCode = 1;
    return;
  }

  const procs = [['bridge', process.execPath, ['bridge/server.mjs', ...(prod ? ['--serve', 'dist'] : [])]]];
  if (!prod) procs.push(['vite', process.execPath, ['node_modules/vite/bin/vite.js']]);
  procs.push(demo ? ['fake', process.execPath, ['adapters/fake-agent.mjs']] : ['codex', process.execPath, ['adapters/codex/tail.mjs']]);

  const children = procs.map(([name, cmd, args]) => {
    const child = spawn(cmd, args, { cwd: root, env, stdio: ['ignore', 'pipe', 'pipe'] });
    const prefix = (chunk) => chunk.toString().split('\n').filter(Boolean).map((l) => `[${name}] ${l}`).join('\n') + '\n';
    child.stdout.on('data', (c) => process.stdout.write(prefix(c)));
    child.stderr.on('data', (c) => process.stderr.write(prefix(c)));
    child.on('exit', (code) => console.log(`[${name}] exited (${code})`));
    return child;
  });

  const stop = () => {
    for (const c of children) c.kill('SIGTERM');
    setTimeout(() => process.exit(0), 300);
  };
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
}

await main();

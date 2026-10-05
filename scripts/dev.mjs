// Runs the bridge, the Vite dev server, and the Codex log tailer together.
// --demo uses an isolated home (.demo-home/) and fake agents instead of the Codex tailer.
// --prod serves the built client (dist/) from the bridge instead of running Vite.

import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const demo = process.argv.includes('--demo');
const prod = process.argv.includes('--prod');
const env = { ...process.env };
if (demo) {
  env.AGENT_WORLD_HOME = path.join(root, '.demo-home');
  env.AGENT_WORLD_DEMO = '1';
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

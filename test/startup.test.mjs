import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { spawn } from 'node:child_process';

async function fixture(t, handler) {
  const server = http.createServer(handler);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  return server.address().port;
}

async function start(port, args = ['--prod'], overrides = {}) {
  const env = { ...process.env, AGENT_WORLD_PORT: String(port), ...overrides };
  delete env.AGENT_WORLD_HOME;
  if (overrides.AGENT_WORLD_HOME) env.AGENT_WORLD_HOME = overrides.AGENT_WORLD_HOME;
  const child = spawn(process.execPath, ['scripts/dev.mjs', ...args], { env, stdio: ['ignore', 'pipe', 'pipe'] });
  let output = '';
  child.stdout.on('data', chunk => { output += chunk; });
  child.stderr.on('data', chunk => { output += chunk; });
  const code = await new Promise((resolve, reject) => { child.once('error', reject); child.once('exit', resolve); });
  assert.doesNotMatch(output, /\[(bridge|codex|fake|vite)\]/, 'port conflicts must not start secondary processes');
  return { code, output };
}

const stateHandler = (demo = false, page = true) => (req, res) => {
  if (req.url === '/api/state') {
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify({ households: [], sessions: [] }));
  } else if (req.url === '/api/stream') {
    res.setHeader('content-type', 'text/event-stream');
    res.end(`data: ${JSON.stringify({ type: 'snapshot', demo, households: [], sessions: [] })}\n\n`);
  } else { res.statusCode = page ? 200 : 404; res.end(page ? '<html>Agent World fixture</html>' : 'not found'); }
};

test('production start reuses a healthy live bridge without launching another observer', async t => {
  const port = await fixture(t, stateHandler());
  const result = await start(port);
  assert.equal(result.code, 0);
  assert.match(result.output, new RegExp(`http://127\\.0\\.0\\.1:${port}/`));
  assert.match(result.output, /already running/);
});

test('foreign service, demo bridge and API-only bridge fail safely on an occupied port', async t => {
  for (const handler of [(_req, res) => res.end('unrelated service'), stateHandler(true), stateHandler(false, false)]) {
    const port = await fixture(t, handler);
    const result = await start(port);
    assert.equal(result.code, 1);
    assert.match(result.output, /already in use/);
    assert.match(result.output, /approved, queued or running work/);
  }
});

test('dev, demo and custom-home launches never reuse a possibly different home', async t => {
  const port = await fixture(t, stateHandler());
  for (const [args, env] of [[[], {}], [['--demo'], {}], [['--prod'], { AGENT_WORLD_HOME: '/isolated-fixture' }]]) {
    assert.equal((await start(port, args, env)).code, 1);
  }
});

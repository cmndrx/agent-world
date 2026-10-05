// Fake agents for development: writes realistic canonical events into the inbox.
// Also a reference for anyone writing their own adapter.
//
//   node adapters/fake-agent.mjs [--agents 4] [--speed 1]

import { emit } from './emit.mjs';

const args = process.argv.slice(2);
const arg = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? Number(args[i + 1]) : fallback;
};
const AGENTS = arg('agents', 4);
const SPEED = arg('speed', 1);

const PROJECTS = ['/demo/online-store', '/demo/personal-blog', '/demo/data-scripts'];
const FILES = ['src/index.ts', 'src/orders.ts', 'src/api/routes.ts', 'README.md', 'src/db/schema.sql', 'tests/orders.test.ts',
  'package.json', 'pipeline/etl.py', 'src/components/Header.tsx', 'styles/main.css', 'Dockerfile'];
const PATTERNS = ['handleOrder', 'TODO', 'useEffect', 'def transform', 'createServer'];
const DOMAINS = ['docs.python.org', 'developer.mozilla.org', 'react.dev', 'stackoverflow.com', 'nodejs.org'];
const ROLES = ['Explore', 'reviewer', 'test-writer'];

// Weighted steps that look like a real agent's tool calls.
const STEPS = [
  [14, () => ['reading', { tool: 'Read', target: pick(FILES) }]],
  [6, () => ['reading', { tool: 'Grep', target: pick(PATTERNS) }]],
  [3, () => ['reading', { tool: 'Glob', target: '**/*.ts' }]],
  [14, () => ['editing', { tool: 'Edit', target: pick(FILES) }]],
  [4, () => ['editing', { tool: 'Write', target: pick(['src/utils/retry.ts', 'docs/notes.md', 'tests/api.test.ts']) }]],
  [6, () => ['running', { tool: 'Bash', target: pick(['npm test', 'pytest', 'npm run test']) }]],
  [3, () => ['running', { tool: 'Bash', target: pick(['npm install', 'pip install']) }]],
  [3, () => ['running', { tool: 'Bash', target: pick(['npm run build', 'tsc']) }]],
  [3, () => ['running', { tool: 'Bash', target: pick(['git commit', 'git add', 'git diff']) }]],
  [2, () => ['running', { tool: 'Bash', target: 'npm run dev' }]],
  [2, () => ['running', { tool: 'mcp__github__create_pull_request', target: 'create_pull_request' }]],
  [4, () => ['searching', { tool: 'WebSearch' }]],
  [4, () => ['searching', { tool: 'WebFetch', target: pick(DOMAINS) }]],
  [3, () => ['thinking', { tool: 'TodoWrite' }]],
];
const TOTAL = STEPS.reduce((n, [w]) => n + w, 0);
function step() {
  let r = Math.random() * TOTAL;
  for (const [w, f] of STEPS) if ((r -= w) < 0) return f();
  return STEPS[0][1]();
}
const PROVIDERS = [
  { source: 'claude-code', provider: 'anthropic', app: 'Claude desktop app' },
  { source: 'codex', provider: 'openai', app: 'Codex app' },
];

const live = new Map(); // session -> base
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const sleep = (s) => new Promise((r) => setTimeout(r, (s * 1000) / SPEED));
const between = (a, b) => a + Math.random() * (b - a);

async function agent(i) {
  const { source, provider, app } = PROVIDERS[i % PROVIDERS.length];
  const project = PROJECTS[i % PROJECTS.length];
  const session = `fake-${Date.now().toString(36)}-${i}`;
  const base = { source, provider, app, project, session };
  const state = (s, detail) => emit({ ...base, kind: 'state', state: s, detail });

  emit({ ...base, kind: 'session_start' });
  live.set(session, base);
  await sleep(between(1, 3));

  for (let turn = 0; ; turn++) {
    state('thinking', { summary: 'Working on the next task' });
    await sleep(between(2, 5));

    const steps = 4 + Math.floor(Math.random() * 7);
    for (let k = 0; k < steps; k++) {
      const r = Math.random();
      if (r < 0.07) {
        // Delegate to a sub-agent (visitor) that does its own tool calls.
        const role = pick(ROLES);
        state('delegating', { tool: 'Agent', target: role });
        const sub = { ...base, session: `${session}~${turn}-${k}`, parent_session: session };
        const subState = (st, detail) => emit({ ...sub, kind: 'state', state: st, detail });
        emit({ ...sub, kind: 'session_start' });
        subState('thinking', { target: role });
        await sleep(between(3, 5));
        for (let j = 0; j < 3; j++) {
          subState(...step());
          await sleep(between(3, 6));
        }
        emit({ ...sub, kind: 'session_end' });
      } else if (r < 0.1) {
        state('running', { tool: 'Bash', target: 'npm test' });
        await sleep(between(2, 4));
        state('error', { tool: 'Bash', reason: 'tool_failed' });
      } else {
        const [st, detail] = step();
        state(st, detail);
      }
      await sleep(between(2, 6));
      if (Math.random() < 0.04) {
        state('waiting_for_user', { reason: 'permission', tool: 'Bash' });
        await sleep(between(6, 15));
      }
      state('thinking');
      await sleep(between(1, 3));
    }

    state('waiting_for_user', { reason: 'turn_complete' });
    await sleep(between(8, 25));
    if (Math.random() < 0.5) {
      // Nothing to do: the simulation layer fills this with flavor (coffee, couch, wandering).
      state('idle');
      await sleep(between(20, 45));
    }
  }
}

function shutdown() {
  for (const base of live.values()) emit({ ...base, kind: 'session_end' });
  process.exit(0);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

console.log(`[fake] ${AGENTS} fake agents writing events (speed ${SPEED}x). Ctrl+C to stop.`);
for (let i = 0; i < AGENTS; i++) setTimeout(() => agent(i), i * 1500);

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { once } from 'node:events';

async function start(home) {
  const child = spawn(process.execPath, ['bridge/server.mjs', '--port', '0'], { env: { ...process.env, AGENT_WORLD_HOME: home }, stdio: ['ignore', 'pipe', 'pipe'] });
  let output = '';
  const url = await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => { child.kill(); reject(new Error('Bridge startup timed out')); }, 5000);
    child.stdout.on('data', chunk => {
      output += chunk;
      const match = output.match(/http:\/\/127\.0\.0\.1:\d+/);
      if (match) { clearTimeout(timeout); resolve(match[0]); }
    });
    child.on('error', reject);
    child.on('exit', code => { clearTimeout(timeout); reject(new Error(`Bridge exited: ${code}`)); });
  });
  return { url, stop: async () => { child.kill(); await once(child, 'exit'); } };
}

test('catalog API persists saved chats without manufacturing sessions, validates privacy and origin', async () => {
  const home = await fs.mkdtemp(path.join(os.tmpdir(), 'agent-world-api-'));
  let server;
  try {
    server = await start(home);
    const post = async (route, body, headers = {}) => fetch(server.url + route, { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body) });
    const project = await post('/api/projects', { source: 'claude', externalId: 'p1', name: 'Writing' });
    assert.equal(project.status, 200);
    assert.equal((await post('/api/conversations', { source: 'claude', project: 'claude:p1', url: 'https://claude.ai/chat/c1', title: 'Draft' })).status, 400);
    assert.equal((await post('/api/conversations', { source: 'claude', project: 'claude:p1', url: 'https://claude.ai/chat/c1', title: 'Draft', allowTitle: true })).status, 200);
    assert.equal((await post('/api/projects', { source: 'chatgpt', externalId: 'bad' }, { origin: 'https://example.com' })).status, 403);
    const state = await (await fetch(server.url + '/api/state')).json();
    assert.equal(state.conversations.length, 1); assert.equal(state.conversations[0].title, 'Draft');
    assert.equal(state.sessions.length, 0); assert.equal(state.households[0].characters.length, 0);
    assert.equal((await post('/api/conversation-title', { key: state.conversations[0].key, title: 'Private' })).status, 400);
    assert.equal((await post('/api/conversation-title', { key: state.conversations[0].key, title: 'Revised', allowTitle: true })).status, 200);
    // Wait for the documented debounced disk write before restarting.
    await new Promise(resolve => setTimeout(resolve, 400));
    await server.stop(); server = await start(home);
    const restored = await (await fetch(server.url + '/api/state')).json();
    assert.equal(restored.conversations[0].title, 'Revised');
    assert.equal(restored.projects[0].name, 'Writing'); assert.equal(restored.sessions.length, 0);
  } finally { if (server) await server.stop(); await fs.rm(home, { recursive: true, force: true }); }
});

test('adapter title privacy is applied before writing to disk', async () => {
  const home = await fs.mkdtemp(path.join(os.tmpdir(), 'agent-world-privacy-'));
  try {
    const code = `import { emit } from './adapters/emit.mjs'; emit({ kind: 'session_start', session: 's', source: 'chatgpt', project: 'chatgpt:p', conversation: { id: 'c', title: 'PRIVATE TITLE' } });`;
    const run = async () => {
      const child = spawn(process.execPath, ['--input-type=module', '-e', code], { env: { ...process.env, AGENT_WORLD_HOME: home } });
      const [exit] = await once(child, 'exit'); assert.equal(exit, 0);
    };
    await run();
    const file = path.join(home, 'events/chatgpt-s.jsonl');
    assert.equal((await fs.readFile(file, 'utf8')).includes('PRIVATE TITLE'), false);
    await fs.writeFile(path.join(home, 'config.json'), JSON.stringify({ conversationTitles: true }));
    await run();
    assert.equal((await fs.readFile(file, 'utf8')).includes('PRIVATE TITLE'), true);
  } finally { await fs.rm(home, { recursive: true, force: true }); }
});

test('project plans, linked tasks and briefing checkpoints persist separately from activity', async () => {
  const home = await fs.mkdtemp(path.join(os.tmpdir(), 'agent-world-work-api-'));
  let server;
  try {
    server = await start(home);
    const post = async (route, body) => fetch(server.url + route, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    await post('/api/projects', { source: 'claude', externalId: 'work', name: 'Work' });
    const chat = await (await post('/api/conversations', { source: 'claude', project: 'claude:work', url: 'https://claude.ai/chat/work' })).json();
    assert.equal((await post('/api/plan', { project: 'claude:work', outcome: 'Release the feature', nextAction: 'Review the output', version: 0 })).status, 200);
    const response = await post('/api/task', { project: 'claude:work', title: 'Inspect output', status: 'needs_review', evidence: 'Test results recorded manually', conversationKeys: [chat.result.key] });
    assert.equal(response.status, 200); const t = (await response.json()).result;
    assert.equal((await post('/api/task', { ...t, status: 'accepted' })).status, 400);
    assert.equal((await post('/api/task', { ...t, status: 'accepted', acceptedByUser: true })).status, 200);
    const through = new Date().toISOString();
    assert.equal((await post('/api/briefing-seen', { project: 'claude:work', through })).status, 200);
    await server.stop(); server = await start(home);
    const state = await (await fetch(server.url + '/api/state')).json();
    assert.equal(state.plans[0].outcome, 'Release the feature'); assert.equal(state.plans[0].lastSeenAt, through);
    assert.equal(state.tasks[0].status, 'accepted'); assert.ok(state.tasks[0].acceptedAt);
    assert.equal(state.sessions.length, 0); assert.equal(state.households[0].characters.length, 0);
    assert.ok(await fs.stat(path.join(home, 'productivity.json')));
  } finally { if (server) await server.stop(); await fs.rm(home, { recursive: true, force: true }); }
});

test('skill helper preserves planning metadata and refuses agent acceptance', async () => {
  const home = await fs.mkdtemp(path.join(os.tmpdir(), 'agent-world-skill-'));
  let server;
  const run = async (...args) => {
    const child = spawn(process.execPath, ['skills/agent-world/scripts/platform.mjs', ...args], { stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '', err = '';
    child.stdout.on('data', chunk => { out += chunk; });
    child.stderr.on('data', chunk => { err += chunk; });
    const [code] = await once(child, 'exit');
    return { code, out, err };
  };
  try {
    server = await start(home);
    const post = async (route, body) => fetch(server.url + route, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    await post('/api/projects', { source: 'claude', externalId: 'skill', name: 'Skill QA' });
    const chat = (await (await post('/api/conversations', { source: 'claude', project: 'claude:skill', url: 'https://claude.ai/chat/skill' })).json()).result;
    const local = ['--base', server.url, '--project', 'claude:skill'];
    assert.equal((await run('state', '--base', 'https://example.com')).code, 1);
    assert.equal((await run('task', ...local, '--title', 'QA', '--status', 'accepted')).code, 1);
    assert.equal((await run('plan', ...local, '--outcome', 'Review the slice')).code, 0);
    assert.equal((await run('plan', ...local, '--next-action', 'Inspect evidence')).code, 0);
    const created = await run('task', ...local, '--title', 'Verify slice', '--notes', 'Recorded by agent', '--conversation', chat.key);
    assert.equal(created.code, 0, created.err); const task = JSON.parse(created.out).result;
    const changed = await run('task', ...local, '--id', task.id, '--status', 'needs_review', '--evidence', 'Isolated API checks passed');
    assert.equal(changed.code, 0, changed.err);
    const updated = JSON.parse(changed.out).result;
    assert.equal(updated.notes, 'Recorded by agent'); assert.deepEqual(updated.conversationKeys, [chat.key]);
    assert.ok(updated.version > task.version);
    const briefing = await run('briefing', ...local); assert.equal(briefing.code, 0, briefing.err);
    const observed = JSON.parse(briefing.out);
    assert.equal(observed.plan.outcome, 'Review the slice'); assert.equal(observed.plan.nextAction, 'Inspect evidence');
    assert.equal((await run('seen', ...local, '--through', observed.observedThrough)).code, 0);
    assert.equal((await post('/api/task', { ...updated, status: 'accepted', acceptedByUser: true })).status, 200);
    assert.equal((await run('task', ...local, '--id', task.id, '--notes', 'Change accepted work')).code, 1);
    const state = await (await fetch(server.url + '/api/state')).json();
    assert.equal(state.tasks[0].notes, 'Recorded by agent'); assert.equal(state.sessions.length, 0);
    assert.equal(state.plans[0].lastSeenAt, observed.observedThrough);
  } finally { if (server) await server.stop(); await fs.rm(home, { recursive: true, force: true }); }
});

test('focused review API preserves evidence across restart, rejects stale decisions and foreign origins', async () => {
  const home = await fs.mkdtemp(path.join(os.tmpdir(), 'agent-world-review-api-')); let server;
  try {
    server = await start(home);
    const post = (route, body, headers = {}) => fetch(server.url + route, {method:'POST',headers:{'content-type':'application/json',...headers},body:JSON.stringify(body)});
    await post('/api/projects',{source:'claude',externalId:'review',name:'Review QA'});
    const t=(await (await post('/api/task',{project:'claude:review',title:'Review QA',status:'needs_review',evidence:'Original notes',references:[{kind:'check',value:'npm test',result:'passed',recordedBy:'QA recorder'}]})).json()).result;
    assert.equal((await post('/api/review',{...t,decision:'accept'})).status,400);
    assert.equal((await post('/api/review',{...t,decision:'return',feedback:'Fix output'},{origin:'https://evil.example'})).status,403);
    assert.equal((await post('/api/artifact-preview',{id:t.id,project:t.project,path:'/tmp/unrecorded.md'})).status,400);
    assert.equal((await post('/api/artifact-preview',{id:t.id,project:t.project,path:'/tmp/unrecorded.md'},{origin:'https://evil.example'})).status,403);
    assert.equal((await post('/api/review',{...t,decision:'return',feedback:'Fix output'})).status,200);
    assert.equal((await post('/api/review',{...t,decision:'return',feedback:'Stale'})).status,400);
    await server.stop();server=await start(home);
    const s=await (await fetch(server.url+'/api/state')).json();
    assert.equal(s.tasks[0].reviews[0].feedback,'Fix output');assert.equal(s.tasks[0].status,'in_progress');assert.equal(s.tasks[0].references[0].result,'passed');assert.equal(s.tasks[0].evidence,'Original notes');
  } finally { if(server)await server.stop();await fs.rm(home,{recursive:true,force:true}); }
});

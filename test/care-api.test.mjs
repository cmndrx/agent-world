import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { once } from 'node:events';

test('isolated care API scopes residents, persists, streams, deduplicates and preserves work', async t => {
  const home = await fs.mkdtemp(path.join(os.tmpdir(), 'aw-care-api-'));
  const project = path.join(home, 'project');
  await fs.mkdir(project);
  const households = { [project]: { project, name:'Care fixture', ownerAgentId:'owner', residentAgentIds:['owner'],
    characters:[{ id:'owner', slot:1, seed:1, name:'Rosa', assignedRole:'personal_assistant' },
      { id:'inactive', slot:2, seed:2, name:'Saved', assignedRole:'researcher' }] } };
  await fs.writeFile(path.join(home, 'households.json'), JSON.stringify(households));
  await fs.writeFile(path.join(home, 'selected-projects.json'), JSON.stringify([project]));
  const passText = JSON.stringify({ runs:[], proposals:[] });
  await fs.writeFile(path.join(home, 'passes.json'), passText);
  let child;
  async function stop() {
    if (child && child.exitCode === null) { const exit = once(child, 'exit'); child.kill(); await exit; }
  }
  t.after(async () => {
    await stop();
    assert.ok(path.resolve(home).startsWith(path.resolve(os.tmpdir()) + path.sep));
    await fs.rm(home, { recursive:true, force:true });
  });
  async function start() {
    child = spawn(process.execPath, ['bridge/server.mjs','--port','0'], {
      env:{ ...process.env, AGENT_WORLD_HOME:home, CODEX_HOME:path.join(home,'codex'), AGENT_WORLD_RUNNER:'0' }, stdio:['ignore','pipe','pipe'] });
    return new Promise((resolve, reject) => {
      let text = '', errors = '';
      const timer = setTimeout(() => reject(Error('Server startup timeout: ' + errors)), 10000);
      child.stderr.on('data', chunk => { errors += chunk; });
      child.stdout.on('data', chunk => { text += chunk; const match = text.match(/http:\/\/127\.0\.0\.1:\d+/);
        if (match) { clearTimeout(timer); resolve(match[0]); } });
      child.once('exit', () => { clearTimeout(timer); reject(Error('Server exited: ' + errors)); });
    });
  }
  let base = await start();
  const state = async () => (await fetch(base + '/api/state')).json();
  const owner = async () => (await state()).foundation.agents.find(c => c.id === 'owner');
  const post = body => fetch(base + '/api/care', { method:'POST', headers:{'content-type':'application/json'}, body:JSON.stringify({project, agentId:'owner', ...body}) });
  let c = await owner(); assert.equal(c.happiness, 50); assert.equal(c.interestIds.length, 2);
  assert.equal((await post({ id:'bad-scope', action:'praise', revision:1, agentId:'inactive' })).status, 400);
  assert.equal((await post({ id:'bad-project', action:'praise', revision:1, project:'/unknown' })).status, 400);
  const foreign = await fetch(base + '/api/care', { method:'POST', headers:{'content-type':'application/json', origin:'https://bad.invalid'}, body:'{}' });
  assert.equal(foreign.status, 403);
  const stream = await fetch(base + '/api/stream');
  const reader = stream.body.getReader(); await reader.read();
  let response = await post({ id:'set-interests', action:'interests', revision:c.care.revision, interestIds:['reading'] });
  assert.equal(response.status, 200); c = (await response.json()).character; assert.equal(c.happiness, 50);
  const update = await reader.read(); assert.match(new TextDecoder().decode(update.value), /household/); await reader.cancel();
  const request = { id:'first-praise', action:'praise', revision:c.care.revision };
  response = await post(request); assert.equal(response.status, 200); c = (await response.json()).character; assert.equal(c.happiness, 53);
  response = await post(request); assert.equal((await response.json()).duplicate, true);
  assert.equal((await post({ ...request, id:'stale-praise' })).status, 400);
  assert.equal((await post({ id:'new-praise', action:'praise', revision:c.care.revision })).status, 400);
  response = await post({ id:'first-reading', action:'read', revision:c.care.revision }); assert.equal(response.status, 200);
  c = (await response.json()).character; assert.ok(c.care.pending); assert.equal(c.happiness, 53);
  const events = path.join(home, 'events', 'care-fixture.jsonl');
  const event = { v:1, ts:new Date().toISOString(), source:'codex', provider:'openai', session:'care-interrupt', project };
  await fs.writeFile(events, [JSON.stringify({ ...event, kind:'session_start' }), JSON.stringify({ ...event, kind:'state', state:'reading' })].join('\n') + '\n');
  for (let i = 0; i < 30; i++) { c = await owner(); if (!c.care.pending) break; await new Promise(resolve => setTimeout(resolve,100)); }
  assert.equal(c.care.pending, null); assert.equal(c.happiness, 53); assert.match(c.care.history.at(-1).label, /interrupted/);
  assert.equal((await post({ id:'busy-reading', action:'read', revision:c.care.revision })).status, 400);
  await fs.appendFile(events, JSON.stringify({ ...event, ts:new Date().toISOString(), kind:'session_end' }) + '\n');
  for (let i = 0; i < 30; i++) { if (!(await state()).sessions.length) break; await new Promise(resolve => setTimeout(resolve,100)); }
  response = await post({ id:'restart-reading', action:'read', revision:c.care.revision }); assert.equal(response.status, 200);
  await response.json();
  await stop(); base = await start();
  c = await owner(); assert.equal(c.care.pending, null); assert.equal(c.happiness, 53);
  assert.match(c.care.history.at(-1).label, /restart/);
  assert.deepEqual(c.interestIds, ['reading']);
  response = await post({ id:'second-reading', action:'read', revision:c.care.revision }); assert.equal(response.status, 200);
  await response.json();
  await new Promise(resolve => setTimeout(resolve, 11000));
  c = await owner(); assert.equal(c.happiness, 58); assert.equal(c.care.pending, null);
  assert.equal(c.care.history.filter(h => h.action === 'read').length, 1);
  assert.equal(await fs.readFile(path.join(home,'passes.json'), 'utf8'), passText);
  const saved = JSON.parse(await fs.readFile(path.join(home,'households.json'),'utf8'))[project];
  assert.equal(saved.characters.find(c => c.id === 'owner').happiness, 58);
  assert.equal(saved.characters.find(c => c.id === 'inactive').care, undefined);
});

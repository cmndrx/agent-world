import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { initializeHousehold, agentForRecord, foundationSnapshot, BUILDING_TYPES } from '../shared/foundation.mjs';
import { World } from '../bridge/world.mjs';
import { PassStore } from '../bridge/passes.mjs';
import { experience } from '../shared/experience.mjs';
import { mayorStage } from '../shared/gameplay.mjs';
import { projectTeam } from '../shared/team.mjs';

test('imported observed and legacy teams activate only their owner without deleting identities', () => {
  const project = '/imported', w = new World({ households: { [project]: { project, starterTeam: true,
    characters: [{ slot: 1, name: 'Otto', assignedRole: 'assistant' }, { slot: 2, name: 'Nell', assignedRole: 'researcher' }] } } });
  const home = w.ensureHomeOwner(project);
  assert.equal(home.characters.length, 2, 'saved identities remain intact');
  assert.deepEqual(w.snapshot().households[0].characters.map(c => c.name), ['Otto']);
  assert.equal(projectTeam(home).length, 1);
  assert.equal(home.characters[0].assignedRole, 'personal_assistant');
  const now = Date.now();
  for (let i = 0; i < 3; i++) w.apply({ kind: 'session_start', source: 'test', provider: 'fixture',
    project, session: `observed-${i}`, ts: new Date(now + i).toISOString() });
  assert.equal(w.snapshot().sessions.length, 3, 'observed activity is preserved, not treated as recruitment');
  assert.equal(w.snapshot().households[0].characters.length, 1);
  const saved = structuredClone(w.households);
  const restored = new World({ households: saved });
  restored.ensureHomeOwner(project);
  assert.equal(restored.snapshot().households[0].characters.length, 1);
  assert.equal(restored.households[project].characters.length, 3);
  // Future explicit recruitment survives re-import rather than being reset to one.
  home.residentAgentIds.push(home.characters[1].id);
  w.ensureHomeOwner(project);
  assert.equal(w.snapshot().households[0].characters.length, 2);
});

test('migration is idempotent and preserves identities, roles, slots and customization', () => {
  const home = { project: 'C:\\projects\\example', name: 'My home', custom: { keep: true }, characters: [
    { slot: 2, name: 'Nell', seed: 42, assignedRole: 'researcher' },
    { slot: 1, name: 'Otto', seed: 9, assignedRole: 'assistant', id: 'previous-id' },
  ] };
  initializeHousehold(home);
  const saved = structuredClone(home);
  initializeHousehold(home);
  assert.deepEqual(home, saved);
  assert.equal(home.ownerAgentId, 'previous-id');
  assert.equal(home.characters[0].assignedRole, 'researcher');
  assert.equal(home.characters[1].professionId, 'personal_assistant');
  assert.deepEqual(home.custom, { keep: true });
  const moved = { project: '/another', characters: [structuredClone(home.characters[1])] };
  initializeHousehold(moved);
  assert.equal(moved.characters[0].id, 'previous-id');
  assert.equal(moved.characters[0].homeId, moved.id);
  assert.notEqual(moved.id, home.id);
  assert.equal(agentForRecord([home], { project: home.project, slot: 2 }).name, 'Nell');
  assert.equal(agentForRecord([home], { agentId: 'missing', project: home.project, slot: 2 }), null);
});

test('stable identity connects legacy XP and future runs without duplicate rewards', () => {
  const w = new World();
  const home = w.ensureHomeOwner('/project');
  const agent = home.characters[0];
  const old = { id: 'old', project: home.project, slot: 1, status: 'completed', result: { summary: 'Response' } };
  const current = { ...old, id: 'new', agentId: agent.id };
  assert.equal(experience([old, current, old], [home]).agents[agent.id].xp, 50);
  const moved = initializeHousehold({ project: '/moved', characters: [{ ...agent, slot: 3 }] });
  assert.equal(experience([current], [moved]).agents[agent.id].xp, 25);
  const records = foundationSnapshot([home], { townhall: { readyAt: '2026-10-01T00:00:00Z' } });
  assert.equal(records.agents[0].isOwner, true);
  assert.equal(records.agents[0].happiness, null, 'foundation does not invent a mood');
  assert.deepEqual(records.buildings.map(b => b.type), ['residential', 'infrastructure']);
  assert.deepEqual(BUILDING_TYPES, ['residential', 'recreational', 'infrastructure', 'work']);
  assert.equal(w.sessions.size, 0);
});

test('new approved runs pin the stable recipient identity', t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aw-foundation-pass-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const project = fs.realpathSync(dir), w = new World();
  const home = w.ensureHomeOwner(project);
  const store = new PassStore(path.join(dir, 'passes.json'), { agentIdFor: r => agentForRecord(w.households, r)?.id });
  const p = store.propose({ project, slot: 1, title: 'Fixture', instruction: 'Inspect fixture only' }, w.households);
  store.decide({ id: p.id, version: p.version, action: 'approve', confirmed: true }, w.households);
  assert.equal(store.claim().agentId, home.ownerAgentId);
  assert.equal(store.snapshot().runs[0].agentId, home.ownerAgentId);
});

test('Mayor progression requires Town Hall before home and owner response is not acceptance', () => {
  const now = Date.parse('2026-10-10T12:00:00Z');
  const game = { connection: { provider: 'codex' } };
  const w = new World(), home = w.ensureHomeOwner('/project');
  assert.equal(mayorStage({}, [home], [], now), 'link');
  assert.equal(mayorStage(game, [home], [], now), 'townhall');
  assert.equal(mayorStage({ ...game, townhall: { readyAt: new Date(now + 1000).toISOString() } }, [home], [], now), 'townhall_building');
  const built = { ...game, townhall: { readyAt: new Date(now).toISOString() } };
  assert.equal(mayorStage(built, [], [], now), 'home');
  assert.equal(mayorStage(built, [home], [], now), 'owner');
  const run = { project: home.project, slot: 1, agentId: home.ownerAgentId, status: 'failed', result: { summary: 'Response' } };
  assert.equal(mayorStage(built, [home], [run], now), 'owner');
  run.status = 'completed';
  assert.equal(mayorStage(built, [home], [run], now), 'settled');
  assert.equal(run.accepted, undefined);
});

test('bridge persists migrated residents and blocks home creation before CLI or folder side effects', async t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aw-foundation-api-'));
  const project = path.join(dir, 'project');
  const households = { [project]: { project, name: 'Preserved', characters: [{ slot: 1, name: 'Otto', seed: 1 }, { slot: 2, name: 'Nell', seed: 2 }] } };
  fs.writeFileSync(path.join(dir, 'households.json'), JSON.stringify(households));
  fs.writeFileSync(path.join(dir, 'selected-projects.json'), JSON.stringify([project]));
  const child = spawn(process.execPath, ['bridge/server.mjs', '--port', '0'], { env: { ...process.env,
    AGENT_WORLD_HOME: dir, CODEX_HOME: path.join(dir, 'codex'), AGENT_WORLD_RUNNER: '0',
    AGENT_WORLD_CODEX_COMMAND: path.join(dir, 'missing'), AGENT_WORLD_CLAUDE_COMMAND: path.join(dir, 'missing-claude'),
  }, stdio: ['ignore', 'pipe', 'pipe'] });
  t.after(async () => { child.kill(); if (child.exitCode === null) await once(child, 'exit'); fs.rmSync(dir, { recursive: true, force: true }); });
  const base = await new Promise((resolve, reject) => {
    let text = '';
    const timer = setTimeout(() => reject(Error('Startup timed out')), 10000);
    child.stdout.on('data', c => { text += c; const m = text.match(/http:\/\/127\.0\.0\.1:\d+/); if (m) { clearTimeout(timer); resolve(m[0]); } });
    child.on('error', e => { clearTimeout(timer); reject(e); });
    child.on('exit', code => { clearTimeout(timer); reject(Error(`Bridge exited ${code}`)); });
  });
  const state = await (await fetch(base + '/api/state')).json();
  assert.deepEqual(state.households[0].characters.map(c => c.name), ['Otto']);
  assert.equal(state.foundation.agents.length, 1);
  assert.equal(state.sessions.length, 0);
  assert.equal(state.passes.runs.length, 0);
  const saved = JSON.parse(fs.readFileSync(path.join(dir, 'households.json')));
  assert.deepEqual(saved[project].characters.map(c => c.name), ['Otto', 'Nell']);
  assert.equal(saved[project].residentAgentIds.length, 1);
  assert.equal(saved[project].ownerAgentId, state.households[0].characters[0].id);
  const inactive = await fetch(base + '/api/pass-proposal', { method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ project, slot: 2, title: 'Fixture', instruction: 'Do not run' }) });
  assert.equal(inactive.status, 400);
  assert.match((await inactive.json()).error, /active resident/);
  const folder = path.join(dir, 'must-not-create');
  for (const action of ['create', 'import']) {
    const response = await fetch(base + '/api/codex-projects', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action, name: 'Fixture', folder, createFolder: true, id: 'missing' }) });
    assert.equal(response.status, 400);
    assert.match((await response.json()).error, /Town Hall/);
  }
  assert.equal(fs.existsSync(folder), false);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { emptyTown, placeCivic, placeHome } from '../shared/town.mjs';

test('an existing town starts at the tier of its placed buildings without tier grants for it', async t => {
  const home = await fs.mkdtemp(path.join(os.tmpdir(), 'aw-town-migration-'));
  const project = path.join(home, 'project');
  await fs.mkdir(project);
  await fs.writeFile(path.join(home, 'selected-projects.json'), JSON.stringify([project]));
  await fs.writeFile(path.join(home, 'gameplay.json'), JSON.stringify({ version: 1, connection: { provider: 'fixture' }, townhall: { readyAt: '2020-01-01T00:00:00Z' } }));
  await fs.writeFile(path.join(home, 'households.json'), JSON.stringify({ [project]: { project, name: 'Old home', ownerAgentId: 'owner', residentAgentIds: ['owner'],
    characters: [{ id: 'owner', slot: 1, seed: 1, name: 'Rosa', assignedRole: 'personal_assistant', interestIds: ['park_walks'] }] } }));
  // A town saved before tiers: a park, a fire station and a hospital (a tier-4 building) by the home.
  let town = placeHome(emptyTown(), project, { i: 2, j: -2, rot: 0 });
  for (const [kind, at] of [['park', { i: 2, j: 2, rot: 2 }], ['fire_station', { i: 5, j: 2, rot: 2 }], ['hospital', { i: 9, j: 2, rot: 2 }]]) town = placeCivic(town, kind, at, { tier: Infinity });
  await fs.writeFile(path.join(home, 'town.json'), JSON.stringify(town));
  await fs.writeFile(path.join(home, 'passes.json'), JSON.stringify({ runs: [], proposals: [] }));
  let child;
  t.after(async () => {
    if (child && child.exitCode === null) { const exit = once(child, 'exit'); child.kill(); await exit; }
    assert.ok(path.resolve(home).startsWith(path.resolve(os.tmpdir()) + path.sep));
    await fs.rm(home, { recursive: true, force: true });
  });
  child = spawn(process.execPath, ['bridge/server.mjs', '--port', '0'], {
    env: { ...process.env, AGENT_WORLD_HOME: home, CODEX_HOME: path.join(home, 'codex'), AGENT_WORLD_RUNNER: '0' }, stdio: ['ignore', 'pipe', 'pipe'] });
  const base = await new Promise((resolve, reject) => {
    let text = '', errors = '';
    const timer = setTimeout(() => reject(Error('Server startup timeout: ' + errors)), 10000);
    child.stderr.on('data', chunk => { errors += chunk; });
    child.stdout.on('data', chunk => { text += chunk; const m = text.match(/http:\/\/127\.0\.0\.1:\d+/); if (m) { clearTimeout(timer); resolve(m[0]); } });
    child.once('exit', () => { clearTimeout(timer); reject(Error('Server exited: ' + errors)); });
  });
  let saved;
  for (let i = 0; i < 30; i++) {
    saved = JSON.parse(await fs.readFile(path.join(home, 'gameplay.json'), 'utf8'));
    if (saved.townTier) break;
    await new Promise(r => setTimeout(r, 100));
  }
  assert.deepEqual([saved.townTier.reached, saved.townTier.start], [4, 4]);
  const s = await (await fetch(base + '/api/state')).json();
  assert.equal(s.town.tier.current, 4);
  assert.equal(s.town.tier.name, 'Borough');
  const keys = Object.keys(saved.pride?.milestones || {});
  assert.ok(!keys.some(k => k.startsWith('tier:')), `no starting tier grants (${keys.join(', ')})`);
  assert.equal(s.town.pride.earned, keys.reduce((n, k) => n + saved.pride.milestones[k].amount, 0));
});

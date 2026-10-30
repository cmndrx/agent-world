import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { emptyTown, placeCivic, placeHome } from '../shared/town.mjs';
import { PRIDE_REWARDS, UPGRADE_COSTS } from '../shared/civic-pride.mjs';

test('isolated bridge derives tier and Civic Pride from the layout, pays each milestone once and sells upgrades', async t => {
  const home = await fs.mkdtemp(path.join(os.tmpdir(), 'aw-town-progress-'));
  const project = path.join(home, 'project');
  await fs.mkdir(project);
  await fs.writeFile(path.join(home, 'selected-projects.json'), JSON.stringify([project]));
  await fs.writeFile(path.join(home, 'gameplay.json'), JSON.stringify({ version: 1, connection: { provider: 'fixture' }, townhall: { readyAt: '2020-01-01T00:00:00Z' } }));
  await fs.writeFile(path.join(home, 'households.json'), JSON.stringify({ [project]: { project, name: 'Rosa home', ownerAgentId: 'owner', residentAgentIds: ['owner'],
    characters: [{ id: 'owner', slot: 1, seed: 1, name: 'Rosa', assignedRole: 'personal_assistant', interestIds: ['park_walks'] }] } }));
  // A park and a fire station right by the home: every tier-1 need is met.
  let town = placeHome(emptyTown(), project, { i: 2, j: -2, rot: 0 });
  town = placeCivic(placeCivic(town, 'park', { i: 2, j: 2, rot: 2 }, { tier: 1 }), 'fire_station', { i: 5, j: 2, rot: 2 }, { tier: 1 });
  await fs.writeFile(path.join(home, 'town.json'), JSON.stringify(town));
  const passText = JSON.stringify({ runs: [], proposals: [] });
  await fs.writeFile(path.join(home, 'passes.json'), passText);
  let child;
  async function stop() { if (child && child.exitCode === null) { const exit = once(child, 'exit'); child.kill(); await exit; } }
  t.after(async () => {
    await stop();
    assert.ok(path.resolve(home).startsWith(path.resolve(os.tmpdir()) + path.sep));
    await fs.rm(home, { recursive: true, force: true });
  });
  async function start() {
    child = spawn(process.execPath, ['bridge/server.mjs', '--port', '0'], {
      env: { ...process.env, AGENT_WORLD_HOME: home, CODEX_HOME: path.join(home, 'codex'), AGENT_WORLD_RUNNER: '0' }, stdio: ['ignore', 'pipe', 'pipe'] });
    return new Promise((resolve, reject) => {
      let text = '', errors = '';
      const timer = setTimeout(() => reject(Error('Server startup timeout: ' + errors)), 10000);
      child.stderr.on('data', chunk => { errors += chunk; });
      child.stdout.on('data', chunk => { text += chunk; const m = text.match(/http:\/\/127\.0\.0\.1:\d+/); if (m) { clearTimeout(timer); resolve(m[0]); } });
      child.once('exit', () => { clearTimeout(timer); reject(Error('Server exited: ' + errors)); });
    });
  }
  let base = await start();
  const state = async () => (await fetch(base + '/api/state')).json();
  const post = body => fetch(base + '/api/town', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }).then(async r => ({ status: r.status, body: await r.json() }));
  const settle = async () => { for (let i = 0; i < 30; i++) { const s = await state(); if (s.town.tier?.reached === 2) return s; await new Promise(r => setTimeout(r, 100)); } return state(); };

  // Startup sync: the satisfied home earns tier 2 and its milestones.
  let s = await settle();
  assert.equal(s.town.tier.current, 2);
  assert.equal(s.town.tier.name, 'Village');
  assert.equal(s.town.tier.next.tier, 3);
  const expected = 3 * PRIDE_REWARDS.need + PRIDE_REWARDS.home + PRIDE_REWARDS.tier; // fire, green, park walks; home; tier 2
  assert.equal(s.town.pride.earned, expected);
  assert.equal(s.town.pride.balance, expected);
  const saved = JSON.parse(await fs.readFile(path.join(home, 'gameplay.json'), 'utf8'));
  assert.equal(saved.townTier.reached, 2);
  assert.deepEqual(Object.keys(saved.pride.milestones).sort(), [`home:${project}`, `need:${project}:fire`, `need:${project}:green`, `need:${project}:interest:owner:park_walks`, 'tier:2'].sort());

  // The school opens at tier 3, so the bridge refuses it at tier 2.
  assert.equal((await post({ action: 'place-civic', kind: 'school', i: 9, j: 2, rot: 2, revision: s.town.revision })).status, 400);
  // Upgrading: spends Civic Pride after the upgraded town is saved; a second upgrade is too expensive.
  let r = await post({ action: 'upgrade-civic', kind: 'fire_station', revision: s.town.revision });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  s = await state();
  assert.equal(s.town.civic.find(c => c.kind === 'fire_station').upgrade, 2);
  assert.equal(s.town.pride.balance, expected - UPGRADE_COSTS[2]);
  r = await post({ action: 'upgrade-civic', kind: 'fire_station', revision: s.town.revision });
  assert.equal(r.status, 400); assert.match(r.body.error, /Needs 150 Civic Pride/);
  assert.equal((await post({ action: 'upgrade-civic', kind: 'park', revision: s.town.revision })).status, 400);
  assert.equal((await post({ action: 'upgrade-civic', kind: 'fire_station', revision: s.town.revision - 1 })).status, 400, 'stale previews are refused');

  // Props: buy a tree, move it for free, remove it for half back; blocked and unaffordable buys change nothing.
  s = await state();
  let balance = s.town.pride.balance;
  r = await post({ action: 'place-prop', kind: 'tree', i: 8, j: 10, revision: s.town.revision });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  s = await state();
  const tree = s.town.props[0];
  assert.equal(tree.kind, 'tree'); assert.equal(s.town.pride.balance, balance - 10);
  assert.equal((await post({ action: 'move-prop', id: tree.id, i: 9, j: 10, revision: s.town.revision })).status, 200);
  s = await state();
  assert.deepEqual([s.town.props[0].i, s.town.pride.balance], [9, balance - 10]);
  assert.equal((await post({ action: 'place-prop', kind: 'tree', i: 3, j: 1, revision: s.town.revision })).status, 400, 'not on a street');
  assert.equal((await post({ action: 'place-prop', kind: 'statue', i: 10, j: 10, revision: s.town.revision })).status, 400, 'statues open at tier 4');
  assert.equal((await post({ action: 'remove-prop', id: tree.id, revision: s.town.revision })).status, 200);
  s = await state();
  assert.deepEqual([s.town.props.length, s.town.pride.balance], [0, balance - 10 + 5]);
  balance = s.town.pride.balance;
  const pricey = await post({ action: 'place-prop', kind: 'fountain', i: 10, j: 10, revision: s.town.revision });
  assert.equal(pricey.status, 400); assert.match(pricey.body.error, /Needs 30 Civic Pride/);
  assert.equal((await state()).town.pride.balance, balance);

  // Restart: the tier stays, nothing pays twice, the upgrade persists, pass history untouched.
  await stop(); base = await start();
  s = await settle();
  assert.equal(s.town.tier.current, 2);
  assert.equal(s.town.pride.earned, expected);
  assert.equal(s.town.pride.balance, expected - UPGRADE_COSTS[2] - 10 + 5);
  assert.equal(s.town.civic.find(c => c.kind === 'fire_station').upgrade, 2);
  assert.equal(await fs.readFile(path.join(home, 'passes.json'), 'utf8'), passText);
});

// Town planning and project permits through the real bridge, against an isolated AGENT_WORLD_HOME and a fixture
// Codex CLI. No provider runs: runs in passes.json are fixture records.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { once } from 'node:events';

const done = (n, project = '/fixture/xp') => Array.from({ length: n }, (_, k) => ({ id: `xp-${k}`, project, slot: 1, status: 'completed', result: { summary: 'Fixture response' } }));

async function town(t, { projects = ['a', 'b', 'c', 'd'], selected = [], runs = [], proposals = [], style = null, townJson = null } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aw-town-'));
  const folders = Object.fromEntries(projects.map((p) => { const f = path.join(dir, 'projects', p); fs.mkdirSync(f, { recursive: true }); return [p, fs.realpathSync(f)]; }));
  const cli = path.join(dir, 'codex-fixture');
  const list = projects.map((p) => ({ id: `id-${p}`, name: p.toUpperCase(), roots: [{ path: folders[p] }] }));
  fs.writeFileSync(cli, `#!/usr/bin/env node
let b='';process.stdin.on('data',c=>{b+=c;let at;while((at=b.indexOf('\\n'))>=0){const m=JSON.parse(b.slice(0,at));b=b.slice(at+1);if(m.id){const result=m.method==='project/list'?{data:${JSON.stringify(list)},nextCursor:null}:{};process.stdout.write(JSON.stringify({id:m.id,result})+'\\n');}}});`, { mode: 0o700 });
  fs.writeFileSync(path.join(dir, 'gameplay.json'), JSON.stringify({ version: 1, connection: { provider: 'codex' }, townhall: { readyAt: '2026-01-01T00:00:00Z' } }));
  fs.writeFileSync(path.join(dir, 'selected-projects.json'), JSON.stringify(selected.map((p) => folders[p] || p)));
  const fix = (r) => ({ ...r, project: folders[r.project] || r.project });
  fs.writeFileSync(path.join(dir, 'passes.json'), JSON.stringify({ proposals: proposals.map(fix), runs: runs.map(fix), schedules: [] }));
  if (style) fs.writeFileSync(path.join(dir, 'style.json'), JSON.stringify(typeof style === 'function' ? style(folders) : style));
  if (townJson) fs.writeFileSync(path.join(dir, 'town.json'), townJson);
  const child = spawn(process.execPath, ['bridge/server.mjs', '--port', '0'], { env: { ...process.env, AGENT_WORLD_HOME: dir, CODEX_HOME: path.join(dir, 'codex'), AGENT_WORLD_RUNNER: '0', AGENT_WORLD_CODEX_COMMAND: cli }, stdio: ['ignore', 'pipe', 'pipe'] });
  t.after(async () => { child.kill(); if (child.exitCode === null) await once(child, 'exit'); fs.rmSync(dir, { recursive: true, force: true }); });
  const base = await new Promise((resolve, reject) => {
    let out = '';
    const timer = setTimeout(() => reject(Error('Startup timeout')), 10000);
    child.stdout.on('data', (c) => { out += c; const m = out.match(/http:\/\/127\.0\.0\.1:\d+/); if (m) { clearTimeout(timer); resolve(m[0]); } });
    child.stderr.on('data', (c) => process.stderr.write(c));
    child.on('exit', () => { clearTimeout(timer); reject(Error('Server exited')); });
  });
  const post = async (route, data) => { const r = await fetch(base + route, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(data) }); return { status: r.status, body: await r.json() }; };
  const state = async () => (await fetch(base + '/api/state')).json();
  return { dir, folders, post, state, add: (p, placement, extra = {}) => post('/api/codex-projects', { action: 'import', id: `id-${p}`, placement, ...extra }) };
}

const ROW0 = [{ i: -1, j: -2, rot: 0 }, { i: 2, j: -2, rot: 0 }, { i: 5, j: -2, rot: 0 }];

test('level 1 allows one project; the refusal states active/allowed, the next permit level and exact XP', async (t) => {
  const w = await town(t);
  const s0 = await w.state();
  assert.deepEqual([s0.town.permits.active, s0.town.permits.allowed, s0.town.permits.nextLevel, s0.town.permits.xpToNext], [0, 1, 2, 100]);
  assert.equal((await w.add('a', ROW0[0])).status, 200);
  const refused = await w.add('b', ROW0[1]);
  assert.equal(refused.status, 400);
  assert.equal(refused.body.error, 'All 1 project permit is in use (1 of 1 active). Next permit at player level 2 · 100 XP to go. Remove a project, or replace one, to add another.');
  assert.deepEqual([refused.body.permits.active, refused.body.permits.allowed], [1, 1]);
  // Nothing was activated or placed by the refusal; the first home is under construction and counts.
  const s = await w.state();
  assert.deepEqual(s.selectedProjects, [w.folders.a]);
  assert.deepEqual(s.town.homes.map((h) => h.project), [w.folders.a]);
  assert.equal(s.households.find((h) => h.project === w.folders.a).construction != null, true);
  // A plot is required, validated and checked against the town's current revision.
  assert.match((await w.post('/api/codex-projects', { action: 'remove', project: w.folders.a })).body.result.removed ? 'removed' : '', /removed/);
  assert.match((await w.add('b')).body.error, /Choose a plot/);
  assert.match((await w.add('b', { i: -1, j: -1, rot: 0 })).body.error, /overlaps a street/);
  assert.match((await w.add('b', ROW0[0], { revision: -5 })).body.error, /town changed/);
  assert.equal((await w.add('b', ROW0[0])).status, 200, 'removing a project freed its permit');
});

test('concurrent adds never exceed capacity; replacing swaps one project for another atomically', async (t) => {
  const w = await town(t, { runs: done(4) }); // 100 XP → level 2 → 2 permits
  const results = await Promise.all(['a', 'b', 'c'].map((p, n) => w.add(p, ROW0[n])));
  assert.deepEqual(results.map((r) => r.status).sort(), [200, 200, 400]);
  let s = await w.state();
  assert.equal(s.selectedProjects.length, 2);
  assert.equal(s.town.homes.length, 2);
  assert.match(results.find((r) => r.status === 400).body.error, /Next permit at player level 3 · 150 XP to go/);
  const [keep, gone] = s.selectedProjects;
  const left = Object.keys(w.folders).find((k) => !s.selectedProjects.includes(w.folders[k]) && k !== 'd');
  const spot = s.town.homes.find((h) => h.project === gone);
  const replaced = await w.add(left, { i: spot.i, j: spot.j, rot: spot.rot }, { replace: gone });
  assert.equal(replaced.status, 200, replaced.body.error);
  s = await w.state();
  assert.deepEqual(new Set(s.selectedProjects), new Set([keep, w.folders[left]]));
  assert.equal(s.town.homes.find((h) => h.project === w.folders[left]).i, spot.i, 'the new home took the replaced plot');
  assert.ok(s.town.retired.some((r) => r.project === gone));
  // The replaced project's household and history stay saved.
  assert.ok(s.households.some((h) => h.project === gone));
});

test('inactive projects take no prompts, schedules, chats or care; removal waits for running work', async (t) => {
  const w = await town(t, {
    selected: ['a', 'b'], runs: [...done(4), { id: 'live', project: 'b', slot: 1, status: 'running', title: 'Long fixture prompt' }],
    proposals: [{ id: 'queued', project: 'b', slot: 1, status: 'approved', title: 'Queued fixture prompt', instruction: 'x', version: 1 }],
  });
  let s = await w.state();
  assert.equal(s.town.homes.length, 2, 'migration placed both active homes');
  // Remove A (idle) at once.
  assert.equal((await w.post('/api/codex-projects', { action: 'remove', project: w.folders.a })).body.result.removed, true);
  for (const [route, body] of [['/api/pass-proposal', { project: w.folders.a, slot: 1, title: 'x', instruction: 'x' }], ['/api/schedules', { action: 'create', project: w.folders.a, slot: 1 }], ['/api/pass-chat', { project: w.folders.a, slot: 1, thread: 't', action: 'archive' }], ['/api/care', { project: w.folders.a, agentId: 'x' }]]) {
    const r = await w.post(route, body);
    assert.equal(r.status, 400, route);
    assert.match(r.body.error, /isn’t active in your town/, route);
  }
  // B has running work: removal is held, queued work is cancelled (recorded), nothing new starts.
  const held = await w.post('/api/codex-projects', { action: 'remove', project: w.folders.b });
  assert.equal(held.body.result.pending, true);
  assert.deepEqual(held.body.result.waitingFor.map((x) => x.title), ['Long fixture prompt']);
  s = await w.state();
  assert.ok(s.selectedProjects.includes(w.folders.b), 'still active until its work settles');
  assert.ok(s.town.pendingRemoval[w.folders.b]);
  assert.equal(s.passes.proposals.find((p) => p.id === 'queued').status, 'cancelled');
  assert.ok(s.passes.runs.some((r) => r.proposalId === 'queued' && r.status === 'cancelled'));
  assert.equal(s.passes.runs.find((r) => r.id === 'live').status, 'running', 'running work is not interrupted');
  assert.match((await w.post('/api/pass-proposal', { project: w.folders.b, slot: 1, title: 'x', instruction: 'x' })).body.error, /being removed/);
  // Keep restores it; remove again, then let the run settle and the removal completes on its own.
  assert.equal((await w.post('/api/codex-projects', { action: 'keep', project: w.folders.b })).body.result.kept, true);
  assert.equal((await w.post('/api/codex-projects', { action: 'remove', project: w.folders.b })).body.result.pending, true);
  const file = path.join(w.dir, 'passes.json');
  const saved = JSON.parse(fs.readFileSync(file, 'utf8'));
  saved.runs.find((r) => r.id === 'live').status = 'completed';
  fs.writeFileSync(file, JSON.stringify(saved));
  for (let n = 0; n < 40 && (await w.state()).selectedProjects.includes(w.folders.b); n++) await new Promise((r) => setTimeout(r, 150));
  s = await w.state();
  assert.deepEqual(s.selectedProjects, []);
  assert.deepEqual(s.town.pendingRemoval, {});
  assert.ok(s.households.some((h) => h.project === w.folders.b), 'history and household preserved');
  assert.equal(s.passes.runs.find((r) => r.id === 'live').status, 'completed');
});

test('an over-capacity save keeps everything, blocks new work and activation until the player chooses', async (t) => {
  const w = await town(t, { selected: ['a', 'b', 'c'], runs: [{ id: 'live', project: 'c', slot: 1, status: 'running', title: 'Running in C' }] });
  let s = await w.state();
  assert.equal(s.town.permits.overCapacity, true);
  assert.equal(s.town.homes.length, 3, 'nothing removed or moved');
  for (const p of ['a', 'b', 'c']) assert.match((await w.post('/api/pass-proposal', { project: w.folders[p], slot: 1, title: 'x', instruction: 'x' })).body.error, /more active projects than permits/);
  assert.match((await w.add('d', { i: -1, j: 2, rot: 2 })).body.error, /Choose which projects stay active/);
  assert.match((await w.post('/api/town', { action: 'choose-active', projects: [w.folders.a, w.folders.b] })).body.error, /up to 1 project/);
  const chose = await w.post('/api/town', { action: 'choose-active', projects: [w.folders.a] });
  assert.equal(chose.status, 200, chose.body.error);
  s = await w.state();
  assert.equal(s.town.permits.overCapacity, false);
  assert.deepEqual(new Set(s.selectedProjects), new Set([w.folders.a, w.folders.c]), 'C stays until its running work settles');
  assert.ok(s.town.pendingRemoval[w.folders.c]);
  assert.match((await w.post('/api/pass-proposal', { project: w.folders.c, slot: 1, title: 'x', instruction: 'x' })).body.error, /being removed/);
  assert.doesNotMatch((await w.post('/api/pass-proposal', { project: w.folders.a, slot: 1, title: 'x', instruction: 'x' })).body.error || '', /permits|active in your town|being removed/);
  assert.equal(s.passes.runs.find((r) => r.id === 'live').status, 'running');
});

test('the town API validates roads, moves and renames on the server and persists them to town.json', async (t) => {
  const w = await town(t, { selected: ['a'] });
  let s = await w.state();
  const rev = () => s.town.revision;
  assert.match((await w.post('/api/town', { action: 'add-road', from: { i: 4, j: 4 }, to: { i: 6, j: 4 }, revision: rev() })).body.error, /Connect new streets/);
  assert.match((await w.post('/api/town', { action: 'add-road', from: { i: 0, j: 1 }, to: { i: 0, j: -1 }, revision: rev() })).body.error, /home/);
  assert.match((await w.post('/api/town', { action: 'add-road', from: { i: 3, j: 2 }, to: { i: 3, j: 6 }, revision: rev() - 1 })).body.error, /town changed/);
  assert.equal((await w.post('/api/town', { action: 'add-road', from: { i: 3, j: 2 }, to: { i: 3, j: 8 }, revision: rev() })).status, 200);
  s = await w.state();
  const home = s.town.homes[0];
  assert.match((await w.post('/api/town', { action: 'move-home', project: w.folders.a, i: 4, j: 2, rot: 0, revision: rev() })).body.error, /entrance|street/);
  const moved = await w.post('/api/town', { action: 'move-home', project: w.folders.a, i: 4, j: 4, rot: 3, revision: rev() });
  assert.equal(moved.status, 200, moved.body.error);
  s = await w.state();
  assert.equal(s.town.homes[0].id, home.id);
  assert.deepEqual([s.town.homes[0].i, s.town.homes[0].j, s.town.homes[0].rot], [4, 4, 3]);
  const cut = await w.post('/api/town', { action: 'remove-road', from: { i: 3, j: 2 }, to: { i: 3, j: 3 }, revision: rev() });
  assert.match(cut.body.error, /A home would lose its connection/);
  const street = s.town.roads.find((r) => r.i0 === 3).streetId;
  assert.equal((await w.post('/api/town', { action: 'rename-street', streetId: street, name: 'Orchard Lane' })).status, 200);
  assert.match((await w.post('/api/style', { kind: 'layout', value: [] })).body.error, /town planning/);
  const saved = JSON.parse(fs.readFileSync(path.join(w.dir, 'town.json'), 'utf8'));
  assert.equal(saved.roads.find((r) => r.streetId === street).name, 'Orchard Lane');
  assert.deepEqual([saved.homes[0].i, saved.homes[0].rot, saved.homes[0].connected], [4, 3, true]);
});

test('migration backs up the row layout, keeps street names and is safe to repeat; a damaged file is kept and re-migrated', async (t) => {
  const w = await town(t, { selected: ['a', 'b'], style: (f) => ({ version: 1, layout: [null, f.b, f.a], streets: { 0: 'Harbour Street' } }) });
  const s = await w.state();
  const at = (p) => s.town.homes.find((h) => h.project === w.folders[p]);
  assert.deepEqual([at('b').i, at('a').i], [2, 5], 'plot order preserved');
  assert.equal(s.town.roads[0].name, 'Harbour Street');
  assert.equal(s.town.migratedFrom.kind, 'rows-v1');
  const backups = fs.readdirSync(path.join(w.dir, 'backups'));
  assert.ok(backups.some((b) => b.startsWith('town-migration')));
  const backup = path.join(w.dir, 'backups', backups.find((b) => b.startsWith('town-migration')));
  assert.ok(fs.existsSync(path.join(backup, 'style.json')));
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(w.dir, 'style.json'), 'utf8')).layout, [null, w.folders.b, w.folders.a], 'source left untouched');
  // A second bridge on a damaged town.json keeps the damaged copy and migrates again from the source.
  const again = await town(t, { selected: ['a'], townJson: '{ not json', style: (f) => ({ version: 1, layout: [f.a] }) });
  const s2 = await again.state();
  assert.match(s2.town.loadError, /kept in/);
  assert.equal(s2.town.homes[0].i, -1);
  assert.ok(fs.readdirSync(path.join(again.dir, 'backups')).some((b) => b.startsWith('town-unreadable')));
});

test('civic buildings are placed through the town API, checked against the player level and saved', async (t) => {
  const w = await town(t, { runs: done(4) }); // 4 responses · 100 XP · player level 2
  const s0 = await w.state();
  assert.equal(s0.town.permits.level, 2);
  assert.deepEqual(s0.town.civic, []);
  const at = { i: -1, j: -1, rot: 0, revision: s0.town.revision }; // a 3 × 2 fire station facing Main Street
  const locked = await w.post('/api/town', { action: 'place-civic', kind: 'police', ...at });
  assert.equal(locked.status, 400);
  assert.match(locked.body.error, /level 3/);
  assert.equal((await w.post('/api/town', { action: 'place-civic', kind: 'fire_station', ...at })).status, 200);
  const s1 = await w.state();
  assert.deepEqual(s1.town.civic.map((c) => [c.kind, c.i, c.j, c.connected]), [['fire_station', -1, -1, true]]);
  assert.equal(JSON.parse(fs.readFileSync(path.join(w.dir, 'town.json'), 'utf8')).civic[0].kind, 'fire_station');
  // A home can't take its plot.
  const blocked = await w.add('a', ROW0[0]);
  assert.equal(blocked.status, 400);
  assert.match(blocked.body.error, /fire station/);
  assert.equal((await w.post('/api/town', { action: 'remove-civic', kind: 'fire_station', revision: s1.town.revision })).status, 200);
  assert.deepEqual((await w.state()).town.civic, []);
});

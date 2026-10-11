import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { resetTown } from '../bridge/game-reset.mjs';
import { emptyGameplay } from '../shared/gameplay.mjs';
import { spawn } from 'node:child_process';
import { once } from 'node:events';

test('reset API rejects foreign and unconfirmed requests and resets without restarting', async t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aw-reset-api-'));
  fs.writeFileSync(path.join(dir, 'gameplay.json'), JSON.stringify({ version: 1, connection: { provider: 'codex' }, townhall: { readyAt: '2026-01-01T00:00:00Z' } }));
  fs.writeFileSync(path.join(dir, 'selected-projects.json'), JSON.stringify(['/fixture']));
  const child = spawn(process.execPath, ['bridge/server.mjs', '--port', '0'], { env: { ...process.env, AGENT_WORLD_HOME: dir, CODEX_HOME: path.join(dir, 'codex'), AGENT_WORLD_RUNNER: '0' }, stdio: ['ignore','pipe','pipe'] });
  t.after(async () => { child.kill(); if (child.exitCode === null) await once(child, 'exit'); fs.rmSync(dir, { recursive: true, force: true }); });
  const base = await new Promise((resolve, reject) => {
    let out = ''; const timer = setTimeout(() => reject(Error('Startup timeout')), 10000);
    child.stdout.on('data', c => { out += c; const m = out.match(/http:\/\/127\.0\.0\.1:\d+/); if (m) { clearTimeout(timer); resolve(m[0]); } });
    child.on('error', e => { clearTimeout(timer); reject(e); });
  });
  const post = (confirmed, origin) => fetch(base + '/api/gameplay', { method: 'POST', headers: { 'content-type': 'application/json', ...(origin ? { origin } : {}) }, body: JSON.stringify({ action: 'reset', confirmed }) });
  assert.equal((await post(true, 'https://foreign.invalid')).status, 403);
  assert.equal((await post(false)).status, 400);
  assert.equal(fs.existsSync(path.join(dir, 'backups')), false);
  assert.equal((await post(true)).status, 200);
  const state = await (await fetch(base + '/api/state')).json();
  assert.deepEqual(state.gameplay, emptyGameplay());
  assert.deepEqual(state.selectedProjects, []);
  assert.equal(state.households[0].characters.length, 1, 'saved owner is preserved');
  assert.deepEqual(state.style.unlocks, []);
});

test('confirmed reset backs up state and preserves work and identity history', t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aw-reset-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  for (const file of ['gameplay.json','style.json','selected-projects.json','households.json','conversations.json','passes.json']) fs.writeFileSync(path.join(dir, file), JSON.stringify({ saved: file }));
  const options = { confirmed: true, passes: { proposals: [], runs: [] }, voice: { status: 'idle' }, computerUse: { status: 'idle' } };
  assert.throws(() => resetTown(dir, { ...options, confirmed: false }), /Confirm/);
  for (const state of [{ passes: { proposals: [{ status: 'approved' }], runs: [] } }, { passes: { proposals: [], runs: [{ status: 'running' }] } }, { voice: { status: 'live' } }, { computerUse: { status: 'approval' } }]) assert.throws(() => resetTown(dir, { ...options, ...state }), /Finish or stop/);
  assert.equal(fs.existsSync(path.join(dir, 'backups')), false);
  const result = resetTown(dir, options);
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(dir, 'gameplay.json'))), emptyGameplay());
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(dir, 'selected-projects.json'))), []);
  for (const file of ['households.json','conversations.json','passes.json']) assert.deepEqual(JSON.parse(fs.readFileSync(path.join(dir, file))), { saved: file });
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(result.backup, 'style.json'))), { saved: 'style.json' });
  assert.deepEqual(result.style.collected, []);
});

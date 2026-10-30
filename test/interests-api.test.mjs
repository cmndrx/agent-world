import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import {buildingPlanFor} from '../web/src/home-floors.js';
import {tvMounts} from '../shared/tv-mounts.mjs';
import {VENUE_INTERESTS} from '../shared/resident-interests.mjs';

test('isolated bridge seeds interests, edits them through one endpoint, retires care and preserves work', async t => {
  const home = await fs.mkdtemp(path.join(os.tmpdir(), 'aw-interests-api-'));
  const project = path.join(home, 'project');
  await fs.mkdir(project);
  const households = { [project]: { project, name:'Interests fixture', ownerAgentId:'owner', residentAgentIds:['owner'],
    characters:[{ id:'owner', slot:1, seed:1, name:'Rosa', assignedRole:'personal_assistant' },
      { id:'inactive', slot:2, seed:2, name:'Saved', assignedRole:'researcher' },
      { id:'legacy', slot:3, seed:3, name:'Legacy', happiness:72, interestIds:['sweets'], care:{version:1,revision:4,history:[]} }] } };
  households[project].residentAgentIds = ['owner', 'legacy'];
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
  const agent = async id => (await state()).foundation.agents.find(c => c.id === id);
  const edit = body => fetch(base + '/api/care-preferences', { method:'POST', headers:{'content-type':'application/json'}, body:JSON.stringify({project, agentId:'owner', action:'interests', ...body}) });

  // Active residents without interests get two venue interests; existing interests and legacy data stay as saved.
  let owner = await agent('owner');
  assert.equal(owner.interestIds.length, 2);
  assert.ok(owner.interestIds.every(id => VENUE_INTERESTS.includes(id)));
  assert.equal(owner.care, undefined); assert.equal(owner.happiness, null);
  const legacy = await agent('legacy');
  assert.deepEqual(legacy.interestIds, ['sweets']); assert.equal(legacy.happiness, 72); assert.equal(legacy.care.revision, 4);

  // The retired care endpoints are gone.
  assert.equal((await fetch(base + '/api/care', { method:'POST', headers:{'content-type':'application/json'}, body:'{}' })).status, 404);
  assert.equal((await fetch(base + '/api/care-options?project=x&agentId=y')).status, 404);
  assert.equal((await fetch(base + '/api/care-preferences', { method:'POST', headers:{'content-type':'application/json', origin:'https://bad.invalid'}, body:'{}' })).status, 403);

  const stream = await fetch(base + '/api/stream');
  const reader = stream.body.getReader(); await reader.read();
  let response = await edit({ id:'set-interests', revision:0, interestIds:['arcade_games','reading'] });
  assert.equal(response.status, 200);
  owner = (await response.json()).character;
  assert.deepEqual(owner.interestIds, ['arcade_games','reading']); assert.equal(owner.interestPreferences.revision, 1);
  const update = await reader.read(); assert.match(new TextDecoder().decode(update.value), /household/); await reader.cancel();
  assert.equal((await (await edit({ id:'set-interests', revision:0, interestIds:['arcade_games','reading'] })).json()).duplicate, true);
  assert.equal((await edit({ id:'stale-edit', revision:0, interestIds:['movies'] })).status, 400);
  assert.equal((await edit({ id:'too-many', revision:1, interestIds:['movies','music','gardening','swimming'] })).status, 400);
  assert.equal((await edit({ id:'unsupported', revision:1, interestIds:['cat_companionship'] })).status, 400);
  assert.equal((await edit({ id:'bad-project', revision:1, interestIds:['movies'], project:'/unknown' })).status, 400);

  // Saved but inactive residents may change preferences without being recruited.
  response = await edit({ id:'inactive-edit', agentId:'inactive', revision:0, interestIds:['movies'] });
  assert.equal(response.status, 200);
  const saved = JSON.parse(await fs.readFile(path.join(home,'households.json'),'utf8'))[project];
  assert.deepEqual(saved.residentAgentIds, ['owner','legacy']);
  assert.deepEqual(saved.characters.find(c => c.id === 'inactive').interestIds, ['movies']);
  assert.deepEqual(saved.characters.find(c => c.id === 'owner').interestIds, ['arcade_games','reading']);

  // Decor persistence and pass history are untouched across a restart.
  const m=tvMounts(buildingPlanFor('cottage').floors[0].items)[0];
  const tv={id:'persisttv',item:'fireplace_tv',anchor:m.anchor,x:m.x,z:m.z,rot:m.rot};
  assert.equal((await fetch(base+'/api/style',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({kind:'home',key:project,value:{decor:[tv]}})})).status,200);
  await stop(); base = await start();
  assert.deepEqual((await state()).style.homes[project].decor,[tv]);
  assert.deepEqual((await agent('owner')).interestIds, ['arcade_games','reading']);
  assert.equal(await fs.readFile(path.join(home,'passes.json'),'utf8'), passText);
});

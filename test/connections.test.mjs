import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { observerContact } from '../adapters/contact.mjs';
import { readConnections } from '../bridge/connections.mjs';
import { connectionView } from '../shared/connections.mjs';
const pause = ms => new Promise(r => setTimeout(r, ms));
function fixture(t) {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'aw-connection-'));
  t.after(() => fs.rmSync(home, { recursive: true, force: true }));
  return home;
}
test('distinct providers, contacts, ends, stale leases and reconnect; no session/history inference', t => {
  const home = fixture(t), dir = path.join(home, 'connections'), now = 100000;
  const send = (provider, id, connected = true, at = now) => observerContact(provider, id, connected, { home, now: at, pid: 7 });
  const view = (at = now, alive = () => true) => connectionView(readConnections(dir, at, alive), true, at);
  assert.equal(view().count, 0);
  assert.equal(connectionView({capturedAt:now,sessions:[{source:'codex'}],runner:{providers:{codex:{installed:true}}}},true,now).count,0);
  send('codex', 'one'); assert.equal(view().count, 1);
  send('codex', 'two'); assert.equal(view().count, 1);
  send('codex', 'one', false); assert.equal(view().count, 1);
  send('codex', 'two', false); send('claude', 'one'); assert.equal(view().count, 1);
  assert.equal(view().providers[1].status, 'connected');
  send('claude', 'two'); assert.equal(view().count, 1);
  send('codex', 'one'); assert.equal(view().count, 2);
  assert.equal(view(now, () => false).count, 1, 'dead Codex tailer does not count');
  send('claude', 'one', false); assert.equal(view().count, 2, 'another hook lease survives');
  send('claude', 'two', false); assert.equal(view().count, 1);
  assert.equal(view(now + 20000).count, 0);
  send('claude', 'one'); assert.equal(view(now + 30000).count, 0);
  send('codex', 'one', true, now + 40000); send('claude', 'one', true, now + 40000); assert.equal(view(now + 40000).count, 2);
  const saved = readConnections(dir, now + 40000, () => true);
  assert.equal(connectionView(saved, false, now + 40000).text, 'Live · unavailable');
  assert.equal(connectionView(saved, true, now + 50000).count, 0, 'stalled stream expires independently');
  assert.equal(connectionView(saved, true, now + 40000).count, 2, 'bridge reconnect restores fresh contact');
  assert.equal(view(now + 39999).count, 0, 'future leases cannot establish connectivity');
  fs.writeFileSync(path.join(dir, 'claude-' + 'a'.repeat(64) + '.json'), '{bad'); assert.doesNotThrow(() => view());
});
test('isolated Claude hook execution writes fresh contact, SessionEnd clears its own lease', async t => {
  const home = fixture(t), project = path.join(home, 'project'); fs.mkdirSync(project);
  const hook = async name => {
    const child = spawn(process.execPath, ['adapters/claude-code/hook.mjs'], { env: {...process.env, AGENT_WORLD_HOME:home}, stdio:['pipe','ignore','pipe'] });
    child.stdin.end(JSON.stringify({session_id:'fixture',cwd:project,hook_event_name:name}));
    assert.equal((await once(child, 'exit'))[0], 0);
  };
  await hook('SessionStart'); assert.equal(readConnections(path.join(home,'connections')).providers.claude.status,'connected');
  await hook('SessionEnd'); assert.equal(readConnections(path.join(home,'connections')).providers.claude.status,'disconnected');
  assert.equal(fs.existsSync(path.join(home,'passes.json')),false);
});
test('isolated Codex tailer heartbeat requires readable source; process exit disconnects', async t => {
  const home = fixture(t), sessions=path.join(home,'sessions');fs.mkdirSync(sessions);
  const child = spawn(process.execPath,['adapters/codex/tail.mjs','--sessions',sessions,'--quiet'],{env:{...process.env,AGENT_WORLD_HOME:home,CODEX_HOME:home},stdio:'ignore'});
  t.after(()=>child.kill());
  let state; for(let i=0;i<60;i++){state=readConnections(path.join(home,'connections'));if(state.providers.codex.status==='connected')break;await pause(50);}
  assert.equal(state.providers.codex.status,'connected');
  child.kill();await once(child,'exit');assert.equal(readConnections(path.join(home,'connections')).providers.codex.status,'disconnected');
  assert.equal(fs.existsSync(path.join(home,'events')),false,'no rollout fixture, no manufactured activity');
});

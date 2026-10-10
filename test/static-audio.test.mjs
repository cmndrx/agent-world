import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {once} from 'node:events';

test('packaged static audio supports encoded filenames and rejects malformed paths', async t => {
  const home = await fs.mkdtemp(path.join(os.tmpdir(), 'aw-audio-'));
  const assets = path.join(home, 'static'); await fs.mkdir(assets);
  await fs.writeFile(path.join(assets, 'Meadows Ambience.mp3'), 'fixture audio bytes');
  const child = spawn(process.execPath, ['bridge/server.mjs', '--port', '0', '--serve', assets], {
    env:{...process.env, AGENT_WORLD_HOME:home, CODEX_HOME:path.join(home,'codex'), AGENT_WORLD_RUNNER:'0'}, stdio:['ignore','pipe','pipe'],
  });
  t.after(async()=>{child.kill();if(child.exitCode===null)await once(child,'exit');await fs.rm(home,{recursive:true,force:true});});
  const base = await new Promise((resolve,reject)=>{
    let out='';const timer=setTimeout(()=>reject(Error('Bridge startup timed out')),10000);
    child.stdout.on('data',chunk=>{out+=chunk;const match=out.match(/http:\/\/127\.0\.0\.1:\d+/);if(match){clearTimeout(timer);resolve(match[0]);}});
    child.once('error',reject);child.once('exit',()=>{clearTimeout(timer);reject(Error('Bridge exited'));});
  });
  const audio=await fetch(base+'/Meadows%20Ambience.mp3');
  assert.equal(audio.status,200);assert.equal(audio.headers.get('content-type'),'audio/mpeg');assert.equal(await audio.text(),'fixture audio bytes');
  assert.equal((await fetch(base+'/%ZZ')).status,400);
  assert.equal((await fetch(base+'/missing.mp3')).status,404);
  assert.equal((await fetch(base+'/%2e%2e%2fpasses.json')).status,404);
  assert.equal((await fetch(base+'/api/state')).status,200);
});

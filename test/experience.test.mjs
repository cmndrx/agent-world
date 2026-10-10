import test from 'node:test';
import assert from 'node:assert/strict';
import { experience, residentKey, xpLevel } from '../shared/experience.mjs';
const run = (id, slot=1, status='completed') => ({id,project:'/project',slot,status,result:{summary:'Response returned'}});
test('level thresholds grow and preserve excess XP',()=>{
 assert.deepEqual([xpLevel(0).level,xpLevel(99).remaining,xpLevel(100).level,xpLevel(100).required,xpLevel(250).level,xpLevel(275).current],[1,1,2,150,3,25]);
});
test('returned responses reward their resident and player once across chats/providers and reconnects',()=>{
 const runs=[run('a'),run('b',2),run('a'),{...run('c'),provider:'claude',conversationSession:'another'}];
 const e=experience(runs);assert.equal(e.player.xp,75);assert.equal(e.residents[residentKey('/project',1)].xp,50);assert.equal(e.residents[residentKey('/project',2)].xp,25);
 assert.deepEqual(experience(JSON.parse(JSON.stringify(runs))),e);
});
test('errors, queued work, cancelled runs and missing responses do not award XP; project identities remain separate',()=>{
 const e=experience([run('a',1,'failed'),run('b',1,'running'),run('c',1,'cancelled'),run('d',1,'interrupted'),{...run('e'),result:null},run('f'),{...run('g'),project:'/other'}]);
 assert.equal(e.player.xp,50);assert.equal(Object.keys(e.residents).length,2);
});

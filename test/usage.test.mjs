import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import { usageSnapshot, usageWindow } from '../shared/usage.mjs';
import { readCodexUsage, usageReader } from '../bridge/usage.mjs';

const bucket = { primary: { usedPercent: 23.4, windowDurationMins: 300, resetsAt: 2000000000 }, secondary: { usedPercent: 100, windowDurationMins: 10080, resetsAt: 2000000001 } };
test('quota comes from account windows, retains zero and prefers multiple buckets', () => {
  const v = usageSnapshot({ rateLimits: bucket, rateLimitsByLimitId: { codex: bucket, other: {primary:{usedPercent:0}} }, secret: 'never exposed' }, '2026-10-06T12:00:00Z');
  assert.equal(v.buckets.length, 2);
  assert.equal(v.buckets[0].windows[0].remainingPercent, 76.6);
  assert.equal(v.buckets[0].windows[1].remainingPercent, 0);
  assert.equal(v.buckets[1].windows[0].remainingPercent, 100);
  assert.ok(!JSON.stringify(v).includes('never exposed'));
});
test('unknown, malformed and missing quotas never become full allowance', () => {
  for (const usedPercent of [null, '10', NaN, Infinity, -1, 101]) assert.equal(usageSnapshot({rateLimits:{primary:{usedPercent}}}).status,'unavailable');
  assert.equal(usageSnapshot({rateLimits:{credits:{balance:20}}}).status,'unavailable');
  assert.equal(usageSnapshot({}).buckets.length,0);
});
test('expired windows do not infer reset allowance and labels use actual durations', () => {
  const w = usageSnapshot({rateLimits:bucket}).buckets[0].windows;
  assert.deepEqual(usageWindow(w[0],0),{label:'5-hour',expired:false,remaining:76.6});
  assert.deepEqual(usageWindow(w[1],2000000001000),{label:'Weekly',expired:true,remaining:null});
});
function fakeChild(onMessage) {
  const child=new EventEmitter(); child.stdin=new PassThrough();child.stdout=new PassThrough();let pending='';
  child.kill=()=>{queueMicrotask(()=>child.emit('close',0));return true;};
  child.stdin.on('data',chunk=>{pending+=chunk;let at;while((at=pending.indexOf('\n'))>=0){const msg=JSON.parse(pending.slice(0,at));pending=pending.slice(at+1);onMessage(msg,child);}});
  return child;
}
test('reader sends only initialization and quota read, handles fragmented RPC, closes child',async()=>{
  const messages=[];let kills=0;
  const result=await readCodexUsage({spawnChild:(command,args,options)=>{
    assert.equal(command,'codex');assert.deepEqual(args,['app-server','--listen','stdio://']);assert.equal(options.stdio[2],'ignore');
    const c=fakeChild((msg,child)=>{messages.push(msg);if(msg.id)queueMicrotask(()=>{const answer=JSON.stringify({id:msg.id,result:msg.id===1?{}:{rateLimits:bucket}})+'\n';child.stdout.write(answer.slice(0,9));child.stdout.write(answer.slice(9));});});
    const kill=c.kill;c.kill=()=>{kills++;return kill();};return c;
  }});
  assert.equal(result.status,'available');assert.equal(kills,1);
  assert.deepEqual(messages.map(m=>m.method),['initialize','initialized','account/rateLimits/read']);
});
test('quota errors and timeout return safe unavailable without raw diagnostics',async()=>{
  for(const fail of ['error','timeout']){
    const v=await readCodexUsage({timeoutMs:10,spawnChild:()=>fakeChild((msg,c)=>{if(fail==='error')queueMicrotask(()=>c.stdout.write(JSON.stringify({id:msg.id,error:{message:'private credential details'}})+'\n'));})});
    assert.deepEqual(v,{status:'unavailable',capturedAt:null,buckets:[]});
  }
});
test('concurrent reads share one request, expire cache, discard stale quota on failure',async()=>{
  let calls=0,now=0;const read=usageReader(async()=>{calls++;if(calls>1)throw new Error('private');return usageSnapshot({rateLimits:bucket});},()=>now);
  const [a,b]=await Promise.all([read(),read()]);assert.equal(a,b);assert.equal(calls,1);await read();assert.equal(calls,1);
  now=60000;assert.equal((await read()).status,'unavailable');assert.equal(calls,2);
});

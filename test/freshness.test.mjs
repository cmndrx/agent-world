import test from 'node:test';
import assert from 'node:assert/strict';
import { observationTime, observedLabel, focusState } from '../shared/freshness.mjs';

test('observation age uses the latest event rather than age of the current state',()=>{
  const since='2026-10-05T10:00:00Z'; const latest=Date.parse('2026-10-05T12:00:00Z');
  assert.equal(observationTime({since,lastEventAt:latest}),latest);
  assert.equal(observedLabel({since,lastEventAt:latest},latest+120000),'Last observed 2m ago');
  assert.equal(observedLabel({lastObservedAt:since},latest),'Last observed 2h ago');
  assert.equal(observedLabel({},latest),'No observation received');
  assert.equal(observedLabel({lastEventAt:latest+100},latest),'Last observed just now');
});
test('unavailable saved focus does not filter notifications or invent a home',()=>{
  assert.deepEqual(focusState('/gone',[{project:'/p',name:'Project'}]),{effective:'',label:'Saved focus unavailable',saved:true});
  assert.deepEqual(focusState('/p',[{project:'/p',name:'Project'}]),{effective:'/p',label:'Focus: Project',saved:true});
  assert.equal(focusState('',[]).label,'All homes');
});

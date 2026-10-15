import test from 'node:test';
import assert from 'node:assert/strict';
import {runnerActivity} from '../shared/runner-activity.mjs';
import {resolveActivity} from '../web/src/activity.js';
const run = {id:'a', project:'/fixture', slot:4, status:'running', provider:'codex', startedAt:'2026-10-11T12:00:00Z'};
test('confirmed running pass supplies working activity without observer or conversation', () => {
  const [s] = runnerActivity([run]);
  assert.equal(s.state, 'running'); assert.equal(s.slot, 4);
  assert.equal(s.activityEvidence, 'game-runner'); assert.equal(s.conversation, undefined);
  assert.equal(s.lastEventAt, Date.parse(run.startedAt));
  assert.equal(resolveActivity(s).label, 'Working on approved pass');
  assert.equal(resolveActivity(s).at, 'desk');
  assert.match(resolveActivity(s).detail, /detailed activity unavailable/);
});
test('queued and terminal states never supply work, including after completion', () => {
  for (const status of ['approved','queued','completed','failed','cancelled','interrupted']) assert.deepEqual(runnerActivity([{...run,status}]), []);
});
test('detailed observation and genuine human waits take priority; idle does not hide work', () => {
  for (const state of ['editing','thinking','running','waiting_for_user','error']) assert.deepEqual(runnerActivity([run],[{project:run.project,slot:4,state}]), []);
  assert.equal(runnerActivity([run],[{project:run.project,slot:4,state:'idle'}]).length, 1);
  assert.equal(runnerActivity([run],[{project:run.project,slot:1,state:'editing'}]).length, 1);
});
test('Claude activity and resident/project boundaries remain explicit; inputs untouched', () => {
  const runs = [{...run,provider:'claude'}]; const before=JSON.stringify(runs);
  assert.equal(runnerActivity(runs)[0].source, 'claude-code');
  assert.equal(JSON.stringify(runs), before);
  assert.deepEqual(runnerActivity([], [{project:run.project,slot:4,state:'editing'}]), []);
});

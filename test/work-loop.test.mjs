import test from 'node:test';
import assert from 'node:assert/strict';
import { returnBriefing, briefingCutoff, evidenceReferences, safeReferenceURL } from '../shared/work-loop.mjs';
import { studyRecord, compareStudy } from '../shared/work-study.mjs';

test('return briefing prioritizes unresolved observed requests without inferring completion', () => {
  const data = { plans: [{ project: '/p', nextAction: 'Implement the next slice' }], tasks: [{ id: 't', project: '/p', title: 'Output', status: 'needs_review', updatedAt: '2026-10-05T12:00:00Z', evidence: 'Recorded check' }],
    sessions: [{ session: 's', project: '/p', state: 'waiting_for_user', app: 'Codex app', detail: { reason: 'permission' }, since: '2026-10-05T12:01:00Z' }],
    conversations: [{ key: 'saved', project: '/p' }] };
  const b = returnBriefing('/p', data);
  assert.equal(b.next.title, 'Approval requested'); assert.equal(b.next.session, 's');
  assert.equal(b.reviews.length, 1); assert.equal(b.newConversations.length, 0);
  assert.equal(data.tasks[0].status, 'needs_review');
  data.sessions = [];
  assert.equal(returnBriefing('/p', data).next.task, 't');
  data.tasks = [];
  assert.equal(returnBriefing('/p', data).next.detail, 'Implement the next slice');
});

test('review references allow safe web targets and preserve local paths without file serving', () => {
  for (const value of ['javascript:alert(1)', 'file:///etc/passwd', 'http://example.com', 'https://user:password@example.com']) assert.equal(safeReferenceURL(value), null);
  assert.equal(safeReferenceURL('http://localhost:5177/'), 'http://localhost:5177/');
  const refs = evidenceReferences('Recorded: https://example.com/output\n`/Users/me/My Project/report.md`\n/tmp/output.png\nhttps://example.com/output');
  assert.deepEqual(refs, [{ kind: 'url', value: 'https://example.com/output' }, { kind: 'path', value: '/Users/me/My Project/report.md' }, { kind: 'path', value: '/tmp/output.png' }]);
});

test('measurement journal keeps missing values unknown and rejects invented invalid timings', () => {
  const r = studyRecord({ project: '/p', comparison: 'UI fix pair 1', mode: 'with', resumeSeconds: '0', noticeSeconds: '', upkeepMinutes: '2' });
  assert.equal(r.resumeSeconds, 0); assert.equal(r.noticeSeconds, null); assert.equal(r.origin, 'human-entered');
  for (const values of [{}, { resumeSeconds: '-1' }, { noticeSeconds: 'NaN' }, { reviewBacklog: '1.2' }]) assert.throws(() => studyRecord({ project: '/p', comparison: 'one', mode: 'with', ...values }));
});

test('comparisons require paired project and slice measurements without reusing baselines', () => {
  const row = (mode, comparison, n, project = '/p') => studyRecord({ project, comparison, mode, resumeSeconds: n });
  const rows = [row('without', 'one', 100), row('with', 'one', 40), row('with', 'one', 2), row('without', 'other', 1), row('without', 'one', 999, '/other')];
  const summary = compareStudy(rows, '/p');
  const resume = summary.metrics.find(m => m.key === 'resumeSeconds');
  assert.equal(summary.records, 4); assert.equal(resume.pairs, 1); assert.equal(resume.delta, -60);
  assert.equal(summary.metrics.find(m => m.key === 'noticeSeconds').pairs, 0);
  assert.equal(compareStudy([row('with', 'one', 40)], '/p').metrics[1].delta, null);
});


test('briefing acknowledgement cannot drift past represented facts or acknowledge another project', () => {
  const data = { tasks: [{ project: '/p', updatedAt: '2026-10-05T12:00:00Z' }, { project: '/other', updatedAt: '2026-10-05T13:00:00Z' }], conversations: [{ project: '/p', lastObservedAt: '2026-10-05T12:01:00Z' }] };
  assert.equal(briefingCutoff('/p', data, Date.parse('2026-10-05T12:30:00Z')), '2026-10-05T12:01:00.000Z');
  assert.equal(briefingCutoff('/p', data, Date.parse('2026-10-05T12:40:00Z')), '2026-10-05T12:01:00.000Z');
});


test('explicit timer elapsed values preserve units and reject clock reversal; unmatched conditions stay project scoped',async()=>{
  const {elapsedMeasurement,pendingStudyPairs}=await import('../shared/work-study.mjs');
  assert.equal(elapsedMeasurement('resumeSeconds',1000,4500),3.5);
  assert.equal(elapsedMeasurement('upkeepMinutes',0,90000),1.5);
  assert.throws(()=>elapsedMeasurement('noticeSeconds',1000,0),/clock/);
  assert.throws(()=>elapsedMeasurement('reviewBacklog',0,1000),/Timer/);
  const row=(project,comparison,mode)=>({project,comparison,mode});
  const rows=[row('/p','one','with'),row('/p','one','without'),row('/p','one','with'),row('/other','hidden','with')];
  assert.deepEqual(pendingStudyPairs(rows,'/p'),[{comparison:'one',mode:'without'}]);
  assert.equal(compareStudy(rows,'/p').metrics[0].pairs,0);
});

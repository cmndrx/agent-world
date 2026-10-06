import test from 'node:test';
import assert from 'node:assert/strict';
import { Productivity } from '../bridge/productivity.mjs';
import { World } from '../bridge/world.mjs';
import { attentionItems, projectBriefing, shouldNotify, focusedAttention } from '../shared/productivity.mjs';
const homes = { '/project': { project: '/project', characters: [] } };
const chats = new Map([['c', { key: 'c', project: '/project' }], ['other', { key: 'other', project: '/other' }]]);
const input = { project: '/project', title: 'Build a useful feature', status: 'planned', conversationKeys: ['c'] };

test('task acceptance requires human confirmation and observes optimistic edits', () => {
  const p = new Productivity(); const t = p.saveTask(input, homes, chats);
  assert.throws(() => p.saveTask({ ...t, status: 'accepted' }, homes, chats), /Confirm/);
  const accepted = p.saveTask({ ...t, status: 'accepted', acceptedByUser: true }, homes, chats);
  assert.ok(accepted.acceptedAt);
  assert.throws(() => p.saveTask(t, homes, chats), /changed elsewhere/);
  assert.equal(p.tasks.get(t.id).status, 'accepted');
});
test('task links are scoped to their home and malformed stages are rejected', () => {
  const p = new Productivity();
  assert.throws(() => p.saveTask({ ...input, conversationKeys: ['other'] }, homes, chats), /this home/);
  assert.throws(() => p.saveTask({ ...input, status: 'done' }, homes, chats), /stage/);
  assert.throws(() => p.savePlan({ project: '/unknown' }, homes), /existing home/);
  assert.equal(p.tasks.size, 0);
});
test('finished turns and errors create attention, never task acceptance', () => {
  const p = new Productivity(); p.saveTask(input, homes, chats);
  const world = new World();
  world.apply({ kind: 'state', session: 's', source: 'codex', app: 'Codex app', project: '/project', state: 'waiting_for_user', detail: { reason: 'turn_complete' }, ts: new Date().toISOString() });
  const a = attentionItems({ ...world.snapshot(), ...p.snapshot() });
  assert.equal(a[0].title, 'Response ready'); assert.equal(a[0].routine, true);
  assert.equal(p.snapshot().tasks[0].status, 'planned');
  const errors = attentionItems({ sessions: [{ session: 'helper', parent_session: 's', state: 'error', project: '/project', since: new Date().toISOString() }] });
  assert.equal(errors[0].reason, 'error'); assert.equal(errors[0].routine, false);
});
test('briefings use explicit checkpoints and exclude saved-only chats', () => {
  const p = new Productivity();
  p.markSeen({ project: '/project', through: '2026-10-05T12:00:00Z' }, homes, '2026-10-05T12:01:00Z');
  assert.throws(() => p.markSeen({ project: '/project', through: '2099-01-01' }, homes), /timestamp/);
  p.markSeen({ project: '/project', through: '2026-10-05T11:00:00Z' }, homes, '2026-10-05T12:01:00Z');
  const b = projectBriefing('/project', { ...p.snapshot(), conversations: [
    { project: '/project', lastObservedAt: '2026-10-05T12:00:01Z' },
    { project: '/project', lastObservedAt: '2026-10-05T11:00:00Z' }, { project: '/project', provenance: 'user-added' },
  ] });
  assert.equal(b.since, '2026-10-05T12:00:00.000Z'); assert.equal(b.newConversations.length, 1);
});
test('review and blocker waiting times survive unrelated task edits; restored tasks create no sessions', () => {
  const p = new Productivity();
  const t = p.saveTask({ ...input, status: 'needs_review', blocker: 'Need a screenshot', evidence: '/tmp/output.png' }, homes, chats, '2026-10-05T12:00:00Z');
  const edited = p.saveTask({ ...t, notes: 'Added a note' }, homes, chats, '2026-10-05T12:05:00Z');
  assert.equal(edited.reviewSince, t.reviewSince); assert.equal(edited.blockerSince, t.blockerSince);
  const restored = new Productivity(p.snapshot());
  const items = attentionItems(restored.snapshot()); assert.equal(items.length, 1);
  assert.equal(items[0].origin, 'user'); assert.equal(items[0].since, '2026-10-05T12:00:00Z');
  assert.equal(projectBriefing('/project', restored.snapshot()).counts.reviews, 1);
});

test('focus silences only routine external turns, preserving urgent signals', () => {
  const turn = { project: '/other', state: 'waiting_for_user', detail: { reason: 'turn_complete' } };
  assert.equal(shouldNotify(turn, '/project'), false);
  for (const reason of ['input', 'permission', 'interrupted']) assert.equal(shouldNotify({ ...turn, detail: { reason } }, '/project'), true);
  assert.equal(shouldNotify({ ...turn, state: 'error' }, '/project'), true);
  assert.equal(shouldNotify(turn, ''), true);
  const items = [{ project: '/project', routine: true }, { project: '/other', routine: true }, { project: '/other', routine: false }];
  assert.equal(focusedAttention(items, '/project').length, 2);
  assert.equal(focusedAttention(items, '/project', true).length, 3);
});

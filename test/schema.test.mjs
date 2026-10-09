import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeEvent } from '../shared/schema.mjs';

const base = { kind: 'state', session: 's1', project: '/p', ts: '2026-10-07T12:00:00Z' };

test('a finished turn is recorded as idle, never "your turn"', () => {
  const { ok, event } = normalizeEvent({ ...base, state: 'waiting_for_user', detail: { reason: 'turn_complete' } });
  assert.equal(ok, true);
  assert.equal(event.state, 'idle');
  assert.equal(event.detail, null);
});

test('permission requests and questions still wait for the human', () => {
  for (const reason of ['permission', 'input']) {
    const { event } = normalizeEvent({ ...base, state: 'waiting_for_user', detail: { reason } });
    assert.equal(event.state, 'waiting_for_user');
    assert.equal(event.detail.reason, reason);
  }
});

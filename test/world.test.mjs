import assert from 'node:assert/strict';
import { test } from 'node:test';
import { normalizeEvent, redactDetail } from '../shared/schema.mjs';
import { World } from '../bridge/world.mjs';

const t0 = Date.parse('2026-10-05T12:00:00Z');
const at = (sec) => new Date(t0 + sec * 1000).toISOString();
const ev = (raw) => normalizeEvent({ source: 'test', provider: 'x', project: '/p', ...raw }).event;

test('sessions in the same project get stable, lowest-free slots', () => {
  const w = new World();
  w.apply(ev({ kind: 'session_start', session: 'a', ts: at(0) }));
  w.apply(ev({ kind: 'session_start', session: 'b', ts: at(1) }));
  assert.equal(w.sessions.get('a').slot, 1);
  assert.equal(w.sessions.get('b').slot, 2);

  w.apply(ev({ kind: 'session_end', session: 'a', ts: at(2) }));
  w.apply(ev({ kind: 'session_start', session: 'c', ts: at(3) }));
  assert.equal(w.sessions.get('c').slot, 1, 'c reuses the freed slot 1 character');
  assert.equal(w.households['/p'].characters.length, 2);
});

test('state events update state and since; unknown sessions start implicitly', () => {
  const w = new World();
  w.apply(ev({ kind: 'state', session: 'a', state: 'editing', detail: { target: 'x.ts' }, ts: at(0) }));
  const s = w.sessions.get('a');
  assert.equal(s.state, 'editing');
  assert.equal(s.detail.target, 'x.ts');
  w.apply(ev({ kind: 'state', session: 'a', state: 'editing', ts: at(5) }));
  assert.equal(s.since, at(0), 'since only changes when state changes');
});

test('visitors take no slot and leave with their parent', () => {
  const w = new World();
  w.apply(ev({ kind: 'session_start', session: 'a', ts: at(0) }));
  w.apply(ev({ kind: 'session_start', session: 'a~1', parent_session: 'a', ts: at(1) }));
  assert.equal(w.sessions.get('a~1').slot, null);
  w.apply(ev({ kind: 'session_end', session: 'a', ts: at(2) }));
  assert.equal(w.sessions.size, 0);
});

test('stale sessions are swept and free their slot', () => {
  const w = new World({ staleAfterMs: 60_000 });
  w.apply(ev({ kind: 'session_start', session: 'a', ts: at(0) }));
  w.sweep(t0 + 120_000);
  assert.equal(w.sessions.size, 0);
});

test('rename persists on the household character', () => {
  const w = new World();
  w.apply(ev({ kind: 'session_start', session: 'a', ts: at(0) }));
  assert.ok(w.rename('/p', 1, 'Robo'));
  assert.equal(w.households['/p'].characters[0].name, 'Robo');
});

test('privacy redaction', () => {
  const d = { tool: 'Edit', target: 'a.ts', summary: 'secret', reason: 'r' };
  assert.deepEqual(redactDetail(d, 'state'), { reason: 'r' });
  assert.deepEqual(redactDetail(d, 'targets'), { tool: 'Edit', target: 'a.ts', reason: 'r' });
  assert.deepEqual(redactDetail(d, 'full'), d);
});

test('normalizeEvent rejects bad input', () => {
  assert.equal(normalizeEvent({ kind: 'state', session: 's', project: '/p', state: 'dancing' }).ok, false);
  assert.equal(normalizeEvent({ kind: 'nope', session: 's', project: '/p' }).ok, false);
});

test('identical consecutive states are collapsed but keep the session alive', () => {
  const w = new World();
  w.apply(ev({ kind: 'state', session: 'a', state: 'thinking', ts: at(0) }));
  w.apply(ev({ kind: 'state', session: 'a', state: 'thinking', ts: at(30) }));
  const s = w.sessions.get('a');
  assert.equal(s.history.length, 1);
  assert.equal(s.lastEventAt, Date.parse(at(30)));
});

test('character names are unique across projects', () => {
  const w = new World();
  for (let i = 0; i < 30; i++) {
    w.apply(normalizeEvent({ source: 't', provider: 'x', project: `/p${i}`, kind: 'session_start', session: `s${i}`, ts: at(i) }).event);
  }
  const names = Object.values(w.households).flatMap((h) => h.characters.map((c) => c.name));
  assert.equal(new Set(names).size, names.length);
});

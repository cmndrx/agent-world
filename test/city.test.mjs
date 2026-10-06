import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BUSINESSES, DAYS_TO_OPEN, businessStage, downtown, emptyCity, mergeCity, recordEvent, signalsOf, whyText } from '../shared/city.mjs';

const ev = (state, target, extra = {}) => ({ kind: 'state', state, detail: target ? { target } : null, ts: '2026-10-05T10:00:00Z', session: 's1', project: '/p', ...extra });
const at = (day, hour = 10) => new Date(`2026-10-${String(day).padStart(2, '0')}T${String(hour).padStart(2, '0')}:00:00`).toISOString();

test('signals are kinds of work, read from categories only', () => {
  assert.deepEqual(signalsOf(ev('running', 'npm test')), ['tests']);
  assert.deepEqual(signalsOf(ev('running', 'git commit')), ['git']);
  assert.deepEqual(signalsOf(ev('running', 'git push')).sort(), ['git', 'ship']);
  assert.deepEqual(signalsOf(ev('running', 'docker compose')), ['ship']);
  assert.deepEqual(signalsOf(ev('searching')), ['search']);
  assert.deepEqual(signalsOf(ev('editing', 'src/App.tsx')), ['frontend']);
  assert.deepEqual(signalsOf(ev('editing', 'docs/GUIDE.md')), ['docs']);
  assert.deepEqual(signalsOf(ev('editing', 'analysis.ipynb')), ['data']);
  assert.deepEqual(signalsOf(ev('reading', 'docs/GUIDE.md')), []); // reading docs isn't writing them
  assert.deepEqual(signalsOf(ev('editing', 'server.go')), []);
  assert.deepEqual(signalsOf({ kind: 'session_start', parent_session: 'p', session: 'c', project: '/p', ts: at(5) }), ['delegate']);
  assert.deepEqual(signalsOf(ev('thinking')), []);
});

test('variety, not volume: each kind counts once per day', () => {
  const city = emptyCity();
  for (let i = 0; i < 500; i++) recordEvent(city, ev('running', 'npm test', { ts: at(5, 9 + (i % 10)) }));
  assert.equal(city.signals.tests.count, 1);
  assert.equal(businessStage(city, 'qa_lab'), 2); // day 1: under construction
  recordEvent(city, ev('running', 'npm test', { ts: at(6) }));
  assert.equal(DAYS_TO_OPEN, 2);
  assert.equal(businessStage(city, 'qa_lab'), 3); // day 2: open
  recordEvent(city, ev('running', 'pytest', { ts: at(9), project: '/q' }));
  assert.equal(businessStage(city, 'qa_lab'), 3);
  assert.equal(recordEvent(city, ev('running', 'npm test', { ts: at(9) })), false); // nothing new
  assert.match(whyText(city, 'qa_lab'), /ran tests on 3 different days .* across 2 projects/);
});

test('synthetic demo events never count outside demo mode', () => {
  const city = emptyCity();
  assert.equal(recordEvent(city, ev('searching', null, { x_synthetic: true })), false);
  assert.equal(recordEvent(city, ev('searching', null, { session: 'fake-abc-1' })), false);
  assert.equal(city.signals.search, undefined);
  assert.equal(recordEvent(city, ev('searching', null, { x_synthetic: true }), { allowSynthetic: true }), true);
  assert.equal(city.demo, true);
});

test('saved ledger merges with a rebuilt one without losing anything', () => {
  const saved = emptyCity();
  for (const d of [1, 2, 3]) recordEvent(saved, ev('running', 'npm test', { ts: at(d) }));
  const rebuilt = emptyCity(); // event files for days 1–2 were deleted
  recordEvent(rebuilt, ev('running', 'npm test', { ts: at(3) }));
  recordEvent(rebuilt, ev('searching', null, { ts: at(4) }));
  const merged = mergeCity(saved, rebuilt);
  assert.equal(merged.signals.tests.count, 3);
  assert.equal(merged.signals.search.count, 1);
  assert.equal(businessStage(merged, 'qa_lab'), 3);
});

test('downtown order follows when each kind of work first appeared', () => {
  const city = emptyCity();
  recordEvent(city, ev('searching', null, { ts: at(2) }));
  recordEvent(city, ev('running', 'npm test', { ts: at(1) }));
  recordEvent(city, ev('editing', 'README.md', { ts: at(3) }));
  assert.deepEqual(downtown(city).map((b) => b.id), ['qa_lab', 'library', 'print_shop']);
  assert.equal(Object.keys(BUSINESSES).length, 8);
});

test('residents get a role from their most common kind of work, by days', async () => {
  const { roleOf, roleWhy, residentKey } = await import('../shared/city.mjs');
  const city = emptyCity();
  const me = { key: residentKey('/p', 1), kind: 'resident', project: '/p', slot: 1 };
  for (const d of [1, 2]) recordEvent(city, ev('running', 'npm test', { ts: at(d) }), { person: me });
  for (let i = 0; i < 50; i++) recordEvent(city, ev('searching', null, { ts: at(3, 9 + (i % 9)) }), { person: me }); // volume doesn't matter
  const person = city.people[me.key];
  assert.deepEqual(person.days, ['2026-10-01', '2026-10-02', '2026-10-03']);
  assert.equal(roleOf(person).title, 'Tester');
  assert.equal(roleOf(person).business, 'qa_lab');
  assert.match(roleWhy(person, "Hazel's sessions"), /Tester because .* testing \(2 days\)/);
  recordEvent(city, ev('searching', null, { ts: at(4) }), { person: me });
  assert.equal(roleOf(person).title, 'Researcher'); // tie on days goes to the most recent
  assert.equal(roleOf({ signals: {} }), null);
});

test('helper types are interns until they work three different days, then hired with a stable name', async () => {
  const { staff, helperKey, helperType } = await import('../shared/city.mjs');
  const city = emptyCity();
  const helper = { key: helperKey('/p', helperType('Explore')), kind: 'helper', project: '/p', type: 'Explore' };
  recordEvent(city, ev('thinking', null, { ts: at(1) }), { person: helper });
  recordEvent(city, ev('searching', null, { ts: at(1) }), { person: helper });
  assert.equal(staff(city)[0].hired, false);
  recordEvent(city, ev('thinking', null, { ts: at(2) }), { person: helper });
  recordEvent(city, ev('reading', 'a.md', { ts: at(5) }), { person: helper });
  const [s] = staff(city);
  assert.equal(s.hired, true);
  assert.equal(s.role.title, 'Researcher');
  assert.ok(s.name);
  assert.equal(staff(structuredClone(city))[0].name, s.name);
  assert.equal(helperType('  Explore\u0007 '), 'Explore');
  assert.equal(helperType(''), 'helper');
});

test('replaying the same events never inflates counts', () => {
  const city = emptyCity();
  const events = [1, 2, 3].map((d) => ev('running', 'npm test', { ts: at(d) }));
  for (let i = 0; i < 3; i++) for (const e of events) recordEvent(city, e, { person: { key: 'r:/p#1', kind: 'resident', project: '/p', slot: 1 } });
  assert.equal(city.signals.tests.count, 3);
  assert.equal(city.people['r:/p#1'].signals.tests.length, 3);
  assert.equal(mergeCity(city, city).signals.tests.count, 3);
});

test('businesses upgrade with days of use, never volume', async () => {
  const { businessTier, businessName, businessProgress, TIERS } = await import('../shared/city.mjs');
  const city = emptyCity();
  const day = (n) => new Date(Date.UTC(2026, 8, 1 + n, 12)).toISOString();
  for (let i = 0; i < 1000; i++) recordEvent(city, ev('running', 'npm test', { ts: day(0) })); // a busy day is still one day
  assert.equal(businessTier(city, 'qa_lab'), 0);
  for (let n = 1; n < 7; n++) recordEvent(city, ev('running', 'npm test', { ts: day(n) }));
  assert.equal(businessTier(city, 'qa_lab'), 2);
  assert.match(whyText(city, 'qa_lab'), /^Expanded because .* Next: flagship at 14 days\./);
  for (let n = 7; n < 30; n++) recordEvent(city, ev('running', 'npm test', { ts: day(n) }));
  assert.equal(businessTier(city, 'qa_lab'), TIERS.length);
  assert.equal(businessName('qa_lab', 4), 'Testing tower');
  assert.equal(businessProgress(city, 'qa_lab').next, null);
  assert.match(whyText(city, 'qa_lab'), /^Became a landmark .* Fully grown\./);
});

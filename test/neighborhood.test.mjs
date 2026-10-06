import assert from 'node:assert/strict';
import { test } from 'node:test';
import { dayKey, spawnsFor } from '../shared/collectibles.mjs';
import { commonsHint, COMMONS, progress } from '../shared/progression.mjs';
import { applyStyleChange, emptyStyle, sanitizeHome } from '../shared/style.mjs';

const accepted = (i) => ({ id: `t${i}`, project: '/p', title: `T${i}`, status: 'accepted', evidence: 'notes', acceptedAt: '2026-10-05T10:00:00Z' });

test('public spaces open from either count, across all homes', () => {
  assert.deepEqual(progress({ tasks: [] }).commons, []);
  assert.deepEqual(progress({ tasks: [1, 2, 3].map(accepted) }).commons, ['park']);
  assert.deepEqual(progress({ plans: [{ project: '/a', milestones: [{}] }] }).commons, ['park']);
  const lots = progress({ tasks: [1, 2, 3, 4, 5].map(accepted), plans: [{ project: '/a', milestones: [{}, {}, {}] }] });
  assert.deepEqual(lots.commons, ['park', 'cafe', 'plaza']);
  assert.equal(commonsHint(COMMONS[0]), 'Reach 1 outcome, or earn 3 task review credits');
});

test('daily spawns are deterministic, distinct, and independent of home order', () => {
  const a = spawnsFor('2026-10-05', ['/b', '/a']);
  const b = spawnsFor('2026-10-05', ['/a', '/b']);
  assert.deepEqual(a, b);
  assert.equal(a.length, 4);
  assert.equal(new Set(a.map((s) => `${s.project}|${s.x}|${s.z}`)).size, 4);
  assert.notDeepEqual(spawnsFor('2026-10-06', ['/a', '/b']), a);
  assert.match(dayKey(new Date(2026, 0, 3)), /^2026-01-03$/);
});

test('collecting only works for today, once, and unlocks found decor', () => {
  const homes = ['/p'];
  const spawns = spawnsFor('2026-10-05', homes);
  const known = { homes: new Set(homes), residents: new Set(), spawns };
  let s = { ...emptyStyle(), collected: ['2026-10-04:0:crystal'] };
  s = applyStyleChange(s, { kind: 'collect', key: spawns[0].id }, known);
  assert.equal(s.found[spawns[0].kind], 1);
  assert.deepEqual(s.collected, [spawns[0].id], 'older days are pruned');
  assert.throws(() => applyStyleChange(s, { kind: 'collect', key: spawns[0].id }, known), /Already/);
  assert.throws(() => applyStyleChange(s, { kind: 'collect', key: '2026-10-05:9:golden_gnome' }, known), /not here today/);

  const place = (style, item) => applyStyleChange(style, { kind: 'home', key: '/p', value: { decor: [{ id: 'f1', item, x: 8, z: 7 }] } }, { ...known, levels: { '/p': 1 } });
  assert.throws(() => place(emptyStyle(), 'veggie_patch'), /Find one/);
  assert.equal(place({ ...emptyStyle(), found: { seed_packet: 1 } }, 'veggie_patch').homes['/p'].decor[0].item, 'veggie_patch');
});

test('layout, street names and pets are validated', () => {
  const known = { homes: new Set(['/a', '/b']), residents: new Set() };
  const s = applyStyleChange(emptyStyle(), { kind: 'layout', value: ['/b', null, '/a', null, null] }, known);
  assert.deepEqual(s.layout, ['/b', null, '/a']);
  assert.throws(() => applyStyleChange(s, { kind: 'layout', value: ['/a', '/a'] }, known), /one plot/);
  assert.throws(() => applyStyleChange(s, { kind: 'layout', value: ['/zzz'] }, known), /one plot/);
  const named = applyStyleChange(s, { kind: 'street', key: '0', value: '  Maple Lane\u0007 ' }, known);
  assert.equal(named.streets[0], 'Maple Lane');
  assert.equal(applyStyleChange(named, { kind: 'street', key: '0', value: '' }, known).streets[0], undefined);
  assert.equal(sanitizeHome({ pet: 'cat' }).pet, 'cat');
  assert.throws(() => sanitizeHome({ pet: 'dragon' }), /pet/);
});

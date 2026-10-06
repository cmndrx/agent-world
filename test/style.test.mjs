import assert from 'node:assert/strict';
import { test } from 'node:test';
import { applyStyleChange, emptyStyle, sanitizeHome, sanitizeLook } from '../shared/style.mjs';

const known = { homes: new Set(['/p']), residents: new Set(['/p#1']) };

test('home style keeps valid paint and decor, snapping positions to the grid', () => {
  const home = sanitizeHome({
    exterior: '#9FC4E6',
    floor: 'walnut',
    decor: [{ id: 'a1', item: 'fern', x: 1.13, z: -2.4, rot: 5 }],
  });
  assert.equal(home.exterior, '#9fc4e6');
  assert.equal(home.floor, 'walnut');
  assert.deepEqual(home.decor[0], { id: 'a1', item: 'fern', x: 1.25, z: -2.5, rot: 1 });
});

test('home style rejects unknown items, colors and duplicate ids', () => {
  assert.throws(() => sanitizeHome({ decor: [{ id: 'a', item: 'nuclear_reactor', x: 0, z: 0 }] }), /Unknown decoration/);
  assert.throws(() => sanitizeHome({ exterior: '#123456' }), /exterior/);
  assert.throws(() => sanitizeHome({ decor: [{ id: 'a', item: 'fern', x: 0, z: 0 }, { id: 'a', item: 'fern', x: 1, z: 1 }] }), /unique/);
});

test('positions are clamped inside the lot', () => {
  const home = sanitizeHome({ decor: [{ id: 'a', item: 'gnome', x: 999, z: -999 }] });
  assert.ok(home.decor[0].x <= 10.4 && home.decor[0].z >= -9.2);
});

test('looks accept only wardrobe options', () => {
  assert.deepEqual(sanitizeLook({ shirt: '#5b6cf9', top: 'hoodie', accessory: 'glasses', hairStyle: 2, junk: 1 }), {
    shirt: '#5b6cf9', top: 'hoodie', accessory: 'glasses', hairStyle: 2,
  });
  assert.throws(() => sanitizeLook({ accessory: 'crown' }), /accessory/);
  assert.throws(() => sanitizeLook({ hairStyle: 9 }), /hair style/);
});

test('changes only apply to known homes and residents; null resets', () => {
  let s = applyStyleChange(emptyStyle(), { kind: 'home', key: '/p', value: { floor: 'slate' } }, known);
  assert.equal(s.homes['/p'].floor, 'slate');
  s = applyStyleChange(s, { kind: 'resident', key: '/p#1', value: { top: 'tee' } }, known);
  assert.equal(s.residents['/p#1'].top, 'tee');
  s = applyStyleChange(s, { kind: 'home', key: '/p', value: null }, known);
  assert.equal(s.homes['/p'], undefined);
  assert.throws(() => applyStyleChange(s, { kind: 'home', key: '/elsewhere', value: {} }, known), /Unknown home/);
  assert.throws(() => applyStyleChange(s, { kind: 'resident', key: '/p#7', value: {} }, known), /Unknown resident/);
});

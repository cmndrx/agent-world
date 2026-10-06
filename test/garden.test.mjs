import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { CROPS, formatRemaining, growMs, growth } from '../shared/garden.mjs';
import { lockReason } from '../shared/progression.mjs';
import { applyStyleChange, emptyStyle, removePhoto } from '../shared/style.mjs';

const T0 = Date.parse('2026-10-05T08:00:00Z');
const known = (extra = {}) => ({ homes: new Set(['/p']), residents: new Set(), earned: 0, levels: {}, now: T0, ...extra });
const withBed = () => applyStyleChange(emptyStyle(), { kind: 'home', key: '/p', value: { decor: [{ id: 'bed1', item: 'garden_bed', x: 3, z: 8, rot: 0 }] } }, known());

test('growth stages follow real time and never wilt', () => {
  const plot = { crop: 'tomato', plantedAt: T0 };
  assert.equal(growth(plot, T0).stage, 0);
  assert.equal(growth(plot, T0 + growMs('tomato') * 0.3).stage, 1);
  assert.equal(growth(plot, T0 + growMs('tomato') * 0.6).stage, 2);
  assert.equal(growth(plot, T0 + growMs('tomato')).ripe, true);
  assert.equal(growth(plot, T0 + growMs('tomato') * 50).stage, 3); // still ripe much later
  assert.equal(formatRemaining(3 * 3600e3 + 20 * 60e3), '3h 20m');
  assert.equal(formatRemaining(30e3), 'under a minute');
});

test('planting needs a garden bed, uses the bridge clock, and pumpkins need a seed packet', () => {
  const style = withBed();
  assert.throws(() => applyStyleChange(style, { kind: 'plant', key: '/p', value: { bed: 'nope', crop: 'tomato' } }, known()), /garden bed is gone/);
  assert.throws(() => applyStyleChange(style, { kind: 'plant', key: '/p', value: { bed: 'bed1', crop: 'pumpkin' } }, known()), /seed packet/);
  const planted = applyStyleChange(style, { kind: 'plant', key: '/p', value: { bed: 'bed1', crop: 'tomato', plantedAt: 0 } }, known());
  assert.deepEqual(planted.gardens['/p'].bed1, { crop: 'tomato', plantedAt: T0 });
  assert.throws(() => applyStyleChange(planted, { kind: 'plant', key: '/p', value: { bed: 'bed1', crop: 'sunflower' } }, known()), /already growing/);
  const found = applyStyleChange({ ...style, found: { seed_packet: 1 } }, { kind: 'plant', key: '/p', value: { bed: 'bed1', crop: 'pumpkin' } }, known());
  assert.equal(found.gardens['/p'].bed1.crop, 'pumpkin');
});

test('harvesting only when ripe; first harvest unlocks its decor; removing a bed clears it', () => {
  const planted = applyStyleChange(withBed(), { kind: 'plant', key: '/p', value: { bed: 'bed1', crop: 'tomato' } }, known());
  assert.throws(() => applyStyleChange(planted, { kind: 'harvest', key: '/p', value: { bed: 'bed1' } }, known({ now: T0 + 3600e3 })), /Not ready/);
  const done = applyStyleChange(planted, { kind: 'harvest', key: '/p', value: { bed: 'bed1' } }, known({ now: T0 + growMs('tomato') }));
  assert.equal(done.harvest.tomato, 1);
  assert.equal(done.gardens['/p'], undefined);
  assert.equal(lockReason(CROPS.tomato.unlocks, {}), 'grown');
  assert.equal(lockReason(CROPS.tomato.unlocks, { harvest: done.harvest }), null);
  assert.throws(() => applyStyleChange(planted, { kind: 'home', key: '/p', value: { decor: [{ id: 'c1', item: 'veg_crate', x: 0, z: 8 }] } }, known()), /Harvest tomatoes/);
  const placed = applyStyleChange(done, { kind: 'home', key: '/p', value: { decor: [{ id: 'bed1', item: 'garden_bed', x: 3, z: 8 }, { id: 'c1', item: 'veg_crate', x: 0, z: 8 }] } }, known());
  assert.equal(placed.homes['/p'].decor.length, 2);
  const cleared = applyStyleChange(planted, { kind: 'home', key: '/p', value: { decor: [] } }, known());
  assert.equal(cleared.gardens['/p'], undefined);
});

test('gallery accepts only existing photos, up to four, and deleting a photo takes it down', () => {
  const photos = new Set(['abc123-1', 'abc123-2']);
  assert.throws(() => applyStyleChange(emptyStyle(), { kind: 'gallery', key: '/p', value: ['zzz999-9'] }, known({ photos })), /Unknown photo/);
  assert.throws(() => applyStyleChange(emptyStyle(), { kind: 'gallery', key: '/p', value: ['abc123-1', 'abc123-1'] }, known({ photos })), /Unknown photo/);
  assert.throws(() => applyStyleChange(emptyStyle(), { kind: 'gallery', key: '/p', value: Array(5).fill('abc123-1') }, known({ photos })), /up to 4/);
  const hung = applyStyleChange(emptyStyle(), { kind: 'gallery', key: '/p', value: ['abc123-1', 'abc123-2'] }, known({ photos }));
  assert.deepEqual(hung.gallery['/p'], ['abc123-1', 'abc123-2']);
  assert.deepEqual(removePhoto(hung, 'abc123-1').gallery['/p'], ['abc123-2']);
  assert.equal(removePhoto(removePhoto(hung, 'abc123-1'), 'abc123-2').gallery['/p'], undefined);
});

test('photo store keeps only JPEGs in the configured home', async () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'aw-photos-'));
  const before = process.env.AGENT_WORLD_HOME;
  process.env.AGENT_WORLD_HOME = home;
  try {
    const { deletePhoto, listPhotos, photoPath, savePhoto } = await import('../bridge/photos.mjs');
    assert.throws(() => savePhoto(Buffer.from('not a jpeg')), /JPEG/);
    const { id } = savePhoto(Buffer.from([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]));
    assert.equal(listPhotos()[0].id, id);
    assert.ok(photoPath(id).startsWith(home));
    assert.equal(photoPath('../style'), null);
    deletePhoto(id);
    assert.deepEqual(listPhotos(), []);
  } finally {
    if (before === undefined) delete process.env.AGENT_WORLD_HOME;
    else process.env.AGENT_WORLD_HOME = before;
    fs.rmSync(home, { recursive: true, force: true });
  }
});

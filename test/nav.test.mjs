import assert from 'node:assert/strict';
import { test } from 'node:test';
import { NavGrid } from '../web/src/nav.js';

function room() {
  const nav = new NavGrid({ x0: -10, z0: -5, x1: 10, z1: 10.5 }, 0.25, 0.25);
  nav.addRect([-7.2, -5.2, -7.0, 5.2]);
  nav.addRect([7.0, -5.2, 7.15, 5.2]);
  nav.addRect([-7.2, 5.0, -0.9, 5.12]);
  nav.addRect([0.9, 5.0, 7.15, 5.12]);
  nav.addRect([-2.4, -3.6, -0.8, -2.8]); // desk at x=-1.6
  return nav;
}

function crossesBlocked(nav, from, path) {
  let a = from;
  for (const b of path.slice(0, -1)) {
    if (!nav.clear(a, b)) return true;
    a = b;
  }
  return false;
}

test('enters the room through the door', () => {
  const nav = room();
  const from = { x: 5, z: 9 };
  const path = nav.findPath(from, { x: 4, z: 0 });
  assert.ok(path.some((p) => Math.abs(p.x) < 0.9 && p.z > 4.5 && p.z < 5.6), 'passes the doorway');
  assert.equal(crossesBlocked(nav, from, path), false);
});

test('walks around a desk to the chair behind it', () => {
  const nav = room();
  const from = { x: -1.6, z: 0 };
  const path = nav.findPath(from, { x: -1.6, z: -4.15 });
  assert.ok(path.length >= 2, 'not a straight line through the desk');
  assert.deepEqual(path.at(-1), { x: -1.6, z: -4.15 });
  assert.equal(crossesBlocked(nav, from, path), false);
});

test('can start inside furniture (standing up from the couch)', () => {
  const nav = room();
  nav.addRect([0.48, 3.13, 3.53, 4.18]);
  const path = nav.findPath({ x: 2, z: 3.8 }, { x: -5, z: 0 });
  assert.ok(path.length > 1);
});

test('reachableFrom finds what a wall cuts off', () => {
  const nav = new NavGrid({ x0: 0, z0: 0, x1: 10, z1: 10 }, 0.25, 0.25);
  nav.addRect([4.8, 0, 5.2, 10]); // a full-height wall at x≈5
  const reach = nav.reachableFrom({ x: 1, z: 5 });
  const at = (x, z) => { const [i, j] = nav.toCell(x, z); return reach[j * nav.w + i]; };
  assert.equal(at(2, 2), 1);
  assert.equal(at(8, 8), 0);
});

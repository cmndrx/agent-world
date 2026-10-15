import test from 'node:test';
import assert from 'node:assert/strict';
import { Environment } from '../web/src/environment.js';

test('game clock distinguishes midnight, noon and adjacent AM/PM minutes', () => {
  for (const [hour, expected] of [
    [0, '12:00 AM'], [1, '1:00 AM'], [11 + 59.5 / 60, '11:59 AM'],
    [12, '12:00 PM'], [12 + 0.5 / 60, '12:00 PM'], [13, '1:00 PM'],
    [23 + 59.5 / 60, '11:59 PM'],
  ]) assert.equal(Environment.prototype.label.call({ hour }), expected);
});

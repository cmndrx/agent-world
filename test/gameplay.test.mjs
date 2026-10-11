import test from 'node:test';
import assert from 'node:assert/strict';
import { applyGameplayAction, emptyGameplay, townHallState, TOWN_HALL, visibleResidents, completionCost, gameplaySpent } from '../shared/gameplay.mjs';
import { progress } from '../shared/progression.mjs';

test('observed residents remain hidden until the player links a provider', () => {
  const households = [{ project: '/example' }];
  const sessions = [{ session: 'observed-session' }];
  assert.deepEqual(visibleResidents(emptyGameplay(), households, sessions), { households: [], sessions: [] });
  const linked = applyGameplayAction(emptyGameplay(), { action: 'claim', provider: 'codex' }, 0);
  assert.deepEqual(visibleResidents(linked, households, sessions), { households, sessions });
});
test('first verified connection grants gems once; Town Hall spends them and opens when time elapses', () => {
  const now = Date.now();
  const connected = applyGameplayAction(emptyGameplay(), { action: 'claim', provider: 'codex' }, 0, now);
  assert.equal(progress({}, {}, connected).balance, 50);
  assert.throws(() => applyGameplayAction(connected, { action: 'claim', provider: 'claude' }, 50, now), /already claimed/);
  const started = applyGameplayAction(connected, { action: 'start' }, 50, now);
  assert.equal(progress({}, {}, started).balance, 20);
  assert.equal(townHallState(started, now).status, 'building');
  assert.equal(townHallState(started, now + TOWN_HALL.durationMs).status, 'built');
  assert.equal(progress({}, {}, started).commons.includes('townhall'), false);
});

test('speed up finishes construction at one gem per remaining minute', () => {
  const now = Date.parse('2026-10-06T12:00:00Z');
  let game = applyGameplayAction(emptyGameplay(), { action: 'claim', provider: 'claude' }, 0, now);
  game = applyGameplayAction(game, { action: 'start' }, 50, now);
  assert.equal(completionCost(game, now), 5);
  assert.equal(completionCost(game, now + 60001), 4);
  assert.equal(completionCost(game, now + TOWN_HALL.durationMs - 1), 1);
  assert.throws(() => applyGameplayAction(game, { action: 'expedite' }, 4, now), /Not enough gems/);
  game = applyGameplayAction(game, { action: 'expedite', cost: 0 }, 20, now);
  assert.equal(townHallState(game, now).remainingMs, 0);
  assert.equal(progress({}, {}, game).balance, 15);
  assert.throws(() => applyGameplayAction(game, { action: 'start' }, 15, now), /already started/);
  assert.throws(() => applyGameplayAction(game, { action: 'expedite' }, 20, now), /not under construction/);
  assert.equal(gameplaySpent({ townhall: { expedites: 3 } }), 45, 'legacy spending is not refunded');
});

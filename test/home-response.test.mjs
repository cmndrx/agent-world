import test from 'node:test';
import assert from 'node:assert/strict';
import {homeResponse} from '../web/src/home-response.js';

test('home overview explains stale bridge plain-text 404', async () => {
  await assert.rejects(homeResponse(new Response('not found', {status:404})), /restart its local bridge/);
});
test('home overview preserves API validation errors and reads success', async () => {
  await assert.rejects(homeResponse(Response.json({error:'Home is under construction.'}, {status:400})), /Home is under construction/);
  await assert.rejects(homeResponse(Response.json({error:'Choose a home in this town.'}, {status:404})), /Choose a home in this town/);
  assert.deepEqual(await homeResponse(Response.json({capacity:1})), {capacity:1});
});
test('home overview explains non-JSON server failures', async () => {
  await assert.rejects(homeResponse(new Response('bad gateway', {status:502})), /invalid response/);
});

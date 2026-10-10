import test from 'node:test';
import assert from 'node:assert/strict';
import { claudeAuth } from '../bridge/provider-auth.mjs';

const probe = (error, stdout) => claudeAuth({ command: '/fixture/Claude Code/claude', execute(command, args, options, done) {
  assert.deepEqual(args, ['auth', 'status', '--json']);
  assert.equal(options.timeout, 15000);
  done(error, stdout);
} });
test('Claude sign-in probe handles signed-out exit 1 and directs the player to open Claude Code', async () => {
  const result = await probe({ code: 1 }, JSON.stringify({ loggedIn: false, email: 'private@example.invalid' }));
  assert.equal(result.reason, 'signed-out');
  assert.match(result.message, /Open Claude Code and sign in/);
  assert.equal(result.loginCommand, undefined);
  assert.ok(!JSON.stringify(result).includes('private@example.invalid'));
});
test('Claude auth only confirms successful loggedIn status; missing, timed out and malformed responses stay unavailable', async () => {
  assert.deepEqual(await probe(null, '{"loggedIn":true}'), { ready: true });
  assert.equal((await probe({ code: 'ENOENT' }, '')).reason, 'missing');
  assert.equal((await probe({ killed: true }, '')).reason, 'unavailable');
  assert.equal((await probe(null, 'not json')).ready, false);
  assert.equal((await probe({ code: 1 }, '{"loggedIn":true}')).ready, false);
});
test('noninteractive auth closes its input pipe so CLI startup cannot wait for a prompt', async () => {
  let closed = false;
  const result = await claudeAuth({ execute(command, args, options, done) {
    return { stdin: { end() { closed = true; done(null, '{"loggedIn":true}'); } } };
  } });
  assert.equal(closed, true);
  assert.equal(result.ready, true);
});

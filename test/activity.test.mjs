import assert from 'node:assert/strict';
import { test } from 'node:test';
import { appName, commandPhrase, mcpParts, resolveActivity } from '../web/src/activity.js';

const t = (state, detail) => resolveActivity({ state, detail });

test('computer work happens at the desk with the right app and plain-words label', () => {
  const cases = [
    [t('editing', { tool: 'Edit', target: 'src/orders.ts' }), 'editor', 'Editing orders.ts', 'type'],
    [t('editing', { tool: 'Write', target: 'README.md' }), 'editor', 'Writing README.md', 'type'],
    [t('reading', { tool: 'Read', target: 'src/db.py' }), 'reader', 'Reading db.py', 'read'],
    [t('reading', { tool: 'Grep', target: 'handleOrder' }), 'search', 'Searching the code', 'read'],
    [t('reading', { tool: 'Glob', target: '**/*.ts' }), 'search', 'Looking for files', 'read'],
    [t('reading', { tool: 'exec_command', target: 'git diff' }), 'terminal', 'Checking what changed', 'read'],
    [t('running', { tool: 'Bash', target: 'npm test' }), 'terminal', 'Running tests', 'watch_close'],
    [t('running', { tool: 'Bash', target: 'npm run dev' }), 'terminal', 'Starting the app', 'lounge'],
    [t('running', { tool: 'Bash', target: 'git commit' }), 'terminal', 'Committing changes', 'watch'],
    [t('searching', { tool: 'WebSearch' }), 'websearch', 'Searching the web', 'mouse'],
    [t('searching', { tool: 'WebFetch', target: 'docs.python.org' }), 'browser', 'Reading docs.python.org', 'mouse'],
    [t('searching', { tool: 'mcp__Claude_Browser__navigate', target: 'navigate' }), 'browser', 'Opening a web page', 'mouse'],
    [t('running', { tool: 'mcp__github__create_pull_request', target: 'create_pull_request' }), 'tool', 'Using GitHub', 'mouse'],
    [t('thinking', { tool: 'TodoWrite' }), 'plan', 'Updating its to-do list', 'plan'],
    [t('thinking', { tool: 'Edit' }), 'chat', 'Checking its changes', 'think'],
    [t('thinking', {}), 'chat', 'Thinking', 'think'],
    [t('delegating', { target: 'Explore' }), 'delegate', 'Sending a helper to explore the code', 'talk'],
    [t('error', { tool: 'Bash', reason: 'tool_failed' }), 'error', 'A command failed', 'facepalm'],
  ];
  for (const [a, app, label, pose] of cases) {
    assert.equal(a.app, app, label);
    assert.equal(a.label, label);
    assert.equal(a.pose, pose, label);
    assert.equal(a.at, 'desk', label);
  }
});

test('the exact command, file or pattern is kept as a separate detail', () => {
  assert.equal(t('running', { tool: 'Bash', target: 'npm test' }).detail, 'npm test');
  assert.equal(t('reading', { tool: 'Grep', target: 'handleOrder' }).detail, '“handleOrder”');
  assert.equal(t('editing', { tool: 'Edit', target: 'src/orders.ts' }).detail, 'src/orders.ts');
});

test('waiting says what the agent needs from you', () => {
  assert.equal(t('waiting_for_user', { reason: 'permission', tool: 'Bash' }).label, 'Needs your OK to run a command');
  assert.equal(t('waiting_for_user', { reason: 'permission', tool: 'Write' }).label, 'Needs your OK to change files');
  assert.equal(t('waiting_for_user', { reason: 'permission' }).label, 'Needs your approval');
  assert.equal(t('waiting_for_user', { reason: 'turn_complete' }).label, 'Done, your turn');
  assert.equal(t('waiting_for_user', { reason: 'input' }).label, 'Has a question for you');
  assert.equal(t('waiting_for_user', { reason: 'input' }).at, 'wait');
});

test('no session means off duty; idle means away from the desk', () => {
  assert.equal(resolveActivity(null).app, 'off');
  assert.equal(t('idle').at, 'away');
});

test('helpers for names and phrases', () => {
  assert.equal(commandPhrase('git push'), 'Pushing changes');
  assert.equal(commandPhrase('npm install'), 'Installing packages');
  assert.equal(commandPhrase('python build.py'), 'Running build.py');
  assert.equal(commandPhrase('docker compose'), 'Working with Docker');
  assert.deepEqual(mcpParts('mcp__github__create_pull_request'), { app: 'GitHub', action: 'create pull request' });
  assert.equal(mcpParts('mcp__cua_repl.js').app, 'the computer');
  assert.equal(appName({ source: 'claude-code', app: 'Claude desktop app' }), 'Claude desktop app');
  assert.equal(appName({ source: 'codex' }), 'Codex');
});

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { translate } from '../adapters/claude-code/hook.mjs';

const base = { session_id: 's1', cwd: '/tmp/proj' };

test('tool hooks map to canonical states', () => {
  const cases = [
    [{ tool_name: 'Read', tool_input: { file_path: '/tmp/proj/src/a.ts' } }, 'reading', 'src/a.ts'],
    [{ tool_name: 'Edit', tool_input: { file_path: '/tmp/proj/b.ts' } }, 'editing', 'b.ts'],
    [{ tool_name: 'Bash', tool_input: { command: 'npm test -- --watch' } }, 'running', 'npm test'],
    [{ tool_name: 'WebFetch', tool_input: { url: 'https://docs.x.com/a' } }, 'searching', 'docs.x.com'],
  ];
  for (const [input, state, target] of cases) {
    const [e] = translate({ ...base, hook_event_name: 'PreToolUse', ...input });
    assert.equal(e.state, state);
    assert.equal(e.detail.target, target);
  }
});

test('Stop means waiting for the user', () => {
  const [e] = translate({ ...base, hook_event_name: 'Stop' });
  assert.equal(e.state, 'waiting_for_user');
  assert.equal(e.detail.reason, 'turn_complete');
});

test('Agent tool spawns and ends a visitor with a matching id', () => {
  const input = { ...base, tool_name: 'Agent', tool_use_id: 'tu1', tool_input: { subagent_type: 'Explore' } };
  const pre = translate({ ...input, hook_event_name: 'PreToolUse' });
  const post = translate({ ...input, hook_event_name: 'PostToolUse' });
  const start = pre.find((e) => e.kind === 'session_start');
  const end = post.find((e) => e.kind === 'session_end');
  assert.equal(start.parent_session, 's1');
  assert.equal(start.session, end.session);
});

test('MCP tools map to searching (browser/web) or running', () => {
  const [web] = translate({ ...base, hook_event_name: 'PreToolUse', tool_name: 'mcp__Claude_Browser__navigate', tool_input: {} });
  const [other] = translate({ ...base, hook_event_name: 'PreToolUse', tool_name: 'mcp__github__create_issue', tool_input: {} });
  assert.equal(web.state, 'searching');
  assert.equal(other.state, 'running');
  assert.equal(other.detail.target, 'create_issue');
});

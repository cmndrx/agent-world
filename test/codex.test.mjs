import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CodexSession, classifyCommand } from '../adapters/codex/translate.mjs';

const meta = (extra = {}) => ({ timestamp: '2026-10-05T12:00:00Z', type: 'session_meta', payload: { id: 'c1', cwd: '/tmp/proj', model_provider: 'openai', ...extra } });
const item = (payload, ordinal = 10) => ({ timestamp: '2026-10-05T12:00:01Z', ordinal, type: 'response_item', payload });
const msg = (payload) => ({ timestamp: '2026-10-05T12:00:02Z', type: 'event_msg', payload });

test('classifyCommand separates reading from running', () => {
  assert.deepEqual(
    [classifyCommand('rg -n foo src').state, classifyCommand('cd x && npm test').target, classifyCommand('pwd; rg --files').target, classifyCommand('git diff').state],
    ['reading', 'npm test', 'rg', 'reading'],
  );
});

test('a turn maps to canonical states', () => {
  const s = new CodexSession();
  const out = [
    meta(),
    msg({ type: 'task_started' }),
    item({ type: 'function_call', name: 'exec_command', arguments: JSON.stringify({ cmd: 'npm test' }) }),
    item({ type: 'custom_tool_call', name: 'apply_patch', input: '*** Begin Patch\n*** Update File: /tmp/proj/src/a.ts\n' }),
    item({ type: 'custom_tool_call', name: 'exec', input: 'text(await tools.exec_command({cmd:"cat README.md"}))' }),
    item({ type: 'web_search_call', action: { query: 'x' } }),
    msg({ type: 'task_complete' }),
  ].flatMap((l) => s.line(l));
  assert.deepEqual(out.map((e) => e.kind === 'state' ? `${e.state}:${e.detail?.target ?? ''}` : e.kind), [
    'session_start', 'thinking:', 'running:npm test', 'editing:src/a.ts', 'reading:cat', 'searching:', 'waiting_for_user:',
  ]);
  assert.equal(out.at(-1).detail.reason, 'turn_complete');
  assert.equal(out[0].ts, '2026-10-05T12:00:00Z', 'keeps the log timestamp');
});

test('repeated identical states are dropped', () => {
  const s = new CodexSession();
  s.line(meta());
  assert.equal(s.line(item({ type: 'reasoning' })).length, 1);
  assert.equal(s.line(item({ type: 'reasoning' })).length, 0);
});

test('sub-agents become visitors and skip forked parent history', () => {
  const s = new CodexSession();
  const start = s.line(meta({ id: 'sub', source: { subagent: { thread_spawn: { parent_thread_id: 'c1', agent_role: 'reviewer' } } }, subagent_history_start_ordinal: 50 }));
  assert.equal(start[0].parent_session, 'c1');
  assert.equal(start[1].detail.target, 'reviewer');
  assert.equal(s.line(item({ type: 'function_call', name: 'exec_command', arguments: '{"cmd":"ls"}' }, 10)).length, 0, 'forked history ignored');
  assert.equal(s.line(item({ type: 'function_call', name: 'exec_command', arguments: '{"cmd":"ls"}' }, 60)).length, 1);
});

test('a helper finishing its task leaves instead of waiting for you', () => {
  const s = new CodexSession();
  s.line(meta({ id: 'sub', parent_thread_id: 'c1' }));
  const out = s.line(msg({ type: 'task_complete' }));
  assert.equal(out[0].kind, 'session_end');
});

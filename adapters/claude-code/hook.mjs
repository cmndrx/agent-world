#!/usr/bin/env node
// Claude Code hook adapter. Claude Code pipes the hook payload (JSON) to stdin;
// we translate it into a canonical Agent World event. Must be fast and never block the agent.

import fs from 'node:fs';
import { pathToFileURL } from 'node:url';
import { emit } from '../emit.mjs';
import { commandTarget } from '../../shared/commands.mjs';
import { projectRoot, relTo as rel } from '../project.mjs';

const READ_TOOLS = new Set(['Read', 'Grep', 'Glob', 'LS', 'NotebookRead']);
const EDIT_TOOLS = new Set(['Edit', 'MultiEdit', 'Write', 'NotebookEdit']);
const WEB_TOOLS = new Set(['WebSearch', 'WebFetch']);
const AGENT_TOOLS = new Set(['Task', 'Agent']);

function domain(url) {
  try {
    return new URL(url).hostname;
  } catch {
    return undefined;
  }
}

function subSessionId(input) {
  const key = input.tool_use_id || JSON.stringify(input.tool_input ?? {});
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (Math.imul(h, 31) + key.charCodeAt(i)) | 0;
  return `${input.session_id}~${(h >>> 0).toString(36)}`;
}

/** Where this Claude Code session runs, from the entrypoint Claude Code sets for hooks. */
export function claudeApp(entrypoint = process.env.CLAUDE_CODE_ENTRYPOINT) {
  const e = String(entrypoint || '').toLowerCase();
  if (e.includes('desktop')) return 'Claude desktop app';
  if (e.includes('vscode')) return 'Claude Code in VS Code';
  if (e.includes('jetbrains')) return 'Claude Code in JetBrains';
  if (e.includes('web') || e.includes('remote')) return 'Claude Code on the web';
  if (e.startsWith('sdk')) return 'Claude Agent SDK';
  if (e === 'cli') return 'Claude Code CLI';
  return 'Claude Code';
}

/** Map a hook payload to zero or more canonical events. Exported for tests. */
export function translate(input) {
  const cwd = input.cwd || process.cwd();
  const project = projectRoot(cwd);
  const base = {
    source: 'claude-code',
    provider: 'anthropic',
    session: input.session_id,
    project,
    app: claudeApp(),
  };
  const state = (s, detail) => ({ ...base, kind: 'state', state: s, detail });
  const ti = input.tool_input || {};
  const tool = input.tool_name;

  switch (input.hook_event_name) {
    case 'SessionStart':
      return [{ ...base, kind: 'session_start' }];
    case 'SessionEnd':
      return [{ ...base, kind: 'session_end' }];
    case 'UserPromptSubmit':
      return [state('thinking', { summary: input.prompt })];
    case 'Notification':
      return [state('waiting_for_user', {
        reason: /permission/i.test(input.message || '') ? 'permission' : 'input',
        // "Claude needs your permission to use Bash" → tool "Bash" (a tool name, safe to keep).
        tool: /\buse ([\w.-]+)/i.exec(input.message || '')?.[1],
        summary: input.message,
      })];
    case 'Stop':
      return [state('waiting_for_user', { reason: 'turn_complete' })];
    case 'PreToolUse': {
      if (READ_TOOLS.has(tool)) return [state('reading', { tool, target: rel(project, ti.file_path || ti.path || ti.notebook_path) ?? ti.pattern })];
      if (EDIT_TOOLS.has(tool)) return [state('editing', { tool, target: rel(project, ti.file_path || ti.notebook_path) })];
      if (tool === 'Bash') return [state('running', { tool, target: commandTarget(ti.command), summary: ti.description || ti.command })];
      if (WEB_TOOLS.has(tool)) return [state('searching', { tool, target: domain(ti.url), summary: ti.query || ti.url })];
      if (AGENT_TOOLS.has(tool)) {
        const target = ti.subagent_type || 'agent';
        return [
          state('delegating', { tool, target, summary: ti.description }),
          { ...base, kind: 'session_start', session: subSessionId(input), parent_session: input.session_id },
          { ...base, kind: 'state', state: 'thinking', session: subSessionId(input), parent_session: input.session_id, detail: { target, summary: ti.description } },
        ];
      }
      if (tool?.startsWith('mcp__')) {
        // mcp__<server>__<tool>: browser/web servers count as searching, everything else as running.
        const [, server = '', name = ''] = tool.split('__');
        const web = /browser|chrome|playwright|web|fetch|navigate/i.test(`${server} ${name}`);
        return [state(web ? 'searching' : 'running', { tool, target: name || server, summary: ti.url })];
      }
      return [state('thinking', { tool })];
    }
    case 'PostToolUse':
    case 'PostToolUseFailure': {
      const failed = input.hook_event_name === 'PostToolUseFailure';
      const events = [];
      if (AGENT_TOOLS.has(tool)) events.push({ ...base, kind: 'session_end', session: subSessionId(input), parent_session: input.session_id });
      events.push(failed ? state('error', { tool, reason: 'tool_failed' }) : state('thinking', { tool }));
      return events;
    }
    default:
      return [];
  }
}

async function main() {
  let raw = '';
  for await (const chunk of process.stdin) raw += chunk;
  try {
    const input = JSON.parse(raw);
    if (!input.session_id) return;
    for (const e of translate(input)) emit(e);
  } catch (err) {
    // Never interfere with the agent. Log to stderr only.
    process.stderr.write(`[agent-world] ${err.message}\n`);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(fs.realpathSync(process.argv[1])).href) main().finally(() => process.exit(0));

// Translate Codex rollout log lines (~/.codex/sessions/**/rollout-*.jsonl) into canonical events.
// Pure and stateful per session file: create one CodexSession per rollout file and feed it lines.

import { commandTarget } from '../../shared/commands.mjs';
import { projectRoot, relTo } from '../project.mjs';

const READ_COMMANDS = new Set(['rg', 'grep', 'cat', 'sed', 'head', 'tail', 'ls', 'find', 'wc', 'nl', 'tree', 'less', 'stat', 'file', 'fd', 'jq']);
const READ_GIT = new Set(['status', 'diff', 'log', 'show', 'blame', 'branch']);

/** Classify a shell command line as reading or running, and name its program. */
export function classifyCommand(cmd) {
  const segments = String(cmd || '')
    .split(/&&|\|\||;|\|/)
    .map((s) => s.trim())
    .filter(Boolean);
  const main = segments.find((s) => !/^(cd|export|set|source|pwd|echo|printf|true|\.)\b/.test(s)) || segments[0] || '';
  const words = main.replace(/^(\w+=\S+\s+)+/, '').split(/\s+/);
  const program = (words[0] || '').split('/').pop();
  const reading = READ_COMMANDS.has(program) || (program === 'git' && READ_GIT.has(words[1]));
  return { state: reading ? 'reading' : 'running', target: commandTarget(cmd) || program || undefined, summary: String(cmd).slice(0, 200) };
}

function patchTarget(patch, root) {
  const m = /\*\*\* (?:Update|Add|Delete) File: (.+)/.exec(String(patch || ''));
  return m ? relTo(root, m[1].trim()) : undefined;
}

function parseArgs(args) {
  if (typeof args !== 'string') return args || {};
  try {
    return JSON.parse(args);
  } catch {
    return {};
  }
}

/** The JS `exec` tool wraps inner tool calls in code; find the first one. */
function innerCall(code) {
  const tool = /tools\.(\w+)\s*\(/.exec(code)?.[1];
  const cmd = /cmd\s*:\s*("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`[^`]*`)/.exec(code)?.[1];
  let cmdText;
  if (cmd) {
    try {
      cmdText = cmd.startsWith('"') ? JSON.parse(cmd) : cmd.slice(1, -1);
    } catch {
      cmdText = cmd.slice(1, -1);
    }
  }
  return { tool, cmd: cmdText };
}

/** Where a Codex session runs, from its session metadata. */
export function codexApp(meta = {}) {
  const o = String(meta.originator || '').toLowerCase();
  const src = typeof meta.source === 'string' ? meta.source : '';
  if (o.includes('chrome')) return 'Codex in Chrome';
  if (o.includes('desktop')) return 'Codex app';
  if (o.includes('tui') || src === 'cli') return 'Codex CLI';
  if (src === 'exec') return 'Codex (automation)';
  if (src === 'vscode') return 'Codex in VS Code';
  return 'Codex';
}

export class CodexSession {
  constructor() {
    this.meta = null;
    this.base = null;
    this.root = null;
    this.historyStart = 0;
    this.last = null; // last emitted state key, to drop repeats
  }

  /**
   * Feed one parsed log line. Returns canonical events (possibly none).
   * Lines before a sub-agent's history start (forked parent history) are ignored.
   */
  line(o) {
    if (!o || typeof o !== 'object') return [];
    const p = o.payload || {};
    const ts = o.timestamp;

    if (o.type === 'session_meta') {
      if (this.meta) return [];
      this.meta = p;
      this.root = projectRoot(p.cwd || '/');
      this.historyStart = p.subagent_history_start_ordinal ?? p.history_start_ordinal ?? 0;
      const spawn = p.source?.subagent?.thread_spawn || {};
      const parent = p.parent_thread_id || spawn.parent_thread_id || null;
      this.base = {
        source: 'codex',
        provider: p.model_provider || 'openai',
        app: codexApp(p),
        session: p.id || p.session_id,
        conversation: { id: p.id || p.session_id },
        project: this.root,
        ...(parent ? { parent_session: parent } : {}),
      };
      const role = p.agent_role || spawn.agent_role || p.agent_nickname || spawn.agent_nickname;
      const events = [{ ...this.base, ts, kind: 'session_start' }];
      if (parent) events.push(this.state(ts, 'thinking', { target: role || 'helper' }, true));
      return events.filter(Boolean);
    }

    if (!this.base) return [];
    if (typeof o.ordinal === 'number' && o.ordinal < this.historyStart) return [];

    const s = (state, detail) => {
      const e = this.state(ts, state, detail);
      return e ? [e] : [];
    };

    if (o.type === 'event_msg') {
      switch (p.type) {
        case 'task_started':
          return s('thinking');
        case 'task_complete':
          // A helper finishing its task is done (it leaves); only the main agent hands the turn to you.
          if (this.base.parent_session) return [this.end(ts)];
          return s('waiting_for_user', { reason: 'turn_complete' });
        case 'turn_aborted':
          return s('waiting_for_user', { reason: 'interrupted' });
        default:
          return [];
      }
    }

    if (o.type !== 'response_item') return [];

    switch (p.type) {
      case 'reasoning':
        return s('thinking');
      case 'message':
      case 'agent_message':
        return p.role === 'assistant' || p.type === 'agent_message' ? s('thinking') : [];
      case 'web_search_call':
        return s('searching', { tool: 'web_search', summary: p.action?.query });
      case 'function_call':
      case 'custom_tool_call':
      case 'local_shell_call':
        return s(...this.toolState(p));
      case 'function_call_output':
      case 'custom_tool_call_output':
        return s('thinking');
      default:
        return [];
    }
  }

  toolState(p) {
    const name = p.name || '';
    const ns = p.namespace || '';
    const args = parseArgs(p.arguments);

    if (p.type === 'local_shell_call') {
      const c = classifyCommand([].concat(p.action?.command || []).join(' '));
      return [c.state, { tool: 'shell', target: c.target, summary: c.summary }];
    }
    if (name === 'exec_command' || name === 'shell') {
      const c = classifyCommand(args.cmd || [].concat(args.command || []).join(' '));
      return [c.state, { tool: name, target: c.target, summary: c.summary }];
    }
    if (name === 'apply_patch') return ['editing', { tool: name, target: patchTarget(p.input || args.input, this.root) }];
    if (name === 'exec') {
      const code = String(p.input || '');
      const inner = innerCall(code);
      if (inner.tool === 'apply_patch' || code.includes('*** Begin Patch')) return ['editing', { tool: 'apply_patch', target: patchTarget(code, this.root) }];
      if (inner.cmd) {
        const c = classifyCommand(inner.cmd);
        return [c.state, { tool: inner.tool || 'exec', target: c.target, summary: c.summary }];
      }
      if (inner.tool && /web|search|fetch/i.test(inner.tool)) return ['searching', { tool: inner.tool }];
      return ['running', { tool: inner.tool || 'exec' }];
    }
    if (name === 'write_stdin' || name === 'wait') return ['running', { tool: name }];
    if (ns === 'web' || name === 'web_search' || name === 'search_query') return ['searching', { tool: name }];
    if (name === 'view_image') return ['reading', { tool: name, target: relTo(this.root, args.path) }];
    if (name === 'update_plan') return ['thinking', { tool: name }];
    if (ns === 'collaboration' || /agent/.test(name)) return ['delegating', { tool: name, target: args.agent_role || args.nickname || args.agent_nickname }];
    if (name.startsWith('request_user_input')) return ['waiting_for_user', { tool: name, reason: 'input' }];
    if (ns.startsWith('mcp__') || name.startsWith('mcp__')) return ['running', { tool: `${ns}.${name}`.replace(/^\./, '') }];
    return ['thinking', { tool: name || undefined }];
  }

  state(ts, state, detail, force = false) {
    const clean = detail ? Object.fromEntries(Object.entries(detail).filter(([, v]) => v != null && v !== '')) : null;
    const key = `${state}|${clean?.target ?? ''}|${clean?.reason ?? ''}`;
    if (!force && key === this.last) return null;
    this.last = key;
    return { ...this.base, ts, kind: 'state', state, detail: clean && Object.keys(clean).length ? clean : null };
  }

  end(ts = new Date().toISOString()) {
    return this.base ? { ...this.base, ts, kind: 'session_end' } : null;
  }
}

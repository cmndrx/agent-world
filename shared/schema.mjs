import { normalizeConversation } from './conversations.mjs';
// Canonical Agent World event schema (v1). Shared by the bridge, adapters, and client.
// See CONCEPT.md → "Event schema".

export const SCHEMA_VERSION = 1;

export const KINDS = ['session_start', 'state', 'session_end'];

export const STATES = [
  'idle',
  'thinking',
  'reading',
  'editing',
  'running',
  'searching',
  'delegating',
  'waiting_for_user',
  'error',
  'done',
];

export const PRIVACY_LEVELS = ['state', 'targets', 'full'];

/** Plumbob color category for a state. `off_duty` is used when no session is attached. */
export function plumbobFor(state) {
  if (state === 'waiting_for_user') return 'waiting';
  if (state === 'error') return 'error';
  if (state === 'off_duty') return 'off_duty';
  return 'working';
}

/** Human-readable label for the thought bubble. Truth only; no flavor text here. */
export const STATE_LABELS = {
  idle: 'Idle',
  thinking: 'Thinking',
  reading: 'Reading',
  editing: 'Editing',
  running: 'Running',
  searching: 'Searching the web',
  delegating: 'Delegating',
  waiting_for_user: 'Needs you',
  error: 'Error',
  done: 'Done',
  off_duty: 'Off duty',
};

/**
 * Validate and normalize a raw event object. Returns `{ ok: true, event }` or `{ ok: false, error }`.
 * Unknown fields are dropped except `x_*` extras.
 */
export function normalizeEvent(raw) {
  if (!raw || typeof raw !== 'object') return { ok: false, error: 'not an object' };
  if (!KINDS.includes(raw.kind)) return { ok: false, error: `bad kind: ${raw.kind}` };
  if (typeof raw.session !== 'string' || !raw.session) return { ok: false, error: 'missing session' };
  if (typeof raw.project !== 'string' || !raw.project) return { ok: false, error: 'missing project' };
  if (raw.kind === 'state' && !STATES.includes(raw.state)) return { ok: false, error: `bad state: ${raw.state}` };

  const ts = raw.ts ? Date.parse(raw.ts) : NaN;
  const event = {
    v: SCHEMA_VERSION,
    ts: Number.isFinite(ts) ? new Date(ts).toISOString() : new Date().toISOString(),
    kind: raw.kind,
    source: typeof raw.source === 'string' ? raw.source : 'unknown',
    provider: typeof raw.provider === 'string' ? raw.provider : 'unknown',
    // Which app the session runs in, in plain words ("Claude desktop app", "Codex CLI"). Optional.
    app: typeof raw.app === 'string' && raw.app ? raw.app.slice(0, 60) : null,
    conversation: normalizeConversation(raw.conversation, raw.source, raw.session),
    project_name: typeof raw.project_name === 'string' ? raw.project_name.slice(0, 100) : null,
    session: raw.session,
    parent_session: typeof raw.parent_session === 'string' ? raw.parent_session : null,
    project: raw.project,
    state: raw.kind === 'state' ? raw.state : null,
    detail: normalizeDetail(raw.detail),
  };
  for (const [k, v] of Object.entries(raw)) if (k.startsWith('x_')) event[k] = v;
  return { ok: true, event };
}

function normalizeDetail(d) {
  if (!d || typeof d !== 'object') return null;
  const out = {};
  for (const key of ['tool', 'target', 'summary', 'reason']) {
    if (typeof d[key] === 'string' && d[key]) out[key] = d[key].slice(0, 500);
  }
  return Object.keys(out).length ? out : null;
}

/**
 * Reduce `detail` to what the privacy level allows. Adapters call this before writing,
 * so sensitive data never reaches disk unless the user opted in.
 */
export function redactDetail(detail, privacy) {
  if (!detail) return null;
  if (privacy === 'state') return detail.reason ? { reason: detail.reason } : null;
  if (privacy === 'targets') {
    const { summary, ...rest } = detail;
    return Object.keys(rest).length ? rest : null;
  }
  return detail;
}

#!/usr/bin/env node
// Codex adapter: tails Codex rollout logs and writes canonical Agent World events.
//
//   node adapters/codex/tail.mjs [--sessions ~/.codex/sessions] [--idle-end-minutes 30]
//
// Codex logs don't record a session end, so a session that has been waiting on you with
// no new writes for --idle-end-minutes is ended here (a heuristic, documented in CONCEPT.md).

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { emit } from '../emit.mjs';
import { CodexSession } from './translate.mjs';

const args = process.argv.slice(2);
const arg = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : fallback;
};
const SESSIONS = path.resolve(arg('sessions', path.join(process.env.CODEX_HOME || path.join(os.homedir(), '.codex'), 'sessions')));
const IDLE_END_MS = Number(arg('idle-end-minutes', 30)) * 60_000;
const ACTIVE_MS = Number(arg('active-minutes', 180)) * 60_000;
const TAIL_BYTES = 512 * 1024;
const QUIET = args.includes('--quiet');

const files = new Map(); // path -> { offset, remainder, session, mtime, ended, started }

function walk(dir, out = []) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (e.name.endsWith('.jsonl')) out.push(p);
  }
  return out;
}

function readRange(file, start, end) {
  const fd = fs.openSync(file, 'r');
  try {
    const buf = Buffer.alloc(Math.max(0, end - start));
    fs.readSync(fd, buf, 0, buf.length, start);
    return buf.toString('utf8');
  } finally {
    fs.closeSync(fd);
  }
}

/** First line holds session_meta (can be large: it embeds base instructions). */
function readFirstLine(file, size) {
  let end = Math.min(size, 64 * 1024);
  while (true) {
    const text = readRange(file, 0, end);
    const nl = text.indexOf('\n');
    if (nl >= 0) return { line: text.slice(0, nl), bytes: Buffer.byteLength(text.slice(0, nl + 1)) };
    if (end >= size || end > 8 * 1024 * 1024) return null;
    end = Math.min(size, end * 2);
  }
}

function parse(line) {
  try {
    return JSON.parse(line);
  } catch {
    return null;
  }
}

function send(events) {
  for (const e of events) {
    try {
      emit(e);
    } catch (err) {
      if (!QUIET) console.warn('[codex]', err.message);
    }
  }
}

/** Begin tracking a file. With `catchUp`, rebuild its current state from the tail of the file. */
function track(file, stat, { catchUp }) {
  const t = { offset: stat.size, remainder: '', session: new CodexSession(), mtime: stat.mtimeMs, ended: false, started: false };
  files.set(file, t);
  if (!catchUp) return t;

  const first = readFirstLine(file, stat.size);
  if (!first) return t;
  const meta = t.session.line(parse(first.line));
  if (!meta.length) return t;

  // Fold the tail of the file to find the current state; emit only start + latest state.
  const from = Math.max(first.bytes, stat.size - TAIL_BYTES);
  const lines = readRange(file, from, stat.size).split('\n');
  if (from > first.bytes) lines.shift(); // partial line
  let latest = null;
  for (const l of lines) {
    for (const e of t.session.line(parse(l))) if (e.kind === 'state') latest = e;
  }
  const waitingTooLong = latest?.state === 'waiting_for_user' && Date.now() - stat.mtimeMs > IDLE_END_MS;
  if (waitingTooLong) {
    // Tell the bridge too, in case it still remembers this session from earlier events.
    t.ended = true;
    send([t.session.end()]);
    return t;
  }
  t.started = true;
  send([...meta.filter((e) => e.kind === 'session_start'), ...(latest ? [latest] : [])]);
  if (!QUIET) console.log(`[codex] following ${path.basename(file)} (${t.session.base.project}) → ${latest?.state ?? 'started'}`);
  return t;
}

function readNew(file) {
  let stat;
  try {
    stat = fs.statSync(file);
  } catch {
    files.delete(file);
    return;
  }
  let t = files.get(file);
  if (!t) {
    // A brand-new rollout file: read it from the start.
    t = track(file, { size: 0, mtimeMs: stat.mtimeMs }, { catchUp: false });
  }
  if (stat.size < t.offset) t.offset = 0;
  if (stat.size === t.offset) return;
  if (!t.session.meta && t.offset > 0) {
    // An old file was resumed: we skipped its contents at startup, so load its session_meta now.
    const first = readFirstLine(file, stat.size);
    if (first) t.session.line(parse(first.line));
  }

  const text = t.remainder + readRange(file, t.offset, stat.size);
  t.offset = stat.size;
  t.mtime = stat.mtimeMs;
  const lines = text.split('\n');
  t.remainder = lines.pop();

  const out = [];
  for (const l of lines) {
    const events = t.session.line(parse(l));
    if (!events.length) continue;
    if (!t.started || t.ended) {
      // Resumed or newly seen: (re)announce the session before its first state.
      if (!events.some((e) => e.kind === 'session_start') && t.session.base) out.push({ ...t.session.base, ts: events[0].ts, kind: 'session_start' });
      t.started = true;
      t.ended = false;
    }
    out.push(...events);
  }
  send(out);
}

function sweep() {
  const now = Date.now();
  for (const [file, t] of files) {
    if (!t.started || t.ended) continue;
    const waiting = t.session.last?.startsWith('waiting_for_user');
    if (waiting && now - t.mtime > IDLE_END_MS) {
      const e = t.session.end();
      if (e) send([e]);
      t.ended = true;
      if (!QUIET) console.log(`[codex] ended idle session ${path.basename(file)}`);
    }
  }
}

function fullScan() {
  for (const file of walk(SESSIONS)) {
    if (!files.has(file)) {
      try {
        const stat = fs.statSync(file);
        // Files we haven't seen since startup are new: read them in full.
        if (stat.mtimeMs > startedAt) readNew(file);
        else track(file, stat, { catchUp: false });
      } catch {}
    } else {
      readNew(file);
    }
  }
  sweep();
}

const startedAt = Date.now();
if (!fs.existsSync(SESSIONS)) {
  console.log(`[codex] ${SESSIONS} not found; waiting for it to appear`);
}
for (const file of walk(SESSIONS)) {
  const stat = fs.statSync(file);
  track(file, stat, { catchUp: Date.now() - stat.mtimeMs < ACTIVE_MS });
}

const dirty = new Set();
try {
  fs.watch(SESSIONS, { recursive: true }, (_type, name) => {
    if (name && String(name).endsWith('.jsonl')) dirty.add(path.join(SESSIONS, String(name)));
  });
} catch {
  // Recursive watch unsupported here; the periodic full scan still works, just slower.
}
setInterval(() => {
  for (const f of dirty) readNew(f);
  dirty.clear();
}, 500);
setInterval(fullScan, 5000);

console.log(`[codex] watching ${SESSIONS}`);

// Tails every *.jsonl file in the events directory and yields canonical events.

import fs from 'node:fs';
import path from 'node:path';
import { normalizeEvent } from '../shared/schema.mjs';

export class Inbox {
  constructor(dir, { onError = () => {} } = {}) {
    this.dir = dir;
    this.onError = onError;
    this.files = new Map(); // name -> { offset, remainder }
  }

  /** Read everything currently on disk. Returns events sorted by timestamp. */
  readAll() {
    const events = [];
    for (const name of this.list()) events.push(...this.readNew(name));
    return events.sort((a, b) => Date.parse(a.ts) - Date.parse(b.ts));
  }

  /** Start watching for appended lines. Calls `onEvent` for each new event. */
  watch(onEvent) {
    const scan = (name) => {
      const names = name ? [name] : this.list();
      for (const n of names) if (n.endsWith('.jsonl')) for (const e of this.readNew(n)) onEvent(e);
    };
    try {
      this.watcher = fs.watch(this.dir, (_type, name) => scan(name ? String(name) : null));
    } catch (err) {
      this.onError(err);
    }
    // fs.watch can miss events on some platforms; a slow poll is the safety net.
    this.poll = setInterval(() => scan(null), 2000);
  }

  close() {
    this.watcher?.close();
    clearInterval(this.poll);
  }

  list() {
    try {
      return fs.readdirSync(this.dir).filter((n) => n.endsWith('.jsonl'));
    } catch {
      return [];
    }
  }

  readNew(name) {
    const file = path.join(this.dir, name);
    let state = this.files.get(name);
    if (!state) this.files.set(name, (state = { offset: 0, remainder: '' }));

    let size;
    try {
      size = fs.statSync(file).size;
    } catch {
      this.files.delete(name);
      return [];
    }
    if (size < state.offset) state.offset = 0; // truncated or replaced
    if (size === state.offset) return [];

    const fd = fs.openSync(file, 'r');
    const buf = Buffer.alloc(size - state.offset);
    fs.readSync(fd, buf, 0, buf.length, state.offset);
    fs.closeSync(fd);
    state.offset = size;

    const text = state.remainder + buf.toString('utf8');
    const lines = text.split('\n');
    state.remainder = lines.pop(); // incomplete last line, if any

    const events = [];
    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const { ok, event, error } = normalizeEvent(JSON.parse(line));
        if (ok) events.push(event);
        else this.onError(new Error(`${name}: ${error}`));
      } catch (err) {
        this.onError(new Error(`${name}: ${err.message}`));
      }
    }
    return events;
  }
}

import { Catalog } from './catalog.mjs';
import { normalizeConversation } from '../shared/conversations.mjs';
// The truth model. Folds canonical events into households (persistent characters per project)
// and live sessions. Contains no flavor: everything here was observed.

import { EventEmitter } from 'node:events';
import path from 'node:path';

const HISTORY_LIMIT = 40;

const NAMES = [
  'Ada', 'Basil', 'Cleo', 'Dexter', 'Edie', 'Felix', 'Gus', 'Hazel', 'Iris', 'Juno',
  'Kit', 'Lola', 'Milo', 'Nell', 'Otto', 'Pip', 'Quinn', 'Rosa', 'Sol', 'Tess',
  'Umi', 'Vera', 'Wren', 'Xavi', 'Yara', 'Zed',
];

export function hash(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export class World extends EventEmitter {
  /**
   * @param {object} opts
   * @param {object} [opts.households] persisted households, keyed by project path
   * @param {number} [opts.staleAfterMs] a session with no events for this long counts as gone
   */
  constructor({ households = {}, catalog = {}, staleAfterMs = 3 * 60 * 60 * 1000 } = {}) {
    super();
    this.catalog = new Catalog(catalog);
    this.households = households;
    this.sessions = new Map();
    this.staleAfterMs = staleAfterMs;
  }

  isLive(s, at = Date.now()) {
    return !s.ended && at - s.lastEventAt < this.staleAfterMs;
  }

  household(project) {
    let h = this.households[project];
    if (!h) {
      h = this.households[project] = { project, name: path.basename(project) || project, characters: [] };
      this.emit('change', { type: 'household', household: h });
    }
    return h;
  }

  /** Find the lowest slot not occupied by a live primary session, creating the character if new. */
  assignSlot(project, at) {
    const h = this.household(project);
    const taken = new Set();
    for (const s of this.sessions.values()) {
      if (s.project === project && s.slot != null && this.isLive(s, at)) taken.add(s.slot);
    }
    let slot = 1;
    while (taken.has(slot)) slot++;
    if (!h.characters.find((c) => c.slot === slot)) {
      const seed = hash(`${project}#${slot}`);
      h.characters.push({ slot, name: this.uniqueName(seed), seed });
      h.characters.sort((a, b) => a.slot - b.slot);
      this.emit('change', { type: 'household', household: h });
    }
    return slot;
  }

  /** A name no other character in the world is using (so "Nell" always means one Sim). */
  uniqueName(seed) {
    const used = new Set(Object.values(this.households).flatMap((h) => h.characters.map((c) => c.name)));
    for (let i = 0; i < NAMES.length; i++) {
      const name = NAMES[(seed + i) % NAMES.length];
      if (!used.has(name)) return name;
    }
    return `${NAMES[seed % NAMES.length]} ${Math.floor(used.size / NAMES.length) + 2}`;
  }

  apply(event) {
    const sourceProject = event.project;
    const linked = this.catalog.projects.get(sourceProject);
    event = { ...event, sourceProject, project: linked?.home || sourceProject,
      conversation: normalizeConversation(event.conversation, event.source, event.session) };
    const c = this.catalog.observe(event);
    if (c) this.emit('change', { type: 'catalog', ...this.catalog.snapshot() });
    if (!this.households[event.project] && !event.parent_session) {
      const h = this.household(event.project);
      if (event.project_name || linked?.name) h.name = event.project_name || linked.name;
    }
    const at = Date.parse(event.ts);
    let s = this.sessions.get(event.session);

    if (event.kind === 'session_end') {
      if (s && !s.ended) this.end(s, 'session_end', event);
      return;
    }

    if (!s || !this.isLive(s, at)) {
      const isVisitor = !!event.parent_session;
      s = {
        session: event.session,
        source: event.source,
        provider: event.provider,
        app: event.app,
        project: event.project,
        sourceProject,
        conversation: c || (event.parent_session ? this.sessions.get(event.parent_session)?.conversation || null : event.conversation),
        parent_session: event.parent_session,
        slot: isVisitor ? null : this.assignSlot(event.project, at),
        state: 'idle',
        detail: null,
        since: event.ts,
        startedAt: event.ts,
        lastEventAt: at,
        ended: false,
        endReason: null,
        history: [],
      };
      if (!isVisitor) this.household(event.project);
      this.sessions.set(s.session, s);
    }

    if (c) s.conversation = c;
    s.lastEventAt = Math.max(s.lastEventAt, at);
    if (event.app && !s.app) s.app = event.app;

    // Collapse repeats (e.g. "thinking" after every tool call): keep the session alive, skip the noise.
    const prev = s.history[s.history.length - 1];
    if (event.kind === 'state' && prev?.kind === 'state' && prev.state === event.state
      && (prev.detail?.target ?? null) === (event.detail?.target ?? null)) {
      return;
    }
    s.history.push(event);
    if (s.history.length > HISTORY_LIMIT) s.history.shift();

    if (event.kind === 'state') {
      if (event.state !== s.state) s.since = event.ts;
      s.state = event.state;
      s.detail = event.detail;
    }

    if (s.slot != null) {
      const c = this.household(s.project).characters.find((c) => c.slot === s.slot);
      if (c) c.lastSeen = event.ts;
    }
    this.emit('change', { type: 'session', session: this.publicSession(s) });
  }

  end(s, reason, event) {
    s.ended = true;
    s.endReason = reason;
    if (event) s.history.push(event);
    this.emit('change', { type: 'session_end', session: s.session, reason });
    // Visitors leave with their parent.
    for (const v of this.sessions.values()) {
      if (v.parent_session === s.session && !v.ended) this.end(v, 'parent_ended');
    }
    this.sessions.delete(s.session);
  }

  /** End sessions that have gone quiet for longer than the stale threshold. */
  sweep(now = Date.now()) {
    for (const s of [...this.sessions.values()]) {
      if (!s.ended && !this.isLive(s, now)) this.end(s, 'stale');
    }
  }

  rename(project, slot, name) {
    const h = this.households[project];
    const c = h?.characters.find((c) => c.slot === slot);
    if (!c) return false;
    c.name = String(name).trim().slice(0, 40) || c.name;
    this.emit('change', { type: 'household', household: h });
    return true;
  }

  publicSession(s) {
    const { ended, endReason, ...rest } = s;
    return rest;
  }

  snapshot(now = Date.now()) {
    return {
      ...this.catalog.snapshot(),
      households: Object.values(this.households),
      sessions: [...this.sessions.values()].filter((s) => this.isLive(s, now)).map((s) => this.publicSession(s)),
    };
  }
}

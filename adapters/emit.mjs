// Shared helper for adapters: append one canonical event to the inbox.
// Each session writes to its own file: events/<source>-<session>.jsonl

import fs from 'node:fs';
import path from 'node:path';
import { normalizeEvent, redactDetail } from '../shared/schema.mjs';
import { ensureHome, eventsDir, readConfig } from '../shared/home.mjs';

const config = readConfig();

export function emit(raw) {
  const { ok, event, error } = normalizeEvent({ ts: new Date().toISOString(), ...raw });
  if (!ok) throw new Error(`invalid event: ${error}`);
  event.detail = redactDetail(event.detail, config.privacy);
  ensureHome();
  const safe = (s) => s.replace(/[^a-zA-Z0-9._-]/g, '_');
  const file = path.join(eventsDir(), `${safe(event.source)}-${safe(event.session)}.jsonl`);
  fs.appendFileSync(file, JSON.stringify(event) + '\n');
  return event;
}

export const privacy = config.privacy;

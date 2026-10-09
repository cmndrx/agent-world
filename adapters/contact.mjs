import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { homeDir } from '../shared/home.mjs';
// Dedicated health leases never enter the activity inbox, city, tasks or queue.
export function observerContact(provider, observer, connected = true, { home = homeDir(), now = Date.now(), pid = null } = {}) {
  if (!['codex', 'claude'].includes(provider)) throw new Error('Unsupported observer');
  const dir = path.join(home, 'connections');
  fs.mkdirSync(dir, { recursive: true });
  const key = createHash('sha256').update(String(observer)).digest('hex');
  const file = path.join(dir, `${provider}-${key}.json`), temp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(temp, JSON.stringify({ v: 1, provider, connected, at: now, pid }));
  fs.renameSync(temp, file);
}

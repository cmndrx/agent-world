import fs from 'node:fs';
import path from 'node:path';
import { CONNECTION_TTL } from '../shared/connections.mjs';
export function readConnections(dir, now = Date.now(), alive = pid => { try { process.kill(pid, 0); return true; } catch { return false; } }) {
  const providers = Object.fromEntries(['codex', 'claude'].map(id => [id, { status: 'disconnected', expiresAt: null }]));
  let names;
  try { names = fs.readdirSync(dir); } catch (e) {
    if (e.code !== 'ENOENT') for (const p of Object.values(providers)) p.status = 'unavailable';
    return { capturedAt: now, providers };
  }
  for (const name of names) {
    if (!/^(codex|claude)-[a-f0-9]{64}\.json$/.test(name)) continue;
    try {
      const c = JSON.parse(fs.readFileSync(path.join(dir, name), 'utf8'));
      if (c.v !== 1 || !CONNECTION_TTL[c.provider] || !name.startsWith(c.provider + '-') || !Number.isFinite(c.at) || c.at > now) continue;
      const expiresAt = c.at + CONNECTION_TTL[c.provider];
      if (c.connected !== true || expiresAt <= now || (c.provider === 'codex' && (!Number.isInteger(c.pid) || c.pid <= 0 || !alive(c.pid)))) continue;
      providers[c.provider] = { status: 'connected', expiresAt: Math.max(expiresAt, providers[c.provider].expiresAt || 0) };
    } catch { /* A missing/invalid lease cannot establish a connection. */ }
  }
  return { capturedAt: now, providers };
}

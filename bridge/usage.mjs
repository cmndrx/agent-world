import {codexCommand} from './providers.mjs';
import { spawn } from 'node:child_process';
import { usageSnapshot } from '../shared/usage.mjs';

// Only initialization and the documented read RPC. Never start a thread/turn,
// refresh/login/logout, consume a reset credit, or expose raw diagnostics/auth.
export function readCodexRpc(method, params, normalize, { spawnChild = spawn, timeoutMs = 10000 } = {}) {
  if(!['account/rateLimits/read','model/list'].includes(method))throw new Error('Unsupported read method.');
  return new Promise(resolve => {
    let child, timer, forceTimer, finished = false, buffer = '';
    const finish = value => {
      if (finished) return; finished = true; clearTimeout(timer);
      if (child) {
        child.stdin.destroy(); child.kill('SIGTERM');
        forceTimer = setTimeout(() => child.kill('SIGKILL'), 1000); forceTimer.unref();
      }
      resolve(value);
    };
    const unavailable = () => finish({ status: 'unavailable', capturedAt: null, buckets: [] });
    const send = message => { if (!finished) child.stdin.write(JSON.stringify(message) + '\n'); };
    try {
      child = spawnChild(codexCommand(), ['app-server', '--listen', 'stdio://'], { stdio: ['pipe', 'pipe', 'ignore'] });
      child.on('error', unavailable);
      child.on('close', () => { clearTimeout(forceTimer); unavailable(); });
      child.stdin.on('error', unavailable);
      child.stdout.on('data', chunk => {
        buffer += chunk.toString();
        if (buffer.length > 1024 * 1024) return unavailable();
        let at;
        while ((at = buffer.indexOf('\n')) >= 0) {
          const line = buffer.slice(0, at); buffer = buffer.slice(at + 1);
          let msg; try { msg = JSON.parse(line); } catch { continue; }
          if (msg.id === 1) {
            if (msg.error || !msg.result) return unavailable();
            send({ method: 'initialized' });
            send({ method, id: 2, ...(params?{params}:{}) });
          } else if (msg.id === 2) {
            if (msg.error || !msg.result) return unavailable();
            return finish(normalize(msg.result));
          }
        }
      });
      timer = setTimeout(unavailable, timeoutMs);
      send({ method: 'initialize', id: 1, params: { clientInfo: { name: 'agent_world_usage', title: 'Agent World usage', version: '0.1.0' } } });
    } catch { unavailable(); }
  });
}

export function readCodexUsage(options={}) {return readCodexRpc('account/rateLimits/read',null,usageSnapshot,options);}

export function usageReader(read = readCodexUsage, now = Date.now) {
  let cached, expires = 0, pending;
  return async () => {
    if (cached && now() < expires) return cached;
    if (!pending) pending = Promise.resolve().then(read).catch(() => ({ status: 'unavailable', capturedAt: null, buckets: [] })).then(value => { cached = value; expires = now() + 60000; return value; }).finally(() => { pending = null; });
    return pending;
  };
}

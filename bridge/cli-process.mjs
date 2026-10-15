// Provider processes use argument arrays, never a shell (prompts/paths may contain metacharacters).
import fs from 'node:fs';
import path from 'node:path';
import { spawn, execFile, execFileSync } from 'node:child_process';
import { promisify } from 'node:util';
import { findCommand } from './providers.mjs';

export function providerInvocation(command, args = [], { env = process.env, platform = process.platform } = {}) {
  const resolved = findCommand(command, env, platform) || command;
  let text;
  try { if (fs.statSync(resolved).isFile()) { const fd=fs.openSync(resolved,'r');try { const buffer=Buffer.alloc(8192);text=buffer.subarray(0,fs.readSync(fd,buffer,0,buffer.length,0)).toString('utf8'); } finally { fs.closeSync(fd); } } } catch {}
  // Native Windows cannot execute Node shebangs; supports our executable fixture scripts too.
  if (text?.split(/\r?\n/, 1)[0] === `#!${process.execPath}` || /^#!\/usr\/bin\/env node\r?$/m.test(text || '') || /\.[cm]?js$/i.test(resolved)) {
    return { command: process.execPath, args: [resolved, ...args] };
  }
  if (platform === 'win32' && /\.(cmd|bat)$/i.test(resolved)) {
    // npm's generated shims name the entry script relative to %dp0%. Execute that
    // script directly with Node so cmd.exe never interprets prompt/path arguments.
    const entries = [...(text || '').matchAll(/"%(?:dp0|~dp0)%?([\\/][^"\r\n]+\.[cm]?js)"/gi)];
    const script = entries.map(m => path.resolve(path.dirname(resolved), ...m[1].split(/[\\/]/).filter(Boolean)))
      .find(file => { try { return fs.statSync(file).isFile(); } catch { return false; } });
    if (!script) throw Error('Unsupported CLI batch launcher. Install the native CLI or configure its Node entry script.');
    return { command: process.execPath, args: [script, ...args] };
  }
  return { command: resolved, args };
}

export function providerEnvironment(env=process.env) {
  // A provider is not an Electron/Node IPC child. Inheriting the bridge channel
  // tells runtimes to initialize an unrelated channel on their own descriptor 3.
  const result={...env};delete result.NODE_CHANNEL_FD;delete result.NODE_CHANNEL_SERIALIZATION_MODE;return result;
}

export function spawnProvider(command, args, options = {}) {
  const invocation = providerInvocation(command, args, options);
  return spawn(invocation.command, invocation.args, { ...options, env:providerEnvironment(options.env), shell: false, windowsHide: true });
}
export function execProvider(command, args, options, callback) {
  const invocation = providerInvocation(command, args, options);
  return execFile(invocation.command, invocation.args, { ...options, env:providerEnvironment(options.env), shell: false, windowsHide: true }, callback);
}
execProvider[promisify.custom] = (command, args, options = {}) => new Promise((resolve, reject) => {
  execProvider(command, args, options, (error, stdout, stderr) => error ? reject(error) : resolve({ stdout, stderr }));
});

export function signalProvider(child, signal, includeExited = false, { platform = process.platform, execute = execFileSync } = {}) {
  if (!child?.pid || (!includeExited && (child.exitCode != null || child.signalCode != null))) return;
  try {
    if (platform === 'win32') execute('taskkill.exe', ['/PID', String(child.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' });
    else process.kill(-child.pid, signal);
  } catch (error) {
    // A process can exit between observation and signalling. Windows taskkill uses exit 128.
    if (error.code !== 'ESRCH' && !(platform === 'win32' && error.status === 128)) throw error;
  }
}

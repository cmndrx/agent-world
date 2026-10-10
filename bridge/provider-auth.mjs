import { execFile } from 'node:child_process';
import { claudeCommand } from './providers.mjs';

// Authentication probes never start an agent turn or return account details.
export function claudeAuth({ command = claudeCommand(), execute = execFile } = {}) {
  return new Promise(resolve => {
    const child = execute(command, ['auth', 'status', '--json'], { encoding: 'utf8', timeout: 15000, maxBuffer: 65536, windowsHide: true, shell: process.platform === 'win32' }, (error, stdout) => {
      let status;
      try { status = JSON.parse(stdout); } catch {}
      if (status?.loggedIn === true && !error) return resolve({ ready: true });
      if (status?.loggedIn === false) return resolve({ ready: false, reason: 'signed-out', message: 'Open Claude Code and sign in, then return here and try Link Claude Code to town again.' });
      console.warn('[auth] Claude status unavailable', { code: error?.code || 'invalid-json', timedOut: !!error?.killed, outputBytes: stdout?.length || 0 });
      const message = error?.code === 'ENOENT'
        ? 'Claude Code is not installed or cannot be found. Install Claude Code, sign in, then try again.'
        : 'We couldn’t check your Claude Code sign-in. Open Claude Code, make sure you’re signed in, then return here and try again.';
      resolve({ ready: false, reason: error?.code === 'ENOENT' ? 'missing' : 'unavailable', message });
    });
    // This is a noninteractive probe. Electron leaves the input pipe open unless
    // explicitly ended; CLI startup can otherwise wait for input until timeout.
    child?.stdin?.end();
  });
}

import os from 'node:os';
import { execProvider } from './cli-process.mjs';
import { claudeCommand } from './providers.mjs';

// Authentication probes never start an agent turn or return account details.
export function claudeAuth({ command = claudeCommand(), execute = execProvider, includeAccount = false } = {}) {
  return new Promise(resolve => {
    const child = execute(command, ['auth', 'status', '--json'], { cwd:os.homedir(), encoding: 'utf8', timeout: 15000, maxBuffer: 65536, windowsHide: true }, (error, stdout) => {
      let status;
      try { status = JSON.parse(stdout); } catch {}
      if (status?.loggedIn === true && !error) return resolve({ ready: true, ...(includeAccount ? {account: safeAccount({email:status.email, method:status.authMethod, plan:status.subscriptionType})} : {}) });
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

// Explicit account UI projection; never return credential or organization fields.
export function safeAccount(value={}) {
  const text=x=>typeof x==='string'?x.replace(/[\x00-\x1f]/g,'').slice(0,254):null;
  return {email:text(value.email),method:text(value.method),plan:text(value.plan)};
}
export function logoutProvider(command,args,{execute=execProvider}={}) {
  return new Promise((resolve,reject)=>{
    const child=execute(command,args,{cwd:os.homedir(),encoding:'utf8',timeout:15000,maxBuffer:65536,windowsHide:true},error=>error?reject(Error('Sign-out failed. Your connection could not be changed.')):resolve());
    child?.stdin?.end();
  });
}

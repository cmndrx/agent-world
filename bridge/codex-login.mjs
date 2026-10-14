import {ClaudeLogin} from './claude-login.mjs';
import {codexCommand} from './providers.mjs';
import {readCodexRpc} from './usage.mjs';
import {safeAccount,logoutProvider} from './provider-auth.mjs';
export function codexAuth(options={}) {
  return readCodexRpc('account/read',{refreshToken:false},r=>r.account
    ?{ready:true,account:safeAccount({email:r.account.email,method:r.account.type,plan:r.account.planType})}
    :{ready:false,reason:'signed-out',message:'Sign in to Codex to use your agents.'},options)
    .then(r=>r.status==='unavailable'?{ready:false,reason:'unavailable',message:'Could not check Codex sign-in. Check the CLI installation and try again.'}:r);
}
export class CodexLogin extends ClaudeLogin {
 constructor({command=codexCommand(),probe=codexAuth,logout=()=>logoutProvider(command,['logout']),...options}={}) {
  super({command,probe,logout,...options});this.loginArgs=['login'];
 }
}
// Approved and queued work must be resolved before shared CLI credentials change.
export function accountBusy(provider,{proposals=[],runs=[]},voice={},computer={}) {
 return [...proposals,...runs].some(r=>(r.provider||'codex')===provider&&['approved','queued','running','interrupted'].includes(r.status))
  || provider==='codex'&&((voice.status&&!['idle','ended','error'].includes(voice.status))||['connecting','approval'].includes(computer.status));
}

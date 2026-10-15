import os from 'node:os';
import {claudeAuth,logoutProvider} from './provider-auth.mjs';
import {claudeCommand} from './providers.mjs';
import {spawnProvider,signalProvider} from './cli-process.mjs';

// Only login state crosses the API. OAuth codes and URLs are never saved/logged.
export class ClaudeLogin {
 constructor({command=claudeCommand(),probe=()=>claudeAuth({command,includeAccount:true}),logout=()=>logoutProvider(command,['auth','logout']),spawn=spawnProvider,timeoutMs=10*60*1000}={}){Object.assign(this,{command,probe,logout,spawn,timeoutMs});this.state={status:'idle'};}
 connected(auth){return {status:'connected',...(auth.account?{account:auth.account}:{})};}
 snapshot(){return {...this.state};}
 async signOut(){if(this.signingOut)return this.signingOut;this.signingOut=(async()=>{if(this.child||this.starting)throw Error('Cancel sign-in before signing out.');if(this.check)await this.check;await this.logout();const auth=await this.probe();if(auth.ready)throw Error('The CLI still reports a signed-in account. Check its authentication configuration.');if(auth.reason!=='signed-out')throw Error('Sign-out could not be verified. Check the connection again.');this.state={status:'signed-out',message:'Signed out. Your chats and projects are kept.'};return this.snapshot();})().finally(()=>this.signingOut=null);return this.signingOut;}
 async read(){
  if(this.signingOut)return this.signingOut;
  if(this.check)return this.check;
  this.check=(async()=>{const auth=await this.probe();if(auth.ready){this.state=this.connected(auth);this.finish();}else if(!this.child&&this.state.status!=='failed')this.state={status:auth.reason==='signed-out'?'signed-out':'unavailable',message:auth.reason==='signed-out'?'Sign in to use your provider with your agents. Your browser will open for approval.':auth.message};return this.snapshot();})().finally(()=>{this.check=null;});return this.check;
 }
 async start(){if(this.signingOut)throw Error('Wait for sign-out to finish.');if(this.starting)return this.starting;
  this.starting=(async()=>{await this.read();if(this.state.status==='connected'||this.child)return this.snapshot();if(this.state.status==='unavailable')throw Error(this.state.message);this.state={status:'waiting',message:'Complete sign-in in your browser, then return here.'};
   try{const child=this.child=this.spawn(this.command,this.loginArgs||['auth','login','--claudeai'],{cwd:os.homedir(),env:{...process.env},stdio:['pipe','pipe','pipe'],detached:process.platform!=='win32'});let tail='';const output=c=>{tail=(tail+c.toString()).slice(-4096);if(/Paste code here/i.test(tail)&&this.child===child)this.state={...this.state,codePrompt:true};};child.stdout.on('data',output);child.stderr.on('data',output);child.stdin.on('error',()=>{});
    child.once('error',()=>{if(this.child!==child)return;this.state={status:'failed',message:'Could not start sign-in. Check CLI installation and try again.'};this.finish();});
    child.once('close',async()=>{if(this.child!==child)return;this.child=null;clearTimeout(this.timer);const auth=await this.probe();this.state=auth.ready?this.connected(auth):{status:'failed',message:'Sign-in did not complete. Try again when ready.'};});
    this.timer=setTimeout(()=>{this.state={status:'failed',message:'Sign-in timed out. Start again when ready.'};this.finish();},this.timeoutMs);this.timer.unref();
   }catch{this.state={status:'failed',message:'Could not start sign-in. Check installation and try again.'};}return this.snapshot();})().finally(()=>{this.starting=null;});return this.starting;
 }
 code(value){if(!this.child||this.state.status!=='waiting'||!this.state.codePrompt)throw Error('No sign-in code is waiting.');if(typeof value!=='string'||!value.trim()||value.length>2048||/[\r\n\x00]/.test(value))throw Error('Enter the single sign-in code from Claude.');this.child.stdin.write(value.trim()+'\n');this.state={status:'waiting',message:'Checking your sign-in…'};return this.snapshot();}
 finish(){clearTimeout(this.timer);const child=this.child;this.child=null;if(child){child.stdin.end();signalProvider(child,'SIGTERM');setTimeout(()=>signalProvider(child,'SIGKILL'),1000).unref();}}
 cancel(){this.finish();this.state={status:'signed-out',message:'Sign-in stopped. Your existing account settings are unchanged.'};return this.snapshot();}
}

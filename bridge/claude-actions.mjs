import {randomBytes,randomUUID} from 'node:crypto';
import {fileURLToPath} from 'node:url';
export const actionCategory=tool=>['Edit','Write','NotebookEdit','MultiEdit'].includes(tool)?'edits':['Bash','PowerShell'].includes(tool)?'commands':null;
export const accessModes=['ask','edits','edits-and-commands','read-only','full'];
export function actionHookSettings(){return {hooks:{PreToolUse:[{matcher:'Bash|PowerShell|Edit|Write|NotebookEdit|MultiEdit',hooks:[{type:'command',command:process.execPath,args:[fileURLToPath(new URL('./claude-action-hook.mjs',import.meta.url))],timeout:210}]}]}};}
export class ClaudeActions {
 constructor({isActive=()=>false,onChange=()=>{},timeoutMs=180000}={}){Object.assign(this,{isActive,onChange,timeoutMs});this.runs=new Map();}
 register(run,mode='ask',cwd=run.project){if(!accessModes.includes(mode))throw Error('Invalid Claude access mode.');const token=randomBytes(32).toString('hex');this.runs.set(run.id,{run,mode,cwd,token,pending:new Map(),denied:false});return token;}
 authorized(token){return [...this.runs.values()].find(s=>s.token===token&&this.isActive(s.run.id));}
 async request(token,input){const s=this.authorized(token),category=actionCategory(input?.tool_name);if(!s||!category||!input.tool_input||typeof input.tool_input!=='object'||Array.isArray(input.tool_input)||Buffer.byteLength(JSON.stringify(input.tool_input))>256*1024)throw Error('Invalid or expired Claude action.');
  // A denied action does not open another route to the same task in this run.
  if(s.denied||s.mode==='read-only')return false;
  if(s.mode==='full'||s.mode==='edits-and-commands'||s.mode==='edits'&&category==='edits')return true;
  if(s.pending.size>=16)return false;
  return new Promise(resolve=>{const id=randomUUID(),timer=setTimeout(()=>this.resolve(s,id,false),this.timeoutMs);timer.unref();s.pending.set(id,{id,tool:input.tool_name,category,input:structuredClone(input.tool_input),cwd:s.cwd,expiresAt:Date.now()+this.timeoutMs,resolve,timer});this.onChange();});
 }
 view(run){const s=this.runs.get(run);return s?[...s.pending.values()].map(({resolve,timer,...a})=>a):[];}
 resolve(s,id,allow){const a=s.pending.get(id);if(!a)return;clearTimeout(a.timer);s.pending.delete(id);if(!allow)s.denied=true;a.resolve(allow);if(!allow)for(const key of [...s.pending.keys()])this.resolve(s,key,false);this.onChange();}
 decide(run,id,allow){const s=this.runs.get(run),a=s?.pending.get(id);if(!a||!this.isActive(run)||a.expiresAt<=Date.now()||typeof allow!=='boolean')throw Error('This Claude action is no longer waiting.');this.resolve(s,id,allow);return {ok:true};}
 end(run){const s=this.runs.get(run);if(!s)return;for(const id of [...s.pending.keys()])this.resolve(s,id,false);s.token=null;this.runs.delete(run);}
 close(){for(const run of [...this.runs.keys()])this.end(run);}
}

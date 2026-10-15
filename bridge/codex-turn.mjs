import {spawnProvider,signalProvider} from './cli-process.mjs';
import {validThread} from '../shared/pass-conversations.mjs';
// Actual app-server turn transport. Only public items and matched browser approvals are exposed.
export class CodexTurn {
 constructor({command,args=[],env,cwd,run,video,onChild=()=>{},onThread=()=>{},onReasoning=()=>{},onModel=()=>{},onApprovalRequest=()=>{},timeoutMs=30*60*1000}={}){Object.assign(this,{command,args,env,cwd,run,video,onChild,onThread,onReasoning,onModel,onApprovalRequest,timeoutMs});this.rpcId=0;this.pending=new Map();this.items=new Map();this.summaries=new Map();this.buffer='';}
 send(value){if(!this.child?.stdin.destroyed)this.child.stdin.write(JSON.stringify(value)+'\n');}
 rpc(method,params){return new Promise((resolve,reject)=>{const id=++this.rpcId;const timer=setTimeout(()=>{this.pending.delete(id);reject(Error('Codex request timed out.'));},25000);timer.unref();this.pending.set(id,{resolve,reject,timer});this.send({id,method,params});});}
 async start({prompt,schema,attachments=[],model,effort}){
  const env={...this.env};for(const k of ['CODEX_APP_TOOLS_PIPE_PATH','CODEX_INTERNAL_ORIGINATOR_OVERRIDE','CODEX_SESSION_ID','CODEX_THREAD_ID','CODEX_PERMISSION_PROFILE','CODEX_TASK_WORKSPACE_VERIFYING_IDENTITY','CODEX_SAGE_BACKFILL_TRACKER_TAB_REUSE','CODEX_CI'])delete env[k];
  const completion=new Promise((resolve,reject)=>{this.resolve=resolve;this.reject=reject;});completion.catch(()=>{});
  this.child=spawnProvider(this.command,[...this.args,'app-server','--listen','stdio://'],{cwd:this.cwd,env,detached:process.platform!=='win32',stdio:['pipe','pipe','pipe']});this.onChild(this.child);this.child.stderr.resume();
  this.child.stdout.on('data',c=>this.read(c));this.child.stdin.on('error',()=>this.fail('Codex connection closed.'));this.child.on('error',()=>this.fail('Codex app-server could not start.'));this.child.on('close',()=>{if(!this.done)this.fail('Codex connection ended before the turn finished.');});
  this.lifetime=setTimeout(()=>this.fail('Codex timed out. Inspect the project before retrying.'),this.timeoutMs);this.lifetime.unref();
  try{
   await this.rpc('initialize',{clientInfo:{name:'agent_world',title:'Agent World',version:'0.1.0'},capabilities:{experimentalApi:true,mcpServerOpenaiFormElicitation:true}});this.send({method:'initialized'});
   const full=this.run.execution?.actionAccess==='full'&&this.run.kind!=='roommate_inspection';const params={cwd:this.cwd,approvalPolicy:full?'never':'on-request',approvalsReviewer:'user',sandbox:full?'danger-full-access':'workspace-write',...(model?{model}:{})};
   const started=await this.rpc(this.run.resumeSession?'thread/resume':'thread/start',{...params,...(this.run.resumeSession?{threadId:this.run.resumeSession,excludeTurns:true}:{ephemeral:process.env.AGENT_WORLD_RUNNER_EPHEMERAL==='1'})});
   this.thread=started.thread.id;if(!validThread(this.thread)||this.run.resumeSession&&this.thread!==this.run.resumeSession)throw Error('Codex returned a different conversation; no fallback started.');this.onThread(this.thread);if(typeof started.model==='string')this.onModel(started.model);
   const input=[{type:'text',text:prompt},...attachments.filter(a=>a.kind==='image').map(a=>({type:'localImage',path:a.path}))];
   const turn=await this.rpc('turn/start',{threadId:this.thread,input,cwd:this.cwd,approvalPolicy:full?'never':'on-request',approvalsReviewer:'user',sandboxPolicy:full?{type:'dangerFullAccess'}:{type:'workspaceWrite',writableRoots:[this.cwd],networkAccess:true},outputSchema:schema,summary:'auto',...(model?{model}:{}),...(effort?{effort}:{})});
   if(this.turn&&turn.turn.id!==this.turn)throw Error('Codex turn identity changed.');this.turn=turn.turn.id;return await completion;
  }catch(e){this.fail(e.message);throw e;}finally{this.cleanup();}
 }
 read(chunk){this.buffer+=chunk.toString();if(this.buffer.length>8*1024*1024){this.fail('Codex response exceeded the transport limit.');return;}let at;while((at=this.buffer.indexOf('\n'))>=0){let m;try{m=JSON.parse(this.buffer.slice(0,at));}catch{}this.buffer=this.buffer.slice(at+1);if(m)this.message(m);}}
 message(m){
  if(!m.method&&this.pending.has(m.id)){const p=this.pending.get(m.id);this.pending.delete(m.id);clearTimeout(p.timer);m.error?p.reject(Error(String(m.error.message||'Codex request failed.').slice(0,1000))):p.resolve(m.result);return;}
  const p=m.params;if(m.id!=null){this.approval(m).catch(()=>this.deny(m));return;}
  if(p?.threadId!==this.thread)return;
  if(m.method==='turn/started'){if(this.turn&&this.turn!==p.turn.id)return;this.turn=p.turn.id;}
  if(p.turnId&&this.turn&&p.turnId!==this.turn)return;
  if(['item/started','item/completed'].includes(m.method)&&p.item){this.items.set(p.item.id,p.item);if(p.item.type==='agentMessage'&&m.method==='item/completed'&&p.item.phase!=='commentary')this.answer=p.item.text;}
  if(m.method==='item/reasoning/summaryTextDelta'){const id=p.itemId+':'+p.summaryIndex;const text=((this.summaries.get(id)||'')+String(p.delta||'')).slice(0,4000);this.summaries.set(id,text);this.onReasoning({id,type:'reasoning',text});}
  if(m.method==='turn/completed'&&(!this.turn||p.turn.id===this.turn)){if(p.turn.status!=='completed')return this.fail(p.turn.error?.message||'Codex turn did not complete.');try{const result=JSON.parse(this.answer||'');this.done=true;this.resolve(result);}catch{this.fail('Codex returned no valid structured response.');}}
 }
 deny(m){if(m.method==='item/tool/requestUserInput'){const answers=Object.fromEntries((m.params?.questions||[]).map(q=>[q.id,{answers:[q.options?.find(o=>/^(Decline|Deny|Cancel)$/i.test(o.label))?.label||'Decline']} ]));this.send({id:m.id,result:{answers}});}else if(m.method==='mcpServer/elicitation/request')this.send({id:m.id,result:{action:'decline',content:null}});else if(m.method==='item/commandExecution/requestApproval'||m.method==='item/fileChange/requestApproval')this.send({id:m.id,result:{decision:'decline'}});else this.send({id:m.id,error:{code:-32601,message:'Unsupported approval. No permission granted.'}});}
 async approval(m){this.onApprovalRequest(m);const p=m.params;if(p?.threadId!==this.thread||p.turnId&&p.turnId!==this.turn||this.done)return this.deny(m);
  const item=this.items.get(p.itemId);const meta=p._meta;const tool=item?.tool||meta?.tool_name||(meta?.codex_approval_kind==='mcp_tool_call'?p.message?.match(/run tool "(click|fill)"\?/i)?.[1]:null);const server=item?.server||p.serverName;const args=item?.arguments||meta?.tool_params;
  if(server!=='agent_world_browser'||!['click','fill'].includes(tool)||!args||typeof args!=='object')return this.deny(m);
  let reply;
  if(m.method==='item/tool/requestUserInput'&&p.questions?.length===1){const q=p.questions[0];const allow=q.options?.find(o=>/^(Accept|Allow once|Approve once|Allow|Approve)$/i.test(o.label));const deny=q.options?.find(o=>/^(Decline|Deny|Cancel)$/i.test(o.label));if(!allow||!deny)return this.deny(m);reply=ok=>({answers:{[q.id]:{answers:[ok?allow.label:deny.label]}}});}
  else if(m.method==='mcpServer/elicitation/request'&&['form','openai/form','openaiForm'].includes(p.mode)&&Object.keys(p.requestedSchema?.properties||{}).length===0)reply=ok=>({action:ok?'accept':'decline',content:ok?{}:null});
  else return this.deny(m);
  const ok=await this.video.approval(this.run.id,{tool,args,message:String(p.questions?.[0]?.question||p.message||'Codex requests a browser action.').slice(0,1000)});if(!this.done)this.send({id:m.id,result:reply(ok)});
 }
 fail(message){if(this.done)return;this.done=true;this.reject?.(Error(message));for(const p of this.pending.values()){clearTimeout(p.timer);p.reject(Error(message));}this.pending.clear();this.video?.cancelApproval(this.run.id);}
 cleanup(){clearTimeout(this.lifetime);for(const p of this.pending.values()){clearTimeout(p.timer);p.reject(Error('Codex turn ended.'));}this.pending.clear();if(this.child){this.child.stdin.destroy();signalProvider(this.child,'SIGTERM');const child=this.child;setTimeout(()=>signalProvider(child,'SIGKILL'),1000).unref();}}
 stop(){if(this.turn)this.send({id:++this.rpcId,method:'turn/interrupt',params:{threadId:this.thread,turnId:this.turn}});this.fail('Stopped by you.');this.cleanup();}
}

import {spawn} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import os from 'node:os';
import {codexCommand} from './providers.mjs';

// Audio stays in transport memory. Only provider-authored transcript text is recorded.
export class VoiceSession {
  constructor({spawnChild=spawn,command=codexCommand(),onThread=()=>{},onTranscript=()=>{},onFinish=()=>{},timeoutMs=25000}={}){Object.assign(this,{spawnChild,command,onThread,onTranscript,onFinish,timeoutMs});this.state={status:'idle'};this.listeners=new Set();this.events=[];this.sequence=0;}
  snapshot(){return {...this.state};}
  emit(type,value){const event={sequence:++this.sequence,type,...value};this.events.push(event);while(this.events.length>64)this.events.shift();for(const f of this.listeners)f(event);}
  start({project,slot,thread,model,effort,ephemeral=false}){
    if(['connecting','live','approval'].includes(this.state.status))throw new Error('End the current voice call first.');
    this.state={id:randomUUID(),project,slot,thread:thread||null,status:'connecting',message:'Connecting to Codex voice…'};this.events=[];this.sequence=0;this.thread=null;this.turn=null;this.lastTranscript=null;this.items=new Map();this.requests=new Map();this.pending=new Map();this.rpcId=0;this.buffer='';const id=this.state.id;this.disconnect=setTimeout(()=>this.stop(),this.timeoutMs+5000);this.disconnect.unref?.();this.connect({project,thread,model,effort,ephemeral}).catch(e=>{if(this.state.id===id)this.finish('error',e.message);});return this.snapshot();
  }
  send(m){if(this.child?.stdin.writable)this.child.stdin.write(JSON.stringify(m)+'\n');}
  rpc(method,params){return new Promise((resolve,reject)=>{const id=++this.rpcId;const timer=setTimeout(()=>{this.pending.delete(id);reject(new Error('Codex voice request timed out.'));},this.timeoutMs);timer.unref?.();this.pending.set(id,{resolve,reject,timer});this.send({id,method,params});});}
  async connect({project,thread,model,effort,ephemeral}){
    const id=this.state.id;const finish=(status,message)=>{if(this.state.id===id)this.finish(status,message);};const env={...process.env};for(const key of ['CODEX_APP_TOOLS_PIPE_PATH','CODEX_INTERNAL_ORIGINATOR_OVERRIDE','CODEX_SESSION_ID','CODEX_THREAD_ID','CODEX_PERMISSION_PROFILE','CODEX_TASK_WORKSPACE_VERIFYING_IDENTITY','CODEX_CI'])delete env[key];
    this.child=this.spawnChild(this.command,['--disable','shell_snapshot','app-server','--listen','stdio://'],{cwd:os.tmpdir(),env,stdio:['pipe','pipe','pipe']});
    this.child.stderr?.resume();this.child.stdin.on('error',()=>finish('error','Codex voice connection closed.'));
    this.child.on('error',()=>finish('error','Could not start Codex. Check installation and sign-in.'));
    this.child.on('close',()=>{if(['connecting','live','approval'].includes(this.state.status))finish('error','Codex voice connection closed.');});
    this.child.stdout.on('data',c=>{if(this.state.id===id)this.read(c);});
    await this.rpc('initialize',{clientInfo:{name:'agent_world_voice',title:'Agent World voice',version:'0.1.0'},capabilities:{experimentalApi:true}});this.send({method:'initialized'});
    const settings={cwd:project,approvalPolicy:'on-request',approvalsReviewer:'user',sandbox:'workspace-write',config:{'sandbox_workspace_write.network_access':true,web_search:'live',...(effort?{model_reasoning_effort:effort}:{})},...(model?{model}:{})};
    const result=await this.rpc(thread?'thread/resume':'thread/start',{...settings,...(thread?{threadId:thread,excludeTurns:true}:{ephemeral})});
    if(thread&&result.thread.id!==thread)throw new Error('Codex returned a different conversation. Voice was not started.');
    if(this.state.id!==id||this.state.status!=='connecting')return;
    this.thread=result.thread.id;this.state.thread=this.thread;this.onThread(this.snapshot());
    await this.rpc('thread/realtime/start',{threadId:this.thread,outputModality:'audio',transport:{type:'websocket'},realtimeStartInstructions:'The human is speaking to this agent through Agent World. Treat their spoken requests as instructions for this conversation. Give concise spoken progress and answers. Preserve existing project instructions and permission approvals. Do not invent activity, automatically execute suggested future work, or mark your own work accepted.'});
    if(this.state.id===id&&this.state.status==='connecting'){this.state={...this.state,status:'live',message:'Voice session started'};this.emit('state',this.snapshot());}
    this.lifetime=setTimeout(()=>this.stop(),30*60*1000);this.lifetime.unref?.();
  }
  audio(audio){
    if(this.state.status!=='live')throw new Error('Voice is not listening.');
    if(!audio||typeof audio.data!=='string'||audio.data.length>128000||!audio.data||!/^[A-Za-z0-9+/]*={0,2}$/.test(audio.data)||audio.numChannels!==1||!Number.isInteger(audio.sampleRate)||audio.sampleRate<8000||audio.sampleRate>48000)throw new Error('Invalid microphone audio.');
    const bytes=Buffer.from(audio.data,'base64');if(bytes.length%2||audio.samplesPerChannel!==bytes.length/2)throw new Error('Invalid microphone sample count.');
    return this.rpc('thread/realtime/appendAudio',{threadId:this.thread,audio:{...audio,itemId:null}});
  }
  read(chunk){
    this.buffer+=chunk.toString();if(this.buffer.length>2*1024*1024)return this.finish('error','Voice response exceeded the transport limit.');
    let n;while((n=this.buffer.indexOf('\n'))>=0){let m;try{m=JSON.parse(this.buffer.slice(0,n));}catch{}this.buffer=this.buffer.slice(n+1);if(!m)continue;
      if(this.pending.has(m.id)){const p=this.pending.get(m.id);this.pending.delete(m.id);clearTimeout(p.timer);m.error?p.reject(new Error(String(m.error.message||'Voice unavailable.').slice(0,500))):p.resolve(m.result);continue;}
      const p=m.params;if(p?.threadId!==this.thread)continue;
      if(m.id!=null){this.approval(m);continue;}
      if(m.method==='turn/started')this.turn=p.turn?.id;
      if(m.method==='turn/completed')this.turn=null;
      if(m.method==='thread/realtime/outputAudio/delta'){this.emit('audio',{audio:p.audio});}
      else if(m.method==='thread/realtime/transcript/delta'||m.method==='thread/realtime/transcript/done'){
        if(['user','assistant'].includes(p.role)){const done=m.method.endsWith('/done');this.emit('transcript',{role:p.role,text:String(done?p.text:p.delta).slice(0,16000),done});if(done)this.recordTranscript({role:p.role,text:String(p.text).slice(0,16000)});}
      }else if(m.method==='thread/realtime/item/started'&&p.item?.type==='transcriptSegment'){
        this.items.set(p.item.id,p.item.role);
      }else if(m.method==='thread/realtime/item/transcript/delta'){
        const role=this.items.get(p.itemId);if(['user','assistant'].includes(role))this.emit('transcript',{role,text:String(p.delta).slice(0,16000),done:false});
      }else if(m.method==='thread/realtime/item/completed'&&p.item?.type==='transcriptSegment'){
        // Newer CLI versions commit canonical transcript segments instead of flat done events.
        this.items.delete(p.item.id);if(['user','assistant'].includes(p.item.role)&&this.lastTranscript!==p.item.role+'\n'+p.item.text){this.emit('transcript',{role:p.item.role,text:p.item.text,done:true});this.recordTranscript({id:p.item.id,role:p.item.role,text:String(p.item.text).slice(0,16000)});}
      }else if(m.method==='thread/realtime/error')this.finish('error',String(p.message||'Codex voice unavailable.').slice(0,500));
      else if(m.method==='thread/realtime/closed')this.finish('ended',p.reason||'Voice call ended.');
    }
  }
  recordTranscript(item){if(!item.text?.trim())return;const key=item.role+'\n'+item.text;if(this.lastTranscript===key)return;this.lastTranscript=key;this.onTranscript(this.snapshot(),item);}
  approval(m){
    const kind=m.method==='item/commandExecution/requestApproval'?'command':m.method==='item/fileChange/requestApproval'?'files':null;
    if(!kind){this.send({id:m.id,error:{code:-32601,message:'This approval requires a supported client. No permission granted.'}});return;}
    if(this.requests.size){this.send({id:m.id,result:{decision:'decline'}});return;}
    const id=randomUUID();this.requests.set(id,m.id);this.state={...this.state,status:'approval',approval:{id,kind,message:String(m.params.reason||'Codex requests permission.').slice(0,1000),command:String(m.params.command||m.params.grantRoot||'').slice(0,2000)}};this.emit('state',this.snapshot());
  }
  decide(id,allow){const request=this.requests.get(id);if(request==null||this.state.status!=='approval')throw new Error('Voice approval is no longer waiting.');this.requests.delete(id);this.send({id:request,result:{decision:allow?'accept':'decline'}});this.state={...this.state,status:'live',approval:null};this.emit('state',this.snapshot());return this.snapshot();}
  subscribe(listener){for(const e of this.events)listener(e);this.listeners.add(listener);clearTimeout(this.disconnect);return()=>{this.listeners.delete(listener);if(!this.listeners.size){this.disconnect=setTimeout(()=>this.stop(),5000);this.disconnect.unref?.();}};}
  async stop(){if(!['connecting','live','approval'].includes(this.state.status))return this.snapshot();for(const id of this.requests.values())this.send({id,result:{decision:'decline'}});this.requests.clear();if(this.turn)this.send({id:++this.rpcId,method:'turn/interrupt',params:{threadId:this.thread,turnId:this.turn}});if(this.thread)this.send({id:++this.rpcId,method:'thread/realtime/stop',params:{threadId:this.thread}});this.finish('ended','Voice call ended.');return this.snapshot();}
  finish(status,message){if(!['connecting','live','approval'].includes(this.state.status))return;this.state={...this.state,status,message,approval:null};clearTimeout(this.lifetime);clearTimeout(this.disconnect);for(const p of this.pending.values()){clearTimeout(p.timer);p.reject(new Error(message));}this.pending.clear();this.emit('state',this.snapshot());this.onFinish(this.snapshot());const child=this.child;this.child=null;if(child){child.stdin.destroy();child.kill('SIGTERM');const t=setTimeout(()=>child.kill('SIGKILL'),1000);t.unref?.();}}
}

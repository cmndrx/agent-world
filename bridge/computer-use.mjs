import {spawn} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import os from 'node:os';
import {codexCommand} from './providers.mjs';

// A dedicated ephemeral app-server connection, not a model turn. Only native app
// inspection is requested; every approval originates at the provider and requires
// a human response. Never edit the provider's permission files ourselves.
export class ComputerUse {
  constructor({spawnChild=spawn,command=codexCommand(),timeoutMs=180000,startupTimeoutMs=20000,onDiagnostic=()=>{}}={}){Object.assign(this,{spawnChild,command,timeoutMs,startupTimeoutMs,onDiagnostic});this.state={status:'idle'};}
  snapshot(){return {...this.state};}
  start({project,slot,app}){
    if(['connecting','approval'].includes(this.state.status))throw new Error('An app connection is already waiting. Finish or cancel it first.');
    if(typeof app!=='string'||!app.trim()||app.length>200||/[\x00-\x1f]/.test(app))throw new Error('Enter an application name or bundle ID.');
    this.state={id:randomUUID(),project,slot,app:app.trim(),status:'connecting',message:'Starting Codex…'};
    const id=this.state.id;this.connect().catch(e=>{if(this.state.id===id)this.finish('unavailable',e.message);});return this.snapshot();
  }
  send(value){this.child?.stdin.write(JSON.stringify(value)+'\n');}
  rpc(method,params){this.onDiagnostic({direction:'request',method});return new Promise((resolve,reject)=>{const id=++this.sequence;this.pending.set(id,{resolve,reject});this.send({id,method,params});});}
  async connect(){
    const connectionId=this.state.id;const finish=(status,message)=>{if(this.state.id===connectionId)this.finish(status,message);};this.request=null;this.thread=null;this.sequence=0;this.pending=new Map();this.buffer='';
    // A setup connection belongs to Agent World, not to the Codex chat that
    // happened to launch Electron. Setup needs neither project files, shell
    // snapshots nor personal memories. Retain config/runtime paths and credentials,
    // but do not inherit stale thread identity or a parent chat's IPC channel.
    const env={...process.env};
    for(const key of ['CODEX_APP_TOOLS_PIPE_PATH','CODEX_INTERNAL_ORIGINATOR_OVERRIDE','CODEX_SESSION_ID','CODEX_THREAD_ID','CODEX_PERMISSION_PROFILE','CODEX_TASK_WORKSPACE_VERIFYING_IDENTITY','CODEX_SAGE_BACKFILL_TRACKER_TAB_REUSE','CODEX_CI'])delete env[key];
    this.child=this.spawnChild(this.command,['--disable','shell_snapshot','--disable','memories','app-server','--listen','stdio://'],{env,cwd:os.tmpdir(),stdio:['pipe','pipe','pipe']});
    this.child.stderr?.resume(); // Drain diagnostics without retaining provider output or credentials.
    this.child.stdin.on('error',()=>finish('unavailable','Codex connection closed.'));
    this.child.on('error',()=>finish('unavailable','Could not start Codex. Check installation and sign-in.'));
    this.child.on('close',()=>{if(['connecting','approval'].includes(this.state.status))finish('unavailable','Codex connection closed before verification.');});
    this.child.stdout.on('data',chunk=>{if(this.state.id===connectionId)this.read(chunk);});
    this.timer=setTimeout(()=>finish('unavailable','Codex native tools did not finish starting. No app access was granted. Retry or check your installed Codex integration.'),this.startupTimeoutMs);this.timer.unref?.();
    await this.rpc('initialize',{clientInfo:{name:'agent_world',title:'Agent World',version:'0.1.0'},capabilities:{experimentalApi:true,mcpServerOpenaiFormElicitation:true}});
    this.state.message='Preparing native app tools…';this.send({method:'initialized'});
    const started=await this.rpc('thread/start',{cwd:os.tmpdir(),ephemeral:true,approvalPolicy:'on-request',approvalsReviewer:'user',sandbox:'workspace-write'});this.thread=started.thread.id;clearTimeout(this.timer);this.timer=setTimeout(()=>finish('unavailable','App connection timed out. Try again when ready to approve.'),this.timeoutMs);this.timer.unref?.();this.state.message='Requesting native app access…';
    const result=await this.rpc('mcpServer/tool/call',{threadId:this.thread,server:'cua_repl',tool:'js',arguments:{code:`let app = await cua.getApp(${JSON.stringify(this.state.app)});`,title:'Connect an app to Agent World'}});
    // First use returns documentation before the native window state. Inspect
    // every text block; introductory documentation is not an execution failure.
    const texts=(result.content||[]).filter(c=>c.type==='text').map(c=>c.text);
    const window=texts.find(text=>/^Window:/m.test(text));
    if(result.isError||!window){const error=texts.find(text=>/not approved|not allowed|blocked from|server error/i.test(text)&&!text.startsWith('## Computer Use'));
      return finish('unavailable',error?.split('\n')[0]?.slice(0,500)||'No native app interface was returned.');}

    finish('verified','Native app access verified.');
  }
  read(chunk){
    this.buffer+=chunk.toString();if(this.buffer.length>4*1024*1024)return this.finish('unavailable','Codex returned an oversized response.');
    let at;while((at=this.buffer.indexOf('\n'))>=0){const line=this.buffer.slice(0,at);this.buffer=this.buffer.slice(at+1);let m;try{m=JSON.parse(line);}catch{continue;}
      this.onDiagnostic({direction:'response',method:m.method||null,id:m.id??null,error:!!m.error});
      if(m.method&&m.id!=null){
        const p=m.params,meta=p?._meta;
        if(m.method==='mcpServer/elicitation/request'&&p?.threadId===this.thread&&p.serverName==='cua_repl'&&['form','openai/form','openaiForm'].includes(p.mode)&&meta?.connector_id==='computer-use'&&meta.tool_name==='get_app_state'&&typeof meta.tool_params?.app==='string'&&Object.keys(p.requestedSchema?.properties||{}).length===0&&this.request==null){
          this.request=m.id;this.state={...this.state,status:'approval',message:'Waiting for your decision.',approval:{id:randomUUID(),message:String(p.message||'Allow app access?').slice(0,500),app:meta.tool_params.app,subtitle:String(meta.subtitle||'').slice(0,500),risk:String(meta.riskLevel||'').slice(0,50),persist:(Array.isArray(meta.persist)?meta.persist:[]).filter(x=>['session','always'].includes(x))}};
        }else this.send({id:m.id,result:{action:'decline',content:null}});
      }else if(this.pending.has(m.id)){const p=this.pending.get(m.id);this.pending.delete(m.id);m.error?p.reject(new Error(String(m.error.message||'Codex request failed.').slice(0,500))):p.resolve(m.result);}
    }
  }
  decide({id,approvalId,action}){
    if(id!==this.state.id||approvalId!==this.state.approval?.id||this.state.status!=='approval'||this.request==null)throw new Error('This approval is no longer waiting. Retry the connection.');
    if(!['session','always','deny'].includes(action)||action!=='deny'&&!this.state.approval.persist.includes(action))throw new Error('Choose an offered approval option.');
    this.send({id:this.request,result:{action:action==='deny'?'decline':'accept',content:action==='deny'?null:{},...(action==='deny'?{}:{_meta:{persist:action}})}});
    this.request=null;this.state={...this.state,status:'connecting',approval:null,choice:action};return this.snapshot();
  }
  finish(status,message){
    if(!['connecting','approval'].includes(this.state.status))return;
    this.state={...this.state,status,message,approval:null,capturedAt:new Date().toISOString()};clearTimeout(this.timer);
    for(const p of this.pending?.values()||[])p.reject(new Error(message));this.pending?.clear();
    const child=this.child;this.child=null;if(child){child.stdin.destroy();child.kill('SIGTERM');const timer=setTimeout(()=>{try{child.kill('SIGKILL');}catch{}},1000);timer.unref();}
  }
  cancel(){if(this.request!=null)this.send({id:this.request,result:{action:'cancel',content:null}});this.request=null;this.finish('cancelled','Connection cancelled.');return this.snapshot();}
}

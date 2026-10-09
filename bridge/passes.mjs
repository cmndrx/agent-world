import {validateHandoffs,recordHandoffs,reconcileTeam} from './handoffs.mjs';
import {fixedExecution,defaultExecution} from '../shared/execution.mjs';
import {validModel,validEffort,validClaudeModel,validClaudeEffort} from './models.mjs';
import {validThread,threadOwner} from '../shared/pass-conversations.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
const text=(v,n)=>typeof v==='string'?v.trim().slice(0,n):'';
export class PassStore {
  constructor(file) {this.file=file;fs.mkdirSync(path.dirname(file),{recursive:true});}
  snapshot() {try{return JSON.parse(fs.readFileSync(this.file,'utf8'));}catch(e){if(e.code==='ENOENT')return {proposals:[],runs:[]};throw e;}}
  change(fn) {
    const lock=this.file+'.lock';let fd;
    try {fd=fs.openSync(lock,'wx');fs.writeFileSync(fd,String(process.pid));}catch(e){if(e.code==='EEXIST'){const pid=Number(fs.readFileSync(lock,'utf8'));if(Number.isInteger(pid)&&pid>0){try{process.kill(pid,0);}catch(err){if(err.code==='ESRCH'){fs.unlinkSync(lock);return this.change(fn);}}}throw new Error('Pass records are busy. Try again.');}throw e;}
    try {const data=this.snapshot();const result=fn(data);const temp=this.file+'.'+randomUUID()+'.tmp';fs.writeFileSync(temp,JSON.stringify(data,null,2),{mode:0o600});fs.renameSync(temp,this.file);return result;}
    finally{fs.closeSync(fd);fs.unlinkSync(lock);}
  }
  propose(input,homes) {return this.change(data=>{
    if(!Object.hasOwn(homes,input.project))throw new Error('Choose an existing project.');
    const slot=Number(input.slot);if(!Number.isInteger(slot)||slot<1||slot>100)throw new Error('Choose a resident slot.');
    if(Array.isArray(homes[input.project].characters)&&!homes[input.project].characters.some(c=>c.slot===slot))throw new Error('Choose an existing resident.');
    if(!text(input.title,200)||!text(input.instruction,4000))throw new Error('Describe the next pass and its instruction.');
    const current=[...data.proposals].reverse().find(p=>p.project===input.project&&p.slot===slot);
    if(current && input.version!==current.version)throw new Error('The proposal changed. Reopen the card.');
    if(current && ['approved','running'].includes(current.status)&&input.enqueue!==true)throw new Error('This approved pass is already queued or running.');
    if(input.resumeSession!=null&&!validThread(input.resumeSession))throw new Error('Choose a valid conversation.');
    if(input.model!=null&&!validModel(input.model))throw new Error('Choose a valid model.');
    if(input.effort!=null&&!validEffort(input.effort))throw new Error('Choose a valid reasoning effort.');
    const provider=input.provider||'codex';if(!['codex','claude'].includes(provider))throw new Error('Choose Codex or Claude Code.');
    if(input.resumeSession){const owner=threadOwner(data.runs,[],input.project,input.resumeSession,provider);if(owner!=null&&owner!==slot)throw new Error('Conversation does not belong to this agent.');}
    if(provider==='claude'&&input.model&&!validClaudeModel(input.model))throw new Error('Choose a supported Claude model.');
    if(provider==='claude'&&input.effort&&!validClaudeEffort(input.effort))throw new Error('Choose a supported Claude effort level.');
    if(input.isolate!=null&&typeof input.isolate!=='boolean')throw new Error('Choose a valid workspace option.');
    if(input.isolate&&input.resumeSession)throw new Error('Start a new chat to choose an isolated workspace.');
    const attachments=input.attachments||[];if(!Array.isArray(attachments)||attachments.length>4||attachments.some(a=>typeof a.id!=='string'||typeof a.name!=='string'))throw new Error('Choose valid attachments.');
    const execution=fixedExecution(input.execution,provider);
    const dependency=input.enqueue===true&&input.afterProposal?data.proposals.find(p=>p.id===input.afterProposal&&p.project===input.project&&p.slot===slot&&(p.provider||'codex')===provider):null;
    if(input.afterProposal&&!dependency)throw new Error('Choose an existing pending conversation.');
    const proposal={team:Array.isArray(input.team)?input.team:null,enqueue:input.enqueue===true,afterProposal:dependency?.id||null,execution,attachments,isolate:!!input.isolate,model:input.model||null,effort:input.effort||null,resumeSession:input.resumeSession||null,id:randomUUID(),project:input.project,slot,title:text(input.title,200),instruction:text(input.instruction,4000),provider,recordedBy:text(input.recordedBy,100)||'Unspecified',status:'proposed',version:(current?.version||0)+1,createdAt:new Date().toISOString()};
    data.proposals=data.proposals.filter(p=>p!==current||p.teamRoot||['approved','running'].includes(p.status));data.proposals.push(proposal);return proposal;
  });}
  decide(input,homes) {return this.change(data=>{
    const p=data.proposals.find(p=>p.id===input.id);
    if(!p||!Object.hasOwn(homes,p.project)||p.version!==input.version)throw new Error('The proposal changed. Reopen the card.');
    if(!['proposed','paused',...(input.action==='pause'?['approved']:[])].includes(p.status))throw new Error('This pass has already been approved or claimed.');
    if(input.action==='pause'){p.status='paused';}
    else if(input.action==='approve'){
      if(input.confirmed!==true)throw new Error('Confirm this specific instruction before running.');
      const real=fs.realpathSync(p.project);if(!fs.statSync(real).isDirectory())throw new Error('Runner requires a canonical local project directory.');
      if(data.runs.some(r=>r.project===p.project&&(r.status==='interrupted'||(r.status==='running'&&!p.enqueue))))throw new Error('Resolve the previous active or interrupted run first.');
      p.executionProject=real;p.status='approved';p.approvedAt=new Date().toISOString();
    }else throw new Error('Choose approve or pause.');
    p.version++;return p;
  });}
  claim(canRun=()=>true) {return this.change(data=>{
    reconcileTeam(data);
    if(data.runs.some(r=>['running','interrupted'].includes(r.status)))return null;
    for(const q of data.proposals.filter(q=>q.status==='approved'&&q.afterProposal)){
      const prior=data.runs.find(r=>r.proposalId===q.afterProposal);
      if(prior?.conversationSession){q.resumeSession=prior.conversationSession;q.afterProposal=null;}
      else if(prior&& !['running','interrupted'].includes(prior.status)){q.status='paused';q.error='Previous prompt did not establish a conversation. Start a new chat.';}
    }
    const p=data.proposals.find(p=>p.status==='approved'&&!p.afterProposal&&!p.teamDependencies?.length&&canRun(p));if(!p)return null;
    const previous=p.resumeSession?data.runs.find(r=>r.project===p.project&&r.slot===p.slot&&(r.provider||'codex')===(p.provider||'codex')&&r.conversationSession===p.resumeSession&&r.workspace):null;
    const run={teamFromName:p.teamFromName||null,recordedBy:p.recordedBy||null,team:p.team||null,teamRoot:p.teamRoot||null,teamParent:p.teamParent||null,teamDepth:p.teamDepth||0,teamFinal:!!p.teamFinal,teamContext:p.teamContext||[],teamOriginal:p.teamRoot?data.runs.find(r=>r.id===p.teamRoot)?.instruction:null,scheduleId:p.scheduleId||null,scheduledAt:p.scheduledAt||null,execution:defaultExecution(p.provider||'codex'),attachments:p.attachments||[],isolate:!!p.isolate,workspace:previous?.workspace||null,model:p.model||null,effort:p.effort||null,resumeSession:p.resumeSession||null,id:randomUUID(),proposalId:p.id,project:p.project,executionProject:p.executionProject,slot:p.slot,title:p.title,instruction:p.instruction,provider:p.provider,status:'running',startedAt:new Date().toISOString(),approvalVersion:p.version};
    p.status='running';p.version++;data.runs.push(run);return run;
  });}
  voiceStart({project,slot,thread}){return this.change(data=>{
    if(!validThread(thread))throw new Error('Codex did not return a valid conversation.');
    const owner=threadOwner(data.runs,[],project,thread,'codex');if(owner!=null&&owner!==slot)throw new Error('Conversation does not belong to this agent.');
    if(data.runs.some(r=>['running','interrupted'].includes(r.status)))throw new Error('Finish or inspect active work before starting voice.');
    const run={id:randomUUID(),project,slot,provider:'codex',conversationSession:thread,status:'running',voice:true,voiceMessages:[],title:'Voice conversation',startedAt:new Date().toISOString()};data.runs.push(run);return run;
  });}
  voiceTranscript(id,item){if(!['user','assistant'].includes(item?.role)||typeof item.text!=='string'||!item.text.trim())return;item={...item,text:item.text.slice(0,16000)};return this.change(data=>{const run=data.runs.find(r=>r.id===id&&r.voice&&r.status==='running');if(!run)return;const key=item.id||randomUUID();if(run.voiceMessages.some(m=>m.id===key))return;run.voiceMessages.push({id:key,role:item.role,text:item.text});});}
  voiceFinish(id,state){return this.change(data=>{const run=data.runs.find(r=>r.id===id&&r.voice&&r.status==='running');if(run){run.status=state.status==='error'?'failed':'cancelled';run.finishedAt=new Date().toISOString();run.error=state.message;}});}
  observeModel(id,model){if(!validModel(model))return;return this.change(data=>{const r=data.runs.find(r=>r.id===id&&r.status==='running');if(r)r.observedModel=model;});}
  child(id,pid){return this.change(data=>{const r=data.runs.find(r=>r.id===id&&r.status==='running');if(r)r.childPid=pid;});}
  reviewScope(id,scope){return this.change(data=>{const r=data.runs.find(r=>r.id===id&&r.status==='running');if(r)r.reviewScope=scope;});}
  workspace(id,workspace){return this.change(data=>{const r=data.runs.find(r=>r.id===id&&r.status==='running');if(r)r.workspace=workspace;});}
  requestStop(id){return this.change(data=>{const r=data.runs.find(r=>r.id===id&&r.status==='running');if(!r)throw new Error('Run is no longer active.');r.stopRequestedAt ||= new Date().toISOString();return r;});}
  stopTeam(id){return this.change(data=>{
    const target=data.runs.find(r=>r.id===id)||data.proposals.find(p=>p.id===id);if(!target)return;
    const root=data.runs.find(r=>r.id===(target.teamRoot||target.id));if(!root?.teamDelegated)return;
    root.teamStopped=true;const at=new Date().toISOString();
    for(const p of data.proposals.filter(p=>p.teamRoot===root.id&&p.status==='approved')){p.status='cancelled';p.version++;data.runs.push({...p,id:randomUUID(),proposalId:p.id,status:'cancelled',startedAt:at,finishedAt:at,result:null,error:'Team request stopped by you.'});}
    reconcileTeam(data);
  });}
  cancelQueued(id){return this.change(data=>{const p=data.proposals.find(p=>p.id===id&&p.status==='approved');if(!p)throw new Error('Prompt is no longer queued.');p.status='cancelled';p.version++;const at=new Date().toISOString();const r={...p,id:randomUUID(),proposalId:p.id,status:'cancelled',startedAt:at,finishedAt:at,result:null,error:'Cancelled before execution.'};data.runs.push(r);return r;});}
  chatSetting(input){return this.change(data=>{if(!['archive','restore'].includes(input.action))throw new Error('Choose archive or restore.');data.chatSettings ||= [];const previous=data.chatSettings.find(s=>s.project===input.project&&s.slot===input.slot&&s.provider===input.provider&&s.thread===input.thread);const value={project:input.project,slot:input.slot,provider:input.provider,thread:input.thread,archived:input.action==='archive'};if(previous)Object.assign(previous,value);else data.chatSettings.push(value);return value;});}
  conversation(id,session){if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(session||''))return;return this.change(data=>{const r=data.runs.find(r=>r.id===id);if(r){const owner=threadOwner(data.runs.filter(x=>x.id!==id),[],r.project,session,r.provider||'codex');if(owner!=null&&owner!==r.slot)throw new Error('Conversation does not belong to this agent.');r.conversationSession=session;}});}
  reasoning(id,item) {
    if(!item || typeof item.id!=='string' || !item.id || item.id.length>200 || item.type!=='reasoning' || typeof item.text!=='string' || !item.text.trim())return false;
    return this.change(data=>{
      const run=data.runs.find(r=>r.id===id&&r.status==='running'&&r.conversationSession);if(!run)return false;
      const entry={id:item.id,text:item.text.trim().slice(0,4000)};
      run.reasoningSummaries ||= [];
      const previous=run.reasoningSummaries.find(s=>s.id===entry.id);
      if(previous?.text===entry.text)return false;
      if(previous)previous.text=entry.text;else run.reasoningSummaries.push(entry);
      // Public CLI summaries only; bound persisted and SSE payload size per run.
      while(run.reasoningSummaries.length>32 || run.reasoningSummaries.reduce((n,s)=>n+s.text.length,0)>64000)run.reasoningSummaries.shift();
      return true;
    });
  }
  finish(id,status,result,error='') {return this.change(data=>{
    const run=data.runs.find(r=>r.id===id);if(!run||run.status!=='running')throw new Error('Run is no longer active.');
    if(status==='completed')recordHandoffs(data,run,result);
    run.status=status;run.finishedAt=new Date().toISOString();run.result=result;run.error=text(error,500);
    const p=data.proposals.find(p=>p.id===run.proposalId);if(p){p.status=status;p.version++;}
    if(status==='completed'&&!run.team?.length&&result?.next&&!data.proposals.some(q=>q.id!==run.proposalId&&q.project===run.project&&q.slot===run.slot&&['proposed','approved','running'].includes(q.status))){
      const next={execution:run.execution||null,model:run.model||null,effort:run.effort||null,resumeSession:run.conversationSession||run.resumeSession||null,id:randomUUID(),project:run.project,slot:run.slot,title:result.next.title,instruction:result.next.instruction,provider:run.provider||'codex',recordedBy:(run.provider==='claude'?'Claude':'Codex')+' runner',status:'proposed',version:(p?.version||0)+1,createdAt:run.finishedAt};
      data.proposals=data.proposals.filter(q=>!(q.project===run.project&&q.slot===run.slot));data.proposals.push(next);
    }
    reconcileTeam(data);return run;
  });}
  interrupt() {return this.change(data=>{for(const r of data.runs.filter(r=>r.status==='running')){r.status='interrupted';r.error='Runner stopped before a result was recorded. Inspect project files before approving another pass.';const p=data.proposals.find(p=>p.id===r.proposalId);if(p){p.status='interrupted';p.version++;}}});}
  resolve(input) {return this.change(data=>{const r=data.runs.find(r=>r.id===input.id);if(!r||r.status!=='interrupted'||input.confirmed!==true)throw new Error('Confirm inspection of an interrupted run.');if(r.childPid){try{process.kill(r.childPid,0);throw new Error('The previous runner process is still active. Wait before resolving.');}catch(e){if(e.code!=='ESRCH')throw e;}}r.status='failed';r.error='Interrupted run inspected; no automatic retry.';const p=data.proposals.find(p=>p.id===r.proposalId);if(p){p.status='failed';p.error=r.error;p.version++;}reconcileTeam(data);return r;});}
}
export function passResult(value){
  if(!value||typeof value!=='object'||!Object.hasOwn(value,'next')||!text(value.summary,2000)||!Array.isArray(value.checks)||!Array.isArray(value.limitations)||[...value.checks,...value.limitations].some(v=>typeof v!=='string'))throw new Error('Runner did not return a structured result.');
  const next=value.next===null?null:value.next;
  if(next!==null&&(typeof next!=='object'||Array.isArray(next)||!text(next.title,200)||!text(next.instruction,4000)))throw new Error('Invalid next proposal.');
  let findings;if(value.findings!=null){if(!Array.isArray(value.findings)||value.findings.length>30||value.findings.some(f=>!f||!['P0','P1','P2','P3'].includes(f.priority)||!text(f.title,200)||!text(f.body,2000)||!text(f.file,500)||!Number.isInteger(f.line)||f.line<1))throw new Error('Invalid review findings.');findings=value.findings.map(f=>({priority:f.priority,title:text(f.title,200),body:text(f.body,2000),file:text(f.file,500),line:f.line}));}
  const handoffs=validateHandoffs(value.handoffs);
  return {...(handoffs.length?{handoffs}:{}),...(findings?{findings}:{}),summary:text(value.summary,2000),checks:value.checks.slice(0,20).map(v=>text(v,500)),limitations:value.limitations.slice(0,20).map(v=>text(v,500)),next:next?{title:text(next.title,200),instruction:text(next.instruction,4000)}:null};
}

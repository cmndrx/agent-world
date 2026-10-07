import {validModel} from './models.mjs';
import {validThread} from '../shared/pass-conversations.mjs';
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
    if(!text(input.title,200)||!text(input.instruction,4000))throw new Error('Describe the next pass and its instruction.');
    const current=data.proposals.find(p=>p.project===input.project&&p.slot===slot);
    if(current && input.version!==current.version)throw new Error('The proposal changed. Reopen the card.');
    if(current && ['approved','running'].includes(current.status))throw new Error('This approved pass is already queued or running.');
    if(input.resumeSession!=null&&!validThread(input.resumeSession))throw new Error('Choose a valid conversation.');
    if(input.model!=null&&!validModel(input.model))throw new Error('Choose a valid model.');
    const provider=input.provider||'codex';if(!['codex','claude'].includes(provider))throw new Error('Choose Codex or Claude Code.');
    if(provider==='claude'&&input.model)throw new Error('Claude uses its configured default model.');
    const proposal={model:input.model||null,resumeSession:input.resumeSession||null,id:randomUUID(),project:input.project,slot,title:text(input.title,200),instruction:text(input.instruction,4000),provider,recordedBy:text(input.recordedBy,100)||'Unspecified',status:'proposed',version:(current?.version||0)+1,createdAt:new Date().toISOString()};
    data.proposals=data.proposals.filter(p=>p!==current);data.proposals.push(proposal);return proposal;
  });}
  decide(input,homes) {return this.change(data=>{
    const p=data.proposals.find(p=>p.id===input.id);
    if(!p||!Object.hasOwn(homes,p.project)||p.version!==input.version)throw new Error('The proposal changed. Reopen the card.');
    if(!['proposed','paused',...(input.action==='pause'?['approved']:[])].includes(p.status))throw new Error('This pass has already been approved or claimed.');
    if(input.action==='pause'){p.status='paused';}
    else if(input.action==='approve'){
      if(input.confirmed!==true)throw new Error('Confirm this specific instruction before running.');
      const real=fs.realpathSync(p.project);if(!fs.statSync(real).isDirectory())throw new Error('Runner requires a canonical local project directory.');
      if(data.runs.some(r=>r.project===p.project&&['running','interrupted'].includes(r.status)))throw new Error('Resolve the previous active or interrupted run first.');
      p.executionProject=real;p.status='approved';p.approvedAt=new Date().toISOString();
    }else throw new Error('Choose approve or pause.');
    p.version++;return p;
  });}
  claim(canRun=()=>true) {return this.change(data=>{
    if(data.runs.some(r=>['running','interrupted'].includes(r.status)))return null;
    const p=data.proposals.find(p=>p.status==='approved'&&canRun(p));if(!p)return null;
    const run={model:p.model||null,resumeSession:p.resumeSession||null,id:randomUUID(),proposalId:p.id,project:p.project,executionProject:p.executionProject,slot:p.slot,title:p.title,instruction:p.instruction,provider:p.provider,status:'running',startedAt:new Date().toISOString(),approvalVersion:p.version};
    p.status='running';p.version++;data.runs.push(run);return run;
  });}
  child(id,pid){return this.change(data=>{const r=data.runs.find(r=>r.id===id&&r.status==='running');if(r)r.childPid=pid;});}
  conversation(id,session){if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(session||''))return;return this.change(data=>{const r=data.runs.find(r=>r.id===id);if(r)r.conversationSession=session;});}
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
    run.status=status;run.finishedAt=new Date().toISOString();run.result=result;run.error=text(error,500);
    const p=data.proposals.find(p=>p.id===run.proposalId);if(p){p.status=status;p.version++;}
    if(status==='completed'&&result?.next){
      const next={model:run.model||null,resumeSession:run.conversationSession||run.resumeSession||null,id:randomUUID(),project:run.project,slot:run.slot,title:result.next.title,instruction:result.next.instruction,provider:run.provider||'codex',recordedBy:(run.provider==='claude'?'Claude':'Codex')+' runner',status:'proposed',version:(p?.version||0)+1,createdAt:run.finishedAt};
      data.proposals=data.proposals.filter(q=>!(q.project===run.project&&q.slot===run.slot));data.proposals.push(next);
    }
    return run;
  });}
  interrupt() {return this.change(data=>{for(const r of data.runs.filter(r=>r.status==='running')){r.status='interrupted';r.error='Runner stopped before a result was recorded. Inspect project files before approving another pass.';const p=data.proposals.find(p=>p.id===r.proposalId);if(p){p.status='interrupted';p.version++;}}});}
  resolve(input) {return this.change(data=>{const r=data.runs.find(r=>r.id===input.id);if(!r||r.status!=='interrupted'||input.confirmed!==true)throw new Error('Confirm inspection of an interrupted run.');if(r.childPid){try{process.kill(r.childPid,0);throw new Error('The previous runner process is still active. Wait before resolving.');}catch(e){if(e.code!=='ESRCH')throw e;}}r.status='failed';r.error='Interrupted run inspected; no automatic retry.';return r;});}
}
export function passResult(value){
  if(!value||typeof value!=='object'||!Object.hasOwn(value,'next')||!text(value.summary,2000)||!Array.isArray(value.checks)||!Array.isArray(value.limitations)||[...value.checks,...value.limitations].some(v=>typeof v!=='string'))throw new Error('Runner did not return a structured result.');
  const next=value.next===null?null:value.next;
  if(next!==null&&(typeof next!=='object'||Array.isArray(next)||!text(next.title,200)||!text(next.instruction,4000)))throw new Error('Invalid next proposal.');
  return {summary:text(value.summary,2000),checks:value.checks.slice(0,20).map(v=>text(v,500)),limitations:value.limitations.slice(0,20).map(v=>text(v,500)),next:next?{title:text(next.title,200),instruction:text(next.instruction,4000)}:null};
}

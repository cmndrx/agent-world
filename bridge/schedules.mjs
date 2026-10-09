import fs from 'node:fs';
import {randomUUID} from 'node:crypto';
import {defaultExecution} from '../shared/execution.mjs';
import {validModel,validEffort,validClaudeModel,validClaudeEffort} from './models.mjs';
import {validThread} from '../shared/pass-conversations.mjs';
const formatters=new Map();
function parts(at,zone){let f=formatters.get(zone);if(!f){f=new Intl.DateTimeFormat('en-CA',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23',weekday:'short'});formatters.set(zone,f);}return Object.fromEntries(f.formatToParts(new Date(at)).map(p=>[p.type,p.value]));}
const weekdays=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
export function nextTime(spec,after){
 const start=spec.repeat==='once'?Date.parse(spec.date+'T00:00:00Z')-86400000:Math.floor(after/60000)*60000+60000;
 const end=spec.repeat==='once'?start+3*86400000:start+8*86400000;
 const current=parts(after,spec.timeZone),today=`${current.year}-${current.month}-${current.day}`;
 // Calendar-time scan handles UTC offsets and DST without treating a day as 24 hours.
 for(let at=start;at<=end;at+=60000){if(at<=after)continue;const p=parts(at,spec.timeZone),date=`${p.year}-${p.month}-${p.day}`;if(`${p.hour}:${p.minute}`!==spec.time)continue;if(spec.repeat!=='once'&&date===today&&`${current.hour}:${current.minute}`>=spec.time)continue;if(spec.repeat==='once'&&date!==spec.date)continue;if(spec.repeat==='weekly'&&weekdays.indexOf(p.weekday)!==spec.weekday)continue;return new Date(at).toISOString();}
 if(spec.repeat==='once')throw Error('Choose a future date at a valid local time.');throw Error('Could not find the next scheduled time.');
}
export function scheduleSpec(input,now){
 const title=typeof input.title==='string'?input.title.trim():'',instruction=typeof input.instruction==='string'?input.instruction.trim():'';
 if(!instruction||instruction.length>4000||title.length>100)throw Error('Enter instructions (up to 4,000 characters) and a title up to 100 characters.');
 if(!['once','daily','weekly'].includes(input.repeat)||!/^([01]\d|2[0-3]):[0-5]\d$/.test(input.time||''))throw Error('Choose a repeat and time.');
 if(Number(input.time.slice(-2))%15!==0)throw Error('Choose a time in 15-minute increments.');
 try{parts(now,input.timeZone);}catch{throw Error('Choose a valid time zone.');}
 if(typeof input.timeZone!=='string'||!input.timeZone)throw Error('Choose a time zone.');
 if(input.repeat==='weekly'&&(!Number.isInteger(input.weekday)||input.weekday<0||input.weekday>6))throw Error('Choose a weekday.');
 if(input.repeat==='once'&&!/^\d{4}-\d{2}-\d{2}$/.test(input.date||''))throw Error('Choose a date.');
 if(!['codex','claude'].includes(input.provider))throw Error('Choose a provider.');
 if(input.thread&&!validThread(input.thread))throw Error('Choose a valid conversation.');
 if(input.model!=null&&!(input.provider==='claude'?validClaudeModel(input.model):validModel(input.model)))throw Error('Choose a valid model.');
 if(input.effort!=null&&!(input.provider==='claude'?validClaudeEffort(input.effort):validEffort(input.effort)))throw Error('Choose a valid effort.');
 return {teamWork:input.teamWork===true,title:title||instruction.split('\n')[0].slice(0,100),instruction,repeat:input.repeat,time:input.time,timeZone:input.timeZone,date:input.date||null,weekday:input.weekday??null,provider:input.provider,model:input.model||null,effort:input.effort||null,thread:input.thread||null};
}
export class Schedules{
 constructor(store,{now=()=>Date.now(),allowed=()=>null,teamFor=()=>[],onChange=()=>{}}={}){Object.assign(this,{store,now,allowed,teamFor,onChange});}
 mutate(input,authorize){const now=this.now();const result=this.store.change(data=>{
 data.schedules||=[];
 if(input.action==='create'){
  if(input.confirmed!==true)throw Error('Create authorizes the displayed scheduled instructions.');
  if(input.thread)throw Error('Scheduled tasks start their own new conversation.');
  const spec=scheduleSpec({...input,thread:null},now);authorize({...input,...spec});
  const item={...spec,team:spec.teamWork?this.teamFor(input.project):null,dedicated:true,id:randomUUID(),project:input.project,slot:Number(input.slot),status:'active',nextAt:nextTime(spec,now),createdAt:new Date(now).toISOString(),version:1,lastProposalId:null};data.schedules.push(item);return item;
 }
 const item=data.schedules.find(s=>s.id===input.id&&s.project===input.project&&s.slot===Number(input.slot));if(!item||item.version!==input.version)throw Error('Schedule changed. Refresh and try again.');
 if(item.dedicated&&!item.thread){const established=data.runs.find(r=>r.proposalId===item.lastProposalId)?.conversationSession;if(validThread(established))item.thread=established;}
 if(input.action==='update'&&input.provider&&input.provider!==item.provider)throw Error('A scheduled task keeps its provider. Create a new task to use another provider.');
 if(!['pause','resume','delete','update'].includes(input.action))throw Error('Choose a schedule action.');
 const pending=data.proposals.filter(p=>p.scheduleId===item.id&&['approved','running'].includes(p.status));
 if(['update','delete'].includes(input.action)&&pending.some(p=>p.status==='running'))throw Error('Stop or finish the scheduled run before editing or deleting it.');
 if(input.action==='pause'||input.action==='delete'||input.action==='update'){for(const p of pending.filter(p=>p.status==='approved')){p.status='cancelled';p.version++;}}
 if(input.action==='delete'){data.schedules=data.schedules.filter(s=>s!==item);return {deleted:true};}
 if(input.action==='pause'){item.status='paused';item.message='Paused';}
 else{if(input.confirmed!==true)throw Error('Confirm these scheduled instructions.');const spec=input.action==='update'?scheduleSpec({...item,...input,thread:item.dedicated?item.thread:null},now):scheduleSpec({...item,thread:item.dedicated?item.thread:null},now);authorize({...item,...spec});Object.assign(item,spec,{dedicated:true,status:'active',nextAt:nextTime(spec,now),message:'',lastProposalId:null});}
 item.version++;return item;
 });this.onChange();return result;}
 tick(){const now=this.now();const state=this.store.snapshot();if(!state.schedules?.some(s=>s.status==='active'))return;
 let changed=false;this.store.change(data=>{for(const s of data.schedules||[]){if(s.status!=='active')continue;
 const prior=data.runs.find(r=>r.proposalId===s.lastProposalId),q=data.proposals.find(p=>p.id===s.lastProposalId);
 if(prior&&['failed','interrupted','cancelled'].includes(prior.status)){s.status='paused';s.message=`Last run ${prior.status}. Review it before resuming.`;s.version++;changed=true;continue;}
 if(data.proposals.some(p=>p.scheduleId===s.id&&['approved','running'].includes(p.status)))continue;
 if(!s.dedicated){if(s.repeat==='once'&&!s.nextAt)continue;s.thread=null;s.lastProposalId=null;s.dedicated=true;s.version++;changed=true;continue;}
 if(!s.thread&&prior?.conversationSession){s.thread=prior.conversationSession;s.version++;changed=true;}
 if(!s.thread&&prior&&prior.status==='completed'){s.status='paused';s.message='No conversation was established. Review the last run.';s.version++;changed=true;continue;}
 if(!s.nextAt||Date.parse(s.nextAt)>now)continue;
 const blocked=this.allowed(s,data);if(blocked){if(s.message!==blocked){s.message=blocked;changed=true;}continue;}
 let canonical;try{canonical=fs.realpathSync(s.project);if(!fs.statSync(canonical).isDirectory()||canonical!==s.project)throw Error();}catch{if(s.message!=='Project folder unavailable.'){s.message='Project folder unavailable.';changed=true;}continue;}
 const at=new Date(now).toISOString(),current=data.proposals.filter(p=>p.project===s.project&&p.slot===s.slot);const proposal={team:s.team||null,id:randomUUID(),scheduleId:s.id,scheduledAt:s.nextAt,project:s.project,executionProject:canonical,slot:s.slot,provider:s.provider,model:s.model,effort:s.effort,resumeSession:s.thread,enqueue:true,afterProposal:null,execution:defaultExecution(s.provider),attachments:[],isolate:false,title:s.title,instruction:s.instruction,recordedBy:'Human schedule',status:'approved',createdAt:at,approvedAt:at,version:Math.max(0,...current.map(p=>p.version))+1};
 data.proposals.push(proposal);s.lastProposalId=proposal.id;s.lastQueuedAt=at;s.message='Queued';s.nextAt=s.repeat==='once'?null:nextTime(s,now);s.version++;changed=true;
 }});if(changed)this.onChange();}
}

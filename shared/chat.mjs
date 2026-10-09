import {validThread,threadOwner} from './pass-conversations.mjs';

export function runThread(run){
  return validThread(run.conversationSession)?run.conversationSession:validThread(run.resumeSession)?run.resumeSession:null;
}
export function chatArchived(settings,project,slot,provider,thread){return !!settings?.find(s=>s.project===project&&s.slot===slot&&s.provider===provider&&s.thread===thread)?.archived;}
export function chatConversation(conversations,project,thread,provider='codex'){
  if(!validThread(thread))return null;
  return conversations.find(c=>c.source===(provider==='claude'?'claude-code':'codex')&&c.project===project&&c.id===thread)||null;
}
export function chatThreads(runs,project,slot,conversations=[],provider='codex',schedules=[],proposals=[]){
  const threads=new Map();
  for(const run of runs.filter(r=>r.project===project&&r.slot===slot&&(r.provider||'codex')===provider)){
    const id=runThread(run)||(run.teamRoot?'handoff:'+run.proposalId:'unstarted');
    if(!threads.has(id)){const conversation=chatConversation(conversations,project,id,provider);threads.set(id,{id,title:conversation?.title||(run.scheduleId||run.teamRoot?run.title:run.instruction)||run.title||'Conversation',conversation,runs:[]});}
    const thread=threads.get(id);thread.runs.push(run);threads.delete(id);threads.set(id,thread);
  }
  for(const conversation of conversations){
    if(conversation.project!==project||conversation.source!==(provider==='claude'?'claude-code':'codex')||!validThread(conversation.id))continue;
    if(threadOwner(runs,conversations,project,conversation.id,provider)!==slot)continue;
    if(!threads.has(conversation.id))threads.set(conversation.id,{id:conversation.id,title:conversation.title||'Conversation '+conversation.id.slice(0,8),conversation,runs:[]});
  }
  for(const s of schedules.filter(s=>s.dedicated&&s.project===project&&s.slot===slot&&s.provider===provider)){const bound=s.thread||runs.find(r=>r.scheduleId===s.id&&validThread(r.conversationSession))?.conversationSession;if(!bound)threads.set('scheduled:'+s.id,{id:'scheduled:'+s.id,title:s.title,conversation:null,runs:runs.filter(r=>r.scheduleId===s.id),schedule:s});}
  for(const p of proposals.filter(p=>p.teamRoot&&!p.teamFinal&&p.project===project&&p.slot===slot&&(p.provider||'codex')===provider)){if(!runs.some(r=>r.proposalId===p.id)&&!p.resumeSession)threads.set('handoff:'+p.id,{id:'handoff:'+p.id,title:p.title,conversation:null,runs:[],handoff:p});}
  return [...threads.values()].filter(t=>!validThread(t.id)||threadOwner(runs,conversations,project,t.id,provider)===slot).reverse();
}
export function responseText(run){
  if(run.status==='cancelled')return run.error||'Cancelled before execution.';
  if(!run.result){
    const pending=['running','approved'].includes(run.status);
    return [pending?'Working on your message…':'No response was returned for this message.',run.error].filter(Boolean).join('\n\n');
  }
  const {summary,checks=[],limitations=[],next}=run.result;
  return [summary,checks.length?`Checks\n${checks.map(c=>`• ${c}`).join('\n')}`:'',limitations.length?`Limitations\n${limitations.map(c=>`• ${c}`).join('\n')}`:'',next?`Next\n${next.title}\n${next.instruction}`:''].filter(Boolean).join('\n\n');
}
export function chatMessages(runs,proposals){
  const messages=runs.flatMap(run=>run.voice ? [...(run.voiceMessages||[]).map(m=>({...m,id:run.id+'-'+m.id,provider:'codex',voice:true})),...(run.status==='failed'?[{id:run.id+'-error',role:'assistant',text:run.error,failed:true,voice:true}]:[])] : [
    {id:run.id+'-user',role:'user',author:run.teamFinal?'Team report request':run.teamParent?(run.teamFromName||'Teammate')+' · handoff':null,text:run.instruction||run.title||'Prompt text unavailable',execution:run.execution,reviewScope:run.reviewScope,attachments:run.attachments||[]},
    {id:run.id+'-assistant',role:'assistant',runId:run.id,workspace:run.workspace,findings:run.result?.findings,stopping:!!run.stopRequestedAt,provider:run.provider||'codex',text:run.status==='running'&&run.stopRequestedAt?'Stopping this run…':responseText(run),pending:run.status==='running',failed:['failed','interrupted'].includes(run.status),reasoningSummaries:(run.reasoningSummaries||[]).map(s=>({id:s.id,text:s.text}))}
  ]);
  // Approval may be observed before the runner has created its run record.
  for(const proposal of (Array.isArray(proposals)?proposals:[proposals]))if(proposal?.status==='approved'&&!runs.some(r=>r.proposalId===proposal.id)){
    messages.push({id:proposal.id+'-user',role:'user',author:proposal.teamFinal?'Team report request':proposal.teamParent?(proposal.teamFromName||'Teammate')+' · handoff':null,text:proposal.instruction,attachments:proposal.attachments||[]},{id:proposal.id+'-assistant',role:'assistant',provider:proposal.provider||'codex',text:proposal.teamDependencies?.length?'Waiting for prerequisite reports.':'Your message is queued.',pending:true,queued:true});
  }
  return messages;
}

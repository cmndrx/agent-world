import {validThread} from './pass-conversations.mjs';

export function runThread(run){
  return validThread(run.conversationSession)?run.conversationSession:validThread(run.resumeSession)?run.resumeSession:null;
}
export function chatConversation(conversations,project,thread,provider='codex'){
  if(!validThread(thread))return null;
  return conversations.find(c=>c.source===(provider==='claude'?'claude-code':'codex')&&c.project===project&&c.id===thread)||null;
}
export function chatThreads(runs,project,slot,conversations=[],provider='codex'){
  const threads=new Map();
  for(const run of runs.filter(r=>r.project===project&&r.slot===slot&&(r.provider||'codex')===provider)){
    const id=runThread(run)||'unstarted';
    if(!threads.has(id)){const conversation=chatConversation(conversations,project,id,provider);threads.set(id,{id,title:conversation?.title||run.instruction||run.title||'Conversation',conversation,runs:[]});}
    const thread=threads.get(id);thread.runs.push(run);threads.delete(id);threads.set(id,thread);
  }
  return [...threads.values()].reverse();
}
export function responseText(run){
  if(!run.result){
    const pending=['running','approved'].includes(run.status);
    return [pending?'Working on your message…':'No response was returned for this message.',run.error].filter(Boolean).join('\n\n');
  }
  const {summary,checks=[],limitations=[],next}=run.result;
  return [summary,checks.length?`Checks\n${checks.map(c=>`• ${c}`).join('\n')}`:'',limitations.length?`Limitations\n${limitations.map(c=>`• ${c}`).join('\n')}`:'',next?`Next\n${next.title}\n${next.instruction}`:''].filter(Boolean).join('\n\n');
}
export function chatMessages(runs,proposal){
  const messages=runs.flatMap(run=>[
    {id:run.id+'-user',role:'user',text:run.instruction||run.title||'Prompt text unavailable'},
    {id:run.id+'-assistant',role:'assistant',provider:run.provider||'codex',text:responseText(run),pending:run.status==='running',failed:['failed','interrupted'].includes(run.status),reasoningSummaries:(run.reasoningSummaries||[]).map(s=>({id:s.id,text:s.text}))}
  ]);
  // Approval may be observed before the runner has created its run record.
  if(proposal?.status==='approved'&&!runs.some(r=>r.proposalId===proposal.id)){
    messages.push({id:proposal.id+'-user',role:'user',text:proposal.instruction},{id:proposal.id+'-assistant',role:'assistant',provider:proposal.provider||'codex',text:'Your message is queued.',pending:true});
  }
  return messages;
}

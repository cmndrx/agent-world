export const validThread = id => typeof id==='string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
export function residentThread(runs,project,slot,observed,provider='codex'){
 const previous=[...runs].reverse().find(r=>r.project===project&&r.slot===slot&&(r.provider||'codex')===provider&&validThread(r.conversationSession));
 return previous?.conversationSession || (provider==='codex'&&observed?.project===project&&observed?.slot===slot&&observed?.source==='codex'&&validThread(observed.session)?observed.session:null);
}
export function threadBusy(sessions,id){return !!id&&sessions.some(s=>s.session===id&&!['idle','done','waiting_for_user'].includes(s.state));}

// A thread has one owner. Existing run history wins over incidental observer desk allocation.
export function threadOwner(runs,conversations,project,id,provider='codex'){
 const run=runs.find(r=>r.project===project&&(r.provider||'codex')===provider&&(r.conversationSession===id||r.resumeSession===id));
 if(run)return run.slot;
 const source=provider==='claude'?'claude-code':'codex';
 return conversations.find(c=>c.project===project&&c.source===source&&c.id===id)?.residentSlot??null;
}
export function ownsThread(runs,conversations,project,slot,id,provider='codex'){
 return validThread(id)&&threadOwner(runs,conversations,project,id,provider)===slot;
}
export function promptResident(sim){
 const resident=sim.isVisitor?sim.parent:sim;
 return {project:resident.lot.project,slot:resident.character.slot,name:resident.name};
}

export function residentBusy(sessions,project,slot){
 return sessions.some(s=>s.project===project&&s.slot===slot&&threadBusy([s],s.session));
}

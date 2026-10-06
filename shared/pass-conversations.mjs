export const validThread = id => typeof id==='string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
export function residentThread(runs,project,slot,observed){
 const previous=[...runs].reverse().find(r=>r.project===project&&r.slot===slot&&validThread(r.conversationSession));
 return previous?.conversationSession || (observed?.source==='codex'&&validThread(observed.session)?observed.session:null);
}
export function threadBusy(sessions,id){return !!id&&sessions.some(s=>s.session===id&&!['idle','done','waiting_for_user'].includes(s.state));}

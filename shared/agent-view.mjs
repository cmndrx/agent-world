import {STATE_LABELS} from './schema.mjs';

const WORKING=new Set(['thinking','reading','editing','running','searching','delegating']);
export function canPromptFromStatus(truth){return !truth||!WORKING.has(truth.state);}

// Only the observer's state/tool/target metadata is rendered. Never read reasoning content.
export function observedChatActivity(sessions,{project,thread,connected=false,after}={}){
  if(!thread)return null;
  const session=sessions.find(s=>s.session===thread&&s.project===project&&s.source==='codex');
  if(!session)return null;
  const active=WORKING.has(session.state);
  let cutoff=Date.parse(after)||0;
  const history=session.history||[];
  const lastTurn=[...history].reverse().find(e=>e.state==='idle'||(e.state==='waiting_for_user'&&e.detail?.reason==='turn_complete')); // turn boundary (older records used turn_complete)
  if(active&&lastTurn)cutoff=Math.max(cutoff,Date.parse(lastTurn.ts)||0);
  const events=history.filter(e=>e.kind==='state'&&WORKING.has(e.state)&&(Date.parse(e.ts)||0)>=cutoff);
  const current={kind:'state',state:session.state,detail:session.detail,ts:session.history?.at(-1)?.ts||session.since};
  if(active&&(Date.parse(current.ts)||0)>=cutoff&&(!events.length||events.at(-1).state!==current.state||events.at(-1).detail?.tool!==current.detail?.tool||events.at(-1).detail?.target!==current.detail?.target))events.push(current);
  if(after&&!events.length&&active)return {label:'Waiting for this turn’s activity',active:false,thinking:false,connected,steps:[]};
  const label=STATE_LABELS[session.state]||'Activity unavailable';
  return {label:connected?label:`Last known: ${label}`,active:connected&&active,thinking:connected&&session.state==='thinking',connected,steps:events.slice(-6).map(e=>({ts:e.ts,label:[STATE_LABELS[e.state],e.detail?.tool,e.detail?.target].filter(Boolean).join(' · ')}))};
}

// CLI PreToolUse callback. Exact action stays transient; nothing is logged or saved.
import {actionCategory} from './claude-actions.mjs';
let raw='';const decision=(allow,reason)=>({hookSpecificOutput:{hookEventName:'PreToolUse',permissionDecision:allow?'allow':'deny',permissionDecisionReason:reason}});
let result=decision(false,'Agent World approval unavailable. Do not retry or work around this denial.');
try {
 for await(const c of process.stdin){raw+=c;if(Buffer.byteLength(raw)>300*1024)throw Error();}
 const input=JSON.parse(raw);if(!actionCategory(input.tool_name))throw Error();
 const url=new URL(process.env.AGENT_WORLD_ACTION_ENDPOINT);if(url.protocol!=='http:'||!['localhost','127.0.0.1'].includes(url.hostname))throw Error();
 const response=await fetch(url,{method:'POST',headers:{'content-type':'application/json',authorization:'Bearer '+process.env.AGENT_WORLD_ACTION_TOKEN},body:JSON.stringify({tool_name:input.tool_name,tool_input:input.tool_input}),signal:AbortSignal.timeout(200000)});
 const state=await response.json();const allowed=response.ok&&state.allow===true;
 result=decision(allowed,allowed?'Player approved this action in Agent World.':'Action denied, stopped or expired in Agent World. Do not retry or work around this denial.');
}catch{}
process.stdout.write(JSON.stringify(result)+'\n');

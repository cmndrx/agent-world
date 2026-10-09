import fs from 'node:fs';import path from 'node:path';import os from 'node:os';
import {readCodexRpc,usageReader} from './usage.mjs';import {validThread} from '../shared/pass-conversations.mjs';
export const validModel = v=>typeof v==='string'&&/^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,99}$/.test(v);
// Reasoning effort levels Codex accepts for `model_reasoning_effort`.
export const EFFORTS=['none','minimal','low','medium','high','xhigh','max','ultra'];
export const validEffort=v=>EFFORTS.includes(v);
export function modelCatalog(result){return {status:'available',models:(Array.isArray(result?.data)?result.data:[]).filter(m=>validModel(m.model)).map(m=>{const efforts=(Array.isArray(m.supportedReasoningEfforts)?m.supportedReasoningEfforts:[]).filter(e=>validEffort(e?.reasoningEffort)).map(e=>({id:e.reasoningEffort,description:String(e.description||'').slice(0,160)}));return {id:m.model,name:String(m.displayName||m.model).slice(0,100),isDefault:m.isDefault===true,efforts,defaultEffort:validEffort(m.defaultReasoningEffort)?m.defaultReasoningEffort:null};})};}
export const readModels=usageReader(()=>readCodexRpc('model/list',{includeHidden:false},modelCatalog));
// Read only turn_context.model from the matching local rollout, never return chat contents.
export function observedModel(thread,root=path.join(process.env.CODEX_HOME||path.join(os.homedir(),'.codex'),'sessions')){
 if(!validThread(thread))return null;
 function find(dir){let entries;try{entries=fs.readdirSync(dir,{withFileTypes:true});}catch{return null;}for(const e of entries){const f=path.join(dir,e.name);if(e.isDirectory()){const found=find(f);if(found)return found;}else if(e.isFile()&&e.name.endsWith(thread+'.jsonl'))return f;}return null;}
 const file=find(root);if(!file)return null;let fd;
 try{fd=fs.openSync(file,'r');const size=fs.fstatSync(fd).size;const start=Math.max(0,size-8*1024*1024),bytes=Buffer.alloc(size-start);fs.readSync(fd,bytes,0,bytes.length,start);const lines=bytes.toString().split('\n');if(start)lines.shift();for(let i=lines.length-1;i>=0;i--){try{const r=JSON.parse(lines[i]);if(r.type==='turn_context'&&validModel(r.payload?.model))return {thread,model:r.payload.model,capturedAt:r.timestamp||null};}catch{}}}catch{}finally{if(fd!=null)fs.closeSync(fd);}return null;
}

// Stable CLI aliases, not an account-entitlement catalog. Claude checks access on execution.
export const CLAUDE_EFFORTS=['low','medium','high','xhigh','max'];
export const validClaudeEffort=v=>CLAUDE_EFFORTS.includes(v);
const claudeEfforts=CLAUDE_EFFORTS.map(id=>({id,description:({low:'Faster responses with lighter reasoning.',medium:'Balanced reasoning and response time.',high:'More reasoning for complex work.',xhigh:'Extra reasoning for harder work.',max:'Highest requested reasoning effort.'})[id]}));
export const CLAUDE_MODELS=[{id:'sonnet',name:'Claude Sonnet',efforts:claudeEfforts},{id:'opus',name:'Claude Opus',efforts:claudeEfforts},{id:'haiku',name:'Claude Haiku',efforts:claudeEfforts}];
export const validClaudeModel=v=>CLAUDE_MODELS.some(m=>m.id===v);
export function claudeModelCatalog(runs,project,ids){
 const rows=ids.map(thread=>{const matching=runs.filter(r=>r.project===project&&r.provider==='claude'&&(r.conversationSession===thread||r.resumeSession===thread));const actual=[...matching].reverse().find(r=>r.observedModel);return {thread,model:actual?.observedModel||null,requestedModel:matching.at(-1)?.model||null,requestedEffort:matching.at(-1)?.effort||null};});
 return {status:'available',provider:'claude',availability:'cli-aliases',models:CLAUDE_MODELS,efforts:claudeEfforts,observed:rows};
}

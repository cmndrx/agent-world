import test from 'node:test';import assert from 'node:assert/strict';import {CodexTurn} from '../bridge/codex-turn.mjs';
const thread='12345678-1234-1234-1234-123456789abc';
function turn(){const sent=[],approvals=[];const t=new CodexTurn({run:{id:'run'},video:{approval:async(id,a)=>{approvals.push({id,...a});return true;},cancelApproval(){}},onReasoning(){}});t.thread=thread;t.turn='turn';t.send=m=>sent.push(m);return {t,sent,approvals};}
test('only matched task-browser per-action provider requests can be allowed once',async()=>{
 const {t,sent,approvals}=turn();t.items.set('tool',{type:'mcpToolCall',server:'agent_world_browser',tool:'click',arguments:{x:20,y:30}});
 const m={id:99,method:'item/tool/requestUserInput',params:{threadId:thread,turnId:'turn',itemId:'tool',questions:[{id:'q',question:'Allow click?',options:[{label:'Accept'},{label:'Decline'}]}]}};
 await t.approval(m);assert.equal(approvals.length,1);assert.deepEqual(sent[0].result,{answers:{q:{answers:['Accept']}}});
 await t.approval({...m,params:{...m.params,turnId:'different'}});assert.equal(approvals.length,1);assert.deepEqual(sent.at(-1).result,{answers:{q:{answers:['Decline']}}});
 t.items.get('tool').server='other-server';await t.approval(m);assert.equal(approvals.length,1);
});
test('public turn output is exact-thread scoped, structured, and excludes raw reasoning',async()=>{
 const {t}=turn();let result,error,summary;t.resolve=r=>result=r;t.reject=e=>error=e;t.onReasoning=r=>summary=r;
 t.message({method:'item/reasoning/summaryTextDelta',params:{threadId:'other',turnId:'turn',itemId:'r',summaryIndex:0,delta:'Wrong'}});assert.equal(summary,undefined);
 t.message({method:'item/reasoning/summaryTextDelta',params:{threadId:thread,turnId:'turn',itemId:'r',summaryIndex:0,delta:'Public',rawContent:'SECRET'}});assert.equal(summary.text,'Public');
 t.message({method:'item/completed',params:{threadId:thread,turnId:'turn',item:{id:'final',type:'agentMessage',phase:'final_answer',text:'{"summary":"Ready","checks":[],"limitations":[],"next":null}'}}});
 t.message({method:'turn/completed',params:{threadId:thread,turn:{id:'turn',status:'completed'}}});assert.equal(result.summary,'Ready');assert.equal(error,undefined);
});
test('installed CLI form approval without tool_name is bound to the exact own-server action',async()=>{
 const {t,sent,approvals}=turn();await t.approval({id:0,method:'mcpServer/elicitation/request',params:{threadId:thread,turnId:'turn',serverName:'agent_world_browser',mode:'form',_meta:{codex_approval_kind:'mcp_tool_call',tool_params:{x:90,y:333}},message:'Allow the agent_world_browser MCP server to run tool "click"?',requestedSchema:{type:'object',properties:{}}}});assert.equal(approvals[0].tool,'click');assert.deepEqual(sent[0].result,{action:'accept',content:{}});
});

test('Codex app-server applies explicit full access to thread start, resume and turn; defaults stay sandboxed',async t=>{
 const fs=await import('node:fs'),os=await import('node:os'),path=await import('node:path');const dir=fs.mkdtempSync(path.join(os.tmpdir(),'aw-codex-access-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 const cli=path.join(dir,'mock.cjs');fs.writeFileSync(cli,`const fs=require('fs');let raw='';process.stdin.on('data',c=>{raw+=c;let at;while((at=raw.indexOf('\\n'))>=0){const m=JSON.parse(raw.slice(0,at));raw=raw.slice(at+1);if(!m.id)continue;fs.appendFileSync(process.env.FIXTURE_LOG,JSON.stringify(m)+'\\n');const send=v=>console.log(JSON.stringify(v));if(m.method==='thread/start'||m.method==='thread/resume')send({id:m.id,result:{thread:{id:'${thread}'},model:'fixture'}});else if(m.method==='turn/start'){send({id:m.id,result:{turn:{id:'turn'}}});send({method:'item/completed',params:{threadId:'${thread}',turnId:'turn',item:{id:'answer',type:'agentMessage',text:JSON.stringify({summary:'Fixture',checks:[],limitations:[],next:null})}}});send({method:'turn/completed',params:{threadId:'${thread}',turn:{id:'turn',status:'completed'}}});}else send({id:m.id,result:{}});}});`);
 for(const [access,resume] of [['workspace',false],['full',false],['full',true]]){
  const log=path.join(dir,access+resume+'.jsonl'),run={id:access+resume,execution:{actionAccess:access},...(resume?{resumeSession:thread}:{})};const turn=new CodexTurn({command:cli,cwd:dir,run,env:{...process.env,FIXTURE_LOG:log}});const result=await turn.start({prompt:'Fixture only',schema:{type:'object'}});assert.equal(result.summary,'Fixture');const messages=fs.readFileSync(log,'utf8').trim().split('\n').map(JSON.parse),start=messages.find(m=>m.method===('thread/'+(resume?'resume':'start'))).params,next=messages.find(m=>m.method==='turn/start').params;
  assert.equal(start.approvalPolicy,access==='full'?'never':'on-request');assert.equal(start.sandbox,access==='full'?'danger-full-access':'workspace-write');assert.equal(next.approvalPolicy,start.approvalPolicy);assert.equal(next.sandboxPolicy.type,access==='full'?'dangerFullAccess':'workspaceWrite');
 }
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {CodexLogin,codexAuth,accountBusy} from '../bridge/codex-login.mjs';
import {ClaudeLogin} from '../bridge/claude-login.mjs';
import {safeAccount,claudeAuth,logoutProvider} from '../bridge/provider-auth.mjs';

test('account read projects safe Codex identity and handles signed out separately from unavailable',async()=>{
 const probe=result=>codexAuth({spawnChild(){const c=new EventEmitter();c.stdout=new EventEmitter();c.stdin=new EventEmitter();c.stdin.destroy=()=>{};c.kill=()=>{};c.stdin.write=line=>{const m=JSON.parse(line);if(m.id)setImmediate(()=>c.stdout.emit('data',JSON.stringify({id:m.id,result:m.id===1?{}:result})+'\n'));};return c;}});
 const auth=await probe({account:{type:'chatgpt',email:'fixture@example.invalid',planType:'pro',accessToken:'secret',organizationId:'private'}});
 assert.deepEqual(auth,{ready:true,account:{email:'fixture@example.invalid',method:'chatgpt',plan:'pro'}});
 assert.equal((await probe({account:null})).reason,'signed-out');
 assert.equal((await probe({account:{type:'apiKey'}})).account.email,null);
});
test('Claude account fields require explicit opt in; secrets are never projected',async()=>{
 const execute=(_cmd,args,_opts,callback)=>{assert.deepEqual(args,['auth','status','--json']);callback(null,JSON.stringify({loggedIn:true,email:'fixture@example.invalid',authMethod:'claude.ai',subscriptionType:'pro',accessToken:'secret'}));return {stdin:{end(){}}};};
 assert.deepEqual(await claudeAuth({execute}),{ready:true});
 assert.deepEqual((await claudeAuth({execute,includeAccount:true})).account,{email:'fixture@example.invalid',method:'claude.ai',plan:'pro'});
 assert.doesNotMatch(JSON.stringify(safeAccount({email:'e',token:'secret'})),/secret/);
});
test('both providers logout through exact CLI commands and verify auth afterward',async()=>{
 for(const [Controller,args] of [[ClaudeLogin,['auth','logout']],[CodexLogin,['logout']]]){
  let ready=true,calls=0;
  const login=new Controller({command:'fixture',probe:async()=>ready?{ready:true,account:{email:'fixture@example.invalid'}}:{ready:false,reason:'signed-out'},logout:()=>logoutProvider('fixture',args,{execute:(command,actual,opts,done)=>{calls++;assert.equal(command,'fixture');assert.deepEqual(actual,args);ready=false;setImmediate(()=>done(null));return {stdin:{end(){}}};}})});
  assert.equal((await login.read()).account.email,'fixture@example.invalid');
  const states=await Promise.all([login.signOut(),login.signOut()]);assert.equal(calls,1);assert.equal(states[0].status,'signed-out');assert.equal(login.snapshot().account,undefined);
 }
});
test('failed or environment-managed logout does not claim signed out',async()=>{
 const login=new CodexLogin({probe:async()=>({ready:true}),logout:async()=>{}});
 await assert.rejects(login.signOut(),/still reports/);
 const broken=new ClaudeLogin({probe:async()=>({ready:false,reason:'unavailable'}),logout:async()=>{}});
 await assert.rejects(broken.signOut(),/could not be verified/);
});
test('Codex sign-in starts browser login once; exit alone does not establish auth',async()=>{
 let calls=0,child;const login=new CodexLogin({probe:async()=>({ready:false,reason:'signed-out'}),spawn(_command,args){calls++;assert.deepEqual(args,['login']);child=new EventEmitter();for(const key of ['stdout','stderr','stdin'])child[key]=new EventEmitter();child.stdin.end=()=>{};return child;}});
 await Promise.all([login.start(),login.start()]);assert.equal(calls,1);
 await assert.rejects(login.signOut(),/Cancel sign-in/);
 child.emit('close',0);await new Promise(r=>setImmediate(r));assert.equal(login.snapshot().status,'failed');
});
test('logout guards approved queued running and interrupted work for its provider plus Codex connections',()=>{
 for(const status of ['approved','queued','running','interrupted']){
  assert.equal(accountBusy('claude',{runs:[{provider:'claude',status}]}),true);
  assert.equal(accountBusy('codex',{proposals:[{status}]}),true);
  assert.equal(accountBusy('claude',{runs:[{provider:'codex',status}]}),false);
 }
 assert.equal(accountBusy('codex',{runs:[{status:'completed'}]}),false);
 assert.equal(accountBusy('codex',{}, {status:'active'}),true);
 assert.equal(accountBusy('codex',{}, {},{status:'approval'}),true);
 assert.equal(accountBusy('claude',{}, {status:'active'}),false);
});

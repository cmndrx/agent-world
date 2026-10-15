import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { promisify } from 'node:util';
import { once } from 'node:events';
import { providerInvocation, spawnProvider, execProvider, signalProvider } from '../bridge/cli-process.mjs';
import { claudeCommand, installed } from '../bridge/providers.mjs';
import { desktopBuildArgs } from '../scripts/build-app.mjs';
const fixture=t=>{const root=fs.mkdtempSync(path.join(os.tmpdir(),'aw CLI & space '));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));return root;};
test('Windows npm CLI shims resolve through Path without a shell, preserving literal arguments',async t=>{
 const root=fixture(t),script=path.join(root,'node_modules','fixture','cli.cjs');fs.mkdirSync(path.dirname(script),{recursive:true});fs.writeFileSync(script,'console.log(JSON.stringify(process.argv.slice(2)))');
 const shim=path.join(root,'claude.cmd');fs.writeFileSync(shim,'@ECHO off\r\n"%_prog%" "%dp0%\\node_modules\\fixture\\cli.cjs" %*\r\n');
 const opts={platform:'win32',env:{...process.env,PATH:'',Path:`"${root}"`,AGENT_WORLD_CLAUDE_COMMAND:''}};
 assert.equal(claudeCommand({...opts,home:root}),shim);assert.equal(installed('claude',opts),true);
 const args=['a path with spaces','x&echo bad','%USERNAME%','"quoted"','new\nline'];
 assert.deepEqual(providerInvocation(shim,args,opts),{command:process.execPath,args:[script,...args]});
 const child=spawnProvider(shim,args,{...opts,stdio:['ignore','pipe','pipe']});let output='';child.stdout.on('data',c=>output+=c);const [code]=await once(child,'exit');assert.equal(code,0);assert.deepEqual(JSON.parse(output),args);
 const result=await promisify(execProvider)(shim,args,opts);assert.deepEqual(JSON.parse(result.stdout),args);
});
test('Windows prefers native exe, handles local Claude installation and refuses unknown batch launchers',t=>{
 const root=fixture(t),exe=path.join(root,'claude.exe');fs.writeFileSync(exe,'native');
 const opts={platform:'win32',env:{PATH:root},home:root};assert.equal(claudeCommand(opts),exe);
 const local=path.join(root,'.agent-world/tools/claude-code/node_modules/.bin/claude.cmd');fs.mkdirSync(path.dirname(local),{recursive:true});fs.writeFileSync(local,'fixture');assert.equal(claudeCommand(opts),local);
 assert.throws(()=>providerInvocation(local,[],opts),/Unsupported CLI batch launcher/);
});
test('Windows Node shebang fixtures execute without executable permission or shell parsing',async t=>{
 const root=fixture(t),file=path.join(root,'fixture-cli');fs.writeFileSync(file,`#!${process.execPath}\nconsole.log('fixture ready')`);
 const child=spawnProvider(file,[],{platform:'win32',stdio:['ignore','pipe','pipe']});let output='';child.stdout.on('data',c=>output+=c);const [code]=await once(child,'exit');assert.equal(code,0);assert.match(output,/fixture ready/);
});
test('Windows cancellation targets the provider process tree and ignores an exited tree',()=>{
 const calls=[];signalProvider({pid:123,exitCode:null},'SIGTERM',false,{platform:'win32',execute:(...a)=>calls.push(a)});
 assert.equal(calls[0][0],'taskkill.exe');assert.deepEqual(calls[0][1],['/PID','123','/T','/F']);
 signalProvider({pid:123,exitCode:0},'SIGTERM',false,{platform:'win32',execute:()=>assert.fail('already exited')});
 assert.doesNotThrow(()=>signalProvider({pid:123},'SIGKILL',true,{platform:'win32',execute:()=>{throw {status:128};}}));
});
test('desktop packaging chooses the current OS rather than always macOS',()=>{
 assert.deepEqual(desktopBuildArgs('win32'),['--win','--dir']);assert.deepEqual(desktopBuildArgs('darwin'),['--mac','--dir']);assert.deepEqual(desktopBuildArgs('linux'),['--linux','--dir']);
});

 test('provider environment excludes parent IPC descriptors without mutating the parent',async()=>{
 const {providerEnvironment}=await import('../bridge/cli-process.mjs');const original={PATH:'fixture',NODE_CHANNEL_FD:'3',NODE_CHANNEL_SERIALIZATION_MODE:'json',ELECTRON_RUN_AS_NODE:'1'};
 assert.deepEqual(providerEnvironment(original),{PATH:'fixture',ELECTRON_RUN_AS_NODE:'1'});assert.equal(original.NODE_CHANNEL_FD,'3');
 });

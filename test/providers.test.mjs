import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {codexCommand,installed} from '../bridge/providers.mjs';
test('Windows discovers native Codex exe, direct paths and bundled CLI without PATH',t=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'aw-win-cli-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 const cli=path.join(root,'codex.exe');fs.writeFileSync(cli,'fixture',{mode:0o700});
 const opts={platform:'win32',env:{PATH:`"${root}";C:\\missing`}};
 assert.equal(codexCommand(opts),cli);assert.equal(installed('codex',opts),true);assert.equal(installed(cli,opts),true);
 assert.equal(installed(path.join(root,'missing.exe'),opts),false);
 const bundled=path.join(root,'OpenAI','Codex','bin','fixture-version','codex.exe');fs.mkdirSync(path.dirname(bundled),{recursive:true});fs.writeFileSync(bundled,'fixture',{mode:0o700});
 assert.equal(codexCommand({platform:'win32',env:{PATH:'',LOCALAPPDATA:root}}),bundled);
 assert.equal(codexCommand({...opts,env:{...opts.env,AGENT_WORLD_CODEX_COMMAND:cli}}),cli);
});
test('Codex discovery works with bare app PATH, honors overrides and prefers installed PATH CLI',t=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'aw-cli-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 const bundled=path.join(root,'ChatGPT.app','Contents','Resources','codex-cli','CodexCLI.app','Contents','MacOS','codex');fs.mkdirSync(path.dirname(bundled),{recursive:true});fs.writeFileSync(bundled,'#!/bin/sh\nexit 0\n',{mode:0o700});
 const options={env:{PATH:'/nonexistent'},platform:'darwin',applications:root};assert.equal(codexCommand(options),bundled);
 assert.equal(codexCommand({...options,env:{AGENT_WORLD_CODEX_COMMAND:'/explicit/missing',PATH:root}}),'/explicit/missing');
 const cli=path.join(root,'codex');fs.writeFileSync(cli,'#!/bin/sh\nexit 0\n',{mode:0o700});assert.equal(codexCommand({...options,env:{PATH:root}}),cli);
 // Windows does not enforce POSIX execute mode bits.
 if(process.platform!=='win32'){fs.chmodSync(cli,0o600);assert.equal(codexCommand({...options,env:{PATH:root}}),bundled);}
 assert.equal(codexCommand({...options,platform:'linux'}),'codex');
});

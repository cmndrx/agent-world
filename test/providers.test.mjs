import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {codexCommand} from '../bridge/providers.mjs';
test('Codex discovery works with bare app PATH, honors overrides and prefers installed PATH CLI',t=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'aw-cli-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 const bundled=path.join(root,'ChatGPT.app','Contents','Resources','codex-cli','CodexCLI.app','Contents','MacOS','codex');fs.mkdirSync(path.dirname(bundled),{recursive:true});fs.writeFileSync(bundled,'#!/bin/sh\nexit 0\n',{mode:0o700});
 const options={env:{PATH:'/nonexistent'},platform:'darwin',applications:root};assert.equal(codexCommand(options),bundled);
 assert.equal(codexCommand({...options,env:{AGENT_WORLD_CODEX_COMMAND:'/explicit/missing',PATH:root}}),'/explicit/missing');
 const cli=path.join(root,'codex');fs.writeFileSync(cli,'#!/bin/sh\nexit 0\n',{mode:0o700});assert.equal(codexCommand({...options,env:{PATH:root}}),cli);
 fs.chmodSync(cli,0o600);assert.equal(codexCommand({...options,env:{PATH:root}}),bundled);
 assert.equal(codexCommand({...options,platform:'linux'}),'codex');
});

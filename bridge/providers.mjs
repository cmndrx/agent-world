import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
export function claudeCommand(){
 const configured=process.env.AGENT_WORLD_CLAUDE_COMMAND;if(configured)return configured;
 const local=path.join(os.homedir(),'.agent-world','tools','claude-code','node_modules','.bin','claude');
 return fs.existsSync(local)?local:'claude';
}
export function installed(command){
 const candidates=command.includes('/')?[command]:(process.env.PATH||'').split(path.delimiter).map(p=>path.join(p,command));
 return candidates.some(p=>{try{fs.accessSync(p,fs.constants.X_OK);return fs.statSync(p).isFile();}catch{return false;}});
}

// Finder-launched apps may not inherit the PATH that exposes the bundled Codex CLI.
export function codexCommand({env=process.env,platform=process.platform,applications='/Applications'}={}){
 if(env.AGENT_WORLD_CODEX_COMMAND)return env.AGENT_WORLD_CODEX_COMMAND;
 const fromPath=(env.PATH||'').split(path.delimiter).filter(Boolean).map(p=>path.join(p,'codex')).find(executable);
 if(fromPath)return fromPath;
 if(platform==='darwin'){
  const bundled=[
   path.join(applications,'Codex.app','Contents','Resources','codex'),
   path.join(applications,'ChatGPT.app','Contents','Resources','codex-cli','CodexCLI.app','Contents','MacOS','codex'),
  ].find(executable);
  if(bundled)return bundled;
 }
 return 'codex';
}
function executable(file){try{fs.accessSync(file,fs.constants.X_OK);return fs.statSync(file).isFile();}catch{return false;}}

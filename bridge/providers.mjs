import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
export function claudeCommand({env=process.env,platform=process.platform,home=os.homedir()}={}){
 const configured=env.AGENT_WORLD_CLAUDE_COMMAND;if(configured)return configured;
 const local=path.join(home,'.agent-world','tools','claude-code','node_modules','.bin','claude');
 return findCommand(local,env,platform)||findCommand('claude',env,platform)||'claude';
}
export function installed(command,{env=process.env,platform=process.platform}={}){
 return !!findCommand(command,env,platform);
}

export function findCommand(command,env=process.env,platform=process.platform){
 const names=platform==='win32'&&!path.extname(command)?[command+'.exe',command+'.cmd',command+'.bat',command]:[command];
 const direct=/[\\/]/.test(command)||path.isAbsolute(command);
 const candidates=direct?names:(env.PATH||env.Path||env.path||'').split(platform==='win32'?';':path.delimiter).filter(Boolean).flatMap(p=>names.map(n=>path.join(p.replace(/^"|"$/g,''),n)));
 return candidates.find(file=>executable(file,platform));
}

// Finder-launched apps may not inherit the PATH that exposes the bundled Codex CLI.
export function codexCommand({env=process.env,platform=process.platform,applications='/Applications'}={}){
 if(env.AGENT_WORLD_CODEX_COMMAND)return env.AGENT_WORLD_CODEX_COMMAND;
 const fromPath=findCommand('codex',env,platform);
 if(fromPath)return fromPath;
 if(platform==='darwin'){
  const bundled=[
   path.join(applications,'Codex.app','Contents','Resources','codex'),
   path.join(applications,'ChatGPT.app','Contents','Resources','codex-cli','CodexCLI.app','Contents','MacOS','codex'),
  ].find(file=>executable(file,platform));
  if(bundled)return bundled;
 }
 if(platform==='win32'&&env.LOCALAPPDATA){
  const bin=path.join(env.LOCALAPPDATA,'OpenAI','Codex','bin');
  try {
   const bundled=fs.readdirSync(bin,{withFileTypes:true}).filter(e=>e.isDirectory()).map(e=>path.join(bin,e.name,'codex.exe')).filter(file=>executable(file,platform)).sort((a,b)=>fs.statSync(b).mtimeMs-fs.statSync(a).mtimeMs)[0];
   if(bundled)return bundled;
  }catch{}
 }
 return 'codex';
}
function executable(file,platform=process.platform){try{fs.accessSync(file,platform==='win32'?fs.constants.F_OK:fs.constants.X_OK);return fs.statSync(file).isFile();}catch{return false;}}

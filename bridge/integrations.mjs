import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import {execFile} from 'node:child_process';import {promisify} from 'node:util';import {codexCommand} from './providers.mjs';
const exec=promisify(execFile),read=file=>{try{return JSON.parse(fs.readFileSync(file,'utf8'));}catch{return {};}};
export function codexPlugins(files){const result=new Map();for(const file of files){let text;try{text=fs.readFileSync(file,'utf8');}catch{continue;}for(const match of text.matchAll(/^\[plugins\."([^"\n]+)"\]\s*\n([^\[]*)/gm)){const enabled=match[2].match(/^enabled\s*=\s*(true|false)\s*(?:#.*)?$/m);if(enabled)result.set(match[1],{name:match[1],enabled:enabled[1]==='true'});}}return [...result.values()];}
export function claudeConfiguration(project,root=process.env.CLAUDE_CONFIG_DIR||path.join(os.homedir(),'.claude')){
 const user=read(path.join(root,'..','.claude.json')),settings=[read(path.join(root,'settings.json')),read(path.join(project,'.claude','settings.json')),read(path.join(project,'.claude','settings.local.json'))];
 const servers={...user.mcpServers,...read(path.join(project,'.mcp.json')).mcpServers,...user.projects?.[project]?.mcpServers};const plugins=Object.assign({},...settings.map(s=>s.enabledPlugins||{}));return {servers,plugins};
}
export async function integrationCatalog(project,provider,{command=codexCommand(),codexHome=process.env.CODEX_HOME||path.join(os.homedir(),'.codex'),claudeRoot}={}){
 if(provider==='claude'){const config=claudeConfiguration(project,claudeRoot);return {status:'available',servers:Object.keys(config.servers).map(name=>({name,enabled:true})),plugins:Object.entries(config.plugins).map(([name,enabled])=>({name,enabled:enabled===true})),note:'Configured names only. MCP project trust, login and tool permissions still apply.'};}
 try{const {stdout}=await exec(command,['mcp','list','--json'],{cwd:project,timeout:10000,maxBuffer:1024*1024});const values=JSON.parse(stdout);if(!Array.isArray(values))throw new Error();return {status:'available',servers:values.filter(s=>typeof s.name==='string').map(s=>({name:s.name,enabled:s.enabled!==false})),plugins:codexPlugins([path.join(codexHome,'config.toml'),path.join(project,'.codex','config.toml')]),note:'Names from CLI configuration; this is not a connection health check. Workspace-managed plugins may override local preferences.'};}catch{return {status:'unavailable',servers:[],plugins:[],note:'Could not read CLI integrations. Check installation and configuration.'};}
}
export async function integrationArgs(e,provider,project,dir,options={}){
 if(e.external==='inherit'&&!e.connections.length)return [];
 const catalog=await integrationCatalog(project,provider,options);if(provider!=='claude'&&catalog.status!=='available')throw new Error('Cannot enforce integration selection: CLI integration inventory unavailable.');
 for(const name of e.servers)if(!catalog.servers.some(s=>s.name===name))throw new Error('Selected MCP service is no longer configured.');
 for(const name of e.plugins)if(!catalog.plugins.some(s=>s.name===name))throw new Error('Selected plugin is no longer configured.');
 const selected=e.external==='selected';
 if(provider==='claude'){
  const config=claudeConfiguration(project,options.claudeRoot),servers=Object.fromEntries((e.external==='inherit'?Object.keys(config.servers):selected?e.servers:[]).map(n=>[n,config.servers[n]]));for(const c of e.connections)servers[c.name]={type:'http',url:c.url};
  const file=path.join(dir,'mcp.json');fs.writeFileSync(file,JSON.stringify({mcpServers:servers}),{mode:0o600});const settings={enabledPlugins:Object.fromEntries(catalog.plugins.map(p=>[p.name,e.external==='inherit'?p.enabled:selected&&e.plugins.includes(p.name)]))};
  return ['--strict-mcp-config','--mcp-config',file,'--settings',JSON.stringify(settings),...(e.external==='off'?['--disallowedTools','mcp__*']:[])];
 }
 const args=[],set=(key,value)=>args.push('-c',key+'='+JSON.stringify(value));
 if(e.external!=='inherit'){for(const s of catalog.servers)set(`mcp_servers.${JSON.stringify(s.name)}.enabled`,selected&&e.servers.includes(s.name));for(const p of catalog.plugins)set(`plugins.${JSON.stringify(p.name)}.enabled`,selected&&e.plugins.includes(p.name));set('features.apps',false);if(e.external==='off'){set('features.plugins',false);set('features.remote_plugin',false);}}
 for(const c of e.connections){set(`mcp_servers.${JSON.stringify(c.name)}.url`,c.url);set(`mcp_servers.${JSON.stringify(c.name)}.enabled`,true);set(`mcp_servers.${JSON.stringify(c.name)}.required`,true);if(c.tools.length)set(`mcp_servers.${JSON.stringify(c.name)}.enabled_tools`,c.tools);}
 return args;
}

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {spawn} from 'node:child_process';
import {codexCommand} from './providers.mjs';
export function projectRpc(method,params,{command=codexCommand(),spawnChild=spawn,timeoutMs=15000}={}){
 if(!['project/list','project/create'].includes(method))throw Error('Unsupported project method.');
 return new Promise((resolve,reject)=>{let child,buffer='',done=false;const timer=setTimeout(()=>finish(Error('Codex project request timed out. Retry the same request; its project key is preserved.')),timeoutMs);timer.unref?.();
 const finish=(error,result)=>{if(done)return;done=true;clearTimeout(timer);if(child){child.stdin.destroy();child.kill('SIGTERM');const t=setTimeout(()=>child.kill('SIGKILL'),1000);t.unref?.();}error?reject(error):resolve(result);};
 const send=m=>child.stdin.write(JSON.stringify(m)+'\n');
 try{child=spawnChild(command,['app-server','--listen','stdio://'],{cwd:os.tmpdir(),stdio:['pipe','pipe','ignore']});child.on('error',()=>finish(Error('Could not start Codex. Check installation.')));child.on('close',()=>finish(Error('Codex project connection closed.')));child.stdin.on('error',()=>finish(Error('Codex project connection closed.')));child.stdout.on('data',c=>{buffer+=c;if(buffer.length>2*1024*1024)return finish(Error('Codex project response was too large.'));let n;while((n=buffer.indexOf('\n'))>=0){let m;try{m=JSON.parse(buffer.slice(0,n));}catch{}buffer=buffer.slice(n+1);if(!m)continue;if(m.id===1){if(m.error)return finish(Error('Codex could not initialize project support.'));send({method:'initialized'});send({id:2,method,params});}else if(m.id===2){if(m.error)return finish(Error(String(m.error.message||'Codex project request failed.').slice(0,400)));finish(null,m.result);}}});send({id:1,method:'initialize',params:{clientInfo:{name:'agent_world_projects',version:'0.1.0'},capabilities:{experimentalApi:true}}});}catch(e){finish(e);}
 });
}
export function localProject(raw){
 if(typeof raw?.id!=='string'||!raw.id||raw.id.length>200||typeof raw.name!=='string'||!Array.isArray(raw.roots))throw Error('Codex returned invalid project metadata.');
 const root=raw.roots[0]?.path;if(typeof root!=='string'||!path.isAbsolute(root))return null;
 try{const folder=fs.realpathSync(root);if(!fs.statSync(folder).isDirectory())return null;return {id:raw.id,name:raw.name.slice(0,100),path:folder,rootCount:raw.roots.length};}catch{return null;}
}
export class LocalProjects{
 constructor({rpc=projectRpc}={}){this.rpc=rpc;this.tail=Promise.resolve();}
 async list(){let cursor=null,projects=[],skipped=0;for(let page=0;page<100;page++){const r=await this.rpc('project/list',{limit:100,cursor});if(!Array.isArray(r?.data))throw Error('Codex returned an invalid project list.');for(const raw of r.data){const p=localProject(raw);if(p)projects.push(p);else skipped++;}if(!r.nextCursor)return {projects,skipped,defaultParent:path.join(os.homedir(),'Documents','Projects')};if(r.nextCursor===cursor)throw Error('Codex project pagination did not advance.');cursor=r.nextCursor;}throw Error('Codex project list exceeded its page limit.');}
 create(input){const operation=this.tail.then(()=>this.createOne(input));this.tail=operation.catch(()=>{});return operation;}
 async createOne({name,folder,createFolder=false,idempotencyKey}){
 if(typeof name!=='string'||!name.trim()||name.trim().length>100)throw Error('Enter a project name (up to 100 characters).');
 if(typeof folder!=='string'||!folder.trim()||folder.includes('\0'))throw Error('Enter a local folder path.');
 if(typeof createFolder!=='boolean'||typeof idempotencyKey!=='string'||!/^[a-zA-Z0-9-]{16,100}$/.test(idempotencyKey))throw Error('Invalid project request.');
 folder=folder.trim().replace(/^~\//,os.homedir()+'/');if(!path.isAbsolute(folder)||path.resolve(folder)===path.parse(folder).root)throw Error('Choose an absolute project folder, not the filesystem root.');
 const existing=await this.list();const target=path.resolve(folder);let canonical;
 try{canonical=fs.realpathSync(target);if(!fs.statSync(canonical).isDirectory())throw Error('The selected path is not a folder.');}catch(e){if(e.code!=='ENOENT')throw e;if(!createFolder)throw Error('Folder does not exist. Enable Create folder if missing, or choose an existing folder.');const parent=fs.realpathSync(path.dirname(target));fs.mkdirSync(path.join(parent,path.basename(target)));canonical=fs.realpathSync(target);}
 const known=existing.projects.find(p=>p.path===canonical);if(known)return {...known,existing:true};
 let raw;try{raw=await this.rpc('project/create',{name:name.trim(),roots:[{path:canonical}],metadata:{createdBy:'agent-world'},idempotencyKey});}catch(e){throw Error(`${e.message} Folder retained at ${canonical}; no files were removed.`);}
 const p=localProject(raw?.project);if(!p||p.path!==canonical)throw Error('Codex did not confirm the requested project folder. Retry to reconcile the project list.');return {...p,existing:false};
 }
}

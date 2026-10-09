import fs from 'node:fs';
import path from 'node:path';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
const exec=promisify(execFile);
const git=async(project,args)=>{try{return (await exec('git',['-C',project,...args],{maxBuffer:32*1024*1024})).stdout;}catch{throw new Error('Git workspace operation failed. Check repository state and available disk space.');}};
export async function createWorkspace(project,root,id){
  let ancestor=path.resolve(root),suffix=[];while(!fs.existsSync(ancestor)){suffix.unshift(path.basename(ancestor));ancestor=path.dirname(ancestor);}root=path.join(fs.realpathSync(ancestor),...suffix);const relative=path.relative(fs.realpathSync(project),root);if(!relative.startsWith('..')&&!path.isAbsolute(relative))throw new Error('Worktrees must be stored outside the source checkout.');
  const top=fs.realpathSync((await git(project,['rev-parse','--show-toplevel'])).trim());
  if(top!==fs.realpathSync(project))throw new Error('Isolation requires the project to be the Git repository root.');
  const base=(await git(project,['rev-parse','HEAD'])).trim(),branch='codex/agent-world-'+id;
  const directory=path.join(root,id);fs.mkdirSync(root,{recursive:true,mode:0o700});
  await git(project,['worktree','add','-b',branch,directory,base]);
  // Capture the working checkout, including untracked source; ignored runtime/build files stay out.
  try{
    const patch=await git(project,['diff','--binary','HEAD']);
    if(patch){const patchFile=path.join(root,id+'.patch');fs.writeFileSync(patchFile,patch,{mode:0o600});try{await git(directory,['apply','--',patchFile]);}finally{fs.unlinkSync(patchFile);}}
    const names=(await git(project,['ls-files','--others','--exclude-standard','-z'])).split('\0').filter(Boolean);
    for(const name of names){const source=path.join(project,name),dest=path.join(directory,name);fs.mkdirSync(path.dirname(dest),{recursive:true});const stat=fs.lstatSync(source);if(stat.isSymbolicLink())fs.symlinkSync(fs.readlinkSync(source),dest);else if(stat.isFile())fs.copyFileSync(source,dest);}
  }catch{throw new Error('Worktree was created but its checkout snapshot failed. Inspect '+directory+' before retrying.');}
  return {path:fs.realpathSync(directory),branch,base};
}
export async function checkWorkspace(project,workspace){
  const registered=(await git(project,['worktree','list','--porcelain'])).split('\n').filter(l=>l.startsWith('worktree ')).map(l=>l.slice(9));
  if(!registered.some(p=>fs.existsSync(p)&&fs.realpathSync(p)===workspace.path))throw new Error('Conversation worktree is unavailable. Restore it before continuing.');
  return workspace;
}

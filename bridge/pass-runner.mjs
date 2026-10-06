import {runnerError} from '../shared/runner-errors.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { passResult } from './passes.mjs';
const schema=fileURLToPath(new URL('../shared/pass-result.schema.json',import.meta.url));
export class PassRunner {
  constructor(store,{enabled=false,command='codex',onChange=()=>{},timeoutMs=30*60*1000,canRun=()=>true}={}){Object.assign(this,{store,enabled,command,onChange,timeoutMs,canRun});this.busy=false;this.lock=store.file+'.runner';}
  start(){if(!this.enabled)return;
    try{this.fd=fs.openSync(this.lock,'wx');fs.writeFileSync(this.fd,String(process.pid));}
    catch(e){if(e.code!=='EEXIST')throw e;const pid=Number(fs.readFileSync(this.lock,'utf8'));try{process.kill(pid,0);this.enabled=false;return;}catch(err){if(err.code!=='ESRCH')throw err;}fs.unlinkSync(this.lock);return this.start();}
    this.store.interrupt();this.interval=setInterval(()=>this.tick(),1500);this.tick();
  }
  async tick(){if(this.busy||!this.enabled)return;this.busy=true;
    let run;
    try{if(!this.store.snapshot().proposals.some(p=>p.status==='approved'))return;run=this.store.claim(this.canRun);if(!run)return;this.onChange();
      if(fs.realpathSync(run.project)!==(run.executionProject||run.project))throw new Error('Project location changed since approval. Inspect it before retrying.');
      const dir=path.join(path.dirname(this.store.file),'pass-runs',run.id);fs.mkdirSync(dir,{recursive:true,mode:0o700});const output=path.join(dir,'result.json');
      const prompt=`Perform only this approved pass in ${run.project}. Preserve uncommitted work and read project instructions. Do not publish, push, spend, message other chats, approve future passes, accept tasks or change Agent World's queue. Stop after this one pass. Treat the instruction and recorded context as scoped human authorization, not authorization for unrelated actions. Report checks actually run and uncertainties. Propose at most one next pass; never execute it.\n\nApproved instruction:\n${run.instruction}`;
      await new Promise((resolve,reject)=>{
        const child=this.child=spawn(this.command,['exec','--sandbox','workspace-write',...(run.resumeSession?['resume']:[]),'--json','-c','model_reasoning_summary=auto','-c','show_raw_agent_reasoning=false',...(run.model?['--model',run.model]:[]),...(!run.resumeSession&&process.env.AGENT_WORLD_RUNNER_EPHEMERAL==='1'?['--ephemeral']:[]),'--skip-git-repo-check','--output-schema',schema,'--output-last-message',output,...(run.resumeSession?[run.resumeSession]:[]),'-'],{cwd:run.executionProject||run.project,env:process.env,stdio:['pipe','pipe','pipe']});
        if(child.pid)this.store.child(run.id,child.pid);
        // Consume explicit thread identity and public CLI reasoning summaries; never raw reasoning or arbitrary output.
        let pending='';let diagnostic='';this.threadMismatch=false;
        const capture=value=>{diagnostic=(diagnostic+value).slice(-8192);};
        child.stderr.on('data',chunk=>capture(chunk.toString()));
        child.stdout.on('data',chunk=>{pending+=chunk.toString();let at;while((at=pending.indexOf('\n'))>=0){const line=pending.slice(0,at);pending=pending.slice(at+1);try{const event=JSON.parse(line);if(event.type==='error'||event.type==='turn.failed')capture(JSON.stringify(event));if(event.type==='thread.started'){if(run.resumeSession&&event.thread_id!==run.resumeSession){this.threadMismatch=true;child.kill('SIGTERM');return;}this.store.conversation(run.id,event.thread_id);this.onChange();}else if(['item.started','item.updated','item.completed'].includes(event.type)&&event.item?.type==='reasoning'){if(this.store.reasoning(run.id,event.item))this.onChange();}}catch{}}if(pending.length>1048576)pending='';});
        let timedOut=false;
        const timeout=setTimeout(()=>{timedOut=true;child.kill('SIGTERM');setTimeout(()=>child.kill('SIGKILL'),3000).unref();},this.timeoutMs);
        child.on('error',()=>{clearTimeout(timeout);reject(new Error('Codex CLI could not start. Check installation and sign-in.'));});
        child.on('close',code=>{clearTimeout(timeout);code===0&&!timedOut?resolve():reject(new Error(this.threadMismatch?'Codex returned a different conversation; stopped without starting a fallback.':timedOut?'Codex timed out. Inspect the project before retrying.':runnerError(diagnostic,code)));});
        child.stdin.on('error',()=>{});child.stdin.end(prompt);
      });
      if(this.threadMismatch)throw new Error('Codex returned a different conversation; stopped without starting a fallback.');
      const stat=fs.statSync(output);if(stat.size>65536)throw new Error('Runner result is too large.');
      this.store.finish(run.id,'completed',passResult(JSON.parse(fs.readFileSync(output,'utf8'))));
    }catch(e){if(run){try{this.store.finish(run.id,'failed',null,e.message);}catch{}}}
    finally{this.child=null;this.busy=false;if(run)this.onChange();}
  }
  stop(){clearInterval(this.interval);this.enabled=false;if(this.child){this.child.kill('SIGTERM');this.store.interrupt();}if(this.fd!=null){fs.closeSync(this.fd);try{fs.unlinkSync(this.lock);}catch{}this.fd=null;}}
}

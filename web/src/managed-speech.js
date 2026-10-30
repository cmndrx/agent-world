export class ManagedSpeech {
 constructor(onProgress=()=>{}){this.onProgress=onProgress;this.nextId=0;this.jobs=new Map();this.ready=false;}
 async call(action,samples,{cachedOnly=false}={}){
  if(!this.worker){this.worker=new Worker(new URL('./speech-worker.js',import.meta.url),{type:'module'});
   this.worker.onmessage=({data})=>{if(data.type==='progress'){this.onProgress(data);return;}const job=this.jobs.get(data.id);if(!job)return;clearTimeout(job.timer);this.jobs.delete(data.id);data.type==='error'?job.reject(Error(data.message)):job.resolve(data.result);};
   this.worker.onerror=()=>this.stop('Speech worker failed. Retry setup.');
  }
  const result=await new Promise((resolve,reject)=>{const id=++this.nextId,timer=setTimeout(()=>this.stop('Speech setup timed out. Check your connection and retry.'),300000);this.jobs.set(id,{resolve,reject,timer});this.worker.postMessage({id,action,samples,cachedOnly},samples?[samples.buffer]:[]);});
  this.ready=true;return result;
 }
 stop(message='Local speech cancelled.') {this.worker?.terminate();this.worker=null;this.ready=false;for(const job of this.jobs.values()){clearTimeout(job.timer);job.reject(Error(message));}this.jobs.clear();}
}

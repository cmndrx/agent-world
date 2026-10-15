import {speechWave,spokenReply} from '../../shared/speech-audio.mjs';

const base64=bytes=>{let value='';for(const b of bytes)value+=String.fromCharCode(b);return btoa(value);};

// Local audio surrounds ordinary human-reviewed text sends. It never starts an agent turn.
export class LocalVoiceChat {
  constructor(onChange,onTranscript){this.onChange=onChange;this.onTranscript=onTranscript;this.state={status:'idle'};this.enabled=false;this.generation=0;this.pending=new Map();this.queue=[];}
  active(){return ['connecting','recording','transcribing'].includes(this.state.status);}
  async request(action,extra={},signal){
    const response=await fetch('/api/local-speech',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({...this.context,action,...extra}),signal});
    const data=await response.json();if(!response.ok)throw Error(data.error||'Local speech unavailable.');return data.result;
  }
  async start(context){
    if(this.active())return;
    this.stopSpeaking();this.context=context;this.enabled=true;this.state={status:'connecting',message:'Checking local speech…'};const generation=++this.generation;this.onChange();
    this.captureAbort=new AbortController();
    try{
      const readiness=await this.request('status',{},this.captureAbort.signal);if(generation!==this.generation)return;
      if(!readiness.configured)throw Error(readiness.message);
      this.backend=readiness.message;
      const mic=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true},video:false});
      if(generation!==this.generation){mic.getTracks().forEach(t=>t.stop());return;}
      this.mic=mic;this.audio=new AudioContext();await this.audio.resume();this.sampleRate=this.audio.sampleRate;this.chunks=[];this.sampleCount=0;
      const source=`class LocalVoiceCapture extends AudioWorkletProcessor { process(inputs){const samples=inputs[0]?.[0];if(samples)this.port.postMessage(samples.slice());return true;} } registerProcessor('local-voice-capture',LocalVoiceCapture);`;
      const url=URL.createObjectURL(new Blob([source],{type:'text/javascript'}));try{await this.audio.audioWorklet.addModule(url);}finally{URL.revokeObjectURL(url);}
      if(generation!==this.generation)return;
      this.node=new AudioWorkletNode(this.audio,'local-voice-capture');this.source=this.audio.createMediaStreamSource(mic);this.source.connect(this.node);
      this.gain=this.audio.createGain();this.gain.gain.value=0;this.node.connect(this.gain).connect(this.audio.destination);
      this.node.port.onmessage=e=>{if(generation!==this.generation||this.state.status!=='recording')return;const room=Math.floor(this.sampleRate*30)-this.sampleCount;const chunk=e.data.subarray(0,room);this.chunks.push(chunk);this.sampleCount+=chunk.length;if(this.sampleCount>=this.sampleRate*30)this.finishRecording();};
      this.state={status:'recording',message:'Listening · up to 30 seconds. Finish to review your words before sending.'};this.onChange();
      this.timer=setTimeout(()=>this.finishRecording(),30000);
    }catch(e){if(generation===this.generation){this.release();this.enabled=false;this.state={status:'error',message:e.name==='NotAllowedError'?'Microphone access was denied. Allow Agent World in macOS microphone settings.':e.message};this.onChange();}}
  }
  release(){clearTimeout(this.timer);this.mic?.getTracks().forEach(t=>t.stop());this.source?.disconnect();this.node?.disconnect();this.gain?.disconnect();this.audio?.close().catch(()=>{});this.audio=null;this.mic=null;this.chunks=[];}
  async finishRecording(){
    if(this.state.status!=='recording')return;const generation=this.generation;
    const samples=new Float32Array(this.sampleCount);let offset=0;for(const chunk of this.chunks){samples.set(chunk,offset);offset+=chunk.length;}
    this.release();this.state={status:'transcribing',message:'Transcribing locally…'};this.onChange();
    try{
      if(samples.length<this.sampleRate*0.25)throw Error('Recording was too short. Try again.');
      let energy=0;for(const value of samples)energy+=value*value;
      if(Math.sqrt(energy/samples.length)<0.002)throw Error('The recording was silent. Check your microphone and try again.');
      const result=await this.request('transcribe',{audio:base64(speechWave(samples,this.sampleRate))},this.captureAbort.signal);
      if(generation!==this.generation)return;
      if(!result.text?.trim())throw Error('No words were recognized. Try again.');
      this.state={status:'ready',message:'Transcript added to your draft. Review it, then Send. Replies will be spoken.'};this.onTranscript(result.text,this.context);this.onChange();
    }catch(e){if(generation===this.generation){this.state={status:'error',message:e.message};this.onChange();}}
  }
  follow(proposalId,context){if(this.enabled)this.pending.set(proposalId,{...context});}
  updateRuns(runs){
    if(!this.enabled)return;
    for(const [id,context]of this.pending){
      const run=runs.find(r=>r.proposalId===id&&r.project===context.project&&r.slot===context.slot&&(r.provider||'codex')===context.provider);
      if(!run||!['completed','failed','cancelled','interrupted'].includes(run.status))continue;
      this.pending.delete(id);const text=spokenReply(run);if(text)this.queue.push({text,context});
    }
    if(!this.speaking&&this.queue.length)this.speakNext();
  }
  async speakNext(){
    if(!this.enabled||this.active()||this.speaking)return;
    const next=this.queue.shift();if(!next)return;
    this.speaking=true;this.playAbort=new AbortController();const signal=this.playAbort.signal;
    this.state={status:'ready',message:'Preparing spoken reply…'};this.onChange();
    try{
      const data=await this.request('speak',{...next.context,text:next.text},signal);if(signal.aborted||!this.enabled)return;
      const bytes=Uint8Array.from(atob(data.audio),c=>c.charCodeAt(0));this.playURL=URL.createObjectURL(new Blob([bytes],{type:data.mime}));
      this.player=new Audio(this.playURL);this.state={status:'ready',message:'Speaking · full reply remains in chat.'};this.onChange();
      await new Promise((resolve,reject)=>{this.player.onended=resolve;this.player.onerror=()=>reject(Error('Spoken audio could not play.'));signal.addEventListener('abort',resolve,{once:true});this.player.play().catch(reject);});
    }catch(e){if(!signal.aborted){this.state={status:'error',message:e.message};this.onChange();}}
    finally{if(!signal.aborted){this.clearPlayer();this.speaking=false;if(this.state.status!=='error')this.state={status:'ready',message:'Voice ready · record your next message.'};this.onChange();this.speakNext();}}
  }
  clearPlayer(){this.player?.pause();this.player=null;if(this.playURL)URL.revokeObjectURL(this.playURL);this.playURL=null;}
  stopSpeaking(){this.playAbort?.abort();this.clearPlayer();this.speaking=false;this.queue=[];}
  stop(){++this.generation;this.captureAbort?.abort();this.release();this.stopSpeaking();this.pending.clear();this.enabled=false;this.state={status:'idle'};this.onChange();}
  mount(host,context){
    this.nextContext=context;
    if(!host)return;host.replaceChildren();if(this.state.status==='idle')return;
    const row=document.createElement('div');row.className='voice-call-controls';const label=document.createElement('span');label.setAttribute('role','status');label.textContent=this.state.message;row.append(label);
    const button=(text,fn)=>{const b=document.createElement('button');b.type='button';b.textContent=text;b.onclick=fn;row.append(b);};
    if(this.state.status==='recording')button('Finish recording',()=>this.finishRecording());
    if(!this.active()&&this.enabled&&context?.canRecord!==false)button('Record again',()=>this.start(this.nextContext||this.context));
    if(this.speaking)button('Stop speaking',()=>{this.stopSpeaking();this.state={status:'ready',message:'Playback stopped.'};this.onChange();});
    button(this.active()?'Cancel recording':'End voice',()=>this.stop());host.append(row);
  }
}

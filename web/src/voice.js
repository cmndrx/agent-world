// Thread-scoped Codex audio transport. No raw recording is saved by Agent World.
export class VoiceChat {
  constructor(onChange){this.onChange=onChange;this.state={status:'idle'};this.sources=new Set();this.transcripts=[];this.generation=0;}
  active(){return ['connecting','live','approval'].includes(this.state.status);}
  async request(action,extra={}){const r=await fetch('/api/voice',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({...this.context,id:this.state.id,action,...extra}),keepalive:action==='stop'});const data=await r.json();if(!r.ok)throw new Error(data.error||'Voice request failed.');return data.result;}
  async start(context){
    if(this.active())return;this.context=context;this.state={status:'connecting',message:'Preparing microphone…'};this.transcripts=[];this.muted=false;this.audioQueue=[];this.onChange();const generation=++this.generation;
    try{
      const mic=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true},video:false});
      if(generation!==this.generation){mic.getTracks().forEach(t=>t.stop());return;}
      this.mic=mic;this.audio=new AudioContext({sampleRate:24000});await this.audio.resume();
      const state=await this.request('start',{thread:context.thread,model:context.model});
      if(generation!==this.generation){await fetch('/api/voice',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({...context,id:state.id,action:'stop'})});return;}
      this.state=state;this.events=new EventSource('/api/voice/stream?id='+encodeURIComponent(state.id));
      this.events.onmessage=e=>{if(generation!==this.generation)return;let item;try{item=JSON.parse(e.data);}catch{return;}this.receive(item);};
      this.events.onerror=()=>{if(this.active())this.fail('Voice connection lost. Start again when ready.');};
      await this.capture(generation);this.onChange();
    }catch(e){if(generation===this.generation)this.fail(e.name==='NotAllowedError'?'Microphone access was denied. Allow Agent World in microphone settings and retry.':e.message);}
  }
  async capture(generation){
    const source=`class VoiceCapture extends AudioWorkletProcessor { constructor(){super();this.samples=[];} process(inputs){const data=inputs[0]?.[0];if(data){for(const v of data)this.samples.push(v);if(this.samples.length>=2400){const b=new ArrayBuffer(this.samples.length*2);const d=new DataView(b);this.samples.forEach((v,i)=>d.setInt16(i*2,Math.max(-32768,Math.min(32767,Math.round(v*32767))),true));this.port.postMessage(b,[b]);this.samples=[];}}return true;}} registerProcessor('voice-capture',VoiceCapture);`;
    const url=URL.createObjectURL(new Blob([source],{type:'text/javascript'}));try{await this.audio.audioWorklet.addModule(url);}finally{URL.revokeObjectURL(url);}
    if(generation!==this.generation||!this.audio)return;
    this.captureNode=new AudioWorkletNode(this.audio,'voice-capture');this.micSource=this.audio.createMediaStreamSource(this.mic);this.micSource.connect(this.captureNode);
    const silence=this.audio.createGain();silence.gain.value=0;this.captureNode.connect(silence).connect(this.audio.destination);
    this.captureNode.port.onmessage=e=>{
      if(generation!==this.generation||this.state.status!=='live'||this.muted)return;
      const bytes=new Uint8Array(e.data);let binary='';for(const b of bytes)binary+=String.fromCharCode(b);
      this.audioQueue.push({data:btoa(binary),sampleRate:this.audio.sampleRate,numChannels:1,samplesPerChannel:bytes.length/2,itemId:null});if(this.audioQueue.length>30){this.fail('Voice upload is too slow. Please retry.');return;}this.flushAudio(generation);
    };
  }
  async flushAudio(generation){
    if(this.audioBusy)return;this.audioBusy=true;try{while(generation===this.generation&&this.audioQueue.length&&this.active()){const audio=this.audioQueue.shift();await this.request('audio',{audio});}}catch(e){if(generation===this.generation)this.fail(e.message);}finally{this.audioBusy=false;}
  }
  receive(item){
    if(item.type==='state'){
      this.state=item;
      if(!this.active()){this.releaseAudio();this.events?.close();}
      this.onChange();
    }else if(item.type==='audio')this.play(item.audio);
    else if(item.type==='transcript'){
      if(item.role==='user')this.silence();
      let last=this.transcripts.at(-1);if(item.done&&last?.done&&last.role===item.role&&last.text===item.text)return;if(!last||last.role!==item.role||last.done){last={role:item.role,text:'',done:false};this.transcripts.push(last);}
      last.text=item.done?item.text:last.text+item.text;last.done=item.done;
      this.transcripts=this.transcripts.slice(-40);this.updateTranscript();
    }
  }
  play(chunk){
    if(!this.audio||!chunk?.data)return;
    const bytes=Uint8Array.from(atob(chunk.data),c=>c.charCodeAt(0));if(bytes.length%2)return;const count=bytes.length/2,channels=chunk.numChannels||1;const view=new DataView(bytes.buffer);
    const buffer=this.audio.createBuffer(channels,Math.floor(count/channels),chunk.sampleRate||24000);for(let c=0;c<channels;c++){const out=buffer.getChannelData(c);for(let i=0;i<out.length;i++)out[i]=view.getInt16((i*channels+c)*2,true)/32768;}
    const sound=this.audio.createBufferSource();sound.buffer=buffer;sound.connect(this.audio.destination);this.sources.add(sound);sound.onended=()=>this.sources.delete(sound);this.nextAudio=Math.max(this.audio.currentTime,this.nextAudio||0);sound.start(this.nextAudio);this.nextAudio+=buffer.duration;
  }
  silence(){for(const s of this.sources){try{s.stop();}catch{}}this.sources.clear();this.nextAudio=0;}
  releaseAudio(){this.audioQueue=[];this.mic?.getTracks().forEach(t=>t.stop());this.captureNode?.disconnect();this.micSource?.disconnect();this.silence();this.audio?.close().catch(()=>{});this.mic=null;this.audio=null;}
  async stop(){++this.generation;this.events?.close();this.releaseAudio();try{if(this.state.id)await this.request('stop');}catch{}this.state={...this.state,status:'ended',message:'Voice call ended.'};this.onChange();}
  fail(message){this.events?.close();this.releaseAudio();if(this.state.id)this.request('stop').catch(()=>{});this.state={...this.state,status:'error',message};this.onChange();}
  toggleMute(){this.muted=!this.muted;this.mic?.getTracks().forEach(t=>t.enabled=!this.muted);this.onChange();}
  async decide(allow){try{this.state=await this.request(allow?'approve':'deny',{approvalId:this.state.approval.id});this.onChange();}catch(e){this.fail(e.message);}}
  mount(host){
    this.host=host;if(!host)return;const active=this.active();host.innerHTML='';
    if(active){const row=document.createElement('div');row.className='voice-call-controls';const status=document.createElement('span');status.textContent=this.state.status==='approval'?'Permission needed':this.state.status==='connecting'?'Connecting…':this.muted?'Microphone muted':'Voice session started';row.append(status);
      const mute=document.createElement('button');mute.type='button';mute.textContent=this.muted?'Unmute':'Mute';mute.onclick=()=>this.toggleMute();const end=document.createElement('button');end.type='button';end.textContent='End voice';end.onclick=()=>this.stop();row.append(mute,end);host.append(row);
      if(this.state.approval){const box=document.createElement('div');box.className='voice-approval';const detail=document.createElement('p');detail.textContent=this.state.approval.message+'\n'+this.state.approval.command;box.append(detail);for(const [label,allow]of [['Approve',true],['Deny',false]]){const b=document.createElement('button');b.type='button';b.textContent=label;b.onclick=()=>this.decide(allow);box.append(b);}host.append(box);}
    }else if(this.state.status==='error'){const p=document.createElement('p');p.setAttribute('role','status');p.textContent=this.state.message;host.append(p);}
    const transcript=document.createElement('div');transcript.className='voice-transcript';transcript.setAttribute('aria-label','Voice transcript');host.append(transcript);this.updateTranscript();
  }
  updateTranscript(){const el=this.host?.querySelector('.voice-transcript');if(!el)return;el.replaceChildren();for(const item of this.transcripts.slice(-4)){const p=document.createElement('p');const label=document.createElement('strong');label.textContent=item.role==='user'?'You: ':'Agent: ';p.append(label,document.createTextNode(item.text));el.append(p);}}
}

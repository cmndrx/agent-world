import {speechWave,spokenReply,microphoneChannel,microphoneSignal} from '../../shared/speech-audio.mjs';
import {VOICE_MODEL,voiceRecovery,voiceDiagnostics} from '../../shared/voice-setup.mjs';
import {ManagedSpeech} from './managed-speech.js';

const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
// Icons come from the prompter (voice.icon = icon), so this module stays importable in Node tests.
const BARS='<span class="voice-bars" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></span>';

const base64=bytes=>{let value='';for(const b of bytes)value+=String.fromCharCode(b);return btoa(value);};

// Local audio surrounds ordinary human-reviewed text sends. It never starts an agent turn.
export class LocalVoiceChat {
  constructor(onChange,onTranscript){this.onChange=onChange;this.onTranscript=onTranscript;this.state={status:'idle'};this.enabled=false;this.repliesEnabled=false;this.generation=0;this.pending=new Map();this.queue=[];this.devices=[];this.deviceId='';try{this.engine=localStorage.getItem('agent-world-voice-engine')||'native';}catch{} }
  ic(name,cls){return this.icon?this.icon(name,cls):'';}
  active(){return !!this.installing||['connecting','recording','transcribing'].includes(this.state.status);}
  async request(action,extra={},signal){
    const response=await fetch('/api/local-speech',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({...this.context,action,...extra}),signal});
    const data=await response.json();if(!response.ok)throw Error(data.error||'Local speech unavailable.');return data.result;
  }
  async start(context){
    if(this.active())return;
    this.stopSpeaking();this.context=context;this.enabled=true;this.repliesEnabled=true;this.state={status:'connecting',message:'Checking local speech…'};const generation=++this.generation;this.onChange();
    this.captureAbort=new AbortController();
    try{
      const readiness=this.engine==='managed'?(this.readiness||{configured:false}):await this.request('status',{},this.captureAbort.signal);if(generation!==this.generation)return;
      this.readiness=readiness;
      if(this.engine==='managed'&&!this.managed?.ready){
        this.managed ||=new ManagedSpeech();
        try{await this.managed.call('load',undefined,{cachedOnly:true});}
        catch{if(generation!==this.generation)return;this.state={status:'setup',message:'Local voice needs setup. Download or restore the model below, then test your microphone.'};this.setupOpen=true;this.enabled=false;this.testRecording=false;this.onChange();return;}
        if(generation!==this.generation)return;
      }
      if(this.engine!=='managed'&&!readiness.configured){this.state={status:'setup',message:readiness.message};this.setupOpen=true;this.enabled=false;this.onChange();return;}
      this.backend=readiness.message;
      const mic=await navigator.mediaDevices.getUserMedia({audio:{...(this.deviceId?{deviceId:{exact:this.deviceId}}:{}),channelCount:{ideal:2},echoCancellation:false,noiseSuppression:false,autoGainControl:false},video:false});
      if(generation!==this.generation){mic.getTracks().forEach(t=>t.stop());return;}
      this.mic=mic;const track=mic.getAudioTracks()[0];this.inputName=track?.label||'System default microphone';
      this.devices=(await navigator.mediaDevices.enumerateDevices()).filter(d=>d.kind==='audioinput');
      if(generation!==this.generation)return;
      track.onended=()=>{if(generation===this.generation&&this.state.status==='recording'){this.release();this.state={status:'error',message:'Microphone disconnected. Choose an input and record again.'};this.onChange();}};
      this.audio=new AudioContext();await this.audio.resume();this.sampleRate=this.audio.sampleRate;this.chunks=[];this.sampleCount=0;this.level=0;this.peak=0;
      const source=`const chooseChannel=${microphoneChannel.toString()};class LocalVoiceCapture extends AudioWorkletProcessor { process(inputs){const samples=chooseChannel(inputs[0]||[]);if(samples)this.port.postMessage(samples.slice());return true;} } registerProcessor('local-voice-capture',LocalVoiceCapture);`;
      const url=URL.createObjectURL(new Blob([source],{type:'text/javascript'}));try{await this.audio.audioWorklet.addModule(url);}finally{URL.revokeObjectURL(url);}
      if(generation!==this.generation)return;
      this.node=new AudioWorkletNode(this.audio,'local-voice-capture',{channelCountMode:'max',channelInterpretation:'discrete'});this.source=this.audio.createMediaStreamSource(mic);this.source.connect(this.node);
      this.gain=this.audio.createGain();this.gain.gain.value=0;this.node.connect(this.gain).connect(this.audio.destination);
      this.node.port.onmessage=e=>{if(generation!==this.generation||this.state.status!=='recording')return;const room=Math.floor(this.sampleRate*30)-this.sampleCount;const chunk=e.data.subarray(0,room);this.chunks.push(chunk);this.sampleCount+=chunk.length;const signal=microphoneSignal(chunk);this.peak=Math.max(this.peak,signal.peak);this.level=signal.rms;if(!this.meterAt||performance.now()-this.meterAt>100){this.meterAt=performance.now();this.paintLevel();}if(this.sampleCount>=this.sampleRate*30)this.finishRecording();};
      this.recordStart=performance.now();this.state={status:'recording',message:'Listening · tap stop to review your words before sending.'};this.onChange();
      this.timer=setTimeout(()=>this.finishRecording(),30000);
    }catch(e){if(generation===this.generation){this.release();this.enabled=false;this.testRecording=false;this.errorCode=voiceRecovery(e).code;this.state={status:'error',message:voiceRecovery(e).message};this.setupOpen=true;this.onChange();}}
  }
  release(){clearTimeout(this.timer);this.mic?.getTracks().forEach(t=>t.stop());this.source?.disconnect();this.node?.disconnect();this.gain?.disconnect();this.audio?.close().catch(()=>{});this.audio=null;this.mic=null;this.chunks=[];}
  async finishRecording(){
    if(this.state.status!=='recording')return;const generation=this.generation;
    const samples=new Float32Array(this.sampleCount);let offset=0;for(const chunk of this.chunks){samples.set(chunk,offset);offset+=chunk.length;}
    this.release();this.state={status:'transcribing',message:'Transcribing locally…'};this.onChange();
    try{
      if(samples.length<this.sampleRate*0.25)throw Error('Recording was too short. Try again.');
      if(microphoneSignal(samples).silent)throw Error(`No microphone signal received from ${this.inputName||'the selected input'}. Choose your microphone below and check its hardware mute and input gain.`);
      let result;
      if(this.engine==='managed'){
        const wave=speechWave(samples,this.sampleRate),view=new DataView(wave.buffer),pcm=Float32Array.from({length:(wave.length-44)/2},(_,i)=>view.getInt16(44+i*2,true)/32768);
        result=await this.managed.call('transcribe',pcm);
      }else result=await this.request('transcribe',{audio:base64(speechWave(samples,this.sampleRate))},this.captureAbort.signal);
      if(generation!==this.generation)return;
      if(!result.text?.trim())throw Error('No words were recognized. Try again.');
      if(this.testRecording){this.testTranscript=result.text;this.testRecording=false;this.state={status:'ready',message:'Microphone test transcribed locally. Review it below; nothing was sent.'};}
      else{this.state={status:'ready',message:'Transcript added to your draft. Review it, then Send. Replies will be spoken.'};this.onTranscript(result.text,this.context);}
      this.onChange();
    }catch(e){if(generation===this.generation){this.errorCode=voiceRecovery(e).code;this.state={status:'error',message:voiceRecovery(e).message};this.onChange();}}
  }
  follow(proposalId,context){if(this.enabled||this.repliesEnabled)this.pending.set(proposalId,{...context});}
  updateRuns(runs){
    if(!this.enabled&&!this.repliesEnabled)return;
    for(const [id,context]of this.pending){
      const run=runs.find(r=>r.proposalId===id&&r.project===context.project&&r.slot===context.slot&&(r.provider||'codex')===context.provider);
      if(!run||!['completed','failed','cancelled','interrupted'].includes(run.status))continue;
      this.pending.delete(id);const text=spokenReply(run);if(text)this.queue.push({text,context});
    }
    if(!this.speaking&&this.queue.length)this.speakNext();
  }
  async speakNext(){
    if((!this.enabled&&!this.repliesEnabled)||this.active()||this.speaking)return;
    const next=this.queue.shift();if(!next)return;
    this.speaking=true;this.playAbort=new AbortController();const signal=this.playAbort.signal;
    this.state={status:'ready',message:'Preparing spoken reply…'};this.onChange();
    try{
      if(this.engine==='managed'){
        const voices=this.localVoices();if(!voices.length)throw Error('No local voice installed.');
        this.utterance=new SpeechSynthesisUtterance(next.text);this.utterance.voice=voices.find(v=>v.voiceURI===this.outputVoice)||voices.find(v=>v.lang.startsWith('en'))||voices[0];
        await new Promise((resolve,reject)=>{this.utterance.onstart=()=>{this.speakerTestStarted=true;this.state={status:'ready',message:'Speaking · full reply remains in chat.'};this.onChange();};this.utterance.onend=resolve;this.utterance.onerror=()=>reject(Error('Speech playback failed.'));signal.addEventListener('abort',resolve,{once:true});speechSynthesis.speak(this.utterance);});return;
      }
      const data=await this.request('speak',{...next.context,text:next.text},signal);if(signal.aborted||(!this.enabled&&!this.repliesEnabled))return;
      const bytes=Uint8Array.from(atob(data.audio),c=>c.charCodeAt(0));this.playURL=URL.createObjectURL(new Blob([bytes],{type:data.mime}));
      this.player=new Audio(this.playURL);this.state={status:'ready',message:'Speaking · full reply remains in chat.'};this.onChange();
      this.player.onplaying=()=>{this.speakerTestStarted=true;};
      await new Promise((resolve,reject)=>{this.player.onended=resolve;this.player.onerror=()=>reject(Error('Spoken audio could not play.'));signal.addEventListener('abort',resolve,{once:true});this.player.play().catch(reject);});
    }catch(e){if(!signal.aborted){this.errorCode=voiceRecovery(e).code;this.state={status:'error',message:voiceRecovery(e).message};this.onChange();}}
    finally{if(!signal.aborted){this.clearPlayer();this.speaking=false;if(this.state.status!=='error')this.state={status:'ready',message:'Voice ready · record your next message.'};this.onChange();this.speakNext();}}
  }
  clearPlayer(){this.player?.pause();this.player=null;if(this.playURL)URL.revokeObjectURL(this.playURL);this.playURL=null;}
  stopSpeaking(){this.playAbort?.abort();if(this.utterance){globalThis.speechSynthesis?.cancel();this.utterance=null;}this.clearPlayer();this.speaking=false;this.queue=[];}
  stop(){++this.generation;this.captureAbort?.abort();this.release();this.stopSpeaking();if(this.installing||['connecting','transcribing'].includes(this.state.status)&&this.engine==='managed')this.managed?.stop();this.installing=false;this.testRecording=false;this.pending.clear();this.enabled=false;this.repliesEnabled=false;this.state={status:'idle'};this.onChange();}
  localVoices(){return globalThis.speechSynthesis?.getVoices().filter(v=>v.localService)||[];}
  async setup(context){
    if(this.active())return;
    if(!this.voicesListener&&globalThis.speechSynthesis){this.voicesListener=()=>{if(this.setupOpen)this.onChange();};speechSynthesis.addEventListener('voiceschanged',this.voicesListener);}this.context=context;this.setupOpen=true;
    try{this.readiness=await this.request('status');this.state={status:'setup',message:this.readiness.configured?'Your current local backend is ready. Test microphone and speakers below.':'Choose Install local voice. No API key or command-line setup is required.'};}
    catch(e){this.state={status:'error',message:e.message};}
    this.onChange();
  }
  async install(){
    if(this.installing||this.active())return;this.installing=true;this.errorCode=null;this.state={status:'setup',message:'Downloading local speech model…'};const generation=this.generation;this.onChange();
    this.managed ||=new ManagedSpeech();
    this.managed.onProgress=p=>{this.installProgress=p.progress!=null?Math.round(p.progress):null;this.state.message=p.progress!=null?`Downloading speech model · ${Math.round(p.progress)}% of current file`:'Preparing local speech…';this.onChange();};
    try{await this.managed.call('load');if(generation!==this.generation)return;this.engine='managed';try{localStorage.setItem('agent-world-voice-engine','managed');}catch{}this.enabled=true;this.state={status:'ready',message:'Local transcription installed. Test the microphone and speakers below.'};}
    catch(e){if(generation===this.generation){this.errorCode='model_unavailable';this.state={status:'error',message:voiceRecovery(e).message};}}
    finally{this.installing=false;this.onChange();}
  }
  async diagnostics(){
    let permission='unknown';try{permission=(await navigator.permissions.query({name:'microphone'})).state;}catch{}
    return voiceDiagnostics({...this.readiness,backend:this.engine==='managed'?'in-app-wasm':this.readiness?.backend,ready:this.engine==='managed'?this.managed?.ready&&this.localVoices().length>0:this.readiness?.configured,permission,modelReady:this.managed?.ready,inputSignal:this.peak>=0.0001,transcriptTest:!!this.testTranscript,speakerConfirmed:this.speakerConfirmed,localVoices:this.localVoices().length,errorCode:this.errorCode});
  }
  toggleReplies(context){
    this.repliesEnabled=!this.repliesEnabled;this.context=context;
    if(!this.repliesEnabled){this.enabled=false;this.pending.clear();this.stopSpeaking();if(!this.active())this.state={status:'idle'};}
    this.onChange();
  }
  readReply(text,context){
    if(this.active())return;
    this.stopSpeaking();this.context=context;this.repliesEnabled=true;
    this.queue.push({text:text.slice(0,3900),context});this.speakNext();
  }
  async copyDiagnostics(){
    this.diagnosticReport=JSON.stringify(await this.diagnostics(),null,2);
    try{await navigator.clipboard.writeText(this.diagnosticReport);this.state.message='Voice diagnostics copied. No audio, transcripts, device IDs or credentials included.';}
    catch{this.state.message='Select the diagnostics report below and press Command+C (Mac) or Ctrl+C to copy. No audio, transcripts, device IDs or credentials included.';}
    this.onChange();
  }
  /** Live input: the composer button's ring, the strip's bars and timer, and the setup dialog's meter. */
  paintLevel(){
    const level=Math.min(1,Math.sqrt(this.level||0)*3);
    for(const root of [this.host?.closest('form'),this.host,this.setupDialog])root?.style.setProperty('--level',level.toFixed(3));
    const time=this.host?.querySelector('[data-voice-time]');
    if(time&&this.recordStart){const s=Math.floor((performance.now()-this.recordStart)/1000);time.textContent=`${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`;}
    const signal=this.setupDialog?.querySelector('[data-mic-signal]');
    if(signal)signal.textContent=this.level>=0.0001?'Hearing you':this.peak>=0.0001?'Waiting for speech…':'No sound yet — check the input below';
  }
  /** The composer's mic button follows the voice state: mic → stop while listening → waveform while transcribing. */
  paintButton(button){
    if(!button)return;
    const s=this.state.status,testing=this.testRecording;
    const mode=this.installing?'busy':s==='recording'&&!testing?'recording':s==='transcribing'&&!testing?'transcribing':s==='connecting'&&!testing?'busy':'idle';
    button.dataset.voiceState=mode;
    button.innerHTML=mode==='recording'?this.ic('square'):mode==='transcribing'?BARS:mode==='busy'?this.ic('loaderCircle','spin'):this.ic('mic');
    const label={recording:'Stop recording',transcribing:'Transcribing…',busy:'Starting microphone…',idle:'Record voice message'}[mode];
    button.setAttribute('aria-label',label);button.title=label;
  }
  mount(host,context){
    this.nextContext=context;
    this.host=host;
    if(!host)return;
    this.paintButton(host.closest('form')?.querySelector('[data-voice]'));
    host.replaceChildren();
    this.renderSetup();
    const s=this.state.status;
    if(s==='idle'||s==='setup'||this.testRecording||(this.setupOpen&&s!=='recording'))return;
    // One slim line under the composer: what voice is doing right now.
    const strip=document.createElement('div');strip.className=`voice-strip is-${this.speaking?'speaking':s}`;strip.setAttribute('role','status');
    const act=(html,label,fn,cls='')=>{const b=document.createElement('button');b.type='button';b.className=`voice-strip-btn ${cls}`;b.innerHTML=html;b.setAttribute('aria-label',label);b.title=label;b.onclick=fn;strip.append(b);};
    if(s==='recording'){strip.innerHTML=`<span class="voice-rec-dot"></span><b>Listening</b><time data-voice-time>0:00</time>${BARS}<small>Tap stop when you’re done</small>`;act(this.ic('x'),'Cancel recording',()=>this.stop());}
    else if(s==='connecting')strip.innerHTML=`${this.ic('loaderCircle','spin')}<b>Starting microphone…</b>`;
    else if(s==='transcribing')strip.innerHTML=`${BARS}<b>Transcribing</b><small>on this computer</small>`;
    else if(this.speaking){strip.innerHTML=`${this.ic('volume2')}<b>Speaking reply</b>${BARS}`;act(this.ic('square'),'Stop speaking',()=>{this.stopSpeaking();this.state={status:'ready',message:'Playback stopped.'};this.onChange();});}
    else if(s==='error'){strip.innerHTML=`${this.ic('circleAlert')}<span>${esc(this.state.message)}</span>`;act(`${this.ic('settings2')}<span>Fix</span>`,'Open voice settings',()=>this.setup(this.nextContext||this.context),'labelled');}
    else{strip.innerHTML=`${this.ic('check')}<span>${esc(this.state.message)}</span>`;strip.classList.add('fade');}
    host.append(strip);this.paintLevel();
  }
  /** Voice settings: model, microphone, speakers and spoken replies, in one dialog over the prompter. */
  renderSetup(){
    if(typeof document==='undefined')return;
    if(!this.setupOpen){if(this.setupDialog?.open)this.setupDialog.close();return;}
    if(!this.setupDialog){
      this.setupDialog=document.createElement('dialog');this.setupDialog.className='voice-setup-dialog';this.setupDialog.setAttribute('aria-label','Voice settings');document.body.append(this.setupDialog);
      this.setupDialog.addEventListener('close',()=>{if(this.setupOpen&&!this.closingSetup){this.setupOpen=false;this.testTranscript='';if(this.testRecording)this.stop();else this.onChange();}this.closingSetup=false;});
      this.setupDialog.addEventListener('click',e=>{if(e.target===this.setupDialog)this.setupDialog.close();const b=e.target.closest('[data-vs]');if(!b||b.disabled)return;this.setupAction(b.dataset.vs);});
      this.setupDialog.addEventListener('change',e=>{if(e.target.name==='mic')this.deviceId=e.target.value;if(e.target.name==='speaker')this.outputVoice=e.target.value;});
      this.refreshDevices();
    }
    const d=this.setupDialog,s=this.state.status,busy=this.installing||this.active();
    const modelReady=this.engine==='managed'?!!this.managed?.ready:!!this.readiness?.configured;
    const micDone=!!this.testTranscript,spkDone=!!this.speakerConfirmed,testing=this.testRecording&&['connecting','recording','transcribing'].includes(s);
    const tone=s==='error'?'error':this.installing?'info':modelReady&&micDone&&spkDone?'ok':'info';
    const step=(n,done,title,sub,body)=>`<li class="vs-step${done?' done':''}"><span class="vs-num">${done?this.ic('check'):n}</span><div><b>${title}</b><small>${sub}</small>${body}</div></li>`;
    const devices=this.devices.filter(x=>x.deviceId&&x.deviceId!=='default'&&x.deviceId!=='communications');
    const voices=this.localVoices();
    const model=this.installing
      ?`<div class="vs-progress"><i style="width:${this.installProgress??8}%"></i></div><div class="vs-row"><span class="vs-note">${esc(this.state.message)}</span><button type="button" class="vs-btn" data-vs="cancel-install">Cancel</button></div>`
      :modelReady?`<div class="vs-row"><span class="vs-chip ok">${this.ic('check')} Ready</span>${this.engine==='managed'?'<button type="button" class="vs-btn ghost" data-vs="install">Reload</button>':''}</div>`
      :`<div class="vs-row"><button type="button" class="vs-btn primary" data-vs="install" ${busy?'disabled':''}>${this.ic('download')} Download · ~60 MB</button>${this.readiness?.configured?'<button type="button" class="vs-btn ghost" data-vs="native">Use existing backend</button>':''}</div>`;
    const mic=`<div class="vs-row"><select name="mic" aria-label="Microphone" ${busy?'disabled':''}><option value="">System default</option>${devices.map(x=>`<option value="${esc(x.deviceId)}" ${x.deviceId===this.deviceId?'selected':''}>${esc(x.label||'Audio input')}</option>`).join('')}</select>${testing&&s==='recording'?`<button type="button" class="vs-btn danger" data-vs="stop-test">${this.ic('square')} Stop</button>`:`<button type="button" class="vs-btn" data-vs="test-mic" ${busy||!modelReady?'disabled':''}>${this.ic('mic')} Test</button>`}</div>`
      +(testing?`<div class="vs-meter">${s==='transcribing'?`${BARS}<span>Transcribing…</span>`:`<span class="vs-level"><i></i></span><span data-mic-signal>${s==='connecting'?'Starting…':'Say a sentence'}</span>`}</div>`:this.testTranscript?`<blockquote class="vs-quote">“${esc(this.testTranscript)}”</blockquote>`:'');
    const spk=`<div class="vs-row">${this.engine==='managed'&&voices.length?`<select name="speaker" aria-label="Speaking voice">${voices.map(v=>`<option value="${esc(v.voiceURI)}" ${v.voiceURI===this.outputVoice?'selected':''}>${esc(v.name)}</option>`).join('')}</select>`:''}<button type="button" class="vs-btn" data-vs="test-speaker" ${busy?'disabled':''}>${this.ic('volume2')} Play test</button>${this.speakerTestStarted&&!spkDone?'<button type="button" class="vs-btn primary" data-vs="heard">I heard it</button>':''}</div>${this.engine==='managed'&&!voices.length?'<p class="vs-note">No local system voice found. Add an English voice in your system speech settings.</p>':''}`;
    d.innerHTML=`<header class="vs-head"><span class="vs-badge">${this.ic('audioLines')}</span><div><h2>Voice</h2><small>Talk instead of typing. Audio never leaves this computer.</small></div><button type="button" class="icon-btn" data-vs="close" aria-label="Close voice settings">${this.ic('x')}</button></header>
      ${this.state.message&&s!=='idle'?`<p class="vs-status ${tone}" role="status">${this.ic(tone==='error'?'circleAlert':tone==='ok'?'check':'info')}<span>${esc(this.state.message)}</span></p>`:''}
      <ol class="vs-steps">
        ${step(1,modelReady,'Speech model','English transcription that runs on your device.',model)}
        ${step(2,micDone,'Microphone',micDone?'Heard you clearly.':'Pick your mic and say a test sentence.',mic)}
        ${step(3,spkDone,'Speakers',spkDone?'Confirmed.':'Play a short sentence to check you can hear replies.',spk)}
      </ol>
      <button type="button" class="vs-toggle" data-vs="replies" role="switch" aria-checked="${!!this.repliesEnabled}"><span><b>Read replies aloud</b><small>Speak each reply when it arrives</small></span><i></i></button>
      <details class="vs-about"><summary>About the speech model &amp; diagnostics</summary><p>Whisper tiny.en (Apache-2.0), ONNX conversion from onnx-community/whisper-tiny.en, downloaded once from Hugging Face (~41 MB of weights, ~60 MB with runtime) and cached. Recordings are transcribed on this device; no API key. Clearing app data may require another download.</p><button type="button" class="vs-btn ghost" data-vs="diagnostics">Copy diagnostics</button>${this.diagnosticReport?`<textarea readonly rows="6" aria-label="Voice diagnostics report">${esc(this.diagnosticReport)}</textarea>`:''}</details>
      <footer class="vs-foot"><button type="button" class="vs-btn primary" data-vs="done" ${this.installing?'':''}>${modelReady?'Done':'Close'}</button></footer>`;
    if(!d.open)d.showModal();
    this.paintLevel();
  }
  closeSetup(){this.setupOpen=false;this.testTranscript='';if(this.setupDialog?.open)this.setupDialog.close();}
  async refreshDevices(){try{this.devices=(await navigator.mediaDevices.enumerateDevices()).filter(x=>x.kind==='audioinput');if(this.setupOpen)this.renderSetup();}catch{}}
  setupAction(a){
    const ctx=this.nextContext||this.context;
    if(a==='close'||a==='done'){const testing=this.testRecording;this.closeSetup();if(testing)this.stop();else this.onChange();return;}
    if(a==='install')this.install();
    else if(a==='cancel-install'){++this.generation;this.managed?.stop();this.installing=false;this.state={status:'setup',message:'Download cancelled. You can retry; partial cache may be reused.'};this.onChange();}
    else if(a==='native'){this.engine='native';try{localStorage.setItem('agent-world-voice-engine','native');}catch{}this.state={status:'ready',message:'Using your existing local speech backend.'};this.onChange();}
    else if(a==='test-mic'){this.testRecording=true;this.testTranscript='';this.start(ctx).then(()=>this.refreshDevices());}
    else if(a==='stop-test')this.finishRecording();
    else if(a==='test-speaker'){this.speakerConfirmed=false;this.speakerTestStarted=false;this.readReply('This is the Agent World speaker test. If you can hear this sentence, you are all set.',ctx);}
    else if(a==='heard'){this.speakerConfirmed=true;this.onChange();}
    else if(a==='replies')this.toggleReplies(ctx);
    else if(a==='diagnostics')this.copyDiagnostics();
  }
}

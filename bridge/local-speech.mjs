import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {findCommand} from './providers.mjs';

const execute=promisify(execFile);
const MAX_AUDIO=960044; // 30 seconds, 16 kHz mono PCM16 WAV.
export function pcmWave(data){
  if(typeof data!=='string'||data.length>Math.ceil(MAX_AUDIO/3)*4||!data||!/^[A-Za-z0-9+/]+={0,2}$/.test(data))throw Error('Invalid voice recording.');
  const bytes=Buffer.from(data,'base64');
  if(bytes.length<46||bytes.length>MAX_AUDIO||bytes.toString('ascii',0,4)!=='RIFF'||bytes.toString('ascii',8,12)!=='WAVE'||bytes.toString('ascii',12,16)!=='fmt '||bytes.readUInt32LE(16)!==16||bytes.readUInt16LE(20)!==1||bytes.readUInt16LE(22)!==1||bytes.readUInt32LE(24)!==16000||bytes.readUInt32LE(28)!==32000||bytes.readUInt16LE(32)!==2||bytes.readUInt16LE(34)!==16||bytes.toString('ascii',36,40)!=='data'||bytes.readUInt32LE(40)!==bytes.length-44||bytes.readUInt32LE(4)!==bytes.length-8||bytes.length%2)throw Error('Record up to 30 seconds of mono 16 kHz PCM audio.');
  return bytes;
}
export function localSpeechURL(value){
  const url=new URL(value);
  if(url.protocol!=='http:'||!['127.0.0.1','localhost','[::1]'].includes(url.hostname)||url.username||url.password||url.search||url.hash||url.pathname!=='/')throw Error('VoiceStudio must use a loopback HTTP address, such as http://127.0.0.1:3900.');
  return url.origin;
}

// VoiceStudio integration uses its documented API, without copying application code.
// A small native macOS provider is available when the full studio is not installed.
export class LocalSpeech {
  constructor({directory,env=process.env,platform=process.platform,run=execute,fetcher=fetch}={}){
    this.directory=directory;this.env=env;this.platform=platform;this.run=run;this.fetcher=fetcher;this.busy=false;
  }
  settings(){
    let saved={};try{saved=JSON.parse(fs.readFileSync(path.join(this.directory,'speech.json'),'utf8'));}catch(e){if(e.code!=='ENOENT')throw Error('Local speech configuration is invalid. Check speech.json.');}
    const url=this.env.AGENT_WORLD_VOICESTUDIO_URL||saved.voicestudioURL;
    return {url:url?localSpeechURL(url):null,model:this.env.AGENT_WORLD_WHISPER_MODEL||saved.whisperModel||path.join(this.directory,'models','ggml-tiny.en.bin'),ttsModel:saved.ttsModel||'tts-1',voice:saved.voice||'default'};
  }
  command(name){return findCommand(name,this.env,this.platform)||(['whisper-cli','ffmpeg'].includes(name)&&this.platform==='darwin'?findCommand('/opt/homebrew/bin/'+name,this.env,this.platform):null);}
  status(){
    const settings=this.settings();
    if(settings.url)return {backend:'voicestudio',configured:true,message:'VoiceStudio local backend selected. Models must be installed in VoiceStudio.'};
    const transcribe=!!this.command('whisper-cli')&&fs.existsSync(settings.model),speak=this.platform==='darwin'&&fs.existsSync('/usr/bin/say')&&!!this.command('ffmpeg');
    return {backend:'native',configured:transcribe&&speak,transcribe,speak,message:transcribe&&speak?'Local Whisper · macOS voice':!transcribe?'Local speech needs whisper-cli and a Whisper model. See docs/LOCAL_VOICE.md.':'Local spoken replies need macOS say and ffmpeg, or a configured VoiceStudio backend.'};
  }
  async remote(route,options,signal){
    const timeout=AbortSignal.timeout(90000);
    const controller=new AbortController();const abort=()=>controller.abort();
    signal?.addEventListener('abort',abort,{once:true});timeout.addEventListener('abort',abort,{once:true});if(signal?.aborted)abort();
    try{
      const response=await this.fetcher(this.settings().url+route,{...options,signal:controller.signal,redirect:'error'});
      if(!response.ok)throw Error(`VoiceStudio returned HTTP ${response.status}. Check its backend and installed speech models.`);
      const reader=response.body.getReader();const chunks=[];let size=0;
      for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>16*1024*1024){await reader.cancel();throw Error('VoiceStudio audio response is too large.');}chunks.push(Buffer.from(value));}
      return {bytes:Buffer.concat(chunks),type:response.headers.get('content-type')||''};
    }catch(e){if(e.message.startsWith('VoiceStudio'))throw e;throw Error(controller.signal.aborted?'Local speech was cancelled or timed out.':'Cannot reach VoiceStudio. Open its backend and check the configured loopback address.');}
    finally{signal?.removeEventListener('abort',abort);timeout.removeEventListener('abort',abort);}
  }
  async perform(action,input,{signal}={}){
    if(action==='status'){
      const status=this.status();
      if(status.backend==='voicestudio')await this.remote('/health',{method:'GET'},signal);
      return status;
    }
    if(!['transcribe','speak'].includes(action))throw Error('Unknown local speech action.');
    if(this.busy)throw Error('Local speech is busy. Wait for the current recording or reply.');
    const settings=this.settings();const bytes=action==='transcribe'?pcmWave(input.audio):null;
    if(action==='speak'&&(typeof input.text!=='string'||!input.text.trim()||input.text.length>4000))throw Error('Choose a reply of up to 4,000 characters.');
    const requestSignal=signal,operation=new AbortController(),cancel=()=>operation.abort();
    requestSignal?.addEventListener('abort',cancel,{once:true});if(requestSignal?.aborted)cancel();
    this.operation=operation;signal=operation.signal;
    this.busy=true;let temporary;
    try{
      if(settings.url){
        if(action==='transcribe'){
          const form=new FormData();form.append('file',new Blob([bytes],{type:'audio/wav'}),'recording.wav');form.append('model','whisper-1');form.append('response_format','json');
          const reply=await this.remote('/v1/audio/transcriptions',{method:'POST',body:form},signal);
          let data;try{data=JSON.parse(reply.bytes.toString());}catch{throw Error('VoiceStudio returned an invalid transcript.');}
          if(typeof data.text!=='string'||data.text.length>12000)throw Error('VoiceStudio returned an invalid transcript.');
          return {text:data.text.trim()};
        }
        const reply=await this.remote('/v1/audio/speech',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({model:settings.ttsModel,voice:settings.voice,input:input.text,response_format:'wav'})},signal);
        if(!reply.type.startsWith('audio/')||reply.bytes.length<44)throw Error('VoiceStudio did not return playable audio.');
        return {audio:reply.bytes.toString('base64'),mime:reply.type};
      }
      const status=this.status();if(!status[action==='speak'?'speak':'transcribe'])throw Error(status.message);
      temporary=fs.mkdtempSync(path.join(os.tmpdir(),'agent-world-speech-'));fs.chmodSync(temporary,0o700);
      this.temporary=temporary;
      const options={timeout:90000,maxBuffer:1024*1024,signal,windowsHide:true};
      if(action==='transcribe'){
        const file=path.join(temporary,'input.wav'),output=path.join(temporary,'transcript');fs.writeFileSync(file,bytes,{mode:0o600});
        await this.run(this.command('whisper-cli'),['-m',settings.model,'-f',file,'-l','en','-t','4','-nt','-np','-otxt','-of',output],options);
        const text=fs.readFileSync(output+'.txt','utf8').trim().slice(0,12000);
        return {text};
      }
      const textFile=path.join(temporary,'reply.txt'),audioFile=path.join(temporary,'reply.aiff'),wave=path.join(temporary,'reply.wav');
      fs.writeFileSync(textFile,input.text,{mode:0o600});
      await this.run('/usr/bin/say',['-f',textFile,'-o',audioFile],options);
      await this.run(this.command('ffmpeg'),['-nostdin','-v','error','-i',audioFile,'-ar','24000','-ac','1','-c:a','pcm_s16le',wave],options);
      const audio=fs.readFileSync(wave);if(audio.length>16*1024*1024)throw Error('Spoken reply is too long.');
      return {audio:audio.toString('base64'),mime:'audio/wav'};
    }catch(e){if(e.code||e.name==='AbortError'||e.killed)throw Error(signal?.aborted?'Local speech cancelled.':'Local speech failed. Check the installed model and speech tools.');throw e;}
    finally{if(temporary)fs.rmSync(temporary,{recursive:true,force:true});this.temporary=null;this.operation=null;requestSignal?.removeEventListener('abort',cancel);this.busy=false;}
  }
  stop(){this.operation?.abort();if(this.temporary)fs.rmSync(this.temporary,{recursive:true,force:true});}
}

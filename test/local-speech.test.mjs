import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {LocalSpeech,localSpeechURL,pcmWave} from '../bridge/local-speech.mjs';
import {speechWave,spokenReply,microphoneChannel,microphoneSignal} from '../shared/speech-audio.mjs';
import {LocalVoiceChat} from '../web/src/local-voice.js';

const wave=()=>Buffer.from(speechWave(new Float32Array(16000).fill(0.1),16000));
function directory(t){const dir=fs.mkdtempSync(path.join(os.tmpdir(),'aw-local-speech-test-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));return dir;}
function remote(t,fetcher){return new LocalSpeech({directory:directory(t),env:{AGENT_WORLD_VOICESTUDIO_URL:'http://127.0.0.1:3900'},fetcher});}

test('recording resamples to bounded mono PCM and rejects malformed or oversized audio',()=>{
  const samples=new Float32Array(48000).fill(0.5),encoded=Buffer.from(speechWave(samples,48000));
  assert.equal(encoded.length,32044);assert.equal(encoded.readInt16LE(44),16384);assert.deepEqual(pcmWave(encoded.toString('base64')),encoded);
  assert.throws(()=>pcmWave('not audio'),/Invalid/);
  const bad=Buffer.from(encoded);bad.writeUInt32LE(48000,24);assert.throws(()=>pcmWave(bad.toString('base64')),/16 kHz/);
  assert.throws(()=>speechWave(new Float32Array(16000*31),16000),/30 seconds/);
  assert.throws(()=>pcmWave(Buffer.alloc(1000000).toString('base64')),/Invalid/);
});
test('VoiceStudio destinations are local only and never contain credentials or path overrides',()=>{
  assert.equal(localSpeechURL('http://localhost:3900'),'http://localhost:3900');
  for(const url of ['https://cloud.example','http://192.168.1.2:3900','http://127.0.0.1:3900/api','http://user:secret@localhost:3900','http://localhost:3900/?token=secret'])assert.throws(()=>localSpeechURL(url),/loopback/);
});
test('VoiceStudio uses documented multipart transcription and WAV speech contracts; health is checked before capture',async t=>{
  const requests=[];const service=remote(t,async(url,options)=>{requests.push({url,options});return url.endsWith('/speech')?new Response(wave(),{headers:{'content-type':'audio/wav'}}):Response.json(url.endsWith('/health')?{status:'ok'}:{text:' Actual words '});});
  assert.equal((await service.perform('status',{})).backend,'voicestudio');
  assert.equal((await service.perform('transcribe',{audio:wave().toString('base64')})).text,'Actual words');
  const reply=await service.perform('speak',{text:'Actual reply'});assert.equal(reply.mime,'audio/wav');
  assert.match(requests[0].url,/\/health$/);const form=requests[1].options.body;assert.equal(form.get('model'),'whisper-1');assert.equal(form.get('file').size,wave().length);
  const payload=JSON.parse(requests[2].options.body);assert.equal(payload.input,'Actual reply');assert.equal(payload.response_format,'wav');assert.equal(requests[2].options.redirect,'error');
  assert.deepEqual(fs.readdirSync(service.directory),[]);
});
test('unavailable backend, missing models, non-audio errors and concurrent work never become invented success',async t=>{
  let service=remote(t,async()=>{throw Error('connection refused');});await assert.rejects(service.perform('status',{}),/Cannot reach/);
  service=remote(t,async()=>new Response('model missing',{status:503}));await assert.rejects(service.perform('speak',{text:'Hi'}),/HTTP 503/);
  service=remote(t,async()=>Response.json({error:'bad'}));await assert.rejects(service.perform('speak',{text:'Hi'}),/playable/);await assert.rejects(service.perform('transcribe',{audio:wave().toString('base64')}),/invalid transcript/);
  let release;service=remote(t,()=>new Promise(resolve=>release=resolve));const first=service.perform('speak',{text:'First'});
  await assert.rejects(service.perform('speak',{text:'Second'}),/busy/);release(new Response(wave(),{headers:{'content-type':'audio/wav'}}));await first;assert.equal(service.busy,false);
});
test('native transcription uses literal argument arrays and removes transient audio after success and failure',async t=>{
  const dir=directory(t),model=path.join(dir,'model.bin');fs.writeFileSync(model,'fixture');let transient;
  const service=new LocalSpeech({directory:dir,env:{AGENT_WORLD_WHISPER_MODEL:model},run:async(command,args,options)=>{
    assert.equal(command,'/fixture/whisper');assert.equal(options.timeout,90000);assert.equal(args[1],model);transient=path.dirname(args[3]);assert.ok(fs.existsSync(args[3]));fs.writeFileSync(args.at(-1)+'.txt','Verified fixture transcript');
  }});service.command=name=>name==='whisper-cli'?'/fixture/whisper':null;
  assert.equal((await service.perform('transcribe',{audio:wave().toString('base64')})).text,'Verified fixture transcript');assert.equal(fs.existsSync(transient),false);
  service.run=async()=>{throw Object.assign(Error('private stderr'),{code:1});};await assert.rejects(service.perform('transcribe',{audio:wave().toString('base64')}),/Check the installed/);assert.equal(service.busy,false);
});
test('voice reads only explicitly followed completed replies for the exact resident and provider, once',()=>{
  const voice=new LocalVoiceChat(()=>{},()=>{throw Error('No transcript should be inserted');});voice.enabled=true;voice.speaking=true;
  const context={project:'/fixture',slot:1,provider:'claude'};voice.follow('approved',context);
  const run={id:'run',proposalId:'approved',...context,status:'running',result:{summary:'Hello',limitations:['Check the work.']}};
  voice.updateRuns([{...run,status:'completed',slot:2},{...run,status:'completed',provider:'codex'},run]);assert.equal(voice.queue.length,0);
  run.status='completed';voice.updateRuns([run]);voice.updateRuns([run]);assert.equal(voice.queue.length,1);assert.match(voice.queue[0].text,/Hello\nLimitations/);
  voice.follow('failed',context);voice.updateRuns([{...run,proposalId:'failed',status:'failed'}]);assert.equal(voice.queue.length,1);
  assert.equal(spokenReply({...run,status:'cancelled'}),'');
  voice.stop();assert.equal(voice.enabled,false);assert.equal(voice.pending.size,0);assert.equal(voice.queue.length,0);
});
test('shutdown aborts native speech and removes temporary microphone files before process exit',async t=>{
  const dir=directory(t),model=path.join(dir,'model.bin');fs.writeFileSync(model,'fixture');let temporary,started;
  const ready=new Promise(resolve=>started=resolve);
  const service=new LocalSpeech({directory:dir,env:{AGENT_WORLD_WHISPER_MODEL:model},run:async(command,args,{signal})=>{
    temporary=path.dirname(args[3]);started();await new Promise((resolve,reject)=>signal.addEventListener('abort',()=>reject(Object.assign(Error('Aborted'),{name:'AbortError'})),{once:true}));
  }});service.command=()=>'/fixture/whisper';
  const pending=service.perform('transcribe',{audio:wave().toString('base64')});await ready;assert.ok(fs.existsSync(temporary));service.stop();assert.equal(fs.existsSync(temporary),false);await assert.rejects(pending,/cancelled/);assert.equal(service.busy,false);
});
test('finishing a recording inserts returned text into the draft only and never sends an agent prompt',async()=>{
  let transcript;const voice=new LocalVoiceChat(()=>{},text=>transcript=text);voice.state={status:'recording'};voice.enabled=true;voice.context={project:'/fixture',slot:1,provider:'codex'};voice.sampleRate=48000;voice.sampleCount=48000;voice.chunks=[new Float32Array(48000).fill(0.1)];voice.captureAbort=new AbortController();
  let requests=0;voice.request=async(action,body)=>{requests++;assert.equal(action,'transcribe');assert.equal(pcmWave(body.audio).length,32044);return {text:'Review me first'};};
  await voice.finishRecording();assert.equal(transcript,'Review me first');assert.equal(requests,1);assert.equal(voice.state.status,'ready');assert.equal(voice.pending.size,0);
});
test('cancel during transcription discards late text; silence never reaches the speech backend',async()=>{
  let inserted=false,resolve;const voice=new LocalVoiceChat(()=>{},()=>inserted=true);voice.state={status:'recording'};voice.sampleRate=16000;voice.sampleCount=16000;voice.chunks=[new Float32Array(16000).fill(0.1)];voice.captureAbort=new AbortController();voice.request=()=>new Promise(r=>resolve=r);
  const finish=voice.finishRecording();voice.stop();resolve({text:'Late result'});await finish;assert.equal(inserted,false);assert.equal(voice.state.status,'idle');
  voice.state={status:'recording'};voice.sampleCount=16000;voice.chunks=[new Float32Array(16000)];voice.request=()=>{throw Error('Must not reach backend');};await voice.finishRecording();assert.match(voice.state.message,/No microphone signal/);
});
test('USB and multichannel inputs preserve the active channel rather than silently using channel zero',()=>{
 const silent=new Float32Array(128),right=new Float32Array(128).fill(0.05),left=new Float32Array(128).fill(0.01);
 assert.equal(microphoneChannel([silent,right]),right);assert.equal(microphoneChannel([left,right]),right);assert.equal(microphoneChannel([]),null);
 assert.equal(microphoneChannel([right]),right);assert.equal(microphoneChannel([right,Float32Array.from(right,v=>-v)]),right);
});
test('spoken replies can be enabled without microphone capture and disabled without replaying pending work',()=>{
 const voice=new LocalVoiceChat(()=>{},()=>{}),context={project:'/fixture',slot:1,provider:'codex'};
 voice.toggleReplies(context);assert.equal(voice.repliesEnabled,true);assert.equal(voice.active(),false);
 voice.speaking=true;voice.follow('sent',context);voice.updateRuns([{proposalId:'sent',...context,status:'completed',result:{summary:'Spoken answer'}}]);assert.equal(voice.queue.length,1);
 voice.toggleReplies(context);assert.equal(voice.repliesEnabled,false);assert.equal(voice.pending.size,0);assert.equal(voice.queue.length,0);
});
test('read aloud queues only selected response text with the selected conversation context',()=>{
 const voice=new LocalVoiceChat(()=>{},()=>{}),context={project:'/fixture',slot:1,provider:'claude',thread:'owned'};let called=0;
 voice.speakNext=()=>called++;voice.readReply('A real returned answer',context);
 assert.equal(called,1);assert.equal(voice.repliesEnabled,true);assert.deepEqual(voice.queue,[{text:'A real returned answer',context}]);
});
test('quiet speech with long pauses is not rejected by a whole-recording volume threshold',async()=>{
 const samples=new Float32Array(16000*30);for(let i=0;i<16000;i++)samples[i]=0.001*Math.sin(i*0.1);
 assert.equal(microphoneSignal(samples).silent,false);assert.equal(microphoneSignal(new Float32Array(16000)).silent,true);
 const voice=new LocalVoiceChat(()=>{},()=>{});voice.state={status:'recording'};voice.sampleRate=16000;voice.sampleCount=samples.length;voice.chunks=[samples];voice.captureAbort=new AbortController();let requested=false;
 voice.request=async action=>{assert.equal(action,'transcribe');requested=true;return {text:'Quiet speech'};};await voice.finishRecording();assert.equal(requested,true);assert.equal(voice.state.status,'ready');
});

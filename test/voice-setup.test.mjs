import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import os from 'node:os';import path from 'node:path';
import {VOICE_MODEL,voiceRecovery,voiceDiagnostics} from '../shared/voice-setup.mjs';
import {LocalSpeech} from '../bridge/local-speech.mjs';import {LocalVoiceChat} from '../web/src/local-voice.js';import {ManagedSpeech} from '../web/src/managed-speech.js';
test('clean macOS/Windows/Linux homes report missing tools without requiring credentials or downloading',t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'aw-clean-voice-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 for(const platform of ['darwin','win32','linux']){const speech=new LocalSpeech({directory:dir,platform,env:{PATH:''}});speech.command=()=>null;const status=speech.status();assert.equal(status.configured,false);assert.equal(status.tools.whisper,false);assert.match(status.message,/No API key/);}
 assert.deepEqual(fs.readdirSync(dir),[]);
});
test('diagnostics omit sensitive inputs and arbitrary errors while retaining supported readiness fields',()=>{
 const result=voiceDiagnostics({appVersion:'0.1',platform:'win32',permission:'denied',tools:{whisper:true},transcript:'SECRET',deviceId:'SECRET',url:'SECRET',modelPath:'SECRET',credentials:'SECRET',error:'SECRET'});
 assert.doesNotMatch(JSON.stringify(result),/SECRET/);assert.equal(result.microphonePermission,'denied');assert.equal(result.apiKeyRequired,false);
});
test('recovery distinguishes permission, absent/busy inputs, signal, download and output failures',()=>{
 const expected={NotAllowedError:'microphone_permission',NotFoundError:'microphone_missing',OverconstrainedError:'microphone_missing',NotReadableError:'microphone_busy'};
 for(const [name,code]of Object.entries(expected))assert.equal(voiceRecovery({name}).code,code);
 assert.equal(voiceRecovery(Error('No microphone signal')).code,'microphone_signal');assert.equal(voiceRecovery(Error('model download failed')).code,'model_unavailable');assert.equal(voiceRecovery(Error('playback failed')).code,'playback');
 assert.equal(VOICE_MODEL.weightsBytes,40843851);assert.match(VOICE_MODEL.revision,/^[a-f0-9]{40}$/);
});
test('opening setup only checks status; no model download or microphone request occurs',async()=>{
 const voice=new LocalVoiceChat(()=>{},()=>{});let status=0;voice.request=async action=>{assert.equal(action,'status');status++;return {configured:false,platform:'win32'};};
 await voice.setup({project:'/fixture',slot:1,provider:'codex'});assert.equal(status,1);assert.equal(voice.setupOpen,true);assert.equal(voice.managed,undefined);assert.equal(voice.active(),false);
});
test('install failure is retryable and setup completion does not imply a microphone or speaker test',async()=>{
 const voice=new LocalVoiceChat(()=>{},()=>{});voice.managed={call:async()=>{throw Error('download failed');}};await voice.install();assert.equal(voice.errorCode,'model_unavailable');assert.equal(voice.installing,false);
 voice.managed={call:async()=>({ready:true})};await voice.install();assert.equal(voice.engine,'managed');assert.equal(voice.testTranscript,undefined);assert.equal(voice.speakerConfirmed,undefined);
});
test('microphone setup test keeps transcript in test UI and never inserts or submits a chat prompt',async()=>{
 const voice=new LocalVoiceChat(()=>{},()=>{throw Error('Must not insert test words in chat');});Object.assign(voice,{state:{status:'recording'},testRecording:true,sampleRate:16000,sampleCount:16000,chunks:[new Float32Array(16000).fill(.1)],captureAbort:new AbortController()});voice.request=async()=>({text:'Test words only'});
 await voice.finishRecording();assert.equal(voice.testTranscript,'Test words only');assert.equal(voice.pending.size,0);
});
test('worker cancellation rejects pending jobs and releases the model',async()=>{
 const speech=new ManagedSpeech();let terminated=false,rejected=false;speech.worker={terminate(){terminated=true;}};speech.ready=true;speech.jobs.set(1,{timer:setTimeout(()=>{},1000),reject(){rejected=true;}});speech.stop();assert.equal(terminated,true);assert.equal(rejected,true);assert.equal(speech.ready,false);assert.equal(speech.jobs.size,0);
});

test('diagnostics remain selectable when system clipboard access is unavailable',async()=>{
 const voice=new LocalVoiceChat(()=>{},()=>{});voice.diagnostics=async()=>voiceDiagnostics({platform:'darwin'});
 await voice.copyDiagnostics();assert.equal(JSON.parse(voice.diagnosticReport).apiKeyRequired,false);assert.match(voice.state.message,/copy|copied/i);
});

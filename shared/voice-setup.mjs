export const VOICE_MODEL={id:'onnx-community/whisper-tiny.en',revision:'2575352d61be1bf7225cf8f8b268a4678025fc58',weightsBytes:40843851,license:'Apache-2.0 (upstream Hugging Face model card)',language:'English'};
export function voiceRecovery(error){
 const name=error?.name||'',message=String(error?.message||error||'Voice unavailable.');
 if(name==='NotAllowedError')return {code:'microphone_permission',message:'Microphone permission is denied. Allow Agent World in your system microphone privacy settings, then reopen the app.'};
 if(name==='NotFoundError'||name==='OverconstrainedError')return {code:'microphone_missing',message:'The selected microphone is unavailable. Reconnect it or select System default and try again.'};
 if(name==='NotReadableError')return {code:'microphone_busy',message:'The microphone could not be opened. Close other recording apps, check the connection and retry.'};
 if(/signal|silent/i.test(message))return {code:'microphone_signal',message};
 if(/model|download|fetch|network|offline/i.test(message))return {code:'model_unavailable',message:'The local speech model could not load. Check your internet connection for setup, then retry the model download. Your draft is preserved.'};
 if(/play|speaker|voice.*installed/i.test(message))return {code:'playback',message:'Speech could not play. Check the system output and install a local system voice, then retry the speaker test.'};
 return {code:'speech_failed',message};
}
// Deliberately allowlisted: never copy paths, device names/IDs, recordings,
// transcripts, prompts, credentials, URLs, provider accounts or arbitrary errors.
export function voiceDiagnostics({appVersion='unknown',build='unknown',platform='unknown',backend='unknown',ready=false,tools={},permission='unknown',inputSignal=false,transcriptTest=false,speakerConfirmed=false,localVoices=0,modelReady=false,errorCode=null}={}){
 return {schema:1,appVersion,build,platform,backend,ready:!!ready,tools:{whisper:!!tools.whisper,model:!!tools.model,ffmpeg:!!tools.ffmpeg},microphonePermission:permission,inputSignal:!!inputSignal,transcriptTest:!!transcriptTest,speakerConfirmed:!!speakerConfirmed,localVoiceCount:localVoices,managedModelReady:!!modelReady,errorCode,apiKeyRequired:false};
}

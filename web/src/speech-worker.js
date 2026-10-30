import {pipeline,env} from '@huggingface/transformers';
import wasmURL from '../../node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.jsep.wasm?url';
import wasmModuleURL from '../../node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.jsep.mjs?url';
import {VOICE_MODEL} from '../../shared/voice-setup.mjs';
env.allowLocalModels=false;env.useBrowserCache=true;
env.backends.onnx.wasm.numThreads=1;
env.backends.onnx.wasm.wasmPaths={wasm:wasmURL,mjs:wasmModuleURL};
let recognizer;
self.onmessage=async({data})=>{
 try{
  if(!['load','transcribe'].includes(data.action))throw Error('Unsupported speech operation.');
  if(!recognizer)recognizer=await pipeline('automatic-speech-recognition',VOICE_MODEL.id,{revision:VOICE_MODEL.revision,dtype:'q8',device:'wasm',local_files_only:data.cachedOnly===true,progress_callback:p=>self.postMessage({type:'progress',progress:p.progress,status:p.status})});
  if(data.action==='load')self.postMessage({type:'result',id:data.id,result:{ready:true}});
  else {if(!(data.samples instanceof Float32Array)||data.samples.length>480000)throw Error('Record up to 30 seconds.');const result=await recognizer(data.samples,{max_new_tokens:128});self.postMessage({type:'result',id:data.id,result:{text:result.text}});}
 }catch{recognizer=null;self.postMessage({type:'error',id:data.id,message:'The local speech model could not load or transcribe. Retry setup and check available memory.'});}
};

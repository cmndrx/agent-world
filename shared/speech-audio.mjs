// Browser microphone samples are resampled to the bounded format accepted by the bridge.
export function speechWave(samples,sampleRate){
  if(!Number.isFinite(sampleRate)||sampleRate<16000||sampleRate>192000||samples.length>sampleRate*30)throw Error('Record up to 30 seconds.');
  const count=Math.floor(samples.length*16000/sampleRate),bytes=new Uint8Array(44+count*2),view=new DataView(bytes.buffer);
  const ascii=(offset,value)=>{for(let i=0;i<value.length;i++)bytes[offset+i]=value.charCodeAt(i);};
  ascii(0,'RIFF');view.setUint32(4,bytes.length-8,true);ascii(8,'WAVE');ascii(12,'fmt ');view.setUint32(16,16,true);view.setUint16(20,1,true);view.setUint16(22,1,true);view.setUint32(24,16000,true);view.setUint32(28,32000,true);view.setUint16(32,2,true);view.setUint16(34,16,true);ascii(36,'data');view.setUint32(40,count*2,true);
  for(let i=0;i<count;i++){
    const start=Math.floor(i*sampleRate/16000),end=Math.max(start+1,Math.floor((i+1)*sampleRate/16000));let sum=0;
    for(let j=start;j<end;j++)sum+=samples[j]||0;
    const value=Math.max(-1,Math.min(1,sum/(end-start)));view.setInt16(44+i*2,Math.round(value*(value<0?32768:32767)),true);
  }
  return bytes;
}

export function spokenReply(run){
  const summary=run.result?.summary;
  if(run.status!=='completed'||typeof summary!=='string'||!summary.trim())return '';
  const text=[summary,...(run.result.limitations?.length?['Limitations: '+run.result.limitations.join('. ')]:[])].join('\n');
  return text.replace(/```[\s\S]*?```/g,' Code is available in the chat. ').replace(/\[([^\]]+)\]\([^)]+\)/g,'$1').replace(/https?:\/\/\S+/g,'link in chat').replace(/[#*_`]/g,'').slice(0,3900);
}

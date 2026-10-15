import {createHash} from 'node:crypto';

// Only public assistant text. Thinking/signatures, tool payloads and unknown
// events never enter this accumulator. Session ownership is checked by the runner.
export class ClaudeProgress {
  constructor(emit){this.emit=emit;this.messages=new Map();this.current=null;}
  message(id){
    if(typeof id!=='string'||!/^[a-zA-Z0-9_-]{1,128}$/.test(id))return null;
    if(!this.messages.has(id))this.messages.set(id,{id,streamed:false,blocks:new Map()});
    while(this.messages.size>32)this.messages.delete(this.messages.keys().next().value);
    return this.messages.get(id);
  }
  publish(id,text){if(typeof text==='string'&&text.trim())this.emit({id:'claude:'+id,type:'reasoning',text:text.slice(0,4000)});}
  consume(frame){
    if(frame.parent_tool_use_id!=null)return;
    if(frame.type==='assistant'){
      const m=frame.message;
      if(m?.role!=='assistant'||!Array.isArray(m.content))return;
      const state=this.message(m.id);if(!state||state.streamed)return;
      // Complete block frames can share a message ID. Content-addressed IDs
      // deduplicate replayed blocks without retaining unbounded text in memory.
      for(const b of m.content.slice(0,32))if(b?.type==='text'&&typeof b.text==='string'){
        const text=b.text.slice(0,4000),key=createHash('sha256').update(text).digest('hex').slice(0,16);
        if(state.blocks.has(key)||state.blocks.size>=32)continue;
        state.blocks.set(key,true);this.publish(m.id+':'+key,text);
      }
      return;
    }
    if(frame.type!=='stream_event')return;
    const e=frame.event;if(!e)return;
    if(e.type==='message_start'){
      this.current=e.message?.role==='assistant'?this.message(e.message.id):null;
      if(this.current)this.current.streamed=true;
    }else if(e.type==='message_stop')this.current=null;
    else if(this.current&&Number.isSafeInteger(e.index)&&e.index>=0&&e.index<=4096){
      const state=this.current;
      if(e.type==='content_block_start'){
        if(e.content_block?.type!=='text'||state.blocks.has(e.index)||state.blocks.size>=32)return;
        const text=typeof e.content_block.text==='string'?e.content_block.text.slice(0,4000):'';
        state.blocks.set(e.index,{text,open:true});this.publish(state.id+':'+e.index,text);
      }else{
        const block=state.blocks.get(e.index);if(!block?.open)return;
        if(e.type==='content_block_delta'&&e.delta?.type==='text_delta'&&typeof e.delta.text==='string'){
          const text=(block.text+e.delta.text.slice(0,4000)).slice(0,4000);
          if(text!==block.text){block.text=text;this.publish(state.id+':'+e.index,text);}
        }else if(e.type==='content_block_stop')block.open=false;
      }
    }
  }
}

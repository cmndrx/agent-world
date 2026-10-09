import fs from 'node:fs';
import path from 'node:path';
import {randomUUID,createHash} from 'node:crypto';
const idPattern=/^[0-9a-f-]{36}$/;
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
export class Attachments {
  constructor(root){this.root=root;}
  save(input){
    const name=path.basename(String(input.name||'')).replace(/[\x00-\x1f]/g,'').slice(0,120);
    if(!name||typeof input.data!=='string'||!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(input.data))throw new Error('Choose a valid attachment.');
    const bytes=Buffer.from(input.data,'base64');if(!bytes.length||bytes.length>5*1024*1024)throw new Error('Attachments must be between 1 byte and 5 MB.');
    const ext=path.extname(name).toLowerCase();let kind,mime;
    if(ext==='.png'&&bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))){kind='image';mime='image/png';}
    else if(['.jpg','.jpeg'].includes(ext)&&bytes[0]===255&&bytes[1]===216&&bytes[2]===255){kind='image';mime='image/jpeg';}
    else if(ext==='.webp'&&bytes.toString('ascii',0,4)==='RIFF'&&bytes.toString('ascii',8,12)==='WEBP'){kind='image';mime='image/webp';}
    else if(['.txt','.md','.csv','.json','.log','.js','.mjs','.ts','.py','.html','.css','.yaml','.yml'].includes(ext)&&bytes.length<=256*1024&&!bytes.includes(0)&&Buffer.from(bytes.toString('utf8')).equals(bytes)){kind='text';mime='text/plain';}
    else throw new Error('Use PNG, JPEG, WebP or UTF-8 text/code files (text up to 256 KB).');
    const id=randomUUID(),dir=path.join(this.root,id);fs.mkdirSync(dir,{recursive:true,mode:0o700});
    const meta={id,name,kind,mime,size:bytes.length,project:input.project,slot:Number(input.slot),sha256:hash(bytes)};
    fs.writeFileSync(path.join(dir,'file'+ext),bytes,{mode:0o600});fs.writeFileSync(path.join(dir,'meta.json'),JSON.stringify(meta),{mode:0o600});return this.public(meta);
  }
  public(meta){const {id,name,kind,mime,size}=meta;return {id,name,kind,mime,size};}
  resolve(ids,project,slot){
    if(!Array.isArray(ids)||ids.length>4||new Set(ids).size!==ids.length)throw new Error('Choose up to four distinct attachments.');
    return ids.map(id=>{
      if(typeof id!=='string'||!idPattern.test(id))throw new Error('Invalid attachment.');
      const dir=path.join(this.root,id);let meta;try{meta=JSON.parse(fs.readFileSync(path.join(dir,'meta.json'),'utf8'));}catch{throw new Error('Attachment is unavailable. Add it again.');}
      if(meta.project!==project||meta.slot!==Number(slot))throw new Error('Attachment belongs to another resident or project.');
      const file=path.join(dir,'file'+path.extname(meta.name).toLowerCase()),bytes=fs.readFileSync(file);
      if(bytes.length!==meta.size||hash(bytes)!==meta.sha256)throw new Error('Attachment changed. Add it again.');
      return {...this.public(meta),path:file,...(meta.kind==='text'?{text:bytes.toString('utf8').slice(0,20000)}:{})};
    });
  }
}

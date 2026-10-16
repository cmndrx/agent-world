// Read-only source/package parity; success does not certify packaging/signing.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
const packaged=path.resolve(process.argv[2] || 'release/win-unpacked/resources/app');
const list=dir=>fs.existsSync(dir)?fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?list(path.join(dir,e.name)):e.isFile()?[path.join(dir,e.name)]:[]):[];
const hash=f=>crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const report={packaged,counts:{},missing:[],mismatched:[],extra:[]};
for(const dir of ['dist','bridge','shared','adapters','electron','web/src']){
  const pureWeb=new Set(['home-floorplans.js','home-floors.js','home-tier-plans.js','nav.js','home-activities.js']);
  const files=list(dir).filter(f=>(dir!=='electron'||f.endsWith('.cjs'))&&(dir!=='web/src'||pureWeb.has(path.basename(f))));report.counts[dir]=files.length;
  for(const f of files){const target=path.join(packaged,f);if(!fs.existsSync(target))report.missing.push(f);else if(hash(f)!==hash(target))report.mismatched.push(f);}
  if(dir!=='electron')for(const f of list(path.join(packaged,dir)))if(!fs.existsSync(path.relative(packaged,f)))report.extra.push(path.relative(packaged,f));
}
report.parity=!(report.missing.length+report.mismatched.length+report.extra.length);
console.log(JSON.stringify(report,null,2));if(!report.parity)process.exitCode=1;

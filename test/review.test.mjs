import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Productivity } from '../bridge/productivity.mjs';
import { normalizeReferences } from '../shared/review.mjs';
import { previewArtifact } from '../bridge/artifacts.mjs';

test('references validate safe targets and reported results; server stamps time and preserves omitted fields', () => {
  const refs = normalizeReferences([{kind:'check',value:'npm test',result:'passed',recordedBy:'Codex',recordedAt:'FAKE'},{kind:'output',value:'/p/report.md'}], [], '2026-10-05T12:00:00Z');
  assert.equal(refs[0].recordedAt,'2026-10-05T12:00:00Z');
  assert.deepEqual(normalizeReferences(undefined,refs),refs);
  assert.deepEqual(normalizeReferences(refs,refs,'later'),refs);
  assert.throws(()=>normalizeReferences([{kind:'output',value:'javascript:alert(1)'}]), /absolute path/);
  assert.throws(()=>normalizeReferences([{kind:'check',value:'tests',result:'verified'}]), /reported/);
  assert.throws(()=>normalizeReferences(Array(21).fill(refs[0])), /20/);
});

test('review requires current version, explicit acceptance or return feedback, and retains deliverable fields', () => {
  const p = new Productivity(); const homes = {'/p':{}}; const chats = new Map();
  const t = p.saveTask({project:'/p',title:'Deliver',status:'needs_review',evidence:'Legacy evidence',references:[{kind:'check',value:'npm test',result:'unknown'}]},homes,chats);
  assert.throws(()=>p.review({...t,decision:'accept'},homes,chats),/Confirm/);
  assert.throws(()=>p.review({...t,decision:'return',feedback:' '},homes,chats),/changing/);
  const back = p.review({...t,decision:'return',feedback:'Fix the broken link'},homes,chats);
  assert.equal(back.status,'in_progress'); assert.equal(back.evidence,'Legacy evidence'); assert.deepEqual(back.references,t.references);
  assert.equal(back.reviews[0].feedback,'Fix the broken link'); assert.equal(back.acceptedAt,null);
  assert.throws(()=>p.review({...t,decision:'return',feedback:'again'},homes,chats),/changed elsewhere/);
  const ready=p.saveTask({...back,status:'needs_review'},homes,chats);
  const accepted=p.review({...ready,decision:'accept',acceptedByUser:true,feedback:'Reviewed output'},homes,chats);
  assert.equal(accepted.status,'accepted'); assert.equal(accepted.reviews.length,2); assert.equal(accepted.rewardPolicy,'daily-v1');
  const edited=p.saveTask({...accepted,title:'Preserved',reviews:[]},homes,chats);
  assert.equal(edited.reviews.length,2);
});

test('preview reads only recorded project text, bounds bytes, rejects traversal, secrets, binary and symlink escape', () => {
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'world-review-')); const project=path.join(root,'project'); fs.mkdirSync(project);
  try {
    const file=path.join(project,'report.md'); fs.writeFileSync(file,'<script>plain text only</script>');
    const task={project,evidence:'',references:[{kind:'output',value:file}]};
    assert.equal(previewArtifact(task,file).text,'<script>plain text only</script>');
    assert.throws(()=>previewArtifact(task,path.join(project,'other.md')), /recorded/);
    fs.writeFileSync(file,'x'.repeat(70000)); const bounded=previewArtifact(task,file); assert.equal(bounded.text.length,65536); assert.equal(bounded.truncated,true);
    fs.writeFileSync(file,Buffer.from([0,1])); assert.throws(()=>previewArtifact(task,file),/Binary/);
    const secret=path.join(project,'.env.md');fs.writeFileSync(secret,'secret');
    task.evidence=secret;assert.throws(()=>previewArtifact(task,secret),/visible/);
    const outside=path.join(root,'outside.md');fs.writeFileSync(outside,'outside');const link=path.join(project,'link.md');fs.symlinkSync(outside,link);
    task.evidence=link;assert.throws(()=>previewArtifact(task,link),/within/);
    task.project='claude:project';assert.throws(()=>previewArtifact(task,file),/local project/);
  } finally { fs.rmSync(root,{recursive:true,force:true}); }
});


test('recorded summary and limitations survive omitted updates and human return decisions',()=>{
  const p=new Productivity(), homes={'/p':{}}, chats=new Map();
  const t=p.saveTask({project:'/p',title:'Deliver',status:'needs_review',reviewSummary:'Short result',limitations:'No authenticated provider QA'},homes,chats);
  const {reviewSummary,limitations,...input}=t;
  const updated=p.saveTask({...input,notes:'New note'},homes,chats);
  assert.equal(updated.reviewSummary,reviewSummary);assert.equal(updated.limitations,limitations);
  const returned=p.review({...updated,decision:'return',feedback:'Check provider'},homes,chats);
  assert.equal(returned.limitations,limitations);assert.equal(returned.status,'in_progress');
  const cleared=p.saveTask({...returned,reviewSummary:'',limitations:''},homes,chats);assert.equal(cleared.limitations,'');
});

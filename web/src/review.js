import { escapeHtml as esc } from './sim.js';
import { evidenceReferences, safeReferenceURL } from '../../shared/work-loop.mjs';
import { icon } from './icons.js';

export function referencesHTML(task) {
  return (task.references || []).map(r => `<article class="row-card"><div class="row-main"><b>${esc(r.label || (r.kind === 'output' ? r.value.split('/').at(-1) : r.value))}</b><small>${r.kind === 'check' ? `Reported ${esc(r.result)}` : 'Output'} · ${esc(r.recordedBy || 'Unspecified recorder')} · ${esc(r.recordedAt ? new Date(r.recordedAt).toLocaleString() : '')}</small>${r.kind === 'output' || r.label ? `<details><summary>Reference</summary><code>${esc(r.value)}</code></details>` : ''}</div></article>`).join('');
}
export class ReviewFlow {
  constructor(work) {
    this.work = work;
    this.dialog = document.createElement('dialog'); this.dialog.className = 'task-editor review-flow glass';
    document.body.append(this.dialog);
    this.dialog.addEventListener('click', async e => {
      const b = e.target.closest('button'); if (!b) return;
      if (b.hasAttribute('data-next-review')) { const next=work.data.tasks.find(t=>t.project===this.task.project && t.status==='needs_review' && t.id!==this.task.id); if(next) this.open(next); else this.message('No more tasks await review here.'); }
      if (b.hasAttribute('data-measure')) { this.dialog.close(); work.open(this.task.project,'measure'); }
      if (b.hasAttribute('data-edit-evidence')) { this.dialog.close(); work.editTask(this.work.data.tasks.find(t=>t.id===this.task.id)); }
      if (b.hasAttribute('data-close')) this.dialog.close();
      if (b.dataset.preview) {
        const previewTask=this.task.id;
        this.dialog.querySelector('.preview-text').textContent = 'Loading…';
        try {
          const response = await fetch('/api/artifact-preview', { method:'POST', headers:{'content-type':'application/json'}, body:JSON.stringify({id:this.task.id,project:this.task.project,path:b.dataset.preview}) });
          const data = await response.json(); if (!response.ok) throw new Error(data.error);
          if(this.task.id!==previewTask || !this.dialog.querySelector('.preview-text')) return;
          this.dialog.querySelector('.preview-text').textContent = `${data.result.truncated ? 'First 64 KB · truncated\n\n' : ''}${data.result.text}`;
          this.dialog.querySelector('.preview-caption').textContent = `Read now: ${data.result.path} · ${new Date(data.result.readAt).toLocaleString()}. Current contents may differ from the reviewed version.`;
        } catch (err) { if(this.task.id===previewTask && this.dialog.querySelector('.preview-text'))this.dialog.querySelector('.preview-text').textContent = err.message; }
      }
      if (b.dataset.copy) {
        try { await navigator.clipboard.writeText(b.dataset.copy); this.message('Copied.'); } catch { this.message(`Copy: ${b.dataset.copy}`); }
      }
      if (b.dataset.decision) {
        const feedback = this.dialog.querySelector('[name=feedback]').value;
        const consent = this.dialog.querySelector('[name=consent]').checked;
        if (b.dataset.decision === 'accept' && !consent) return this.message('Confirm that you reviewed this work before accepting.');
        if (b.dataset.decision === 'return' && !feedback.trim()) { this.dialog.querySelector('.review-feedback').open=true; this.dialog.querySelector('[name=feedback]').focus(); return this.message('Describe what needs changing.'); }
        this.dialog.querySelectorAll('[data-decision]').forEach(el => el.disabled = true);
        try {
          await work.post('/api/review', {id:this.task.id,project:this.task.project,version:this.task.version,decision:b.dataset.decision,feedback,acceptedByUser:consent});
          const remaining=work.data.tasks.filter(t=>t.project===this.task.project && t.status==='needs_review').length;
          this.dialog.innerHTML=`<header class="panel-head"><h2>Review recorded</h2><button data-close aria-label="Close review">×</button></header><div class="review-body"><p>${b.dataset.decision==='accept'?'Accepted by you.':'Returned to work. Feedback saved; no message sent.'}</p><p>${remaining} still await review in this home.</p><small>Only this decision was recorded. Other tasks keep their stage.</small></div><footer class="review-decisions">${remaining?'<button class="primary" data-next-review>Review next task</button>':''}<button data-measure>Work loop journal</button><button data-close>Done</button><p role="status"></p></footer>`;
        } catch (err) { this.message(err.message); }
        finally { this.dialog.querySelectorAll('[data-decision]').forEach(el => el.disabled = false); }
      }
    });
  }
  message(t) { this.dialog.querySelector('[role=status]').textContent = t; }
  open(task) {
    this.task = { ...task };
    const refs = [...evidenceReferences(task.evidence), ...(task.references || []).filter(r=>r.kind==='output').map(r=>({kind:r.value.startsWith('/')?'path':'url',value:r.value}))];
    const unique = refs.filter((r,i)=>refs.findIndex(x=>x.value===r.value)===i);
    const checks=(task.references || []).filter(r=>r.kind==='check');
    this.dialog.innerHTML = `<header class="panel-head"><span class="panel-icon">${icon('eye')}</span><div><h2>Review work</h2><small>${esc(this.work.homeName(task.project))}</small></div><button data-close aria-label="Close review">×</button></header>
      <div class="review-body"><h3>${esc(task.title)}</h3>
      <section class="review-summary"><b>Recorded summary</b><p>${esc(task.reviewSummary || 'No short summary recorded. Inspect the outputs and full notes before deciding.')}</p></section>
      <section><h4>Outputs · ${unique.length}</h4><div class="row-links">${unique.map(r=>r.kind==='url' && safeReferenceURL(r.value) ? `<a href="${esc(r.value)}" target="_blank" rel="noopener noreferrer">Open ${esc(new URL(r.value).hostname)}</a>` : `<button data-preview="${esc(r.value)}">Preview ${esc(r.value.split('/').at(-1))}</button><button data-copy="${esc(r.value)}">Copy path</button>`).join('') || '<small>No output reference recorded.</small>'}</div></section>
      <section><h4>Reported checks · ${checks.length}</h4>${referencesHTML({references:checks}) || '<small>No checks recorded.</small>'}</section>
      <section><h4>Limitations</h4><p>${esc(task.limitations || 'No limitations recorded. This does not establish that none exist.')}</p>${task.blocker?`<p>Blocker: ${esc(task.blocker)}</p>`:''}<small>Checks are recorded claims. Previews show current files, not frozen deliverables.</small></section>
      <div class="row-links">${(task.conversationKeys||[]).map(key=>this.work.data.conversations.find(c=>c.key===key&&c.project===task.project)).filter(Boolean).map(c=>this.work.conversationActions(c,{compact:true})).join('')}</div>
      <details class="review-notes"><summary>Full notes & evidence</summary><p>${esc(task.notes || 'No task notes recorded.')}</p><p class="review-evidence">${esc(task.evidence || 'No additional evidence recorded.')}</p>${referencesHTML({references:(task.references || []).filter(r=>r.kind==='output')})}<button data-edit-evidence>Edit task & evidence</button></details>
      <details class="artifact-preview"><summary>Current local output preview</summary><small class="preview-caption">Plain text only. Preview does not execute files or verify success.</small><pre class="preview-text">Choose a recorded output above.</pre></details>
      <details class="review-feedback"><summary>Return feedback / optional acceptance note</summary><label>Review feedback<textarea name="feedback" maxlength="2000" rows="3" placeholder="What needs changing? Required when returning to work."></textarea></label></details></div>
      <footer class="review-decisions"><label class="accept-consent"><input name="consent" type="checkbox" /> I reviewed this work and accept it.</label>
      <div class="task-editor-actions"><button class="primary" data-decision="accept">Accept work</button><button data-decision="return">Return to work</button><button data-close>Cancel</button></div><p role="status"></p></footer>`;
    this.dialog.querySelectorAll('[data-session]').forEach(b=>b.addEventListener('click',()=>{this.work.onSession(b.dataset.session);this.dialog.close();this.work.dialog.close();}));
    this.dialog.querySelectorAll('[data-preview]').forEach(b=>b.addEventListener('click',()=>{this.dialog.querySelector('.artifact-preview').open=true;}));
    if (!this.dialog.open) this.dialog.showModal();
  }
}

// A compact structured evidence editor; old free-text evidence remains intact.
export function referenceEditor(refs = []) {
  return `<div class="reference-editor">${refs.map(r=>referenceRow(r)).join('')}</div><button type="button" data-add-reference="output">Add output</button><button type="button" data-add-reference="check">Add check</button>`;
}
export function referenceRow(r) {
  return `<div class="reference-entry" data-kind="${esc(r.kind)}" data-label="${esc(r.label || '')}" data-recorded-by="${esc(r.recordedBy || 'User-entered')}"><label>${r.kind==='output'?'Output path or web link':'Check command or description'}<input data-ref-value maxlength="1000" value="${esc(r.value||'')}" /></label>${r.kind==='check'?`<label>Reported result<select data-ref-result>${['unknown','passed','failed'].map(v=>`<option ${r.result===v?'selected':''}>${v}</option>`).join('')}</select></label>`:''}<button type="button" data-remove-reference>Remove</button></div>`;
}
export function readReferences(editor) {
  return [...editor.querySelectorAll('.reference-entry')].map(e=>({kind:e.dataset.kind,label:e.dataset.label,value:e.querySelector('[data-ref-value]').value,result:e.querySelector('[data-ref-result]')?.value||'unknown',recordedBy:e.dataset.recordedBy}));
}

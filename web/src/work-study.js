import { STUDY_METRICS, studyRecord, compareStudy, elapsedMeasurement, pendingStudyPairs } from '../../shared/work-study.mjs';
import { escapeHtml as esc } from './sim.js';
const KEY = 'agentWorld.workStudy.v1';
const show = value => value == null ? '—' : Number(value.toFixed(2)).toString();

export class WorkStudy {
  constructor({onReview} = {}) {
    this.onReview=onReview;
    this.root = document.createElement('section'); this.root.className = 'work-study';
    try { const rows = JSON.parse(localStorage.getItem(KEY) || '[]'); this.rows = Array.isArray(rows) ? rows.filter(r => r && typeof r.project === 'string' && typeof r.comparison === 'string' && ['with', 'without'].includes(r.mode)).slice(-100) : []; } catch { this.rows = []; }
    this.root.addEventListener('input',()=>this.saveDraft());
    this.root.addEventListener('change',()=>{this.saveDraft();this.updateTimers();});
    this.root.addEventListener('submit', e => {
      e.preventDefault();
      const status = this.root.querySelector('[role=status]');
      try {
        if(Object.keys(this.timers || {}).length) throw new Error('Stop running timers and check the draft before saving.');
        const row = studyRecord({ ...Object.fromEntries(new FormData(e.target)), project: this.project });
        const rows = [...this.rows, row].slice(-100);
        localStorage.setItem(KEY, JSON.stringify(rows)); this.rows = rows;
        this.timers={}; this.root.querySelector('form').reset(); localStorage.removeItem(this.draftKey()); this.updateTimers(); this.updateSummary(); status.textContent = 'Measured session saved in this browser. No task stages or rewards changed.';
      } catch (err) { status.textContent = err.message; }
    });
    this.root.addEventListener('click', e => {
      const timer=e.target.closest('[data-timer]');
      if(timer) {
        const key=timer.dataset.timer;
        try {
          if(this.timers[key]!=null) {
            const input=this.root.querySelector(`[name=${key}]`);
            const elapsed=elapsedMeasurement(key,this.timers[key],Date.now());
            input.value=(Number(input.value||0)+elapsed).toFixed(2); delete this.timers[key];
            this.root.querySelector('[role=status]').textContent='Elapsed time added to the draft. Check it before saving; time away is included.';
          } else this.timers[key]=Date.now();
          this.saveDraft();this.updateTimers();
        } catch(err) {this.root.querySelector('[role=status]').textContent=err.message;}
        return;
      }
      if(e.target.closest('[data-review-pilot]')) {const task=this.tasks.find(t=>t.project===this.project && t.status==='needs_review');if(task)this.onReview?.(task);return;}
      if(e.target.closest('[data-backlog]')) {this.root.querySelector('[name=reviewBacklog]').value=this.tasks.filter(t=>t.project===this.project && t.status==='needs_review').length;this.saveDraft();return;}
      const pair=e.target.closest('[data-pair]');
      if(pair) {if(Object.keys(this.timers||{}).length){this.root.querySelector('[role=status]').textContent='Stop running timers before starting the other condition.';return;}this.root.querySelector('form').reset();this.root.querySelector('[name=comparison]').value=pair.dataset.pair;this.root.querySelector('[name=mode]').value=pair.dataset.mode;this.saveDraft();this.updateTimers();return;}

      if (e.target.closest('[data-undo-study]')) {
        const i = this.rows.findLastIndex(r => r.project === this.project);
        if (i < 0) return;
        try {
          const rows = this.rows.filter((_, index) => index !== i);
          localStorage.setItem(KEY, JSON.stringify(rows)); this.rows = rows; this.updateSummary();
          this.root.querySelector('[role=status]').textContent = 'Last entry removed. Correct its values and save again.';
        } catch (err) { this.root.querySelector('[role=status]').textContent = err.message; }
        return;
      }
      if (!e.target.closest('[data-export-study]')) return;
      const json = JSON.stringify({ format: 'agent-world-work-study-v1', exportedAt: new Date().toISOString(), records: this.rows.filter(r => r.project === this.project) }, null, 2);
      let panel = this.root.querySelector('.study-export');
      if (!panel) {
        panel = document.createElement('section'); panel.className = 'study-export';
        const label = document.createElement('label'); label.textContent = 'Exported measurement JSON';
        const text = document.createElement('textarea'); text.readOnly = true; text.rows = 6; label.append(text); panel.append(label);
        const copy = document.createElement('button'); copy.textContent = 'Copy measurement JSON'; copy.type = 'button';
        copy.addEventListener('click', async () => {
          try { await navigator.clipboard.writeText(text.value); this.root.querySelector('[role=status]').textContent = 'Measurement JSON copied. Keep it private if it contains project context.'; }
          catch { this.root.querySelector('[role=status]').textContent = 'Select and copy the exported JSON below.'; }
        });
        panel.append(copy); this.root.querySelector('[data-study-summary]').append(panel);
      }
      panel.querySelector('textarea').value = json;
    });
  }
  draftKey() {return `${KEY}.draft.${this.project}`;}
  saveDraft() {
    try {localStorage.setItem(this.draftKey(),JSON.stringify({fields:Object.fromEntries(new FormData(this.root.querySelector('form'))),timers:this.timers}));}
    catch {this.root.querySelector('[role=status]').textContent='Draft could not be saved. Keep your measurements before leaving.';}
  }
  updateTimers() {this.root.querySelectorAll('[data-timer]').forEach(b=>{b.textContent=this.timers[b.dataset.timer]!=null?'Stop timer':'Start timer';b.disabled=this.root.querySelector('[name=mode]').value==='without' && this.timers[b.dataset.timer]==null;});}
  mount(parent, project, tasks = []) {
    this.tasks=tasks;

    if (this.project !== project || !this.root.children.length) {
      this.project = project;
      this.root.innerHTML = `<h3>Does Agent World help?</h3><p class="work-caption">Record comparable real sessions with and without the platform. This journal is optional, human-entered and stored only in this browser (last 100 sessions). Drafts and running timers survive reopening. It is not a productivity score.</p>
        <details><summary>How to measure fairly</summary><p>Use the same project and comparable work slices. Alternate which condition goes first. Use a unique pair name for each comparison. Start notice timing when a real request appears; stop when you notice it. Start resume timing when returning to the project; stop at your first meaningful work action. Time board upkeep and rework separately. Count the actual review backlog at session end. Leave unavailable measurements blank; do not enter guesses as observations.</p><p>Without Agent World: close its tab and use the provider app and your normal workflow. Record the results here afterward. The platform does not measure activity in a closed tab or control your agents. Differences in task difficulty and familiarity can explain changes.</p></details>
        <div data-study-summary></div>
        <form><label>Matched work slice / pair name<input name="comparison" required maxlength="200" placeholder="Example: return to a small UI fix · pair 1" /></label>
        <label>Condition<select name="mode"><option value="with">With Agent World</option><option value="without">Without Agent World</option></select></label>
        <div class="study-fields">${Object.entries(STUDY_METRICS).map(([key, m]) => `<label>${esc(m.label)} (${esc(m.unit)})<input name="${key}" type="number" min="0" max="100000" step="${key === 'reviewBacklog' ? '1' : 'any'}" placeholder="Unknown" />${key==='reviewBacklog'?'<button type="button" data-backlog>Use current board count</button>':`<button type="button" data-timer="${key}">Start timer</button>`}</label>`).join('')}</div>
        <label>Context / limitations<textarea name="notes" maxlength="1000" placeholder="Task difficulty, interruptions, failed checks or missing observations"></textarea></label>
        <small>Timers start and stop only when you click. Elapsed time includes time away; correct interruptions before saving. For notice timing, start when the real request appears. Without Agent World, use an external timer and enter results afterward.</small><button type="submit">Save measured session</button><p role="status"></p></form>`;
      this.timers={};
      try {const draft=JSON.parse(localStorage.getItem(this.draftKey())||'null');if(draft){for(const [k,v] of Object.entries(draft.fields||{})){const el=this.root.querySelector('form').elements.namedItem(k);if(el && typeof v==='string')el.value=v;}for(const [k,v] of Object.entries(draft.timers||{})){if(Object.hasOwn(STUDY_METRICS,k)&&k!=='reviewBacklog'&&Number.isFinite(v))this.timers[k]=v;}}}catch{}
      this.updateTimers();
    }
    if (this.root.parentElement !== parent) parent.replaceChildren(this.root);
    this.updateSummary();
  }
  updateSummary() {
    const key = JSON.stringify([this.project, this.rows, this.tasks]);
    if (this.summaryKey === key && this.root.querySelector('[data-study-summary] table')) return;
    this.summaryKey = key;
    const summary = compareStudy(this.rows, this.project);
    const here=this.tasks.filter(t=>t.project===this.project);
    const waiting=here.filter(t=>t.status==='needs_review').length;
    const decisions=here.reduce((n,t)=>n+(t.reviews?.length||0),0);
    const pending=pendingStudyPairs(this.rows,this.project);
    this.root.querySelector('[data-study-summary]').innerHTML = `<section class="pilot-review"><h4>Real review loop</h4><p>${waiting} await review · ${decisions} recorded review decisions</p><button data-review-pilot ${waiting?'':'disabled'}>Review next deliverable</button><small>Accept or return only after inspecting the work. Counts are saved board records, not productivity gains.</small></section>
      ${pending.length?`<details><summary>${pending.length} comparison names need another condition</summary>${pending.map(p=>`<button data-pair="${esc(p.comparison)}" data-mode="${p.mode}" title="Start an empty draft for the other condition">${esc(p.comparison)} · record ${p.mode}</button>`).join('')}</details>`:''}<h4>${summary.records} recorded session${summary.records === 1 ? '' : 's'} · matched comparisons</h4>
      <p class="work-caption">Only paired measurements with the same project and pair name count. Negative change means less time or backlog. No paired data means no improvement claim. These comparisons do not establish causation.</p>
      <div class="study-table"><table><thead><tr><th>Measure</th><th>Pairs</th><th>Without</th><th>With</th><th>Median paired change</th></tr></thead><tbody>${summary.metrics.map(m => `<tr><th>${esc(m.label)} (${m.unit})</th><td>${m.pairs}</td><td>${show(m.without)}</td><td>${show(m.with)}</td><td>${show(m.delta)}</td></tr>`).join('')}</tbody></table></div>
      <button data-export-study>Export this project's measurements</button>${summary.records ? '<button data-undo-study>Undo last entry</button>' : ''}`;
  }
}

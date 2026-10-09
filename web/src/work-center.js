import { projectSetup, taskHandoff } from '../../shared/onboarding.mjs';
import { observedLabel } from '../../shared/freshness.mjs';
import { ReviewFlow, referencesHTML, referenceEditor, referenceRow, readReferences } from './review.js';
import { attentionItems, TASK_STAGES, focusedAttention } from '../../shared/productivity.mjs';
import { WorkStudy } from './work-study.js';
import { returnBriefing, briefingCutoff, evidenceReferences, safeReferenceURL } from '../../shared/work-loop.mjs';
import { resolveActivity } from './activity.js';
import { conversationTarget, conversationLabel } from '../../shared/conversations.mjs';
import { escapeHtml, formatDuration } from './sim.js';
import { BRICKS, MAX_LEVEL, homeLevel, levelName } from '../../shared/progression.mjs';
import { icon } from './icons.js';

/** "2m ago", "3h ago" — short and scannable. */
const ago = (iso) => { const s = Math.max(0, (Date.now() - Date.parse(iso)) / 1000); return s < 60 ? 'just now' : s < 3600 ? `${Math.floor(s / 60)}m ago` : s < 86400 ? `${Math.floor(s / 3600)}h ago` : `${Math.floor(s / 86400)}d ago`; };
const REASON_ICON = { error: 'triangleAlert', permission: 'hand', question: 'circleHelp', input: 'hand', blocker: 'circleAlert', review: 'eye', turn_complete: 'messageCircle' };

const esc = escapeHtml;
export class WorkCenter {
  constructor({ onSession, onHome, onConversations, onFocus, focus = '' }) {
    Object.assign(this, { onSession, onHome, onConversations, onFocus, focus });
    this.data = { households: [], sessions: [], conversations: [], plans: [], tasks: [] };
    this.study = new WorkStudy({onReview:task=>this.review.open(task)});
    this.project = ''; this.view = 'overview'; this.connected = false; this.allAttention = false;
    this.dialog = document.createElement('dialog');
    this.dialog.className = 'work-center glass';
    this.dialog.innerHTML = `<header class="panel-head"><span class="panel-icon">${icon('briefcase')}</span><div><h2>Work</h2><small class="work-connection"></small></div><button class="icon-btn" data-close aria-label="Close">${icon('x')}</button></header>
      <nav class="home-chips" aria-label="Homes"></nav>
      <div class="work-bar"><nav class="work-tabs" aria-label="Views"><button data-view="overview">${icon('target')} Now</button><button data-view="tasks">${icon('listChecks')} Tasks</button><button data-view="reviews">${icon('eye')} Reviews</button></nav>
        <button class="focus-toggle" data-focus title="Focus quiets routine pings from other homes. Questions and errors still show.">${icon('star')} <span>Focus</span></button></div>
      <section class="work-content"></section>
      <details class="plan-editor"><summary>Edit outcome & next step</summary><form data-form="plan">
        <label>Outcome<textarea name="outcome" maxlength="500" rows="2" placeholder="What should this project achieve?"></textarea></label>
        <label>Next step<textarea name="nextAction" maxlength="500" rows="2" placeholder="The next concrete thing to do"></textarea></label><button type="submit" class="primary">Save</button><button type="submit" name="afterSave" value="task">Save & draft task</button>
      </form></details>
      <footer class="panel-foot"><button class="link-btn" data-setup-toggle>Getting started</button><button class="link-btn" data-view="measure">Work loop journal</button>
        <details class="info-note"><summary>${icon('info')} How it works</summary><ul>
          <li>Agent activity is observed. Plans, task stages and reviews are yours.</li>
          <li>“Response ready” means read the reply. Nothing is accepted automatically.</li>
          <li>Focus quiets routine pings from other homes; questions and errors still show.</li>
          <li>Recorded outputs are your notes, not proof that work is correct.</li></ul></details></footer>
      <p class="work-message" role="status"></p>`;
    document.body.append(this.dialog);
    this.editor = document.createElement('dialog');
    this.editor.className = 'task-editor glass';
    this.editor.innerHTML = `<header class="panel-head"><span class="panel-icon">${icon('listChecks')}</span><div><h2>Task</h2></div><button type="button" class="icon-btn" data-editor-close aria-label="Close">${icon('x')}</button></header><form>
      <label>Title<input name="title" required maxlength="200" placeholder="What needs doing?" /></label>
      <label>Stage<select name="status">${Object.entries(TASK_STAGES).map(([k,v]) => `<option value="${k}">${v}</option>`).join('')}</select></label>
      <details class="task-details"><summary>Notes, blocker & chats</summary><label>Notes<textarea name="notes" rows="2" maxlength="2000"></textarea></label>
      <label>Blocker<textarea name="blocker" rows="2" maxlength="500" placeholder="What has to happen first?"></textarea></label>
      <label>Review summary<textarea name="reviewSummary" rows="2" maxlength="500" placeholder="What changed and what should be reviewed?"></textarea></label><label>Known limitations<textarea name="limitations" rows="2" maxlength="1000" placeholder="Unverified behavior, remaining gaps or risks"></textarea></label><section class="structured-references"></section><fieldset class="task-conversations"><legend>Linked chats</legend><div></div></fieldset>
      </details><label>Outputs & checks<textarea name="evidence" rows="3" maxlength="2000" placeholder="Paths, links or test results"></textarea></label>
      <small data-reference-hint>Your notes — not proof the work is correct.</small>
      <label class="accept-consent"><input name="acceptedByUser" type="checkbox" /> I reviewed this and accept it.</label>
      <div class="task-editor-actions"><button type="submit" class="primary">Save</button><button type="button" data-editor-close>Cancel</button></div><p role="status" class="task-message"></p>
    </form>`;
    document.body.append(this.editor);
    this.review = new ReviewFlow(this);
    document.getElementById('work-open').addEventListener('click', () => this.open());
    this.dialog.addEventListener('change', e => { if (e.target.name === 'reachConfirm') this.reachChecked = e.target.checked; });
    this.dialog.addEventListener('click', async e => {
      const b = e.target.closest('button'); if (!b) return;
      if (b.hasAttribute('data-setup-toggle')) { this.guideOpen = !this.guideOpen; this.view = 'overview'; this.render(); }
      if (b.dataset.setupStep) this.setupStep(b.dataset.setupStep);
      if (b.dataset.handoff) this.copyHandoff(this.data.tasks.find(t=>t.id===b.dataset.handoff));
      if (b.hasAttribute('data-close')) this.dialog.close();
      if (b.dataset.copy) {
        try { await navigator.clipboard.writeText(b.dataset.copy); this.message('Copied.'); } catch { this.message(`Copy this: ${b.dataset.copy}`); }
      }
      if (b.dataset.view) { this.view = b.dataset.view; this.render(); }
      if (b.dataset.home != null) this.choose(b.dataset.home);
      if (b.hasAttribute('data-focus') && this.project) this.setFocus(this.focus === this.project ? '' : this.project);
      if (b.hasAttribute('data-edit-plan')) { const d = this.dialog.querySelector('.plan-editor'); d.open = true; d.querySelector('textarea').focus(); }
      if (b.hasAttribute('data-all-attention')) { this.allAttention = !this.allAttention; this.render(); }
      if (b.hasAttribute('data-new-task')) this.editTask();
      if (b.dataset.review) this.review.open(this.data.tasks.find(t => t.id === b.dataset.review));
      if (b.dataset.task) this.editTask(this.data.tasks.find(t => t.id === b.dataset.task));
      if (b.dataset.session) { this.onSession(b.dataset.session); this.dialog.close(); }
      if (b.dataset.shelfHome) { this.dialog.close(); this.onConversations(b.dataset.shelfHome); }
      if (b.hasAttribute('data-reach')) { this.reachOpen = !this.reachOpen; this.reachChecked = false; this.render(); }
      if (b.hasAttribute('data-reach-confirm')) {
        if (!this.reachChecked) return this.message('Tick the box to confirm.');
        const plan = this.data.plans.find(p => p.project === this.project);
        try {
          this.reachOpen = false; this.reachChecked = false;
          await this.post('/api/milestone', { project: this.project, version: plan?.version, action: 'reach', confirmed: true });
          this.message('Outcome reached!');
        } catch (err) { this.message(err.message); }
      }
      if (b.hasAttribute('data-undo-milestone')) {
        if (!confirm('Undo the last reached outcome? The house goes back a level and its gems are removed.')) return;
        const plan = this.data.plans.find(p => p.project === this.project);
        try { await this.post('/api/milestone', { project: this.project, version: plan?.version, action: 'undo', confirmed: true }); this.message('Last reached outcome undone.'); } catch (err) { this.message(err.message); }
      }
      if (b.hasAttribute('data-seen')) {
        try { await this.post('/api/briefing-seen', { project: this.project, through: this.through }); this.message('Caught up.'); } catch (err) { this.message(err.message); }
      }
    });
    this.dialog.querySelector('[data-form=plan]').addEventListener('submit', async e => {
      e.preventDefault(); const f = e.target; const draftAfter = e.submitter?.value === 'task';
      await this.submit(f, async () => {
        await this.post('/api/plan', { project: this.project, outcome: f.elements.outcome.value, nextAction: f.elements.nextAction.value, version: this.planVersion });
        this.planVersion = this.data.plans.find(p => p.project === this.project)?.version || this.planVersion + 1;
        this.dialog.querySelector('.plan-editor').open = false;
        this.message('Saved.');
        if (draftAfter) this.draftTask();
      }, msg => this.message(msg));
    });
    this.editor.addEventListener('click', e => {
      const b = e.target.closest('button');
      if (b?.dataset.addReference) this.editor.querySelector('.reference-editor').insertAdjacentHTML('beforeend', referenceRow({kind:b.dataset.addReference}));
      if (b?.hasAttribute('data-remove-reference')) b.closest('.reference-entry').remove();
      if (e.target.closest('[data-editor-close]')) this.editor.close(); });
    this.editor.querySelector('select[name=status]').addEventListener('change', () => this.showAcceptance());
    this.editor.querySelector('form').addEventListener('submit', async e => {
      e.preventDefault(); const f = e.target;
      await this.submit(f, async () => {
        const input = Object.fromEntries(new FormData(f));
        input.references = readReferences(this.editor);
        input.project = this.editingProject; input.id = this.editing?.id; input.version = this.editing?.version;
        input.acceptedByUser = f.elements.acceptedByUser.checked;
        input.conversationKeys = [...f.querySelectorAll('input[name=conversation]:checked')].map(el => el.value);
        await this.post('/api/task', input); this.editor.close(); this.message('Saved.');
      }, msg => { this.editor.querySelector('.task-message').textContent = msg; });
    });
    setInterval(() => { if (this.dialog.open && this.view === 'attention') this.render(); }, 30000);
  }
  async post(route, input) {
    const res = await fetch(route, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(input) });
    const data = await res.json(); if (!res.ok) throw new Error(data.error || 'Could not save.');
    // Apply successful writes immediately, even if SSE is reconnecting.
    if (route === '/api/task' || route === '/api/review') this.data.tasks = [...this.data.tasks.filter(t => t.id !== data.result.id), data.result];
    else this.data.plans = [...this.data.plans.filter(p => p.project !== data.result.project), data.result];
    if (route === '/api/milestone') {
      // The outcome moved into the milestone list; keep the plan form in sync so the next save doesn't conflict.
      const f = this.dialog.querySelector('[data-form=plan]');
      f.elements.outcome.value = data.result.outcome || '';
      this.planVersion = data.result.version;
    }
    this.render(); return data.result;
  }
  async submit(form, run, error) {
    const buttons = [...form.querySelectorAll('button[type=submit]')]; buttons.forEach(b=>b.disabled=true);
    try { await run(); } catch (err) { error(err.message); } finally { buttons.forEach(b=>b.disabled=false); }
  }
  message(value) { this.dialog.querySelector('.work-message').textContent = value; }
  setData(data) {
    Object.assign(this.data, data);
    const homesKey = JSON.stringify(this.data.households.map(h => [h.project, h.name]));
    if (homesKey !== this.homesKey) {
      this.homesKey = homesKey;
    }
    this.render();
  }
  setConnection(value) { this.connected = value; this.render(); }
  setFocus(project) { this.focus = project; this.onFocus(project); this.render(); }
  open(project = '', view = 'overview') {
    const available = value => this.data.households.some(h => h.project === value);
    this.view = view; this.choose([project, this.focus, this.project].find(available) || this.data.households[0]?.project || '');
    this.message(''); if (!this.dialog.open) this.dialog.showModal();
  }
  choose(project) {
    if (project !== this.project) { this.guideOpen = false; this.reachOpen = false; this.reachChecked = false; }
    this.project = project;
    const p = this.data.plans.find(p => p.project === project);
    const f = this.dialog.querySelector('[data-form=plan]');
    f.elements.outcome.value = p?.outcome || ''; f.elements.nextAction.value = p?.nextAction || ''; this.planVersion = p?.version || 0;
    if (project) this.onHome(project); this.render();
  }
  editTask(task) {
    if (!this.project && !task) return;
    if (task && task.project !== this.project) this.choose(task.project);
    this.editing = task ? { ...task } : null; this.editingProject = task?.project || this.project;
    const f = this.editor.querySelector('form'); f.reset();
    for (const name of ['title', 'status', 'notes', 'blocker', 'evidence', 'reviewSummary', 'limitations']) f.elements[name].value = task?.[name] || (name === 'status' ? 'planned' : '');
    this.editor.querySelector('.structured-references').innerHTML = referenceEditor(task?.references || []);
    this.editor.querySelector('.task-message').textContent = '';
    const chats = this.data.conversations.filter(c => c.project === this.editingProject);
    this.editor.querySelector('.task-conversations div').innerHTML = chats.length ? chats.map(c => `<label><input type="checkbox" name="conversation" value="${esc(c.key)}" ${task?.conversationKeys.includes(c.key) ? 'checked' : ''} /> ${esc(conversationLabel(c))} · ${esc(c.app)}</label>`).join('') : '<small>No chats in this home yet.</small>';
    this.editor.querySelector('h2').textContent = task ? 'Task' : 'New task';
    this.editor.querySelector('.task-details').open = !!task?.blocker;
    this.editor.querySelector('[name=evidence]').closest('label').hidden = !task;
    this.showAcceptance(); if (!this.editor.open) this.editor.showModal();
  }
  showAcceptance() { this.editor.querySelector('[name=evidence]').closest('label').hidden = !this.editing && !['needs_review', 'accepted'].includes(this.editor.querySelector('select[name=status]').value); this.editor.querySelector('[data-reference-hint]').hidden = this.editor.querySelector('[name=evidence]').closest('label').hidden; this.editor.querySelector('.accept-consent').hidden = this.editor.querySelector('select[name=status]').value !== 'accepted'; }
  draftTask() {
    this.editTask();
    const plan = this.data.plans.find(p=>p.project===this.project);
    if (plan?.nextAction) this.editor.querySelector('[name=title]').value = plan.nextAction.slice(0,200);
    this.editor.querySelector('[name=title]').focus();
  }
  setupStep(id) {
    const setup = projectSetup(this.project, this.data);
    if (id === 'outcome') { const panel=this.dialog.querySelector('.plan-editor');panel.open=true;panel.querySelector('textarea').focus(); }
    if (id === 'task') this.draftTask();
    if (id === 'chat') {
      if (setup.currentTask && this.data.conversations.some(c=>c.project===this.project)) { this.editTask(setup.currentTask); this.editor.querySelector('.task-details').open=true; }
      else { this.dialog.close();this.onConversations(this.project); }
    }
    if (id === 'review') {
      if (setup.reviewTask) this.review.open(setup.reviewTask);
      else if (setup.currentTask) { this.editTask(setup.currentTask);this.message('Record outputs and checks when the work is ready, then choose Needs review.'); }
      else this.message('Add a task first. Review decisions stay yours.');
    }
  }
  setupGuide() {
    const setup=projectSetup(this.project,this.data);
    const show=this.guideOpen || setup.done < 2;
    return `<details class="setup-guide" ${show?'open':''}><summary>Getting started · ${setup.done} of 3 recorded</summary>
      <div class="setup-steps">${setup.steps.map(s=>`<div class="row-card"><div class="row-main"><b>${s.done?'✓ ':''}${esc(s.label)}</b><small>${s.done?'Recorded in this home':s.id==='review'?'Review when evidence is ready. A return with feedback also counts.':'Saved locally, never sent to an agent.'}</small></div>${s.done?'':`<button data-setup-step="${s.id}">${s.id==='outcome'?'Set outcome':s.id==='task'?'Draft task':setup.reviewTask?'Open review':'Prepare evidence'}</button>`}</div>`).join('')}</div>
      <div class="row-actions"><button data-setup-step="chat">${setup.linked?'Linked chats':'Link a chat (optional)'}</button>${setup.currentTask?`<button data-handoff="${esc(setup.currentTask.id)}">Copy task handoff</button>`:''}</div><small>Do the work in your agent’s app. Copying a handoff sends nothing and changes no task stage.</small></details>`;
  }
  async copyHandoff(task) {
    if (!task) return;
    const text=taskHandoff(task,this.data);
    this.handoffDialog ||= document.createElement('dialog');
    this.handoffDialog.className='task-editor glass';
    this.handoffDialog.innerHTML=`<header class="panel-head"><span class="panel-icon">${icon('copy')}</span><div><h2>Task handoff</h2></div><button class="icon-btn" data-dismiss aria-label="Close handoff">${icon('x')}</button></header><p>Copy into your agent’s app when you want to continue. Nothing is sent automatically.</p><label>Handoff text<textarea readonly rows="12"></textarea></label><button data-copy-text>Copy handoff</button><p role="status"></p>`;
    this.handoffDialog.querySelector('textarea').value=text;
    this.handoffDialog.querySelector('[data-dismiss]').onclick=()=>this.handoffDialog.close();
    this.handoffDialog.querySelector('[data-copy-text]').onclick=async()=>{
      try {await navigator.clipboard.writeText(text);this.handoffDialog.querySelector('[role=status]').textContent='Copied. Paste it into the source app yourself.';}
      catch {this.handoffDialog.querySelector('textarea').select();this.handoffDialog.querySelector('[role=status]').textContent='Select and copy the text above.';}
    };
    if (!this.handoffDialog.isConnected) document.body.append(this.handoffDialog);
    this.handoffDialog.showModal();
  }
  homeName(project) { return this.data.households.find(h => h.project === project)?.name || project; }
  /** Compact links for a conversation: open it in its app (or copy its ID), and find its resident. */
  conversationActions(c, { compact = false } = {}) {
    const session = this.data.sessions.find(s => s.conversation?.key === c.key && !s.parent_session);
    const target = conversationTarget(c);
    const app = esc(c.app || c.source);
    return `${target ? `<a class="chip-link" href="${esc(target.url)}" ${target.native?'':'target="_blank" rel="noopener noreferrer"'} title="${esc(target.label)}">${icon('externalLink')} ${esc(target.label)}</a>` : ''}
      ${!target || target.native ? `<button class="chip-link" data-copy="${esc(c.id)}" title="Copy the ID if the app cannot open this chat">${icon('copy')} Copy ID</button>` : ''}
      ${session ? `<button class="chip-link" data-session="${esc(session.session)}" title="Show the resident working on it">${icon('eye')} Show</button>` : ''}`;
  }
  referenceActions(text) {
    return evidenceReferences(text).map(r => r.kind === 'url' && safeReferenceURL(r.value)
      ? `<a class="chip-link" href="${esc(r.value)}" target="_blank" rel="noopener noreferrer">${icon('externalLink')} ${esc(r.value.replace(/^https?:\/\//, '').slice(0, 48))}</a>`
      : `<button class="chip-link" data-copy="${esc(r.value)}" title="Copy path">${icon('copy')} <code>${esc(r.value.split('/').slice(-2).join('/'))}</code></button>`).join('');
  }
  /** A task as one compact row; outputs show inline when it's waiting for your review. */
  taskCard(t, { showEvidence = t.status === 'needs_review' } = {}) {
    const chats = (t.conversationKeys || []).map(key => this.data.conversations.find(c => c.key === key && c.project === t.project)).filter(Boolean);
    const evidence = t.evidence || t.references?.length ? `<details class="row-evidence" ${showEvidence ? 'open' : ''}><summary>${icon('listChecks')} Outputs & checks</summary>${referencesHTML(t)}<p>${esc(t.evidence || '')}</p><div class="row-links">${this.referenceActions(t.evidence)}</div></details>` : '';
    return `<article class="row-card stage-${esc(t.status)}"><div class="row-main">
        <b>${esc(t.title)}</b>
        <small><span class="stage-pill">${esc(TASK_STAGES[t.status])}</span>${t.acceptedAt ? ` · accepted ${esc(ago(t.acceptedAt))}` : t.updatedAt ? ` · ${esc(ago(t.updatedAt))}` : ''}</small>
        ${t.blocker && t.status !== 'accepted' ? `<p class="row-blocker">${icon('circleAlert')} ${esc(t.blocker)}</p>` : ''}
        ${t.reviewSummary?`<p class="task-summary">${esc(t.reviewSummary.slice(0,160))}${t.reviewSummary.length>160?'…':''}</p>`:''}${t.reviews?.length ? `<p class="row-blocker">Last review: ${esc(t.reviews.at(-1).decision)} · ${esc(t.reviews.at(-1).feedback)}</p>` : ''}${evidence}
        ${chats.length ? `<div class="row-links">${chats.map(c => this.conversationActions(c, { compact: true })).join('')}</div>` : ''}
      </div><button class="chip-link" data-handoff="${esc(t.id)}">${icon('copy')} Handoff</button><button class="${t.status === 'needs_review' ? 'primary' : ''}" ${t.status === 'needs_review' ? 'data-review' : 'data-task'}="${esc(t.id)}">${t.status === 'needs_review' ? 'Review' : 'Open'}</button></article>`;
  }
  /** Something that needs you, as one row: what, where, how long, and the one action that helps. */
  attentionCard(i) {
    const s = this.data.sessions.find(s => s.session === i.session);
    const c = this.data.conversations.find(c => c.key === i.conversationKey) || s?.conversation;
    const age = Math.max(0, (Date.now() - Date.parse(i.since)) / 1000);
    const when = this.connected || i.origin === 'user' ? `waiting ${formatDuration(age).split(' ')[0]}` : 'last known';
    return `<article class="row-card reason-${esc(i.reason)}" title="${esc(i.action)}"><span class="row-icon">${icon(REASON_ICON[i.reason] || 'hand')}</span>
      <div class="row-main"><b>${esc(i.title)}</b><small>${esc(this.homeName(i.project))} · ${when}</small></div>
      <div class="row-actions">${i.task ? (i.reason === 'review' ? `<button class="primary" data-review="${esc(i.task)}" title="See outputs and checks">Review</button>` : `<button class="primary" data-task="${esc(i.task)}">Open</button>`) : ''}${c ? this.conversationActions(c, { compact: true }) : i.session ? `<button class="chip-link" data-session="${esc(i.session)}">${icon('eye')} Show</button>` : ''}</div></article>`;
  }
  renderHomes() {
    const effectiveFocus = this.data.households.some(h => h.project === this.focus) ? this.focus : '';
    const counts = new Map();
    for (const i of attentionItems(this.data)) counts.set(i.project, (counts.get(i.project) || 0) + 1);
    this.dialog.querySelector('.home-chips').innerHTML = this.data.households.map(h => `<button class="chip-btn ${h.project === this.project ? 'on' : ''}" data-home="${esc(h.project)}">${h.project === effectiveFocus ? icon('star') : ''}${esc(h.name)}${counts.get(h.project) ? ` <span class="count">${counts.get(h.project)}</span>` : ''}</button>`).join('') || '<small>No homes yet. Start a coding session or add a chat.</small>';
  }
  render() {
    const all = attentionItems(this.data);
    document.getElementById('work-open').textContent = `Work${all.length ? ` · ${all.length}` : ''}`;
    const content = this.dialog.querySelector('.work-content');
    this.dialog.querySelector('.work-connection').innerHTML = this.connected ? `<span class="dot live"></span> Live bridge` : `<span class="dot"></span> Offline · may be out of date`;
    const effectiveFocus = this.data.households.some(h => h.project === this.focus) ? this.focus : '';
    const focusBtn = this.dialog.querySelector('[data-focus]');
    focusBtn.disabled = !this.project;
    focusBtn.classList.toggle('on', !!this.project && effectiveFocus === this.project);
    focusBtn.querySelector('span').textContent = this.project && effectiveFocus === this.project ? 'Focused' : 'Focus';
    this.renderHomes();
    this.dialog.querySelector('.plan-editor').hidden = !this.project || this.view !== 'overview';
    const reviews = this.data.tasks.filter(t => t.project === this.project && t.status === 'needs_review').length;
    this.dialog.querySelectorAll('[data-view]').forEach(b => b.classList.toggle('selected', b.dataset.view === this.view));
    const rv = this.dialog.querySelector('.work-tabs [data-view=reviews]');
    rv.innerHTML = `${icon('eye')} Reviews${reviews ? ` <span class="count">${reviews}</span>` : ''}`;
    if (this.view === 'attention') {
      const visible = focusedAttention(all, effectiveFocus, this.allAttention);
      const hidden = all.length - visible.length;
      content.innerHTML = `<div class="sec-head"><h3>Needs you · all homes <span class="count">${visible.length}</span></h3>${effectiveFocus ? `<button class="link-btn" data-all-attention>${this.allAttention ? 'Use focus' : `Show ${hidden} more`}</button>` : ''}</div>
        ${visible.length ? visible.map(i => this.attentionCard(i)).join('') : `<p class="empty-note">${icon('check')} All clear.</p>`}
        <button class="link-btn" data-view="overview">${icon('arrowLeft')} Back</button>`;
    } else if (!this.project) content.innerHTML = `<p class="empty-note">Pick a home above to see its work.</p>`;
    else if (this.view === 'measure') { this.study.mount(content, this.project, this.data.tasks); }
    else if (this.view === 'tasks') {
      const here = this.data.tasks.filter(t => t.project === this.project);
      // Counts for every stage on one line; only stages with tasks get a list.
      const stages = Object.entries(TASK_STAGES).map(([k, v]) => [k, v, here.filter(t => t.status === k)]);
      content.innerHTML = `<div class="sec-head"><h3>Tasks</h3><button class="primary" data-new-task>${icon('plus')} Add task</button></div>
        <div class="stage-counts">${stages.map(([k, v, list]) => `<span class="pill stage-${k}">${v} <b>${list.length}</b></span>`).join('')}</div>
        ${here.length ? `<div class="task-board">${stages.filter(([, , list]) => list.length).map(([, v, list]) => `<section><h4>${v}</h4>${list.map(t => this.taskCard(t, { showEvidence: false })).join('')}</section>`).join('')}</div>` : `<p class="empty-note">No tasks yet. Add one to track a piece of work.</p>`}`;
    } else if (this.view === 'reviews') {
      const tasks = this.data.tasks.filter(t => t.project === this.project && t.status === 'needs_review');
      content.innerHTML = `<div class="sec-head"><h3>Ready for review <span class="count">${tasks.length}</span></h3></div>${tasks.map(t => this.taskCard(t, { showEvidence: false })).join('') || `<p class="empty-note">${icon('check')} Nothing to review.</p>`}`;
    } else {
      const p = this.data.plans.find(p => p.project === this.project);
      const b = returnBriefing(this.project, this.data);
      // Acknowledge only timestamps represented in this snapshot, not time spent staring at it.
      this.through = briefingCutoff(this.project, this.data);
      const reached = p?.milestones || [];
      const level = homeLevel(p);
      const plan = `<article class="plan-card"><div class="plan-main">
          <small>Outcome</small><h3>${esc(p?.outcome || 'No outcome yet')}</h3>
          <p>${icon('arrowRight')} ${esc(p?.nextAction || 'Add a next step')}</p></div>
        <div class="plan-side"><span class="stars" title="${esc(levelName(level))}">${'★'.repeat(level)}<i>${'☆'.repeat(MAX_LEVEL - level)}</i></span>
          <div class="row-actions"><button class="chip-link" data-edit-plan>${icon('pencil')} Edit</button>${p?.outcome ? `<button class="chip-link" data-reach>${icon('flag')} Reached</button>` : ''}</div></div>
        <div class="reach-confirm" ${this.reachOpen && p?.outcome ? '' : 'hidden'}><label><input type="checkbox" name="reachConfirm" ${this.reachChecked ? 'checked' : ''} /> Yes, this outcome is reached</label>
          <small>+${BRICKS.outcomeReached} gems${level < MAX_LEVEL ? ` · grows into a ${esc(levelName(level + 1))}` : ''}</small><button class="primary" data-reach-confirm>Confirm</button></div>
        ${reached.length ? `<details class="reached"><summary>${reached.length} reached</summary><ul>${reached.map(m => `<li>${esc(m.outcome)} <small>${esc(ago(m.reachedAt))}</small></li>`).join('')}</ul><button class="link-btn" data-undo-milestone>Undo the last one</button></details>` : ''}
      </article>`;
      const needs = b.attention.length
        ? b.attention.slice(0, 4).map(i => this.attentionCard(i)).join('') + (b.attention.length > 4 ? `<button class="link-btn" data-view="attention">${b.attention.length - 4} more</button>` : '')
        : `<p class="empty-note">${icon('check')} Nothing needs you here.</p>`;
      // "Up next" only when it isn't the same thing as the first item that needs you.
      const upNext = !b.attention.length && b.next ? `<section class="up-next"><h3 class="sec">Up next</h3><article class="row-card"><span class="row-icon">${icon('arrowRight')}</span><div class="row-main"><b>${esc(b.next.title)}</b><small>${esc(b.next.detail)}</small></div>
        <div class="row-actions">${b.next.task ? `<button data-task="${esc(b.next.task)}">Open</button>` : b.next.session ? `<button data-session="${esc(b.next.session)}">Show</button>` : ''}</div></article></section>` : '';
      const others = all.filter(i => i.project !== this.project).length;
      const changed = b.changedTasks.length + b.newConversations.length;
      content.innerHTML = `${this.setupGuide()}${plan}
        <section><div class="sec-head"><h3 class="sec">Needs you <span class="count">${b.attention.length}</span></h3>${others ? `<button class="link-btn" data-view="attention">${others} in other homes</button>` : ''}</div>${needs}</section>
        ${upNext}
        <details class="changed"><summary><b>Changed since last check</b> <span class="count">${changed}</span></summary>
          ${b.changedTasks.slice(0, 6).map(t => this.taskCard(t, { showEvidence: false })).join('')}
          ${b.newConversations.slice(0, 6).map(c => {
            const s = this.data.sessions.find(s => s.conversation?.key === c.key && !s.parent_session);
            const a = s ? resolveActivity(s) : null;
            return `<article class="row-card"><span class="row-icon">${icon('messageCircle')}</span><div class="row-main"><b>${esc(conversationLabel(c))}</b><small>${esc(c.app || c.source)} · ${a ? `${this.connected ? '' : 'Last known: '}${esc(a.label)}` : 'not attached'} · ${esc(observedLabel(c))}</small></div><div class="row-actions">${this.conversationActions(c, { compact: true })}</div></article>`;
          }).join('') || `<p class="empty-note small">No changes.</p>`}
        </details>
        <div class="briefing-foot"><span class="pill" title="Accepted by you">${icon('check')} ${b.counts.accepted}</span><span class="pill" title="Need review">${icon('eye')} ${b.counts.reviews}</span><span class="pill" title="Blocked">${icon('circleAlert')} ${b.counts.blockers}</span>
          <button data-shelf-home="${esc(this.project)}" class="link-btn">${icon('messageCircle')} Chats</button><button data-seen title="${b.since ? `Last checked ${esc(ago(b.since))}` : 'First check'}">Mark caught up</button></div>`;
    }
  }
}

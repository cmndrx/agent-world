import { observedLabel } from '../../shared/freshness.mjs';
import { resolveActivity } from './activity.js';
import { conversationTarget, conversationLabel } from '../../shared/conversations.mjs';
import { escapeHtml } from './sim.js';
import { icon } from './icons.js';

const ago = (iso) => { const s = Math.max(0, (Date.now() - Date.parse(iso)) / 1000); return s < 60 ? 'just now' : s < 3600 ? `${Math.floor(s / 60)}m ago` : s < 86400 ? `${Math.floor(s / 3600)}h ago` : `${Math.floor(s / 86400)}d ago`; };

const esc = escapeHtml;
export class ConversationLibrary {
  constructor({ onFocus, onFocusLot }) {
    this.onFocus = onFocus;
    this.onFocusLot = onFocusLot;
    this.data = { households: [], projects: [], conversations: [], sessions: [] };
    this.project = '';
    this.connected = false;
    this.dialog = document.createElement('dialog');
    this.dialog.className = 'conversation-library glass';
    this.dialog.innerHTML = `
      <header class="panel-head"><span class="panel-icon">${icon('messageCircle')}</span><div><h2>Chats</h2><small class="library-connection"></small></div><button type="button" class="icon-btn" data-close aria-label="Close">${icon('x')}</button></header>
      <nav class="home-chips library-homes" aria-label="Homes"></nav>
      <input class="library-search" type="search" placeholder="Search chats" aria-label="Search chats" />
      <div class="conversation-list"></div>
      <details class="library-add"><summary>${icon('plus')} Add a saved chat or app project</summary>
        <p class="hint">Saved chats are links only — no live activity.</p>
        <div class="library-forms">
          <form data-form="project"><h3>Add app project</h3>
            <label>App<select name="source"><option value="chatgpt">ChatGPT</option><option value="claude">Claude</option></select></label>
            <label>Project name<input name="name" required maxlength="100" /></label>
            <label>Project link<input name="externalId" required maxlength="500" placeholder="Paste the project link from your app" /></label>
            <label>Home<select name="home"><option value="">Create a new home</option></select></label>
            <button type="submit">Add project</button>
          </form>
          <form data-form="conversation"><h3>Add saved chat</h3>
            <label>App<select name="source"><option value="chatgpt">ChatGPT</option><option value="claude">Claude</option></select></label>
            <label>Project<select name="project"><option value="">Unsorted chats</option></select></label>
            <label>Conversation link<input name="url" type="url" required placeholder="https://chatgpt.com/c/…" /></label>
            <label>Title (optional)<input name="title" maxlength="200" /></label>
            <label class="consent"><input name="allowTitle" type="checkbox" /> Allow saving this title locally. It may contain private information.</label>
            <button type="submit">Save conversation</button>
          </form>
        </div>
      </details>
      <form data-form="title" hidden><h3>Name conversation</h3><input name="key" type="hidden" />
        <label>Title<input name="title" maxlength="200" /></label>
        <label class="consent"><input name="allowTitle" type="checkbox" /> Allow saving this title locally.</label>
        <button type="submit">Save title</button><button type="button" data-cancel-title>Cancel</button>
      </form>
      <p class="library-message" role="status"></p>`;
    document.body.append(this.dialog);
    this.dialog.querySelector('input[type=search]').addEventListener('input', () => this.renderChats());
    this.dialog.addEventListener('click', e => {
      if (e.target.closest('[data-close]')) this.dialog.close();
      if (e.target.closest('[data-cancel-title]')) this.dialog.querySelector('[data-form=title]').hidden = true;
      const home = e.target.closest('[data-home]');
      if (home) { this.project = home.dataset.home; this.renderHomes(); this.renderChats(); if (this.project) this.onFocusLot(this.project); }
      const focus = e.target.closest('[data-session]');
      if (focus) { this.onFocus(focus.dataset.session); this.dialog.close(); }
      const edit = e.target.closest('[data-edit-title]');
      if (edit) {
        const c = this.data.conversations.find(c => c.key === edit.dataset.editTitle);
        const f = this.dialog.querySelector('[data-form=title]');
        f.hidden = false; f.elements.key.value = c.key; f.elements.title.value = c.title || ''; f.elements.allowTitle.checked = false; f.elements.title.focus();
      }
    });
    this.dialog.querySelector('[data-form=conversation] select[name=source]').addEventListener('change', () => this.renderProjectOptions());
    this.dialog.addEventListener('submit', async e => {
      e.preventDefault();
      const form = e.target;
      const kind = form.dataset.form;
      const input = Object.fromEntries(new FormData(form));
      if (form.elements.allowTitle) input.allowTitle = form.elements.allowTitle.checked;
      const button = form.querySelector('button[type=submit]');
      button.disabled = true;
      try {
        const res = await fetch(kind === 'title' ? '/api/conversation-title' : kind === 'project' ? '/api/projects' : '/api/conversations', {
          method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(input),
        });
        const result = await res.json();
        if (!res.ok) throw new Error(result.error || 'Could not save.');
        form.reset();
        this.renderProjectOptions();
        if (kind === 'title') form.hidden = true;
        this.dialog.querySelector('.library-message').textContent = 'Saved.';
      } catch (err) { this.dialog.querySelector('.library-message').textContent = err.message; }
      finally { button.disabled = false; }
    });
  }

  open(project = '') {
    this.project = project;
    this.dialog.querySelector('input[type=search]').value = '';
    this.dialog.querySelector('.library-message').textContent = '';
    this.renderHomes(); this.renderChats();
    if (!this.dialog.open) this.dialog.showModal();
  }
  setData(data) {
    Object.assign(this.data, data);
    const homeKey = JSON.stringify(this.data.households.map(h => [h.project, h.name]));
    const projectsKey = JSON.stringify(this.data.projects);
    if (projectsKey !== this.projectsKey) { this.projectsKey = projectsKey; this.renderProjectOptions(); }
    if (homeKey !== this.homeKey || projectsKey !== this.homeProjectsKey) {
      this.homeKey = homeKey; this.homeProjectsKey = projectsKey; this.renderHomes();
    }
    if (homeKey !== this.optionsKey) {
    this.optionsKey = homeKey;
    const select = this.dialog.querySelector('[data-form=project] select[name=home]');
    const value = select.value;
    select.innerHTML = '<option value="">Create a new home</option>' + this.data.households.map(h => `<option value="${esc(h.project)}">${esc(h.name)}</option>`).join('');
    select.value = value;
    if (!select.value) select.value = '';
    }
    this.renderChats();
  }
  setConnection(connected) { this.connected = connected; this.renderChats(); }
  renderHomes() {
    const count = (p) => this.data.conversations.filter(c => !p || c.project === p).length;
    this.dialog.querySelector('.library-homes').innerHTML = `<button data-home="" class="chip-btn ${this.project ? '' : 'on'}">All <span class="n">${count('')}</span></button>` + this.data.households.map(h =>
      `<button data-home="${esc(h.project)}" class="chip-btn ${this.project === h.project ? 'on' : ''}">${esc(h.name)} <span class="n">${count(h.project)}</span></button>`).join('');
  }
  renderProjectOptions() {
    const form = this.dialog.querySelector('[data-form=conversation]');
    const value = form.elements.project.value;
    form.elements.project.innerHTML = '<option value="">Unsorted chats</option>' + this.data.projects.filter(p => p.source === form.elements.source.value).map(p => `<option value="${esc(p.id)}">${esc(p.name)}</option>`).join('');
    form.elements.project.value = value;
    if (!form.elements.project.value) form.elements.project.value = '';
  }
  /** One compact row per chat: app, title, where, when, and what you can do with it. */
  renderChats() {
    const query = this.dialog.querySelector('input[type=search]').value.toLowerCase();
    this.dialog.querySelector('.library-connection').innerHTML = this.connected ? '<span class="dot live"></span> Live bridge' : '<span class="dot"></span> Offline · may be out of date';
    const list = this.data.conversations.filter(c => (!this.project || c.project === this.project) && `${conversationLabel(c)} ${c.app} ${c.id}`.toLowerCase().includes(query));
    list.sort((a, b) => (b.lastObservedAt || '').localeCompare(a.lastObservedAt || ''));
    this.dialog.querySelector('.conversation-list').innerHTML = list.length ? list.map(c => {
      const target = conversationTarget(c);
      const s = this.data.sessions.find(s => !s.parent_session && s.conversation?.key === c.key);
      const h = this.data.households.find(h => h.project === c.project);
      const resident = s && h?.characters.find(r => r.slot === s.slot);
      const live = s && this.connected;
      const where = [h?.name, resident ? `${resident.name}'s desk` : null].filter(Boolean).join(' · ');
      const when = c.lastObservedAt ? ago(c.lastObservedAt) : 'saved link';
      return `<article class="row-card ${live ? 'live' : ''}"><span class="row-icon">${icon(live ? 'zap' : 'messageCircle')}</span>
        <div class="row-main"><b>${esc(conversationLabel(c))}</b><small>${esc(c.app)} · ${esc(where || 'Unsorted')} · ${live ? `${esc(resolveActivity(s).label)} · ${esc(observedLabel(c))}` : s ? `Last known: ${esc(resolveActivity(s).label)} · ${esc(observedLabel(c))}` : c.lastObservedAt ? esc(observedLabel(c)) : 'Saved link · activity unavailable'}</small></div>
        <div class="row-actions">${s ? `<button class="chip-link" data-session="${esc(s.session)}" title="Show ${esc(resident?.name || 'the resident')}">${icon('eye')} Show</button>` : ''}
          ${target ? `<a class="chip-link" href="${esc(target.url)}" ${target.native?'':'target="_blank" rel="noopener noreferrer"'}>${icon('externalLink')} ${esc(target.label)}</a>` : ''}
          <button class="icon-btn small" data-edit-title="${esc(c.key)}" title="${c.title ? 'Rename' : 'Name this chat'}" aria-label="Name this chat">${icon('pencil')}</button></div></article>`;
    }).join('') : `<p class="empty-note">No chats here yet.</p>`;
  }
}

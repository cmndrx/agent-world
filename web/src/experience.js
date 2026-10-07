import { ConnectedUsage } from './usage.js';
import { observedLabel } from '../../shared/freshness.mjs';
import { icon } from './icons.js';

// Navigation preferences are local UI choices, separate from planning and observed activity.
export class Experience {
  constructor({ work, action, pets, leavePlay, onConversations }) {
    this.usage = new ConnectedUsage();
    this.onConversations = onConversations;
    this.work = work; this.action = action; this.pets = pets; this.leavePlay = leavePlay;
    this.dialog = document.createElement('dialog');
    this.dialog.className = 'experience-panel glass';
    document.body.append(this.dialog);
    this.mode = 'work';
    this.setMode('work');
    document.getElementById('work-open').addEventListener('click', () => this.setMode('work'));
    document.getElementById('play-open').addEventListener('click', () => { this.setMode('play'); this.open('play'); });
    document.getElementById('sources-open').addEventListener('click', () => this.open('sources'));
    this.dialog.addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b) return;
      if (b.hasAttribute('data-close')) this.dialog.close();
      if (b.dataset.go) {
        this.dialog.close();
        if (b.dataset.go === 'work') { this.setMode('work'); this.work.open(); }
        else if (b.dataset.go === 'conversations') this.onConversations();
        else if (b.dataset.go === 'bricks') document.getElementById('bricks-open').click();
        else if (b.dataset.go === 'pets') this.pets();
        else this.action(b.dataset.go);
      }
    });
    this.dialog.addEventListener('close', () => {clearInterval(this.refresh);this.usage.stop();});
  }
  setMode(mode) {
    if (mode === 'work') this.leavePlay();
    this.mode = mode; document.body.dataset.experience = mode;
    for (const m of ['work', 'play']) document.getElementById(`${m}-open`).setAttribute('aria-pressed', String(mode === m));
  }
  open(view) {
    this.usage.stop();
    this.view = view; this.render();
    if (!this.dialog.open) this.dialog.showModal();
    clearInterval(this.refresh);
    if (view === 'sources') { this.usage.element.open=true;this.usage.start(); }
    if (view === 'sources') this.refresh = setInterval(() => this.refreshConnection(), 15000);

  }
  refreshConnection() {
    if (!this.dialog.open || this.view !== 'sources') return;
    this.dialog.querySelector('[data-bridge-status]').textContent = this.work.connected ? 'Live bridge · observations below are history' : 'Offline · current activity unavailable';
    for (const el of this.dialog.querySelectorAll('[data-source-age]')) {
      const source = el.dataset.sourceAge;
      const latest = this.work.data.conversations.filter(c=>c.source===source && c.lastObservedAt).map(c=>c.lastObservedAt).sort().at(-1);
      el.textContent = observedLabel({lastObservedAt:latest});
    }
  }
  render() {
    const play = this.view === 'play';
    const tile = (go, ic, label, detail) => `<button class="tile" data-go="${go}"><span class="tile-icon">${icon(ic)}</span><b>${label}</b><small>${detail}</small></button>`;
    this.dialog.innerHTML = `<header class="panel-head"><span class="panel-icon ${play ? 'play' : ''}">${icon(play ? 'gamepad' : 'plug')}</span><div><h2>${play ? 'Play' : 'Connections'}</h2><small>${play ? 'Just for fun · never measures your work' : 'What Agent World can see'}</small></div><button class="icon-btn" data-close aria-label="Close">${icon('x')}</button></header>${play ? `
      <div class="tiles">${tile('build', 'hammer', 'Decorate', 'Free items today')}${tile('pets', 'cat', 'Pets', 'Pick a buddy')}${tile('wardrobe', 'shirt', 'Outfits', 'Dress up')}${tile('map', 'map', 'Map', 'Move homes')}${tile('city', 'building2', 'Downtown', 'Watch it grow')}${tile('photo', 'camera', 'Photos', 'Snap your world')}${tile('bricks', 'brickWall', 'Rewards', 'Bricks & levels')}${tile('build', 'sprout', 'Garden', 'Plant a bed')}</div>
      <footer class="panel-foot"><button class="link-btn" data-go="work">${icon('arrowLeft')} Back to Work</button>
        <details class="info-note"><summary>${icon('info')} Good to know</summary><ul><li>Gardens grow over real hours and never wilt.</li><li>Downtown grows from the kinds of work seen, one day at a time. Quiet days take nothing away.</li><li>Season and weather are in the dock.</li></ul></details></footer>` : this.sources()}`;
    if(!play)this.usage.mount(this.dialog.querySelector('[data-connected-usage]'));
  }
  sources() {
    const data = this.work.data;
    const status = (source) => {
      const latest = data.conversations.filter(c => c.source === source && c.lastObservedAt).map(c => c.lastObservedAt).sort().at(-1);
      if (!latest) return { cls: '', text: 'Nothing seen yet' };
      return { cls: '', text: observedLabel({lastObservedAt:latest}) };
    };
    const row = (ic, label, st, source = '') => `<div class="row-card"><span class="row-icon">${icon(ic)}</span><div class="row-main"><b>${label}</b><small><span class="dot ${st.cls}"></span> <span ${source ? `data-source-age="${source}"` : ''}>${st.text}</span></small></div></div>`;
    return `<p class="connection-summary" data-bridge-status>${this.work.connected ? 'Live bridge · observations below are history' : 'Offline · current activity unavailable'}</p>${row('terminal', 'Codex', status('codex'), 'codex')}${row('terminal', 'Claude Code', status('claude-code'), 'claude-code')}${row('messageCircle', 'ChatGPT & Claude chats', { cls: 'saved', text: 'Saved links only' })}
      <div data-connected-usage></div>
      <h3 class="sec" style="margin:14px 0 8px">Start here</h3>
      <ol class="steps"><li><span>${icon('target')}</span>Set an outcome</li><li><span>${icon('plus')}</span>Add a task</li><li><span>${icon('eye')}</span>Review & accept</li></ol>
      <div class="row-actions" style="justify-content:flex-start"><button class="primary" data-go="work">${icon('briefcase')} Open Work</button><button data-go="conversations">${icon('messageCircle')} Chats</button></div>
      <footer class="panel-foot"><span></span><details class="info-note"><summary>${icon('info')} What's not covered</summary><ul>
        <li>“Last observed” is history, not an adapter health check. Connection status is shown above.</li>
        <li>Codex permission prompts aren't logged.</li>
        <li>A Claude Code “stop” means your turn, not success.</li>
        <li>App chats are links you save; there's no account sync or live activity.</li>
        <li>Growth and rewards describe activity or your decisions, not quality.</li></ul></details></footer>`;
  }
}

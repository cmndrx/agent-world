import { CONNECTION_GEMS, TOWN_HALL, townHallState } from '../../shared/gameplay.mjs';
import { icon } from './icons.js';

const SEEN = 'agent-world:mayor-martin-seen';
const timeLeft = ms => `${Math.ceil(ms / 60_000)} min`;
const escape = text => String(text).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');

export class MayorOnboarding {
  constructor({ character, onConnections, onChange, onFocusTownHall }) {
    this.character = character;
    this.onConnections = onConnections;
    this.onChange = onChange;
    this.onFocusTownHall = onFocusTownHall;
    this.gameplay = {};
    this.balance = 0;
    this.beat = 0;
    this.dialog = document.createElement('dialog');
    this.dialog.className = 'mayor-dialog';
    this.dialog.setAttribute('aria-label', 'Conversation with Mayor Martin');
    document.body.append(this.dialog);
    this.dialog.addEventListener('click', e => this.click(e));
    this.dialog.addEventListener('keydown', e => {
      if (e.key === 'Escape') this.dialog.close();
    });
    this.dialog.addEventListener('close', () => localStorage.setItem(SEEN, '1'));
    this.timer = setInterval(() => {
      const state = townHallState(this.gameplay);
      if (this.dialog.open && state.status === 'building') {
        const countdown = this.dialog.querySelector('[data-countdown]');
        const bar = this.dialog.querySelector('[data-progress]');
        if (countdown) countdown.textContent = timeLeft(state.remainingMs);
        if (bar) bar.style.width = `${Math.max(2, 100 * (1 - state.remainingMs / TOWN_HALL.durationMs))}%`;
      }
      if (state.status === 'built' && this.lastStatus === 'building') this.onChange();
      this.lastStatus = state.status;
    }, 1000);
  }

  setData(gameplay, balance) {
    this.gameplay = gameplay || {};
    this.balance = balance;
    this.lastStatus = townHallState(this.gameplay).status;
    if (!this.initialized) {
      this.initialized = true;
      if (!this.gameplay.connection) this.beat = 0;
      if (!this.gameplay.connection || !localStorage.getItem(SEEN)) this.open();
    } else if (this.dialog.open) this.render();
  }

  open() {
    this.render();
    if (!this.dialog.open) this.dialog.show();
    this.onFocusTownHall();
  }

  async click(e) {
    const button = e.target.closest('button');
    if (!button) return;
    if (button.dataset.close != null) { this.dialog.close(); return; }
    if (button.dataset.next != null) { this.beat = 1; this.render(); return; }
    if (button.dataset.connections != null) {
      this.dialog.close();
      this.onConnections();
      return;
    }
    if (!button.dataset.action) return;
    button.disabled = true;
    this.error = '';
    this.auth = null;
    try {
      const response = await fetch('/api/gameplay', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: button.dataset.action, provider: button.dataset.provider }) });
      const data = await response.json();
      this.auth = data.auth || null;
      if (!response.ok) throw new Error(response.status === 404 ? 'This game server is out of date. Restart Agent World and try again.' : data.error || 'Town action failed.');
      this.gameplay = data.gameplay;
      this.onChange(data.gameplay);
    } catch (error) { this.error = error.message; }
    this.render();
  }

  render() {
    const state = townHallState(this.gameplay);
    const connected = !!this.gameplay.connection;
    let line, choices, detail = '';
    if (!connected && this.beat === 0) {
      line = 'Governor! There you are. I’ve been dreaming of the town we can build together.';
      choices = `<button class="mayor-choice primary" data-next>Tell me more ${icon('chevronRight')}</button>`;
    } else if (!connected) {
      line = `Already signed in to Codex or Claude Code? Link one to this town. I'll welcome your agents and give you ${CONNECTION_GEMS} gems for our Town Hall.`;
      choices = `<button class="mayor-choice primary" data-action="claim" data-provider="codex">Link Codex to town ${icon('chevronRight')}</button><button class="mayor-choice" data-action="claim" data-provider="claude">Link Claude Code to town ${icon('chevronRight')}</button><button class="mayor-choice subtle" data-connections>How do I sign in? ${icon('chevronRight')}</button>`;
    } else if (state.status === 'empty') {
      line = `Wonderful! ${this.gameplay.connection.provider === 'claude' ? 'Claude Code' : 'Codex'} is here, and we have ${CONNECTION_GEMS} gems. Shall we lay the first stone of our Town Hall?`;
      detail = `<div class="mayor-detail"><span>${icon('gem')} ${TOWN_HALL.cost} gems</span><span>${icon('clock')} ${timeLeft(TOWN_HALL.durationMs)} to build</span><span>${this.balance} gems in your pocket</span></div>`;
      choices = `<button class="mayor-choice primary" data-action="start" ${this.balance < TOWN_HALL.cost ? 'disabled' : ''}>Build the Town Hall ${icon('chevronRight')}</button><button class="mayor-choice subtle" data-close>Let me look around ${icon('chevronRight')}</button>`;
    } else if (state.status === 'building') {
      line = `Look at it rise, Governor! The crew has about <strong data-countdown>${timeLeft(state.remainingMs)}</strong> left. A few more gems could hurry them along.`;
      detail = `<div class="mayor-progress" aria-label="Town Hall construction progress"><span data-progress style="width:${Math.max(2, 100 * (1 - state.remainingMs / TOWN_HALL.durationMs))}%"></span></div><div class="mayor-detail"><span>${icon('gem')} ${this.balance} gems</span><span>${icon('clock')} Ready in ${timeLeft(state.remainingMs)}</span></div>`;
      choices = `<button class="mayor-choice primary" data-action="expedite" ${this.balance < TOWN_HALL.expediteGems ? 'disabled' : ''}>Speed up 1 minute <span>${TOWN_HALL.expediteGems} ${icon('gem')}</span></button><button class="mayor-choice subtle" data-close>Let the crew work ${icon('chevronRight')}</button>`;
    } else {
      line = 'Would you look at that! Our Town Hall is open. This is only the beginning, Governor.';
      choices = `<button class="mayor-choice primary" data-close>Explore our town ${icon('chevronRight')}</button>`;
    }
    const error = this.error ? `<p class="mayor-error" role="alert">${escape(this.error)}</p>` : '';
    this.dialog.innerHTML = `<div class="mayor-wash" aria-hidden="true"></div><button class="mayor-dismiss" data-close aria-label="End conversation">${icon('x')}</button><section class="mayor-talk" aria-label="Mayor Martin"><div class="mayor-bubble"><div class="mayor-head"><span class="mayor-name">Mayor Martin</span><small class="mayor-quest">${icon('landmark')} The first build · Town Hall</small></div><p class="mayor-line" aria-live="polite">${line}</p>${detail}${error}<div class="mayor-options">${choices}</div></div></section>`;
    this.character.attachPortrait(this.dialog);
  }
}

import { CONNECTION_GEMS, TOWN_HALL, townHallState, mayorStage, completionCost, homeBuildState, homeCompletionCost } from '../../shared/gameplay.mjs';
import { icon } from './icons.js';

const SEEN = 'agent-world:mayor-martin-seen';
const timeLeft = ms => `${Math.ceil(ms / 60_000)} min`;
const escape = text => String(text).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');

export class MayorOnboarding {
  constructor({ character, onConnections, onChange, onFocusTownHall, onBuildHome, onMeetOwner }) {
    this.character = character;
    this.onConnections = onConnections;
    this.onChange = onChange;
    this.onFocusTownHall = onFocusTownHall;
    this.onBuildHome = onBuildHome;
    this.onMeetOwner = onMeetOwner;
    this.households = [];
    this.runs = [];
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
      const home = this.lastStage === 'home_building' ? this.households[0] : null;
      const state = home ? homeBuildState(this.gameplay, home.project) : townHallState(this.gameplay);
      if (this.dialog.open && state.status === 'building') {
        const countdown = this.dialog.querySelector('[data-countdown]');
        const bar = this.dialog.querySelector('[data-progress]');
        if (countdown) countdown.textContent = timeLeft(state.remainingMs);
        if (bar) bar.style.width = `${Math.max(2, 100 * (1 - state.remainingMs / TOWN_HALL.durationMs))}%`;
        const speed = this.dialog.querySelector('[data-action="expedite"], [data-action="expedite-home"]');
        const cost = home ? homeCompletionCost(this.gameplay, home.project) : completionCost(this.gameplay);
        if (speed) {
          speed.querySelector('[data-completion-cost]').textContent = `${cost} gems total`;
          speed.disabled = this.pending || this.balance < cost;
        }
      }
      if (state.status === 'built' && this.lastStatus === 'building') {
        this.onChange();
        this.open();
      }
      this.lastStatus = state.status;
    }, 1000);
  }

  setData(gameplay, balance, households = [], runs = []) {
    this.gameplay = gameplay || {};
    this.balance = balance;
    this.households = households;
    this.runs = runs;
    const stage = mayorStage(this.gameplay, households, runs);
    const newOwner = ['home', 'home_building'].includes(this.lastStage) && stage === 'owner';
    const newBuild = this.lastStage === 'home' && stage === 'home_building';
    this.lastStage = stage;
    this.lastStatus = townHallState(this.gameplay).status;
    if (!this.initialized) {
      this.initialized = true;
      if (!this.gameplay.connection) this.beat = 0;
      if (!this.gameplay.connection || !localStorage.getItem(SEEN)) this.open();
    } else if (newOwner || newBuild) this.open();
    else if (this.dialog.open) this.render();
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
    if (button.dataset.buildHome != null) { this.dialog.close(); this.onBuildHome(); return; }
    if (button.dataset.meetOwner != null) { this.dialog.close(); this.onMeetOwner(this.households.find(h => homeBuildState(this.gameplay, h.project).status === 'built') || this.households[0]); return; }
    if (button.dataset.connections != null) {
      this.dialog.close();
      this.onConnections();
      return;
    }
    if (!button.dataset.action) return;
    if (this.pending) return;
    this.pending = true;
    button.disabled = true;
    this.error = '';
    this.auth = null;
    try {
      const response = await fetch('/api/gameplay', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: button.dataset.action, provider: button.dataset.provider, project: button.dataset.project }) });
      const data = await response.json();
      this.auth = data.auth || null;
      if (!response.ok) throw new Error(response.status === 404 ? 'This game server is out of date. Restart Agent World and try again.' : data.error || 'Town action failed.');
      this.gameplay = data.gameplay;
      this.onChange(data.gameplay);
    } catch (error) { this.error = error.message; }
    this.pending = false;
    this.render();
  }

  render() {
    const state = townHallState(this.gameplay);
    const connected = !!this.gameplay.connection;
    const stage = mayorStage(this.gameplay, this.households, this.runs);
    const home = this.households.find(h => homeBuildState(this.gameplay, h.project).status === 'built') || this.households[0];
    const owner = home?.characters.find(c => c.id === home.ownerAgentId) || home?.characters[0];
    let quest = 'The first build · Town Hall';
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
      const cost = completionCost(this.gameplay);
      choices = `<button class="mayor-choice primary" data-action="expedite" ${this.pending || this.balance < cost ? 'disabled' : ''}>Speed up build <span><span data-completion-cost>${cost} gems total</span> ${icon('gem')}</span></button><button class="mayor-choice subtle" data-close>Let the crew work ${icon('chevronRight')}</button>`;
    } else if (stage === 'home') {
      quest = 'A place to begin · Your first home';
      line = 'Our Town Hall is open, Governor! Now let’s build your first home. Choose an existing project or create a new one, and a Personal Assistant will move in to look after it.';
      choices = `<button class="mayor-choice primary" data-build-home>Build your first home ${icon('house')}</button>`;
    } else if (stage === 'home_building') {
      const state = homeBuildState(this.gameplay, home.project), cost = homeCompletionCost(this.gameplay, home.project);
      quest = 'Building your first home';
      line = `${escape(home.name)} is taking shape, Governor! The crew has <strong data-countdown>${timeLeft(state.remainingMs)}</strong> left. Your Personal Assistant will move in when it is ready.`;
      detail = `<div class="mayor-progress"><span data-progress style="width:${Math.max(2,100*(1-state.remainingMs/TOWN_HALL.durationMs))}%"></span></div>`;
      choices = `<button class="mayor-choice primary" data-action="expedite-home" data-project="${escape(home.project)}" ${this.pending || this.balance < cost ? 'disabled' : ''}>Speed up build <span><span data-completion-cost>${cost} gems total</span> ${icon('gem')}</span></button><button class="mayor-choice subtle" data-close>Let the crew work ${icon('chevronRight')}</button>`;
    } else if (stage === 'owner') {
      quest = 'Meet your resident owner';
      line = `${escape(home.name || 'Your home')} is ready. ${escape(owner?.name || 'Your resident owner')} is here to help. Start a conversation and give them your first request.`;
      choices = `<button class="mayor-choice primary" data-meet-owner>Meet ${escape(owner?.name || 'your resident owner')} ${icon('chevronRight')}</button>`;
    } else {
      quest = 'Welcome home, Governor';
      line = 'Your resident owner has returned a response. Take a look together, Governor. I’ll be here as our town grows.';
      choices = `<button class="mayor-choice primary" data-meet-owner>Visit your resident owner ${icon('chevronRight')}</button><button class="mayor-choice subtle" data-close>Explore our town ${icon('chevronRight')}</button>`;
    }
    const error = this.error ? `<p class="mayor-error" role="alert">${escape(this.error)}</p>` : '';
    this.dialog.innerHTML = `<div class="mayor-wash" aria-hidden="true"></div><button class="mayor-dismiss" data-close aria-label="End conversation">${icon('x')}</button><section class="mayor-talk" aria-label="Mayor Martin"><div class="mayor-bubble"><div class="mayor-head"><span class="mayor-name">Mayor Martin</span><small class="mayor-quest">${icon('landmark')} ${quest}</small></div><p class="mayor-line" aria-live="polite">${line}</p>${detail}${error}<div class="mayor-options">${choices}</div></div></section>`;
    this.character.attachPortrait(this.dialog);
  }
}

import { CARE_ACTIONS, CARE_INTERESTS, careBenefit } from '../../shared/care.mjs';
import { INTEREST_BY_ID } from '../../shared/catalogs/index.js';
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
let panelSequence = 0;

export class CarePanel {
  constructor(root, sim) {
    this.root = root;
    this.sim = sim;
    this.revision = null;
    this.sending = false;
    this.reasonPrefix = `care-${++panelSequence}`;
    root.addEventListener('click', e => {
      const button = e.target.closest('[data-care-action]');
      if (button) this.send(button.dataset.careAction);
    });
    root.addEventListener('submit', e => {
      e.preventDefault();
      this.send('interests', [...root.querySelectorAll('input[name=care-interest]:checked')].map(el => el.value));
    });
  }
  render(connected) {
    this.connected = connected;
    const c = this.sim.character;
    if (!c?.care) {
      // Keep a mounted editor intact during temporary missing data.
      this.root.dataset.unavailable = 'true';
      for (const button of this.root.querySelectorAll('button')) button.disabled = true;
      if (!this.root.querySelector('.care-actions')) this.root.textContent = 'Character care unavailable · reconnect or update the bridge.';
      else this.root.querySelector('.care-message').textContent = 'Character care unavailable · reconnect or update the bridge.';
      return;
    }
    if (this.root.dataset?.unavailable) {
      delete this.root.dataset.unavailable;
      if (this.root.querySelector('.care-actions')) this.root.querySelector('.care-message').textContent = '';
    }
    if (!this.root.querySelector('.care-actions')) {
      this.root.innerHTML = `<h3>Suggested care</h3><details><summary>Care details</summary><p class="care-note">Free test care. Praise/snacks: +3, with +5 for a matching interest. Reading: +5 after 10 seconds. Each action has a 30-second cooldown. No decay or automatic leisure gains yet.</p></details>
        <div class="care-actions"></div><p class="care-pending"></p><button type="button" data-care-action="cancel" hidden>Cancel reading</button>
        <details data-interest-editor><summary>Edit interests</summary><form><p class="care-note">Choose 1-3 test interests. Changing them grants no happiness.</p>
        ${CARE_INTERESTS.map(i => `<label><input type="checkbox" name="care-interest" value="${i.id}" ${c.interestIds.includes(i.id) ? 'checked' : ''}> ${esc(i.label)}</label>`).join('')}<button type="submit">Save interests</button></form></details>
        <details data-care-history><summary>Happiness history</summary><ol></ol></details><p class="care-message" role="status"></p>`;
      this.orderRows(c);
    }
    if (this.orderedInterests !== c.interestIds.join(',')) this.orderRows(c);
    if (this.revision !== c.care.revision) {
      this.revision = c.care.revision;
      this.root.querySelector('[data-care-history] ol').innerHTML = [...c.care.history].reverse().map(h => `<li>${esc(h.label)} &middot; ${h.delta >= 0 ? '+' : ''}${h.delta}${h.matchedInterest ? ` &middot; ${esc(INTEREST_BY_ID[h.matchedInterest]?.label || h.matchedInterest)}` : ''}<small>${esc(new Date(h.at).toLocaleTimeString())} &middot; ${h.happiness}/100</small></li>`).join('');
    }
    const pending = c.care.pending;
    if (this.hadPending && !pending) this.root.querySelector('.care-message').textContent = c.care.history.at(-1)?.delta > 0 ? 'Reading completed. Happiness recorded.' : 'Reading ended without a reward.';
    this.hadPending = !!pending;
    for (const [id, rule] of Object.entries(CARE_ACTIONS)) {
      const button = this.root.querySelector(`[data-care-action="${id}"]`);
      const seconds = Math.max(0, Math.ceil(((c.care.cooldowns[id] || 0) - Date.now()) / 1000));
      const unavailable = id === 'read' && !c.interestIds.includes('reading');
      const busy = id === 'read' && this.sim.truth && !['idle','done'].includes(this.sim.state);
      const reason = !connected ? 'Care unavailable while disconnected' : this.sending ? 'Request underway' : pending ? 'Reading in progress' : unavailable ? 'Requires Reading interest' : busy ? 'Available when agent is idle' : seconds ? `Ready in ${seconds}s` : c.happiness === 100 ? 'Already at 100/100' : c.interestIds.includes(rule.interest) ? `Matches ${INTEREST_BY_ID[rule.interest]?.label || rule.interest}${rule.duration ? ' \u00b7 10 seconds' : ''}` : 'General encouragement';
      button.textContent = rule.label;
      button.disabled = !connected || this.sending || !!pending || !!seconds || unavailable || !!busy;
      this.root.querySelector(`[data-care-reason="${id}"]`).textContent = reason;
      this.root.querySelector(`[data-care-gain="${id}"]`).textContent = `${c.happiness + careBenefit(c, id) > 100 ? 'Up to ' : ''}+${careBenefit(c, id)} happiness`;

    }
    this.root.querySelector('.care-pending').textContent = pending ? `Reading · simulated · ${Math.max(0, Math.ceil((pending.readyAt - Date.now()) / 1000))}s remaining. Agent work interrupts this activity.` : '';
    const cancel = this.root.querySelector('[data-care-action=cancel]');
    cancel.hidden = !pending;
    cancel.disabled = !connected || this.sending;
    this.root.querySelector('button[type=submit]').disabled = !connected || this.sending || !!pending;
  }
  orderRows(c) {
    this.orderedInterests = c.interestIds.join(',');
    const available = id => !(c.care.cooldowns[id] > Date.now()) && !(id === 'read' && (!c.interestIds.includes('reading') || (this.sim.truth && !['idle','done'].includes(this.sim.state))));
    const rank = id => (available(id) ? 0 : 2) + (c.interestIds.includes(CARE_ACTIONS[id].interest) ? 0 : 1);
    const area = this.root.querySelector('.care-actions');
    for (const id of ['snack','read','praise'].sort((a,b) => rank(a)-rank(b))) {
      let row = area.querySelector(`[data-care-row="${id}"]`);
      if (!row) {
        row = document.createElement('article'); row.dataset.careRow = id; row.className = 'care-row';
        row.innerHTML = `<strong>${esc(CARE_ACTIONS[id].label)}</strong><small data-care-gain="${id}"></small><p id="${this.reasonPrefix}-${id}" data-care-reason="${id}"></p><button type="button" data-care-action="${id}" aria-describedby="${this.reasonPrefix}-${id}"></button>`;
      }
      area.append(row);
    }
  }
  async send(action, interestIds) {
    if (this.sending || !this.connected || !this.sim.character?.care) return;
    this.sending = true;
    this.render(this.connected);
    let message = '';
    try {
      const c = this.sim.character;
      const response = await fetch('/api/care', { method: 'POST', headers: { 'content-type':'application/json' },
        body: JSON.stringify({ project: this.sim.lot.project, agentId: c.id, revision: c.care.revision, id: crypto.randomUUID(), action, interestIds }) });
      const result = await response.json();
      if (!response.ok) throw Error(result.error || 'Care unavailable.');
      this.sim.receiveCare?.(result.character);
      if (result.character.care.revision >= this.sim.character.care.revision) this.sim.character = result.character;
      if (action === 'interests') this.orderRows(this.sim.character);
      message = action === 'read' ? 'Reading started.' : action === 'interests' ? 'Interests saved.' : action === 'cancel' ? 'Reading cancelled.' : 'Care recorded.';
      if (Object.hasOwn(CARE_ACTIONS, action)) this.onApplied?.(action);
    } catch (error) { message = error.message; }
    finally {
      this.sending = false;
      this.render(this.connected);
      const status = this.root.querySelector('.care-message');
      if (status) status.textContent = message;
    }
  }
}

export function careSummary(c) {
  if (!c?.care || !Number.isFinite(c.happiness)) return '<p class="care-note">Character care unavailable</p>';
  return `<div class="care-summary"><div class="care-value"><span>Happiness &middot; simulated</span><strong>${c.happiness}/100</strong><meter min="0" max="100" value="${c.happiness}" aria-label="Simulated happiness"></meter></div><p class="care-interests">Interests: ${c.interestIds.map(id => esc(INTEREST_BY_ID[id]?.label || id)).join(' &bull; ')}</p>${c.care.pending ? `<p class="care-pending">Reading &middot; simulated &middot; ${Math.max(0, Math.ceil((c.care.pending.readyAt - Date.now()) / 1000))}s remaining. Open Care to cancel.</p>` : ''}</div>`;
}

// One persistent editor per resident, shared by activity and chat entry points.
const dialogs = new Map();
let dialogSequence = 0;
export function careDialogFor(sim) {
  const key = JSON.stringify([sim.lot.project, sim.character?.id || sim.character?.slot]);
  if (!dialogs.has(key)) dialogs.set(key, new CareDialog(sim));
  const dialog = dialogs.get(key);
  dialog.sim = sim;
  dialog.panel.sim = sim;
  return dialog;
}

export class CareDialog {
  constructor(sim) {
    this.sim = sim;
    const title = `care-title-${++dialogSequence}`;
    this.dialog = document.createElement('div');
    this.dialog.className = 'care-dialog glass';
    this.dialog.setAttribute('popover', 'auto');
    this.dialog.setAttribute('role', 'dialog');
    this.dialog.setAttribute('aria-modal', 'false');
    this.dialog.setAttribute('aria-labelledby', title);
    this.dialog.innerHTML = `<header class="panel-head"><h2 id="${title}"></h2><button type="button" class="icon-btn" data-care-close autofocus aria-label="Close care">×</button></header><div class="care-dialog-scroll"><div data-care-context></div><section class="care-panel"></section></div>`;
    document.body.append(this.dialog);
    this.panel = new CarePanel(this.dialog.querySelector('.care-panel'), sim);
    this.panel.onApplied = () => this.close();
    this.dialog.querySelector('[data-care-close]').addEventListener('click', () => this.close());
    this.dialog.addEventListener('toggle', e => {
      if (e.newState !== 'closed') return;
      clearInterval(this.timer);
      this.returnFocus?.()?.setAttribute('aria-expanded', 'false');
      // Do not steal focus from an outside click. Explicit close returns to Care.
      if (!this.restoreFocus) return;
      this.restoreFocus = false;
      const target = this.returnFocus?.();
      if (target?.isConnected) target.focus({ preventScroll:true });
    });
    this.dialog.addEventListener('keydown', e => {
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); this.close(); }
    });
  }
  update(connected = this.connected) {
    this.connected = connected;
    this.dialog.querySelector('h2').textContent = `Care for ${this.sim.name}`;
    this.dialog.querySelector('[data-care-context]').innerHTML = careSummary(this.sim.character) + (!connected ? '<p class="care-note">Care unavailable while disconnected.</p>' : '');
    this.panel.render(connected);
    if (this.dialog.matches(':popover-open')) this.position();
  }
  position() {
    const trigger = this.returnFocus?.();
    if (!trigger?.isConnected || (trigger.getClientRects && !trigger.getClientRects().length)) { this.close(false); return; }
    trigger.setAttribute('aria-haspopup', 'dialog');
    trigger.setAttribute('aria-expanded', 'true');
    const anchor = trigger.closest('#inspect, .pass-card') || trigger;
    const rect = anchor.getBoundingClientRect();
    const button = trigger.getBoundingClientRect();
    const placement = careMenuPosition(rect, button, this.dialog.offsetWidth, this.dialog.offsetHeight, innerWidth, innerHeight);
    Object.assign(this.dialog.style, { left:`${placement.left}px`, top:`${placement.top}px` });
  }
  close(restoreFocus = true) {
    this.restoreFocus = restoreFocus;
    if (this.dialog.matches(':popover-open')) this.dialog.hidePopover();
  }
  open(connected, returnFocus) {
    this.returnFocus = returnFocus;
    this.restoreFocus = false;
    // A chat is itself a modal dialog. Keep the menu within that subtree so it
    // stays interactive, while the popover top layer escapes card clipping.
    const host = returnFocus?.()?.closest('dialog') || document.body;
    host.append(this.dialog);
    this.update(connected);
    if (!this.dialog.matches(':popover-open')) this.dialog.showPopover();
    this.position();
    this.dialog.querySelector('[data-care-close]').focus();
    clearInterval(this.timer);
    this.timer = setInterval(() => this.update(), 500);
  }
}

export function careMenuPosition(card, trigger, width, height, viewportWidth, viewportHeight) {
  const inset = 12;
  // Overlap the card by 40px on desktop; tuck inside it when space is tight.
  const preferred = card.left - width + 40;
  const left = Math.max(inset, Math.min(preferred >= inset ? preferred : card.right - width - 12, viewportWidth - width - inset));
  const top = Math.max(inset, Math.min(trigger.top - 16, viewportHeight - height - inset));
  return {left, top};
}

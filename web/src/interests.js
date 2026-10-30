// Resident interests (simulation): what each resident enjoys and whether the town serves it. Interests a venue
// serves become needs for the resident's home (shared/home-satisfaction.mjs); the rest shape ambient activities at
// home. Editing interests never touches observed work, XP or recruitment.
import { INTEREST_CHOICES, MAX_INTERESTS, VENUE_INTERESTS } from '../../shared/resident-interests.mjs';
import { venuesForInterest } from '../../shared/home-satisfaction.mjs';
import { PUBLIC_BUILDINGS } from '../../shared/town.mjs';
import { INTEREST_BY_ID } from '../../shared/catalogs/index.js';
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
const labelOf = id => INTEREST_BY_ID[id]?.label || id;

/** One interest's status for a resident: met by a venue in range, wanted, enjoyed at home, or not yet buildable. */
export function interestStatus(character, interest, satisfaction) {
  const need = satisfaction?.needs.find(n => n.kind === 'interest' && n.residentId === character.id && n.interest === interest);
  if (need) return { state: need.level === 'good' ? 'met' : 'wanted', text: need.hint };
  if (VENUE_INTERESTS.includes(interest)) {
    const names = venuesForInterest(interest).map(k => PUBLIC_BUILDINGS[k].name.toLowerCase());
    return { state: 'locked', text: `Needs ${names.join(' or ')} · not unlocked yet` };
  }
  return { state: 'home', text: 'Enjoyed at home' };
}

/** Compact summary for the resident panel. */
export function interestsSummary(character, satisfaction) {
  if (!character) return '';
  const ids = character.interestIds || [];
  if (!ids.length) return '<p class="interests-note">No interests yet.</p>';
  const rows = ids.map(id => {
    const s = interestStatus(character, id, satisfaction);
    return `<li data-interest-state="${s.state}"><b>${esc(labelOf(id))}</b><small>${esc(s.text)}</small></li>`;
  }).join('');
  return `<div class="interests-summary"><span>Interests &middot; town simulation</span><ul class="interests-list">${rows}</ul></div>`;
}

/** Interest editor: 1–3 choices, venue interests first. */
export class InterestsEditor {
  constructor(root, sim) {
    this.root = root;
    this.sim = sim;
    this.sending = false;
    root.addEventListener('submit', e => {
      e.preventDefault();
      this.save([...root.querySelectorAll('input[name=interest]:checked')].map(el => el.value));
    });
    root.addEventListener('change', e => {
      if (e.target.name !== 'interest') return;
      const checked = root.querySelectorAll('input[name=interest]:checked').length;
      for (const box of root.querySelectorAll('input[name=interest]:not(:checked)')) box.disabled = checked >= MAX_INTERESTS;
    });
  }
  render(connected) {
    this.connected = connected;
    const c = this.sim.character;
    if (!c) { this.root.textContent = 'Interests unavailable · reconnect or update the bridge.'; return; }
    if (!this.root.querySelector('form')) {
      const box = i => `<label><input type="checkbox" name="interest" value="${i.id}"> ${esc(i.label)}</label>`;
      this.root.innerHTML = `<form><p class="interests-note">Choose 1–${MAX_INTERESTS}. Interests a venue serves become needs for this home: build that venue nearby to meet them.</p>
        <fieldset><legend>At a venue</legend>${INTEREST_CHOICES.filter(i => i.venue).map(box).join('')}</fieldset>
        <fieldset><legend>At home</legend>${INTEREST_CHOICES.filter(i => !i.venue).map(box).join('')}</fieldset>
        <button type="submit">Save interests</button></form><p class="interests-message" role="status"></p>`;
      this.syncChecks(c);
    }
    if (this.syncedFor !== JSON.stringify(c.interestIds)) this.syncChecks(c);
    this.root.querySelector('button[type=submit]').disabled = !connected || this.sending;
  }
  syncChecks(c) {
    this.syncedFor = JSON.stringify(c.interestIds);
    const chosen = new Set(c.interestIds || []);
    for (const box of this.root.querySelectorAll('input[name=interest]')) {
      box.checked = chosen.has(box.value);
      box.disabled = !box.checked && chosen.size >= MAX_INTERESTS;
    }
  }
  async save(interestIds) {
    if (this.sending || !this.connected || !this.sim.character) return;
    this.sending = true;
    this.render(this.connected);
    let message = '';
    try {
      const c = this.sim.character;
      const response = await fetch('/api/care-preferences', { method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ project: this.sim.lot.project, agentId: c.id, action: 'interests', id: crypto.randomUUID(),
          revision: c.interestPreferences?.revision ?? 0, interestIds }) });
      const result = await response.json();
      if (!response.ok) throw Error(result.error || 'Interests unavailable.');
      this.sim.character = result.character;
      message = 'Interests saved.';
      this.onSaved?.();
    } catch (error) { message = error.message; }
    finally {
      this.sending = false;
      this.render(this.connected);
      this.root.querySelector('.interests-message').textContent = message;
    }
  }
}

// One persistent editor per resident, shared by activity and chat entry points.
const dialogs = new Map();
let dialogSequence = 0;
export function interestsDialogFor(sim) {
  const key = JSON.stringify([sim.lot.project, sim.character?.id || sim.character?.slot]);
  if (!dialogs.has(key)) dialogs.set(key, new InterestsDialog(sim));
  const dialog = dialogs.get(key);
  dialog.sim = sim;
  dialog.editor.sim = sim;
  return dialog;
}

export class InterestsDialog {
  constructor(sim) {
    this.sim = sim;
    const title = `interests-title-${++dialogSequence}`;
    this.dialog = document.createElement('div');
    this.dialog.className = 'interests-dialog glass';
    this.dialog.setAttribute('popover', 'auto');
    this.dialog.setAttribute('role', 'dialog');
    this.dialog.setAttribute('aria-modal', 'false');
    this.dialog.setAttribute('aria-labelledby', title);
    this.dialog.innerHTML = `<header class="panel-head"><h2 id="${title}"></h2><button type="button" class="icon-btn" data-interests-close autofocus aria-label="Close interests">×</button></header><div class="interests-dialog-scroll"><div data-interests-context></div><section class="interests-editor"></section></div>`;
    document.body.append(this.dialog);
    this.editor = new InterestsEditor(this.dialog.querySelector('.interests-editor'), sim);
    this.editor.onSaved = () => this.update();
    this.dialog.querySelector('[data-interests-close]').addEventListener('click', () => this.close());
    this.dialog.addEventListener('toggle', e => {
      if (e.newState !== 'closed') return;
      this.returnFocus?.()?.setAttribute('aria-expanded', 'false');
      if (!this.restoreFocus) return;
      this.restoreFocus = false;
      const target = this.returnFocus?.();
      if (target?.isConnected) target.focus({ preventScroll: true });
    });
    this.dialog.addEventListener('keydown', e => {
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); this.close(); }
    });
  }
  update(connected = this.connected) {
    this.connected = connected;
    this.dialog.querySelector('h2').textContent = `Interests for ${this.sim.name}`;
    this.dialog.querySelector('[data-interests-context]').innerHTML = interestsSummary(this.sim.character, this.sim.lot?.satisfaction)
      + (!connected ? '<p class="interests-note">Editing unavailable while disconnected.</p>' : '');
    this.editor.render(connected);
    if (this.dialog.matches(':popover-open')) this.position();
  }
  position() {
    const trigger = this.returnFocus?.();
    if (!trigger?.isConnected || (trigger.getClientRects && !trigger.getClientRects().length)) { this.close(false); return; }
    trigger.setAttribute('aria-haspopup', 'dialog');
    trigger.setAttribute('aria-expanded', 'true');
    const anchor = trigger.closest('#inspect, .pass-card') || trigger;
    const placement = menuPosition(anchor.getBoundingClientRect(), trigger.getBoundingClientRect(), this.dialog.offsetWidth, this.dialog.offsetHeight, innerWidth, innerHeight);
    Object.assign(this.dialog.style, { left: `${placement.left}px`, top: `${placement.top}px` });
  }
  close(restoreFocus = true) {
    this.restoreFocus = restoreFocus;
    if (this.dialog.matches(':popover-open')) this.dialog.hidePopover();
  }
  open(connected, returnFocus) {
    this.returnFocus = returnFocus;
    this.restoreFocus = false;
    // A chat is itself a modal dialog: keep the menu within that subtree so it stays interactive.
    const host = returnFocus?.()?.closest('dialog') || document.body;
    host.append(this.dialog);
    this.update(connected);
    if (!this.dialog.matches(':popover-open')) this.dialog.showPopover();
    this.position();
    this.dialog.querySelector('[data-interests-close]').focus();
  }
}

export function menuPosition(card, trigger, width, height, viewportWidth, viewportHeight) {
  const inset = 12;
  // Overlap the card by 40px on desktop; tuck inside it when space is tight.
  const preferred = card.left - width + 40;
  const left = Math.max(inset, Math.min(preferred >= inset ? preferred : card.right - width - 12, viewportWidth - width - inset));
  const top = Math.max(inset, Math.min(trigger.top - 16, viewportHeight - height - inset));
  return { left, top };
}

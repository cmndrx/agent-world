// Floor picker: while a multi-floor home is open (zoomed in), choose which floor to inspect. Lists floors top to
// bottom with how many residents live there and a dot when one of them needs you or hit an error. Simulation
// layer only: switching floors changes the view, never the residents or their work.

import { icon } from './icons.js';

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

export class FloorPicker {
  constructor({ onPick }) {
    this.onPick = onPick;
    this.el = document.createElement('nav');
    this.el.className = 'floor-picker glass';
    this.el.setAttribute('aria-label', 'Floors');
    this.el.hidden = true;
    this.key = '';
    this.lot = null;
    document.body.append(this.el);
    this.el.addEventListener('click', (e) => {
      const b = e.target.closest('[data-floor]');
      if (b && this.lot) this.onPick(this.lot, Number(b.dataset.floor));
    });
    addEventListener('keydown', (e) => {
      if (!this.lot || this.el.hidden || e.target.closest?.('input, textarea, select, dialog, [contenteditable]')) return;
      if (e.key !== 'PageUp' && e.key !== 'PageDown') return;
      e.preventDefault();
      this.onPick(this.lot, this.lot.viewFloor + (e.key === 'PageUp' ? 1 : -1));
    });
  }

  /** @param {import('./lot.js').Lot|null} lot the open multi-floor home, if any @param {Iterable} sims */
  update(lot, sims) {
    const show = !!lot && lot.floorCount > 1;
    this.lot = show ? lot : null;
    if (!show) {
      if (!this.el.hidden) this.el.hidden = true;
      return;
    }
    const counts = new Map();
    const alerts = new Set();
    for (const s of sims) {
      if (s.lot !== lot || s.isVisitor || s.gone) continue;
      counts.set(s.floor, (counts.get(s.floor) || 0) + 1);
      if (s.state === 'waiting_for_user' || s.state === 'error') alerts.add(s.floor);
    }
    const floors = lot.building.floors;
    const key = `${lot.project}|${lot.viewFloor}|${floors.length}|${[...counts]}|${[...alerts]}`;
    this.el.hidden = false;
    if (key === this.key) return;
    this.key = key;
    const label = (f) => (f.index === 0 ? 'G' : String(f.index));
    this.el.innerHTML = `<div class="fp-head">${icon('layers')}<span>${esc(lot.name)}</span></div>
      <div class="fp-list">${[...floors].reverse().map((f) => {
        const n = counts.get(f.index) || 0;
        const on = f.index === lot.viewFloor;
        return `<button class="fp-floor${on ? ' on' : ''}" data-floor="${f.index}" aria-pressed="${on}" title="${esc(f.name)} · ${n} resident${n === 1 ? '' : 's'}">
          <b>${label(f)}</b><span class="fp-name">${esc(f.name)}</span><span class="fp-count">${n ? `${icon('users')}${n}` : ''}</span>${alerts.has(f.index) ? '<i class="fp-alert" aria-label="Someone here needs you"></i>' : ''}</button>`;
      }).join('')}</div>
      <small class="fp-hint">PgUp / PgDn</small>`;
  }
}

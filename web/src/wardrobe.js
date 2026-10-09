// Wardrobe: restyle a resident (or your own picture) with live preview. Cosmetic only.
// Saves through POST /api/style as { kind: 'resident', key: '<project>#<slot>' } or { kind: 'player' }.

import { WARDROBE } from '../../shared/style.mjs';
import { icon } from './icons.js';
import { escapeHtml } from './sim.js';

const hex = (n) => `#${(n >>> 0).toString(16).padStart(6, '0')}`;

export class Wardrobe {
  /** @param {{ save: (change: object) => Promise<void>, onClose?: () => void }} o */
  constructor({ save, onClose }) {
    this.save = save;
    this.onClose = onClose;
    this.target = null; // { name, model (Sim or Player), change: { kind, key }, saved, preview? }
    this.panel = document.createElement('section');
    this.panel.id = 'wardrobe';
    this.panel.className = 'glass panel';
    this.panel.hidden = true;
    document.body.append(this.panel);
    this.panel.addEventListener('click', (e) => this.onClick(e));
    addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !this.panel.hidden) {
        e.stopImmediatePropagation();
        this.cancel();
      }
    }, true);
  }

  /**
   * @param {object} t
   * @param {string} t.name who we're dressing
   * @param {{look: object, baseLook: object, setLook: (o: object) => void}} t.model
   * @param {{kind: string, key?: string}} t.change
   * @param {object|null} t.saved current saved overrides
   */
  open(t) {
    this.target = t;
    this.draft = { ...(t.saved || {}) };
    this.panel.hidden = false;
    document.body.classList.add('dressing');
    this.render();
  }

  close() {
    this.panel.hidden = true;
    this.target = null;
    document.body.classList.remove('dressing');
    this.onClose?.();
  }

  cancel() {
    if (!this.target) return;
    this.target.model.setLook(this.target.saved || {});
    this.close();
  }

  current(field) {
    const v = this.draft[field] ?? this.target.model.baseLook[field];
    return typeof v === 'number' && field !== 'hairStyle' ? hex(v) : v;
  }

  render() {
    const t = this.target;
    const colors = (field, label) => `<div class="ward-group"><h4>${label}</h4><div class="swatches">${WARDROBE[field]
      .map((c) => `<button class="swatch-btn${this.current(field) === c ? ' on' : ''}" data-field="${field}" data-value="${c}" style="--c:${c}" aria-label="${label} ${c}"></button>`)
      .join('')}</div></div>`;
    const chips = (field, label, options) => `<div class="ward-group"><h4>${label}</h4><div class="chips">${options
      .map(([v, name]) => `<button class="chip-btn${String(this.current(field) ?? 'none') === String(v) ? ' on' : ''}" data-field="${field}" data-value="${v}">${escapeHtml(name)}</button>`)
      .join('')}</div></div>`;
    this.panel.innerHTML = `<header><div><small>WARDROBE · JUST FOR FUN</small><h2>${icon('shirt')} ${escapeHtml(t.name)}</h2></div>
        <button class="icon-btn" data-cancel aria-label="Close without saving">${icon('x')}</button></header>
      <div class="ward-body">
        ${t.preview ? t.preview() : ''}
        ${colors('skin', 'Skin tone')}
        ${chips('hairStyle', 'Hair', WARDROBE.hairStyle.map((n, i) => [i, n]))}
        ${colors('hair', 'Hair color')}
        ${chips('top', 'Top', Object.entries(WARDROBE.top))}
        ${colors('shirt', 'Top color')}
        ${colors('pants', 'Pants')}
        ${colors('shoes', 'Shoes')}
        ${chips('accessory', 'Accessory', Object.entries(WARDROBE.accessory))}
      </div>
      <footer><button data-save class="primary">${icon('check')} Save outfit</button><button data-reset>Reset to original</button><button data-cancel>Cancel</button></footer>
      <p class="build-msg" role="status"></p>`;
    if (t.mountPreview) t.mountPreview(this.panel.querySelector('[data-preview]'));
  }

  async onClick(e) {
    const b = e.target.closest('button');
    if (!b || !this.target) return;
    if (b.dataset.field) {
      const field = b.dataset.field;
      this.draft[field] = field === 'hairStyle' ? Number(b.dataset.value) : b.dataset.value;
      this.target.model.setLook(this.draft); // live preview
      this.render();
      return;
    }
    if (b.hasAttribute('data-cancel')) return this.cancel();
    if (b.hasAttribute('data-reset')) {
      this.draft = {};
      this.target.model.setLook({});
      this.render();
      return;
    }
    if (b.hasAttribute('data-save')) {
      try {
        const value = Object.keys(this.draft).length ? this.draft : null;
        await this.save({ ...this.target.change, value });
        this.target.saved = value;
        this.close();
      } catch (err) {
        const el = this.panel.querySelector('.build-msg');
        if (el) el.textContent = err.message;
      }
    }
  }
}

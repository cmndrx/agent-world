// Map mode (phase 3): a top-down view of the neighborhood. Click a house, then another plot, to move it
// (houses on both plots swap). Rename streets inline. Cosmetic only; saved to style.layout / style.streets.

import * as THREE from 'three';
import { levelName } from '../../shared/progression.mjs';
import { icon } from './icons.js';
import { LOT_D, LOT_W } from './lot.js';
import { DEFAULT_STREETS } from './scenery.js';
import { escapeHtml } from './sim.js';

export class MapMode {
  /**
   * @param {object} o
   * @param {() => Map<string, import('./lot.js').Lot>} o.lots
   * @param {() => string[]} o.plots current plot order (project or null per plot)
   * @param {() => object} o.style
   * @param {(change: object) => Promise<void>} o.save
   * @param {THREE.Camera} o.camera
   * @param {(active: boolean, center: THREE.Vector3|null, distance: number) => void} o.onToggle
   */
  constructor(o) {
    Object.assign(this, o);
    this.active = false;
    this.picked = null;
    this.editingRow = null;
    this.layer = document.createElement('div');
    this.layer.id = 'mapmode';
    this.layer.hidden = true;
    document.body.append(this.layer);
    this.layer.addEventListener('click', (e) => this.onClick(e));
    this.layer.addEventListener('keydown', (e) => {
      if (e.target.name === 'street' && e.key === 'Enter') this.saveStreet(e.target);
      if (e.target.name === 'street' && e.key === 'Escape') {
        e.stopPropagation();
        this.editingRow = null;
        this.render();
      }
    });
    addEventListener('keydown', (e) => {
      if (e.target.closest?.('input, textarea, select, dialog')) return;
      if ((e.key === 'm' || e.key === 'M') && !document.body.classList.contains('photo')) this.active ? this.exit() : this.enter();
      if (e.key === 'Escape' && this.active) {
        e.stopImmediatePropagation();
        if (this.picked) {
          this.picked = null;
          this.render();
        } else this.exit();
      }
    }, true);
  }

  plotCount() {
    const n = Math.max(this.plots().length, this.lots().size);
    return (Math.ceil(n / 3) + 1) * 3; // always offer one empty row to expand into
  }

  enter() {
    this.active = true;
    this.picked = null;
    this.layer.hidden = false;
    document.body.classList.add('mapping');
    this.frame();
    this.render();
  }

  /** Fit the street labels plus three plots across, and every row down, in the current viewport. */
  frame() {
    const rows = this.plotCount() / 3;
    this.framedRows = rows;
    const center = new THREE.Vector3(LOT_W * 0.75, 0.12, ((rows - 1) * LOT_D) / 2);
    const t = Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2));
    const fit = Math.max((LOT_W * 4.1) / (2 * t * this.camera.aspect), (rows * LOT_D + 16) / (2 * t));
    this.onToggle(true, center, Math.min(420, fit * 1.05));
  }

  exit() {
    this.active = false;
    this.layer.hidden = true;
    document.body.classList.remove('mapping');
    this.onToggle(false, null, 0);
  }

  render() {
    const plots = this.plots();
    const lots = this.lots();
    const streets = this.style().streets || {};
    let html = `<div class="map-head glass"><b>${icon('map')} Neighborhood map</b>
      <span>${this.picked ? `Moving <b>${escapeHtml(lots.get(this.picked)?.name || '')}</b>: click a plot to move it there` : 'Click a house, then a plot, to move it. Click a street name to rename it.'}</span>
      <button data-done>${icon('check')} Done</button></div>`;
    for (let i = 0; i < this.plotCount(); i++) {
      const project = plots[i] || null;
      const lot = project && lots.get(project);
      html += lot
        ? `<button class="plot-card${this.picked === project ? ' picked' : ''}" data-plot="${i}" data-project="${escapeHtml(project)}">
            <b>${escapeHtml(lot.name)}</b><small>${'★'.repeat(lot.level)} ${escapeHtml(levelName(lot.level))}</small></button>`
        : `<button class="plot-card empty${this.picked ? ' target' : ''}" data-plot="${i}">Empty plot</button>`;
    }
    for (let row = 0; row < this.plotCount() / 3; row++) {
      const name = streets[row] || DEFAULT_STREETS[row % DEFAULT_STREETS.length];
      html += this.editingRow === row
        ? `<span class="street-edit" data-row-pos="${row}"><input name="street" data-row="${row}" maxlength="40" value="${escapeHtml(name)}" aria-label="Street name" /></span>`
        : `<button class="street-card" data-row="${row}" data-row-pos="${row}" title="Rename street">${icon('pencil')} ${escapeHtml(name)}</button>`;
    }
    this.layer.innerHTML = html;
    const input = this.layer.querySelector('input[name=street]');
    if (input) {
      input.focus();
      input.select();
    }
    this.place();
  }

  /** Position cards over plot centers and street labels at the start of each street. */
  place() {
    if (!this.active) return;
    const v = new THREE.Vector3();
    const w = innerWidth;
    const h = innerHeight;
    const toScreen = (x, z) => {
      v.set(x, 0.5, z).project(this.camera);
      return [(v.x * 0.5 + 0.5) * w, (-v.y * 0.5 + 0.5) * h];
    };
    for (const el of this.layer.querySelectorAll('[data-plot]')) {
      const i = Number(el.dataset.plot);
      const [sx, sy] = toScreen((i % 3) * LOT_W, Math.floor(i / 3) * LOT_D);
      el.style.left = `${sx}px`;
      el.style.top = `${sy}px`;
    }
    for (const el of this.layer.querySelectorAll('[data-row-pos]')) {
      const row = Number(el.dataset.rowPos);
      const [sx, sy] = toScreen(-LOT_W / 2 - 2, row * LOT_D + LOT_D / 2);
      el.style.left = `${sx}px`;
      el.style.top = `${sy}px`;
    }
  }

  async onClick(e) {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.hasAttribute('data-done')) return this.exit();
    if (b.classList.contains('street-card')) {
      this.editingRow = Number(b.dataset.row);
      return this.render();
    }
    if (b.dataset.plot == null) return;
    const i = Number(b.dataset.plot);
    if (!this.picked) {
      if (b.dataset.project) this.picked = b.dataset.project;
      return this.render();
    }
    const plots = [...this.plots()];
    while (plots.length < this.plotCount()) plots.push(null);
    const from = plots.indexOf(this.picked);
    [plots[from], plots[i]] = [plots[i] ?? null, this.picked];
    this.picked = null;
    try {
      await this.save({ kind: 'layout', value: plots });
    } catch (err) {
      console.warn(err);
    }
    if (this.active && this.plotCount() / 3 !== this.framedRows) this.frame();
    this.render();
  }

  async saveStreet(input) {
    const row = input.dataset.row;
    this.editingRow = null;
    try {
      await this.save({ kind: 'street', key: row, value: input.value });
    } catch (err) {
      console.warn(err);
    }
    this.render();
  }
}

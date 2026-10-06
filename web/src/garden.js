// Gardens (play layer): crops growing in garden beds, and the little prompt you use to plant or harvest
// when your avatar walks up. Growth follows real time (shared/garden.mjs); nothing wilts and nothing
// here is related to agent activity.

import * as THREE from 'three';
import { CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { CROPS, STAGES, cropLockReason, formatRemaining, growth } from '../../shared/garden.mjs';
import { icon } from './icons.js';
import { PALETTE, cyl, ico, mat } from './models.js';
import { escapeHtml as esc } from './sim.js';

const NEAR = 3.2;
const SPOTS = { tomato: [[-0.36, -0.2], [0.36, -0.2], [-0.36, 0.2], [0.36, 0.2]], sunflower: [[-0.4, 0], [0, 0], [0.4, 0]], pumpkin: [[-0.3, -0.05], [0.32, 0.08]] };

function sprout(g, x, z, s) {
  g.add(cyl(0.012, 0.012, 0.12 * s, PALETTE.leafDark, 4, x, 0.2 + 0.06 * s, z));
  for (const side of [-1, 1]) {
    const leaf = ico(0.045 * s, PALETTE.leafLight, x + side * 0.04 * s, 0.2 + 0.12 * s, z);
    leaf.scale.set(1.3, 0.4, 0.8);
    g.add(leaf);
  }
}

function pumpkinMesh(r, color) {
  const p = ico(r, color, 0, 0, 0, 1);
  p.scale.y = 0.72;
  return p;
}

/** Crop model for a stage (0 planted … 3 ripe), sized for a 1.4 × 1.0 bed; soil top is at y ≈ 0.2. */
export function buildCrop(crop, stage) {
  const g = new THREE.Group();
  const spots = SPOTS[crop];
  if (stage === 0) {
    for (const [x, z] of spots) {
      const mound = ico(0.07, 0x4a3222, x, 0.2, z);
      mound.scale.y = 0.45;
      g.add(mound);
    }
    return g;
  }
  if (stage === 1) {
    for (const [x, z] of spots) sprout(g, x, z, 1);
    return g;
  }
  const ripe = stage === 3;
  for (const [x, z] of spots) {
    if (crop === 'tomato') {
      for (let k = 0; k < 3; k++) {
        const bush = ico(ripe ? 0.17 : 0.13, k % 2 ? PALETTE.leaf : PALETTE.leafDark, x + (k - 1) * 0.06, 0.32 + k * 0.07, z + (k % 2 ? 0.04 : -0.04));
        g.add(bush);
      }
      g.add(cyl(0.01, 0.01, ripe ? 0.62 : 0.45, PALETTE.woodLight, 4, x + 0.1, 0.42, z - 0.08)); // cane
      if (ripe) for (let k = 0; k < 4; k++) g.add(ico(0.05, CROPS.tomato.color, x + Math.cos(k * 1.7) * 0.13, 0.33 + (k % 2) * 0.12, z + Math.sin(k * 1.7) * 0.11));
    } else if (crop === 'sunflower') {
      const h = ripe ? 1.15 : 0.62;
      g.add(cyl(0.022, 0.03, h, PALETTE.leafDark, 5, x, 0.2 + h / 2, z));
      for (const side of [-1, 1]) {
        const leaf = ico(0.08, PALETTE.leaf, x + side * 0.08, 0.2 + h * 0.45, z);
        leaf.scale.set(1.5, 0.35, 0.8);
        g.add(leaf);
      }
      const head = new THREE.Group();
      head.position.set(x, 0.2 + h, z + 0.03);
      head.rotation.x = Math.PI / 2 - 0.35; // faces the street, tipped up a little
      if (ripe) {
        head.add(cyl(0.16, 0.16, 0.03, CROPS.sunflower.color, 12, 0, 0, 0));
        head.add(cyl(0.085, 0.085, 0.05, 0x6b4423, 10, 0, 0.012, 0));
      } else head.add(ico(0.07, PALETTE.leafLight, 0, 0, 0));
      g.add(head);
    } else {
      for (let k = 0; k < 4; k++) {
        const leaf = ico(0.14, k % 2 ? PALETTE.leaf : PALETTE.leafDark, x + Math.cos(k * 1.6) * 0.2, 0.24, z + Math.sin(k * 1.6) * 0.16);
        leaf.scale.y = 0.35;
        g.add(leaf);
      }
      const p = pumpkinMesh(ripe ? 0.2 : 0.09, ripe ? CROPS.pumpkin.color : 0x8fbf5a);
      p.position.set(x + 0.05, 0.2 + (ripe ? 0.13 : 0.06), z + 0.08);
      g.add(p);
      if (ripe) g.add(cyl(0.015, 0.02, 0.07, 0x6b4423, 5, x + 0.05, 0.47, z + 0.08));
    }
  }
  return g;
}

export class Garden {
  /**
   * @param {object} o
   * @param {() => Map<string, import('./lot.js').Lot>} o.lots
   * @param {(change: object) => Promise<void>} o.save
   * @param {(crop: string, firstTime: boolean, count: number, at: THREE.Vector3) => void} o.onHarvest
   * @param {(crop: string) => void} o.onPlant
   * @param {(message: string) => void} o.onError
   */
  constructor(o) {
    Object.assign(this, o);
    this.style = null;
    this.beds = new Map(); // `${project}|${bedId}` -> { project, bed, object, crops, key, chip, label }
    this.open = null; // bed key with the crop picker open
    this.lastTick = -1;
    this.enabled = true;
  }

  setStyle(style) {
    this.style = style;
    this.sync();
  }

  /** Match beds to the lots' current decor; rebuild crops whose stage changed. */
  sync(now = Date.now()) {
    if (!this.style) return;
    const seen = new Set();
    for (const lot of this.lots().values()) {
      for (const it of lot.decor.items) {
        if (it.item !== 'garden_bed') continue;
        const key = `${lot.project}|${it.id}`;
        seen.add(key);
        let b = this.beds.get(key);
        if (!b || b.object !== it.object) {
          if (b) this.drop(b);
          b = { project: lot.project, bed: it.id, object: it.object, crops: null, key: '', chipKey: '' };
          const el = document.createElement('div');
          el.className = 'garden-chip';
          el.dataset.bed = key;
          el.addEventListener('click', (e) => this.onClick(e, b));
          b.chip = el;
          b.label = new CSS2DObject(el);
          b.label.position.set(0, 1.45, 0);
          it.object.add(b.label);
          this.beds.set(key, b);
        }
        const plot = this.style.gardens?.[lot.project]?.[it.id];
        const g = growth(plot, now);
        b.plot = plot;
        b.growth = g;
        const cropKey = plot ? `${plot.crop}|${g.stage}` : '';
        if (cropKey !== b.key) {
          b.key = cropKey;
          if (b.crops) {
            b.object.remove(b.crops);
            b.crops.traverse((m) => m.isMesh && m.geometry.dispose());
          }
          b.crops = plot ? buildCrop(plot.crop, g.stage) : null;
          if (b.crops) b.object.add(b.crops);
        }
        this.renderChip(b);
      }
    }
    for (const [key, b] of this.beds) {
      if (!seen.has(key)) {
        this.drop(b);
        this.beds.delete(key);
      }
    }
  }

  drop(b) {
    b.label.parent?.remove(b.label);
    b.label.element.remove();
    if (b.crops) b.object.remove(b.crops);
  }

  renderChip(b) {
    const { plot, growth: g } = b;
    const found = this.style.found || {};
    let html;
    let state;
    if (!plot) {
      state = 'empty';
      html = this.open === b.chip.dataset.bed
        ? `<b>${icon('sprout')} What should we plant?</b><div class="garden-crops">${Object.entries(CROPS).map(([id, c]) => {
            const locked = cropLockReason(id, found) === 'found';
            return `<button data-plant="${id}" ${locked ? 'disabled title="Find a seed packet while exploring to plant pumpkins"' : ''}>${esc(c.label)}<small>${locked ? 'Needs a seed packet' : `about ${c.growHours >= 24 ? `${c.growHours / 24} days` : `${c.growHours}h`}`}</small></button>`;
          }).join('')}</div><button class="link-btn" data-cancel>Not now</button>`
        : `<button data-pick>${icon('shovel')} Plant something</button>`;
    } else if (g.ripe) {
      state = 'ripe';
      html = `<button data-harvest>${icon('sparkles')} Harvest ${esc(CROPS[plot.crop].label.toLowerCase())}</button>`;
    } else {
      state = 'growing';
      html = `<span>${icon('sprout')} <b>${esc(CROPS[plot.crop].label)}</b> · ${esc(STAGES[g.stage])}<small>Ready in about ${esc(formatRemaining(g.remainingMs))}. Nothing wilts, so take your time.</small></span>`;
    }
    if (html === b.chipKey) return;
    b.chipKey = html;
    b.state = state;
    b.chip.innerHTML = html;
    b.chip.classList.toggle('ripe', state === 'ripe');
    b.chip.classList.toggle('picking', this.open === b.chip.dataset.bed && state === 'empty');
  }

  async onClick(e, b) {
    const btn = e.target.closest('button');
    if (!btn) return;
    e.stopPropagation();
    if (btn.hasAttribute('data-pick')) this.open = b.chip.dataset.bed;
    if (btn.hasAttribute('data-cancel')) this.open = null;
    if (btn.dataset.plant) {
      this.open = null;
      try {
        await this.save({ kind: 'plant', key: b.project, value: { bed: b.bed, crop: btn.dataset.plant } });
        this.onPlant(btn.dataset.plant);
      } catch (err) {
        this.onError(err.message);
      }
    }
    if (btn.hasAttribute('data-harvest')) {
      const crop = b.plot.crop;
      const before = this.style.harvest?.[crop] || 0;
      const at = b.object.getWorldPosition(new THREE.Vector3());
      try {
        await this.save({ kind: 'harvest', key: b.project, value: { bed: b.bed } });
        this.onHarvest(crop, before === 0, before + 1, at);
      } catch (err) {
        this.onError(err.message);
      }
    }
    b.chipKey = '';
    this.renderChip(b);
  }

  update(dt, t, avatarPos) {
    if (!this.style) return;
    if (t - this.lastTick > 15 || this.lastTick < 0) {
      this.lastTick = t;
      this.sync();
    }
    const v = new THREE.Vector3();
    for (const b of this.beds.values()) {
      b.object.getWorldPosition(v);
      const d = Math.hypot(v.x - avatarPos.x, v.z - avatarPos.z);
      const near = d < NEAR;
      if (!near && this.open === b.chip.dataset.bed) {
        this.open = null;
        b.chipKey = '';
        this.renderChip(b);
      }
      // Up close you can act; from across the yard, only a ripe bed shows a small "ready" badge.
      const visible = this.enabled && (near || (b.state === 'ripe' && d < 16));
      b.label.visible = visible;
      b.chip.classList.toggle('far', !near);
    }
  }
}

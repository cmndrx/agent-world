// Build mode: decorate homes (place / move / rotate / delete decor) and repaint them.
// Purely cosmetic (simulation layer): it never changes what is shown as true about agents.
// Saves through POST /api/style; the bridge validates against shared/style.mjs. See docs/GAMEPLAY.md.

import * as THREE from 'three';
import { ARCHES, DECOR, EXTERIOR_COLORS, FLOORS, INTERIOR_COLORS, MAX_DECOR, PETS } from '../../shared/style.mjs';
import { buildDecor } from './decor.js';
import { itemLevel, itemPrice, levelName, lockReason } from '../../shared/progression.mjs';
import { CROPS } from '../../shared/garden.mjs';
import { COLLECTIBLES } from '../../shared/collectibles.mjs';
import { icon } from './icons.js';
import { escapeHtml } from './sim.js';

const CATEGORIES = ['Plants', 'Lighting', 'Rugs', 'Seating', 'Furniture', 'Fun', 'Garden', 'Found', 'Harvest'];
const SNAP = 0.25;

/** Render a small thumbnail for every catalog item once, with a throwaway renderer. */
function renderThumbnails() {
  const size = 112;
  const r = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  r.setSize(size, size);
  r.toneMapping = THREE.ACESFilmicToneMapping;
  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight(0xffffff, 0xb0a090, 2.2));
  const sun = new THREE.DirectionalLight(0xffffff, 2.2);
  sun.position.set(2, 4, 3);
  scene.add(sun);
  const cam = new THREE.PerspectiveCamera(30, 1, 0.1, 50);
  const out = {};
  for (const item of Object.keys(DECOR)) {
    const { group } = buildDecor(item, 7);
    scene.add(group);
    const bounds = new THREE.Box3().setFromObject(group);
    const center = bounds.getCenter(new THREE.Vector3());
    const radius = bounds.getSize(new THREE.Vector3()).length() / 2;
    cam.position.copy(center).add(new THREE.Vector3(1, 0.75, 1.2).normalize().multiplyScalar(radius * 3.2));
    cam.lookAt(center);
    r.render(scene, cam);
    out[item] = r.domElement.toDataURL();
    scene.remove(group);
  }
  r.dispose();
  r.forceContextLoss?.();
  return out;
}

export class BuildMode {
  /**
   * @param {object} o
   * @param {() => Map<string, import('./lot.js').Lot>} o.lots
   * @param {() => object} o.style current style document
   * @param {(change: object) => Promise<void>} o.save POST a style change
   * @param {THREE.Scene} o.scene
   * @param {THREE.Camera} o.camera
   * @param {HTMLElement} o.dom canvas element
   * @param {(active: boolean, lot: object|null) => void} o.onToggle
   */
  constructor(o) {
    Object.assign(this, o);
    this.active = false;
    this.lot = null;
    this.tab = 'decor';
    this.category = 'Plants';
    this.holding = null; // { item, rot, moving?: id }
    this.selected = null; // decor id
    this.ghost = null;
    this.ghostOk = false;
    this.ghostReason = '';
    this.pointer = new THREE.Vector2(9, 9);
    this.raycaster = new THREE.Raycaster();
    this.plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.12);
    this.thumbs = null;

    this.panel = document.createElement('section');
    this.panel.id = 'build';
    this.panel.className = 'glass panel';
    this.panel.hidden = true;
    document.body.append(this.panel);
    this.panel.addEventListener('click', (e) => this.onPanelClick(e));
    this.panel.addEventListener('change', (e) => {
      if (e.target.name === 'home') this.chooseLot(e.target.value);
    });

    // Footprint marker under the ghost.
    this.marker = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ color: 0x4ade80, transparent: true, opacity: 0.35, depthWrite: false }));
    this.marker.rotation.x = -Math.PI / 2;
    this.marker.visible = false;
    this.marker.renderOrder = 3;

    this.dom.addEventListener('pointermove', (e) => {
      const rect = this.dom.getBoundingClientRect();
      this.pointer.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
      this.pointerMoved = true;
    });
    this.dom.addEventListener('contextmenu', (e) => {
      if (this.active && this.holding) {
        e.preventDefault();
        this.drop();
      }
    });
    addEventListener('keydown', (e) => {
      if (e.target.closest?.('input, textarea, select, dialog')) return;
      if ((e.key === 'b' || e.key === 'B') && !document.body.classList.contains('photo')) this.active ? this.exit() : this.enter();
      if (!this.active) return;
      if (e.key === 'Escape') {
        e.stopImmediatePropagation();
        if (this.holding) this.drop();
        else if (this.selected) this.select(null);
        else this.exit();
      }
      if (e.key === 'r' || e.key === 'R') this.rotate();
      if ((e.key === 'Delete' || e.key === 'Backspace') && this.selected) this.remove(this.selected);
    }, true);
  }

  // ---- Enter / exit ------------------------------------------------------------------------

  enter(lot) {
    const lots = this.lots();
    if (!lots.size) return;
    this.active = true;
    this.thumbs ??= renderThumbnails();
    this.panel.hidden = false;
    document.body.classList.add('building');
    this.chooseLot(lot?.project || this.nearestLot()?.project || [...lots.keys()][0]);
  }

  exit() {
    this.drop();
    this.select(null);
    this.active = false;
    this.panel.hidden = true;
    document.body.classList.remove('building');
    this.onToggle(false, null);
  }

  chooseLot(project) {
    this.drop();
    this.select(null);
    this.lot = this.lots().get(project) || null;
    this.onToggle(true, this.lot);
    this.render();
  }

  nearestLot() {
    return this.pickNearest?.() || null;
  }

  homeStyle() {
    const h = this.style().homes?.[this.lot.project];
    return { exterior: h?.exterior, interior: h?.interior, floor: h?.floor, pet: h?.pet, arch: h?.arch, decor: [...(h?.decor || [])] };
  }

  async commit(home, message) {
    const value = Object.fromEntries(Object.entries(home).filter(([, v]) => v != null));
    this.lot.applyStyle(value); // optimistic; the bridge broadcast confirms
    try {
      await this.save({ kind: 'home', key: this.lot.project, value });
      this.message(message || '');
    } catch (err) {
      this.message(err.message);
    }
  }

  // ---- Panel ---------------------------------------------------------------------------------

  render() {
    if (!this.lot) return;
    const lots = [...this.lots().values()];
    const home = this.homeStyle();
    const swatch = (field, color, current) =>
      `<button class="swatch-btn${current === color ? ' on' : ''}" data-paint="${field}" data-value="${color}" style="--c:${color}" aria-label="${field} ${color}"></button>`;
    const tabs = `<nav class="build-tabs">
      <button data-tab="decor" class="${this.tab === 'decor' ? 'on' : ''}">${icon('armchair')} Decor</button>
      <button data-tab="paint" class="${this.tab === 'paint' ? 'on' : ''}">${icon('paintRoller')} Paint</button><button data-tab="pets" class="${this.tab === 'pets' ? 'on' : ''}">Pets</button></nav>`;
    let body = '';
    if (this.tab === 'decor') {
      const items = Object.entries(DECOR).filter(([, d]) => d.cat === this.category);
      body = `<div class="build-cats">${CATEGORIES.map((c) => `<button data-cat="${c}" class="${c === this.category ? 'on' : ''}">${c}</button>`).join('')}</div>
        <div class="build-items">${items.map(([id, d]) => {
          const reason = lockReason(id, { unlocks: this.style().unlocks || [], level: this.lot.level, found: this.style().found || {}, harvest: this.style().harvest || {} });
          const tag = reason === 'grown' ? `${icon('lock')} Grow one` : reason === 'found' ? `${icon('lock')} Find one` : reason === 'locked' ? `${icon('lock')} ${itemPrice(id)}` : reason === 'level' ? `${icon('lock')} ${escapeHtml(levelName(itemLevel(id)))}` : itemPrice(id) ? 'Owned' : 'Free';
          return `<button class="build-item${this.holding?.item === id ? ' on' : ''}${reason ? ' locked' : ''}" data-item="${id}" title="${escapeHtml(d.label)}">
          <img src="${this.thumbs[id]}" alt="" /><span>${escapeHtml(d.label)}</span><small class="tag tag-${reason || 'ok'}">${tag}</small></button>`;
        }).join('')}</div>${this.unlockPrompt()}`;
    } else if (this.tab === 'pets') {
      body = `<p class="paint-note">Just for fun — pets aren't agents.</p>        <div class="paint-group"><h4>Pet</h4><div class="chips">${[['', 'None'], ...Object.entries(PETS)].map(([k, l]) => `<button class="chip-btn${(home.pet || '') === k ? ' on' : ''}" data-pet="${k}">${k ? icon(k === 'bunny' ? 'rabbit' : k) : ''} ${escapeHtml(l)}</button>`).join('')}</div></div>`;
    } else {
      const ext = home.exterior || `#${this.lot.baseExterior.toString(16).padStart(6, '0')}`;
      const int = home.interior || `#${this.lot.baseInterior.toString(16).padStart(6, '0')}`;
      body = `<div class="paint-group"><h4>Outside walls</h4><div class="swatches">${EXTERIOR_COLORS.map((c) => swatch('exterior', c, ext)).join('')}</div></div>
        <div class="paint-group"><h4>Wallpaper</h4><div class="swatches">${INTERIOR_COLORS.map((c) => swatch('interior', c, int)).join('')}</div></div>
        <div class="paint-group"><h4>Floor</h4><div class="floors">${Object.entries(FLOORS).map(([k, f]) => `<button class="floor-btn${(home.floor || 'oak') === k ? ' on' : ''}" data-paint="floor" data-value="${k}">
          <span style="background:linear-gradient(90deg, ${f.colors[0]} 50%, ${f.colors[1]} 50%)"></span>${escapeHtml(f.label)}</button>`).join('')}</div></div>
        <div class="paint-group"><h4>House style</h4><div class="chips">${Object.entries(ARCHES).map(([k, l]) => `<button class="chip-btn${(home.arch || this.lot.arch) === k ? ' on' : ''}" data-arch="${k}">${escapeHtml(l)}</button>`).join('')}</div><p class="paint-note">Roofs show when you zoom out and lift away as you zoom in.</p></div>

        <button class="link-btn" data-reset-paint>Reset paint to the original</button>`;
    }
    const sel = this.selected && this.lot.decor.items.find((d) => d.id === this.selected);
    const tools = sel
      ? `<div class="build-selected"><b>${escapeHtml(DECOR[sel.item].label)}</b>
          <button data-act="move">Move</button><button data-act="rotate">${icon('rotateCw')} Rotate</button><button data-act="delete" class="danger">${icon('trash')} Remove</button></div>`
      : '';
    this.panel.innerHTML = `<header><div><small>BUILD MODE · JUST FOR FUN</small>
        <h2>${icon('hammer')} Decorate <select name="home" aria-label="Home to decorate">${lots.map((l) => `<option value="${escapeHtml(l.project)}"${l === this.lot ? ' selected' : ''}>${escapeHtml(l.name)}</option>`).join('')}</select></h2></div>
        <button class="icon-btn" data-done aria-label="Leave build mode">${icon('check')}</button></header>
      ${tabs}${body}${tools}
      <p class="build-hint">${this.holding ? 'Click to place · <kbd>R</kbd> rotate · right-click or <kbd>Esc</kbd> to stop' : 'Pick an item, or click something you placed to move it · <kbd>B</kbd> or <kbd>Esc</kbd> to finish'}</p>
      <p class="build-msg" role="status"></p>`;
  }

  /** Unlock / level explanation for the locked item the user clicked. */
  unlockPrompt() {
    const item = this.pending;
    if (!item) return '';
    const d = DECOR[item];
    if (d.grown && !(this.style().harvest?.[d.grown] > 0)) {
      return `<div class="unlock-prompt"><b>${icon('lock')} ${escapeHtml(d.label)}</b><p>Harvest ${escapeHtml(CROPS[d.grown].label.toLowerCase())} from a garden bed to unlock.</p><div><button data-unlock-cancel>OK</button></div></div>`;
    }
    if (d.found && !(this.style().found?.[d.found] > 0)) {
      return `<div class="unlock-prompt"><b>${icon('lock')} ${escapeHtml(d.label)}</b><p>Find a ${escapeHtml(COLLECTIBLES[d.found].label.toLowerCase())} around the neighborhood to unlock.</p><div><button data-unlock-cancel>OK</button></div></div>`;
    }
    const owned = (this.style().unlocks || []).includes(item) || !itemPrice(item);
    const balance = this.balance?.() ?? 0;
    const levelNote = this.lot.level < itemLevel(item)
      ? `<p>Needs a <b>${escapeHtml(levelName(itemLevel(item)))}</b> home. Reach an outcome to grow this one.</p>`
      : '';
    if (owned) return `<div class="unlock-prompt"><b>${escapeHtml(d.label)}</b>${levelNote}<button data-unlock-cancel>OK</button></div>`;
    const enough = balance >= itemPrice(item);
    return `<div class="unlock-prompt"><b>${icon('lockOpen')} Unlock ${escapeHtml(d.label)} for ${itemPrice(item)} bricks?</b>
      <p>You have ${Math.max(0, balance)}.${enough ? ' Works in every home.' : ` ${itemPrice(item) - Math.max(0, balance)} more to go.`}</p>${levelNote}
      <div><button data-unlock ${enough ? '' : 'disabled'}>Unlock</button><button data-unlock-cancel>Not now</button></div></div>`;
  }

  message(text) {
    const el = this.panel.querySelector('.build-msg');
    if (el) el.textContent = text;
  }

  onPanelClick(e) {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.hasAttribute('data-done')) return this.exit();
    if (b.dataset.tab) {
      this.tab = b.dataset.tab;
      this.drop();
      return this.render();
    }
    if (b.dataset.cat) {
      this.category = b.dataset.cat;
      return this.render();
    }
    if (b.dataset.item) {
      const reason = lockReason(b.dataset.item, { unlocks: this.style().unlocks || [], level: this.lot.level, found: this.style().found || {}, harvest: this.style().harvest || {} });
      if (reason) {
        this.pending = b.dataset.item;
        return this.render();
      }
      this.pending = null;
      return this.hold(b.dataset.item);
    }
    if (b.hasAttribute('data-unlock')) {
      const item = this.pending;
      this.save({ kind: 'unlock', key: item })
        .then(() => {
          this.pending = null;
          if (!lockReason(item, { unlocks: [...(this.style().unlocks || []), item], level: this.lot.level, found: this.style().found || {}, harvest: this.style().harvest || {} })) this.hold(item);
          else this.render();
          this.onUnlock?.(item);
        })
        .catch((err) => this.message(err.message));
      return;
    }
    if (b.hasAttribute('data-unlock-cancel')) {
      this.pending = null;
      return this.render();
    }
    if (b.dataset.paint) {
      const home = this.homeStyle();
      home[b.dataset.paint] = b.dataset.value;
      this.commit(home).then(() => this.render());
      return;
    }
    if (b.dataset.arch) {
      const home = this.homeStyle();
      home.arch = b.dataset.arch;
      this.commit(home, '').then(() => this.render());
      return;
    }
    if (b.dataset.pet != null) {
      const home = this.homeStyle();
      home.pet = b.dataset.pet || undefined;
      this.commit(home, b.dataset.pet ? `Say hi to your ${PETS[b.dataset.pet].toLowerCase()}!` : '').then(() => this.render());
      return;
    }
    if (b.hasAttribute('data-reset-paint')) {
      const home = this.homeStyle();
      delete home.exterior;
      delete home.interior;
      delete home.floor;
      this.commit(home, 'Paint reset.').then(() => this.render());
      return;
    }
    if (b.dataset.act === 'move' && this.selected) {
      const it = this.lot.decor.items.find((d) => d.id === this.selected);
      this.hold(it.item, { moving: it.id, rot: it.rot });
    }
    if (b.dataset.act === 'rotate') this.rotate();
    if (b.dataset.act === 'delete' && this.selected) this.remove(this.selected);
  }

  // ---- Placing -------------------------------------------------------------------------------

  hold(item, { moving = null, rot = 0 } = {}) {
    this.drop();
    if (!moving && this.lot.decor.items.length >= MAX_DECOR) return this.message(`This home already has ${MAX_DECOR} decorations.`);
    this.holding = { item, rot, moving };
    const { group } = buildDecor(item, 7);
    group.traverse((o) => {
      if (o.isMesh) {
        o.material = o.material.clone();
        o.material.transparent = true;
        o.material.opacity = 0.7;
        o.castShadow = false;
      }
    });
    this.ghost = group;
    this.lot.group.add(group, this.marker);
    if (moving) this.lot.decor.items.find((d) => d.id === moving).object.visible = false;
    this.selected = null;
    this.render();
  }

  drop() {
    if (this.holding?.moving) {
      const it = this.lot?.decor.items.find((d) => d.id === this.holding.moving);
      if (it) it.object.visible = true;
    }
    if (this.ghost) this.ghost.parent?.remove(this.ghost);
    this.marker.parent?.remove(this.marker);
    this.ghost = null;
    this.holding = null;
    if (this.active) this.render();
  }

  rotate() {
    if (this.holding) {
      this.holding.rot = (this.holding.rot + 1) % 4;
      this.pointerMoved = true;
    } else if (this.selected) {
      const home = this.homeStyle();
      const it = home.decor.find((d) => d.id === this.selected);
      const rot = (it.rot + 1) % 4;
      const check = this.lot.canPlace(it.item, it.x, it.z, rot, it.id);
      if (!check.ok) return this.message(check.reason);
      it.rot = rot;
      this.commit(home);
    }
  }

  remove(id) {
    const home = this.homeStyle();
    home.decor = home.decor.filter((d) => d.id !== id);
    this.selected = null;
    this.commit(home, 'Removed.').then(() => this.render());
  }

  select(id) {
    this.selected = id;
    this.onSelect?.(id ? this.lot.decor.items.find((d) => d.id === id)?.object : null);
    if (this.active) this.render();
  }

  /** Where the pointer hits the floor, in lot-local coordinates snapped to the grid. */
  pointerSpot() {
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const hit = new THREE.Vector3();
    if (!this.raycaster.ray.intersectPlane(this.plane, hit)) return null;
    const x = Math.round((hit.x - this.lot.group.position.x) / SNAP) * SNAP;
    const z = Math.round((hit.z - this.lot.group.position.z) / SNAP) * SNAP;
    return { x, z };
  }

  /** Per frame: move the ghost and re-check placement when the pointer or rotation changes. */
  update() {
    if (!this.active || !this.holding || !this.ghost) return;
    if (!this.pointerMoved) return;
    this.pointerMoved = false;
    const p = this.pointerSpot();
    if (!p) return;
    const { item, rot, moving } = this.holding;
    this.ghost.position.set(p.x, 0.12, p.z);
    this.ghost.rotation.y = -rot * (Math.PI / 2);
    const check = this.lot.canPlace(item, p.x, p.z, rot, moving);
    this.ghostOk = check.ok;
    this.ghostReason = check.reason || '';
    this.spot = p;
    const [x0, z0, x1, z1] = this.lot.footprint(item, p.x, p.z, rot);
    this.marker.position.set((x0 + x1) / 2, 0.15, (z0 + z1) / 2);
    this.marker.scale.set(x1 - x0, z1 - z0, 1);
    this.marker.material.color.set(check.ok ? 0x4ade80 : 0xef4444);
    this.marker.visible = true;
    this.ghost.traverse((o) => o.isMesh && o.material.emissive?.set(check.ok ? 0x000000 : 0x661111));
    this.message(check.ok ? '' : check.reason);
  }

  /** Canvas click while building: place what we're holding, or select placed decor. */
  click(hitObject) {
    if (!this.active) return false;
    if (this.holding) {
      if (!this.ghostOk || !this.spot) {
        this.message(this.ghostReason || "Can't place it there.");
        return true;
      }
      const home = this.homeStyle();
      const { item, rot, moving } = this.holding;
      if (moving) {
        const it = home.decor.find((d) => d.id === moving);
        Object.assign(it, { x: this.spot.x, z: this.spot.z, rot });
        this.drop();
        this.commit(home, 'Moved.');
      } else {
        const id = Math.random().toString(36).slice(2, 10);
        home.decor.push({ id, item, x: this.spot.x, z: this.spot.z, rot });
        this.commit(home);
        this.pointerMoved = true; // keep placing more of the same item
      }
      return true;
    }
    const it = this.lot.decorAt(hitObject);
    this.select(it ? it.id : null);
    return true;
  }
}

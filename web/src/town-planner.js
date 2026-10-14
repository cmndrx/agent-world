// Plan town (simulation layer): a SimCity-style planning view over the town grid (shared/town.mjs). Draw
// streets, remove streets, move or turn homes, place civic buildings (fire station, hospital, …) as player levels
// unlock them, and choose a plot for a new project's home. Every action is a
// preview until you confirm; the bridge validates it again with the same rules before saving. Interior
// decoration stays in Decorate (build.js). Streets and traffic are scenery and never reflect agent work.
//
// Controls: 1–5 pick a tool · click to start, click to finish · R turns a home or flips a street's corner ·
// Enter confirms · Esc cancels the preview, then leaves · M toggles Plan town · drag or WASD pans.

import * as THREE from 'three';
import { CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import {
  BUILDABLE, CIVIC, CIVIC_KINDS, FACING, PROTECTED, TILE, centeredAt, checkPlacement, civicTransform, extents, connectedRoads, eligiblePlots, entranceTile, homeTiles, homeTransform, key,
  planRoad, planRoadRemoval, roadMap, tileAt, tileCenter, tilesRect,
} from '../../shared/town.mjs';
import { civicPictures } from './civic.js';
import { icon } from './icons.js';
import { escapeHtml as esc } from './sim.js';

const COLORS = { new: 0x19d67c, existing: 0x4f8dff, blocked: 0xff5468, remove: 0xff9a3d, ok: 0x46e89a, bad: 0xff5468, network: 0x5aa8ff, white: 0xffffff, protected: 0xffbf3f };
const TOOLS = {
  road: { label: 'Road', long: 'Draw road', icon: 'route', key: '1', help: 'Click a start tile, then an end tile. Streets snap to the grid, make at most one 90° turn and must join an existing street. Basic streets are free.' },
  remove: { label: 'Bulldoze', long: 'Remove road', icon: 'eraser', key: '2', help: 'Click the first and last tile of a straight stretch of street. Main Street stays, and every home keeps its connection.' },
  move: { label: 'Move', long: 'Move building', icon: 'move', key: '3', help: 'Click a home or civic building to pick it up, then click its new plot. R turns it; the arrow is its entrance.' },
  civic: { label: 'Civic', long: 'Civic buildings', icon: 'landmark', key: '5', help: 'Choose a building from the list, then a plot beside a connected street. New ones unlock as you level up.' },
  place: { label: 'Place', long: 'Place home', icon: 'house', key: '4', help: 'Choose a plot beside a connected street (green marks show frontage). R turns the home.' },
};
const FACE = ['south', 'east', 'north', 'west'];

/** Canvas textures shared by every overlay: a rounded tile with a bright rim, a grid cell and a hatch. */
function canvasTexture(draw, size = 64) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  draw(c.getContext('2d'), size);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}
const roundRect = (g, x, y, w, h, r) => { g.beginPath(); g.roundRect(x, y, w, h, r); };
let textures = null;
function overlayTextures() {
  if (textures) return textures;
  textures = {
    tile: canvasTexture((g, s) => {
      roundRect(g, 4, 4, s - 8, s - 8, 12);
      g.fillStyle = 'rgba(255,255,255,0.5)';
      g.fill();
      g.lineWidth = 5;
      g.strokeStyle = 'rgba(255,255,255,1)';
      g.stroke();
      // A dark inner line keeps the tinted rim readable on bright grass.
      roundRect(g, 9, 9, s - 18, s - 18, 8);
      g.lineWidth = 2;
      g.strokeStyle = 'rgba(0,0,0,0.38)';
      g.stroke();
    }),
    cell: canvasTexture((g, s) => {
      g.strokeStyle = 'rgba(20,40,32,0.35)';
      g.lineWidth = 3;
      g.strokeRect(1.5, 1.5, s - 3, s - 3);
      g.strokeStyle = 'rgba(255,255,255,0.85)';
      g.lineWidth = 1.5;
      g.strokeRect(0.75, 0.75, s - 1.5, s - 1.5);
      g.fillStyle = 'rgba(255,255,255,0.9)';
      for (const [x, y] of [[0, 0], [s, 0], [0, s], [s, s]]) g.fillRect(x - 3, y - 3, 6, 6); // corner studs
    }),
    hatch: canvasTexture((g, s) => {
      g.strokeStyle = 'rgba(255,191,63,0.75)';
      g.lineWidth = 6;
      for (let k = -s; k < s * 2; k += 16) { g.beginPath(); g.moveTo(k, 0); g.lineTo(k + s, s); g.stroke(); }
    }),
    chevron: canvasTexture((g, s) => {
      g.fillStyle = '#fff';
      g.beginPath();
      g.moveTo(s * 0.5, s * 0.12); g.lineTo(s * 0.92, s * 0.62); g.lineTo(s * 0.72, s * 0.62); g.lineTo(s * 0.5, s * 0.36);
      g.lineTo(s * 0.28, s * 0.62); g.lineTo(s * 0.08, s * 0.62);
      g.closePath();
      g.fill();
    }),
  };
  for (const t of [textures.cell, textures.hatch]) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return textures;
}
const overlayMat = (color, opacity, map = overlayTextures().tile) => new THREE.MeshBasicMaterial({ color, map, transparent: true, opacity, depthWrite: false, toneMapped: false });

export class TownPlanner {
  /**
   * @param {object} o
   * @param {THREE.Scene} o.scene
   * @param {THREE.Camera} o.camera
   * @param {HTMLElement} o.dom the canvas
   * @param {() => object} o.town the current town layout
   * @param {(project: string) => string} o.homeName
   * @param {(project: string) => number} [o.homeHeight] how tall a home's current tier stands (for its ghost)
   * @param {(action: object) => Promise<any>} o.save POST /api/town
   * @param {() => boolean} [o.suppressed] true for the click that ends a camera drag
   * @param {(active: boolean, center: THREE.Vector3|null, distance: number) => void} o.onToggle
   */
  constructor(o) {
    Object.assign(this, o);
    this.active = false;
    this.tool = 'road';
    this.draft = null; // the unconfirmed action
    this.hover = null; // tile under the pointer
    this.rot = 0;
    this.flip = false; // R flips a street's corner from the automatic choice
    this.busy = false;
    this.message = '';
    this.flash = null; // { text, ok, until } a brief toast after saving
    this.placing = null; // { label, onConfirm, onCancel, replacing } while choosing a plot for a new project
    this.pointerXY = null; // last client position over the canvas
    this.pulses = [];
    this.raycaster = new THREE.Raycaster();
    this.pointer = new THREE.Vector2();
    this.ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    this.overlay = new THREE.Group();
    this.overlay.visible = false;
    this.scene.add(this.overlay);
    this.guides = new THREE.Group(); // grid, civic land, network, footprints (rebuilt when the town changes)
    this.preview = new THREE.Group(); // the draft (rebuilt as the pointer moves)
    this.overlay.add(this.guides, this.preview);

    this.el = document.createElement('div');
    this.el.id = 'town-planner';
    this.el.hidden = true;
    this.el.innerHTML = `
      <header class="tp-banner" data-part="banner"></header>
      <section class="tp-card" data-part="card" aria-live="polite"></section>
      <nav class="tp-dock" data-part="dock" role="toolbar" aria-label="Town planning tools"></nav>
      <div class="tp-flash" data-part="flash" role="status" hidden></div>
      <aside class="tp-civic" data-part="civic" aria-label="Civic buildings" hidden></aside>
      <aside class="tp-ledger" aria-label="Projects">
        <button type="button" class="tp-ledger-tab" data-ledger-toggle data-part="ledgerTab" aria-expanded="true"></button>
        <div class="tp-ledger-body" data-part="ledgerBody"></div>
      </aside>`;
    this.cursor = document.createElement('div');
    this.cursor.className = 'tp-cursor';
    this.cursor.hidden = true;
    document.body.append(this.el, this.cursor);
    this.parts = Object.fromEntries([...this.el.querySelectorAll('[data-part]')].map((n) => [n.dataset.part, n]));
    // The Projects drawer: your projects, permits and the add-project flow live here, beside the map they shape.
    this.ledgerOpen = innerWidth > 900;
    this.projectCount = 0;
    if (this.ledger) this.parts.ledgerBody.append(this.ledger);
    this.html = {};
    this.el.addEventListener('click', (e) => this.onPanelClick(e));
    this.el.addEventListener('submit', (e) => { e.preventDefault(); this.saveStreetName(); });
    this.el.addEventListener('keydown', (e) => {
      if (e.target.name === 'street' && e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); this.renaming = null; this.refresh(); }
    });
    this.dom.addEventListener('pointermove', (e) => { this.pointerXY = [e.clientX, e.clientY]; this.onPointer(); });
    this.dom.addEventListener('pointerleave', () => { this.pointerXY = null; this.cursor.hidden = true; });
    this.dom.addEventListener('click', (e) => this.onCanvasClick(e));
    addEventListener('keydown', (e) => this.onKey(e), true);
  }

  // ---- Entering and leaving ---------------------------------------------------------------------

  enter(tool = this.tool, focus = null) {
    this.active = true;
    this.setTool(tool);
    this.el.hidden = false;
    this.overlay.visible = true;
    document.body.classList.add('planning');
    if (focus) {
      // Close in on one plot (choosing a home's plot); zoom out with the wheel for the whole town.
      const c = tileCenter(focus.i + 1, focus.j + 1);
      this.onToggle(true, new THREE.Vector3(c.x, 0.12, c.z + 6), 120);
    } else this.frame();
    this.refresh();
  }

  exit() {
    if (this.placing) {
      const cancel = this.placing.onCancel;
      this.placing = null;
      cancel?.();
    }
    this.active = false;
    this.draft = null;
    this.renaming = null;
    this.el.hidden = true;
    this.cursor.hidden = true;
    this.overlay.visible = false;
    document.body.classList.remove('planning');
    this.onToggle(false, null, 0);
  }

  /** Fit the built-up part of the town (plus a margin) in view, looking straight down. */
  frame() {
    const t = this.town();
    const tiles = [...roadMap(t).keys()].map((k) => k.split(',').map(Number)).concat(t.homes.filter((h) => h.i != null).flatMap(homeTiles), (t.civic || []).flatMap(homeTiles));
    let [i0, j0, i1, j1] = [-6, -4, 15, 4];
    for (const [i, j] of tiles) { i0 = Math.min(i0, i); j0 = Math.min(j0, j); i1 = Math.max(i1, i); j1 = Math.max(j1, j + 3); }
    j1 = Math.min(BUILDABLE.j1, j1 + 2);
    const [x0, z0r, x1, z1r] = tilesRect(i0, j0, i1, j1);
    // Room at the top for the banner and at the bottom for the tool dock and card.
    const z0 = z0r - 10, z1 = z1r + 16;
    const center = new THREE.Vector3((x0 + x1) / 2, 0.12, (z0 + z1) / 2);
    const tan = Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2));
    const fit = Math.max((x1 - x0 + 8) / (2 * tan * this.camera.aspect), (z1 - z0) * 0.95 / (2 * tan));
    this.onToggle(true, center, THREE.MathUtils.clamp(fit, 60, 320));
  }

  setTool(tool) {
    if (!TOOLS[tool] || (tool === 'place' && !this.placing)) tool = 'road';
    this.tool = tool;
    this.draft = null;
    this.message = '';
    this.renaming = null;
    this.civicKind = null;
    this.removingCivic = null;
    // Coming back to Place keeps a ghost under the pointer (or on the best plot).
    if (tool === 'place') {
      const t = this.hover;
      const first = t ? { i: t.i - 1, j: t.j - 1, rot: this.rot } : this.firstPlot();
      if (first) this.draft = { kind: 'place', at: { i: first.i, j: first.j, rot: first.rot ?? this.rot }, fixed: false };
    }
  }

  /** Town with the home being replaced taken out (its plot is free for the new one). */
  base() {
    const town = this.town();
    return this.placing?.replacing ? { ...town, homes: town.homes.filter((h) => h.project !== this.placing.replacing) } : town;
  }

  firstPlot() {
    const town = this.town();
    return (this.placing?.replacing && town.homes.find((h) => h.project === this.placing.replacing && h.i != null)) || eligiblePlots(this.base(), { limit: 1 })[0] || null;
  }

  /**
   * Choose a plot for a new project's home. `onConfirm(placement, revision)` performs the add (and throws with a
   * reason to stay here); `onCancel` runs if the player backs out. Nothing is saved before confirmation.
   */
  choosePlot({ label, onConfirm, onCancel, replacing = null }) {
    if (this.placing) this.placing.onCancel?.();
    this.placing = { label, onConfirm, onCancel, replacing };
    const first = this.firstPlot();
    this.rot = first?.rot || 0;
    this.hover = null;
    this.enter('place', first);
  }

  /** Open Plan town with the Projects drawer showing (add a project, permits, your homes). */
  openProjects() {
    if (!this.active) this.enter();
    this.ledgerOpen = true;
    this.onLedgerOpen?.();
    this.render();
  }

  setProjectCount(n) {
    this.projectCount = n;
    if (this.active) this.render();
  }

  /** Fly to a home and outline it (from its card in the Projects drawer). */
  focusHome(project) {
    const h = this.town().homes.find((x) => x.project === project && x.i != null);
    if (!h) return;
    const c = tileCenter(h.i + 1, h.j + 1);
    this.onToggle(true, new THREE.Vector3(c.x, 0.12, c.z + 6), 110);
    this.focus = { project, until: performance.now() + 2600 };
    this.refresh(false);
  }

  /** Pick a civic building from the list: a new one follows the pointer; a placed one starts from where it stands. */
  pickCivic(kind) {
    const placed = this.town().civic?.find((c) => c.kind === kind);
    this.setTool('civic');
    this.civicKind = kind;
    this.rot = placed?.rot || 0;
    const at = placed || (this.hover ? centeredAt(this.hover, this.rot, kind) : eligiblePlots(this.town(), { civic: kind, limit: 1 })[0]);
    if (at) this.draft = { kind: 'civic', civic: kind, at: { i: at.i, j: at.j, rot: this.rot }, fixed: false };
    this.refresh();
  }

  async removeCivicBuilding(kind) {
    if (this.removingCivic !== kind) { this.removingCivic = kind; return this.render(); }
    this.removingCivic = null;
    this.busy = true;
    try {
      await this.save({ action: 'remove-civic', kind, revision: this.town().revision });
      this.toast(`${CIVIC[kind].name} removed · you can place it again any time`, true);
      if (this.civicKind === kind) { this.civicKind = null; this.draft = null; }
    } catch (err) { this.message = err.message; }
    finally { this.busy = false; this.refresh(); }
  }

  /** The placed civic building covering a tile, if any. */
  civicAt(t) {
    return (this.town().civic || []).find((c) => homeTiles(c).some(([i, j]) => i === t.i && j === t.j)) || null;
  }

  /** Move (or repair) one home, starting from the move tool with that home picked. */
  moveHome(project) {
    const h = this.town().homes.find((x) => x.project === project);
    const start = !h ? null : h.i != null ? h : eligiblePlots(this.town(), { project, limit: 1 })[0] || { i: 0, j: 2, rot: 0 };
    this.enter('move', start);
    if (!h) return;
    this.rot = start.rot || 0;
    this.draft = { kind: 'move', project, at: { i: start.i, j: start.j, rot: this.rot }, fixed: false };
    this.refresh();
  }

  // ---- Input ------------------------------------------------------------------------------------

  /** The tile under a client point, clamped near buildable land so previews never run off into the hills. */
  tileAt(x, y) {
    const rect = this.dom.getBoundingClientRect();
    this.pointer.set(((x - rect.left) / rect.width) * 2 - 1, -((y - rect.top) / rect.height) * 2 + 1);
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const hit = new THREE.Vector3();
    if (!this.raycaster.ray.intersectPlane(this.ground, hit)) return null;
    const t = tileAt(hit.x, hit.z);
    return { i: THREE.MathUtils.clamp(t.i, BUILDABLE.i0 - 2, BUILDABLE.i1 + 2), j: THREE.MathUtils.clamp(t.j, BUILDABLE.j0 - 4, BUILDABLE.j1 + 2) };
  }

  /** Follow the pointer (also called each frame, so panning and zooming keep the preview under it). */
  onPointer() {
    if (!this.active || this.busy || !this.pointerXY) return;
    const t = this.tileAt(...this.pointerXY);
    if (!t || (this.hover && t.i === this.hover.i && t.j === this.hover.j)) return;
    this.hover = t;
    const d = this.draft;
    if (d && !d.fixed) {
      if (d.kind === 'road' || d.kind === 'remove') d.to = t;
      // A home follows the pointer by its centre tile.
      if (d.kind === 'move' || d.kind === 'place') d.at = { i: t.i - 1, j: t.j - 1, rot: this.rot };
      if (d.kind === 'civic') d.at = centeredAt(t, this.rot, d.civic);
    } else if (!d && this.tool === 'place') this.draft = { kind: 'place', at: { i: t.i - 1, j: t.j - 1, rot: this.rot }, fixed: false };
    else if (!d && this.tool === 'civic' && this.civicKind) this.draft = { kind: 'civic', civic: this.civicKind, at: centeredAt(t, this.rot, this.civicKind), fixed: false };
    this.refresh(false);
  }

  onCanvasClick(e) {
    if (!this.active || this.busy || this.suppressed?.()) return; // a drag pans the view
    const t = this.tileAt(e.clientX, e.clientY);
    if (!t) return;
    this.hover = t;
    const d = this.draft;
    this.message = '';
    if (this.tool === 'road' || this.tool === 'remove') {
      if (!d || d.fixed) this.draft = { kind: this.tool, from: t, to: t, fixed: false };
      else { d.to = t; d.fixed = true; }
    } else if (this.tool === 'civic' || d?.kind === 'civic') {
      if (d) { d.at = centeredAt(t, this.rot, d.civic); d.fixed = true; }
      else {
        const b = this.civicAt(t);
        if (!b) { this.message = 'Choose a building from the list first.'; return this.refresh(); }
        return this.pickCivic(b.kind);
      }
    } else if (this.tool === 'move') {
      if (!d) {
        const b = this.civicAt(t);
        if (b) {
          this.rot = b.rot || 0;
          this.civicKind = b.kind;
          this.draft = { kind: 'civic', civic: b.kind, at: { i: b.i, j: b.j, rot: this.rot }, fixed: false };
          return this.refresh();
        }
        const home = this.town().homes.find((h) => h.i != null && homeTiles(h).some(([i, j]) => i === t.i && j === t.j));
        if (!home) { this.message = 'Click a home or civic building to pick it up.'; return this.refresh(); }
        this.rot = home.rot || 0;
        this.draft = { kind: 'move', project: home.project, at: { i: home.i, j: home.j, rot: this.rot }, fixed: false };
      } else { d.at = { i: t.i - 1, j: t.j - 1, rot: this.rot }; d.fixed = true; }
    } else if (this.tool === 'place') {
      this.draft = { kind: 'place', at: { i: t.i - 1, j: t.j - 1, rot: this.rot }, fixed: true };
    }
    this.refresh();
  }

  onKey(e) {
    if (e.target.closest?.('input, textarea, select, dialog')) return;
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if ((e.key === 'm' || e.key === 'M') && !document.body.classList.contains('photo')) {
      e.stopImmediatePropagation();
      this.active ? this.exit() : this.enter();
      return;
    }
    if (!this.active) return;
    const tool = Object.entries(TOOLS).find(([, t]) => t.key === e.key)?.[0];
    if (tool && (tool !== 'place' || this.placing)) {
      e.stopImmediatePropagation();
      this.setTool(tool);
      return this.refresh();
    }
    if (e.key === 'Escape') {
      e.stopImmediatePropagation();
      e.preventDefault();
      // Escape cancels the preview first, then leaves planning.
      if (this.renaming) { this.renaming = null; this.refresh(); }
      else if (this.removingCivic) { this.removingCivic = null; this.render(); }
      else if (this.draft && (this.draft.fixed || this.tool === 'road' || this.tool === 'remove' || this.tool === 'move' || this.tool === 'civic')) this.cancelDraft();
      else if (this.placing) this.cancelPlacing();
      else this.exit();
    } else if (e.key === 'r' || e.key === 'R') {
      e.stopImmediatePropagation();
      this.rotate();
    } else if (e.key === 'Enter' && this.draft?.fixed && !e.target.closest?.('button')) {
      // A focused button handles its own Enter (so Enter on Cancel cancels).
      e.preventDefault();
      this.confirm();
    }
  }

  rotate() {
    if (this.busy) return;
    if (this.tool === 'road') this.flip = !this.flip;
    else if (this.tool !== 'remove') {
      this.rot = (this.rot + 1) % 4;
      const d = this.draft;
      if (d?.kind === 'civic' && d.at) {
        // Turn a non-square building about its middle tile, so it doesn't walk off as it turns.
        const { ex, ez } = extents({ kind: d.civic, rot: d.at.rot });
        d.at = centeredAt({ i: d.at.i + Math.floor((ex - 1) / 2), j: d.at.j + Math.floor((ez - 1) / 2) }, this.rot, d.civic);
      } else if (d?.at) d.at = { ...d.at, rot: this.rot };
    }
    this.refresh(false);
  }

  /** A street's corner follows the longer leg first (like dragging out a road); R flips it. */
  bend(d) {
    const auto = Math.abs(d.to.i - d.from.i) >= Math.abs(d.to.j - d.from.j) ? 'x' : 'z';
    return this.flip ? (auto === 'x' ? 'z' : 'x') : auto;
  }

  /** Back out of choosing a plot for a new project: stay in Plan town with the Projects drawer. */
  cancelPlacing() {
    const cancel = this.placing?.onCancel;
    this.placing = null;
    cancel?.();
    this.setTool('road');
    this.message = 'Cancelled. Nothing was created and no permit was used.';
    this.ledgerOpen = true;
    this.refresh();
  }

  cancelDraft() {
    const placing = this.tool === 'place' && this.placing;
    this.draft = null;
    this.civicKind = null;
    this.message = 'Cancelled. Nothing changed.';
    if (placing && !this.hover) return this.cancelPlacing();
    if (placing) this.draft = { kind: 'place', at: { i: this.hover.i - 1, j: this.hover.j - 1, rot: this.rot }, fixed: false };
    this.refresh();
  }

  onPanelClick(e) {
    const b = e.target.closest('button');
    if (!b || this.busy) return;
    if (b.hasAttribute('data-ledger-toggle') || b.hasAttribute('data-ledger-open')) {
      this.ledgerOpen = b.hasAttribute('data-ledger-open') ? true : !this.ledgerOpen;
      if (this.ledgerOpen) this.onLedgerOpen?.();
      return this.render();
    }
    if (b.closest('.tp-ledger-body')) return; // the Projects panel handles its own buttons
    if (b.dataset.civicPick) return this.pickCivic(b.dataset.civicPick);
    if (b.dataset.civicRemove) return this.removeCivicBuilding(b.dataset.civicRemove);
    if (b.dataset.tool) { this.setTool(b.dataset.tool); this.refresh(); }
    else if (b.hasAttribute('data-done')) this.placing ? this.cancelPlacing() : this.exit();
    else if (b.hasAttribute('data-cancel')) this.cancelDraft();
    else if (b.hasAttribute('data-confirm')) this.confirm();
    else if (b.hasAttribute('data-rotate')) this.rotate();
    else if (b.hasAttribute('data-rename-cancel')) { this.renaming = null; this.refresh(); }
  }

  /** Rename a street (from its sign). */
  startRename(streetId) {
    if (!this.active) return;
    const road = this.town().roads.find((r) => r.streetId === streetId);
    if (!road) return;
    this.renaming = { streetId, name: road.name };
    this.refresh();
    const input = this.el.querySelector('input[name=street]');
    input?.focus();
    input?.select();
  }

  async saveStreetName() {
    const input = this.el.querySelector('input[name=street]');
    if (!this.renaming || !input || this.busy) return;
    this.busy = true;
    try {
      await this.save({ action: 'rename-street', streetId: this.renaming.streetId, name: input.value });
      this.toast(`Renamed to ${input.value.trim()}`, true);
      this.renaming = null;
    } catch (err) { this.message = err.message; }
    finally { this.busy = false; this.refresh(); }
  }

  toast(text, ok) {
    this.flash = { text, ok, until: performance.now() + 2600 };
  }

  // ---- Evaluating the draft ---------------------------------------------------------------------

  /** The draft's validity and preview tiles (same rules as the bridge). */
  evaluate() {
    const d = this.draft;
    const town = this.town();
    if (!d) return null;
    if (d.kind === 'road') {
      const plan = planRoad(town, d.from, d.to, { bend: this.bend(d) });
      const fresh = plan.tiles.filter((t) => t.state === 'new').length;
      const joins = plan.tiles.filter((t) => t.state === 'existing').length;
      return { ...plan, short: plan.ok ? `+${fresh} tile${fresh === 1 ? '' : 's'} · free` : plan.reason,
        summary: plan.ok ? `${fresh} new tile${fresh === 1 ? '' : 's'} · ${fresh * TILE} m${joins ? ` · ${joins === 1 ? 'joins a street' : `runs along ${joins} existing tiles`}` : ''}` : plan.reason };
    }
    if (d.kind === 'remove') {
      const plan = planRoadRemoval(town, d.from, d.to);
      const n = plan.tiles.filter((t) => t.state === 'remove').length;
      const who = [...plan.affected.map((p) => this.homeName(p)), ...(plan.civic || []).map((k) => CIVIC[k].name)].join(', ');
      return { ...plan, short: plan.ok ? `−${n} tile${n === 1 ? '' : 's'}` : plan.reason, summary: plan.ok ? `Removes ${n} street tile${n === 1 ? '' : 's'}` : `${plan.reason}${who ? ` · ${who}` : ''}` };
    }
    if (d.kind === 'civic') {
      const def = CIVIC[d.civic];
      const check = checkPlacement(town, d.at, { civic: d.civic });
      const placed = town.civic?.find((c) => c.kind === d.civic);
      const level = town.permits?.level ?? 1;
      if (!placed && def.level > level) return { ...check, ok: false, short: `Unlocks at level ${def.level}`, summary: `The ${def.name.toLowerCase()} unlocks at player level ${def.level}.` };
      if (placed && placed.i === check.placement.i && placed.j === check.placement.j && (placed.rot || 0) === check.placement.rot) {
        return { ...check, ok: false, same: true, short: 'Already here', summary: 'That is where it stands now. Pick another plot or press R to turn it.' };
      }
      return { ...check, short: check.ok ? `Faces ${FACE[check.placement.rot]}` : check.reasons[0], summary: check.ok ? `${def.name} · entrance faces ${FACE[check.placement.rot]} onto a connected street` : check.reasons.join(' ') };
    }
    const project = d.kind === 'move' ? d.project : '\0new';
    const check = checkPlacement(d.kind === 'place' ? this.base() : town, d.at, { project });
    if (d.kind === 'move') {
      const h = town.homes.find((x) => x.project === d.project);
      if (h && h.i === check.placement.i && h.j === check.placement.j && (h.rot || 0) === check.placement.rot) {
        return { ...check, ok: false, same: true, short: 'Already here', summary: 'That is where it stands now. Pick another plot or press R to turn it.' };
      }
    }
    return { ...check, short: check.ok ? `Faces ${FACE[check.placement.rot]}` : check.reasons[0], summary: check.ok ? `Plot ready · entrance faces ${FACE[check.placement.rot]} onto a connected street` : check.reasons.join(' ') };
  }

  async confirm() {
    const d = this.draft;
    if (!d?.fixed || this.busy) return;
    const ev = this.evaluate();
    if (!ev.ok) { this.message = ev.summary; return this.refresh(); }
    this.busy = true;
    this.message = d.kind === 'place' || (d.kind === 'civic' && !this.town().civic?.some((c) => c.kind === d.civic)) ? 'Breaking ground…' : 'Saving…';
    this.refresh();
    const revision = this.town().revision;
    try {
      if (d.kind === 'road') await this.save({ action: 'add-road', from: d.from, to: d.to, bend: this.bend(d), revision });
      else if (d.kind === 'remove') await this.save({ action: 'remove-road', from: d.from, to: d.to, revision });
      else if (d.kind === 'move') await this.save({ action: 'move-home', project: d.project, ...d.at, revision });
      else if (d.kind === 'civic') {
        const moved = this.town().civic?.some((c) => c.kind === d.civic);
        await this.save({ action: 'place-civic', kind: d.civic, ...d.at, revision });
        this.toast(`${CIVIC[d.civic].name} ${moved ? 'moved' : 'built'}`, true);
        this.message = '';
        this.draft = null;
        this.civicKind = null;
        return;
      }
      else if (d.kind === 'place') {
        const placing = this.placing;
        await placing.onConfirm({ i: d.at.i, j: d.at.j, rot: d.at.rot }, revision);
        this.placing = null; // done: leaving must not cancel it
        this.busy = false;
        this.draft = null;
        return this.exit();
      }
      this.toast(d.kind === 'road' ? 'Street built' : d.kind === 'remove' ? 'Street removed' : 'Home moved · residents, chats and decor came along', true);
      this.message = '';
      this.draft = null;
    } catch (err) {
      this.message = err.message;
      if (d.kind !== 'place') d.fixed = false;
    } finally {
      this.busy = false;
      if (this.active) this.refresh();
    }
  }

  // ---- 3D overlay -------------------------------------------------------------------------------

  /** The town changed (or planning opened): rebuild the guides and re-check the draft. */
  refresh(full = true) {
    if (!this.active) return;
    const town = this.town();
    const guideKey = `${town.revision}|${this.tool}|${this.placing ? 1 : 0}|${this.draft?.kind === 'move' ? this.draft.project : ''}|${this.draft?.kind === 'civic' ? this.draft.civic : ''}`;
    if (full || guideKey !== this.guideKey) {
      this.guideKey = guideKey;
      this.buildGuides(town);
    }
    this.buildPreview();
    this.render();
  }

  clear(group) {
    for (const c of [...group.children]) {
      group.remove(c);
      c.traverse((o) => {
        if (o.isCSS2DObject) o.element.remove();
        o.geometry?.dispose();
        o.material?.dispose?.(); // own materials; the shared textures stay
      });
    }
    this.pulses = this.pulses.filter((p) => p.group !== group);
  }

  pulse(group, mat, base, amp = 0.18, speed = 3.2) {
    this.pulses.push({ group, mat, base, amp, speed });
    return mat;
  }

  tilePlane(i, j, color, opacity, { y = 0.24, inset = 0.2, group = null } = {}) {
    const { x, z } = tileCenter(i, j);
    const mat = overlayMat(color, opacity);
    if (group) this.pulse(group, mat, opacity);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(TILE - inset * 2, TILE - inset * 2), mat);
    m.rotation.x = -Math.PI / 2;
    m.position.set(x, y, z);
    m.renderOrder = 6;
    return m;
  }

  /** A flat outline of a home's reserved footprint. */
  outline(h, color, opacity) {
    const { ex, ez } = extents(h);
    const [x0, z0, x1, z1] = tilesRect(h.i, h.j, h.i + ex - 1, h.j + ez - 1);
    const pts = [[x0, z0], [x1, z0], [x1, z1], [x0, z1], [x0, z0]].map(([x, z]) => new THREE.Vector3(x, 0.32, z));
    const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color, transparent: true, opacity, depthTest: false }));
    line.renderOrder = 7;
    return line;
  }

  /** Entrance chevrons marching from the front gate onto the street (animated in update). */
  chevrons(h, color) {
    const g = new THREE.Group();
    // Homes: lot-local frame (front gate at z ≈ 7.4); civic buildings: footprint frame (front edge at D / 2).
    const t = h.kind ? civicTransform(h) : homeTransform(h);
    g.position.set(t.x, 0.34, t.z);
    g.rotation.y = t.yaw;
    g.userData.x = h.kind ? t.doorX : 0;
    g.userData.z0 = h.kind ? t.D / 2 - 0.6 : 7.4;
    for (let k = 0; k < 3; k++) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 2.6), overlayMat(color, 0.95, overlayTextures().chevron));
      m.material.depthTest = false;
      m.rotation.x = -Math.PI / 2;
      m.rotation.z = Math.PI; // the canvas chevron points up the texture; turn it to lot-local +z (the street)
      m.renderOrder = 9;
      m.userData.march = k / 3;
      g.add(m);
    }
    g.userData.chevrons = true;
    return g;
  }

  /** A translucent holographic stand-in for the building, so the plot reads at a glance. */
  hologram(h, color, height) {
    const g = new THREE.Group();
    const glow = new THREE.Color(color).lerp(new THREE.Color(0xffffff), 0.45).getHex(); // a lighter, luminous tone
    const t = h.kind ? civicTransform(h) : homeTransform(h);
    g.position.set(t.x, 0, t.z);
    g.rotation.y = t.yaw;
    const mass = (w, hgt, d, x, y, z) => {
      const geo = new THREE.BoxGeometry(w, hgt, d);
      const fill = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: glow, transparent: true, opacity: 0.5, depthWrite: false, toneMapped: false }));
      fill.position.set(x, y, z);
      this.pulse(this.preview, fill.material, 0.48, 0.12, 2.4);
      const edges = new THREE.LineSegments(new THREE.EdgesGeometry(geo), new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.95, toneMapped: false }));
      edges.position.copy(fill.position);
      g.add(fill, edges);
    };
    if (h.kind) {
      // A civic building: a block filling its plot (less the forecourt), at the building's own height.
      const W = t.W - 3, D = t.D * 0.62;
      mass(W, height, D, 0, height / 2 + 0.12, -t.D / 2 + 1.2 + D / 2);
      const edge = [[-t.W / 2 + 0.4, -t.D / 2 + 0.4], [t.W / 2 - 0.4, -t.D / 2 + 0.4], [t.W / 2 - 0.4, t.D / 2 - 0.4], [-t.W / 2 + 0.4, t.D / 2 - 0.4], [-t.W / 2 + 0.4, -t.D / 2 + 0.4]].map(([x, z]) => new THREE.Vector3(x, 0.4, z));
      g.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(edge), new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.8, toneMapped: false })));
      g.traverse((o) => (o.renderOrder = 8));
      return g;
    }
    const walls = Math.min(height, 2.8);
    mass(14.6, walls, 10.6, 0, walls / 2 + 0.12, 0);
    if (height > 4) {
      const upper = Math.min(height, 30) - walls - 1.2;
      mass(13.6, upper, 9.6, 0, walls + upper / 2 + 0.12, 0);
    } else {
      // A gable for a one-storey home.
      const roof = new THREE.CylinderGeometry(0.01, 7.6, 3.2, 4, 1);
      roof.rotateY(Math.PI / 4);
      roof.scale(1, 1, 0.72);
      const fill = new THREE.Mesh(roof, new THREE.MeshBasicMaterial({ color: glow, transparent: true, opacity: 0.42, depthWrite: false, toneMapped: false }));
      fill.position.y = walls + 1.7;
      const edges = new THREE.LineSegments(new THREE.EdgesGeometry(roof), new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9, toneMapped: false }));
      edges.position.copy(fill.position);
      g.add(fill, edges);
    }
    // The yard fence line.
    const fence = [[-10.8, -7.45], [10.8, -7.45], [10.8, 7.45], [-10.8, 7.45], [-10.8, -7.45]].map(([x, z]) => new THREE.Vector3(x, 0.4, z));
    g.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(fence), new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.8, toneMapped: false })));
    g.traverse((o) => (o.renderOrder = 8));
    return g;
  }

  label(text, x, z, cls = '') {
    const el = document.createElement('div');
    el.className = `tp-zone ${cls}`;
    el.textContent = text;
    const l = new CSS2DObject(el);
    l.position.set(x, 0.5, z);
    return l;
  }

  buildGuides(town) {
    this.clear(this.guides);
    const tex = overlayTextures();
    // The grid over buildable land: one textured cell per tile.
    const [gx0, gz0, gx1, gz1] = tilesRect(BUILDABLE.i0, BUILDABLE.j0, BUILDABLE.i1, BUILDABLE.j1);
    const cells = tex.cell.clone();
    cells.needsUpdate = true;
    cells.repeat.set((gx1 - gx0) / TILE, (gz1 - gz0) / TILE);
    const grid = new THREE.Mesh(new THREE.PlaneGeometry(gx1 - gx0, gz1 - gz0), new THREE.MeshBasicMaterial({ map: cells, transparent: true, opacity: 0.7, depthWrite: false, toneMapped: false }));
    grid.rotation.x = -Math.PI / 2;
    grid.position.set((gx0 + gx1) / 2, 0.19, (gz0 + gz1) / 2);
    grid.renderOrder = 5;
    this.guides.add(grid);
    // Protected civic land: amber hatching and a label.
    for (const p of PROTECTED) {
      const [x0, z0, x1, z1] = tilesRect(p.i0, p.j0, p.i1, p.j1);
      const hatch = tex.hatch.clone();
      hatch.needsUpdate = true;
      hatch.repeat.set((x1 - x0) / TILE, (z1 - z0) / TILE);
      const m = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0, z1 - z0), new THREE.MeshBasicMaterial({ map: hatch, color: COLORS.protected, transparent: true, opacity: 0.32, depthWrite: false, toneMapped: false }));
      m.rotation.x = -Math.PI / 2;
      m.position.set((x0 + x1) / 2, 0.22, (z0 + z1) / 2);
      m.renderOrder = 5;
      this.guides.add(m, this.label(`Protected · ${p.id === 'downtown' ? 'Downtown' : 'Town square'}`, (x0 + x1) / 2, z0 + 3, 'protected'));
    }
    // The street network: connected streets glow blue; anything cut off shows red.
    const roads = roadMap(town);
    const reach = connectedRoads(town, roads);
    for (const k of roads.keys()) {
      const [i, j] = k.split(',').map(Number);
      this.guides.add(this.tilePlane(i, j, reach.has(k) ? COLORS.network : COLORS.bad, 0.42, { y: 0.21, inset: 0.5 }));
    }
    // Every home's reserved footprint and entrance.
    for (const h of town.homes) if (h.i != null) this.guides.add(this.outline(h, h.connected === false ? COLORS.bad : COLORS.white, 0.6));
    for (const c of town.civic || []) this.guides.add(this.outline(c, c.connected === false ? COLORS.bad : CIVIC[c.kind]?.color ?? COLORS.white, 0.85));
    // While choosing a plot: eligible frontage (where an entrance could open onto a connected street).
    const civicDraft = this.draft?.kind === 'civic' ? this.draft.civic : null;
    if (this.tool === 'place' || this.tool === 'move' || civicDraft) {
      const project = this.tool === 'move' && !civicDraft ? this.draft?.project : null;
      for (const p of eligiblePlots(this.tool === 'place' ? this.base() : town, { project, civic: civicDraft, limit: 400 })) {
        const e = entranceTile(p);
        const [fx, fz] = FACING[p.rot];
        const c = tileCenter(e.i, e.j);
        const mat = this.pulse(this.guides, overlayMat(COLORS.ok, 0.8), 0.7, 0.25, 2.2);
        const m = new THREE.Mesh(new THREE.PlaneGeometry(fz ? 5.6 : 1, fz ? 1 : 5.6), mat);
        m.rotation.x = -Math.PI / 2;
        m.position.set(c.x - fx * 3.3, 0.27, c.z - fz * 3.3);
        m.renderOrder = 6;
        this.guides.add(m);
      }
    }
  }

  buildPreview() {
    this.clear(this.preview);
    const d = this.draft;
    // Hover cue: the tile under the pointer (a ready-to-click cell).
    if (this.hover && (!d || d.fixed) && (this.tool === 'road' || this.tool === 'remove')) {
      this.preview.add(this.tilePlane(this.hover.i, this.hover.j, this.tool === 'remove' ? COLORS.remove : COLORS.white, 0.55, { group: this.preview, y: 0.3 }));
    }
    if (this.hover && !d && this.tool === 'move') {
      const home = this.civicAt(this.hover) || this.town().homes.find((h) => h.i != null && homeTiles(h).some(([i, j]) => i === this.hover.i && j === this.hover.j));
      if (home) this.preview.add(this.outline(home, COLORS.ok, 1), this.chevrons(home, COLORS.ok));
    }
    if (this.hover && !d && this.tool === 'civic') {
      const b = this.civicAt(this.hover);
      if (b) this.preview.add(this.outline(b, COLORS.ok, 1), this.chevrons(b, COLORS.ok));
    }
    if (this.focus && performance.now() < this.focus.until) {
      const h = this.town().homes.find((x) => x.project === this.focus.project && x.i != null);
      if (h) this.preview.add(this.outline(h, COLORS.protected, 1), this.chevrons(h, COLORS.protected));
    }
    const ev = this.evaluate();
    this.result = ev;
    if (!d || !ev) return;
    if (d.kind === 'road' || d.kind === 'remove') {
      for (const t of ev.tiles) {
        const color = COLORS[t.state] ?? COLORS.white;
        this.preview.add(this.tilePlane(t.i, t.j, color, t.state === 'existing' || t.state === 'empty' ? 0.4 : 0.85, { group: t.state === 'existing' ? null : this.preview, y: 0.28 }));
      }
      for (const p of ev.affected || []) {
        const h = this.town().homes.find((x) => x.project === p);
        if (h) this.preview.add(this.outline(h, COLORS.bad, 1), this.hologram(h, COLORS.bad, this.homeHeight?.(p) || 7));
      }
      for (const k of ev.civic || []) {
        const c = this.town().civic?.find((x) => x.kind === k);
        if (c) this.preview.add(this.outline(c, COLORS.bad, 1), this.hologram(c, COLORS.bad, CIVIC[k].height || 9));
      }
      return;
    }
    const color = ev.ok ? COLORS.ok : COLORS.bad;
    for (const t of ev.tiles) this.preview.add(this.tilePlane(t.i, t.j, t.ok ? COLORS.ok : COLORS.bad, t.ok ? 0.42 : 0.8, { y: 0.26 }));
    const height = d.kind === 'move' ? this.homeHeight?.(d.project) || 7 : d.kind === 'civic' ? CIVIC[d.civic].height || 9 : 7.4;
    this.preview.add(this.outline(ev.placement, color, 1), this.hologram(ev.placement, color, height), this.chevrons(ev.placement, color));
    const e = ev.entrance;
    this.preview.add(this.tilePlane(e.i, e.j, color, 0.6, { y: 0.29, inset: 1.2, group: this.preview }));
    // The original plot of a home (or civic building) being moved.
    const was = d.kind === 'move' ? this.town().homes.find((x) => x.project === d.project) : d.kind === 'civic' ? this.town().civic?.find((x) => x.kind === d.civic) : null;
    if (was?.i != null) this.preview.add(this.outline(was, COLORS.white, 0.95));
  }

  /** Per frame: pulses, marching entrance arrows, the pointer tooltip and the flash toast. */
  update(dt, t) {
    if (!this.active) return;
    if (this.pointerXY && (this.frameN = (this.frameN || 0) + 1) % 3 === 0) this.onPointer();
    for (const p of this.pulses) p.mat.opacity = Math.max(0, p.base + Math.sin(t * p.speed) * p.amp);
    this.preview.traverse((o) => {
      if (!o.userData.chevrons) return;
      for (const c of o.children) {
        const k = (c.userData.march + t * 0.7) % 1;
        c.position.set(o.userData.x, 0, o.userData.z0 + k * 4.4);
        c.material.opacity = Math.sin(k * Math.PI) * 0.95;
      }
    });
    // The tooltip by the pointer: what clicking here would do.
    const ev = this.result;
    const show = this.pointerXY && !this.busy && !this.renaming && (ev || this.tool === 'move' || this.tool === 'road' || this.tool === 'remove' || this.tool === 'civic');
    this.cursor.hidden = !show;
    if (show) {
      const d = this.draft;
      const text = ev ? ev.short : this.tool === 'move' ? 'Pick up a building' : this.tool === 'civic' ? 'Choose a building from the list' : this.tool === 'remove' ? 'Start bulldozing here' : 'Start a street here';
      const state = ev ? (ev.ok ? 'ok' : 'bad') : 'idle';
      const hint = !d ? 'Click' : d.fixed ? (ev?.ok ? 'Enter to confirm' : '') : d.kind === 'road' || d.kind === 'remove' ? 'Click to finish' : 'Click to choose';
      const html = `<span class="tp-cursor-state ${state}">${icon(state === 'bad' ? 'x' : state === 'ok' ? 'check' : 'plus')}</span><b>${esc(text)}</b>${hint ? `<small>${esc(hint)}</small>` : ''}`;
      if (html !== this.cursorHtml) { this.cursorHtml = html; this.cursor.innerHTML = html; }
      // Keep the tooltip on screen: flip it to the left of the pointer near the right edge.
      const w = this.cursor.offsetWidth || 160, h = this.cursor.offsetHeight || 30;
      const x = this.pointerXY[0] + 18 + w > innerWidth - 8 ? this.pointerXY[0] - 14 - w : this.pointerXY[0] + 18;
      const y = Math.min(this.pointerXY[1] + 14, innerHeight - h - 8);
      this.cursor.style.transform = `translate(${Math.max(8, x)}px, ${y}px)`;
    }
    if (this.flash && performance.now() > this.flash.until) { this.flash = null; this.render(); }
  }

  // ---- HUD --------------------------------------------------------------------------------------

  set(part, html) {
    if (this.html[part] === html) return;
    this.html[part] = html;
    this.parts[part].innerHTML = html;
  }

  render() {
    const town = this.town();
    const p = town.permits;
    const tool = TOOLS[this.tool];
    const d = this.draft;
    const ev = this.result;
    const streets = roadMap(town).size;
    const name = d?.project ? this.homeName(d.project) : d?.kind === 'place' ? this.placing?.label : d?.kind === 'civic' ? CIVIC[d.civic].name : null;

    this.set('banner', `<div class="tp-emblem">${icon(this.placing ? 'house' : 'map')}</div>
      <div class="tp-title"><small>${this.placing ? 'New home' : 'Town planning'}</small><b>${this.placing ? esc(this.placing.label) : 'Plan town'}</b></div>
      <div class="tp-stats">
        ${p ? `<button type="button" class="tp-stat link${p.overCapacity ? ' over' : p.atCapacity ? ' full' : ''}" data-ledger-open title="Projects and permits">${icon('house')}<b>${p.counted ?? p.active}<i>/${p.allowed}</i></b><small>Permits</small></button>` : ''}
        <span class="tp-stat">${icon('route')}<b>${streets}</b><small>Street tiles</small></span>
        ${p ? `<span class="tp-stat next" title="${esc(p.hint)}">${icon('star')}<b>Lv ${p.nextLevel}</b><small>${p.xpToNext.toLocaleString('en-US')} XP to next permit</small></span>` : ''}
      </div>
      <button type="button" class="tp-done${this.placing ? ' cancel' : ''}" data-done>${icon(this.placing ? 'x' : 'check')}<span>${this.placing ? 'Cancel' : 'Done'}</span><kbd>M</kbd></button>`);

    this.set('dock', Object.entries(TOOLS).filter(([k]) => k !== 'place' || this.placing).map(([k, t]) =>
      `<button type="button" class="tp-tool${k === this.tool ? ' on' : ''}${k === 'remove' ? ' danger' : ''}" data-tool="${k}" aria-pressed="${k === this.tool}" title="${t.long} (${t.key})"><kbd>${t.key}</kbd>${icon(t.icon)}<span>${t.label}</span></button>`).join(''));

    const state = this.busy ? 'busy' : ev ? (ev.ok ? 'ok' : 'bad') : 'idle';
    const headline = this.busy ? this.message || 'Saving…' : ev ? ev.summary : this.message || tool.help;
    const step = !d ? '' : d.kind === 'civic' ? (d.fixed ? (ev?.ok ? 'Confirm to build, or click another plot' : 'Click another plot or press R') : 'Click a plot to choose it') : d.kind === 'road' || d.kind === 'remove' ? (!d.fixed ? 'Click the last tile' : ev?.ok ? 'Confirm to save' : 'Click a new start tile') : d.fixed ? (ev?.ok ? 'Confirm to save, or click another plot' : 'Click another plot or press R') : d.kind === 'move' ? 'Click its new plot' : 'Click a plot to choose it';
    const newCivic = d?.kind === 'civic' && !town.civic?.some((c) => c.kind === d.civic);
    const turn = this.tool === 'road'
      ? `<button type="button" class="tp-key" data-rotate title="Flip the corner (R)">${icon('cornerDownRight')}<span>Flip corner</span><kbd>R</kbd></button>`
      : this.tool !== 'remove' ? `<button type="button" class="tp-key" data-rotate title="Turn (R)">${icon('rotateCw')}<span>Rotate</span><kbd>R</kbd></button>` : '';
    this.set('card', this.renaming
      ? `<form class="tp-rename"><span class="tp-state idle">${icon('signpost')}</span><label><small>Rename street</small><input name="street" maxlength="40" value="${esc(this.renaming.name)}" aria-label="Street name"></label><button type="submit" class="tp-confirm">${icon('check')}<span>Save</span></button><button type="button" class="tp-key" data-rename-cancel><span>Cancel</span><kbd>Esc</kbd></button></form>`
      : `<div class="tp-state ${state}">${icon(state === 'ok' ? 'check' : state === 'bad' ? 'triangleAlert' : state === 'busy' ? 'hourglass' : tool.icon)}</div>
        <div class="tp-copy">
          <small>${esc(tool.long)}${name ? ` · <b>${esc(name)}</b>` : ''}${step ? ` · ${esc(step)}` : ''}</small>
          <p class="${state}">${esc(headline)}</p>
          ${this.message && ev && !this.busy ? `<p class="tp-note">${esc(this.message)}</p>` : ''}
        </div>
        <div class="tp-actions">
          ${turn}
          <button type="button" class="tp-key" data-cancel ${d && !this.busy ? '' : 'disabled'}><span>Cancel</span><kbd>Esc</kbd></button>
          <button type="button" class="tp-confirm" data-confirm ${d?.fixed && ev?.ok && !this.busy ? '' : 'disabled'}>${icon(d?.kind === 'place' || newCivic ? 'hammer' : 'check')}<span>${d?.kind === 'place' || newCivic ? 'Build here' : 'Confirm'}</span><kbd>Enter</kbd></button>
        </div>`);
    this.parts.card.dataset.state = this.renaming ? 'idle' : state;
    this.renderCivic(town);
    // A short shake when a preview turns invalid.
    if (state === 'bad' && this.lastState !== 'bad') {
      this.parts.card.classList.remove('shake');
      void this.parts.card.offsetWidth;
      this.parts.card.classList.add('shake');
    }
    this.lastState = state;
    const open = this.ledgerOpen && !this.placing;
    this.el.classList.toggle('ledger-open', open);
    this.el.classList.toggle('placing', !!this.placing);
    this.parts.ledgerTab.setAttribute('aria-expanded', String(open));
    this.set('ledgerTab', `${icon('folderInput')}<span>Projects</span><b>${this.projectCount}</b>${p?.overCapacity ? `<i class="tp-ledger-alert">${icon('triangleAlert')}</i>` : ''}${icon('chevronRight', open ? 'flip' : '')}`);
    const f = this.parts.flash;
    f.hidden = !this.flash;
    if (this.flash) {
      const html = `${icon(this.flash.ok ? 'sparkles' : 'triangleAlert')}<span>${esc(this.flash.text)}</span>`;
      if (f.innerHTML !== html) { f.innerHTML = html; f.classList.remove('pop'); void f.offsetWidth; f.classList.add('pop'); }
    }
  }

  /** The list of civic buildings: place unlocked ones, move or remove placed ones, see what unlocks next. */
  renderCivic(town) {
    const show = this.tool === 'civic' && !this.placing;
    this.parts.civic.hidden = !show;
    this.el.classList.toggle('civic-open', show);
    if (!show) return;
    const level = town.permits?.level ?? 1;
    const placed = new Map((town.civic || []).map((c) => [c.kind, c]));
    const unlocked = CIVIC_KINDS.filter((k) => CIVIC[k].level <= level).length;
    const pics = civicPictures();
    const rows = CIVIC_KINDS.map((k) => {
      const def = CIVIC[k];
      const c = placed.get(k);
      const locked = !c && def.level > level;
      const picked = this.draft?.kind === 'civic' && this.draft.civic === k;
      const color = `#${def.color.toString(16).padStart(6, '0')}`;
      const status = c ? (c.connected === false ? 'Cut off from Main Street' : 'In your town') : locked ? `Unlocks at level ${def.level}` : 'Ready to place';
      const actions = locked ? `<span class="tp-civic-lock">${icon('lock')}<b>Level ${def.level}</b></span>`
        : c ? `<button type="button" class="tp-civic-btn" data-civic-pick="${k}" aria-label="Move ${esc(def.name)}">${icon('move')}<span>Move</span></button><button type="button" class="tp-civic-btn danger${this.removingCivic === k ? ' confirm' : ''}" data-civic-remove="${k}" aria-label="${this.removingCivic === k ? 'Confirm removing' : 'Remove'} ${esc(def.name)}" title="${this.removingCivic === k ? 'Click again to remove' : 'Remove'}">${this.removingCivic === k ? `${icon('check')}<span>Sure?</span>` : icon('trash')}</button>`
        : `<button type="button" class="tp-civic-place" data-civic-pick="${k}">${icon('hammer')}<span>Place</span></button>`;
      const pic = pics[k] ? `<img src="${pics[k]}" alt="" draggable="false">` : `<span class="tp-civic-fallback">${icon(def.icon)}</span>`;
      return `<li class="${locked ? 'locked' : ''}${c ? ' placed' : ''}${picked ? ' picked' : ''}" style="--c:${color}" title="${esc(`${def.name} · ${def.size.w} × ${def.size.d} tiles · ${status}`)}">
        <div class="tp-civic-pic">${pic}${c ? `<span class="tp-civic-badge">${icon('check')}</span>` : ''}</div>
        <b>${esc(def.name)}</b><small>${def.size.w} × ${def.size.d} plot · ${esc(status)}</small>
        <div class="tp-civic-actions">${actions}</div></li>`;
    }).join('');
    this.set('civic', `<header><span>${icon('landmark')}</span><div><b>Civic buildings</b><small>${unlocked} of ${CIVIC_KINDS.length} unlocked · player level ${level}</small></div></header><ul>${rows}</ul>`);
  }
}

// Photo mode and album (play layer). Hide the interface, pick a look, and take a picture of your world.
// Photos are saved by the local bridge in ~/.agent-world/photos and can be hung on a home's wall.
// Nothing here is sent anywhere else, and none of it reflects agent activity.

import { MAX_GALLERY } from '../../shared/style.mjs';
import { icon } from './icons.js';
import { escapeHtml as esc } from './sim.js';

export const LOOKS = ['Natural', 'Warm', 'Cool', 'Mono', 'Film'];
const MAX_SIDE = 2048;

export class PhotoMode {
  /**
   * @param {object} o
   * @param {import('./pipeline.js').Pipeline} o.pipeline
   * @param {(active: boolean) => void} o.onToggle
   * @param {() => void} o.onShutter sound and flash cue
   * @param {(photo: {id: string}) => void} o.onSaved
   * @param {() => void} o.openAlbum
   */
  constructor(o) {
    Object.assign(this, o);
    this.active = false;
    this.look = 0;
    this.tilt = true;
    this.wantsCapture = false;
    this.busy = false;
    this.hud = document.createElement('div');
    this.hud.id = 'photo-hud';
    this.hud.hidden = true;
    this.flash = document.createElement('div');
    this.flash.className = 'photo-flash';
    document.body.append(this.hud, this.flash);
    this.hud.addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (!b) return;
      if (b.dataset.look != null) this.setLook(Number(b.dataset.look));
      if (b.hasAttribute('data-tilt')) {
        this.tilt = !this.tilt;
        this.render();
      }
      if (b.hasAttribute('data-shoot')) this.shoot();
      if (b.hasAttribute('data-album')) this.openAlbum();
      if (b.hasAttribute('data-exit')) this.exit();
    });
    addEventListener('keydown', (e) => {
      if (e.target.closest?.('input, textarea, select, dialog')) return;
      if (!this.active) {
        if ((e.key === 'p' || e.key === 'P') && !e.metaKey && !e.ctrlKey && !document.body.matches('.building, .mapping, .dressing')) this.enter();
        return;
      }
      if (/^[bm]$/i.test(e.key)) {
        e.stopImmediatePropagation(); // no build mode or map while taking photos
        return;
      }
      if (e.key === 'Escape' || e.key === 'p' || e.key === 'P') {
        e.stopImmediatePropagation();
        this.exit();
      } else if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        e.stopImmediatePropagation();
        this.shoot();
      } else if (/^[1-5]$/.test(e.key)) this.setLook(Number(e.key) - 1);
      else if (e.key === 't' || e.key === 'T') {
        this.tilt = !this.tilt;
        this.render();
      }
    }, true);
  }

  enter() {
    if (this.active) return;
    this.active = true;
    document.body.classList.add('photo');
    this.hud.hidden = false;
    this.setLook(this.look);
    this.onToggle(true);
  }

  exit() {
    if (!this.active) return;
    this.active = false;
    document.body.classList.remove('photo');
    this.hud.hidden = true;
    this.pipeline.setLook({});
    this.onToggle(false);
  }

  setLook(i) {
    this.look = i;
    this.pipeline.setLook({ look: i, vignette: 0.5 });
    this.render();
  }

  render() {
    const tiltAvailable = !!this.pipeline.tilt;
    this.hud.innerHTML = `
      <div class="photo-bar glass">
        <div class="photo-looks" role="group" aria-label="Look">${LOOKS.map((l, i) => `<button class="chip-btn${i === this.look ? ' on' : ''}" data-look="${i}" title="${l} (${i + 1})">${l}</button>`).join('')}</div>
        ${tiltAvailable ? `<button class="chip-btn${this.tilt ? ' on' : ''}" data-tilt title="Miniature blur (T)">Tilt-shift</button>` : ''}
        <button class="shutter" data-shoot aria-label="Take photo (Space)">${icon('camera')}</button>
        <button class="chip-btn" data-album>${icon('images')} Album</button>
        <button class="icon-btn" data-exit aria-label="Exit photo mode (Esc)">${icon('x')}</button>
      </div>
      <p class="photo-hint">Drag to move · right-drag to orbit · scroll to zoom · Space takes a photo · 1–5 change the look · Esc exits</p>`;
  }

  shoot() {
    if (this.busy) return;
    this.wantsCapture = true;
  }

  /** Called right after the frame renders, while the drawing buffer still holds the image. */
  capture(canvas) {
    this.wantsCapture = false;
    this.busy = true;
    const k = Math.min(1, MAX_SIDE / Math.max(canvas.width, canvas.height));
    const out = document.createElement('canvas');
    out.width = Math.round(canvas.width * k);
    out.height = Math.round(canvas.height * k);
    out.getContext('2d').drawImage(canvas, 0, 0, out.width, out.height);
    this.flash.classList.remove('go');
    void this.flash.offsetWidth;
    this.flash.classList.add('go');
    this.onShutter();
    out.toBlob(async (blob) => {
      try {
        const res = await fetch('/api/photos', { method: 'POST', headers: { 'content-type': 'image/jpeg' }, body: blob });
        const body = await res.json().catch(() => ({}));
        if (res.status === 404) throw new Error('Saving photos needs the updated bridge: restart `npm run dev`.');
        if (!res.ok) throw new Error(body.error || "Couldn't save the photo.");
        this.onSaved(body.photo);
      } catch (err) {
        this.onError?.(err.message);
      } finally {
        this.busy = false;
      }
    }, 'image/jpeg', 0.9);
  }
}

/** The album: browse photos, hang them on a home's wall, download or delete them. */
export class Album {
  /**
   * @param {object} o
   * @param {() => object} o.style
   * @param {() => {project: string, name: string}[]} o.homes
   * @param {(change: object) => Promise<void>} o.save
   */
  constructor(o) {
    Object.assign(this, o);
    this.photos = [];
    this.viewing = null;
    this.confirmDelete = false;
    this.error = '';
    this.dialog = document.createElement('dialog');
    this.dialog.className = 'album glass';
    document.body.append(this.dialog);
    this.dialog.addEventListener('click', (e) => this.onClick(e));
    this.dialog.addEventListener('change', (e) => {
      if (e.target.name === 'hang' && e.target.value) this.hang(e.target.value);
    });
  }

  setPhotos(photos) {
    this.photos = photos || [];
    if (this.viewing && !this.photos.some((p) => p.id === this.viewing)) this.viewing = null;
    if (this.dialog.open) this.render();
  }

  open(id = null) {
    this.viewing = id;
    this.confirmDelete = false;
    this.error = '';
    this.render();
    if (!this.dialog.open) this.dialog.showModal();
  }

  /** Homes where a photo hangs. */
  hungIn(id) {
    return Object.entries(this.style().gallery || {}).filter(([, ids]) => ids.includes(id)).map(([home]) => home);
  }

  render() {
    const homes = this.homes();
    const name = (project) => homes.find((h) => h.project === project)?.name || project.split('/').pop();
    let body;
    if (this.viewing) {
      const p = this.photos.find((x) => x.id === this.viewing);
      const hung = this.hungIn(p.id);
      const when = new Date(p.at);
      body = `<div class="album-view">
          <img src="/api/photos/${esc(p.id)}.jpg" alt="Photo taken ${esc(when.toLocaleString())}" />
          <div class="album-actions">
            <small>${esc(when.toLocaleString())}${hung.length ? ` · on the wall in ${hung.map((h) => `<b>${esc(name(h))}</b>`).join(', ')}` : ''}</small>
            <label class="hang">${icon('house')} <select name="hang" aria-label="Hang in a home">
              <option value="">Hang on a wall…</option>
              ${homes.map((h) => {
                const n = (this.style().gallery?.[h.project] || []).length;
                const here = hung.includes(h.project);
                return `<option value="${esc(h.project)}">${here ? 'Take down from' : 'Hang in'} ${esc(h.name)}${here ? '' : ` (${n}/${MAX_GALLERY}${n >= MAX_GALLERY ? ', replaces the oldest' : ''})`}</option>`;
              }).join('')}
            </select></label>
            <a class="chip-btn" href="/api/photos/${esc(p.id)}.jpg" download="agent-world-${esc(p.at.slice(0, 10))}.jpg">Download</a>
            ${this.confirmDelete
              ? `<span class="confirm">Delete this photo for good? <button class="danger" data-delete-yes>Delete</button><button data-delete-no>Keep</button></span>`
              : `<button class="link-btn" data-delete>${icon('trash')} Delete</button>`}
          </div>
          ${this.error ? `<p class="form-error">${esc(this.error)}</p>` : ''}
        </div>`;
    } else {
      body = this.photos.length
        ? `<div class="album-grid">${this.photos.map((p) => `<button class="album-thumb${this.hungIn(p.id).length ? ' hung' : ''}" data-view="${esc(p.id)}" aria-label="Open photo from ${esc(new Date(p.at).toLocaleString())}">
            <img loading="lazy" src="/api/photos/${esc(p.id)}.jpg" alt="" /></button>`).join('')}</div>`
        : `<p class="empty-note">No photos yet. Press <kbd>P</kbd>, frame a shot, then <kbd>Space</kbd>.</p>`;
    }
    const n = this.photos.length;
    this.dialog.classList.toggle('empty', !n && !this.viewing);
    this.dialog.innerHTML = `<header class="panel-head">${this.viewing ? `<button class="icon-btn" data-back aria-label="Back to all photos">${icon('arrowLeft')}</button>` : `<span class="panel-icon photo">${icon('images')}</span>`}
        <div><h2>Album</h2><small>${n ? `${n} photo${n === 1 ? '' : 's'}` : 'Your neighborhood snapshots'}</small></div>
        <button class="icon-btn" data-close aria-label="Close">${icon('x')}</button></header>${body}`;
  }

  async onClick(e) {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.hasAttribute('data-close')) return this.dialog.close();
    if (b.hasAttribute('data-back')) return this.open(null);
    if (b.dataset.view) return this.open(b.dataset.view);
    if (b.hasAttribute('data-delete')) {
      this.confirmDelete = true;
      return this.render();
    }
    if (b.hasAttribute('data-delete-no')) {
      this.confirmDelete = false;
      return this.render();
    }
    if (b.hasAttribute('data-delete-yes')) {
      try {
        const res = await fetch('/api/photo-delete', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id: this.viewing }) });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(body.error || "Couldn't delete the photo.");
        this.photos = this.photos.filter((p) => p.id !== this.viewing);
        this.open(null);
      } catch (err) {
        this.error = err.message;
        this.render();
      }
    }
  }

  async hang(project) {
    const id = this.viewing;
    const current = this.style().gallery?.[project] || [];
    const next = current.includes(id) ? current.filter((x) => x !== id) : [...current, id].slice(-MAX_GALLERY);
    try {
      await this.save({ kind: 'gallery', key: project, value: next });
      this.error = '';
    } catch (err) {
      this.error = err.message;
    }
    this.render();
  }
}

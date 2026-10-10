// You, the player: a picture, not a character in the world. The top-bar badge shows a live 3D bust
// (breathing, blinking) built from your wardrobe look; clicking it opens the wardrobe. It only observes.

import { AvatarPortrait } from './avatar-portrait.js';

const hexNum = (v) => (typeof v === 'string' && v.startsWith('#') ? parseInt(v.slice(1), 16) : v);

export class Player {
  constructor({ onOpen }) {
    this.baseLook = { skin: 0xeebd98, hair: 0x4a2f1d, shirt: 0x5b6cf9, pants: 0x2f3747, shoes: 0xf4f1ea, hairStyle: 0, top: 'hoodie', accessory: 'headphones', build: 1.02 };
    this.look = this.baseLook;
    this.lookKey = null;
    this.el = document.createElement('button');
    this.el.id = 'player-badge';
    this.el.className = 'chip glass';
    this.el.title = 'You · change your look';
    this.el.setAttribute('aria-label', 'You: change your look');
    this.el.addEventListener('click', () => onOpen());
    document.querySelector('#topbar .brand')?.after(this.el);
    this.badge = new AvatarPortrait({ look: () => this.look, mode: 'bust', persistent: true });
    this.preview = new AvatarPortrait({ look: () => this.look, mode: 'waist', persistent: true });
    this.el.innerHTML = '<span class="player-pic"></span><span class="player-name">You</span><span class="player-level" hidden></span>';
    this.el.querySelector('.player-pic').append(this.badge.canvas);
    this.setLook({});
  }

  /** Wardrobe overrides (hex strings from shared/style.mjs) on top of the default look. */
  setLook(overrides) {
    const key = JSON.stringify(overrides || {});
    if (key === this.lookKey) return;
    this.lookKey = key;
    const look = { ...this.baseLook };
    for (const [k, v] of Object.entries(overrides || {})) look[k] = hexNum(v);
    this.look = look; // the portraits pick it up on their next frame
    this.onChange?.(look);
  }

  /** Your participation level, shown as a small number on the button. */
  setLevel(level) {
    const el = this.el.querySelector('.player-level');
    el.hidden = !level;
    el.textContent = `Lv ${level}`;
    this.el.title = `You · level ${level} · change your look`;
    this.el.setAttribute('aria-label', `You, level ${level}: change your look`);
  }

  /** Slot for the large live 3D preview in the wardrobe (filled by mountPreview after render). */
  previewHtml() {
    return '<div class="player-preview" data-preview></div>';
  }

  mountPreview(slot) {
    slot?.append(this.preview.canvas);
  }
}

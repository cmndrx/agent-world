// Live computer screens. Each Screen owns a canvas used as a monitor (or laptop) texture.
//
// Honesty rule: real text on screen is always truth from the agent (file names, commands, domains,
// queries, tool names, project, provider, local time). Everything else (code, terminal output,
// web pages) is drawn as abstract bars, so nothing invented reads as a fact.

import * as THREE from 'three';
import { activityKey } from './activity.js';

const W = 512;
const H = 320;
const FONT = "'Nunito Variable', ui-rounded, system-ui, sans-serif";
const MONO = "ui-monospace, 'SF Mono', Menlo, monospace";

const THEME = {
  bg: '#232a3c',
  panel: '#2b3247',
  panel2: '#343c55',
  line: '#3e4762',
  text: '#e6e9f2',
  dim: '#8a93ab',
  faint: '#4a5270',
  accent: '#7aa2ff',
  green: '#4ade80',
  red: '#f87171',
  yellow: '#facc15',
  syntax: ['#7fd3ff', '#c792ea', '#ffcb6b', '#89ddff', '#c3e88d', '#f78c6c', '#a6accd'],
};

/** Light-spill tint per app (a bright browser glows white, a terminal greenish…). */
const GLOW = {
  browser: '#ffffff', websearch: '#ffffff', terminal: '#7dffb0', error: '#ff6b6b', dialog: '#ffd166',
  yourturn: '#ffd166', question: '#ffd166', idle: '#b48cff', editor: '#7aa2ff', reader: '#7aa2ff',
};

const PROVIDER = {
  anthropic: { name: 'Claude', color: '#d97757' },
  openai: { name: 'Codex', color: '#10a37f' },
};

/** Seeded PRNG so abstract content is stable for a given activity. */
function seeded(seed) {
  let s = seed >>> 0 || 7;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return ((s >>> 0) % 10000) / 10000;
  };
}
function hash(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619);
  return h >>> 0;
}

export class Screen {
  /** @param {{scale?: number}} opts scale 1 = monitor (512×320), 0.5 = laptop */
  constructor({ scale = 1 } = {}) {
    this.scale = scale;
    this.canvas = document.createElement('canvas');
    this.canvas.width = W * scale;
    this.canvas.height = H * scale;
    this.ctx = this.canvas.getContext('2d');
    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.texture.anisotropy = 4;
    this.material = new THREE.MeshBasicMaterial({ map: this.texture, toneMapped: false });
    this.material.color.setScalar(1.12);
    /** Optional light-spill mesh on the desk, tinted by the app (set by the lot). */
    this.glow = null;
    this.activity = { app: 'off' };
    this.key = '';
    this.t0 = 0;
    this.lastDraw = -1;
    this.meta = {};
    this.draw(0);
  }

  /**
   * @param {object} activity from resolveActivity()
   * @param {{project?: string, provider?: string, source?: string}} meta
   */
  set(activity, meta = {}) {
    const key = activityKey(activity) + '|' + (meta.conversation || '');
    this.meta = meta;
    if (key !== this.key) {
      this.key = key;
      this.activity = activity;
      this.t0 = performance.now() / 1000;
      this.rand = seeded(hash(key));
      this.seed = hash(key);
      this.lastDraw = -1;
      if (this.glow) {
        this.glow.visible = activity.app !== 'off';
        this.glow.material.color.set(GLOW[activity.app] || '#7aa2ff');
      }
    }
  }

  get on() {
    return this.activity.app !== 'off';
  }

  /** Redraw at ~12 fps (screens don't need more), always on the first frame of a new activity. */
  update(now) {
    if (this.lastDraw >= 0 && now - this.lastDraw < 1 / 12) return;
    this.lastDraw = now;
    this.draw(now - this.t0);
    this.texture.needsUpdate = true;
  }

  // ---- Drawing ---------------------------------------------------------------------------

  draw(e) {
    const g = this.ctx;
    g.save();
    g.scale(this.scale, this.scale);
    g.clearRect(0, 0, W, H);
    const a = this.activity;
    const fn = this[`app_${a.app}`] || this.app_chat;
    fn.call(this, g, e, a);
    if (a.app !== 'off' && a.app !== 'idle') {
      this.badge(g);
      if (this.meta.conversation) {
        this.rect(g, 0, H - 22, W, 22, THEME.panel);
        this.text(g, this.meta.conversation, 12, H - 11, { size: 11, color: THEME.text, max: W - 24 });
      }
    }
    g.restore();
  }

  // Primitives
  rect(g, x, y, w, h, color, r = 0) {
    g.fillStyle = color;
    if (!r) return g.fillRect(x, y, w, h);
    g.beginPath();
    g.roundRect(x, y, w, h, r);
    g.fill();
  }
  text(g, str, x, y, { size = 12, color = THEME.text, weight = 700, font = FONT, align = 'left', max } = {}) {
    g.font = `${weight} ${size}px ${font}`;
    g.fillStyle = color;
    g.textAlign = align;
    g.textBaseline = 'middle';
    let s = String(str ?? '');
    if (max) while (s.length > 1 && g.measureText(s).width > max) s = s.slice(0, -2) + '…';
    g.fillText(s, x, y);
    return g.measureText(s).width;
  }
  /** Abstract code/text lines: deterministic widths, syntax-ish colors. */
  bars(g, x, y, w, rows, { lh = 13, seed = 1, colors = THEME.syntax, alpha = 0.85, indent = true, h = 5 } = {}) {
    const r = seeded(seed);
    let ind = 0;
    for (let i = 0; i < rows; i++) {
      if (indent) {
        if (r() < 0.18) ind = Math.max(0, ind - 1);
        else if (r() < 0.2) ind = Math.min(4, ind + 1);
      }
      let cx = x + ind * 14;
      const tokens = 1 + Math.floor(r() * 4);
      for (let k = 0; k < tokens && cx < x + w - 10; k++) {
        const tw = Math.min(12 + r() * 60, x + w - cx);
        g.globalAlpha = alpha;
        this.rect(g, cx, y + i * lh, tw, h, colors[Math.floor(r() * colors.length)], 2);
        cx += tw + 6;
      }
      if (r() < 0.12) i++; // blank line
    }
    g.globalAlpha = 1;
  }
  window(g, title, { accent = THEME.accent, bg = THEME.bg } = {}) {
    this.rect(g, 0, 0, W, H, bg);
    this.rect(g, 0, 0, W, 24, THEME.panel);
    for (const [i, c] of ['#ff5f57', '#febc2e', '#28c840'].entries()) {
      g.fillStyle = c;
      g.beginPath();
      g.arc(14 + i * 15, 12, 4.5, 0, Math.PI * 2);
      g.fill();
    }
    this.text(g, title, W / 2, 12, { size: 11, color: THEME.dim, align: 'center', max: 300 });
    this.rect(g, 0, 23, W, 1, accent);
  }
  spinner(g, x, y, r, e, color = THEME.accent) {
    g.strokeStyle = color;
    g.lineWidth = 2.5;
    g.lineCap = 'round';
    g.beginPath();
    g.arc(x, y, r, e * 6, e * 6 + Math.PI * 1.4);
    g.stroke();
  }
  cursor(g, x, y, click) {
    g.fillStyle = '#fff';
    g.strokeStyle = '#000';
    g.lineWidth = 1;
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x, y + 14);
    g.lineTo(x + 4, y + 10);
    g.lineTo(x + 9, y + 12);
    g.closePath();
    g.fill();
    g.stroke();
    if (click) {
      g.strokeStyle = 'rgba(255,255,255,0.7)';
      g.beginPath();
      g.arc(x, y, 6 + click * 8, 0, Math.PI * 2);
      g.stroke();
    }
  }
  /** Typewriter: how much of `s` is typed after `e` seconds over `dur`. */
  typed(s, e, dur) {
    const n = Math.floor((Math.min(e, dur) / dur) * s.length);
    return s.slice(0, n);
  }
  badge(g) {
    const p = (this.meta.source === 'chatgpt' ? { name: 'ChatGPT', color: '#10a37f' } : PROVIDER[this.meta.provider]);
    if (!p) return;
    const w = this.text(g, p.name, -100, -100, { size: 10 }) + 18;
    this.rect(g, W - w - 8, H - 22, w, 16, 'rgba(0,0,0,0.45)', 8);
    this.rect(g, W - w - 2, H - 17, 6, 6, p.color, 3);
    this.text(g, p.name, W - w + 8, H - 14, { size: 10, color: '#fff' });
  }
  sidebarFiles(g, x, y, w, rows, highlight, seed) {
    this.rect(g, x, y, w, H - y, THEME.panel);
    const r = seeded(seed);
    for (let i = 0; i < rows; i++) {
      const yy = y + 12 + i * 15;
      const depth = Math.floor(r() * 3);
      if (i === 3 && highlight) {
        this.rect(g, x, yy - 7, w, 14, 'rgba(122,162,255,0.22)');
        this.text(g, highlight, x + 10 + depth * 8, yy, { size: 10, color: THEME.text, max: w - 16 - depth * 8 });
      } else {
        this.rect(g, x + 10 + depth * 8, yy - 2, 30 + r() * 40, 4, THEME.faint, 2);
      }
    }
  }

  // ---- Apps ------------------------------------------------------------------------------

  app_off(g) {
    const grad = g.createLinearGradient(0, 0, W, H);
    grad.addColorStop(0, '#0b0d12');
    grad.addColorStop(1, '#151923');
    g.fillStyle = grad;
    g.fillRect(0, 0, W, H);
    g.fillStyle = 'rgba(255,255,255,0.04)';
    g.beginPath();
    g.moveTo(0, 0);
    g.lineTo(W * 0.45, 0);
    g.lineTo(W * 0.2, H);
    g.lineTo(0, H);
    g.fill();
  }

  app_idle(g) {
    const grad = g.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, '#24315e');
    grad.addColorStop(1, '#5a3d6e');
    g.fillStyle = grad;
    g.fillRect(0, 0, W, H);
    const now = new Date();
    this.text(g, now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), W / 2, H / 2 - 18, { size: 64, weight: 300, align: 'center' });
    this.text(g, this.meta.project || '', W / 2, H / 2 + 34, { size: 15, color: 'rgba(255,255,255,0.75)', align: 'center', max: 400 });
    this.text(g, 'Idle', W / 2, H / 2 + 58, { size: 12, color: 'rgba(255,255,255,0.5)', align: 'center' });
  }

  app_editor(g, e, a) {
    const lang = a.lang || { color: THEME.accent, name: 'Text' };
    this.window(g, `${a.title} — ${this.meta.project || ''}`, { accent: lang.color });
    this.sidebarFiles(g, 0, 24, 112, 18, a.title, this.seed);
    // Tab with the real file name.
    this.rect(g, 112, 24, W - 112, 22, THEME.panel2);
    const tw = this.text(g, a.title, -100, -100, { size: 11 }) + 30;
    this.rect(g, 112, 24, tw, 22, THEME.bg);
    this.rect(g, 112, 44, tw, 2, lang.color);
    this.rect(g, 120, 32, 7, 7, lang.color, 2);
    this.text(g, a.title, 132, 35, { size: 11 });
    if (a.mode === 'new') {
      this.rect(g, 112 + tw + 6, 29, 30, 12, 'rgba(74,222,128,0.2)', 6);
      this.text(g, 'new', 112 + tw + 21, 35, { size: 9, color: THEME.green, align: 'center' });
    }

    // Code area: lines accumulate as the agent types; the view scrolls to keep the cursor visible.
    const top = 54;
    const lh = 13;
    const visible = Math.floor((H - top - 26) / lh);
    const typedLines = Math.floor(e * 2.2);
    const total = 10 + typedLines;
    const first = Math.max(0, total - visible);
    for (let i = 0; i < visible; i++) {
      const line = first + i;
      if (line >= total) break;
      const y = top + i * lh;
      this.text(g, String(line + 1), 146, y + 2, { size: 9, color: THEME.faint, font: MONO, align: 'right', weight: 400 });
      if (a.mode === 'diff') {
        const mark = (line * 7 + (this.seed % 11)) % 9;
        if (mark === 0) this.rect(g, 152, y - 4, W - 152, lh, 'rgba(248,113,113,0.13)');
        if (mark === 1 || mark === 2) this.rect(g, 152, y - 4, W - 152, lh, 'rgba(74,222,128,0.13)');
      }
      const isCursorLine = line === total - 1;
      const lineW = isCursorLine ? ((e * 2.2) % 1) * 200 : 260;
      this.bars(g, 160, y, Math.max(8, lineW), 1, { seed: (this.seed + line * 131) >>> 0, indent: false });
      if (isCursorLine && Math.floor(e * 3) % 2 === 0) this.rect(g, 160 + Math.max(8, lineW) + 2, y - 4, 2, 11, '#fff');
    }
    // Status bar with the language (derived from the real file name).
    this.rect(g, 112, H - 18, W - 112, 18, lang.color);
    this.text(g, lang.name, 122, H - 9, { size: 10, color: '#fff' });
    this.text(g, a.mode === 'new' ? 'Writing' : 'Editing', 200, H - 9, { size: 10, color: 'rgba(255,255,255,0.85)' });
  }

  app_reader(g, e, a) {
    const lang = a.lang || { color: THEME.accent, name: 'Text' };
    this.window(g, `${a.title} — ${this.meta.project || ''}`, { accent: lang.color });
    this.sidebarFiles(g, 0, 24, 112, 18, a.title, this.seed);
    this.rect(g, 112, 24, W - 112, 22, THEME.panel2);
    const tw = this.text(g, a.title, -100, -100, { size: 11 }) + 30;
    this.rect(g, 112, 24, tw, 22, THEME.bg);
    this.rect(g, 120, 32, 7, 7, lang.color, 2);
    this.text(g, a.title, 132, 35, { size: 11 });
    // Scrolling read-only view with a reading highlight sweeping down.
    const lh = 13;
    const scroll = (e * 9) % (lh * 40);
    g.save();
    g.beginPath();
    g.rect(112, 48, W - 112, H - 66);
    g.clip();
    const hl = 60 + ((e * 40) % (H - 90));
    this.rect(g, 112, hl, W - 112, lh * 2, 'rgba(122,162,255,0.12)');
    for (let i = 0; i < 24; i++) {
      const y = 56 + i * lh - (scroll % lh);
      const line = i + Math.floor(scroll / lh);
      this.text(g, String(line + 1), 146, y + 2, { size: 9, color: THEME.faint, font: MONO, align: 'right', weight: 400 });
      this.bars(g, 160, y, 300, 1, { seed: (this.seed + line * 97) >>> 0, indent: false, alpha: 0.7 });
    }
    g.restore();
    this.rect(g, 112, H - 18, W - 112, 18, THEME.panel);
    this.text(g, `Reading · ${lang.name}`, 122, H - 9, { size: 10, color: THEME.dim });
  }

  app_search(g, e, a) {
    this.window(g, `Search — ${this.meta.project || ''}`);
    this.rect(g, 0, 24, 200, H - 24, THEME.panel);
    this.text(g, a.tool === 'Glob' ? 'FIND FILES' : 'SEARCH', 12, 40, { size: 10, color: THEME.dim, weight: 800 });
    this.rect(g, 10, 52, 180, 24, THEME.bg, 5);
    this.rect(g, 10, 52, 180, 24, 'rgba(122,162,255,0.25)', 5);
    const q = a.query ? this.typed(a.query, e, 0.9) : '';
    const qw = q ? this.text(g, q, 18, 64, { size: 11, font: MONO, weight: 500, max: 160 }) : 0;
    if (!q) this.rect(g, 18, 62, 60, 4, THEME.faint, 2);
    if (e < 1.2 && Math.floor(e * 3) % 2 === 0) this.rect(g, 19 + qw, 57, 2, 14, '#fff');
    // Results appear progressively (abstract file names + match lines).
    const shown = Math.min(8, Math.floor(Math.max(0, e - 0.9) * 5));
    const r = seeded(this.seed);
    let y = 92;
    for (let i = 0; i < shown; i++) {
      this.rect(g, 14, y, 8, 8, THEME.syntax[i % THEME.syntax.length], 2);
      this.rect(g, 28, y + 2, 50 + r() * 70, 5, THEME.text, 2);
      for (let k = 0; k < 2; k++) {
        this.rect(g, 28, y + 14 + k * 10, 20 + r() * 40, 4, THEME.faint, 2);
        this.rect(g, 52 + r() * 40, y + 14 + k * 10, 24, 4, THEME.yellow, 2);
      }
      y += 38;
    }
    if (shown < 8) this.spinner(g, 100, Math.min(y + 14, H - 20), 7, e);
    // Preview pane
    this.bars(g, 214, 40, 280, 18, { seed: this.seed, alpha: 0.55 });
    this.rect(g, 210, 40 + 13 * 5 - 4, W - 210, 13, 'rgba(250,204,21,0.15)');
  }

  app_files(g, e) {
    this.window(g, `Files — ${this.meta.project || ''}`);
    const r = seeded(this.seed);
    for (let i = 0; i < 16; i++) {
      const y = 40 + i * 16;
      const depth = Math.floor(r() * 3);
      const folder = r() < 0.35;
      this.rect(g, 16 + depth * 14, y - 5, 10, 9, folder ? '#e8c547' : THEME.dim, 2);
      this.rect(g, 32 + depth * 14, y - 2, 40 + r() * 90, 5, folder ? THEME.text : THEME.faint, 2);
    }
    const sel = Math.floor(e * 1.5) % 16;
    this.rect(g, 0, 40 + sel * 16 - 8, W, 16, 'rgba(122,162,255,0.15)');
  }

  app_image(g, e, a) {
    this.window(g, a.title);
    this.rect(g, 40, 40, W - 80, H - 70, '#8ec5ff', 6);
    g.fillStyle = '#5aa364';
    g.beginPath();
    g.moveTo(40, H - 30);
    g.lineTo(180, 140);
    g.lineTo(260, 210);
    g.lineTo(340, 120);
    g.lineTo(W - 40, H - 30);
    g.fill();
    g.fillStyle = '#ffe28a';
    g.beginPath();
    g.arc(390, 90, 22, 0, Math.PI * 2);
    g.fill();
  }

  app_notebook(g, e, a) {
    this.window(g, `${a.title} — ${this.meta.project || ''}`, { accent: '#f37626' });
    for (let i = 0; i < 4; i++) {
      const y = 36 + i * 70;
      this.rect(g, 40, y, W - 70, 34, THEME.panel2, 5);
      this.text(g, '[ ]', 22, y + 17, { size: 10, color: THEME.faint, font: MONO });
      this.bars(g, 50, y + 8, 300, 2, { seed: this.seed + i, indent: false });
      this.rect(g, 40, y + 40, 160 + i * 30, 18, 'rgba(255,255,255,0.05)', 3);
    }
    const active = Math.floor(e) % 4;
    this.rect(g, 36, 36 + active * 70, 3, 34, '#f37626');
  }

  app_terminal(g, e, a) {
    this.rect(g, 0, 0, W, H, '#0f1218');
    this.rect(g, 0, 0, W, 24, '#1a1e28');
    for (const [i, c] of ['#ff5f57', '#febc2e', '#28c840'].entries()) {
      g.fillStyle = c;
      g.beginPath();
      g.arc(14 + i * 15, 12, 4.5, 0, Math.PI * 2);
      g.fill();
    }
    this.text(g, `zsh — ${this.meta.project || ''}`, W / 2, 12, { size: 11, color: THEME.dim, align: 'center', max: 300 });
    // Prompt + the real command, typed during the lead-in.
    const lead = 1.2;
    const cmd = a.command || '';
    const shown = this.typed(cmd, e, lead);
    let x = 12;
    x += this.text(g, '➜ ', x, 40, { size: 12, color: THEME.green, font: MONO });
    x += this.text(g, `${this.meta.project || '~'} `, x, 40, { size: 12, color: '#7fd3ff', font: MONO, max: 140 });
    x += this.text(g, shown, x, 40, { size: 12, color: THEME.text, font: MONO, weight: 600, max: W - x - 20 });
    if (e < lead + 0.3 && Math.floor(e * 3) % 2 === 0) this.rect(g, x + 2, 33, 7, 14, '#fff');
    if (e < lead) return;

    const t = e - lead;
    const kind = a.kind || 'generic';
    // A truthful heading derived from the command (not from its output).
    const heading = {
      test: 'running tests',
      install: 'installing',
      build: 'building',
      server: 'running',
      git: 'git',
      deploy: 'shipping',
      lint: 'checking',
      docker: 'containers',
      read: 'output',
    }[kind] || 'running';
    this.spinner(g, 18, 62, 5, t, THEME.yellow);
    this.text(g, `${heading}…`, 30, 62, { size: 11, color: THEME.yellow, font: MONO, weight: 600 });

    const r = seeded(this.seed);
    const top = 82;
    if (kind === 'install') {
      // Indeterminate progress (we don't know how far along it really is).
      this.rect(g, 14, top, W - 28, 8, '#232838', 4);
      const p = (t * 0.6) % 1.4 - 0.2;
      this.rect(g, 14 + Math.max(0, p) * (W - 28), top, Math.min(120, (W - 28) * (1 - Math.max(0, p))), 8, THEME.accent, 4);
    }
    if (kind === 'git') {
      for (let i = 0; i < 6; i++) {
        const y = top + 8 + i * 22;
        g.strokeStyle = THEME.syntax[i % 4];
        g.lineWidth = 2;
        g.beginPath();
        g.moveTo(22, y - 22);
        g.lineTo(22, y);
        g.stroke();
        g.fillStyle = THEME.syntax[i % 4];
        g.beginPath();
        g.arc(22, y, 4, 0, Math.PI * 2);
        g.fill();
        this.rect(g, 36, y - 2, 40, 4, '#e8c547', 2);
        this.rect(g, 82, y - 2, 80 + r() * 200, 4, THEME.dim, 2);
      }
      return;
    }
    // Streaming output lines (abstract), newest at the bottom.
    const lh = 12;
    const rows = Math.floor((H - top - 20) / lh);
    const produced = Math.floor(t * (kind === 'server' ? 4 : kind === 'read' ? 30 : 7));
    const start = Math.max(0, produced - rows);
    for (let i = 0; i < Math.min(rows, produced); i++) {
      const line = start + i;
      const rr = seeded((this.seed + line * 53) >>> 0);
      const y = top + (kind === 'install' ? 20 : 0) + i * lh;
      if (kind === 'test') {
        this.rect(g, 14, y, 6, 6, '#3d4560', 3); // neutral bullets: results are unknown
        this.rect(g, 26, y + 1, 60 + rr() * 220, 4, THEME.dim, 2);
      } else if (kind === 'server') {
        this.rect(g, 14, y + 1, 44, 4, '#3d4560', 2);
        this.rect(g, 64, y + 1, 50 + rr() * 260, 4, THEME.dim, 2);
      } else {
        this.rect(g, 14 + (rr() < 0.3 ? 14 : 0), y + 1, 40 + rr() * 300, 4, rr() < 0.15 ? '#7fd3ff' : THEME.dim, 2);
      }
    }
  }

  app_browser(g, e, a) {
    this.rect(g, 0, 0, W, H, '#f6f7fb');
    this.rect(g, 0, 0, W, 50, '#e7e9f0');
    for (const [i, c] of ['#ff5f57', '#febc2e', '#28c840'].entries()) {
      g.fillStyle = c;
      g.beginPath();
      g.arc(14 + i * 15, 12, 4.5, 0, Math.PI * 2);
      g.fill();
    }
    // Tab + address bar with the real domain (or the browser action, e.g. "navigate").
    const host = a.domain || a.action || 'about:blank';
    this.rect(g, 64, 3, 170, 20, '#f6f7fb', 6);
    const fav = `hsl(${hash(host) % 360} 65% 55%)`;
    this.rect(g, 72, 9, 9, 9, fav, 2);
    this.text(g, host, 87, 13, { size: 10, color: '#3b4255', max: 140 });
    this.rect(g, 12, 27, W - 24, 18, '#ffffff', 9);
    this.text(g, a.domain ? '🔒' : '◎', 22, 36, { size: 9, color: '#6b7280' });
    const url = this.typed(host, e, 0.8);
    this.text(g, url, 36, 36, { size: 11, color: '#1f2937', weight: 600, max: W - 70 });
    if (e < 1.6) {
      this.rect(g, 0, 49, W * Math.min(1, (e - 0.8) / 0.8), 2, '#5b6cf9'); // page loading
      if (e < 1.0) return;
    }
    // Page (abstract)
    const r = seeded(this.seed);
    const scroll = Math.max(0, e - 2) * 8;
    g.save();
    g.beginPath();
    g.rect(0, 51, W, H - 51);
    g.clip();
    g.translate(0, -(scroll % 200));
    this.rect(g, 0, 51, W, 34, `hsl(${hash(host) % 360} 45% 30%)`);
    this.rect(g, 20, 64, 70, 8, 'rgba(255,255,255,0.85)', 4);
    for (let k = 0; k < 4; k++) this.rect(g, 300 + k * 50, 66, 36, 5, 'rgba(255,255,255,0.5)', 3);
    for (let block = 0; block < 4; block++) {
      const y = 100 + block * 110;
      this.rect(g, 24, y, 160 + r() * 140, 12, '#1f2937', 4);
      for (let l = 0; l < 4; l++) this.rect(g, 24, y + 24 + l * 11, 260 + r() * 140, 5, '#9ca3af', 3);
      this.rect(g, W - 150, y, 126, 76, `hsl(${(hash(host) + block * 40) % 360} 50% 80%)`, 6);
    }
    g.restore();
    // Mouse cursor wandering and clicking (synced with the Sim's mouse hand).
    const cx = 160 + Math.sin(e * 0.9) * 140;
    const cy = 170 + Math.cos(e * 0.7) * 70;
    const click = (e % 2.6) < 0.25 ? (e % 2.6) / 0.25 : 0;
    this.cursor(g, cx, cy, click);
  }

  app_websearch(g, e, a) {
    this.rect(g, 0, 0, W, H, '#ffffff');
    this.rect(g, 0, 0, W, 24, '#eef0f5');
    for (const [i, c] of ['#ff5f57', '#febc2e', '#28c840'].entries()) {
      g.fillStyle = c;
      g.beginPath();
      g.arc(14 + i * 15, 12, 4.5, 0, Math.PI * 2);
      g.fill();
    }
    this.text(g, 'Web search', W / 2, 12, { size: 11, color: '#6b7280', align: 'center' });
    // Search box with the real query when the privacy level allows it.
    const searching = e > 1.2;
    const boxY = searching ? 36 : 120;
    const boxW = searching ? W - 40 : 360;
    const boxX = (W - boxW) / 2;
    if (!searching) {
      for (const [i, c] of ['#4285f4', '#ea4335', '#fbbc05', '#34a853'].entries()) this.rect(g, W / 2 - 60 + i * 32, 82, 26, 18, c, 9);
    }
    this.rect(g, boxX, boxY, boxW, 28, '#ffffff', 14);
    g.strokeStyle = '#d1d5db';
    g.lineWidth = 1.5;
    g.beginPath();
    g.roundRect(boxX, boxY, boxW, 28, 14);
    g.stroke();
    const q = a.query ? this.typed(a.query, e, 1.1) : '';
    if (q) this.text(g, q, boxX + 16, boxY + 14, { size: 12, color: '#111827', weight: 600, max: boxW - 30 });
    else for (let k = 0; k < Math.min(5, Math.floor(e * 4)); k++) this.rect(g, boxX + 16 + k * 22, boxY + 12, 16, 5, '#9ca3af', 3);
    if (!searching) return;
    // Results (abstract): titles in link blue, snippets in gray.
    const r = seeded(this.seed);
    const shown = Math.min(5, Math.floor((e - 1.2) * 4));
    for (let i = 0; i < shown; i++) {
      const y = 84 + i * 46;
      this.rect(g, 24, y, 8, 8, `hsl(${(this.seed + i * 70) % 360} 60% 55%)`, 4);
      this.rect(g, 38, y + 2, 60 + r() * 60, 4, '#6b7280', 2);
      this.rect(g, 24, y + 14, 180 + r() * 160, 7, '#1a56db', 3);
      this.rect(g, 24, y + 28, 300 + r() * 120, 4, '#9ca3af', 2);
    }
    const cx = 120 + Math.sin(e * 0.8) * 90;
    const cy = 110 + ((e * 20) % 170);
    this.cursor(g, cx, cy, (e % 3) < 0.25 ? (e % 3) / 0.25 : 0);
  }

  app_chat(g, e, a) {
    const p = (this.meta.source === 'chatgpt' ? { name: 'ChatGPT', color: '#10a37f' } : PROVIDER[this.meta.provider]) || { name: 'Agent', color: THEME.accent };
    this.window(g, `${p.name} — ${this.meta.project || ''}`, { accent: p.color });
    const r = seeded(this.seed);
    // Earlier conversation (abstract), then the model's current reasoning streaming in.
    this.rect(g, W - 230, 40, 210, 34, '#2f3650', 10);
    this.bars(g, W - 220, 50, 190, 2, { seed: this.seed, colors: ['#c9cfe0'], indent: false, lh: 10 });
    this.rect(g, 18, 88, 18, 18, p.color, 9);
    this.text(g, a.tool ? `Thinking about the ${a.tool} result` : 'Thinking', 44, 97, { size: 12, color: THEME.text });
    const rows = Math.min(9, Math.floor(e * 2.5));
    for (let i = 0; i < rows; i++) this.rect(g, 44, 116 + i * 14, 120 + r() * 300, 5, '#7c86a3', 3);
    const dots = Math.floor(e * 3) % 4;
    for (let k = 0; k < 3; k++) this.rect(g, 44 + k * 12, 122 + rows * 14, 7, 7, k < dots ? p.color : THEME.faint, 4);
  }

  app_plan(g, e) {
    const p = (this.meta.source === 'chatgpt' ? { name: 'ChatGPT', color: '#10a37f' } : PROVIDER[this.meta.provider]) || { color: THEME.accent };
    this.window(g, `Plan — ${this.meta.project || ''}`, { accent: p.color });
    this.text(g, 'Plan', 24, 46, { size: 15 });
    const r = seeded(this.seed);
    const focus = Math.floor(e * 0.8) % 6;
    for (let i = 0; i < 6; i++) {
      const y = 76 + i * 36;
      if (i === focus) this.rect(g, 14, y - 14, W - 28, 28, 'rgba(122,162,255,0.14)', 8);
      g.strokeStyle = THEME.dim;
      g.lineWidth = 2;
      g.beginPath();
      g.roundRect(24, y - 7, 14, 14, 4);
      g.stroke();
      this.rect(g, 50, y - 3, 120 + r() * 220, 6, i === focus ? THEME.text : THEME.dim, 3);
    }
  }

  app_tool(g, e, a) {
    this.window(g, a.title);
    this.rect(g, 0, 24, 140, H - 24, THEME.panel);
    this.rect(g, 16, 40, 40, 40, `hsl(${hash(a.title) % 360} 55% 55%)`, 10);
    this.text(g, a.title, 16, 96, { size: 12, max: 120 });
    for (let i = 0; i < 6; i++) this.rect(g, 16, 116 + i * 18, 70 + ((this.seed >> i) % 40), 5, THEME.faint, 3);
    for (let i = 0; i < 3; i++) {
      this.rect(g, 160, 40 + i * 64, W - 180, 52, THEME.panel2, 8);
      this.bars(g, 174, 54 + i * 64, 280, 2, { seed: this.seed + i, indent: false, colors: ['#9aa3bd'] });
    }
    this.spinner(g, W - 30, H - 30, 8, e);
  }

  app_delegate(g, e, a) {
    const p = (this.meta.source === 'chatgpt' ? { name: 'ChatGPT', color: '#10a37f' } : PROVIDER[this.meta.provider]) || { color: THEME.accent };
    this.window(g, `Sub-agent — ${this.meta.project || ''}`, { accent: p.color });
    this.rect(g, 30, 46, W - 60, 92, THEME.panel2, 12);
    this.rect(g, 48, 64, 56, 56, '#f2b134', 28);
    this.text(g, (a.role || 'H')[0].toUpperCase(), 76, 92, { size: 26, color: '#3d2a00', align: 'center', weight: 900 });
    this.text(g, a.role ? `${a.role} helper` : 'Helper', 122, 78, { size: 16 });
    this.text(g, 'Working on a delegated task', 122, 100, { size: 11, color: THEME.dim });
    this.spinner(g, W - 60, 92, 10, e, '#f2b134');
    const rows = Math.min(7, Math.floor(e * 2));
    for (let i = 0; i < rows; i++) {
      this.rect(g, 40, 160 + i * 18, 8, 8, THEME.faint, 4);
      this.rect(g, 56, 162 + i * 18, 100 + ((this.seed >> i) % 200), 5, THEME.dim, 3);
    }
  }

  app_dialog(g, e, a) {
    this.app_chat(g, 0, {});
    this.rect(g, 0, 0, W, H, 'rgba(8,10,16,0.55)');
    const pulse = 0.5 + 0.5 * Math.sin(e * 5);
    const bx = 86;
    const by = 70;
    const bw = W - 172;
    const bh = 170;
    g.shadowColor = `rgba(250,204,21,${0.35 + pulse * 0.35})`;
    g.shadowBlur = 24;
    this.rect(g, bx, by, bw, bh, '#262c3e', 14);
    g.shadowBlur = 0;
    this.rect(g, bx + 20, by + 22, 30, 30, THEME.yellow, 15);
    this.text(g, '!', bx + 35, by + 37, { size: 18, color: '#3d2a00', align: 'center', weight: 900 });
    this.text(g, a.tool ? `Allow ${a.tool}?` : 'Permission needed', bx + 62, by + 37, { size: 17, max: bw - 80 });
    this.text(g, `Approve or deny it in ${this.meta.app || 'your agent app'}.`, bx + 22, by + 76, { size: 12, color: THEME.dim, max: bw - 40 });
    this.rect(g, bx + bw - 200, by + bh - 48, 84, 30, '#343b52', 8);
    this.text(g, 'Deny', bx + bw - 158, by + bh - 33, { size: 12, align: 'center' });
    this.rect(g, bx + bw - 106, by + bh - 48, 84, 30, '#5b6cf9', 8);
    this.text(g, 'Allow', bx + bw - 64, by + bh - 33, { size: 12, align: 'center' });
  }

  app_yourturn(g, e) {
    const p = (this.meta.source === 'chatgpt' ? { name: 'ChatGPT', color: '#10a37f' } : PROVIDER[this.meta.provider]) || { name: 'Agent', color: THEME.accent };
    this.window(g, `${p.name} — ${this.meta.project || ''}`, { accent: p.color });
    this.rect(g, 18, 46, 18, 18, p.color, 9);
    this.bars(g, 44, 50, 400, 6, { seed: this.seed, colors: ['#a3abc4'], indent: false });
    this.rect(g, 18, 150, 24, 24, THEME.green, 12);
    this.text(g, '✓', 30, 162, { size: 14, color: '#06301a', align: 'center', weight: 900 });
    this.text(g, 'Turn complete', 52, 162, { size: 14 });
    // Composer, highlighted: it's your turn.
    const pulse = 0.5 + 0.5 * Math.sin(e * 4);
    this.rect(g, 18, H - 70, W - 36, 44, '#262c3e', 12);
    g.strokeStyle = `rgba(250,204,21,${0.5 + pulse * 0.5})`;
    g.lineWidth = 2;
    g.beginPath();
    g.roundRect(18, H - 70, W - 36, 44, 12);
    g.stroke();
    this.text(g, `Reply in ${this.meta.app || 'your agent app'} to continue…`, 34, H - 48, { size: 13, color: THEME.dim, weight: 600, max: W - 70 });
    if (Math.floor(e * 2) % 2 === 0) this.rect(g, 33, H - 57, 2, 18, '#fff');
  }

  app_question(g, e) {
    this.app_yourturn(g, e);
    this.rect(g, 14, 146, 220, 32, THEME.bg);
    this.rect(g, 18, 150, 24, 24, THEME.yellow, 12);
    this.text(g, '?', 30, 162, { size: 15, color: '#3d2a00', align: 'center', weight: 900 });
    this.text(g, 'A question for you', 52, 162, { size: 14 });
  }

  app_interrupted(g, e) {
    this.app_yourturn(g, e);
    this.rect(g, 14, 146, 220, 32, THEME.bg);
    this.rect(g, 18, 150, 24, 24, THEME.red, 12);
    this.text(g, '■', 30, 162, { size: 10, color: '#fff', align: 'center' });
    this.text(g, 'Interrupted', 52, 162, { size: 14 });
  }

  app_error(g, e, a) {
    this.rect(g, 0, 0, W, H, '#16090b');
    this.rect(g, 0, 0, W, 30, '#7f1d1d');
    this.text(g, `✕  ${a.label}`, 14, 15, { size: 13, color: '#fff', max: W - 30 });
    const r = seeded(this.seed);
    for (let i = 0; i < 12; i++) this.rect(g, 14 + (i % 3 === 0 ? 0 : 16), 48 + i * 18, 80 + r() * 300, 5, i < 2 ? THEME.red : '#7a4b50', 3);
    if (Math.floor(e * 2) % 2 === 0) this.rect(g, 0, 0, W, 3, THEME.red);
  }
}

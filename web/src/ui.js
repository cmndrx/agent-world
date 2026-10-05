// HTML overlays: roster, "needs you" strip, inspect drawer, toasts, dock menus, edge arrows.
// Everything here renders truth, except the clearly marked "Simulation" card.

import * as THREE from 'three';
import { plumbobFor } from '../../shared/schema.mjs';
import { appName, brandOf, resolveActivity } from './activity.js';
import { icon, STATE_ICON } from './icons.js';
import { PROVIDER_COLORS } from './models.js';
import { escapeHtml, formatDuration } from './sim.js';

const $ = (sel) => document.querySelector(sel);
const hex = (n) => `#${(n >>> 0).toString(16).padStart(6, '0')}`;
const clock = (ts) => new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });

const WAIT_REASON = { permission: 'Needs your OK', turn_complete: 'Your turn', input: 'Has a question', interrupted: 'Stopped' };

/** A small SVG portrait drawn from a Sim's look. */
export function portrait(look, cls = '') {
  const hairBack = look.hairStyle === 1 || look.hairStyle === 5
    ? `<path d="M10.5 18c0-7 4-10.5 9.5-10.5S29.5 11 29.5 18v8h-4v-7h-11v7h-4z" fill="${hex(look.hair)}"/>`
    : '';
  const hairTop = look.hairStyle === 3
    ? `<path d="M11 16l2-6 3 3 2-5 2 4 3-4 2 5 3-3 1 6c-3-2-6-3-9-3s-6 1-9 3z" fill="${hex(look.hair)}"/>`
    : look.hairStyle === 4
      ? `<g fill="${hex(look.hair)}"><circle cx="13" cy="13" r="4"/><circle cx="19" cy="10" r="4.5"/><circle cx="25.5" cy="12.5" r="4"/><circle cx="28" cy="17" r="3"/><circle cx="12" cy="17" r="3"/></g>`
      : `<path d="M11 17.5a9 9 0 0 1 18 0c-2.6-2.8-5.6-4-9-4s-6.4 1.2-9 4z" fill="${hex(look.hair)}"/>`;
  const bun = look.hairStyle === 2 ? `<circle cx="20" cy="7.5" r="3.6" fill="${hex(look.hair)}"/>` : '';
  return `<svg class="portrait ${cls}" viewBox="0 0 40 40" aria-hidden="true">
    <rect width="40" height="40" fill="${hex(look.shirt)}" opacity=".28"/>
    ${hairBack}
    <path d="M6 41c1.2-8.5 7-12.5 14-12.5S32.8 32.5 34 41z" fill="${hex(look.shirt)}"/>
    <rect x="17.5" y="24" width="5" height="5" rx="2" fill="${hex(look.skin)}"/>
    <circle cx="20" cy="18.5" r="9" fill="${hex(look.skin)}"/>
    ${bun}${hairTop}
    <circle cx="16.6" cy="19.5" r="1.25" fill="#1d1f27"/><circle cx="23.4" cy="19.5" r="1.25" fill="#1d1f27"/>
    <path d="M17.6 23q2.4 1.9 4.8 0" stroke="#7a3b3b" stroke-width="1.2" fill="none" stroke-linecap="round"/>
  </svg>`;
}

/**
 * Keyed list rendering: reuse elements by key so hover state, focus and entry animations survive
 * the frequent timer updates.
 */
function patchList(container, items, { key, html, className, tag = 'button' }) {
  const existing = new Map([...container.children].map((el) => [el.dataset.key, el]));
  let prev = null;
  for (const item of items) {
    const k = key(item);
    let el = existing.get(k);
    if (el) existing.delete(k);
    else {
      el = document.createElement(tag);
      el.dataset.key = k;
    }
    const cls = className(item);
    if (el.className !== cls) el.className = cls;
    const h = html(item);
    if (el._html !== h) {
      el.innerHTML = h;
      el._html = h;
    }
    const next = prev ? prev.nextSibling : container.firstChild;
    if (next !== el) container.insertBefore(el, next);
    prev = el;
  }
  for (const el of existing.values()) el.remove();
}

function portraitWithRing(sim, size = '') {
  return `<span class="portrait-wrap ${size}">${portrait(sim.look, size)}<span class="ring s-${plumbobFor(sim.state)}"></span></span>`;
}

function stateText(sim) {
  if (sim.state === 'waiting_for_user') return WAIT_REASON[sim.truth.detail?.reason] || 'Needs you';
  return sim.activityLabel;
}

/** A small colored chip naming the app ("Claude" / "Codex"). */
function appChip(session) {
  if (!session) return '';
  const color = hex(PROVIDER_COLORS[session.provider] ?? 0x98a1b2);
  return `<span class="app-chip" style="--chip:${color}" title="${escapeHtml(appName(session))}">${escapeHtml(brandOf(session))}</span>`;
}

/** A one-line sentence for a "needs you" toast: "<b>Otto</b> needs your OK to run a command". */
function toastText(sim) {
  const name = `<b>${escapeHtml(sim.name)}</b>`;
  const reason = sim.truth?.detail?.reason;
  if (reason === 'turn_complete') return `${name} is done. Your turn.`;
  if (reason === 'input') return `${name} has a question for you`;
  if (reason === 'interrupted') return `${name} stopped and is waiting for you`;
  const label = sim.activityLabel;
  return `${name} ${escapeHtml(label.charAt(0).toLowerCase() + label.slice(1))}`;
}

/** Who a Sim is, in words: "Claude desktop app" or "Helper for Otto". */
function whoLine(sim) {
  if (sim.isVisitor) return `Helper for ${sim.parent.name}`;
  return sim.truth ? appName(sim.truth) : 'No session open';
}

export class UI {
  constructor(handlers) {
    this.h = handlers;
    this.roster = $('#roster');
    this.rosterBody = $('#roster-body');
    this.needs = $('#needs');
    this.needsList = $('#needs-list');
    this.panel = $('#inspect');
    this.arrows = $('#arrows');
    this.toasts = $('#toasts');
    this.status = $('#status');
    this.clockEl = $('#clock');
    this.hint = $('#hint');
    this.sim = null;
    this.lastRender = 0;
    this.html = {};

    // Roster
    $('#roster-toggle').innerHTML = icon('panelLeft');
    $('#roster-toggle').addEventListener('click', () => {
      this.roster.classList.toggle('collapsed');
      this.h.onSetting('roster', this.roster.classList.contains('collapsed') ? 'collapsed' : 'open');
    });
    this.rosterBody.addEventListener('click', (e) => {
      const row = e.target.closest('[data-key]');
      if (row) return this.h.onFocus(row.dataset.key);
      const lot = e.target.closest('[data-lot]');
      if (lot) this.h.onFocusLot(lot.dataset.lot);
    });
    this.needsList.addEventListener('click', (e) => {
      const b = e.target.closest('[data-key]');
      if (b) this.h.onFocus(b.dataset.key);
    });
    this.arrows.addEventListener('click', (e) => {
      const a = e.target.closest('[data-key]');
      if (a) this.h.onFocus(a.dataset.key);
    });

    // Inspect drawer
    this.panel.addEventListener('click', (e) => {
      if (e.target.closest('[data-close]')) this.close();
    });
    this.panel.addEventListener('change', (e) => {
      if (e.target.name === 'name' && this.sim?.character) this.h.onRename(this.sim, e.target.value);
    });
    this.panel.addEventListener('keydown', (e) => {
      if (e.target.name === 'name' && e.key === 'Enter') e.target.blur();
    });

    this.initDock();
  }

  // ---- Status, clock, intro --------------------------------------------------------

  setConnection(state, live = 0) {
    this.status.dataset.state = state;
    this.status.querySelector('.text').textContent =
      state === 'live' ? (live ? `Watching ${live} session${live === 1 ? '' : 's'}` : 'Watching · no sessions yet') : state === 'connecting' ? 'Connecting…' : 'Not connected';
    if (state === 'offline') $('#intro .intro-status .text').textContent = "Can't connect yet. Is `npm run dev` still running?";
  }

  setClock(label, hour, mode) {
    const name = hour >= 5 && hour < 8 ? 'sunrise' : hour >= 8 && hour < 17.5 ? 'sun' : hour >= 17.5 && hour < 20.5 ? 'sunset' : 'moon';
    const html = `${icon(name)}<span>${label}</span>${mode === 'auto' ? '' : '<small style="opacity:.6">preview</small>'}`;
    if (html !== this.html.clock) this.clockEl.innerHTML = this.html.clock = html;
  }

  setDemo(demo) {
    $('#demo-chip').hidden = !demo;
  }

  setNight(night) {
    document.body.classList.toggle('night', night);
  }

  hideIntro() {
    $('#intro').classList.add('done');
  }

  setHint(sim) {
    const show = !!sim && !this.sim;
    this.hint.hidden = !show;
    if (show) {
      const html = `<kbd>Space</kbd> inspect <b>${escapeHtml(sim.name)}</b>`;
      if (html !== this.html.hint) this.hint.innerHTML = this.html.hint = html;
    }
  }

  // ---- Dock ---------------------------------------------------------------------------

  initDock() {
    const dock = $('#dock');
    const set = (sel, name) => (dock.querySelector(sel).innerHTML = icon(name));
    set('[data-action="rotate-left"]', 'navigation');
    dock.querySelector('[data-action="rotate-left"]').style.transform = 'scaleX(-1)';
    set('[data-action="rotate-right"]', 'navigation');
    set('[data-menu="walls"]', 'layers');
    set('[data-menu="quality"]', 'sparkles');
    set('[data-menu="help"]', 'circleHelp');

    this.menus = {
      time: { title: 'Time of day', options: [['auto', 'clock', 'Live (your clock)'], ['morning', 'sunrise', 'Morning'], ['noon', 'sun', 'Noon'], ['golden', 'sunset', 'Golden hour'], ['night', 'moon', 'Night']] },
      walls: { title: 'Walls', options: [['up', 'house', 'Walls up'], ['cutaway', 'layers', 'Cutaway'], ['down', 'blocks', 'Walls down']] },
      quality: { title: 'Graphics', options: [['auto', 'gauge', 'Auto'], ['high', 'sparkles', 'High'], ['medium', 'eye', 'Medium'], ['low', 'zap', 'Low']] },
    };

    dock.addEventListener('click', (e) => {
      const opt = e.target.closest('.opt');
      if (opt) {
        this.h.onSetting(opt.dataset.menu, opt.dataset.value);
        this.closeMenus();
        return;
      }
      const btn = e.target.closest('button');
      if (!btn) return;
      if (btn.dataset.menu) {
        const menu = dock.querySelector(`.menu[data-for="${btn.dataset.menu}"]`);
        const open = menu.hidden;
        this.closeMenus();
        menu.hidden = !open;
        btn.classList.toggle('active', open);
      } else if (btn.dataset.action) {
        this.h.onAction(btn.dataset.action);
      }
    });
    addEventListener('pointerdown', (e) => {
      if (!e.target.closest('#dock')) this.closeMenus();
    });
  }

  closeMenus() {
    for (const m of document.querySelectorAll('#dock .menu')) m.hidden = true;
    for (const b of document.querySelectorAll('#dock [data-menu]')) b.classList.remove('active');
  }

  renderDock(settings, soundOn, qualityLevel) {
    const dock = $('#dock');
    const timeIcon = { auto: 'clock', morning: 'sunrise', noon: 'sun', golden: 'sunset', night: 'moon' }[settings.time] || 'clock';
    dock.querySelector('[data-menu="time"]').innerHTML = icon(timeIcon);
    const snd = dock.querySelector('[data-action="sound"]');
    snd.innerHTML = icon(soundOn ? 'bell' : 'bellOff');
    snd.title = soundOn ? 'Sounds on: chime when an agent needs you' : 'Sounds off';
    for (const [key, menu] of Object.entries(this.menus)) {
      const el = dock.querySelector(`.menu[data-for="${key}"]`);
      el.innerHTML = `<h3>${menu.title}</h3>` + menu.options
        .map(([value, ic, label]) => {
          const extra = key === 'quality' && value === 'auto' ? `<small>${qualityLevel}</small>` : '';
          return `<button class="opt${settings[key] === value ? ' on' : ''}" data-menu="${key}" data-value="${value}">${icon(ic)}${label}${extra}</button>`;
        })
        .join('');
    }
  }

  // ---- Toasts ---------------------------------------------------------------------------

  toast(sim) {
    const el = document.createElement('div');
    el.className = 'toast glass';
    el.dataset.key = sim.key;
    el.innerHTML = `${portraitWithRing(sim)}
      <div class="msg">${toastText(sim)}
        <span>${escapeHtml(whoLine(sim))} · ${escapeHtml(sim.lot.name)}</span></div>
      <span class="go">${icon('navigation')}</span>`;
    const dismiss = () => {
      el.classList.add('out');
      setTimeout(() => el.remove(), 350);
    };
    el.addEventListener('click', () => {
      this.h.onFocus(sim.key);
      dismiss();
    });
    this.toasts.appendChild(el);
    while (this.toasts.children.length > 3) this.toasts.firstChild.remove();
    setTimeout(dismiss, 7000);
  }

  // ---- Inspect drawer ---------------------------------------------------------------------

  open(sim) {
    this.sim = sim;
    this.panel.hidden = false;
    this.panel.style.animation = 'none';
    void this.panel.offsetWidth; // restart the slide-in
    this.panel.style.animation = '';
    const lotColor = hex(sim.lot.exterior);
    this.panel.innerHTML = `
      <div class="insp-head">
        ${portraitWithRing(sim, 'lg')}
        <div class="names">
          ${sim.character
            ? `<input name="name" value="${escapeHtml(sim.name)}" maxlength="40" aria-label="Name (click to rename)" title="Click to rename" />`
            : `<h2>${escapeHtml(sim.name)}</h2>`}
          <div class="where" data-slot="where"></div>
          <div class="where"><span style="width:9px;height:9px;border-radius:3px;flex:none;background:${lotColor}"></span>
            ${icon('house')} ${escapeHtml(sim.lot.name)}${sim.character ? ` · desk ${sim.character.slot}` : ''}</div>
        </div>
        <button class="icon-btn close" data-close aria-label="Close">${icon('x')}</button>
      </div>
      <div class="scroll">
        <div data-slot="hero"></div>
        <figure class="screen-wrap">
          <canvas class="screen-preview" width="512" height="320"></canvas>
          <figcaption>Live screen · names, files and commands are real; code and output are illustrative</figcaption>
        </figure>
        <div class="section-title">What's really happening <small data-slot="truth-src"></small></div>
        <dl class="facts" data-slot="facts"></dl>
        <div class="section-title" data-slot="tl-title">Recent steps</div>
        <ol class="timeline" data-slot="timeline"></ol>
        <div class="simcard" data-slot="sim"></div>
      </div>`;
    this.html.panel = {};
    this.renderPanel();
  }

  close() {
    if (!this.sim) return;
    this.panel.hidden = true;
    this.sim = null;
    this.h.onClose();
  }

  slot(name, html) {
    if (this.html.panel[name] === html) return;
    this.html.panel[name] = html;
    const el = this.panel.querySelector(`[data-slot="${name}"]`);
    if (el) el.innerHTML = html;
  }

  renderPanel() {
    const sim = this.sim;
    if (!sim) return;
    const s = sim.truth;
    const state = sim.state;
    const cls = plumbobFor(state);

    const input = this.panel.querySelector('input[name=name]');
    if (input && document.activeElement !== input && input.value !== sim.name) input.value = sim.name;
    const ring = this.panel.querySelector('.insp-head .ring');
    if (ring) ring.className = `ring s-${cls}`;

    const dot = s ? `<span style="width:9px;height:9px;border-radius:50%;flex:none;background:${hex(PROVIDER_COLORS[s.provider] ?? 0x98a1b2)}"></span>` : '';
    this.slot('where', `${dot}<span>${escapeHtml(whoLine(sim))}</span>`);
    this.slot('truth-src', s ? `straight from ${escapeHtml(appName(s))}` : '');

    let sub;
    if (!s) {
      sub = `${sim.name} gets back to work when you start Claude Code or Codex in this folder.`;
    } else if (state === 'waiting_for_user') sub = `Waiting for you for ${formatDuration(sim.waitSeconds)}`;
    else sub = `For ${formatDuration((Date.now() - Date.parse(s.since)) / 1000)} · since ${clock(s.since)}`;
    const label = s ? sim.activityLabel : 'Off duty';
    const detail = s ? sim.act.detail : `No session open in ${sim.lot.name}`;
    const prose = !s || sim.act.prose;
    this.panel.querySelector('[data-slot="hero"]').className = `hero s-${cls}`;
    this.slot('hero', `
      <span class="big-icon">${icon(STATE_ICON[state])}</span>
      <span class="label">${escapeHtml(label)}</span>
      <span class="sub">${escapeHtml(sub)}</span>
      ${detail && !label.includes(detail) ? `<span class="target${prose ? ' prose' : ''}">${escapeHtml(detail)}</span>` : ''}`);

    const mono = (v) => `<span style="font-family:var(--mono);font-size:11px">${escapeHtml(v)}</span>`;
    const facts = s
      ? [
          ['App', `<span class="provider"><i style="background:${hex(PROVIDER_COLORS[s.provider] ?? 0x98a1b2)}"></i>${escapeHtml(appName(s))}</span>`],
          ['Folder', mono(sim.lot.project)],
          ['Started', escapeHtml(new Date(s.startedAt).toLocaleString())],
          ['Tool', s.detail?.tool ? `${mono(s.detail.tool)} <span class="muted">(the agent's own name for it)</span>` : '—'],
          ['Session ID', mono(s.session)],
        ]
      : [
          ['Folder', mono(sim.lot.project)],
          ['Last seen', sim.character?.lastSeen ? escapeHtml(new Date(sim.character.lastSeen).toLocaleString()) : 'Never'],
        ];
    this.slot('facts', facts.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join(''));

    const history = s ? [...s.history].reverse() : [];
    this.panel.querySelector('[data-slot="tl-title"]').hidden = !history.length;
    this.slot('timeline', history
      .map((e) => {
        const st = e.kind === 'state' ? e.state : null;
        const a = st ? resolveActivity(e) : null;
        const name = a ? a.label : e.kind === 'session_start' ? 'Session started' : 'Session ended';
        const ic = st ? STATE_ICON[st] : e.kind === 'session_start' ? 'zap' : 'moon';
        const tgt = a?.detail && !name.includes(a.detail) ? a.detail : '';
        return `<li class="s-${st ? plumbobFor(st) : 'working'}"><span class="node">${icon(ic)}</span>
          <span class="ev"><b>${escapeHtml(name)}</b>${tgt ? `<span>${escapeHtml(tgt)}</span>` : ''}</span>
          <time>${clock(e.ts)}</time></li>`;
      })
      .join(''));

    const flavor = sim.activity?.flavor ? sim.activity.label : null;
    this.slot('sim', `<h4>${icon('sparkles')} Just for fun</h4>${flavor
      ? `${escapeHtml(flavor)}: made up. The agent has nothing to do, so its Sim is taking a break.`
      : 'Nothing made up right now. Everything this Sim does mirrors the real agent.'}`);
  }

  /** Mirror the inspected Sim's screen into the drawer every frame. */
  updatePreview() {
    if (!this.sim) return;
    const c = this.panel.querySelector('.screen-preview');
    if (!c) return;
    const src = this.sim.screen.canvas;
    const g = c.getContext('2d');
    g.drawImage(src, 0, 0, src.width, src.height, 0, 0, c.width, c.height);
  }

  // ---- Per-frame + throttled rendering ------------------------------------------------------

  update({ sims, lots, camera, width, height, selected }) {
    const waiting = sims.filter((s) => s.state === 'waiting_for_user').sort((a, b) => b.waitSeconds - a.waitSeconds);
    this.updateArrows(waiting, camera, width, height);

    const now = performance.now();
    if (now - this.lastRender < 400) return;
    this.lastRender = now;

    this.renderNeeds(waiting);
    this.renderRoster(sims, lots, selected);
    if (this.sim) {
      if (this.sim.gone) this.close();
      else this.renderPanel();
    }
  }

  renderNeeds(waiting) {
    this.needs.hidden = waiting.length === 0;
    patchList(this.needsList, waiting, {
      key: (s) => s.key,
      className: () => 'need',
      html: (s) => `${portrait(s.look)}
        <span style="display:grid;text-align:left;line-height:1.1"><b>${escapeHtml(s.name)}</b><span class="why">${escapeHtml(stateText(s))} · ${escapeHtml(s.lot.name)}</span></span>
        <time>${formatDuration(s.waitSeconds)}</time>`,
    });
  }

  renderRoster(sims, lots, selected) {
    const live = sims.filter((s) => s.truth).length;
    $('#roster-count').textContent = lots.length ? `${lots.length} folder${lots.length === 1 ? '' : 's'} · ${live} active` : '';
    if (!lots.length) {
      const html = `<div class="empty">No agents yet.<br>Start Claude Code or Codex in any project folder and its agent moves in here.<br><br>Want a tour first? Run <code>npm run demo</code>.</div>`;
      if (this.html.roster !== html) this.rosterBody.innerHTML = this.html.roster = html;
      return;
    }
    if (this.html.roster) this.rosterBody.innerHTML = this.html.roster = '';

    patchList(this.rosterBody, lots, {
      tag: 'div',
      key: (lot) => lot.project,
      className: () => 'lot-group',
      html: () => '<button class="lot-title"></button><div class="rows"></div>',
    });
    for (const lot of lots) {
      const group = [...this.rosterBody.children].find((g) => g.dataset.key === lot.project);
      const here = sims.filter((s) => s.lot === lot);
      const waitingHere = here.filter((s) => s.state === 'waiting_for_user').length;
      const activeHere = here.filter((s) => s.truth).length;
      const meta = waitingHere ? `${waitingHere} need${waitingHere === 1 ? 's' : ''} you` : activeHere ? `${activeHere} working` : 'no sessions';
      const title = group.querySelector('.lot-title');
      const titleHtml = `<span class="swatch" style="background:${hex(lot.exterior)}"></span>${icon('house')}${escapeHtml(lot.name)}<span class="lot-meta">${meta}</span>`;
      if (title._html !== titleHtml) {
        title.innerHTML = title._html = titleHtml;
        title.dataset.lot = lot.project;
        title.title = lot.project;
      }
      const ordered = [];
      for (const s of here.filter((s) => !s.isVisitor).sort((a, b) => a.character.slot - b.character.slot)) {
        ordered.push(s, ...here.filter((v) => v.parent === s));
      }
      patchList(group.querySelector('.rows'), ordered, {
        key: (s) => s.key,
        className: (s) => `sim-row${s.truth ? '' : ' off'}${s.isVisitor ? ' visitor' : ''}${s === selected ? ' selected' : ''}`,
        html: (s) => this.rosterRow(s),
      });
    }
  }

  rosterRow(s) {
    const cls = plumbobFor(s.state);
    const detail = s.truth ? s.act.detail : '';
    const right = s.state === 'waiting_for_user' ? formatDuration(s.waitSeconds) : '';
    return `${portraitWithRing(s)}
      <span class="who"><b>${escapeHtml(s.name)} ${s.isVisitor ? '' : appChip(s.truth)}</b>
        <span class="what">${icon(STATE_ICON[s.state])}${escapeHtml(stateText(s))}</span>
        ${detail && !s.act.prose && !stateText(s).includes(detail) ? `<span class="t">${escapeHtml(detail)}</span>` : ''}</span>
      ${right ? `<span class="state-pill s-${cls}">${right}</span>` : ''}`;
  }

  updateArrows(waiting, camera, width, height) {
    const v = new THREE.Vector3();
    const margin = 40;
    let html = '';
    const placed = [];
    for (const s of waiting) {
      v.copy(s.worldPosition()).setY(1.5).project(camera);
      const behind = v.z > 1;
      let x = (v.x * 0.5 + 0.5) * width;
      let y = (-v.y * 0.5 + 0.5) * height;
      if (behind) {
        x = width - x;
        y = height - y;
      }
      const onScreen = !behind && x > margin && x < width - margin && y > margin && y < height - margin;
      if (onScreen) continue;
      const cx = width / 2;
      const cy = height / 2;
      const angle = Math.atan2(y - cy, x - cx);
      const scale = Math.min((cx - margin) / Math.abs(Math.cos(angle) || 1e-6), (cy - margin) / Math.abs(Math.sin(angle) || 1e-6));
      const ax = THREE.MathUtils.clamp(cx + Math.cos(angle) * scale, 90, width - 90);
      let ay = THREE.MathUtils.clamp(cy + Math.sin(angle) * scale, 76, height - 80);
      while (placed.some(([px, py]) => Math.abs(px - ax) < 90 && Math.abs(py - ay) < 30)) ay += 32;
      placed.push([ax, ay]);
      html += `<div class="arrow" data-key="${escapeHtml(s.key)}" style="left:${ax}px;top:${ay}px">
        <span class="dir" style="transform:rotate(${angle + Math.PI / 4}rad)">${icon('navigation')}</span>${escapeHtml(s.name)}</div>`;
    }
    if (html !== this.html.arrows) this.arrows.innerHTML = this.html.arrows = html;
  }
}

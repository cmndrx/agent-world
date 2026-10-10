import { connectionView } from '../../shared/connections.mjs';
import {ProjectsPanel} from './projects.js';
import {canPromptFromStatus} from '../../shared/agent-view.mjs';
import { observedLabel, observationTime } from '../../shared/freshness.mjs';
// HTML overlays: roster, inspect drawer, toasts, dock menus, edge arrows.
// Everything here renders truth, except the clearly marked "Simulation" card.

import * as THREE from 'three';
import { plumbobFor } from '../../shared/schema.mjs';
import { appName, resolveActivity } from './activity.js';
import { SEASONS, WEATHERS } from './seasons.js';
import { icon, STATE_ICON } from './icons.js';
import { AvatarPortrait } from './avatar-portrait.js';
import { PROVIDER_COLORS } from './models.js';
import { escapeHtml, formatDuration } from './sim.js';

const $ = (sel) => document.querySelector(sel);
const hex = (n) => `#${(n >>> 0).toString(16).padStart(6, '0')}`;
const clock = (ts) => new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });

/** Short relative time: "just now", "5m ago", "3h ago", "2d ago". */
function ago(ms) {
  const sec = Math.max(0, Math.floor((Date.now() - ms) / 1000));
  return sec < 60 ? 'just now' : sec < 3600 ? `${Math.floor(sec / 60)}m ago` : sec < 86400 ? `${Math.floor(sec / 3600)}h ago` : `${Math.floor(sec / 86400)}d ago`;
}


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
  const acc = {
    glasses: '<g fill="none" stroke="#1d1f27" stroke-width="1.1"><circle cx="16.6" cy="19.5" r="2.6"/><circle cx="23.4" cy="19.5" r="2.6"/><path d="M19.2 19.3h1.6"/></g>',
    cap: `<path d="M11 15.5a9 9 0 0 1 18 0z" fill="${hex(look.shirt)}"/><path d="M27 15.2h6.5q-.5 1.8-3 1.8H27z" fill="${hex(look.shirt)}"/>`,
    beanie: `<path d="M10.8 16.5a9.2 9.2 0 0 1 18.4 0z" fill="${hex(look.shirt)}"/><rect x="10.4" y="15" width="19.2" height="3" rx="1.5" fill="#fff" opacity=".55"/>`,
    headphones: '<path d="M10.5 19a9.5 9.5 0 0 1 19 0" fill="none" stroke="#2b3040" stroke-width="1.8"/><rect x="8.6" y="17" width="3.6" height="6" rx="1.6" fill="#2b3040"/><rect x="27.8" y="17" width="3.6" height="6" rx="1.6" fill="#2b3040"/>',
    flower: '<g transform="translate(27 12)"><circle r="2.4" fill="#ff8fb1"/><circle r="1" fill="#ffd166"/></g>',
  }[look.accessory] || '';
  const collar = look.top === 'hoodie' ? `<path d="M14 30.5q6 4 12 0" stroke="#000" stroke-opacity=".18" stroke-width="1.6" fill="none"/>` : look.top === 'collar' ? '<path d="M16.5 29l3.5 3 3.5-3" stroke="#fff" stroke-opacity=".75" stroke-width="1.4" fill="none"/>' : '';
  return `<svg class="portrait ${cls}" viewBox="0 0 40 40" aria-hidden="true">
    <rect width="40" height="40" fill="${hex(look.shirt)}" opacity=".28"/>
    <g class="p-body"><path d="M6 41c1.2-8.5 7-12.5 14-12.5S32.8 32.5 34 41z" fill="${hex(look.shirt)}"/>${collar}
    <rect x="17.5" y="24" width="5" height="5" rx="2" fill="${hex(look.skin)}"/></g>
    <g class="p-head">${hairBack}
    <circle cx="20" cy="18.5" r="9" fill="${hex(look.skin)}"/>
    ${bun}${hairTop}
    <g class="p-eyes"><circle cx="16.6" cy="19.5" r="1.25" fill="#1d1f27"/><circle cx="23.4" cy="19.5" r="1.25" fill="#1d1f27"/></g>
    <path d="M17.6 23q2.4 1.9 4.8 0" stroke="#7a3b3b" stroke-width="1.2" fill="none" stroke-linecap="round"/>${acc}</g>
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

/** A one-line sentence for a "needs you" toast: "<b>Otto</b> needs your OK to run a command". */
function toastText(sim) {
  const name = `<b>${escapeHtml(sim.name)}</b>`;
  const reason = sim.truth?.detail?.reason;
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
    this.panel = $('#inspect');
    this.arrows = $('#arrows');
    this.toasts = $('#toasts');
    this.status = $('#status');
    this.clockEl = $('#clock');
    this.hint = $('#hint');
    this.sim = null;
    this.lastRender = 0;
    this.html = {};

    this.rosterView='agents';
    this.projectsPanel=new ProjectsPanel($('#project-body'),{focus:project=>this.h.onFocusLot(project),onCount:count=>{if(this.rosterView==='projects')$('#roster-count').textContent=`${count} project${count===1?"":"s"}`;}});
    document.querySelectorAll('[data-roster-view]').forEach(b=>b.addEventListener('click',()=>{this.rosterView=b.dataset.rosterView;this.roster.classList.toggle('project-onboarding',this.rosterView==='projects');this.roster.classList.remove('collapsed');$('#roster-title').textContent=this.rosterView==='agents'?'Your agents':'Your projects';this.rosterBody.hidden=this.rosterView!=='agents';$('#project-body').hidden=this.rosterView!=='projects';document.querySelectorAll('[data-roster-view]').forEach(t=>t.setAttribute('aria-selected',String(t.dataset.rosterView===this.rosterView)));if(this.rosterView==='projects')this.projectsPanel.load();}));
    // Roster
    $('#roster-toggle').innerHTML = icon('panelLeft');
    $('#roster-toggle').addEventListener('click', () => {
      this.roster.classList.toggle('collapsed');
      this.h.onSetting('roster', this.roster.classList.contains('collapsed') ? 'collapsed' : 'open');
    });
    this.rosterBody.addEventListener('click', (e) => {
      if (e.target.closest('[data-work-home]')) return;
      const shelf = e.target.closest('[data-conversation-home]');
      if (shelf) return;
      const lot = e.target.closest('[data-lot]');
      if (lot) return this.h.onFocusLot(lot.dataset.lot);
      const row = e.target.closest('.sim-row[data-key]');
      if (row) return this.h.onFocus(row.dataset.key);

    });
    this.arrows.addEventListener('click', (e) => {
      const a = e.target.closest('[data-key]');
      if (a) this.h.onFocus(a.dataset.key);
    });

    // Inspect drawer
    this.panel.addEventListener('click', (e) => {
      if(e.target.closest('[data-prompt-agent]')&&this.sim)this.h.onPrompt?.(this.sim);
      if (e.target.closest('[data-close]')) this.close();
      if (e.target.closest('[data-outfit]') && this.sim) this.h.onOutfit?.(this.sim);
    });
    this.panel.addEventListener('change', (e) => {
      if (e.target.name === 'name' && this.sim?.character) this.h.onRename(this.sim, e.target.value);
    });
    this.panel.addEventListener('keydown', (e) => {
      if (e.target.name === 'name' && e.key === 'Enter') e.target.blur();
    });

    this.initDock();
    const layoutChrome = () => {
      const top = $('#topbar').getBoundingClientRect().bottom + 10;
      const below = top;
      this.roster.style.top = `${below}px`;
      this.roster.style.maxHeight = `calc(100dvh - ${below + 100}px)`;
    };
    new ResizeObserver(layoutChrome).observe($('#topbar'));
    layoutChrome();
  }

  // ---- Status, clock, intro --------------------------------------------------------

// <<<<<<< ai-features
//   setConnection(state, view = connectionView(null, false)) {
//     this.status.title = view.detail;
//     this.status.setAttribute('aria-label', `${view.text}. ${view.detail}`);
// =======
  setConnection(state, live = 0) {
    // Merge fix: ai-features passes a connectionView ({ text, detail, count }); gameplay-improvement passed a count.
    const view = live && typeof live === 'object' ? live : null;
    if (view) live = view.count;
    if (view && this.gameLinked && state === 'live') {
      this.connectionState = state;
      this.liveCount = view;
      this.status.dataset.state = state;
      this.status.title = view.detail;
      this.status.setAttribute('aria-label', `${view.text}. ${view.detail}`);
      this.status.querySelector('.text').textContent = view.text;
      return;
    }
    this.status.title = state === 'live' ? (this.gameLinked ? 'Bridge connected. Agent state is the last received observation, not an adapter health check.' : 'Bridge connected. Link Codex or Claude Code with Mayor Martin to welcome agents into town.') : 'Current activity unavailable. Received observations and your planning are preserved.';
// >>>>>>> gameplay-improvement
    this.connectionState = state;
    this.liveCount = live;
    this.status.dataset.state = state;
// <<<<<<< ai-features
//     this.status.querySelector('.text').textContent = state === 'connecting' ? 'Connecting…' : view.text;
// =======
    this.status.querySelector('.text').textContent =
      state === 'live' ? (this.gameLinked ? (live ? `Live · ${live} session${live === 1 ? '' : 's'}` : 'Live · no attached sessions') : 'Town not linked') : state === 'connecting' ? 'Connecting…' : 'Offline · last known activity';
// >>>>>>> gameplay-improvement
    if (state === 'offline') $('#intro .intro-status .text').textContent = "Can't connect yet. Is `npm run dev` still running?";
  }

  setGameLinked(linked) {
    this.gameLinked = linked;
    this.setConnection(this.connectionState || 'connecting', this.liveCount || 0);
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
    set('[data-action="build"]', 'hammer');
    set('[data-action="map"]', 'map');
    set('[data-action="wardrobe"]', 'shirt');
    set('[data-action="photo"]', 'camera');
    document.getElementById('sources-open').innerHTML = icon('plug');
    set('[data-action="city"]', 'building2');
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
    // Season + weather share one menu (ambience only; never real weather or agent-related).
    const seasonIcon = { spring: 'flower', summer: 'sun', autumn: 'leaf', winter: 'snowflake' };
    const weatherIcon = { auto: 'cloudSun', clear: 'sun', rain: 'cloudRain', snow: 'cloudSnow' };
    dock.querySelector('[data-menu="weather"]').innerHTML = icon(settings.weather && settings.weather !== 'auto' ? weatherIcon[settings.weather] : seasonIcon[settings.season] || 'cloudSun');
    const opt = (key, value, ic, label) => `<button class="opt${(settings[key] || 'auto') === value ? ' on' : ''}" data-menu="${key}" data-value="${value}">${icon(ic)}${label}</button>`;
    dock.querySelector('.menu[data-for="weather"]').innerHTML =
      `<h3>Season</h3>${Object.entries(SEASONS).map(([v, l]) => opt('season', v, v === 'auto' ? 'clock' : seasonIcon[v], l)).join('')}` +
      `<h3>Weather</h3>${Object.entries(WEATHERS).map(([v, l]) => opt('weather', v, weatherIcon[v], l)).join('')}` +
      `<p class="menu-note">Ambience only, not a forecast.</p>`;
    for (const [key, menu] of Object.entries(this.menus)) {
      const el = dock.querySelector(`.menu[data-for="${key}"]`);
      el.innerHTML = `<h3>${menu.title}</h3>` + menu.options
        .map(([value, ic, label]) => {
          const extra = key === 'quality' && value === 'auto' ? `<small>${qualityLevel}</small>` : '';
          return `<button class="opt${settings[key] === value ? ' on' : ''}" data-menu="${key}" data-value="${value}">${icon(ic)}${label}${extra}</button>`;
        })
        .join('');
    }
    dock.querySelector('.menu[data-for="walls"]').innerHTML +=
      `<h3>Street life</h3>${opt('streetLife', 'on', 'users', 'Walk to work when off duty')}${opt('streetLife', 'off', 'house', 'Stay home')}` +
      `<p class="menu-note">Made up: only while their agent is off duty.</p>`;
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
        <span class="portrait-wrap lg avatar-3d-wrap"><span class="ring s-${plumbobFor(sim.state)}"></span></span>
        <div class="names">
          ${sim.character
            ? `<input name="name" value="${escapeHtml(sim.name)}" maxlength="40" aria-label="Name (click to rename)" title="Click to rename" />`
            : `<h2>${escapeHtml(sim.name)}</h2>`}
          <div class="where" data-slot="where"></div>
          <div class="where"><span style="width:9px;height:9px;border-radius:3px;flex:none;background:${lotColor}"></span>
            ${icon('house')} ${escapeHtml(sim.lot.name)}${sim.character ? ` · desk ${sim.character.slot}` : ''}</div>
        </div>
        ${sim.character ? `<button class="icon-btn" data-outfit aria-label="Change outfit" title="Change outfit (just for fun)">${icon('shirt')}</button>` : ''}
        <button class="icon-btn close" data-close aria-label="Close">${icon('x')}</button>
      </div>
      <div class="scroll">
        <h2 class="activity-view-title">Watch activity</h2>
        <button data-prompt-agent>Prompt this agent</button><div data-slot="role"></div>
        <button type="button" data-slot="hero" data-prompt-agent></button>
        <figure class="screen-wrap">
          <button type="button" class="screen-chat" data-prompt-agent aria-label="Open chat from activity screen"><canvas class="screen-preview" width="512" height="320"></canvas></button>
          <figcaption title="Names, files and commands are real; the code drawn on screen is illustrative">Live screen</figcaption>
        </figure>
        <div class="section-title">Details <small data-slot="truth-src"></small></div>
        <dl class="facts" data-slot="facts"></dl>
        <div class="section-title" data-slot="tl-title">Recent steps</div>
        <ol class="timeline" data-slot="timeline"></ol>
        <div class="simcard" data-slot="sim"></div>
      </div>`;
    // A live 3D bust of this agent (same model as in the world), idling while the panel is open.
    this.panel.querySelector('.avatar-3d-wrap').prepend(new AvatarPortrait({ look: () => sim.look, role: () => sim.roleInfo, mode: 'bust' }).canvas);
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
    const role = sim.roleInfo;
    // Role: one line; the reason is a tooltip (it describes observed activity, not skill).
    this.slot('role', role?.title ? `<div class="role-card" style="--role:#${role.color.toString(16).padStart(6, '0')}" title="${escapeHtml(role.why)}"><b>${icon(role.intern ? 'hardHat' : 'store')} ${escapeHtml(role.title)}</b>${role.workplace ? `<small>${escapeHtml(role.workplace)}</small>` : ''}</div>` : '');
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
    if (s && this.connectionState !== 'live') sub = `Offline · ${observedLabel(s)} · last known state`;
    const label = s ? (this.connectionState === 'live' ? sim.activityLabel : `Last known: ${sim.activityLabel}`) : 'Off duty';
    const detail = s ? sim.act.detail : `No session open in ${sim.lot.name}`;
    const prose = !s || sim.act.prose;
    const hero=this.panel.querySelector('[data-slot="hero"]');
    hero.className=`hero s-${cls}`;hero.disabled=!canPromptFromStatus(s);hero.setAttribute('aria-label',canPromptFromStatus(s)?`${label} · Open chat`:label);
    this.slot('hero', `
      <span class="big-icon">${icon(STATE_ICON[state])}</span>
      <span class="label">${escapeHtml(label)}</span>
      <span class="sub">${escapeHtml(sub)}</span>
      ${detail && !label.includes(detail) ? `<span class="target${prose ? ' prose' : ''}">${escapeHtml(detail)}</span>` : ''}${canPromptFromStatus(s)?'<span class="hero-chat-hint">Open chat →</span>':''}`);

    const mono = (v) => `<span style="font-family:var(--mono);font-size:11px">${escapeHtml(v)}</span>`;
    const facts = s
      ? [
          ['App', `<span class="provider"><i style="background:${hex(PROVIDER_COLORS[s.provider] ?? 0x98a1b2)}"></i>${escapeHtml(appName(s))}</span>`],
          ['Started', escapeHtml(clock(s.startedAt))],
          ['Observation', escapeHtml(observedLabel(s))],
          ...(s.detail?.tool ? [['Tool', mono(s.detail.tool)]] : []),
        ]
      : [['Last seen', sim.character?.lastSeen ? escapeHtml(new Date(sim.character.lastSeen).toLocaleString()) : 'Never']];
    const ids = `<details class="ids"><summary>IDs</summary><dl class="facts"><dt>Project</dt><dd>${mono(s?.sourceProject || sim.lot.project)}</dd>${s ? `<dt>Session</dt><dd>${mono(s.session)}</dd>` : ''}</dl></details>`;
    this.slot('facts', facts.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('') + `<dt></dt><dd>${ids}</dd>`);

    const history = s ? [...s.history].reverse().slice(0, 8) : [];
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
    this.slot('sim', s && this.connectionState !== 'live' ? 'Last received observation · screen paused. Current activity unavailable.' : flavor ? `${icon('sparkles')} <b>${escapeHtml(flavor)}</b> is made up — the agent is idle.` : `${icon('check')} Everything shown is the real agent.`);
  }

  /** Mirror the inspected Sim's screen into the drawer every frame. */
  updatePreview() {
    if (!this.sim) return;
    const caption = this.panel.querySelector('figcaption');
    if (caption) caption.textContent = this.connectionState === 'live' ? 'Observed screen · click to chat' : 'Last known screen · paused · click to chat';
    const c = this.panel.querySelector('.screen-preview');
    if (!c) return;
    const src = this.sim.screen.canvas;
    const g = c.getContext('2d');
    g.drawImage(src, 0, 0, src.width, src.height, 0, 0, c.width, c.height);
  }

  // ---- Per-frame + throttled rendering ------------------------------------------------------

  update({ sims, lots, camera, width, height, selected }) {
    const waiting = sims.filter((s) => s.state === 'waiting_for_user').sort((a, b) => b.waitSeconds - a.waitSeconds);
    this.updateArrows(this.connectionState === 'live' ? waiting : [], camera, width, height);

    const now = performance.now();
    if (now - this.lastRender < 400) return;
    this.lastRender = now;

    this.renderRoster(sims, lots, selected);
    if (this.sim) {
      if (this.sim.gone) this.close();
      else this.renderPanel();
    }
  }

  /** Your agents: a flat list of every agent with its status (same words as its bubble) and when it was last seen. */
  renderRoster(sims, lots, selected) {
    // Merge fix: ai-features' flat agent list and Projects tab, with gameplay-improvement's town-link empty state.
    if (this.rosterView === 'projects') return;
    const stale = this.connectionState !== 'live';
    $('#roster-count').textContent = sims.length ? `${sims.length} agent${sims.length === 1 ? '' : 's'} · ${sims.filter((s) => s.truth).length} active` : '';
    if (!sims.length) {
      const html = this.gameLinked
        ? `<div class="empty">Add your first project to give your agents a home.<br><br><button type="button" onclick="document.querySelector('[data-roster-view=projects]').click()">Add a project</button></div>`
        : `<div class="empty">Your town is waiting for its first agents.<br>Talk to Mayor Martin to link Codex or Claude Code.</div>`;
      if (this.html.roster !== html) this.rosterBody.innerHTML = this.html.roster = html;
      return;
    }
    if (this.html.roster) this.rosterBody.innerHTML = this.html.roster = '';
    // Who needs you first, then who's busy, then everyone else; alphabetical within each.
    const rank = (s) => (s.state === 'waiting_for_user' ? 0 : s.state === 'error' ? 1 : s.truth && !['idle', 'done'].includes(s.state) ? 2 : s.truth ? 3 : 4);
    const ordered = [...sims].sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name));
    patchList(this.rosterBody, ordered, {
      key: (s) => s.key,
      className: (s) => `sim-row agent-row${s.truth ? '' : ' off'}${s === selected ? ' selected' : ''}`,
      html: (s) => this.rosterRow(s, stale),
    });
  }

  rosterRow(s, stale) {
    const status = s.statusText(stale && !!s.truth);
    const seenAt = s.truth ? observationTime(s.truth) : Date.parse(s.character?.lastSeen ?? '') || null;
    const seen = s.truth && !stale ? 'Now' : seenAt ? ago(seenAt) : 'Never';
    const stateIcon = s.walking && !stale ? 'navigation' : STATE_ICON[s.state];
    return `${portraitWithRing(s)}
      <span class="who"><b>${escapeHtml(s.name)}</b>${s.character?.assignedRole?`<span class="resident-role">${escapeHtml(s.roleInfo?.title||s.character.assignedRole)}</span>`:''}<span class="what">${icon(stateIcon)}${escapeHtml(stale && s.truth ? 'Offline' : status)}</span></span>
      <small class="seen" title="${seenAt ? `Last seen ${escapeHtml(new Date(seenAt).toLocaleString())}` : 'Not seen yet'}">${seen}</small>`;
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

// Progress panel (phase 2): bricks, home levels and where they came from. Everything shown is derived
// from the human's own decisions on the board (shared/progression.mjs), never from agent activity.

import { BRICKS, COMMONS, LEVELS, MAX_LEVEL, commonsHint, levelName } from '../../shared/progression.mjs';
import { COLLECTIBLES } from '../../shared/collectibles.mjs';
import { CROPS, growth } from '../../shared/garden.mjs';
import { DECOR } from '../../shared/style.mjs';
import { icon } from './icons.js';
import { escapeHtml as esc } from './sim.js';

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

export class ProgressPanel {
  /** @param {{ onPlan: (project: string) => void, onBuild: () => void, onAlbum: () => void }} o */
  constructor({ onPlan, onBuild, onAlbum }) {
    this.onPlan = onPlan;
    this.onBuild = onBuild;
    this.onAlbum = onAlbum;
    this.data = { progress: null, households: [] };
    this.chip = document.getElementById('bricks-open');
    this.dialog = document.createElement('dialog');
    this.dialog.className = 'progress-panel glass';
    document.body.append(this.dialog);
    this.chip.addEventListener('click', () => this.open());
    this.dialog.addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (!b) return;
      if (b.hasAttribute('data-close')) this.dialog.close();
      if (b.dataset.plan) {
        this.dialog.close();
        this.onPlan(b.dataset.plan);
      }
      if (b.hasAttribute('data-album')) {
        this.dialog.close();
        this.onAlbum();
      }
      if (b.hasAttribute('data-build')) {
        this.dialog.close();
        this.onBuild();
      }
    });
  }

  setData(data) {
    Object.assign(this.data, data);
    const p = this.data.progress;
    if (p) this.chip.innerHTML = `${icon('brickWall')}<span>${p.balance} brick${p.balance === 1 ? '' : 's'}</span>`;
    if (this.dialog.open) this.render();
  }

  open() {
    this.render();
    if (!this.dialog.open) this.dialog.showModal();
  }

  homeName(project) {
    return this.data.households.find((h) => h.project === project)?.name || project.split('/').pop();
  }

  gardenHtml() {
    const now = Date.now();
    const growing = Object.values(this.data.gardens || {}).flatMap((beds) => Object.values(beds).map((plot) => growth(plot, now)));
    const ready = growing.filter((g) => g?.ripe).length;
    const harvest = this.data.harvest || {};
    return `<div class="mini-tiles">${Object.entries(CROPS).map(([id, c]) => {
        const n = harvest[id] || 0;
        return `<span class="mini${n ? '' : ' dim'}" title="${esc(`First harvest unlocks the ${DECOR[c.unlocks].label.toLowerCase()}`)}"><b>${n ? `×${n}` : '—'}</b>${esc(c.label)}</span>`;
      }).join('')}</div>${growing.length ? `<p class="mini-note">${plural(growing.length, 'bed')} growing${ready ? ` · <b>${ready} ready</b>` : ''}</p>` : ''}`;
  }

  render() {
    const p = this.data.progress || { earned: 0, spent: 0, balance: 0, levels: {}, ledger: [] };
    const homes = this.data.households.map((h) => {
      const level = p.levels[h.project] || 1;
      return `<li><span class="lvl-stars">${'★'.repeat(level)}<span>${'★'.repeat(MAX_LEVEL - level)}</span></span>
        <span class="lvl-home"><b>${esc(h.name)}</b><small>${esc(levelName(level))}</small></span>
        <button class="chip-btn" data-plan="${esc(h.project)}">Plan</button></li>`;
    }).join('');
    const ledger = p.ledger.slice(0, 10).map((e) => {
      const what = e.kind === 'outcome' ? `Outcome: ${esc(e.title || 'Untitled')}` : `Task: ${esc(e.title)}${e.capped ? ' (daily cap)' : ''}`;
      return `<li class="${e.bricks ? '' : 'muted-row'}"><b>+${e.bricks || 0}</b><span>${what}<small>${esc(this.homeName(e.project))}${e.at ? ` · ${esc(new Date(e.at).toLocaleDateString())}` : ''}</small></span></li>`;
    }).join('');
    const openSpaces = (p.commons || []).length;
    const foundKinds = Object.keys(COLLECTIBLES).filter((k) => this.data.found?.[k] > 0).length;
    const harvested = Object.values(this.data.harvest || {}).reduce((a, b) => a + b, 0);
    const box = (ic, title, count, body, open = false) => `<details class="collect" ${open ? 'open' : ''}><summary>${icon(ic)} <b>${title}</b> <span class="pill">${count}</span></summary>${body}</details>`;
    this.dialog.innerHTML = `<header class="panel-head"><span class="panel-icon reward">${icon('trophy')}</span><div><h2>Rewards</h2><small>Just for fun · from your decisions</small></div>
        <button class="icon-btn" data-close aria-label="Close">${icon('x')}</button></header>
      <div class="brick-balance"><span class="big">${icon('brickWall')} ${p.balance}</span><span>bricks<small>${p.earned} earned · ${p.spent} spent</small></span>
        <button data-build>${icon('hammer')} Spend</button></div>
      <div class="earn-pills"><span class="pill">${icon('flag')} +${BRICKS.outcomeReached} outcome reached</span><span class="pill">${icon('check')} +${BRICKS.acceptedTask} reviewed task <small>1/day per home</small></span></div>
      <h3 class="sec" style="margin:12px 0 6px">Homes</h3><ul class="lvl-list">${homes || '<li class="muted-row">No homes yet.</li>'}</ul>
      ${box('landmark', 'Town square', `${openSpaces}/${COMMONS.length}`, `<ul class="lvl-list">${COMMONS.map((c) => {
        const open = (p.commons || []).includes(c.id);
        return `<li><span class="lvl-stars">${open ? icon('check') : icon('lock')}</span><span class="lvl-home"><b>${esc(c.name)}</b><small>${open ? 'Open' : esc(commonsHint(c))}</small></span></li>`;
      }).join('')}</ul>`)}
      ${box('sparkles', 'Finds', `${foundKinds}/${Object.keys(COLLECTIBLES).length}`, `<div class="mini-tiles">${Object.entries(COLLECTIBLES).map(([k, c]) => {
        const n = this.data.found?.[k] || 0;
        return `<span class="mini${n ? '' : ' dim'}" title="${esc(n ? `Unlocks ${DECOR[c.unlocks].label.toLowerCase()}` : 'Keep exploring')}"><b>${n ? `×${n}` : '?'}</b>${esc(n ? c.label : 'Not found')}</span>`;
      }).join('')}</div><p class="mini-note">${this.data.remaining ? `${this.data.remaining} sparkling in yards today` : 'All found today'}</p>`)}
      ${box('sprout', 'Garden', harvested, this.gardenHtml())}
      ${box('images', 'Photos', this.data.photos || 0, `<button class="chip-btn" data-album>${icon('images')} Open album</button>`)}
      ${box('clock', 'Recent', p.ledger.length, `<ul class="ledger">${ledger || '<li class="muted-row">Nothing yet.</li>'}</ul>`)}
      <footer class="panel-foot"><span></span><details class="info-note"><summary>${icon('info')} How rewards work</summary><ul>
        <li>Only your decisions count: reaching outcomes, and accepting reviewed tasks.</li>
        <li>Task rewards are capped at one per home per day, so small tasks don't pay more.</li>
        <li>Each outcome grows its house a level (${LEVELS.map((l) => esc(l.name)).join(' → ')}).</li>
        <li>Agents can't earn bricks. Finds, gardens and photos never earn bricks.</li></ul></details></footer>`;
  }
}

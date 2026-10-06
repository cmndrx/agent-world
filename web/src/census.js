// City census (play layer): what downtown is built from, and what each business is waiting for.
// Everything shown is a kind of observed work counted once per day (shared/city.mjs).

import { BUSINESSES, DAYS_TO_OPEN, HIRE_AFTER_DAYS, SIGNALS, STAGE_NAMES, TIERS, businessName, businessProgress, businessStage, whyText } from '../../shared/city.mjs';
import { icon } from './icons.js';
import { escapeHtml as esc } from './sim.js';

export class Census {
  /** @param {{ onVisit: () => void, people: () => object[] }} o */
  constructor({ onVisit, people }) {
    this.onVisit = onVisit;
    this.people = people;
    this.city = null;
    this.demo = false;
    this.dialog = document.createElement('dialog');
    this.dialog.className = 'progress-panel census glass';
    document.body.append(this.dialog);
    this.dialog.addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (!b) return;
      if (b.hasAttribute('data-close')) this.dialog.close();
      if (b.dataset.why) {
        this.why = this.why === b.dataset.why ? null : b.dataset.why;
        this.render();
        return;
      }
      if (b.hasAttribute('data-visit')) {
        this.dialog.close();
        this.onVisit();
      }
    });
  }

  setCity(city, demo) {
    this.city = city;
    this.demo = demo;
    if (this.dialog.open) this.render();
  }

  open() {
    this.render();
    if (!this.dialog.open) this.dialog.showModal();
  }

  peopleHtml() {
    const people = this.people?.() || [];
    if (!people.length) return '<p class="mini-note">No jobs yet.</p>';
    return `<div class="people-chips">${people.map((p) => `<span class="person ${p.kind}" title="${esc(`${p.home}${p.workplace ? ` · ${p.workplace}` : ''}`)}">${icon(p.kind === 'intern' ? 'hardHat' : 'store')} <b>${esc(p.name)}</b> ${esc(p.title)}</span>`).join('')}</div>`;
  }

  render() {
    const city = this.city || { signals: {}, days: [] };
    const tiles = Object.entries(BUSINESSES).map(([id]) => {
      const stage = businessStage(city, id);
      const { tier, days, next } = businessProgress(city, id);
      const label = tier ? TIERS[tier - 1].name : stage ? STAGE_NAMES[stage] : 'Not started';
      return `<button class="biz-tile ${stage ? '' : 'dim'}" title="${esc(next ? `${days} of ${next.days} days to ${next.name.toLowerCase()}` : 'Fully grown')}" data-why="${id}">
        <span class="tile-icon">${icon(tier >= TIERS.length ? 'landmark' : stage === 3 ? 'store' : stage ? 'hardHat' : 'lock')}</span>
        <b>${esc(businessName(id, tier || 1))}</b><small>${esc(label)}</small>
        ${stage ? growPips(BUSINESSES[id].color, days, tier) : ''}</button>`;
    }).join('');
    const open = Object.keys(BUSINESSES).filter((id) => businessStage(city, id) === 3).length;
    const why = this.why ? `<p class="why-note">${icon('info')} ${esc(whyText(city, this.why))}</p>` : '';
    this.dialog.innerHTML = `<header class="panel-head"><span class="panel-icon city">${icon('building2')}</span><div><h2>Downtown</h2><small>${this.demo ? 'Demo city · built from fake agents' : 'Grows from the kinds of work seen'}</small></div>
        <button class="icon-btn" data-close aria-label="Close">${icon('x')}</button></header>
      <div class="brick-balance"><span class="big">${icon('store')} ${open}</span><span>of ${Object.keys(BUSINESSES).length} open<small>${plural(city.days?.length || 0, 'day')} of work seen</small></span>
        <button data-visit>${icon('navigation')} Visit</button></div>
      <div class="biz-tiles">${tiles}</div>${why}
      <h3 class="sec" style="margin:14px 0 6px">People</h3>${this.peopleHtml()}
      <footer class="panel-foot"><span></span><details class="info-note"><summary>${icon('info')} How it works</summary><ul>
        <li>Each kind of work opens a business on its ${DAYS_TO_OPEN === 2 ? 'second' : 'third'} day, then grows: ${TIERS.slice(1).map((t) => `${t.name.toLowerCase()} at ${t.days} days`).join(', ')}.</li>
        <li>Counted once per day — never by volume. Quiet days take nothing away.</li>
        <li>It describes activity, not results: a QA lab doesn't mean tests passed, and a “Tester” isn't a skill rating.</li>
        <li>Residents' jobs come from their most common kind of work. Helpers are hired after ${HIRE_AFTER_DAYS} days.</li>
        <li>Only kinds of work are kept, never files or commands.${this.demo ? ' This demo counts fake agents; real cities never do.' : ''}</li></ul></details></footer>`;
  }
}

const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;

/**
 * Growth as four small dots in the business's color, one per tier (Open, Expanded, Flagship, Landmark):
 * reached tiers are filled, the one in progress fills like a little pie, later ones stay faint.
 */
function growPips(color, days, tier) {
  const c = `#${color.toString(16).padStart(6, '0')}`;
  return `<span class="grow-pips" style="--c:${c}" aria-hidden="true">${TIERS.map((t, i) => {
    if (tier > i) return '<i class="pip full"></i>';
    if (tier < i) return '<i class="pip"></i>';
    const prev = i ? TIERS[i - 1].days : 0;
    const p = Math.max(0, Math.min(100, Math.round(((days - prev) / (t.days - prev)) * 100)));
    return `<i class="pip part" style="--p:${p}"></i>`;
  }).join('')}</span>`;
}

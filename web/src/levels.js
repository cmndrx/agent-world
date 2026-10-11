import { experience, residentKey, xpLevel, RESPONSE_XP } from '../../shared/experience.mjs';
import { icon } from './icons.js';

// Participation XP display. Shown in three places, all with the same markup:
//   - your level number on the "You" button, and your XP bar in the You card (wardrobe);
//   - an agent's level and XP bar in their agent card (inspect drawer);
//   - the agent's level in the prompter header (compact).
// XP celebrates participation; it never verifies or accepts work.

/** Level badge + bar + numbers. `compact` drops the "to next level" line (for tight headers). */
export function xpMarkup(level = xpLevel(), { compact = false, label = '' } = {}) {
  const pct = Math.max(0, Math.min(100, level.percent));
  return `<div class="xp-meter${compact ? ' compact' : ''}" title="${level.xp} total XP · ${level.remaining} XP to level ${level.level + 1}">` +
    `<span class="lvl-badge" aria-hidden="true"><small>Lv</small>${level.level}</span>` +
    `<div class="xp-body"><div class="xp-row"><b>${label ? `${label} · ` : ''}Level ${level.level}</b><small>${level.current} / ${level.required} XP</small></div>` +
    `<span class="xp-track" role="progressbar" aria-label="Experience toward level ${level.level + 1}" aria-valuemin="0" aria-valuemax="${level.required}" aria-valuenow="${level.current}"><span style="width:${pct}%"></span></span>` +
    (compact ? '' : `<small class="xp-next">${icon('sparkles')} ${level.remaining} XP to level ${level.level + 1} · ${level.xp} total</small>`) +
    `</div></div>`;
}

export class Levels {
  /**
   * @param {() => object[]} homes households
   * @param {{ onPlayer?: (level: object) => void, onChange?: () => void }} [o]
   */
  constructor(homes, { onPlayer, onChange } = {}) {
    this.homes = homes;
    this.onPlayer = onPlayer;
    this.onChange = onChange;
    this.seen = null;
    this.data = experience();
    this.notice = document.createElement('div');
    this.notice.className = 'xp-award glass';
    this.notice.setAttribute('role', 'status');
    this.notice.hidden = true;
    document.body.append(this.notice);
  }

  get player() { return this.data.player; }
  resident(project, slot) {
    const id = this.homes().find(h => h.project === project)?.characters.find(c => c.slot === slot)?.id;
    return this.data.agents[id] || this.data.residents[residentKey(project, slot)] || xpLevel(0);
  }

  setData(runs) {
    const next = experience(runs, this.homes()), fresh = this.seen ? next.awards.filter((a) => !this.seen.has(a.id)) : [];
    const prior = this.data; this.data = next; this.seen = new Set(next.awards.map((a) => a.id));
    this.onPlayer?.(next.player);
    if (fresh.length) {
      const names = fresh.map((a) => this.homes().find((h) => h.project === a.project)?.characters.find((c) => c.slot === a.slot)?.name || 'Agent');
      const playerUp = next.player.level > prior.player.level;
      const agentUp = fresh.some((a) => (next.residents[residentKey(a.project, a.slot)]?.level || 1) > (prior.residents[residentKey(a.project, a.slot)]?.level || 1));
      const totals = new Map();
      for (const name of names) totals.set(name, (totals.get(name) || 0) + RESPONSE_XP);
      this.notice.innerHTML = `${icon('sparkles')}<span>${[...totals].map(([name, xp]) => `<b>${name.replace(/[&<]/g, '')}</b> +${xp} XP`).join(' · ')} · You +${fresh.length * RESPONSE_XP} XP${playerUp ? ` · <b>You reached level ${next.player.level}!</b>` : ''}${agentUp ? ' · <b>Agent leveled up!</b>' : ''}</span>`;
      this.notice.hidden = false; clearTimeout(this.timer); this.timer = setTimeout(() => (this.notice.hidden = true), 6000);
    }
    this.onChange?.();
  }
}

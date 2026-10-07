import { usageWindow } from '../../shared/usage.mjs';
import { escapeHtml as esc } from './sim.js';
import { icon } from './icons.js';

export class ConnectedUsage {
  constructor({ compact = false } = {}) {
    this.compact = compact;
    this.element = document.createElement('details');
    this.element.className = compact ? 'connected-usage usage-account' : 'connected-usage';
    this.element.innerHTML = `${compact ? `<summary aria-label="Codex usage remaining" title="Codex usage remaining">${icon('gauge')}</summary>` : '<summary>Connected app usage</summary>'}<div class="usage-content" aria-live="polite">Open to check remaining usage.</div>`;
    if (compact) {
      document.addEventListener('pointerdown', e => { if (this.element.open && !this.element.contains(e.target)) this.element.open = false; });
      this.element.addEventListener('keydown', e => { if (e.key === 'Escape' && this.element.open) { e.preventDefault(); e.stopPropagation(); this.element.open = false; this.element.querySelector('summary').focus(); } });
    }
    this.element.addEventListener('toggle', () => {
      this.stop();
      if (this.element.open) this.start();
    });
  }
  mount(host) { host.append(this.element); }
  start() { this.stop(); this.load(); this.timer = setInterval(() => this.load(), 60000); }
  stop() { clearInterval(this.timer); this.controller?.abort(); }
  async load() {
    this.controller?.abort(); const controller = this.controller = new AbortController();
    const content = this.element.querySelector('.usage-content');
    content.textContent = 'Checking Codex usage…';
    try {
      const r = await fetch('/api/usage', { signal: controller.signal, cache: 'no-store' });
      if (!r.ok) throw new Error('Unavailable');
      const data = await r.json();
      if (controller.signal.aborted) return;
      this.render(data);
    } catch {
      if (!controller.signal.aborted) this.render({ status: 'unavailable' });
    }
  }
  render(data) {
    const content = this.element.querySelector('.usage-content');
    const available = data.status === 'available' && data.buckets?.length && Number.isFinite(Date.parse(data.capturedAt));
    if (this.compact) {
      content.innerHTML = `<div class="usage-account-heading"><span class="usage-avatar" aria-hidden="true">${icon('gauge')}</span><div><b>Codex</b><small>Usage remaining</small></div></div>${available ? data.buckets.map(bucket => `${data.buckets.length > 1 ? `<h4>${esc(bucket.name)}</h4>` : ''}${bucket.windows.map(w => {
        const v = usageWindow(w), date = w.resetsAt ? new Date(w.resetsAt * 1000) : null;
        const reset = date ? (w.minutes != null && w.minutes < 1440 ? date.toLocaleTimeString([], {hour:'numeric',minute:'2-digit'}) : date.toLocaleDateString([], {month:'short',day:'numeric'})) : 'Unknown';
        return `<div class="usage-account-row"><span>${esc(v.label.replace('5-hour','5h'))}</span><span>${v.expired ? 'Awaiting refresh' : `${esc(v.remaining)}%`}</span><time title="${esc(date?.toLocaleString()||'Reset unavailable')}">${esc(reset)}</time></div>`;
      }).join('')}`).join('') + `<small class="usage-account-note">Shared across Codex chats · checked ${esc(new Date(data.capturedAt).toLocaleTimeString([], {hour:'numeric',minute:'2-digit'}))}</small>` : '<p>Usage unavailable. Check the bridge and Codex sign-in.</p>'}<div class="usage-account-note">Claude and saved app chats: usage unavailable.</div>`;
      return;
    }
    content.innerHTML = `<b>Codex account</b>${available ? data.buckets.map(bucket => `<section><h4>${esc(bucket.name)}</h4>${bucket.windows.map(w => {
      const v = usageWindow(w); const reset = w.resetsAt ? new Date(w.resetsAt * 1000).toLocaleString() : null;
      return `<div class="usage-window"><div><span>${esc(v.label)}</span><strong>${v.expired ? 'Awaiting refresh' : `${esc(v.remaining)}% left`}</strong></div>${v.expired ? '' : `<progress max="100" value="${esc(v.remaining)}" aria-label="${esc(bucket.name)} ${esc(v.label)} remaining usage">${esc(v.remaining)}%</progress>`}<small>${reset ? `${v.expired ? 'Reset time passed' : 'Resets'} ${esc(reset)}` : 'Reset time unavailable'}</small></div>`;
    }).join('')}</section>`).join('') + `<small>Checked ${esc(new Date(data.capturedAt).toLocaleString())} · account-wide limits, shared across Codex sessions.</small>` : '<p>Usage unavailable. Check that the local bridge is up to date and Codex is installed and signed in with a supported account. No remaining amount is assumed.</p>'}<p class="usage-unsupported">Claude Code · Usage unavailable<br>Saved ChatGPT & Claude chats · Usage unavailable</p>`;
  }
}

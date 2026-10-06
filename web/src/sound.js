// "Needs you" sounds, synthesized with WebAudio (no assets). Each sound is triggered by truth:
// an agent starting to wait on you, or still waiting after a while.

const STORAGE_KEY = 'agent-world:sound';

const CUES = {
  // Permission / question: a clear two-note "ding-dong".
  permission: [
    { f: 784, at: 0, dur: 0.35, type: 'triangle', gain: 0.22 },
    { f: 587, at: 0.18, dur: 0.5, type: 'triangle', gain: 0.22 },
  ],
  // Turn finished: a soft rising arpeggio.
  turn_complete: [
    { f: 523, at: 0, dur: 0.25, type: 'sine', gain: 0.12 },
    { f: 659, at: 0.09, dur: 0.25, type: 'sine', gain: 0.12 },
    { f: 784, at: 0.18, dur: 0.45, type: 'sine', gain: 0.12 },
  ],
  // Still waiting: one low, gentle ping.
  reminder: [{ f: 440, at: 0, dur: 0.6, type: 'sine', gain: 0.1 }],
  // Photo mode (play layer, never a truth signal): a quick, dry camera click.
  shutter: [
    { f: 2200, at: 0, dur: 0.03, type: 'square', gain: 0.05 },
    { f: 1400, at: 0.06, dur: 0.04, type: 'square', gain: 0.04 },
  ],
};
const PLAY_CUES = new Set(['shutter']);

export class Sound {
  constructor() {
    this.enabled = read() !== 'off';
    this.ctx = null;
    this.lastAt = 0;
    // Browsers only allow audio after a user gesture.
    const unlock = () => {
      if (!this.ctx) this.ctx = new AudioContext();
      if (this.ctx.state === 'suspended') this.ctx.resume();
    };
    addEventListener('pointerdown', unlock);
    addEventListener('keydown', unlock);
  }

  toggle() {
    this.enabled = !this.enabled;
    write(this.enabled ? 'on' : 'off');
    if (this.enabled) this.play('turn_complete', { force: true });
    return this.enabled;
  }

  /** @param {'permission'|'turn_complete'|'reminder'|'shutter'} cue */
  play(cue, { force = false } = {}) {
    if (!this.enabled || !this.ctx || this.ctx.state !== 'running') return;
    // Play-layer sounds never take part in (or swallow) the "needs you" debounce.
    if (!PLAY_CUES.has(cue)) {
      const now = performance.now();
      if (!force && now - this.lastAt < 1500) return; // several agents at once → one chime
      this.lastAt = now;
    }

    const t0 = this.ctx.currentTime + 0.02;
    for (const n of CUES[cue] || CUES.permission) {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = n.type;
      osc.frequency.value = n.f;
      gain.gain.setValueAtTime(0, t0 + n.at);
      gain.gain.linearRampToValueAtTime(n.gain, t0 + n.at + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + n.at + n.dur);
      osc.connect(gain).connect(this.ctx.destination);
      osc.start(t0 + n.at);
      osc.stop(t0 + n.at + n.dur + 0.05);
    }
  }
}

function read() {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function write(v) {
  try {
    localStorage.setItem(STORAGE_KEY, v);
  } catch {}
}

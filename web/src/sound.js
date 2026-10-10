// "Needs you" sounds, synthesized with WebAudio (no assets). Each sound is triggered by truth:
// an agent starting to wait on you, or still waiting after a while.

import meadowAmbience from '../../audio/Meadows Ambience Sound Effect - Relaxing Ambient Nature Countryside - Free Audio Zone.mp3?url';

const TRACKS = Object.values(import.meta.glob(['../../audio/*.mp3', '!../../audio/Meadows*.mp3'], { eager: true, query: '?url', import: 'default' }));

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
    this.music = new Audio();
    this.music.volume = 0.2;
    this.music.preload = 'none';
    // Nature ambience is a separate, constant layer; never a shuffled soundtrack song.
    this.ambience = new Audio(meadowAmbience);
    this.ambience.loop = true;
    this.ambience.volume = 0.15;
    this.ambience.preload = 'none';
    this.ambienceFailed = false;
    this.ambience.addEventListener('error', () => { this.ambienceFailed = true; });
    this.playlist = [];
    this.lastTrack = null;
    this.failedTracks = new Set();
    this.unlocked = false;
    this.music.addEventListener('ended', () => this.nextTrack());
    this.music.addEventListener('error', () => {
      this.failedTracks.add(this.lastTrack);
      this.nextTrack();
    });
    // Browsers only allow audio after a user gesture.
    const unlock = () => {
      if (!this.ctx) this.ctx = new AudioContext();
      if (this.ctx.state === 'suspended') this.ctx.resume();
      this.unlocked = true;
      if (this.enabled && (this.music.paused || this.ambience.paused)) this.startMusic();
    };
    addEventListener('pointerdown', unlock);
    addEventListener('keydown', unlock);
  }

  toggle() {
    this.enabled = !this.enabled;
    write(this.enabled ? 'on' : 'off');
    if (this.enabled) { this.startMusic(); this.play('turn_complete', { force: true }); }
    else { this.music.pause(); this.ambience.pause(); }
    return this.enabled;
  }

  startMusic() {
    if (!this.enabled || !this.unlocked) return;
    if (!this.ambienceFailed && this.ambience.paused) this.ambience.play().catch(() => {});
    if (!this.lastTrack) this.nextTrack();
    else this.music.play().catch(() => {}); // autoplay can require another gesture
  }

  nextTrack() {
    if (!this.enabled || !this.unlocked) return;
    this.playlist = this.playlist.filter(track => !this.failedTracks.has(track));
    if (!this.playlist.length) {
      this.playlist = TRACKS.filter(track => !this.failedTracks.has(track));
      for (let i = this.playlist.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [this.playlist[i], this.playlist[j]] = [this.playlist[j], this.playlist[i]];
      }
      if (this.playlist.length > 1 && this.playlist[0] === this.lastTrack)
        [this.playlist[0], this.playlist[1]] = [this.playlist[1], this.playlist[0]];
    }
    const track = this.playlist.shift();
    if (!track) return;
    this.lastTrack = track;
    this.music.src = track;
    this.music.play().catch(() => {});
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

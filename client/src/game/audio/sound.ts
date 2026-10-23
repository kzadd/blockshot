// Sounds synthesised with WebAudio: no audio files needed.
import type { WeaponId } from '@blockshot/shared';

interface ShotPreset {
  /** lowpass start frequency */
  f: number;
  dur: number;
  /** low "thump" oscillator frequency */
  thump: number;
  v: number;
}

const PRESETS: Record<WeaponId, ShotPreset> = {
  rifle: { f: 2400, dur: 0.12, thump: 130, v: 0.9 },
  sniper: { f: 1500, dur: 0.38, thump: 70, v: 1.2 },
  shotgun: { f: 1300, dur: 0.3, thump: 80, v: 1.2 },
  smg: { f: 3200, dur: 0.08, thump: 170, v: 0.7 },
  lmg: { f: 1900, dur: 0.13, thump: 100, v: 0.95 },
  pistol: { f: 2800, dur: 0.1, thump: 180, v: 0.8 },
  revolver: { f: 1700, dur: 0.22, thump: 90, v: 1.1 },
  knife: { f: 5200, dur: 0.12, thump: 40, v: 0.35 }, // the whoosh of the slash
};

const MASTER_GAIN = 0.45;
const NOISE_SECONDS = 0.5;
const SILENT = 0.001;
/** Shots quieter than this are not played at all. */
const MIN_SHOT_VOLUME = 0.02;
const MIN_THUD_VOLUME = 0.01;

class Sfx {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private volume = 0.8;

  setVolume(v: number): void {
    this.volume = v;
    if (this.master) this.master.gain.value = MASTER_GAIN * v;
  }

  /** Browsers only allow audio after a user gesture: call this from a click or key handler. */
  unlock(): void {
    if (!this.ctx) {
      const AC =
        window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = MASTER_GAIN * this.volume;
      this.master.connect(this.ctx.destination);
      const len = this.ctx.sampleRate * NOISE_SECONDS;
      this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const data = this.noise.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
  }

  shot(kind: WeaponId | null | undefined, vol = 1): void {
    const { ctx, master } = this;
    if (!ctx || !master || vol < MIN_SHOT_VOLUME) return;
    const p = PRESETS[kind ?? 'rifle'];
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.setValueAtTime(p.f, t);
    f.frequency.exponentialRampToValueAtTime(250, t + p.dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol * p.v, t);
    g.gain.exponentialRampToValueAtTime(SILENT, t + p.dur);
    src.connect(f).connect(g).connect(master);
    src.start(t);
    src.stop(t + p.dur + 0.02);

    const o = ctx.createOscillator();
    o.frequency.setValueAtTime(p.thump, t);
    o.frequency.exponentialRampToValueAtTime(40, t + 0.12);
    const og = ctx.createGain();
    og.gain.setValueAtTime(vol * 0.6, t);
    og.gain.exponentialRampToValueAtTime(SILENT, t + 0.14);
    o.connect(og).connect(master);
    o.start(t);
    o.stop(t + 0.16);
  }

  blip(freq: number, dur: number, type: OscillatorType = 'square', vol = 0.2, delay = 0): void {
    const { ctx, master } = this;
    if (!ctx || !master) return;
    const t = ctx.currentTime + delay;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(SILENT, t + dur);
    o.connect(g).connect(master);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  hit(head: boolean, kill: boolean): void {
    this.blip(head ? 1600 : 1100, 0.05, 'square', 0.18);
    if (kill) this.blip(head ? 900 : 700, 0.18, 'triangle', 0.3, 0.05);
  }

  /** Short filtered noise: steps, landings and slides. */
  thud(freq: number, dur: number, vol: number, type: BiquadFilterType = 'lowpass'): void {
    const { ctx, master } = this;
    if (!ctx || !master || vol < MIN_THUD_VOLUME) return;
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(SILENT, t + dur);
    src.connect(f).connect(g).connect(master);
    src.start(t, Math.random() * 0.3);
    src.stop(t + dur + 0.02);
  }

  step(vol = 1): void {
    this.thud(380 + Math.random() * 120, 0.06, 0.16 * vol);
  }
  land(vol = 1): void {
    this.thud(260, 0.12, 0.45 * vol);
  }
  slide(): void {
    this.thud(1400, 0.4, 0.12, 'bandpass');
  }
  streak(): void {
    [523, 659, 784, 1047].forEach((f, i) => this.blip(f, 0.12, 'triangle', 0.22, i * 0.07));
  }
  hurt(): void {
    this.blip(150, 0.14, 'sawtooth', 0.25);
  }
  reload(): void {
    this.blip(420, 0.04, 'square', 0.12);
    this.blip(620, 0.04, 'square', 0.12, 0.12);
  }
  jump(): void {
    this.blip(260, 0.05, 'sine', 0.08);
  }
  /** Jump pad: upward sweep. */
  pad(): void {
    const { ctx, master } = this;
    if (!ctx || !master) return;
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    o.type = 'triangle';
    o.frequency.setValueAtTime(220, t);
    o.frequency.exponentialRampToValueAtTime(880, t + 0.22);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.22, t);
    g.gain.exponentialRampToValueAtTime(SILENT, t + 0.3);
    o.connect(g).connect(master);
    o.start(t);
    o.stop(t + 0.32);
  }
}

export const sfx = new Sfx();

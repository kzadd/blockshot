// Sonidos generados con WebAudio: no hace falta ningún archivo de audio.
const PRESETS = {
  rifle: { f: 2400, dur: 0.12, thump: 130, v: 0.9 },
  sniper: { f: 1500, dur: 0.38, thump: 70, v: 1.2 },
  shotgun: { f: 1300, dur: 0.3, thump: 80, v: 1.2 },
  smg: { f: 3200, dur: 0.08, thump: 170, v: 0.7 },
  lmg: { f: 1900, dur: 0.13, thump: 100, v: 0.95 },
  pistol: { f: 2800, dur: 0.1, thump: 180, v: 0.8 },
  revolver: { f: 1700, dur: 0.22, thump: 90, v: 1.1 },
  knife: { f: 5200, dur: 0.12, thump: 40, v: 0.35 }, // silbido del tajo
};

class Sfx {
  ctx = null;
  volume = 0.8;

  setVolume(v) {
    this.volume = v;
    if (this.master) this.master.gain.value = 0.45 * v;
  }

  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.45 * this.volume;
      this.master.connect(this.ctx.destination);
      const len = this.ctx.sampleRate * 0.5;
      this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const data = this.noise.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
  }

  shot(kind, vol = 1) {
    const ctx = this.ctx;
    if (!ctx || vol < 0.02) return;
    const p = PRESETS[kind] || PRESETS.rifle;
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.setValueAtTime(p.f, t);
    f.frequency.exponentialRampToValueAtTime(250, t + p.dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol * p.v, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + p.dur);
    src.connect(f).connect(g).connect(this.master);
    src.start(t);
    src.stop(t + p.dur + 0.02);

    const o = ctx.createOscillator();
    o.frequency.setValueAtTime(p.thump, t);
    o.frequency.exponentialRampToValueAtTime(40, t + 0.12);
    const og = ctx.createGain();
    og.gain.setValueAtTime(vol * 0.6, t);
    og.gain.exponentialRampToValueAtTime(0.001, t + 0.14);
    o.connect(og).connect(this.master);
    o.start(t);
    o.stop(t + 0.16);
  }

  blip(freq, dur, type = 'square', vol = 0.2, delay = 0) {
    const ctx = this.ctx;
    if (!ctx) return;
    const t = ctx.currentTime + delay;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g).connect(this.master);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  hit(head, kill) {
    this.blip(head ? 1600 : 1100, 0.05, 'square', 0.18);
    if (kill) this.blip(head ? 900 : 700, 0.18, 'triangle', 0.3, 0.05);
  }
  // Ruido filtrado corto: pasos, aterrizajes y deslizamientos
  thud(freq, dur, vol, type = 'lowpass') {
    const ctx = this.ctx;
    if (!ctx || vol < 0.01) return;
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(f).connect(g).connect(this.master);
    src.start(t, Math.random() * 0.3);
    src.stop(t + dur + 0.02);
  }

  step(vol = 1) {
    this.thud(380 + Math.random() * 120, 0.06, 0.16 * vol);
  }
  land(vol = 1) {
    this.thud(260, 0.12, 0.45 * vol);
  }
  slide() {
    this.thud(1400, 0.4, 0.12, 'bandpass');
  }
  streak() {
    [523, 659, 784, 1047].forEach((f, i) => this.blip(f, 0.12, 'triangle', 0.22, i * 0.07));
  }
  hurt() {
    this.blip(150, 0.14, 'sawtooth', 0.25);
  }
  reload() {
    this.blip(420, 0.04, 'square', 0.12);
    this.blip(620, 0.04, 'square', 0.12, 0.12);
  }
  jump() {
    this.blip(260, 0.05, 'sine', 0.08);
  }
  // Plataforma de salto: barrido hacia arriba
  pad() {
    const ctx = this.ctx;
    if (!ctx) return;
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    o.type = 'triangle';
    o.frequency.setValueAtTime(220, t);
    o.frequency.exponentialRampToValueAtTime(880, t + 0.22);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.22, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
    o.connect(g).connect(this.master);
    o.start(t);
    o.stop(t + 0.32);
  }
}

export const sfx = new Sfx();

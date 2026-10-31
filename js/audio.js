/* ============================================================
   ROOMS — процедурный звук (WebAudio, без внешних файлов)
   ============================================================ */
export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.comp = null;
    this.noise = null;
    this.volume = 0.7;
    this.muted = false;
    this.ambient = null;
    this.lastFootstep = 0;
  }

  init() {
    if (this.ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.comp = this.ctx.createDynamicsCompressor();
    this.comp.threshold.value = -16;
    this.comp.knee.value = 22;
    this.comp.ratio.value = 8;
    this.comp.attack.value = 0.002;
    this.comp.release.value = 0.28;
    this.master = this.ctx.createGain();
    this.master.gain.value = this.muted ? 0 : this.volume * 0.85;
    this.master.connect(this.comp);
    this.comp.connect(this.ctx.destination);
    this.noise = this.makeNoise(2.2);
  }

  async resume() {
    this.init();
    if (this.ctx && this.ctx.state !== 'running') {
      try { await this.ctx.resume(); } catch { /* ignore */ }
    }
  }

  setVolume(v) {
    this.volume = Math.max(0, Math.min(1, v));
    if (this.master && this.ctx) {
      this.master.gain.cancelScheduledValues(this.ctx.currentTime);
      this.master.gain.setTargetAtTime(this.muted ? 0 : this.volume * 0.85, this.ctx.currentTime, 0.05);
    }
  }

  setMuted(muted) {
    this.muted = !!muted;
    this.setVolume(this.volume);
  }

  makeNoise(seconds) {
    if (!this.ctx) return null;
    const len = Math.floor(this.ctx.sampleRate * seconds);
    const buffer = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    return buffer;
  }

  env(gain, t0, attack, hold, release, peak = 1) {
    const g = gain.gain;
    g.cancelScheduledValues(t0);
    g.setValueAtTime(0.0001, t0);
    g.exponentialRampToValueAtTime(Math.max(0.0002, peak), t0 + attack);
    g.setValueAtTime(Math.max(0.0002, peak), t0 + attack + hold);
    g.exponentialRampToValueAtTime(0.0001, t0 + attack + hold + release);
  }

  noiseBurst({ dur = 0.2, gain = 0.2, type = 'lowpass', freq = 600, q = 0.7, sweep = 0, delay = 0 }) {
    if (!this.ctx || !this.noise) return;
    const t = this.ctx.currentTime + delay;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noise;
    src.loop = true;
    const filter = this.ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.setValueAtTime(freq, t);
    if (sweep) filter.frequency.exponentialRampToValueAtTime(Math.max(30, sweep), t + dur);
    filter.Q.value = q;
    const g = this.ctx.createGain();
    this.env(g, t, 0.008, dur * 0.5, dur * 0.5, gain);
    src.connect(filter).connect(g).connect(this.master);
    src.start(t, Math.random() * 1.5);
    src.stop(t + dur + 0.05);
  }

  tone({ freq = 220, to = 0, dur = 0.3, gain = 0.1, type = 'sine', delay = 0, attack = 0.01, hold = 0.2, release = 0.1, detune = 0 }) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (to) osc.frequency.exponentialRampToValueAtTime(Math.max(20, to), t + dur);
    osc.detune.value = detune;
    const g = this.ctx.createGain();
    this.env(g, t, attack, hold, release, gain);
    osc.connect(g).connect(this.master);
    osc.start(t);
    osc.stop(t + attack + hold + release + 0.1);
  }

  click(up = false) {
    this.tone({ freq: up ? 660 : 440, to: up ? 880 : 320, dur: 0.08, gain: 0.06, type: 'square', hold: 0.01, release: 0.04 });
  }

  step() {
    if (!this.ctx) return;
    const n = this.ctx.currentTime;
    if (n - this.lastFootstep < 0.12) return;
    this.lastFootstep = n;
    this.noiseBurst({ dur: 0.13, gain: 0.12, type: 'lowpass', freq: 420, sweep: 130 });
    this.tone({ freq: 86, to: 48, dur: 0.16, gain: 0.09, type: 'sine', hold: 0.02, release: 0.1 });
  }

  door() {
    this.noiseBurst({ dur: 0.75, gain: 0.11, type: 'bandpass', freq: 620, q: 2.2, sweep: 180 });
    this.tone({ freq: 120, to: 58, dur: 0.9, gain: 0.06, type: 'sawtooth', hold: 0.1, release: 0.5 });
    this.noiseBurst({ dur: 0.09, gain: 0.22, type: 'lowpass', freq: 220, delay: 0.62 });
  }

  hide() {
    this.noiseBurst({ dur: 0.12, gain: 0.28, type: 'bandpass', freq: 1400, q: 1.2 });
    this.noiseBurst({ dur: 0.28, gain: 0.18, type: 'lowpass', freq: 360, delay: 0.1, sweep: 120 });
    this.tone({ freq: 76, to: 40, dur: 0.3, gain: 0.1, type: 'sine', hold: 0.02, release: 0.2, delay: 0.1 });
  }

  pickup() {
    this.tone({ freq: 720, to: 1180, dur: 0.18, gain: 0.08, type: 'triangle', hold: 0.04, release: 0.12 });
    this.tone({ freq: 1180, to: 1480, dur: 0.16, gain: 0.05, type: 'sine', delay: 0.12, hold: 0.02, release: 0.12 });
  }

  flashlight() {
    this.tone({ freq: 180, to: 90, dur: 0.05, gain: 0.07, type: 'square', hold: 0.005, release: 0.04 });
    this.noiseBurst({ dur: 0.04, gain: 0.08, type: 'highpass', freq: 2200 });
  }

  distantRoar() {
    this.tone({ freq: 58, to: 34, dur: 1.5, gain: 0.16, type: 'sawtooth', attack: 0.05, hold: 0.65, release: 0.7 });
    this.noiseBurst({ dur: 1.45, gain: 0.07, type: 'lowpass', freq: 280, sweep: 90 });
  }

  roar() {
    this.noiseBurst({ dur: 1.3, gain: 0.36, type: 'lowpass', freq: 1800, sweep: 120, q: 0.8 });
    this.tone({ freq: 74, to: 38, dur: 1.15, gain: 0.28, type: 'sawtooth', attack: 0.01, hold: 0.7, release: 0.35 });
    this.tone({ freq: 112, to: 54, dur: 1.0, gain: 0.18, type: 'square', attack: 0.01, hold: 0.6, release: 0.3, detune: -18 });
    this.tone({ freq: 46, to: 30, dur: 1.4, gain: 0.2, type: 'sine', attack: 0.02, hold: 0.9, release: 0.4 });
  }

  whisper() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noise;
    src.loop = true;
    const f = this.ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.setValueAtTime(900, t);
    f.frequency.linearRampToValueAtTime(1600, t + 1.1);
    f.Q.value = 6;
    const g = this.ctx.createGain();
    this.env(g, t, 0.35, 0.5, 0.7, 0.075);
    const p = this.ctx.createStereoPanner();
    p.pan.setValueAtTime(-0.6, t);
    p.pan.linearRampToValueAtTime(0.6, t + 1.2);
    src.connect(f).connect(g).connect(p).connect(this.master);
    src.start(t, Math.random());
    src.stop(t + 1.7);
  }

  hum(dur = 2.2) {
    this.tone({ freq: 62, to: 55, dur, gain: 0.1, type: 'sine', attack: 0.25, hold: dur * 0.6, release: 0.5 });
    this.tone({ freq: 124, to: 117, dur, gain: 0.035, type: 'sawtooth', attack: 0.4, hold: dur * 0.5, release: 0.6, detune: 4 });
  }

  heartbeat(intensity = 1) {
    this.tone({ freq: 54, to: 32, dur: 0.16, gain: 0.2 * intensity, type: 'sine', hold: 0.01, release: 0.12 });
    this.tone({ freq: 48, to: 28, dur: 0.15, gain: 0.15 * intensity, type: 'sine', delay: 0.19, hold: 0.01, release: 0.12 });
  }

  static(dur = 0.5, gain = 0.14) {
    this.noiseBurst({ dur, gain, type: 'highpass', freq: 900, q: 0.5 });
  }

  sting() {
    this.noiseBurst({ dur: 0.4, gain: 0.4, type: 'highpass', freq: 700 });
    this.tone({ freq: 1300, to: 120, dur: 0.5, gain: 0.16, type: 'sawtooth', hold: 0.02, release: 0.35 });
  }

  hit() {
    this.tone({ freq: 64, to: 28, dur: 0.55, gain: 0.35, type: 'sine', attack: 0.004, hold: 0.12, release: 0.4 });
    this.noiseBurst({ dur: 0.3, gain: 0.25, type: 'lowpass', freq: 700, sweep: 100 });
  }

  creak() {
    this.noiseBurst({ dur: 0.9, gain: 0.035, type: 'bandpass', freq: 500 + Math.random() * 900, q: 14, sweep: 260 });
  }

  win() {
    const notes = [261.6, 329.6, 392, 523.3];
    notes.forEach((f, i) => {
      this.tone({ freq: f, dur: 1.2, gain: 0.06, type: 'sine', delay: i * 0.16, attack: 0.05, hold: 0.5, release: 0.7 });
    });
    this.tone({ freq: 130.8, dur: 2.2, gain: 0.05, type: 'triangle', attack: 0.2, hold: 1.1, release: 0.8 });
  }

  startAmbient() {
    if (!this.ctx || this.ambient) return;
    const t = this.ctx.currentTime;
    const bus = this.ctx.createGain();
    bus.gain.setValueAtTime(0.0001, t);
    bus.gain.exponentialRampToValueAtTime(0.32, t + 2.4);
    bus.connect(this.master);

    const drone = this.ctx.createOscillator();
    drone.type = 'sine';
    drone.frequency.value = 48;
    const droneGain = this.ctx.createGain();
    droneGain.gain.value = 0.045;

    const drone2 = this.ctx.createOscillator();
    drone2.type = 'triangle';
    drone2.frequency.value = 72.4;
    const drone2Gain = this.ctx.createGain();
    drone2Gain.gain.value = 0.012;

    const lfo = this.ctx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.value = 0.07;
    const lfoGain = this.ctx.createGain();
    lfoGain.gain.value = 1.7;
    lfo.connect(lfoGain);
    lfoGain.connect(drone.frequency);
    lfoGain.connect(drone2.frequency);

    const air = this.ctx.createBufferSource();
    air.buffer = this.noise;
    air.loop = true;
    const airFilter = this.ctx.createBiquadFilter();
    airFilter.type = 'lowpass';
    airFilter.frequency.value = 260;
    const airGain = this.ctx.createGain();
    airGain.gain.value = 0.02;

    drone.connect(droneGain).connect(bus);
    drone2.connect(drone2Gain).connect(bus);
    air.connect(airFilter).connect(airGain).connect(bus);
    drone.start(t); drone2.start(t); lfo.start(t); air.start(t);

    this.ambient = { bus, nodes: [drone, drone2, lfo, air] };
  }

  stopAmbient() {
    if (!this.ambient || !this.ctx) return;
    const a = this.ambient;
    this.ambient = null;
    const t = this.ctx.currentTime;
    a.bus.gain.cancelScheduledValues(t);
    a.bus.gain.setTargetAtTime(0.0001, t, 0.35);
    setTimeout(() => {
      try { a.nodes.forEach(n => n.stop()); } catch { /* ignore */ }
      try { a.bus.disconnect(); } catch { /* ignore */ }
    }, 1200);
  }
}

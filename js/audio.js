/* Tiny procedural audio engine — no external assets. */

export class AudioEngine {
  constructor(muted = false) {
    this.ctx = null;
    this.master = null;
    this.muted = muted;
    this.ambience = null;
    this.noiseBuffer = null;
    this.lastStatic = 0;
  }

  ensure() {
    if (this.muted) return null;
    if (!this.ctx) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return null;
      this.ctx = new Ctx();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.55;
      this.master.connect(this.ctx.destination);
      this.noiseBuffer = this.makeNoise(2);
    }
    if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
    return this.ctx;
  }

  makeNoise(seconds) {
    const rate = this.ctx.sampleRate;
    const buffer = this.ctx.createBuffer(1, rate * seconds, rate);
    const data = buffer.getChannelData(0);
    let last = 0;
    for (let i = 0; i < data.length; i++) {
      const white = Math.random() * 2 - 1;
      last = (last + 0.02 * white) / 1.02;
      data[i] = last * 3.2;
    }
    return buffer;
  }

  setMuted(muted) {
    this.muted = muted;
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(muted ? 0 : 0.55, this.ctx.currentTime, 0.05);
    }
    if (muted) this.stopAmbience();
  }

  _tone(freq, duration, { type = 'sine', volume = 0.08, slide = 0, delay = 0, attack = 0.005 } = {}) {
    const ctx = this.ensure();
    if (!ctx) return;
    const t0 = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slide), t0 + duration);
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.linearRampToValueAtTime(volume, t0 + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
    osc.connect(gain).connect(this.master);
    osc.start(t0);
    osc.stop(t0 + duration + 0.05);
  }

  _noise(duration, { volume = 0.08, freq = 1200, q = 0.8, delay = 0, type = 'bandpass', slide = 0 } = {}) {
    const ctx = this.ensure();
    if (!ctx) return;
    const t0 = ctx.currentTime + delay;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    src.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.setValueAtTime(freq, t0);
    if (slide) filter.frequency.exponentialRampToValueAtTime(Math.max(60, slide), t0 + duration);
    filter.Q.value = q;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.linearRampToValueAtTime(volume, t0 + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
    src.connect(filter).connect(gain).connect(this.master);
    src.start(t0);
    src.stop(t0 + duration + 0.05);
  }

  startAmbience(mode = 'lobby') {
    const ctx = this.ensure();
    if (!ctx) return;
    if (this.ambience) this.stopAmbience();
    const bus = ctx.createGain();
    bus.gain.value = 0.0001;
    bus.connect(this.master);

    const droneGain = ctx.createGain();
    droneGain.gain.value = mode === 'office' ? 0.03 : 0.018;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = mode === 'office' ? 260 : 180;
    filter.Q.value = 0.6;
    droneGain.connect(filter).connect(bus);

    const oscs = [];
    const base = mode === 'office' ? 48 : 41;
    [1, 1.005, 1.5].forEach((mult, i) => {
      const osc = ctx.createOscillator();
      osc.type = i === 2 ? 'triangle' : 'sawtooth';
      osc.frequency.value = base * mult;
      const g = ctx.createGain();
      g.gain.value = i === 2 ? 0.22 : 0.5;
      osc.connect(g).connect(droneGain);
      osc.start();
      oscs.push(osc);
    });

    const fanSrc = ctx.createBufferSource();
    fanSrc.buffer = this.noiseBuffer;
    fanSrc.loop = true;
    const fanFilter = ctx.createBiquadFilter();
    fanFilter.type = 'lowpass';
    fanFilter.frequency.value = mode === 'office' ? 420 : 300;
    const fanGain = ctx.createGain();
    fanGain.gain.value = mode === 'office' ? 0.022 : 0.012;
    fanSrc.connect(fanFilter).connect(fanGain).connect(bus);
    fanSrc.start();

    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    lfo.frequency.value = 0.12;
    lfoGain.gain.value = mode === 'office' ? 90 : 50;
    lfo.connect(lfoGain).connect(fanFilter.frequency);
    lfo.start();

    bus.gain.setTargetAtTime(1, ctx.currentTime, 1.2);
    this.ambience = { bus, oscs, fanSrc, lfo, filter, droneGain, fanFilter };
  }

  setTension(value) {
    if (!this.ambience || !this.ctx) return;
    const v = Math.max(0, Math.min(1, value));
    const t = this.ctx.currentTime;
    this.ambience.filter.frequency.setTargetAtTime(240 + v * 900, t, 0.4);
    this.ambience.droneGain.gain.setTargetAtTime(0.025 + v * 0.05, t, 0.4);
    this.ambience.fanFilter.frequency.setTargetAtTime(380 + v * 700, t, 0.4);
  }

  stopAmbience() {
    if (!this.ambience || !this.ctx) return;
    const { bus, oscs, fanSrc, lfo } = this.ambience;
    const t = this.ctx.currentTime;
    try {
      bus.gain.cancelScheduledValues(t);
      bus.gain.setTargetAtTime(0.0001, t, 0.15);
      oscs.forEach((o) => o.stop(t + 0.8));
      fanSrc.stop(t + 0.8);
      lfo.stop(t + 0.8);
    } catch {}
    this.ambience = null;
  }

  sfx(name, detail = {}) {
    if (this.muted) return;
    switch (name) {
      case 'click':
        this._tone(760, 0.05, { type: 'square', volume: 0.035, slide: 520 });
        break;
      case 'open':
        this._noise(0.16, { volume: 0.05, freq: 900, type: 'highpass' });
        this._tone(120, 0.18, { type: 'triangle', volume: 0.05, slide: 80 });
        break;
      case 'close':
        this._noise(0.1, { volume: 0.045, freq: 600, q: 0.6 });
        this._tone(90, 0.2, { type: 'triangle', volume: 0.07, slide: 50 });
        break;
      case 'doorDown':
        this._tone(64, 0.7, { type: 'sawtooth', volume: 0.12, slide: 34 });
        this._noise(0.55, { volume: 0.11, freq: 420, type: 'lowpass', slide: 120 });
        this._noise(0.16, { volume: 0.09, freq: 2400, type: 'bandpass', delay: 0.42 });
        break;
      case 'bang':
        this._tone(52, 1.1, { type: 'sine', volume: 0.22, slide: 28 });
        this._noise(0.6, { volume: 0.18, freq: 260, type: 'lowpass' });
        this._noise(0.18, { volume: 0.12, freq: 1800, type: 'bandpass', delay: 0.06 });
        break;
      case 'step':
        this._tone(44, 0.28, { type: 'sine', volume: 0.11, slide: 32 });
        this._noise(0.12, { volume: 0.04, freq: 320, type: 'lowpass' });
        break;
      case 'camera':
        this._noise(0.12, { volume: 0.06, freq: 2600, type: 'highpass' });
        this._tone(880, 0.04, { type: 'square', volume: 0.025 });
        break;
      case 'static':
        {
          const now = performance.now();
          if (now - this.lastStatic < 160) return;
          this.lastStatic = now;
        }
        this._noise(0.2, { volume: 0.09, freq: 1800, q: 0.4 });
        break;
      case 'jam':
        this._noise(0.5, { volume: 0.13, freq: 3000, type: 'highpass', slide: 500 });
        this._tone(1300, 0.35, { type: 'sawtooth', volume: 0.035, slide: 300 });
        break;
      case 'whisper':
        this._noise(0.9, { volume: 0.055, freq: 2200, q: 1.5, slide: 900 });
        this._tone(1180, 0.6, { type: 'sine', volume: 0.018, slide: 700 });
        break;
      case 'found':
        this._tone(660, 0.25, { type: 'sine', volume: 0.06, slide: 990 });
        this._tone(1320, 0.3, { type: 'sine', volume: 0.03, delay: 0.08 });
        break;
      case 'hurt':
        this._tone(140, 0.7, { type: 'sawtooth', volume: 0.16, slide: 48 });
        this._noise(0.5, { volume: 0.2, freq: 700, type: 'lowpass', slide: 160 });
        break;
      case 'ring':
        this._tone(3100, Math.min(2.4, detail.duration || 1.5), { type: 'sine', volume: 0.028, attack: 0.05 });
        this._tone(3260, Math.min(2.4, detail.duration || 1.5), { type: 'sine', volume: 0.018, attack: 0.05 });
        break;
      case 'freeze':
        this._tone(1900, 0.4, { type: 'square', volume: 0.06, slide: 180 });
        this._noise(0.8, { volume: 0.16, freq: 3400, type: 'highpass', slide: 200 });
        break;
      case 'alarm':
        this._tone(520, 0.22, { type: 'square', volume: 0.05 });
        this._tone(680, 0.22, { type: 'square', volume: 0.05, delay: 0.24 });
        break;
      case 'blackout':
        this._tone(120, 1.5, { type: 'sawtooth', volume: 0.13, slide: 30 });
        this._noise(1.2, { volume: 0.1, freq: 900, type: 'lowpass', slide: 80 });
        break;
      case 'chime':
        this._tone(523, 0.6, { type: 'sine', volume: 0.055 });
        this._tone(659, 0.6, { type: 'sine', volume: 0.045, delay: 0.18 });
        this._tone(784, 0.8, { type: 'sine', volume: 0.04, delay: 0.36 });
        break;
      case 'success':
        [392, 494, 587, 784].forEach((f, i) =>
          this._tone(f, 0.5, { type: 'triangle', volume: 0.05, delay: i * 0.14 }),
        );
        break;
      case 'buy':
        this._tone(880, 0.08, { type: 'square', volume: 0.04 });
        this._tone(1320, 0.12, { type: 'square', volume: 0.035, delay: 0.08 });
        break;
      case 'error':
        this._tone(160, 0.22, { type: 'square', volume: 0.06, slide: 110 });
        break;
      case 'unlock':
        [262, 330, 392, 523, 784].forEach((f, i) =>
          this._tone(f, 0.65, { type: 'sine', volume: 0.045, delay: i * 0.16 }),
        );
        break;
      case 'jumpscare':
        this._noise(1.1, { volume: 0.34, freq: 1600, q: 0.3 });
        this._tone(110, 1.2, { type: 'sawtooth', volume: 0.24, slide: 900 });
        this._tone(147, 1.2, { type: 'square', volume: 0.12, slide: 60 });
        this._tone(233, 0.8, { type: 'sawtooth', volume: 0.1, slide: 40 });
        break;
      default:
        break;
    }
  }
}

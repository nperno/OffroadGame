'use strict';

/**
 * SoundManager — procedural audio via Web Audio API.
 * No external assets. All sounds generated from oscillators + noise.
 * Singleton: use the global `Sounds` object.
 */
class SoundManager {
  constructor() {
    this.ctx    = null;
    this.master = null;
    this.muted  = false;

    // Persistent nodes (engine + off-track rumble)
    this._engOsc1      = null;
    this._engOsc2      = null;
    this._engFilter    = null;
    this._engGain      = null;
    this._otOsc        = null;
    this._otGain       = null;
  }

  // ── Initialise (call after first user gesture) ────────────────────────────
  init() {
    if (this.ctx) return;
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      this.master = this.ctx.createGain();
      this.master.gain.value = 1;
      this.master.connect(this.ctx.destination);
      this._buildEngine();
      this._buildOffTrack();
    } catch (e) {
      console.warn('[SoundManager] Web Audio unavailable:', e);
    }
  }

  resume() {
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
  }

  toggleMute() {
    if (!this.ctx) return (this.muted = !this.muted);
    this.muted = !this.muted;
    this.master.gain.setTargetAtTime(this.muted ? 0 : 1, this.ctx.currentTime, 0.08);
    return this.muted;
  }

  // ── Engine sound (persistent oscillators) ─────────────────────────────────
  _buildEngine() {
    const ctx = this.ctx;

    this._engGain = ctx.createGain();
    this._engGain.gain.value = 0;

    this._engFilter = ctx.createBiquadFilter();
    this._engFilter.type = 'lowpass';
    this._engFilter.frequency.value = 250;
    this._engFilter.Q.value = 1.8;

    // Soft waveshaper for diesel grit
    const dist = ctx.createWaveShaper();
    dist.curve = this._distortionCurve(30);
    dist.oversample = '2x';

    // Osc 1: sawtooth — main engine tone
    this._engOsc1 = ctx.createOscillator();
    this._engOsc1.type = 'sawtooth';
    this._engOsc1.frequency.value = 68;

    const g1 = ctx.createGain();
    g1.gain.value = 0.55;

    // Osc 2: square — one octave lower, diesel thump
    this._engOsc2 = ctx.createOscillator();
    this._engOsc2.type = 'square';
    this._engOsc2.frequency.value = 34;

    const g2 = ctx.createGain();
    g2.gain.value = 0.28;

    this._engOsc1.connect(g1).connect(dist);
    this._engOsc2.connect(g2).connect(dist);
    dist.connect(this._engFilter);
    this._engFilter.connect(this._engGain);
    this._engGain.connect(this.master);

    this._engOsc1.start();
    this._engOsc2.start();
  }

  // Off-track rumble (persistent, gain toggled on/off)
  _buildOffTrack() {
    const ctx = this.ctx;

    this._otGain = ctx.createGain();
    this._otGain.gain.value = 0;

    this._otOsc = ctx.createOscillator();
    this._otOsc.type = 'sawtooth';
    this._otOsc.frequency.value = 42;

    const filt = ctx.createBiquadFilter();
    filt.type = 'bandpass';
    filt.frequency.value = 110;
    filt.Q.value = 2.5;

    this._otOsc.connect(filt);
    filt.connect(this._otGain);
    this._otGain.connect(this.master);

    this._otOsc.start();
  }

  // ── Per-frame update calls ────────────────────────────────────────────────

  /** speedNorm: 0–1 (currentSpeed / MAX_SPEED) */
  updateEngine(speedNorm) {
    if (!this.ctx) return;
    const t   = this.ctx.currentTime;
    const spd = Math.max(0, Math.min(1, Math.abs(speedNorm)));

    // Frequency sweep: 62 Hz (idle) → 210 Hz (redline)
    this._engOsc1.frequency.setTargetAtTime(62 + spd * 148, t, 0.09);
    this._engOsc2.frequency.setTargetAtTime(31 + spd * 74,  t, 0.09);

    // Filter opens as RPM climbs
    this._engFilter.frequency.setTargetAtTime(250 + spd * 2200, t, 0.06);

    // Master engine volume — gentle at idle, louder under load
    const gain = 0.025 + spd * 0.155;
    this._engGain.gain.setTargetAtTime(gain, t, 0.12);
  }

  /** Fade the off-track rumble layer in/out */
  setOffTrack(active) {
    if (!this.ctx) return;
    const target = active ? 0.09 : 0;
    this._otGain.gain.setTargetAtTime(target, this.ctx.currentTime, 0.12);
    // Also raise the off-track osc pitch slightly so it stands out
    const freq = active ? 52 : 42;
    this._otOsc.frequency.setTargetAtTime(freq, this.ctx.currentTime, 0.1);
  }

  // ── One-shot events ───────────────────────────────────────────────────────

  obstacleHit() {
    if (!this.ctx) return;
    // Metallic thud: pitched noise + low tone
    this._noise(0.28, 0.38, 700, 1.2);
    this._tone(90,  0.22, 'triangle', 0.35);
    this._tone(55,  0.30, 'sawtooth', 0.22, 0.02);
  }

  takeDamage() {
    if (!this.ctx) return;
    this._noise(0.14, 0.22, 900, 2.0);
  }

  checkpoint() {
    if (!this.ctx) return;
    // Bright ascending arpeggio: C5-E5-G5
    [[523, 0], [659, 0.10], [784, 0.20]].forEach(([f, d]) =>
      this._tone(f, 0.18, 'sine', 0.30, d)
    );
  }

  levelComplete() {
    if (!this.ctx) return;
    // 6-note triumphant fanfare
    [
      [523, 0.00], [659, 0.13], [784, 0.26],
      [1047, 0.40], [784, 0.56], [1047, 0.70],
    ].forEach(([f, d]) => this._tone(f, 0.24, 'sine', 0.42, d));
  }

  countdownBeep(isGo = false) {
    if (!this.ctx) return;
    if (isGo) {
      this._tone(880, 0.38, 'sine',  0.50);
      this._tone(1320, 0.26, 'sine', 0.30, 0.05);
    } else {
      this._tone(440, 0.18, 'sine', 0.42);
    }
  }

  loseLife() {
    if (!this.ctx) return;
    // Descending sad tones
    [[440, 0.00], [370, 0.16], [294, 0.32]].forEach(([f, d]) =>
      this._tone(f, 0.22, 'sawtooth', 0.28, d)
    );
    this._noise(0.20, 0.18, 400, 0.8, 0.1);
  }

  gameOver() {
    if (!this.ctx) return;
    [[392, 0.00], [330, 0.22], [277, 0.44], [220, 0.68]].forEach(([f, d]) =>
      this._tone(f, 0.32, 'sawtooth', 0.32, d)
    );
  }

  hazardEnter(hazardType) {
    if (!this.ctx) return;
    if (hazardType === 'water' || hazardType === 'cliff') {
      // Alarming splash
      this._noise(0.22, 0.45, 1200, 2.5);
      this._tone(220, 0.20, 'square', 0.20);
    } else if (hazardType === 'lava') {
      this._noise(0.18, 0.30, 400, 0.6);
      this._tone(150, 0.22, 'sawtooth', 0.18);
    } else {
      // Mud / swamp / sand splash
      this._noise(0.14, 0.22, 600, 1.2);
      this._tone(180, 0.14, 'triangle', 0.14);
    }
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  _tone(freq, dur, type = 'sine', peak = 0.3, delay = 0) {
    const ctx = this.ctx;
    const t   = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const env = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    env.gain.setValueAtTime(0, t);
    env.gain.linearRampToValueAtTime(peak, t + 0.013);
    env.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(env).connect(this.master);
    osc.start(t);
    osc.stop(t + dur + 0.06);
  }

  _noise(dur, peak = 0.2, filterFreq = 800, filterQ = 0.8, delay = 0) {
    const ctx    = this.ctx;
    const t      = ctx.currentTime + delay;
    const len    = Math.ceil(ctx.sampleRate * (dur + 0.12));
    const buf    = ctx.createBuffer(1, len, ctx.sampleRate);
    const data   = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;

    const src  = ctx.createBufferSource();
    src.buffer = buf;

    const filt = ctx.createBiquadFilter();
    filt.type      = 'bandpass';
    filt.frequency.value = filterFreq;
    filt.Q.value   = filterQ;

    const env = ctx.createGain();
    env.gain.setValueAtTime(peak, t);
    env.gain.exponentialRampToValueAtTime(0.001, t + dur);

    src.connect(filt).connect(env).connect(this.master);
    src.start(t);
    src.stop(t + dur + 0.12);
  }

  _distortionCurve(amount) {
    const n = 256, curve = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const x = (i * 2) / n - 1;
      curve[i] = ((3 + amount) * x * 20 * (Math.PI / 180)) /
                 (Math.PI + amount * Math.abs(x));
    }
    return curve;
  }
}

// Global singleton
const Sounds = new SoundManager();

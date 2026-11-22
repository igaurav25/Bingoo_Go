/**
 * public/js/audio.js
 * 
 * Web Audio API procedural sound synthesizer.
 * Provides authentic pencil/paper and ink sounds with zero external audio assets.
 * Respects user mute toggle.
 */

class SoundManager {
  constructor() {
    this.ctx = null;
    this.isMuted = false;
    try {
      this.isMuted = localStorage.getItem('bingo_mute') === 'true';
    } catch {
      this.isMuted = false;
    }
  }

  _initCtx() {
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  }

  toggleMute() {
    this.isMuted = !this.isMuted;
    try {
      localStorage.setItem('bingo_mute', String(this.isMuted));
    } catch {}
    return this.isMuted;
  }

  /**
   * Sound of marking a number: subtle ink stamp / pencil tap.
   */
  playMark() {
    if (this.isMuted) return;
    this._initCtx();
    if (!this.ctx) return;

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(320, t);
    osc.frequency.exponentialRampToValueAtTime(140, t + 0.08);

    gain.gain.setValueAtTime(0.2, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.08);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(t);
    osc.stop(t + 0.08);
  }

  /**
   * Sound of drawing a continuous pen line stroke.
   */
  playLineStroke(durationMs = 450) {
    if (this.isMuted) return;
    this._initCtx();
    if (!this.ctx) return;

    const t = this.ctx.currentTime;
    const durSec = Math.max(0.1, durationMs / 1000);

    // Noise buffer for paper friction texture
    const bufferSize = Math.floor(this.ctx.sampleRate * durSec);
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * 0.15;
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(800, t);
    filter.frequency.linearRampToValueAtTime(1400, t + durSec);
    filter.Q.setValueAtTime(3, t);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.01, t);
    gain.gain.linearRampToValueAtTime(0.25, t + durSec * 0.2);
    gain.gain.exponentialRampToValueAtTime(0.001, t + durSec);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);

    noise.start(t);
    noise.stop(t + durSec);
  }

  /**
   * Sound of striking out a B-I-N-G-O letter.
   */
  playLetterStrike() {
    if (this.isMuted) return;
    this._initCtx();
    if (!this.ctx) return;

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(520, t);
    osc.frequency.exponentialRampToValueAtTime(780, t + 0.15);

    gain.gain.setValueAtTime(0.18, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.18);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(t);
    osc.stop(t + 0.18);
  }

  /**
   * Sound when the BINGO button unlocks / glows ready.
   */
  playButtonReady() {
    if (this.isMuted) return;
    this._initCtx();
    if (!this.ctx) return;

    const t = this.ctx.currentTime;
    const notes = [440, 554.37, 659.25]; // A4, C#5, E5 major chord
    notes.forEach((freq, idx) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t + idx * 0.05);

      gain.gain.setValueAtTime(0.12, t + idx * 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, t + idx * 0.05 + 0.35);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(t + idx * 0.05);
      osc.stop(t + idx * 0.05 + 0.35);
    });
  }

  /**
   * Victory fanfare on BINGO win.
   */
  playVictory() {
    if (this.isMuted) return;
    this._initCtx();
    if (!this.ctx) return;

    const t = this.ctx.currentTime;
    const chord = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
    chord.forEach((freq, i) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, t + i * 0.09);

      gain.gain.setValueAtTime(0.2, t + i * 0.09);
      gain.gain.exponentialRampToValueAtTime(0.001, t + i * 0.09 + 0.6);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(t + i * 0.09);
      osc.stop(t + i * 0.09 + 0.6);
    });
  }
}

export const soundManager = new SoundManager();

/**
 * public/js/audio.js
 * 
 * Web Audio API procedural sound synthesizer & haptic manager.
 * Provides authentic pencil/paper, ink strikes, chimes, and fanfares with zero external audio assets.
 * Respects user mute and vibration toggles in Settings.
 */

class SoundManager {
  constructor() {
    this.ctx = null;
    this.isMuted = false;
    this.vibrationEnabled = true;
    this.musicEnabled = false;
    this.volume = 0.75;
    this._musicTimer = null;

    try {
      this.isMuted = localStorage.getItem('bingo_mute') === 'true';
      this.vibrationEnabled = localStorage.getItem('bingo_vibrate') !== 'false';
      this.musicEnabled = localStorage.getItem('bingo_music') === 'true';
      const savedVol = parseFloat(localStorage.getItem('bingo_volume'));
      if (Number.isFinite(savedVol) && savedVol >= 0 && savedVol <= 1) {
        this.volume = savedVol;
      }
    } catch {
      this.isMuted = false;
      this.vibrationEnabled = true;
      this.musicEnabled = false;
      this.volume = 0.75;
    }
  }

  _vol(base) {
    return Math.max(0.0005, base * this.volume);
  }

  _initCtx() {
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
        this._masterGain = this.ctx.createGain();
        this._masterGain.gain.setValueAtTime(this.volume, this.ctx.currentTime);
        this._masterGain.connect(this.ctx.destination);
      }
    }
    if (this._masterGain && this.ctx) {
      this._masterGain.gain.setValueAtTime(this.volume, this.ctx.currentTime);
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  }

  _dest() {
    return this._masterGain || this.ctx?.destination;
  }

  toggleMute(val) {
    if (typeof val === 'boolean') {
      this.isMuted = val;
    } else {
      this.isMuted = !this.isMuted;
    }
    try {
      localStorage.setItem('bingo_mute', String(this.isMuted));
    } catch {}
    if (this.isMuted) {
      this._stopAmbientPad();
    } else if (this.musicEnabled) {
      this._startAmbientPad();
    }
    return this.isMuted;
  }

  setVolume(val) {
    const clamped = Math.max(0, Math.min(1, Number(val)));
    this.volume = Number.isFinite(clamped) ? clamped : 0.75;
    if (this._masterGain && this.ctx) {
      this._masterGain.gain.setValueAtTime(this.volume, this.ctx.currentTime);
    }
    try {
      localStorage.setItem('bingo_volume', String(this.volume));
    } catch {}
    return this.volume;
  }

  toggleMusic(val) {
    this.musicEnabled = typeof val === 'boolean' ? val : !this.musicEnabled;
    try {
      localStorage.setItem('bingo_music', String(this.musicEnabled));
    } catch {}
    if (this.musicEnabled && !this.isMuted) {
      this._startAmbientPad();
    } else {
      this._stopAmbientPad();
    }
    return this.musicEnabled;
  }

  _startAmbientPad() {
    if (this._musicTimer || this.isMuted || !this.musicEnabled || typeof window === 'undefined') return;
    const playBar = () => {
      if (this.isMuted || !this.musicEnabled) return;
      this._initCtx();
      if (!this.ctx || this.ctx.state !== 'running') return;
      const chord = [220, 261.63, 329.63, 392.0]; // Am7 soft lounge pad
      const t = this.ctx.currentTime;
      chord.forEach((freq, idx) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, t + idx * 0.04);
        gain.gain.setValueAtTime(0.0005, t);
        gain.gain.linearRampToValueAtTime(this._vol(0.025), t + 0.6);
        gain.gain.exponentialRampToValueAtTime(0.0005, t + 3.2);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(t);
        osc.stop(t + 3.25);
      });
    };
    playBar();
    this._musicTimer = setInterval(playBar, 3600);
  }

  _stopAmbientPad() {
    if (this._musicTimer) {
      clearInterval(this._musicTimer);
      this._musicTimer = null;
    }
  }

  setVibration(enabled) {
    this.vibrationEnabled = !!enabled;
    try {
      localStorage.setItem('bingo_vibrate', String(this.vibrationEnabled));
    } catch {}
  }

  _vibrate(pattern) {
    if (!this.vibrationEnabled) return;
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      try {
        navigator.vibrate(pattern);
      } catch {}
    }
  }

  /**
   * Sound: Light button tap (subtle sine chirp)
   */
  playTap() {
    this._vibrate(15);
    if (this.isMuted) return;
    this._initCtx();
    if (!this.ctx) return;

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(560, t);
    osc.frequency.exponentialRampToValueAtTime(380, t + 0.035);

    gain.gain.setValueAtTime(0.12, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.035);

    osc.connect(gain);
    gain.connect(this._dest());
    osc.start(t);
    osc.stop(t + 0.035);
  }

  /**
   * Sound: Marking a number (pencil graphite friction on paper)
   */
  playMark() {
    this._vibrate(20);
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
    gain.connect(this._dest());
    osc.start(t);
    osc.stop(t + 0.08);
  }

  /**
   * Sound: Continuous red-pen stroke on ruled paper
   */
  playLineStroke(durationMs = 450) {
    this._vibrate([25, 30, 25]);
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
    gain.connect(this._dest());

    noise.start(t);
    noise.stop(t + durSec);
  }

  /**
   * Sound: Striking out a B-I-N-G-O letter
   */
  playLetterStrike() {
    this._vibrate(30);
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
    gain.connect(this._dest());
    osc.start(t);
    osc.stop(t + 0.18);
  }

  /**
   * Sound: Golden shimmer when BINGO button activates
   */
  playButtonReady() {
    this._vibrate([40, 40, 80]);
    if (this.isMuted) return;
    this._initCtx();
    if (!this.ctx) return;

    const t = this.ctx.currentTime;
    const notes = [440, 554.37, 659.25, 880]; // A4, C#5, E5, A5
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
   * Sound: Your turn chime (G5 -> C6)
   */
  playYourTurn() {
    this._vibrate([25, 25]);
    if (this.isMuted) return;
    this._initCtx();
    if (!this.ctx) return;

    const t = this.ctx.currentTime;
    const notes = [783.99, 1046.50]; // G5, C6
    notes.forEach((freq, idx) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t + idx * 0.08);

      gain.gain.setValueAtTime(0.15, t + idx * 0.08);
      gain.gain.exponentialRampToValueAtTime(0.001, t + idx * 0.08 + 0.25);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(t + idx * 0.08);
      osc.stop(t + idx * 0.08 + 0.25);
    });
  }

  /**
   * Sound: Urgent tick for last 5 seconds of turn timer
   */
  playTick() {
    this._vibrate(10);
    if (this.isMuted) return;
    this._initCtx();
    if (!this.ctx) return;

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(1200, t);
    osc.frequency.exponentialRampToValueAtTime(300, t + 0.02);

    gain.gain.setValueAtTime(0.08, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.02);

    osc.connect(gain);
    gain.connect(this._dest());
    osc.start(t);
    osc.stop(t + 0.02);
  }

  /**
   * Sound: Victory fanfare on BINGO win
   */
  playVictory() {
    this._vibrate([60, 60, 120]);
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

  /**
   * Sound: Defeat sound (descending minor cadence)
   */
  playDefeat() {
    this._vibrate([80, 80]);
    if (this.isMuted) return;
    this._initCtx();
    if (!this.ctx) return;

    const t = this.ctx.currentTime;
    const chord = [329.63, 261.63, 220.00]; // E4, C4, A3
    chord.forEach((freq, i) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t + i * 0.12);

      gain.gain.setValueAtTime(0.15, t + i * 0.12);
      gain.gain.exponentialRampToValueAtTime(0.001, t + i * 0.12 + 0.4);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(t + i * 0.12);
      osc.stop(t + i * 0.12 + 0.4);
    });
  }

  /**
   * Sound: Error buzz
   */
  playError() {
    this._vibrate([50, 40, 50]);
    if (this.isMuted) return;
    this._initCtx();
    if (!this.ctx) return;

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(140, t);
    osc.frequency.setValueAtTime(120, t + 0.06);

    gain.gain.setValueAtTime(this._vol(0.12), t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.14);

    osc.connect(gain);
    gain.connect(this._dest());
    osc.start(t);
    osc.stop(t + 0.14);
  }

  playCountdownBeep(isFinalGo = false) {
    this._vibrate(isFinalGo ? [30, 20, 40] : 18);
    if (this.isMuted) return;
    this._initCtx();
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = isFinalGo ? 'triangle' : 'sine';
    osc.frequency.setValueAtTime(isFinalGo ? 880 : 520, t);
    if (isFinalGo) {
      osc.frequency.exponentialRampToValueAtTime(1174.66, t + 0.14);
    }
    gain.gain.setValueAtTime(this._vol(isFinalGo ? 0.18 : 0.11), t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + (isFinalGo ? 0.24 : 0.11));
    osc.connect(gain);
    gain.connect(this._dest());
    osc.start(t);
    osc.stop(t + (isFinalGo ? 0.25 : 0.12));
  }

  playPaperShuffle() {
    this._vibrate(15);
    if (this.isMuted) return;
    this._initCtx();
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    [340, 460, 580].forEach((freq, idx) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t + idx * 0.03);
      gain.gain.setValueAtTime(this._vol(0.08), t + idx * 0.03);
      gain.gain.exponentialRampToValueAtTime(0.001, t + idx * 0.03 + 0.06);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(t + idx * 0.03);
      osc.stop(t + idx * 0.03 + 0.065);
    });
  }

  playBingoClaim() {
    this._vibrate([40, 30, 80]);
    if (this.isMuted) return;
    this._initCtx();
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    [523.25, 659.25, 783.99, 1046.5, 1318.5].forEach((freq, i) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, t + i * 0.055);
      gain.gain.setValueAtTime(this._vol(0.16), t + i * 0.055);
      gain.gain.exponentialRampToValueAtTime(0.001, t + i * 0.055 + 0.32);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(t + i * 0.055);
      osc.stop(t + i * 0.055 + 0.34);
    });
  }

  playTournamentFanfare() {
    this._vibrate([50, 40, 50, 40, 100]);
    if (this.isMuted) return;
    this._initCtx();
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    [392.0, 523.25, 659.25, 783.99, 1046.5].forEach((freq, i) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, t + i * 0.09);
      gain.gain.setValueAtTime(this._vol(0.18), t + i * 0.09);
      gain.gain.exponentialRampToValueAtTime(0.001, t + i * 0.09 + 0.5);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(t + i * 0.09);
      osc.stop(t + i * 0.09 + 0.52);
    });
  }
}

export const soundManager = new SoundManager();

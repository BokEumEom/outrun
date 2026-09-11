import { clamp, MAX } from './engine';
import { GameState } from './types';

export class SoundEngine {
  private ac: AudioContext | null = null;
  private gain: GainNode | null = null;
  private filter: BiquadFilterNode | null = null;
  private oscillators: { osc: OscillatorNode; harmonic: number }[] = [];
  private squeal: OscillatorNode | null = null;
  private skidGain: GainNode | null = null;
  private rainGain: GainNode | null = null;
  private rainSource: AudioBufferSourceNode | null = null;
  private lastThunderTime = 0;
  private music: HTMLAudioElement | null = null;
  public soundEnabled: boolean = true;

  constructor(musicUrl: string = '/media/MUSIC_DATA.mp3') {
    if (typeof window !== 'undefined') {
      this.music = new Audio(musicUrl);
      this.music.loop = true;
      this.music.volume = 1;
    }
  }

  public init(): void {
    if (this.ac) return;
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ac = new AudioCtx();
      const gain = ac.createGain();
      const filter = ac.createBiquadFilter();
      const compressor = ac.createDynamicsCompressor();

      gain.gain.value = 0;
      filter.type = 'lowpass';
      filter.frequency.value = 900;
      filter.Q.value = 0.6;
      compressor.threshold.value = -12;
      compressor.ratio.value = 4;

      filter.connect(gain);
      gain.connect(compressor);
      compressor.connect(ac.destination);

      const oscillators = [1, 2, 3].map((harmonic, i) => {
        const osc = ac.createOscillator();
        const level = ac.createGain();
        osc.type = i === 0 ? 'sawtooth' : 'triangle';
        osc.detune.value = [-7, 5, 0][i];
        level.gain.value = [0.48, 0.24, 0.13][i];
        osc.connect(level);
        level.connect(filter);
        osc.start();
        return { osc, harmonic };
      });

      const squeal = ac.createOscillator();
      const skidGain = ac.createGain();
      const skidFilter = ac.createBiquadFilter();
      squeal.type = 'sawtooth';
      squeal.frequency.value = 1350;
      skidFilter.type = 'bandpass';
      skidFilter.frequency.value = 1700;
      skidFilter.Q.value = 1.4;
      skidGain.gain.value = 0;

      squeal.connect(skidFilter);
      skidFilter.connect(skidGain);
      skidGain.connect(ac.destination);
      squeal.start();

      // Rain sound synthesizer (filtered white noise)
      const bufferSize = ac.sampleRate * 2;
      const noiseBuffer = ac.createBuffer(1, bufferSize, ac.sampleRate);
      const data = noiseBuffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * 0.45;
      }
      const rainSource = ac.createBufferSource();
      rainSource.buffer = noiseBuffer;
      rainSource.loop = true;

      const rainFilter = ac.createBiquadFilter();
      rainFilter.type = 'lowpass';
      rainFilter.frequency.value = 1450;

      const rainGain = ac.createGain();
      rainGain.gain.value = 0;

      rainSource.connect(rainFilter);
      rainFilter.connect(rainGain);
      rainGain.connect(ac.destination);
      rainSource.start();

      this.ac = ac;
      this.gain = gain;
      this.filter = filter;
      this.oscillators = oscillators;
      this.squeal = squeal;
      this.skidGain = skidGain;
      this.rainGain = rainGain;
      this.rainSource = rainSource;
    } catch {
      // Audio context might fail until first interaction
    }
  }

  public resume(): void {
    if (this.ac && this.ac.state === 'suspended') {
      this.ac.resume().catch(() => {});
    }
  }

  public syncMusic(playing: boolean, ending: number, paused: boolean): void {
    if (!this.music) return;
    if (this.soundEnabled && (playing || ending >= 0) && !paused) {
      if (this.music.paused) {
        this.music.play().catch(() => {});
      }
    } else {
      this.music.pause();
    }
  }

  public resetMusicTime(): void {
    if (this.music) {
      this.music.currentTime = 0;
    }
  }

  public updateEngine(
    s: GameState,
    playing: boolean,
    paused: boolean,
    ending: number,
    throttle: boolean
  ): void {
    if (!this.ac || !this.skidGain || !this.squeal || !this.gain || !this.filter) return;

    const slip =
      this.soundEnabled && !paused
        ? ending > 6 && ending < 6.7
          ? 0.7
          : playing && s.speed > 2200
          ? s.skid || 0
          : 0
        : 0;

    this.skidGain.gain.setTargetAtTime(slip * 0.055, this.ac.currentTime, 0.07);
    this.squeal.frequency.setTargetAtTime(
      1250 + slip * 650 + Math.sin(s.elapsed * 37) * 65,
      this.ac.currentTime,
      0.025
    );

    const ratio = clamp(s.speed / MAX, 0, 1);
    const gear = Math.min(4, Math.floor(ratio * 5));
    const within = ratio >= 1 ? 1 : ratio * 5 - gear;
    const rpm =
      ratio < 0.04 ? 950 + ratio * 40000 : 2700 + within * 3600;
    const isAccelerating = !s.braking && throttle;
    const now = this.ac.currentTime;

    this.gain.gain.setTargetAtTime(
      this.soundEnabled && playing && !paused ? (isAccelerating ? 0.13 : 0.07) : 0,
      now,
      0.06
    );
    this.filter.frequency.setTargetAtTime(
      450 + rpm * 0.16 + (isAccelerating ? 300 : 0),
      now,
      0.09
    );

    for (const voice of this.oscillators) {
      voice.osc.frequency.setTargetAtTime(
        (rpm / 60) * 2 * voice.harmonic,
        now,
        0.07
      );
    }
  }

  public playStageFanfare(): void {
    if (!this.ac || !this.soundEnabled) return;
    try {
      const now = this.ac.currentTime;
      const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
      notes.forEach((freq, idx) => {
        if (!this.ac) return;
        const osc = this.ac.createOscillator();
        const noteGain = this.ac.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now + idx * 0.07);
        noteGain.gain.setValueAtTime(0, now + idx * 0.07);
        noteGain.gain.linearRampToValueAtTime(0.18, now + idx * 0.07 + 0.02);
        noteGain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.07 + 0.32);
        osc.connect(noteGain);
        noteGain.connect(this.ac.destination);
        osc.start(now + idx * 0.07);
        osc.stop(now + idx * 0.07 + 0.33);
      });
    } catch {
      // Safe fallback if audio graph is busy
    }
  }

  public playCoinSound(): void {
    if (!this.ac) {
      this.init();
    }
    if (!this.ac || !this.soundEnabled) return;
    try {
      const now = this.ac.currentTime;
      const osc = this.ac.createOscillator();
      const gain = this.ac.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(987.77, now);
      osc.frequency.setValueAtTime(1318.51, now + 0.07);
      gain.gain.setValueAtTime(0.28, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.42);
      osc.connect(gain);
      gain.connect(this.ac.destination);
      osc.start(now);
      osc.stop(now + 0.43);
    } catch {
      // Safe fallback
    }
  }

  public playGearShift(isHigh: boolean): void {
    if (!this.ac) {
      this.init();
    }
    if (!this.ac || !this.soundEnabled) return;
    try {
      const now = this.ac.currentTime;
      const osc = this.ac.createOscillator();
      const gain = this.ac.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(isHigh ? 420 : 320, now);
      osc.frequency.exponentialRampToValueAtTime(isHigh ? 740 : 190, now + 0.08);
      gain.gain.setValueAtTime(0.3, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
      osc.connect(gain);
      gain.connect(this.ac.destination);
      osc.start(now);
      osc.stop(now + 0.13);
    } catch {
      // Safe fallback
    }
  }

  public playButtonBeep(): void {
    if (!this.ac) {
      this.init();
    }
    if (!this.ac || !this.soundEnabled) return;
    try {
      const now = this.ac.currentTime;
      const osc = this.ac.createOscillator();
      const gain = this.ac.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(960, now);
      gain.gain.setValueAtTime(0.14, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
      osc.connect(gain);
      gain.connect(this.ac.destination);
      osc.start(now);
      osc.stop(now + 0.07);
    } catch {
      // Safe fallback
    }
  }

  public updateWeather(
    rainIntensity: number,
    lightningIntensity: number,
    paused: boolean
  ): void {
    if (!this.ac || !this.rainGain) return;
    const now = this.ac.currentTime;
    const targetGain = this.soundEnabled && !paused ? rainIntensity * 0.055 : 0;
    this.rainGain.gain.setTargetAtTime(targetGain, now, 0.12);

    if (
      this.soundEnabled &&
      !paused &&
      lightningIntensity > 0.8 &&
      now - this.lastThunderTime > 3.0
    ) {
      this.lastThunderTime = now;
      this.playThunderSound();
    }
  }

  public playThunderSound(): void {
    if (!this.ac || !this.soundEnabled) return;
    try {
      const now = this.ac.currentTime;
      const osc = this.ac.createOscillator();
      const gain = this.ac.createGain();
      const filter = this.ac.createBiquadFilter();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(75, now);
      osc.frequency.exponentialRampToValueAtTime(32, now + 1.2);

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(140, now);
      filter.frequency.linearRampToValueAtTime(60, now + 1.2);

      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(0.18, now + 0.08);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 1.35);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.ac.destination);
      osc.start(now);
      osc.stop(now + 1.4);
    } catch {
      // Safe fallback
    }
  }

  public destroy(): void {
    if (this.rainSource) {
      try {
        this.rainSource.stop();
      } catch {}
      this.rainSource = null;
    }
    if (this.music) {
      this.music.pause();
      this.music = null;
    }
    if (this.ac) {
      this.ac.close().catch(() => {});
      this.ac = null;
    }
  }
}

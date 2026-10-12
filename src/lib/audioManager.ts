export type SfxName = 'click' | 'card' | 'dice' | 'step' | 'land' | 'win';

const clamp = (value: number, min = 0, max = 1) => Math.min(max, Math.max(min, value));

const MUSIC_ASSET = '/audio/club-loop.mp3';

const SFX_ASSETS: Record<SfxName, string> = {
  click: '/audio/button-click.mp3',
  card: '/audio/card-reveal.mp3',
  dice: '/audio/dice-roll.mp3',
  step: '/audio/piece-step.mp3',
  land: '/audio/piece-land.mp3',
  win: '/audio/win.mp3',
};

// Per-effect trims keep the supplied files perceptually closer in level while
// still respecting the user's global SFX volume setting.
const SFX_TRIM: Record<SfxName, number> = {
  click: 1.15,
  card: 0.9,
  dice: 0.58,
  step: 0.85,
  land: 1.8,
  win: 0.95,
};

const SFX_POOL_SIZE: Record<SfxName, number> = {
  click: 3,
  card: 2,
  dice: 2,
  step: 5,
  land: 2,
  win: 2,
};

class AudioManager {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private musicBus: GainNode | null = null;
  private sfxBus: GainNode | null = null;

  private musicElement: HTMLAudioElement | null = null;
  private sfxPools = new Map<SfxName, HTMLAudioElement[]>();
  private sfxPoolIndex = new Map<SfxName, number>();
  private failedAssets = new Set<string>();
  private assetsPreloaded = false;

  private syntheticMusicTimer: number | null = null;
  private syntheticMusicStep = 0;

  private musicEnabled = true;
  private sfxEnabled = true;
  private musicVolume = 0.18;
  private sfxVolume = 0.55;

  private ensureContext() {
    if (typeof window === 'undefined') return null;
    if (this.ctx) return this.ctx;

    const AudioContextCtor = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextCtor) return null;

    this.ctx = new AudioContextCtor();
    this.master = this.ctx.createGain();
    this.musicBus = this.ctx.createGain();
    this.sfxBus = this.ctx.createGain();

    this.master.gain.value = 0.9;
    this.musicBus.gain.value = this.musicVolume;
    this.sfxBus.gain.value = this.sfxVolume;

    this.musicBus.connect(this.master);
    this.sfxBus.connect(this.master);
    this.master.connect(this.ctx.destination);
    return this.ctx;
  }

  private ensureMusicElement() {
    if (typeof window === 'undefined') return null;
    if (this.musicElement) return this.musicElement;

    const audio = new Audio(MUSIC_ASSET);
    audio.loop = true;
    audio.preload = 'auto';
    audio.volume = this.musicVolume;
    audio.setAttribute('playsinline', 'true');
    audio.addEventListener('error', () => {
      this.failedAssets.add(MUSIC_ASSET);
      this.startSyntheticMusic();
    });

    this.musicElement = audio;
    return audio;
  }

  private ensureSfxPool(name: SfxName) {
    if (typeof window === 'undefined') return [];
    const existing = this.sfxPools.get(name);
    if (existing) return existing;

    const path = SFX_ASSETS[name];
    const pool = Array.from({ length: SFX_POOL_SIZE[name] }, () => {
      const audio = new Audio(path);
      audio.preload = 'auto';
      audio.volume = clamp(this.sfxVolume * SFX_TRIM[name]);
      audio.setAttribute('playsinline', 'true');
      audio.addEventListener('error', () => this.failedAssets.add(path));
      return audio;
    });

    this.sfxPools.set(name, pool);
    this.sfxPoolIndex.set(name, 0);
    return pool;
  }

  private preloadAssets() {
    // Preload exactly once. Calling HTMLMediaElement.load() again while the
    // club track is playing resets the element and pauses playback. Since
    // unlock() is intentionally called on many UI interactions, reloading here
    // made the music stop every time the user changed screens.
    if (this.assetsPreloaded) return;
    this.assetsPreloaded = true;

    const music = this.ensureMusicElement();
    music?.load();
    (Object.keys(SFX_ASSETS) as SfxName[]).forEach((name) => {
      this.ensureSfxPool(name).forEach((audio) => audio.load());
    });
  }

  async unlock() {
    // Prime both Web Audio (fallback synth) and media elements from a real user
    // gesture. We don't auto-start music here; the caller decides based on the
    // user's saved preference.
    const ctx = this.ensureContext();
    this.preloadAssets();

    if (ctx?.state === 'suspended') {
      try {
        await ctx.resume();
      } catch {
        // Asset playback may still work even if Web Audio is unavailable.
      }
    }

    // Discord or the browser can occasionally suspend media when focus changes.
    // If the user has music enabled and the track had already begun, a later
    // interaction should recover it without restarting from the beginning.
    if (
      this.musicEnabled &&
      this.musicElement &&
      this.musicElement.paused &&
      this.musicElement.currentTime > 0
    ) {
      this.startMusic();
    }

    return true;
  }

  setMusicEnabled(enabled: boolean) {
    this.musicEnabled = enabled;
    if (enabled) this.startMusic();
    else this.stopMusic();
  }

  setSfxEnabled(enabled: boolean) {
    this.sfxEnabled = enabled;
    if (!enabled) {
      this.sfxPools.forEach((pool) => {
        pool.forEach((audio) => {
          audio.pause();
          try { audio.currentTime = 0; } catch { /* no-op */ }
        });
      });
    }
  }

  setMusicVolume(value: number) {
    this.musicVolume = clamp(value);
    if (this.musicElement) this.musicElement.volume = this.musicVolume;

    if (this.ctx && this.musicBus) {
      this.musicBus.gain.cancelScheduledValues(this.ctx.currentTime);
      this.musicBus.gain.setTargetAtTime(this.musicVolume, this.ctx.currentTime, 0.08);
    }
  }

  setSfxVolume(value: number) {
    this.sfxVolume = clamp(value);

    this.sfxPools.forEach((pool, name) => {
      const volume = clamp(this.sfxVolume * SFX_TRIM[name]);
      pool.forEach((audio) => { audio.volume = volume; });
    });

    if (this.ctx && this.sfxBus) {
      this.sfxBus.gain.cancelScheduledValues(this.ctx.currentTime);
      this.sfxBus.gain.setTargetAtTime(this.sfxVolume, this.ctx.currentTime, 0.05);
    }
  }

  startMusic() {
    if (!this.musicEnabled) return;

    const music = this.ensureMusicElement();
    if (music && !this.failedAssets.has(MUSIC_ASSET)) {
      this.stopSyntheticMusic();
      music.volume = this.musicVolume;
      const playPromise = music.play();
      if (playPromise) {
        void playPromise.catch(() => {
          // If media playback is blocked or the file cannot play, preserve the
          // experience with the lightweight synthesized house loop.
          this.startSyntheticMusic();
        });
      }
      return;
    }

    this.startSyntheticMusic();
  }

  stopMusic() {
    if (this.musicElement) this.musicElement.pause();
    this.stopSyntheticMusic();
  }

  playSfx(name: SfxName) {
    if (!this.sfxEnabled) return;

    const path = SFX_ASSETS[name];
    const pool = this.ensureSfxPool(name);

    if (pool.length > 0 && !this.failedAssets.has(path)) {
      const index = this.sfxPoolIndex.get(name) ?? 0;
      const audio = pool[index % pool.length];
      this.sfxPoolIndex.set(name, (index + 1) % pool.length);

      audio.volume = clamp(this.sfxVolume * SFX_TRIM[name]);
      try { audio.currentTime = 0; } catch { /* no-op */ }

      const playPromise = audio.play();
      if (playPromise) {
        void playPromise.catch(() => this.playSyntheticSfx(name));
      }
      return;
    }

    this.playSyntheticSfx(name);
  }

  private startSyntheticMusic() {
    if (!this.musicEnabled || this.syntheticMusicTimer !== null) return;
    const ctx = this.ensureContext();
    if (!ctx || ctx.state !== 'running') return;

    // 118 BPM fallback groove. This only runs if the supplied MP3 cannot play.
    const intervalMs = Math.round((60_000 / 118) / 2);
    this.syntheticMusicStep = 0;
    this.scheduleSyntheticMusicStep();
    this.syntheticMusicTimer = window.setInterval(() => this.scheduleSyntheticMusicStep(), intervalMs);
  }

  private stopSyntheticMusic() {
    if (this.syntheticMusicTimer !== null) {
      window.clearInterval(this.syntheticMusicTimer);
      this.syntheticMusicTimer = null;
    }
  }

  private scheduleSyntheticMusicStep() {
    const ctx = this.ctx;
    const bus = this.musicBus;
    if (!ctx || !bus || !this.musicEnabled || ctx.state !== 'running') return;

    const now = ctx.currentTime;
    const step = this.syntheticMusicStep++ % 16;

    if (step % 4 === 0) this.kick(now, bus);
    if (step % 2 === 1) this.hat(now, bus, step % 4 === 3 ? 0.035 : 0.024);

    if ([0, 3, 6, 8, 11, 14].includes(step)) {
      const phrase = [55, 55, 65.41, 55, 82.41, 65.41];
      const index = [0, 3, 6, 8, 11, 14].indexOf(step);
      this.bass(now, bus, phrase[index]);
    }

    if (step === 6 || step === 14) {
      this.chord(now, bus, step === 6 ? [220, 261.63, 329.63] : [196, 246.94, 293.66]);
    }
  }

  private playSyntheticSfx(name: SfxName) {
    if (!this.sfxEnabled) return;
    const ctx = this.ensureContext();
    const bus = this.sfxBus;
    if (!ctx || !bus || ctx.state !== 'running') return;
    const now = ctx.currentTime;

    switch (name) {
      case 'click':
        this.tone(now, bus, 520, 0.035, 0.035, 'sine', 760);
        break;
      case 'card':
        this.sweep(now, bus, 280, 920, 0.18, 0.055);
        break;
      case 'dice':
        this.noiseBurst(now, bus, 0.38, 0.09, 1200);
        for (let i = 0; i < 5; i++) this.tone(now + i * 0.055, bus, 120 + i * 14, 0.04, 0.025, 'square');
        break;
      case 'step':
        this.tone(now, bus, 260, 0.045, 0.05, 'triangle', 190);
        break;
      case 'land':
        this.tone(now, bus, 160, 0.1, 0.1, 'sine', 82);
        this.tone(now + 0.03, bus, 420, 0.08, 0.05, 'triangle', 300);
        break;
      case 'win':
        [440, 554.37, 659.25, 880].forEach((f, i) => this.tone(now + i * 0.09, bus, f, 0.22, 0.07, 'sine'));
        break;
    }
  }

  private kick(time: number, destination: AudioNode) {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(120, time);
    osc.frequency.exponentialRampToValueAtTime(48, time + 0.13);
    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.exponentialRampToValueAtTime(0.24, time + 0.006);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.18);
    osc.connect(gain).connect(destination);
    osc.start(time);
    osc.stop(time + 0.2);
  }

  private hat(time: number, destination: AudioNode, amount: number) {
    if (!this.ctx) return;
    const length = Math.floor(this.ctx.sampleRate * 0.045);
    const buffer = this.ctx.createBuffer(1, length, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
    const source = this.ctx.createBufferSource();
    const filter = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();
    filter.type = 'highpass';
    filter.frequency.value = 6500;
    gain.gain.setValueAtTime(amount, time);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.045);
    source.buffer = buffer;
    source.connect(filter).connect(gain).connect(destination);
    source.start(time);
  }

  private bass(time: number, destination: AudioNode, frequency: number) {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const filter = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(frequency, time);
    filter.type = 'lowpass';
    filter.frequency.value = 420;
    filter.Q.value = 2.5;
    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.exponentialRampToValueAtTime(0.055, time + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.19);
    osc.connect(filter).connect(gain).connect(destination);
    osc.start(time);
    osc.stop(time + 0.21);
  }

  private chord(time: number, destination: AudioNode, frequencies: number[]) {
    if (!this.ctx) return;
    const filter = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();
    filter.type = 'lowpass';
    filter.frequency.value = 1100;
    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.exponentialRampToValueAtTime(0.018, time + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.34);
    filter.connect(gain).connect(destination);
    frequencies.forEach((frequency, index) => {
      const osc = this.ctx!.createOscillator();
      osc.type = index === 0 ? 'triangle' : 'sine';
      osc.frequency.value = frequency;
      osc.connect(filter);
      osc.start(time);
      osc.stop(time + 0.36);
    });
  }

  private tone(
    time: number,
    destination: AudioNode,
    frequency: number,
    duration: number,
    amount: number,
    type: OscillatorType,
    endFrequency?: number,
  ) {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(frequency, time);
    if (endFrequency) osc.frequency.exponentialRampToValueAtTime(Math.max(1, endFrequency), time + duration);
    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.exponentialRampToValueAtTime(amount, time + 0.004);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + duration);
    osc.connect(gain).connect(destination);
    osc.start(time);
    osc.stop(time + duration + 0.02);
  }

  private sweep(time: number, destination: AudioNode, start: number, end: number, duration: number, amount: number) {
    this.tone(time, destination, start, duration, amount, 'sine', end);
    this.tone(time + 0.018, destination, start * 1.5, duration * 0.8, amount * 0.45, 'triangle', end * 1.25);
  }

  private noiseBurst(time: number, destination: AudioNode, duration: number, amount: number, lowpass: number) {
    if (!this.ctx) return;
    const length = Math.floor(this.ctx.sampleRate * duration);
    const buffer = this.ctx.createBuffer(1, length, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
    const source = this.ctx.createBufferSource();
    const filter = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();
    filter.type = 'lowpass';
    filter.frequency.value = lowpass;
    gain.gain.setValueAtTime(amount, time);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + duration);
    source.buffer = buffer;
    source.connect(filter).connect(gain).connect(destination);
    source.start(time);
  }
}

export const audioManager = new AudioManager();

/** Optional synthesized sounds: key clicks, background hum, intrusion tone. */
export class Sound {
  private ctx: AudioContext | null = null;
  private hum: { stop: () => void } | null = null;
  private lastClick = 0;
  private current: HTMLAudioElement | null = null;
  enabled = false;

  private context(): AudioContext | null {
    if (!this.ctx) {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return null;
      this.ctx = new Ctor();
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
    return this.ctx;
  }

  setEnabled(on: boolean) {
    this.enabled = on;
    if (on) this.startHum();
    else {
      this.stopHum();
      this.stopVoice();
    }
  }

  /**
   * Plays a recorded voice from public/audio/ (one at a time). Without `force` it only plays
   * when sounds are on; `force` is for an explicit "play" button.
   */
  voice(file: string, force = false): HTMLAudioElement | null {
    return this.play(`${import.meta.env.BASE_URL}audio/${file}`, force);
  }

  /** Plays any audio URL (e.g. a decrypted recording) with the same rules as `voice`. */
  play(url: string, force = false): HTMLAudioElement | null {
    if (!this.enabled && !force) return null;
    this.stopVoice();
    const audio = new Audio(url);
    audio.volume = 0.9;
    this.current = audio;
    audio.addEventListener('ended', () => {
      if (this.current === audio) this.current = null;
    });
    void audio.play().catch(() => {
      if (this.current === audio) this.current = null;
    });
    return audio;
  }

  stopVoice() {
    if (!this.current) return;
    this.current.pause();
    this.current = null;
  }

  /** Must be called from a user gesture on some browsers. */
  unlock() {
    if (this.enabled) {
      this.context();
      if (!this.hum) this.startHum();
    }
  }

  click() {
    if (!this.enabled) return;
    const ctx = this.context();
    if (!ctx) return;
    const now = ctx.currentTime;
    if (now - this.lastClick < 0.025) return;
    this.lastClick = now;
    const len = Math.floor(ctx.sampleRate * 0.018);
    const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 3;
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 1800 + Math.random() * 900;
    const gain = ctx.createGain();
    gain.gain.value = 0.25;
    src.connect(filter).connect(gain).connect(ctx.destination);
    src.start();
  }

  /** A short detuned tone for system alerts and the intruder. */
  alert(kind: 'sistema' | 'intruso' = 'sistema') {
    if (!this.enabled) return;
    const ctx = this.context();
    if (!ctx) return;
    const now = ctx.currentTime;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.08, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + (kind === 'intruso' ? 1.4 : 0.35));
    gain.connect(ctx.destination);
    const freqs = kind === 'intruso' ? [92, 97.5, 184] : [880, 660];
    freqs.forEach((f, i) => {
      const osc = ctx.createOscillator();
      osc.type = kind === 'intruso' ? 'sawtooth' : 'square';
      osc.frequency.setValueAtTime(f, now + (kind === 'sistema' ? i * 0.12 : 0));
      osc.connect(gain);
      osc.start(now + (kind === 'sistema' ? i * 0.12 : 0));
      osc.stop(now + 1.5);
    });
  }

  private startHum() {
    const ctx = this.context();
    if (!ctx || this.hum) return;
    const master = ctx.createGain();
    master.gain.value = 0.0001;
    master.gain.exponentialRampToValueAtTime(0.035, ctx.currentTime + 1.5);
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 400;
    master.connect(ctx.destination);
    filter.connect(master);
    const oscs = [50, 100, 150.4].map((f, i) => {
      const o = ctx.createOscillator();
      o.type = i === 0 ? 'sine' : 'triangle';
      o.frequency.value = f;
      const g = ctx.createGain();
      g.gain.value = [1, 0.35, 0.12][i];
      o.connect(g).connect(filter);
      o.start();
      return o;
    });
    this.hum = {
      stop: () => {
        master.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.4);
        oscs.forEach((o) => o.stop(ctx.currentTime + 0.5));
      },
    };
  }

  private stopHum() {
    this.hum?.stop();
    this.hum = null;
  }
}

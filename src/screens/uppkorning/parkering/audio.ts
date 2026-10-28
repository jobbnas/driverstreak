/** Parking-sensor beeps, crunch and a light "klar" chime via Web Audio. No-ops until unlocked. */
export class ParkingAudio {
  private ctx?: AudioContext;
  private muted = false;
  private nextBeepAt = 0;
  private tone?: OscillatorNode;
  private toneGain?: GainNode;

  unlock(): void {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      return;
    }
    try {
      const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return;
      this.ctx = new Ctor();
      const buf = this.ctx.createBuffer(1, 1, 22050);
      const src = this.ctx.createBufferSource();
      src.buffer = buf;
      src.connect(this.ctx.destination);
      src.start(0);
    } catch {
      this.ctx = undefined;
    }
  }

  setMuted(m: boolean): void {
    this.muted = m;
    if (m) this.stopTone();
  }

  get ready(): boolean {
    return !!this.ctx && !this.muted;
  }

  private beep(freq = 2000, dur = 0.06, gain = 0.12): void {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = 'sine';
    o.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.ctx.destination);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  private startTone(): void {
    if (!this.ctx || this.muted || this.tone) return;
    this.tone = this.ctx.createOscillator();
    this.toneGain = this.ctx.createGain();
    this.tone.type = 'sine';
    this.tone.frequency.value = 2000;
    this.toneGain.gain.value = 0.1;
    this.tone.connect(this.toneGain).connect(this.ctx.destination);
    this.tone.start();
  }

  private stopTone(): void {
    if (this.tone) {
      try {
        this.tone.stop();
      } catch {
        /* already stopped */
      }
      this.tone.disconnect();
      this.tone = undefined;
      this.toneGain = undefined;
    }
  }

  /** Call every frame with the distance (m) in the direction of travel; Infinity = silence. */
  proximity(d: number, now: number): void {
    if (!this.ctx || this.muted) return;
    if (d > 1.2) {
      this.stopTone();
      return;
    }
    if (d < 0.3) {
      this.startTone();
      return;
    }
    this.stopTone();
    const interval = 80 + ((d - 0.3) / 0.9) * 520;
    if (now >= this.nextBeepAt) {
      this.beep();
      this.nextBeepAt = now + interval;
    }
  }

  crunch(hard: boolean): void {
    if (!this.ctx || this.muted) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const len = Math.floor(ctx.sampleRate * 0.18);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = hard ? 900 : 600;
    const g = ctx.createGain();
    g.gain.setValueAtTime(hard ? 0.6 : 0.35, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
    src.connect(lp).connect(g).connect(ctx.destination);
    src.start(t);
    if (hard) {
      const o = ctx.createOscillator();
      const og = ctx.createGain();
      o.frequency.value = 90;
      og.gain.setValueAtTime(0.4, t);
      og.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
      o.connect(og).connect(ctx.destination);
      o.start(t);
      o.stop(t + 0.3);
    }
  }

  chime(): void {
    this.beep(880, 0.12, 0.1);
    setTimeout(() => this.beep(1320, 0.18, 0.1), 120);
  }

  dispose(): void {
    this.stopTone();
    void this.ctx?.close();
    this.ctx = undefined;
  }
}

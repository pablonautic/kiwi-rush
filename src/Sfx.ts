/** Tiny procedural sound-effect synth (no audio assets needed). */
export class Sfx {
  muted = false;
  private ctx: AudioContext | null = null;

  /** Must be called from a user gesture before sound can play. */
  unlock(): void {
    if (!this.ctx) {
      try {
        const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        this.ctx = new Ctor();
      } catch {
        this.ctx = null;
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') void this.ctx.resume();
  }

  toggleMute(): boolean {
    this.muted = !this.muted;
    return this.muted;
  }

  private tone(freq: number, dur: number, type: OscillatorType, vol: number, slide = 0, delay = 0): void {
    const ctx = this.ctx;
    if (!ctx || this.muted) return;
    const t0 = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slide !== 0) osc.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t0 + dur);
    gain.gain.setValueAtTime(vol, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  private noise(dur: number, vol: number, highpass: number): void {
    const ctx = this.ctx;
    if (!ctx || this.muted) return;
    const buffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * dur), ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = highpass;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(vol, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    src.connect(filter).connect(gain).connect(ctx.destination);
    src.start();
  }

  jump(double: boolean): void {
    this.tone(double ? 520 : 360, 0.16, 'square', 0.06, 280);
  }

  coin(combo: number): void {
    const f = 880 * Math.pow(2, Math.min(combo, 8) / 12);
    this.tone(f, 0.08, 'square', 0.05);
    this.tone(f * 1.5, 0.14, 'square', 0.05, 0, 0.06);
  }

  lane(): void {
    this.tone(300, 0.09, 'triangle', 0.05, 160);
  }

  /** A revolver shot. */
  shot(): void {
    this.noise(0.09, 0.14, 1200);
    this.tone(170, 0.1, 'square', 0.07, -110);
  }

  /** A short burst of jetpack roar. */
  jet(): void {
    this.noise(0.14, 0.05, 500);
  }

  slide(): void {
    this.noise(0.3, 0.08, 900);
  }

  dash(): void {
    this.noise(0.25, 0.1, 1200);
    this.tone(320, 0.25, 'sawtooth', 0.04, -200);
  }

  smash(): void {
    this.noise(0.2, 0.18, 500);
    this.tone(180, 0.16, 'square', 0.08, -110);
  }

  hit(): void {
    this.tone(240, 0.32, 'sawtooth', 0.12, -170);
    this.noise(0.22, 0.12, 300);
  }

  gameOver(): void {
    [392, 330, 262, 196].forEach((f, i) => this.tone(f, 0.28, 'triangle', 0.1, 0, i * 0.18));
  }
}

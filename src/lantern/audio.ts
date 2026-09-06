type Cue = 'jump' | 'dash' | 'slash' | 'throw' | 'hit' | 'hurt' | 'block' | 'warning' | 'pickup' | 'heal' | 'win' | 'lose';

export class LanternAudio {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private muted = false;
  private musicAt = 0;
  private noteIndex = 0;
  private disposed = false;

  constructor(muted: boolean) { this.muted = muted; }

  unlock(): void {
    if (this.disposed) return;
    try {
      if (!this.context) {
        this.context = new AudioContext();
        this.master = this.context.createGain();
        this.master.gain.value = this.muted ? 0 : 0.24;
        this.master.connect(this.context.destination);
      }
      if (this.context.state === 'suspended') void this.context.resume().catch(() => undefined);
    } catch { /* Audio is optional on browsers without an available output device. */ }
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    if (this.context && this.master) this.master.gain.setTargetAtTime(muted ? 0 : 0.24, this.context.currentTime, 0.05);
  }

  private tone(frequency: number, end: number, duration: number, volume: number, type: OscillatorType = 'sine', delay = 0): void {
    if (!this.context || !this.master || this.muted || this.disposed || this.context.state !== 'running') return;
    const now = this.context.currentTime + delay;
    const oscillator = this.context.createOscillator();
    const envelope = this.context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, now);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(20, end), now + duration);
    envelope.gain.setValueAtTime(0.001, now);
    envelope.gain.exponentialRampToValueAtTime(volume, now + 0.012);
    envelope.gain.exponentialRampToValueAtTime(0.001, now + duration);
    oscillator.connect(envelope);
    envelope.connect(this.master);
    oscillator.start(now);
    oscillator.stop(now + duration + 0.03);
    oscillator.onended = () => { oscillator.disconnect(); envelope.disconnect(); };
  }

  play(cue: Cue): void {
    switch (cue) {
      case 'jump': this.tone(240, 520, 0.15, 0.11, 'triangle'); break;
      case 'dash': this.tone(620, 100, 0.14, 0.1, 'sawtooth'); break;
      case 'slash': this.tone(780, 180, 0.09, 0.09, 'triangle'); break;
      case 'throw': this.tone(440, 1150, 0.12, 0.085, 'sine'); break;
      case 'hit': this.tone(170, 65, 0.1, 0.27, 'triangle'); this.tone(1150, 620, 0.07, 0.08); break;
      case 'hurt': this.tone(130, 42, 0.27, 0.27, 'sawtooth'); break;
      case 'block': this.tone(1120, 700, 0.12, 0.2, 'triangle'); break;
      case 'warning': this.tone(370, 440, 0.18, 0.12); break;
      case 'pickup': [523, 659, 784, 1046].forEach((note, i) => this.tone(note, note, 0.55, 0.18, 'sine', i * 0.085)); break;
      case 'heal': [440, 659].forEach((note, i) => this.tone(note, note, 0.7, 0.15, 'sine', i * 0.15)); break;
      case 'win': [523, 659, 784, 1046, 1318].forEach((note, i) => this.tone(note, note, 1.1, 0.16, 'sine', i * 0.19)); break;
      case 'lose': [392, 330, 262].forEach((note, i) => this.tone(note, note * 0.97, 0.8, 0.12, 'triangle', i * 0.2)); break;
    }
  }

  update(returning: boolean, paused: boolean): void {
    if (!this.context || paused || this.muted || this.context.currentTime < this.musicAt) return;
    const notes = returning ? [220, 329.63, 293.66, 261.63, 220, 392] : [261.63, 392, 329.63, 440, 392, 293.66];
    const note = notes[this.noteIndex++ % notes.length];
    this.tone(note, note, 2.3, 0.035);
    this.tone(note / 2, note / 2, 2.6, 0.022, 'triangle');
    this.musicAt = this.context.currentTime + (returning ? 1.3 : 1.8);
  }

  dispose(): void {
    this.disposed = true;
    if (this.context && this.context.state !== 'closed') void this.context.close().catch(() => undefined);
  }
}

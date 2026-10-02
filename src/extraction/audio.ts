import type { SoundEvent } from './simulation';
export class FieldAudio {
  context: AudioContext | null = null;
  muted = false;
  unlock() {
    if (this.muted) return;
    try {
      this.context ??= new AudioContext();
      void this.context.resume();
    } catch {
      /* Audio is optional. */
    }
  }
  play(event: SoundEvent) {
    if (this.muted || !this.context || this.context.state !== 'running') return;
    const ctx = this.context,
      now = ctx.currentTime,
      osc = ctx.createOscillator(),
      gain = ctx.createGain();
    const tones = {
      shot: [100, 0.065, 0.07],
      enemyShot: [70, 0.08, 0.035],
      hit: [470, 0.035, 0.025],
      hurt: [85, 0.18, 0.06],
      loot: [820, 0.11, 0.04],
      reload: [220, 0.12, 0.02],
      extract: [520, 0.6, 0.055],
    };
    const [frequency, duration, volume] = tones[event];
    osc.type = event.includes('hot') || event === 'hurt' ? 'sawtooth' : 'sine';
    osc.frequency.setValueAtTime(frequency, now);
    osc.frequency.exponentialRampToValueAtTime(
      frequency * (event === 'extract' ? 1.6 : 0.4),
      now + duration,
    );
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + duration);
    osc.onended = () => {
      osc.disconnect();
      gain.disconnect();
    };
  }
  dispose() {
    void this.context?.close();
    this.context = null;
  }
}

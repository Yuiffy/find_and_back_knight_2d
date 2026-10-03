import type { SoundEvent } from './simulation';
import type { WeaponId } from './model';

export class FieldAudio {
  context: AudioContext | null = null;
  muted = false;
  private output: DynamicsCompressorNode | null = null;
  private noise: AudioBuffer | null = null;
  played = 0;
  unlock() {
    if (this.muted) return;
    try {
      if (!this.context) {
        this.context = new AudioContext();
        this.output = this.context.createDynamicsCompressor();
        this.output.threshold.value = -10; this.output.knee.value = 8; this.output.ratio.value = 5;
        this.output.attack.value = .002; this.output.release.value = .12;
        this.output.connect(this.context.destination);
        this.noise = this.context.createBuffer(1, Math.floor(this.context.sampleRate * .4), this.context.sampleRate);
        const data = this.noise.getChannelData(0);
        for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
      }
      void this.context.resume();
    } catch { /* Sound is optional when browser audio is unavailable. */ }
  }
  private tone(frequency: number, end: number, duration: number, volume: number, when: number, type: OscillatorType = 'sine') {
    const ctx = this.context!, osc = ctx.createOscillator(), gain = ctx.createGain();
    osc.type = type; osc.frequency.setValueAtTime(frequency, when);
    osc.frequency.exponentialRampToValueAtTime(end, when + duration);
    gain.gain.setValueAtTime(.001, when); gain.gain.linearRampToValueAtTime(volume, when + .002);
    gain.gain.exponentialRampToValueAtTime(.001, when + duration);
    osc.connect(gain); gain.connect(this.output!); osc.start(when); osc.stop(when + duration);
    osc.onended = () => { osc.disconnect(); gain.disconnect(); };
  }
  private burst(frequency: number, duration: number, volume: number, when: number, type: BiquadFilterType = 'lowpass') {
    const ctx = this.context!, source = ctx.createBufferSource(), filter = ctx.createBiquadFilter(), gain = ctx.createGain();
    source.buffer = this.noise; filter.type = type; filter.frequency.value = frequency; filter.Q.value = .7;
    gain.gain.setValueAtTime(.001, when); gain.gain.linearRampToValueAtTime(volume, when + .0015);
    gain.gain.exponentialRampToValueAtTime(.001, when + duration);
    source.connect(filter); filter.connect(gain); gain.connect(this.output!);
    source.start(when); source.stop(when + duration);
    source.onended = () => { source.disconnect(); filter.disconnect(); gain.disconnect(); };
  }
  play(event: SoundEvent, weapon: WeaponId = 'kestrel', suppressed = false) {
    if (this.muted || !this.context || !this.output || this.context.state !== 'running') return;
    const now = this.context.currentTime;
    this.played++;
    if (event === 'shot' || event === 'enemyShot') {
      const enemy = event === 'enemyShot', loudness = enemy ? .22 : suppressed ? .35 : 1;
      const heavy = weapon === 'heron', smg = weapon === 'shrike';
      // Sharp broadband crack, low body and delayed action click. A suppressor
      // removes the high crack instead of merely lowering a beep.
      this.burst(suppressed ? 800 : heavy ? 2500 : smg ? 3200 : 2800, suppressed ? .065 : heavy ? .16 : .1, .5 * loudness, now);
      this.tone(heavy ? 135 : smg ? 190 : 155, 45, heavy ? .18 : .09, (heavy ? .26 : .18) * loudness, now);
      this.burst(4600, .025, .08 * (enemy ? .4 : 1), now + .035, 'highpass');
      if (!suppressed && !enemy) this.burst(600, .2, .055, now + .045);
      return;
    }
    if (event === 'reload') {
      this.burst(2200, .045, .07, now, 'bandpass');
      this.burst(3600, .05, .075, now + .12, 'highpass');
      return;
    }
    if (event === 'dryFire') { this.burst(3300, .03, .055, now, 'bandpass'); return; }
    if (event === 'wallHit') { this.burst(2600, .045, .035, now, 'highpass'); return; }
    if (event === 'armorHit') { this.tone(1200, 650, .07, .06, now, 'triangle'); this.burst(3400, .04, .045, now, 'bandpass'); return; }
    if (event === 'hit' || event === 'kill') {
      this.burst(650, .05, .065, now);
      this.tone(event === 'kill' ? 820 : 480, event === 'kill' ? 420 : 270, event === 'kill' ? .14 : .035, .04, now, 'triangle');
      return;
    }
    const tones: Partial<Record<SoundEvent, [number, number, number]>> = {
      hurt: [85, .18, .06], loot: [820, .11, .04], extract: [520, .6, .055], eat: [580, .15, .035],
    };
    const [frequency, duration, volume] = tones[event]!;
    this.tone(frequency, frequency * (event === 'extract' ? 1.6 : .65), duration, volume, now);
  }
  dispose() {
    void this.context?.close(); this.context = null; this.output = null; this.noise = null;
  }
}

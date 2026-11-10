import SocialState from './SocialState';

type Tone = {
  frequency: number;
  duration: number;
  delay?: number;
  type?: OscillatorType;
  volume?: number;
};

/**
 * Small Discord-style cues synthesised with the Web Audio API, so the
 * extension does not need to ship or hotlink any audio files.
 */
class VoiceSounds {
  private context: AudioContext | null = null;

  private enabled(): boolean {
    const personal = SocialState.user?.voiceSettings?.sounds;

    if (typeof personal === 'boolean') return personal;

    return SocialState.config?.voice?.sounds !== false;
  }

  private audio(): AudioContext | null {
    if (!this.enabled()) return null;

    try {
      const Ctor = window.AudioContext || (window as any).webkitAudioContext;
      if (!Ctor) return null;
      if (!this.context) this.context = new Ctor();
      if (this.context.state === 'suspended') this.context.resume().catch(() => {});
      return this.context;
    } catch (e) {
      return null;
    }
  }

  private play(tones: Tone[]): void {
    const context = this.audio();
    if (!context) return;

    const start = context.currentTime;

    tones.forEach((tone) => {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      const at = start + (tone.delay || 0);
      const volume = tone.volume ?? 0.045;

      oscillator.type = tone.type || 'sine';
      oscillator.frequency.setValueAtTime(tone.frequency, at);
      gain.gain.setValueAtTime(0.0001, at);
      gain.gain.exponentialRampToValueAtTime(volume, at + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, at + tone.duration);

      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start(at);
      oscillator.stop(at + tone.duration + 0.02);
    });
  }

  join(): void {
    this.play([
      { frequency: 523.25, duration: 0.1 },
      { frequency: 783.99, duration: 0.14, delay: 0.09 },
    ]);
  }

  leave(): void {
    this.play([
      { frequency: 523.25, duration: 0.1 },
      { frequency: 349.23, duration: 0.16, delay: 0.09 },
    ]);
  }

  mute(): void {
    this.play([{ frequency: 330, duration: 0.07, type: 'triangle', volume: 0.03 }]);
  }

  unmute(): void {
    this.play([{ frequency: 660, duration: 0.07, type: 'triangle', volume: 0.03 }]);
  }

  deafen(): void {
    this.play([{ frequency: 392, duration: 0.08 }, { frequency: 261.63, duration: 0.1, delay: 0.07 }]);
  }

  undeafen(): void {
    this.play([{ frequency: 392, duration: 0.08 }, { frequency: 587.33, duration: 0.1, delay: 0.07 }]);
  }
}

export default new VoiceSounds();

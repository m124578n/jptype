/**
 * Typewriter-style key sounds synthesized with Web Audio — no audio assets, works offline.
 * The AudioContext is created lazily on the first play() so it always follows a user gesture.
 */
export type SoundKind = 'key' | 'error' | 'bell';

export class TypewriterSound {
	private ctx: AudioContext | null = null;
	private noise: AudioBuffer | null = null;
	volume = 0.6;
	enabled = true;

	private ensure(): AudioContext | null {
		if (typeof window === 'undefined' || !('AudioContext' in window)) return null;
		if (!this.ctx) {
			this.ctx = new AudioContext();
			const len = Math.floor(this.ctx.sampleRate * 0.1);
			this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
			const data = this.noise.getChannelData(0);
			for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
		}
		if (this.ctx.state === 'suspended') void this.ctx.resume();
		return this.ctx;
	}

	play(kind: SoundKind): void {
		if (!this.enabled || this.volume <= 0) return;
		const ctx = this.ensure();
		if (!ctx || !this.noise) return;
		const t = ctx.currentTime;
		const master = ctx.createGain();
		master.gain.value = this.volume;
		master.connect(ctx.destination);

		if (kind === 'bell') {
			this.tone(ctx, master, t, 1318, 0.5, 0.35);
			this.tone(ctx, master, t, 2637, 0.4, 0.12);
			return;
		}

		// Typebar strike: short band-passed noise burst.
		const burst = ctx.createBufferSource();
		burst.buffer = this.noise;
		const bp = ctx.createBiquadFilter();
		bp.type = 'bandpass';
		bp.frequency.value = kind === 'key' ? 2600 + Math.random() * 600 : 500;
		bp.Q.value = kind === 'key' ? 1.2 : 0.7;
		const env = ctx.createGain();
		const dur = kind === 'key' ? 0.035 : 0.07;
		env.gain.setValueAtTime(kind === 'key' ? 0.9 : 0.7, t);
		env.gain.exponentialRampToValueAtTime(0.001, t + dur);
		burst.connect(bp).connect(env).connect(master);
		burst.start(t);
		burst.stop(t + dur + 0.01);

		// Body thump: low sine so the click has weight.
		this.tone(ctx, master, t, kind === 'key' ? 180 : 110, 0.03, 0.35);
	}

	private tone(
		ctx: AudioContext,
		out: AudioNode,
		t: number,
		freq: number,
		dur: number,
		gain: number
	): void {
		const osc = ctx.createOscillator();
		osc.type = 'sine';
		osc.frequency.value = freq;
		const env = ctx.createGain();
		env.gain.setValueAtTime(gain, t);
		env.gain.exponentialRampToValueAtTime(0.001, t + dur);
		osc.connect(env).connect(out);
		osc.start(t);
		osc.stop(t + dur + 0.02);
	}
}

import { afterEach, describe, expect, it, vi } from 'vitest';
import { hasJapaneseVoice, speak, speechAvailable, stopSpeaking } from './speech.ts';

/**
 * These tests drive a fake Web Speech API (vitest runs in node, there is no real
 * speechSynthesis). They cover voice selection and call ordering only — whether audio is
 * actually audible can only be verified by hand in a browser.
 */

class FakeUtterance {
	voice: SpeechSynthesisVoice | null = null;
	lang = '';
	rate = 1;
	onend: (() => void) | null = null;
	onerror: (() => void) | null = null;
	constructor(readonly text: string) {}
}

class FakeSynth {
	/** Every cancel/speak in order, so tests can assert cancel happens first. */
	readonly calls: string[] = [];
	readonly spoken: FakeUtterance[] = [];
	outcome: 'end' | 'error' = 'end';
	private listeners: Array<() => void> = [];

	constructor(private voices: SpeechSynthesisVoice[] = []) {}

	getVoices(): SpeechSynthesisVoice[] {
		return this.voices;
	}

	cancel(): void {
		this.calls.push('cancel');
	}

	speak(utterance: FakeUtterance): void {
		this.calls.push('speak');
		this.spoken.push(utterance);
		queueMicrotask(() => {
			if (this.outcome === 'end') utterance.onend?.();
			else utterance.onerror?.();
		});
	}

	addEventListener(type: string, fn: () => void): void {
		if (type === 'voiceschanged') this.listeners.push(fn);
	}

	removeEventListener(type: string, fn: () => void): void {
		if (type === 'voiceschanged') this.listeners = this.listeners.filter((l) => l !== fn);
	}

	/** Chrome quirk: getVoices() is empty until this fires. */
	deliverVoices(voices: SpeechSynthesisVoice[]): void {
		this.voices = voices;
		for (const fn of [...this.listeners]) fn();
	}

	get listenerCount(): number {
		return this.listeners.length;
	}
}

function voice(name: string, lang: string): SpeechSynthesisVoice {
	return { name, lang, default: false, localService: true, voiceURI: name };
}

function install(synth: FakeSynth): void {
	(globalThis as { window?: unknown }).window = {
		speechSynthesis: synth,
		SpeechSynthesisUtterance: FakeUtterance
	};
}

afterEach(() => {
	Reflect.deleteProperty(globalThis, 'window');
	vi.useRealTimers();
});

describe('unsupported environments', () => {
	it('reports unavailable without a window (SSR)', async () => {
		expect(speechAvailable()).toBe(false);
		expect(await speak('あ')).toBe(false);
		expect(await hasJapaneseVoice()).toBe(false);
		expect(() => stopSpeaking()).not.toThrow();
	});

	it('reports unavailable when the browser has no speechSynthesis', async () => {
		(globalThis as { window?: unknown }).window = {};
		expect(speechAvailable()).toBe(false);
		expect(await speak('あ')).toBe(false);
	});

	it('refuses to speak when no Japanese voice is installed', async () => {
		const synth = new FakeSynth([voice('Alex', 'en-US'), voice('Anna', 'de-DE')]);
		install(synth);
		expect(await hasJapaneseVoice()).toBe(false);
		expect(await speak('あ')).toBe(false);
		expect(synth.calls).toEqual([]);
	});
});

describe('voice selection', () => {
	it('prefers a voice whose name mentions Japan over other languages', async () => {
		const synth = new FakeSynth([
			voice('Alex', 'en-US'),
			voice('Kyoko (Japanese)', 'ja-JP'),
			voice('Otoya', 'ja')
		]);
		install(synth);
		expect(await speak('あ')).toBe(true);
		expect(synth.spoken[0]?.voice?.name).toBe('Kyoko (Japanese)');
	});

	it('prefers a ja-JP voice even when its name says nothing', async () => {
		const synth = new FakeSynth([voice('Otoya', 'ja'), voice('Haruka', 'ja-JP')]);
		install(synth);
		expect(await speak('か')).toBe(true);
		expect(synth.spoken[0]?.voice?.name).toBe('Haruka');
	});

	it('falls back to any voice tagged ja*', async () => {
		const synth = new FakeSynth([voice('Alex', 'en-US'), voice('Otoya', 'ja')]);
		install(synth);
		expect(await hasJapaneseVoice()).toBe(true);
		expect(await speak('さ')).toBe(true);
		expect(synth.spoken[0]?.voice?.name).toBe('Otoya');
		expect(synth.spoken[0]?.lang).toBe('ja');
	});
});

describe('speak', () => {
	it('cancels the previous utterance before speaking', async () => {
		const synth = new FakeSynth([voice('Kyoko', 'ja-JP')]);
		install(synth);
		expect(await speak('あ')).toBe(true);
		expect(await speak('い')).toBe(true);
		expect(synth.calls).toEqual(['cancel', 'speak', 'cancel', 'speak']);
	});

	it('passes the text and rate through', async () => {
		const synth = new FakeSynth([voice('Kyoko', 'ja-JP')]);
		install(synth);
		await speak('がっこう', { rate: 0.5 });
		expect(synth.spoken[0]?.text).toBe('がっこう');
		expect(synth.spoken[0]?.rate).toBe(0.5);
		expect(synth.spoken[0]?.lang).toBe('ja-JP');
	});

	it('resolves false when playback errors', async () => {
		const synth = new FakeSynth([voice('Kyoko', 'ja-JP')]);
		synth.outcome = 'error';
		install(synth);
		expect(await speak('あ')).toBe(false);
	});

	it('stopSpeaking cancels', () => {
		const synth = new FakeSynth([voice('Kyoko', 'ja-JP')]);
		install(synth);
		stopSpeaking();
		expect(synth.calls).toEqual(['cancel']);
	});
});

describe('late voice loading (Chrome)', () => {
	it('waits for voiceschanged when getVoices() is empty', async () => {
		const synth = new FakeSynth([]);
		install(synth);
		const pending = speak('あ');
		await Promise.resolve();
		expect(synth.calls).toEqual([]);
		synth.deliverVoices([voice('Kyoko', 'ja-JP')]);
		expect(await pending).toBe(true);
		expect(synth.spoken[0]?.voice?.name).toBe('Kyoko');
		expect(synth.listenerCount).toBe(0);
	});

	it('gives up after one second and reports no voice', async () => {
		vi.useFakeTimers();
		const synth = new FakeSynth([]);
		install(synth);
		const pending = hasJapaneseVoice();
		await vi.advanceTimersByTimeAsync(1000);
		expect(await pending).toBe(false);
		expect(synth.listenerCount).toBe(0);
	});
});

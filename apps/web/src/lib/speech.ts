/**
 * Japanese text-to-speech through the browser's Web Speech API.
 *
 * The Worker runtime must never call an external TTS API (spec §1), and v1 ships no audio
 * assets, so playback uses a voice already installed on the user's machine: no network, no R2.
 * Everything degrades to `false` when the API or a Japanese voice is missing.
 */

/** How long to wait for Chrome's asynchronous `voiceschanged` before giving up. */
const VOICE_WAIT_MS = 1000;

/** Slightly under natural speed: single kana are very short and easy to miss. */
const DEFAULT_RATE = 0.9;

export function speechAvailable(): boolean {
	return (
		typeof window !== 'undefined' &&
		typeof window.speechSynthesis !== 'undefined' &&
		typeof window.SpeechSynthesisUtterance !== 'undefined'
	);
}

/**
 * The installed voices. Chrome returns an empty list until it has loaded them and fires
 * `voiceschanged`; wait for that event, but never longer than VOICE_WAIT_MS.
 */
async function loadVoices(): Promise<SpeechSynthesisVoice[]> {
	if (!speechAvailable()) return [];
	const synth = window.speechSynthesis;
	const ready = synth.getVoices();
	if (ready.length > 0) return ready;

	return new Promise<SpeechSynthesisVoice[]>((resolve) => {
		let settled = false;
		const finish = () => {
			if (settled) return;
			settled = true;
			clearTimeout(timer);
			synth.removeEventListener('voiceschanged', finish);
			resolve(synth.getVoices());
		};
		const timer = setTimeout(finish, VOICE_WAIT_MS);
		synth.addEventListener('voiceschanged', finish);
	});
}

function isJapanese(lang: string | undefined): boolean {
	return (lang ?? '').toLowerCase().startsWith('ja');
}

/** Prefer an explicitly Japanese voice, then anything tagged `ja*`. */
function pickJapaneseVoice(voices: readonly SpeechSynthesisVoice[]): SpeechSynthesisVoice | null {
	const preferred = voices.find(
		(v) =>
			/japan/i.test(v.name ?? '') ||
			/ja[-_]jp/i.test(v.name ?? '') ||
			(v.lang ?? '').toLowerCase().replace('_', '-') === 'ja-jp'
	);
	return preferred ?? voices.find((v) => isJapanese(v.lang)) ?? null;
}

export async function hasJapaneseVoice(): Promise<boolean> {
	return pickJapaneseVoice(await loadVoices()) !== null;
}

/**
 * Speak `text` with a Japanese voice.
 * Resolves true when the utterance finished, false when unsupported, when no Japanese voice
 * is installed, or when playback was interrupted (a later `speak()` cancels this one).
 */
export async function speak(text: string, opts: { rate?: number } = {}): Promise<boolean> {
	if (!speechAvailable()) return false;
	const synth = window.speechSynthesis;
	const voice = pickJapaneseVoice(await loadVoices());
	if (!voice) return false;

	// Queued utterances would pile up on every replay; only the newest one should be heard.
	synth.cancel();

	return new Promise<boolean>((resolve) => {
		const utterance = new window.SpeechSynthesisUtterance(text);
		utterance.voice = voice;
		utterance.lang = voice.lang || 'ja-JP';
		utterance.rate = opts.rate ?? DEFAULT_RATE;
		let settled = false;
		const settle = (ok: boolean) => {
			if (settled) return;
			settled = true;
			resolve(ok);
		};
		utterance.onend = () => settle(true);
		utterance.onerror = () => settle(false);
		synth.speak(utterance);
	});
}

/** Stop whatever is being spoken (leaving a page mid-question). */
export function stopSpeaking(): void {
	if (!speechAvailable()) return;
	window.speechSynthesis.cancel();
}

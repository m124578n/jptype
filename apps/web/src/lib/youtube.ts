/**
 * Loader and types for the official YouTube IFrame Player API.
 *
 * The script is fetched from YouTube by the **browser** (that is how an embed works); our
 * Worker never talks to YouTube, and nothing about the song — title, lyrics, timings — is
 * sent anywhere. Ambient typings live in `youtube-iframe.d.ts`.
 */

export type PlayerStateName = 'unstarted' | 'ended' | 'playing' | 'paused' | 'buffering' | 'cued';

/** What a mounted player lets the page do. */
export interface PlayerController {
	play(): void;
	pause(): void;
	/** Jump to `seconds`; the player keeps playing / stays paused as it was. */
	seekTo(seconds: number): void;
	/** Current playback position in seconds (0 before the player is usable). */
	currentTime(): number;
}

export interface PlayerReady {
	/** Video title as YouTube reports it, used to prefill the song title. */
	title: string;
	/** Length in seconds (0 when YouTube has not reported it yet). */
	duration: number;
}

const API_SRC = 'https://www.youtube.com/iframe_api';

/** Shared across every player on the page: the API script may only be loaded once. */
let pending: Promise<YT.Namespace> | null = null;

/**
 * Resolve with the global `YT` namespace, injecting the API script on first use and hooking the
 * documented `onYouTubeIframeAPIReady` callback. Rejects without a DOM (SSR) and when the script
 * fails to load (blocked, offline), so callers can show a fallback instead of hanging.
 */
export function loadIframeApi(): Promise<YT.Namespace> {
	if (typeof window === 'undefined' || typeof document === 'undefined') {
		return Promise.reject(new Error('the YouTube IFrame API needs a browser'));
	}
	const ready = window.YT;
	if (ready?.Player) return Promise.resolve(ready);

	pending ??= new Promise<YT.Namespace>((resolve, reject) => {
		const fail = (message: string) => {
			pending = null; // allow a later retry (e.g. the user reloads the player)
			reject(new Error(message));
		};
		// Chain instead of overwrite: another component may already be waiting.
		const previous = window.onYouTubeIframeAPIReady;
		window.onYouTubeIframeAPIReady = () => {
			previous?.();
			const namespace = window.YT;
			if (namespace?.Player) resolve(namespace);
			else fail('the YouTube IFrame API loaded without YT.Player');
		};

		const existing = document.querySelector(`script[src="${API_SRC}"]`);
		if (existing) {
			existing.addEventListener('error', () => fail('the YouTube IFrame API failed to load'));
			return;
		}
		const script = document.createElement('script');
		script.src = API_SRC;
		script.async = true;
		script.addEventListener('error', () => fail('the YouTube IFrame API failed to load'));
		// `appendChild`, not `append`: the Workers global `append` overload shadows the DOM one.
		document.head.appendChild(script);
	});
	return pending;
}

/** Numeric player state → a name the UI can branch on. */
export function stateName(value: number): PlayerStateName {
	switch (value) {
		case 0:
			return 'ended';
		case 1:
			return 'playing';
		case 2:
			return 'paused';
		case 3:
			return 'buffering';
		case 5:
			return 'cued';
		default:
			return 'unstarted';
	}
}

/** Watch URL for the "open on YouTube" link (official MVs often carry lyrics in the description). */
export function watchUrl(videoId: string): string {
	return `https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}`;
}

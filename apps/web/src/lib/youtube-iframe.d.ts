/**
 * Minimal ambient typings for the official YouTube IFrame Player API
 * (https://www.youtube.com/iframe_api), covering only what `YouTubePlayer.svelte` uses.
 *
 * The script is loaded in the browser at runtime and calls the global
 * `onYouTubeIframeAPIReady` once; there is no npm package involved, so the globals are
 * declared here instead of installing `@types/youtube`.
 */

declare namespace YT {
	/** -1 unstarted · 0 ended · 1 playing · 2 paused · 3 buffering · 5 video cued */
	type PlayerStateValue = -1 | 0 | 1 | 2 | 3 | 5;

	interface VideoData {
		title?: string;
		video_id?: string;
		author?: string;
	}

	interface PlayerEvent {
		target: Player;
	}

	interface StateChangeEvent extends PlayerEvent {
		data: PlayerStateValue;
	}

	interface ErrorEvent extends PlayerEvent {
		data: number;
	}

	interface PlayerVars {
		playsinline?: 0 | 1;
		rel?: 0 | 1;
		modestbranding?: 0 | 1;
		origin?: string;
	}

	interface PlayerOptions {
		videoId: string;
		/** `https://www.youtube-nocookie.com` keeps the embed on the no-cookie domain. */
		host?: string;
		playerVars?: PlayerVars;
		events?: {
			onReady?: (event: PlayerEvent) => void;
			onStateChange?: (event: StateChangeEvent) => void;
			onError?: (event: ErrorEvent) => void;
		};
	}

	interface Player {
		playVideo(): void;
		pauseVideo(): void;
		seekTo(seconds: number, allowSeekAhead: boolean): void;
		getCurrentTime(): number;
		getDuration(): number;
		getPlayerState(): PlayerStateValue;
		getVideoData(): VideoData;
		destroy(): void;
	}

	interface PlayerConstructor {
		new (element: HTMLElement | string, options: PlayerOptions): Player;
	}

	interface Namespace {
		Player: PlayerConstructor;
		PlayerState: {
			UNSTARTED: -1;
			ENDED: 0;
			PLAYING: 1;
			PAUSED: 2;
			BUFFERING: 3;
			CUED: 5;
		};
	}
}

interface Window {
	YT?: YT.Namespace;
	/** Called by the IFrame API script once it has finished loading. */
	onYouTubeIframeAPIReady?: () => void;
}

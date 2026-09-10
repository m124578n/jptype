<script lang="ts">
	import { m } from '$lib/paraglide/messages';
	import {
		loadIframeApi,
		stateName,
		type PlayerController,
		type PlayerReady,
		type PlayerStateName
	} from '$lib/youtube';

	let {
		videoId,
		title,
		// eslint-disable-next-line no-useless-assignment -- `$bindable()` is a rune, not a default value
		controller = $bindable(),
		onready,
		onstate,
		ontime,
		onfail
	}: {
		videoId: string;
		/** Accessible name of the iframe; the song title once we know it. */
		title: string;
		/** Bound by the parent to drive the player (undefined until it is ready). */
		controller?: PlayerController | undefined;
		onready?: (info: PlayerReady) => void;
		onstate?: (state: PlayerStateName) => void;
		/** Playback position, every 100 ms while playing. */
		ontime?: (seconds: number) => void;
		/** The API script could not be loaded, or YouTube refused the video. */
		onfail?: () => void;
	} = $props();

	/** Sync mode needs a tighter loop than the player's own ~250 ms state events. */
	const TICK_MS = 100;

	let mount = $state<HTMLDivElement | undefined>(undefined);
	let failed = $state(false);
	let player: YT.Player | null = null;
	let poll: ReturnType<typeof setInterval> | null = null;

	function stopPolling() {
		if (poll !== null) clearInterval(poll);
		poll = null;
	}

	function startPolling() {
		stopPolling();
		poll = setInterval(() => {
			if (player) ontime?.(player.getCurrentTime());
		}, TICK_MS);
	}

	// The API replaces the mount element with its iframe, so `{#key videoId}` below hands every
	// player a fresh element. $effect never runs during SSR, which is what keeps this safe there.
	$effect(() => {
		const element = mount;
		const id = videoId;
		if (!element || id === '') return;

		let cancelled = false;
		failed = false;

		loadIframeApi()
			.then((namespace) => {
				if (cancelled) return;
				player = new namespace.Player(element, {
					videoId: id,
					host: 'https://www.youtube-nocookie.com',
					playerVars: { playsinline: 1, rel: 0 },
					events: {
						onReady: (event) => {
							const data = event.target.getVideoData();
							onready?.({ title: data.title ?? '', duration: event.target.getDuration() });
						},
						onStateChange: (event) => {
							const name = stateName(event.data);
							if (name === 'playing') startPolling();
							else stopPolling();
							if (player) ontime?.(player.getCurrentTime());
							onstate?.(name);
						},
						onError: () => {
							failed = true;
							onfail?.();
						}
					}
				});
				controller = {
					play: () => player?.playVideo(),
					pause: () => player?.pauseVideo(),
					seekTo: (seconds: number) => player?.seekTo(Math.max(0, seconds), true),
					currentTime: () => player?.getCurrentTime() ?? 0
				};
			})
			.catch(() => {
				if (cancelled) return;
				failed = true;
				onfail?.();
			});

		return () => {
			cancelled = true;
			stopPolling();
			controller = undefined;
			try {
				player?.destroy();
			} catch {
				// the iframe may already be gone; nothing to clean up
			}
			player = null;
		};
	});
</script>

<div class="player">
	{#key videoId}
		<div class="mount" bind:this={mount} aria-label={m.songs_player_title({ title })}></div>
	{/key}
	{#if failed}
		<p class="failed">{m.songs_player_failed()}</p>
	{/if}
</div>

<style>
	.player {
		position: relative;
		aspect-ratio: 16 / 9;
		width: 100%;
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: var(--radius-lg);
		overflow: hidden;
	}
	.player :global(iframe) {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		border: 0;
	}
	.mount {
		position: absolute;
		inset: 0;
	}
	.failed {
		position: absolute;
		inset: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: var(--space-6);
		text-align: center;
		color: var(--fg-muted);
	}
</style>

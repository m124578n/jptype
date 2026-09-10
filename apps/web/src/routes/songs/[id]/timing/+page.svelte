<script lang="ts">
	import { onMount, tick } from 'svelte';
	import { m } from '$lib/paraglide/messages';
	import { resolve } from '$app/paths';
	import YouTubePlayer from '$lib/components/YouTubePlayer.svelte';
	import {
		clearAllTimings,
		clearLineTiming,
		firstUntimedIndex,
		formatTime,
		nudgeLine,
		stampLine,
		timedCount
	} from '$lib/song-timing';
	import { findSong, saveSong, type Song, type SongLine } from '$lib/songs';
	import type { PlayerController } from '$lib/youtube';

	let { data } = $props();

	let song = $state.raw<Song | null>(null);
	let loaded = $state(false);
	let lines = $state<SongLine[]>([]);
	let index = $state(0);
	let dirty = $state(false);
	let saved = $state(false);

	let controller = $state<PlayerController | undefined>(undefined);
	let playerFailed = $state(false);
	let rows = $state<(HTMLLIElement | undefined)[]>([]);

	/** ±0.5 s per nudge, as agreed with the owner. */
	const NUDGE_S = 0.5;

	onMount(() => {
		const found = findSong(data.id) ?? null;
		song = found;
		lines = found ? found.lines.map((l) => ({ ...l })) : [];
		index = Math.min(firstUntimedIndex(lines), Math.max(0, lines.length - 1));
		loaded = true;
	});

	const done = $derived(timedCount(lines));

	function change(next: SongLine[]) {
		lines = next;
		dirty = true;
		saved = false;
	}

	async function focusRow(next: number) {
		index = Math.min(Math.max(next, 0), Math.max(0, lines.length - 1));
		await tick();
		rows[index]?.scrollIntoView({ block: 'nearest' });
	}

	/** Stamp the current line with the player's position and move on. */
	function stampCurrent() {
		const at = controller?.currentTime();
		if (at === undefined) return;
		change(stampLine(lines, index, at));
		void focusRow(index + 1);
	}

	function nudge(i: number, delta: number) {
		change(nudgeLine(lines, i, delta));
	}

	function replayFrom(i: number) {
		const start = lines[i]?.start;
		if (start === undefined) return;
		void focusRow(i);
		controller?.seekTo(start);
		controller?.play();
	}

	function clearOne(i: number) {
		change(clearLineTiming(lines, i));
		void focusRow(i);
	}

	function clearEverything() {
		if (!window.confirm(m.songs_timing_clear_all_confirm())) return;
		change(clearAllTimings(lines));
		void focusRow(0);
	}

	function save() {
		const current = song;
		if (!current) return;
		const updated: Song = {
			...current,
			lines: lines.map((l) => ({ ...l })),
			updatedAt: Date.now()
		};
		saveSong(updated);
		song = updated;
		dirty = false;
		saved = true;
	}

	function onkeydown(e: KeyboardEvent) {
		const tag = (e.target as HTMLElement | null)?.tagName;
		if (tag === 'INPUT' || tag === 'TEXTAREA') return;
		if (e.ctrlKey || e.metaKey || e.altKey) return;
		if (!song || lines.length === 0) return;

		if (e.key === ' ' || e.key === 'Enter') {
			e.preventDefault();
			stampCurrent();
		} else if (e.key === 'Backspace') {
			e.preventDefault();
			void focusRow(index - 1);
		} else if (e.key === 'ArrowDown') {
			e.preventDefault();
			void focusRow(index + 1);
		} else if (e.key === 'ArrowUp') {
			e.preventDefault();
			void focusRow(index - 1);
		}
	}
</script>

<svelte:head>
	<title>{m.songs_timing_title()} · {song ? song.title : m.songs_title()} · {m.app_name()}</title>
</svelte:head>
<svelte:window {onkeydown} />

<div class="container stack timing">
	{#if loaded && !song}
		<h1>{m.songs_not_found()}</h1>
		<p><a class="btn" href={resolve('/songs')}>{m.songs_back()}</a></p>
	{:else if song}
		<header class="stack head">
			<h1>{m.songs_timing_title()} · {song.title}</h1>
			<p class="muted">{m.songs_timing_lead()}</p>
			<p class="muted small">{m.songs_timing_privacy()}</p>
		</header>

		<YouTubePlayer
			videoId={song.youtubeId}
			title={song.title}
			bind:controller
			onfail={() => (playerFailed = true)}
		/>
		{#if playerFailed}
			<p class="muted small">{m.songs_player_failed()}</p>
		{/if}

		<div class="row bar">
			<button type="button" class="btn btn--primary" onclick={stampCurrent}>
				{m.songs_timing_tap()}
			</button>
			<button type="button" class="btn" onclick={() => focusRow(index - 1)}>
				{m.songs_timing_prev()}
			</button>
			<button type="button" class="btn" onclick={() => focusRow(index + 1)}>
				{m.songs_timing_next()}
			</button>
			<span class="muted small" aria-live="polite">
				{m.songs_timing_progress({ done, total: lines.length })}
			</span>
		</div>

		<ol class="lines">
			{#each lines as line, i (i)}
				<li class="card row line" class:current={i === index} bind:this={rows[i]}>
					<button type="button" class="pick" aria-current={i === index} onclick={() => focusRow(i)}>
						<span class="muted small no">{m.songs_timing_line({ line: i + 1 })}</span>
						<span class="text" lang="ja">{line.text}</span>
					</button>
					<span class="time" class:untimed={line.start === undefined}>{formatTime(line.start)}</span
					>
					<span class="row nudges">
						<button
							type="button"
							class="btn btn--icon"
							title={m.songs_timing_minus()}
							aria-label={m.songs_timing_minus()}
							disabled={line.start === undefined}
							onclick={() => nudge(i, -NUDGE_S)}>−</button
						>
						<button
							type="button"
							class="btn btn--icon"
							title={m.songs_timing_plus()}
							aria-label={m.songs_timing_plus()}
							disabled={line.start === undefined}
							onclick={() => nudge(i, NUDGE_S)}>＋</button
						>
						<button
							type="button"
							class="btn"
							disabled={line.start === undefined}
							onclick={() => replayFrom(i)}>{m.songs_timing_replay()}</button
						>
						<button
							type="button"
							class="btn"
							disabled={line.start === undefined}
							onclick={() => clearOne(i)}>{m.songs_timing_clear()}</button
						>
					</span>
				</li>
			{/each}
		</ol>

		<div class="row bar">
			<button type="button" class="btn btn--primary" onclick={save} disabled={!dirty}>
				{m.songs_timing_save()}
			</button>
			<button type="button" class="btn" onclick={clearEverything}>
				{m.songs_timing_clear_all()}
			</button>
			<a class="btn" href={resolve('/songs/[id]', { id: data.id })}>
				{m.songs_timing_open_practice()}
			</a>
			<a class="btn" href={resolve('/songs')}>{m.songs_back()}</a>
			<span class="muted small" aria-live="polite">
				{#if saved}{m.songs_timing_saved()}{:else if dirty}{m.songs_timing_unsaved()}{:else if done === lines.length && lines.length > 0}{m.songs_timing_done()}{/if}
			</span>
		</div>
	{/if}
</div>

<style>
	.timing {
		gap: var(--space-8);
	}
	.head {
		gap: var(--space-2);
	}
	.small {
		font-size: 0.875rem;
	}
	.bar {
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-3);
	}
	.lines {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
	}
	.line {
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-3);
		padding: var(--space-3) var(--space-4);
	}
	.line.current {
		border-color: var(--accent);
		background: var(--accent-soft);
	}
	.pick {
		flex: 1;
		min-width: 12rem;
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: var(--space-1);
		background: none;
		border: 0;
		padding: 0;
		font: inherit;
		color: inherit;
		text-align: left;
		cursor: pointer;
	}
	.no {
		font-variant-numeric: tabular-nums;
	}
	.text {
		font-size: 1.125rem;
	}
	.time {
		font-variant-numeric: tabular-nums;
		min-width: 5.5rem;
		text-align: right;
		color: var(--accent);
	}
	.time.untimed {
		color: var(--fg-muted);
	}
	.nudges {
		flex-wrap: wrap;
		gap: var(--space-2);
	}
</style>

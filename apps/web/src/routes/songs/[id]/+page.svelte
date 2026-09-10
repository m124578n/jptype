<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import type { ScoreResult } from '@jptype/engine';
	import { m } from '$lib/paraglide/messages';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import Icon from '$lib/components/Icon.svelte';
	import Keyboard from '$lib/components/Keyboard.svelte';
	import ResultPanel from '$lib/components/ResultPanel.svelte';
	import TypingArea from '$lib/components/TypingArea.svelte';
	import YouTubePlayer from '$lib/components/YouTubePlayer.svelte';
	import { PracticeRun } from '$lib/practice/run.svelte';
	import { SongSyncRun } from '$lib/practice/song-sync.svelte';
	import { TypewriterSound } from '$lib/practice/sound';
	import {
		findSong,
		hasSync,
		loadSongMode,
		saveSongMode,
		type Song,
		type SongMode
	} from '$lib/songs';
	import {
		DEFAULT_SETTINGS,
		loadSettings,
		recordResult,
		saveSettings,
		type Settings
	} from '$lib/storage';
	import type { PlayerController, PlayerStateName } from '$lib/youtube';

	let { data } = $props();

	// Songs live in this browser only; read after mount so SSR and hydration agree.
	let song = $state.raw<Song | null>(null);
	let loaded = $state(false);
	let mode = $state<SongMode>('free');

	let run = $state.raw<PracticeRun | null>(null);
	let sync = $state.raw<SongSyncRun | null>(null);
	let result = $state<ScoreResult | null>(null);
	let newBest = $state(false);
	let skippedLines = $state(0);

	/** idle → countdown (3-2-1-START) → running; free mode stays 'running'. */
	let phase = $state<'idle' | 'countdown' | 'running'>('idle');
	let countdown = $state(3);
	let countdownTimer: ReturnType<typeof setInterval> | null = null;

	let controller = $state<PlayerController | undefined>(undefined);
	let playerState = $state<PlayerStateName>('unstarted');
	let playerFailed = $state(false);
	/** Last position seen from the player, to tell a normal tick from a seek. */
	let lastTime = Number.NaN;

	let settings = $state<Settings>({ ...DEFAULT_SETTINGS });
	let coarsePointer = $state(false);
	const sound = new TypewriterSound();

	/** A jump larger than this between 100 ms ticks can only be a seek. */
	const SEEK_JUMP_S = 1.5;
	const COUNTDOWN_MS = 700;

	const syncable = $derived(song !== null && hasSync(song));
	const active = $derived<PracticeRun | SongSyncRun | null>(mode === 'sync' ? sync : run);

	onMount(() => {
		settings = loadSettings();
		coarsePointer = window.matchMedia('(pointer: coarse)').matches;
		const found = findSong(data.id) ?? null;
		song = found;
		loaded = true;
		mode = found && hasSync(found) && loadSongMode() === 'sync' ? 'sync' : 'free';
		reset();
	});

	onDestroy(clearCountdown);

	$effect(() => {
		sound.enabled = settings.sound;
		sound.volume = settings.volume;
	});

	function updateSetting<K extends keyof Settings>(key: K, value: Settings[K]) {
		settings = { ...settings, [key]: value };
		saveSettings(settings);
	}

	function clearCountdown() {
		if (countdownTimer !== null) clearInterval(countdownTimer);
		countdownTimer = null;
	}

	function chooseMode(next: SongMode) {
		if (mode === next) return;
		mode = next;
		saveSongMode(next);
		reset();
	}

	/** Back to the start of whichever mode is selected. */
	function reset() {
		clearCountdown();
		result = null;
		newBest = false;
		skippedLines = 0;
		lastTime = Number.NaN;
		if (!song) return;
		if (mode === 'sync') {
			run = null;
			sync = new SongSyncRun(song.lines);
			phase = 'idle';
			controller?.pause();
		} else {
			sync = null;
			// Lyric lines are typed in order, one line per question.
			const texts = song.lines.map((l) => l.text);
			run = new PracticeRun(texts, { sequence: texts });
			phase = 'running';
		}
	}

	function startSync() {
		if (mode !== 'sync' || !sync || phase !== 'idle') return;
		clearCountdown();
		countdown = 3;
		phase = 'countdown';
		countdownTimer = setInterval(() => {
			countdown -= 1;
			if (countdown >= 0) return;
			clearCountdown();
			phase = 'running';
			controller?.play();
		}, COUNTDOWN_MS);
	}

	function finish(score: ScoreResult, skipped: number) {
		result = score;
		skippedLines = skipped;
		newBest = recordResult(`song:${data.id}`, score);
		sound.play('bell');
	}

	function finishSync() {
		const s = sync;
		if (!s || result !== null) return;
		if (!s.finished) s.finish(performance.now());
		controller?.pause();
		finish(s.result(), s.skippedLines);
	}

	function onPlayerTime(seconds: number) {
		const s = sync;
		if (mode !== 'sync' || !s || phase !== 'running' || s.finished || result !== null) {
			lastTime = seconds;
			return;
		}
		if (Number.isFinite(lastTime) && Math.abs(seconds - lastTime) > SEEK_JUMP_S) s.seek(seconds);
		else s.timeUpdate(seconds);
		lastTime = seconds;
		skippedLines = s.skippedLines;
		if (s.finished) finishSync();
	}

	function onPlayerState(state: PlayerStateName) {
		playerState = state;
		if (state === 'ended' && mode === 'sync' && phase === 'running') finishSync();
	}

	function togglePlay() {
		if (playerState === 'playing') controller?.pause();
		else controller?.play();
	}

	function onkeydown(e: KeyboardEvent) {
		const tag = (e.target as HTMLElement | null)?.tagName;
		if (tag === 'INPUT' || tag === 'TEXTAREA') return;

		if (e.key === 'Escape') {
			e.preventDefault();
			void goto(resolve('/songs'));
			return;
		}
		if ((e.ctrlKey || e.metaKey) && (e.key === 'r' || e.key === 'R')) {
			e.preventDefault();
			reset();
			return;
		}
		if (e.ctrlKey || e.metaKey || e.altKey) return;
		if (result !== null) return;

		if (mode === 'sync') {
			const s = sync;
			if (!s) return;
			if (phase === 'idle') {
				if (e.key !== ' ') return;
				e.preventDefault();
				startSync();
				return;
			}
			if (phase === 'countdown') return;
			// Space is play/pause — unless the line really expects a space character.
			if (e.key === ' ' && s.nextKey !== ' ') {
				e.preventDefault();
				togglePlay();
				return;
			}
			if (playerState !== 'playing') return; // paused: the song is not moving, ignore typing
			if (e.key.length !== 1) return;
			e.preventDefault();
			const res = s.press(e.key, performance.now());
			if (!res) return;
			sound.play(res.ok ? 'key' : 'error');
			if (s.finished) finishSync();
			return;
		}

		const r = run;
		if (!r || r.finished) return;
		if (e.key.length !== 1) return;
		e.preventDefault();
		const res = r.press(e.key, performance.now());
		if (!res) return;
		sound.play(res.ok ? 'key' : 'error');
		if (r.finished) finish(r.result(), 0);
	}

	const previous = $derived(active && active.index > 0 ? lineTextAt(active.index - 1) : undefined);
	const upcoming = $derived(active ? lineTextAt(active.index + 1) : undefined);

	function lineTextAt(index: number): string | undefined {
		if (mode === 'sync') return sync?.lines[index]?.text;
		return run?.questions[index];
	}
</script>

<svelte:head>
	<title>{song ? song.title : m.songs_title()} · {m.app_name()}</title>
</svelte:head>
<svelte:window {onkeydown} />

<div class="container stack song">
	{#if loaded && !song}
		<h1>{m.songs_not_found()}</h1>
		<p><a class="btn" href={resolve('/songs')}>{m.songs_back()}</a></p>
	{:else if song}
		<header class="stack head">
			<h1>{song.title}</h1>
			<div class="row modes" role="group" aria-label={m.songs_mode_label()}>
				<button
					type="button"
					class="btn"
					class:btn--primary={mode === 'sync'}
					aria-pressed={mode === 'sync'}
					disabled={!syncable}
					onclick={() => chooseMode('sync')}
				>
					{m.songs_mode_sync()}
				</button>
				<button
					type="button"
					class="btn"
					class:btn--primary={mode === 'free'}
					aria-pressed={mode === 'free'}
					onclick={() => chooseMode('free')}
				>
					{m.songs_mode_free()}
				</button>
			</div>
			{#if !syncable}
				<p class="muted small">
					{m.songs_sync_unavailable()}
					<a href={resolve('/songs/[id]/timing', { id: data.id })}>{m.songs_timing_link()}</a>
				</p>
			{:else if mode === 'sync'}
				<p class="muted small">{m.songs_mode_sync_hint()}</p>
			{:else}
				<p class="muted small">{m.songs_mode_free_hint()}</p>
			{/if}
		</header>

		<div class="stage">
			<YouTubePlayer
				videoId={song.youtubeId}
				title={song.title}
				bind:controller
				ontime={onPlayerTime}
				onstate={onPlayerState}
				onfail={() => (playerFailed = true)}
			/>
			{#if mode === 'sync' && phase === 'countdown'}
				<div class="countdown" aria-live="assertive">
					<span>{countdown > 0 ? countdown : m.songs_sync_countdown_go()}</span>
				</div>
			{/if}
		</div>

		{#if mode === 'sync' && result === null}
			<section class="stack practice">
				{#if phase === 'idle'}
					<p class="center">
						<button type="button" class="btn btn--primary" onclick={startSync}>
							{m.songs_sync_start()}
						</button>
					</p>
					<p class="muted small center">{m.songs_sync_keys()}</p>
				{:else if sync}
					<p class="muted small" aria-live="polite">
						{m.songs_progress({ current: sync.index + 1, total: sync.total })}
						{#if skippedLines > 0}· {m.songs_skipped({ count: skippedLines })}{/if}
					</p>
					<p class="muted line" lang="ja">{previous ?? ''}</p>
					<TypingArea run={sync} showHint={settings.showHint} />
					<p class="muted line" lang="ja">{upcoming ?? ''}</p>
					<p class="muted small center status" aria-live="polite">
						{#if playerState === 'paused'}
							{m.songs_sync_paused()}
						{:else if sync.lineDone}
							✓ {m.songs_sync_line_done()}
						{:else if playerState !== 'playing'}
							{m.songs_sync_waiting()}
						{:else}
							&nbsp;
						{/if}
					</p>
					{#if settings.showKeyboard}
						<Keyboard next={sync.nextKey} />
					{/if}
					{#if coarsePointer}
						<p class="muted small center">{m.typing_mobile_notice()}</p>
					{/if}
					<div class="row tools">
						<button
							type="button"
							class="btn btn--icon"
							aria-pressed={settings.showHint}
							aria-label={m.typing_hint_toggle()}
							title={m.typing_hint_toggle()}
							onclick={() => updateSetting('showHint', !settings.showHint)}
						>
							<Icon name="text" />
						</button>
						<button
							type="button"
							class="btn btn--icon"
							aria-pressed={settings.showKeyboard}
							aria-label={m.typing_keyboard_toggle()}
							title={m.typing_keyboard_toggle()}
							onclick={() => updateSetting('showKeyboard', !settings.showKeyboard)}
						>
							<Icon name="keyboard" />
						</button>
						<button
							type="button"
							class="btn btn--icon"
							aria-pressed={settings.sound}
							aria-label={m.typing_sound_toggle()}
							title={m.typing_sound_toggle()}
							onclick={() => updateSetting('sound', !settings.sound)}
						>
							<Icon name={settings.sound ? 'volume' : 'volume-off'} />
						</button>
						<button type="button" class="btn" onclick={reset}>{m.songs_restart()}</button>
						<button type="button" class="btn" onclick={finishSync}>{m.songs_sync_stop()}</button>
					</div>
					<p class="muted small center">{m.songs_sync_keys()}</p>
				{/if}
			</section>
		{:else if mode === 'free' && run && result === null}
			<section class="stack practice">
				<p class="muted small" aria-live="polite">
					{m.songs_progress({ current: run.index + 1, total: run.questions.length })}
				</p>
				<p class="muted line" lang="ja">{previous ?? ''}</p>
				<TypingArea {run} showHint={settings.showHint} />
				<p class="muted line" lang="ja">{upcoming ?? ''}</p>
				{#if settings.showKeyboard}
					<Keyboard next={run.nextKey} />
				{/if}
				{#if coarsePointer}
					<p class="muted small center">{m.typing_mobile_notice()}</p>
				{/if}
				<div class="row tools">
					<button
						type="button"
						class="btn btn--icon"
						aria-pressed={settings.showHint}
						aria-label={m.typing_hint_toggle()}
						title={m.typing_hint_toggle()}
						onclick={() => updateSetting('showHint', !settings.showHint)}
					>
						<Icon name="text" />
					</button>
					<button
						type="button"
						class="btn btn--icon"
						aria-pressed={settings.showKeyboard}
						aria-label={m.typing_keyboard_toggle()}
						title={m.typing_keyboard_toggle()}
						onclick={() => updateSetting('showKeyboard', !settings.showKeyboard)}
					>
						<Icon name="keyboard" />
					</button>
					<button
						type="button"
						class="btn btn--icon"
						aria-pressed={settings.sound}
						aria-label={m.typing_sound_toggle()}
						title={m.typing_sound_toggle()}
						onclick={() => updateSetting('sound', !settings.sound)}
					>
						<Icon name={settings.sound ? 'volume' : 'volume-off'} />
					</button>
					<button type="button" class="btn" onclick={reset}>{m.songs_restart()}</button>
				</div>
			</section>
		{:else if result && active}
			<ResultPanel
				{result}
				wrongUnits={active.wrongUnits}
				{newBest}
				onpracticeWrong={reset}
				onretry={reset}
				retryLabel={m.songs_again()}
				showPracticeWrong={false}
			/>
			{#if mode === 'sync'}
				<p class="center muted">{m.songs_skipped({ count: skippedLines })}</p>
			{/if}
			<p class="center">
				<a class="btn" href={resolve('/songs')}>{m.songs_back()}</a>
			</p>
		{/if}

		{#if playerFailed}
			<p class="muted small center">{m.songs_player_failed()}</p>
		{/if}
	{/if}
</div>

<style>
	.song {
		gap: var(--space-8);
	}
	.head {
		gap: var(--space-3);
	}
	.small {
		font-size: 0.875rem;
	}
	.center {
		text-align: center;
	}
	.modes {
		gap: var(--space-2);
		flex-wrap: wrap;
	}
	.stage {
		position: relative;
	}
	.countdown {
		position: absolute;
		inset: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		background: color-mix(in srgb, var(--bg) 78%, transparent);
		border-radius: var(--radius-lg);
		font-size: clamp(3rem, 12vw, 6rem);
		font-weight: 700;
		color: var(--accent);
		letter-spacing: 0.02em;
	}
	.practice {
		gap: var(--space-4);
		align-items: center;
	}
	.line {
		min-height: 1.8rem;
		font-size: 1.125rem;
		text-align: center;
	}
	.status {
		min-height: 1.4rem;
	}
	.tools {
		justify-content: center;
		margin-top: var(--space-4);
	}
</style>

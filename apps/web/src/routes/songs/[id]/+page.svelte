<script lang="ts">
	import { onMount } from 'svelte';
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
		loadReview,
		missedLines,
		recordLineOutcomes,
		reviewErrorCount,
		type LineOutcome,
		type ReviewStore
	} from '$lib/review';
	import { hasSync, loadSongMode, saveSongMode, type Song, type SongMode } from '$lib/songs';
	import { loadOne, setVisibility, toSong, type SongVisibility } from '$lib/songs-api';
	import {
		DEFAULT_SETTINGS,
		loadSettings,
		recordResult,
		saveSettings,
		type Settings
	} from '$lib/storage';
	import type { PlayerController, PlayerStateName } from '$lib/youtube';

	let { data } = $props();

	// The song comes from the account (signed in), from this browser, or — for a published song —
	// from the public API; either way it is fetched after mount so SSR and hydration agree.
	let song = $state.raw<Song | null>(null);
	let loaded = $state(false);
	/** The two persisted modes plus Review, which only practises the lines you got wrong. */
	type Mode = SongMode | 'review';
	let mode = $state<Mode>('free');

	/** Publishing state, only meaningful for a song that lives on the server. */
	let isOwner = $state(false);
	let remote = $state(false);
	let visibility = $state<SongVisibility>('private');
	let removed = $state(false);
	let consent = $state(false);
	let publishing = $state(false);
	let publishError = $state('');

	let run = $state.raw<PracticeRun | null>(null);
	let sync = $state.raw<SongSyncRun | null>(null);
	let result = $state<ScoreResult | null>(null);
	let newBest = $state(false);
	let skippedLines = $state(0);

	/** Per-line review records for this song (ROADMAP M4-2), read after mount. */
	let review = $state<ReviewStore>({});
	const subject = $derived(`song:${data.id}`);
	const texts = $derived(song ? song.lines.map((l) => l.text) : []);
	const missed = $derived(missedLines(review, subject, texts));
	const reviewTexts = $derived(missed.map((line) => line.text));
	/**
	 * Wrong keys per line of the run in progress, keyed by the line text (a repeated chorus line is
	 * one record), plus the lines actually reached — a line the song never got to must not be
	 * recorded as clean.
	 */
	let lineErrors: Record<string, number> = {};
	let lineSeen: Record<string, boolean> = {};

	function noteKey(text: string, ok: boolean) {
		if (text === '') return;
		lineSeen[text] = true;
		if (!ok) lineErrors[text] = (lineErrors[text] ?? 0) + 1;
	}

	function outcomes(): LineOutcome[] {
		return Object.keys(lineSeen).map((text) => ({ text, errors: lineErrors[text] ?? 0 }));
	}

	/** idle → running (the video plays and the lyric countdown is driven by its clock); free mode stays 'running'. */
	let phase = $state<'idle' | 'running'>('idle');

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
	/** A wait longer than this reads as an intro / interlude: show the seconds, not a 3-2-1. */
	const COUNTDOWN_FROM_S = 3;

	const syncable = $derived(song !== null && hasSync(song));
	const active = $derived<PracticeRun | SongSyncRun | null>(mode === 'sync' ? sync : run);
	/** Errors the stored record has for the line being typed now; 0 hides the note. */
	const lineNote = $derived(
		mode === 'review' && active ? reviewErrorCount(review, subject, active.current) : 0
	);

	async function load() {
		const found = await loadOne(data.id, data.user !== null);
		song = found ? toSong(found.entry) : null;
		isOwner = found?.isOwner ?? false;
		remote = found?.entry.remote ?? false;
		visibility = found?.entry.visibility ?? 'private';
		removed = found?.entry.status === 'removed';
		loaded = true;
		mode = song && hasSync(song) && loadSongMode() === 'sync' ? 'sync' : 'free';
		reset();
	}

	onMount(() => {
		settings = loadSettings();
		review = loadReview();
		coarsePointer = window.matchMedia('(pointer: coarse)').matches;
		void load();
	});

	/** Publish / unpublish. Going public needs the rights declaration ticked. */
	async function togglePublic() {
		if (!song || !isOwner || !remote) return;
		const next: SongVisibility = visibility === 'public' ? 'private' : 'public';
		if (next === 'public' && !consent) {
			publishError = m.songs_publish_need_consent();
			return;
		}
		publishing = true;
		publishError = '';
		const result = await setVisibility(data.id, next, consent);
		publishing = false;
		if (!result.ok) {
			publishError = result.status === 403 ? m.songs_publish_suspended() : m.songs_publish_error();
			return;
		}
		visibility = result.song.visibility;
		consent = false;
	}

	$effect(() => {
		sound.enabled = settings.sound;
		sound.volume = settings.volume;
	});

	function updateSetting<K extends keyof Settings>(key: K, value: Settings[K]) {
		settings = { ...settings, [key]: value };
		saveSettings(settings);
	}

	function chooseMode(next: Mode) {
		if (mode === next) return;
		mode = next;
		// Review is a one-off pass over the missed lines, so it is not remembered as *the* mode.
		if (next !== 'review') saveSongMode(next);
		reset();
	}

	/** Back to the start of whichever mode is selected. */
	function reset() {
		result = null;
		newBest = false;
		skippedLines = 0;
		lastTime = Number.NaN;
		lineErrors = {};
		lineSeen = {};
		// Nothing left to review (the last run was clean): fall back to the whole song.
		if (mode === 'review' && reviewTexts.length === 0) mode = 'free';
		if (!song) return;
		if (mode === 'sync') {
			run = null;
			sync = new SongSyncRun(song.lines);
			phase = 'idle';
			controller?.pause();
		} else {
			sync = null;
			// Lyric lines are typed in order, one line per question; review takes the missed ones.
			const questions = mode === 'review' ? reviewTexts : texts;
			run = new PracticeRun(questions, { sequence: questions });
			phase = 'running';
		}
	}

	/** Play at once; the countdown to the first lyric follows the video clock (see `waiting`). */
	function startSync() {
		if (mode !== 'sync' || !sync || phase !== 'idle') return;
		phase = 'running';
		controller?.play();
	}

	/**
	 * Seconds until the line the typist is waiting for (intro or interlude), from the video's own
	 * clock — so a song with a 15 s intro counts down to the lyric, not to the play button.
	 */
	const waiting = $derived.by(() => {
		const s = sync;
		if (!s || mode !== 'sync' || phase !== 'running' || result !== null) return null;
		const at = s.waitingFor;
		if (at === null) return null;
		const remaining = at - s.position;
		if (remaining <= 0) return null;
		return { remaining, intro: s.pending && s.index === 0 };
	});

	function finish(score: ScoreResult, skipped: number) {
		result = score;
		skippedLines = skipped;
		newBest = recordResult(subject, score, {
			durationMs: active?.durationMs,
			maxCombo: active?.maxCombo
		});
		review = recordLineOutcomes(subject, outcomes(), { title: song?.title ?? '' });
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
			// Space is play/pause — unless the line really expects a space character.
			if (e.key === ' ' && s.nextKey !== ' ') {
				e.preventDefault();
				togglePlay();
				return;
			}
			if (playerState !== 'playing') return; // paused: the song is not moving, ignore typing
			if (e.key.length !== 1) return;
			e.preventDefault();
			const line = s.current;
			const res = s.press(e.key, performance.now());
			if (!res) return;
			noteKey(line, res.ok);
			sound.play(res.ok ? 'key' : 'error');
			if (s.finished) finishSync();
			return;
		}

		const r = run;
		if (!r || r.finished) return;
		if (e.key.length !== 1) return;
		e.preventDefault();
		const line = r.current;
		const res = r.press(e.key, performance.now());
		if (!res) return;
		noteKey(line, res.ok);
		sound.play(res.ok ? 'key' : 'error');
		if (r.finished) finish(r.result(), 0);
	}

	const previous = $derived(
		active && active.index > 0 ? labelOf(lineTextAt(active.index - 1)) : undefined
	);
	const upcoming = $derived(active ? labelOf(lineTextAt(active.index + 1)) : undefined);

	/** Context lines read better as pasted (kanji) when a reading was converted. */
	function labelOf(text: string | undefined): string | undefined {
		return text === undefined ? undefined : (originalOf(text) ?? text);
	}
	/** The pasted (kanji) form of the line being typed, when the reading was converted (M4-1d). */
	const currentOriginal = $derived(active ? originalOf(active.current) : undefined);

	function lineTextAt(index: number): string | undefined {
		if (mode === 'sync') return sync?.lines[index]?.text;
		return run?.questions[index];
	}

	function originalOf(text: string): string | undefined {
		return song?.lines.find((l) => l.text === text && l.original !== undefined)?.original;
	}
</script>

<svelte:head>
	<title>{song ? song.title : m.songs_title()} · {m.app_name()}</title>
</svelte:head>
<svelte:window {onkeydown} />

<div class="container container--wide stack song">
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
				<button
					type="button"
					class="btn"
					class:btn--primary={mode === 'review'}
					aria-pressed={mode === 'review'}
					disabled={missed.length === 0}
					title={missed.length === 0 ? m.review_none() : m.review_mode_hint()}
					onclick={() => chooseMode('review')}
				>
					{m.review_mode()}
				</button>
			</div>
			{#if mode === 'review'}
				<p class="muted small">
					{m.review_mode_hint()} · {m.review_available({ count: missed.length })}
				</p>
			{:else if !syncable}
				<p class="muted small">
					{m.songs_sync_unavailable()}
					{#if isOwner}
						<a href={resolve('/songs/[id]/timing', { id: data.id })}>{m.songs_timing_link()}</a>
					{/if}
				</p>
			{:else if mode === 'sync'}
				<p class="muted small">{m.songs_mode_sync_hint()}</p>
			{:else}
				<p class="muted small">{m.songs_mode_free_hint()}</p>
			{/if}
			{#if mode !== 'review' && missed.length > 0}
				<p class="muted small">{m.review_available({ count: missed.length })}</p>
			{/if}
			{#if !isOwner}
				<p class="muted small">{m.songs_public_owner()}</p>
			{/if}
		</header>

		{#if isOwner && !removed}
			<section class="card publish stack">
				<strong>{m.songs_publish_title()}</strong>
				<p class="muted small">{m.songs_publish_body()}</p>
				{#if !remote}
					<p class="muted small">{m.songs_publish_local()}</p>
				{:else if visibility === 'public'}
					<p class="row">
						<span class="ok small">{m.songs_visibility_public()}</span>
						<button type="button" class="btn" disabled={publishing} onclick={togglePublic}>
							{m.songs_unpublish_button()}
						</button>
					</p>
				{:else}
					<label class="row consent">
						<input type="checkbox" bind:checked={consent} />
						<span class="small">{m.songs_publish_consent()}</span>
					</label>
					<p>
						<button
							type="button"
							class="btn btn--primary"
							disabled={publishing || !consent}
							onclick={togglePublic}
						>
							{m.songs_publish_button()}
						</button>
					</p>
				{/if}
				{#if publishError !== ''}
					<p class="error small" role="alert">{publishError}</p>
				{/if}
			</section>
		{:else if isOwner && removed}
			<section class="card publish stack">
				<strong>{m.songs_status_removed()}</strong>
				<p class="muted small">{m.songs_publish_removed()}</p>
			</section>
		{/if}

		<div class="board" class:live={result === null}>
			<div class="stage">
				<YouTubePlayer
					videoId={song.youtubeId}
					title={song.title}
					bind:controller
					ontime={onPlayerTime}
					onstate={onPlayerState}
					onfail={() => (playerFailed = true)}
				/>
				{#if waiting !== null}
					<div
						class="countdown"
						class:far={waiting.remaining > COUNTDOWN_FROM_S}
						aria-live="polite"
					>
						{#if waiting.remaining > COUNTDOWN_FROM_S}
							<span class="gap">
								{waiting.intro ? m.songs_sync_intro() : m.songs_sync_interlude()}
								· {m.songs_sync_next_in({ seconds: Math.ceil(waiting.remaining) })}
							</span>
						{:else}
							<span>{Math.ceil(waiting.remaining)}</span>
						{/if}
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
						<div class="lyric" class:ruby={currentOriginal !== undefined}>
							<TypingArea run={sync} showHint={settings.showHint} />
							{#if currentOriginal !== undefined}
								<p class="kanji" lang="ja">{currentOriginal}</p>
							{/if}
						</div>
						<p class="muted line" lang="ja">{upcoming ?? ''}</p>
						<p class="muted small center status" aria-live="polite">
							{#if playerState === 'paused'}
								{m.songs_sync_paused()}
							{:else if sync.pending && playerState === 'playing'}
								{m.songs_sync_pending()}
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
			{:else if mode !== 'sync' && run && result === null}
				<section class="stack practice">
					<p class="muted small" aria-live="polite">
						{m.songs_progress({ current: run.index + 1, total: run.questions.length })}
					</p>
					<p class="muted line" lang="ja">{previous ?? ''}</p>
					{#if lineNote > 0}
						<p class="review-note small" aria-live="polite">
							{m.review_line_note({ count: lineNote })}
						</p>
					{/if}
					<div class="lyric" class:ruby={currentOriginal !== undefined}>
						<TypingArea {run} showHint={settings.showHint} />
						{#if currentOriginal !== undefined}
							<p class="kanji" lang="ja">{currentOriginal}</p>
						{/if}
					</div>
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
					durationMs={active.durationMs}
					maxCombo={active.maxCombo}
					errors={active.errorAnalysis()}
				/>
				{#if mode === 'sync'}
					<p class="center muted">{m.songs_skipped({ count: skippedLines })}</p>
				{:else if mode === 'review'}
					<p class="center muted small">
						{missed.length === 0 ? m.review_cleared() : m.review_local_only()}
					</p>
				{/if}
				<p class="center">
					<a class="btn" href={resolve('/songs')}>{m.songs_back()}</a>
				</p>
			{/if}
		</div>

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
	.publish {
		padding: var(--space-4) var(--space-6);
		gap: var(--space-2);
	}
	.publish p {
		margin: 0;
	}
	.consent {
		align-items: flex-start;
		gap: var(--space-2);
		cursor: pointer;
	}
	.consent input {
		margin-top: 0.2em;
	}
	.ok {
		color: var(--accent);
	}
	.error {
		color: var(--danger);
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
		pointer-events: none;
	}
	.countdown.far {
		align-items: flex-end;
		padding-bottom: var(--space-4);
		background: transparent;
	}
	.gap {
		font-size: 1rem;
		font-weight: 500;
		letter-spacing: 0;
		padding: var(--space-2) var(--space-4);
		border-radius: var(--radius);
		background: color-mix(in srgb, var(--bg) 85%, transparent);
	}
	/* Video and the line being typed side by side on wide screens, so both stay in view (owner 2026-09-11). */
	.board {
		display: grid;
		gap: var(--space-6);
		align-items: start;
	}
	.board.live .stage {
		width: min(100%, calc(45vh * 16 / 9));
		margin-inline: auto;
	}
	@media (min-width: 64rem) {
		.board.live {
			grid-template-columns: minmax(0, 1.1fr) minmax(0, 1fr);
		}
		.board.live .stage {
			width: 100%;
			position: sticky;
			top: var(--space-4);
		}
	}
	/* Kana (what is typed) above, the pasted kanji line below it, like ruby (owner 2026-09-11). */
	.lyric {
		display: grid;
		gap: var(--space-2);
		justify-items: center;
		width: 100%;
	}
	.lyric.ruby :global(.target) {
		font-size: clamp(1.5rem, 5vw, 2.5rem);
	}
	.kanji {
		margin: 0;
		font-size: clamp(1.75rem, 7vw, 3rem);
		font-weight: 600;
		line-height: 1.3;
		text-align: center;
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
	.review-note {
		margin: 0;
		color: var(--fg-muted);
	}
	.tools {
		justify-content: center;
		margin-top: var(--space-4);
	}
</style>

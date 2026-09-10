<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import type { LessonHint } from '@jptype/data';
	import { contentMode } from '@jptype/data';
	import type { ScoreResult } from '@jptype/engine';
	import { m } from '$lib/paraglide/messages';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import Icon from '$lib/components/Icon.svelte';
	import Keyboard from '$lib/components/Keyboard.svelte';
	import ResultPanel from '$lib/components/ResultPanel.svelte';
	import TypingArea from '$lib/components/TypingArea.svelte';
	import YouTubePlayer from '$lib/components/YouTubePlayer.svelte';
	import { hasTimeline } from '$lib/contents';
	import { difficultyLabel, jlptLabel, typeLabel } from '$lib/contents-labels';
	import { PracticeRun } from '$lib/practice/run.svelte';
	import { SongSyncRun } from '$lib/practice/song-sync.svelte';
	import { TypewriterSound } from '$lib/practice/sound';
	import { submitPracticeRun } from '$lib/practice/submit';
	import {
		loadReview,
		missedLines,
		recordLineOutcomes,
		reviewErrorCount,
		type LineOutcome,
		type ReviewStore
	} from '$lib/review';
	import {
		DEFAULT_SETTINGS,
		loadSettings,
		recordKanaStats,
		recordResult,
		saveSettings,
		type Settings
	} from '$lib/storage';
	import type { PlayerController, PlayerStateName } from '$lib/youtube';

	let { data } = $props();

	const mode = $derived(contentMode(data.content.id));
	const videoId = $derived(data.content.videoId ?? '');
	const syncable = $derived(videoId !== '' && hasTimeline(data.lines));
	/** Sync mode reads the lines the way `SongSyncRun` wants them. */
	const timedLines = $derived(
		data.lines.map((l) => ({
			text: l.kanaText,
			...(l.startTime === null ? {} : { start: l.startTime })
		}))
	);
	const texts = $derived(data.lines.map((l) => l.kanaText));

	/** The written form above the kana, exactly like the N5 word/sentence lessons. */
	const hints = $derived.by(() => {
		const out: Record<string, LessonHint> = {};
		for (const line of data.lines) {
			if (line.originalText !== '' && line.originalText !== line.kanaText) {
				out[line.kanaText] = { kanji: line.originalText, zh: '' };
			}
		}
		return out;
	});

	/** Sync (follow the video) / Free (line by line) / Review (only the lines you got wrong). */
	type Mode = 'sync' | 'free' | 'review';
	let practiceMode = $state<Mode>('free');
	let run = $state.raw<PracticeRun | null>(null);
	let sync = $state.raw<SongSyncRun | null>(null);
	let result = $state<ScoreResult | null>(null);
	let newBest = $state(false);
	let skippedLines = $state(0);
	let rank = $state<number | null>(null);
	/** A sync run with skipped or replayed lines cannot be verified server-side; it stays local. */
	let localOnly = $state(false);

	/** Per-line review records for this content (ROADMAP M4-2), read after mount. */
	let review = $state<ReviewStore>({});
	const missed = $derived(missedLines(review, mode, texts));
	const reviewTexts = $derived(missed.map((line) => line.text));
	/**
	 * Wrong keys per line of the run in progress, keyed by the line text (a repeated line is one
	 * record), plus the lines actually reached — lines the user never got to must not be recorded
	 * as clean when a sync run is stopped early.
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

	/** idle → countdown (3-2-1-START) → running; free mode stays 'running'. */
	let phase = $state<'idle' | 'countdown' | 'running'>('idle');
	let countdown = $state(3);
	let countdownTimer: ReturnType<typeof setInterval> | null = null;

	let controller = $state<PlayerController | undefined>(undefined);
	let playerState = $state<PlayerStateName>('unstarted');
	let playerFailed = $state(false);
	let lastTime = Number.NaN;

	let settings = $state<Settings>({ ...DEFAULT_SETTINGS });
	let coarsePointer = $state(false);
	const sound = new TypewriterSound();

	/** A jump larger than this between 100 ms ticks can only be a seek. */
	const SEEK_JUMP_S = 1.5;
	const COUNTDOWN_MS = 700;

	const active = $derived<PracticeRun | SongSyncRun | null>(practiceMode === 'sync' ? sync : run);
	/** Errors the stored record has for the line being typed now; 0 hides the note. */
	const lineNote = $derived(
		practiceMode === 'review' && active ? reviewErrorCount(review, mode, active.current) : 0
	);

	onMount(() => {
		settings = loadSettings();
		coarsePointer = window.matchMedia('(pointer: coarse)').matches;
		review = loadReview();
		practiceMode = syncable ? 'sync' : 'free';
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

	function chooseMode(next: Mode) {
		if (practiceMode === next) return;
		practiceMode = next;
		reset();
	}

	function reset() {
		clearCountdown();
		result = null;
		newBest = false;
		skippedLines = 0;
		rank = null;
		localOnly = false;
		lastTime = Number.NaN;
		lineErrors = {};
		lineSeen = {};
		// Nothing left to review (the last run was clean): fall back to the whole content.
		if (practiceMode === 'review' && reviewTexts.length === 0) practiceMode = 'free';
		if (practiceMode === 'sync') {
			run = null;
			sync = new SongSyncRun(timedLines);
			phase = 'idle';
			controller?.pause();
		} else {
			sync = null;
			const questions = practiceMode === 'review' ? reviewTexts : texts;
			run = new PracticeRun(questions, { sequence: questions });
			phase = 'running';
		}
	}

	function startSync() {
		if (practiceMode !== 'sync' || !sync || phase !== 'idle') return;
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

	/**
	 * Score locally, then send the run to the server (spec §8): signed in it is ranked per
	 * content, signed out it is only stored. A sync run is submitted only while it still
	 * replays — skipped and replayed lines make `text` and `log` disagree.
	 */
	async function finish(
		finished: PracticeRun | SongSyncRun,
		score: ScoreResult,
		replayable: boolean
	) {
		result = score;
		newBest = recordResult(mode, score);
		recordKanaStats(finished.unitOutcomes);
		review = recordLineOutcomes(mode, outcomes(), { title: data.content.title });
		sound.play('bell');
		// A review run only covers the lines this typist missed, so it is never ranked.
		localOnly = !replayable || practiceMode === 'review';
		if (!replayable || practiceMode === 'review') return;
		const response = await submitPracticeRun(finished, mode, {
			loggedIn: data.user !== null,
			turnstileSiteKey: data.turnstileSiteKey
		});
		rank = response?.rank ?? null;
	}

	function finishSync() {
		const s = sync;
		if (!s || result !== null) return;
		if (!s.finished) s.finish(performance.now());
		controller?.pause();
		skippedLines = s.skippedLines;
		void finish(s, s.result(), s.replayable);
	}

	function onPlayerTime(seconds: number) {
		const s = sync;
		if (practiceMode !== 'sync' || !s || phase !== 'running' || s.finished || result !== null) {
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
		if (state === 'ended' && practiceMode === 'sync' && phase === 'running') finishSync();
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
			void goto(resolve('/contents'));
			return;
		}
		if ((e.ctrlKey || e.metaKey) && (e.key === 'r' || e.key === 'R')) {
			e.preventDefault();
			reset();
			return;
		}
		if (e.ctrlKey || e.metaKey || e.altKey) return;
		if (result !== null) return;

		if (practiceMode === 'sync') {
			const s = sync;
			if (!s) return;
			if (phase === 'idle') {
				if (e.key !== ' ') return;
				e.preventDefault();
				startSync();
				return;
			}
			if (phase === 'countdown') return;
			if (e.key === ' ' && s.nextKey !== ' ') {
				e.preventDefault();
				togglePlay();
				return;
			}
			if (playerState !== 'playing') return; // paused: the video is not moving
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
		if (r.finished) void finish(r, r.result(), true);
	}

	function lineTextAt(index: number): string | undefined {
		if (practiceMode === 'sync') return sync?.lines[index]?.text;
		return run?.questions[index];
	}

	const previous = $derived(active && active.index > 0 ? lineTextAt(active.index - 1) : undefined);
	const upcoming = $derived(active ? lineTextAt(active.index + 1) : undefined);
	const boardHref = $derived(`${resolve('/leaderboard')}?mode=${encodeURIComponent(mode)}`);
</script>

<svelte:head><title>{data.content.title} · {m.app_name()}</title></svelte:head>
<svelte:window {onkeydown} />

<div class="container stack content">
	<header class="stack head">
		<a class="muted back" href={resolve('/contents')}>← {m.contents_back()}</a>
		<h1>{data.content.title}</h1>
		<p class="row tags">
			<span class="tag">{typeLabel[data.content.type]()}</span>
			<span class="tag">{difficultyLabel[data.content.difficulty]()}</span>
			{#if data.content.jlptLevel !== 'unknown'}
				<span class="tag">{jlptLabel[data.content.jlptLevel]()}</span>
			{/if}
			<span class="muted small">{m.contents_lines({ count: data.lines.length })}</span>
		</p>
		{#if data.content.description !== ''}
			<p class="muted">{data.content.description}</p>
		{/if}

		<div class="row modes" role="group" aria-label={m.contents_mode_label()}>
			<button
				type="button"
				class="btn"
				class:btn--primary={practiceMode === 'sync'}
				aria-pressed={practiceMode === 'sync'}
				disabled={!syncable}
				onclick={() => chooseMode('sync')}
			>
				{m.contents_mode_sync()}
			</button>
			<button
				type="button"
				class="btn"
				class:btn--primary={practiceMode === 'free'}
				aria-pressed={practiceMode === 'free'}
				onclick={() => chooseMode('free')}
			>
				{m.contents_mode_free()}
			</button>
			<button
				type="button"
				class="btn"
				class:btn--primary={practiceMode === 'review'}
				aria-pressed={practiceMode === 'review'}
				disabled={missed.length === 0}
				title={missed.length === 0 ? m.review_none() : m.review_mode_hint()}
				onclick={() => chooseMode('review')}
			>
				{m.review_mode()}
			</button>
		</div>
		<p class="muted small">
			{#if practiceMode === 'sync'}
				{m.contents_mode_sync_hint()}
			{:else if practiceMode === 'review'}
				{m.review_mode_hint()} · {m.review_available({ count: missed.length })}
			{:else if missed.length > 0}
				{m.contents_mode_free_hint()} · {m.review_available({ count: missed.length })}
			{:else}
				{m.contents_mode_free_hint()}
			{/if}
		</p>
	</header>

	{#if videoId !== ''}
		<div class="stage">
			<YouTubePlayer
				{videoId}
				title={data.content.title}
				bind:controller
				ontime={onPlayerTime}
				onstate={onPlayerState}
				onfail={() => (playerFailed = true)}
			/>
			{#if practiceMode === 'sync' && phase === 'countdown'}
				<div class="countdown" aria-live="assertive">
					<span>{countdown > 0 ? countdown : m.contents_countdown_go()}</span>
				</div>
			{/if}
		</div>
		{#if playerFailed}
			<p class="muted small center">{m.songs_player_failed()}</p>
		{/if}
	{/if}

	{#if result === null && practiceMode === 'sync' && sync}
		<section class="stack practice">
			{#if phase === 'idle'}
				<p class="center">
					<button type="button" class="btn btn--primary" onclick={startSync}>
						{m.contents_sync_start()}
					</button>
				</p>
				<p class="muted small center">{m.contents_keys()}</p>
			{:else}
				<p class="muted small" aria-live="polite">
					{m.contents_progress({ current: sync.index + 1, total: sync.total })}
					{#if skippedLines > 0}· {m.contents_skipped({ count: skippedLines })}{/if}
				</p>
				<p class="muted line" lang="ja">{previous ?? ''}</p>
				<TypingArea run={sync} showHint={settings.showHint} {hints} />
				<p class="muted line" lang="ja">{upcoming ?? ''}</p>
				<p class="muted small center status" aria-live="polite">
					{#if playerState === 'paused'}
						{m.contents_sync_paused()}
					{:else if sync.lineDone}
						✓ {m.contents_sync_line_done()}
					{:else if playerState !== 'playing'}
						{m.contents_sync_waiting()}
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
					<button type="button" class="btn" onclick={reset}>{m.contents_restart()}</button>
					<button type="button" class="btn" onclick={finishSync}>{m.contents_stop()}</button>
				</div>
				<p class="muted small center">{m.contents_keys()}</p>
			{/if}
		</section>
	{:else if result === null && run}
		<section class="stack practice">
			<p class="muted small" aria-live="polite">
				{m.contents_progress({ current: run.index + 1, total: run.questions.length })}
			</p>
			<p class="muted line" lang="ja">{previous ?? ''}</p>
			{#if lineNote > 0}
				<p class="review-note small" aria-live="polite">
					{m.review_line_note({ count: lineNote })}
				</p>
			{/if}
			<TypingArea {run} showHint={settings.showHint} {hints} />
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
				<button type="button" class="btn" onclick={reset}>{m.contents_restart()}</button>
			</div>
		</section>
	{:else if result && active}
		<ResultPanel
			{result}
			wrongUnits={active.wrongUnits}
			{newBest}
			onpracticeWrong={reset}
			onretry={reset}
			retryLabel={m.contents_again()}
			showPracticeWrong={false}
		/>
		{#if practiceMode === 'sync' && skippedLines > 0}
			<p class="center muted">{m.contents_skipped({ count: skippedLines })}</p>
		{/if}
		{#if practiceMode === 'review'}
			<p class="center muted small">
				{missed.length === 0 ? m.review_cleared() : m.review_local_only()}
			</p>
		{:else if localOnly}
			<p class="center muted small">{m.contents_local_only()}</p>
		{:else if rank !== null}
			<p class="center muted">{m.contents_rank({ rank })}</p>
		{/if}
		<p class="row center actions">
			<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- boardHref applies resolve(); only a query string is appended -->
			<a class="btn" href={boardHref}>{m.contents_leaderboard()}</a>
			<a class="btn" href={resolve('/contents')}>{m.contents_back()}</a>
		</p>
	{/if}

	{#if data.content.sourceName !== '' || data.content.sourceUrl !== '' || data.content.license !== ''}
		<footer class="muted small source">
			{m.contents_source_label()}
			{#if data.content.sourceName !== ''}<span>{data.content.sourceName}</span>{/if}
			{#if data.content.license !== ''}<span>{data.content.license}</span>{/if}
			{#if data.content.sourceUrl !== ''}
				<a href={data.content.sourceUrl} target="_blank" rel="external noopener noreferrer">
					{m.contents_source_link()}
				</a>
			{/if}
		</footer>
	{/if}
</div>

<style>
	.content {
		gap: var(--space-8);
	}
	.head {
		gap: var(--space-3);
	}
	.back {
		text-decoration: none;
		font-size: 0.875rem;
	}
	.small {
		font-size: 0.875rem;
	}
	.center {
		text-align: center;
	}
	.tags {
		flex-wrap: wrap;
		gap: var(--space-2);
		margin: 0;
	}
	.tag {
		font-size: 0.75rem;
		padding: 2px var(--space-2);
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
		color: var(--fg-muted);
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
	.review-note {
		margin: 0;
		color: var(--fg-muted);
	}
	.tools {
		justify-content: center;
		margin-top: var(--space-4);
	}
	.actions {
		justify-content: center;
	}
	.source {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2);
		justify-content: center;
		border-top: 1px solid var(--border);
		padding-top: var(--space-4);
	}
</style>

<script lang="ts">
	import { onDestroy } from 'svelte';
	import { TIMED_POOL_IDS, TIMED_POOLS, type TimedPoolId } from '@jptype/data';
	import type { ScoreResult } from '@jptype/engine';
	import { m } from '$lib/paraglide/messages';
	import { resolve } from '$app/paths';
	import Icon from '$lib/components/Icon.svelte';
	import Keyboard from '$lib/components/Keyboard.svelte';
	import ResultPanel from '$lib/components/ResultPanel.svelte';
	import type { ErrorAnalysis } from '$lib/practice/errors';
	import { PracticeRun } from '$lib/practice/run.svelte';
	import { TypewriterSound } from '$lib/practice/sound';
	import { hasJapaneseVoice, speak, speechAvailable, stopSpeaking } from '$lib/speech';
	import {
		DEFAULT_SETTINGS,
		loadSettings,
		recordKanaStats,
		recordResult,
		saveSettings,
		type Settings
	} from '$lib/storage';

	/** Same length as a lesson practice (spec §7.1). */
	const QUESTION_COUNT = 20;
	/** How long a revealed kana stays on screen. */
	const REVEAL_MS = 1400;
	/** Wrong keys in a row before we give the answer away. */
	const STUCK_AFTER = 2;

	const poolLabel: Record<TimedPoolId, () => string> = {
		allhira: m.timed_pool_allhira,
		allkata: m.timed_pool_allkata,
		all: m.timed_pool_all,
		n5: m.timed_pool_n5
	};

	type Phase = 'setup' | 'run' | 'result';
	let phase = $state<Phase>('setup');
	let pool = $state<TimedPoolId>('allhira');
	let run = $state.raw<PracticeRun | null>(null);
	let result = $state<ScoreResult | null>(null);
	let newBest = $state(false);
	let errors = $state<ErrorAnalysis | null>(null);

	/** 'checking' until we know whether a local ja-JP voice exists. */
	let voice = $state<'checking' | 'ready' | 'none'>('checking');
	let speaking = $state(false);
	let playToken = 0;

	/** Kana shown (muted) for a moment after a unit is done or the user gets stuck. */
	let revealed = $state('');
	let revealTimer: ReturnType<typeof setTimeout> | null = null;
	/** Two wrong keys in a row: show the romaji hint and the next key until they move on. */
	let stuck = $state(false);
	let wrongStreak = 0;

	let settings = $state<Settings>({ ...DEFAULT_SETTINGS });
	let coarsePointer = $state(false);
	const sound = new TypewriterSound();

	$effect(() => {
		settings = loadSettings();
		coarsePointer = window.matchMedia('(pointer: coarse)').matches;
	});
	$effect(() => {
		sound.enabled = settings.sound;
		sound.volume = settings.volume;
	});
	$effect(() => {
		if (!speechAvailable()) {
			voice = 'none';
			return;
		}
		void hasJapaneseVoice().then((ok) => {
			voice = ok ? 'ready' : 'none';
		});
	});

	function updateSetting<K extends keyof Settings>(key: K, value: Settings[K]) {
		settings = { ...settings, [key]: value };
		saveSettings(settings);
	}

	/** Speak the current question. Only the newest playback owns the `speaking` flag. */
	function play() {
		const r = run;
		if (!r) return;
		const token = ++playToken;
		const text = r.current;
		speaking = true;
		void speak(text).then(() => {
			if (playToken === token) speaking = false;
		});
	}

	// Auto-play when a question starts (and on every new question).
	$effect(() => {
		if (phase !== 'run' || !run) return;
		void run.index;
		play();
	});

	function clearReveal() {
		if (revealTimer) clearTimeout(revealTimer);
		revealTimer = null;
	}

	function reveal(kana: string) {
		if (!kana) return;
		revealed = kana;
		clearReveal();
		revealTimer = setTimeout(() => (revealed = ''), REVEAL_MS);
	}

	function start() {
		clearReveal();
		revealed = '';
		stuck = false;
		wrongStreak = 0;
		result = null;
		run = new PracticeRun(TIMED_POOLS[pool], { count: QUESTION_COUNT });
		phase = 'run';
	}

	function quit() {
		stopSpeaking();
		clearReveal();
		revealed = '';
		speaking = false;
		phase = 'setup';
	}

	/** Listening runs have no server mode yet (§11 M3), so they stay in localStorage. */
	function finish(r: PracticeRun) {
		stopSpeaking();
		speaking = false;
		clearReveal();
		revealed = '';
		stuck = false;
		const s = r.result();
		result = s;
		errors = r.errorAnalysis();
		newBest = recordResult(`listen:${pool}`, s, {
			durationMs: r.durationMs,
			maxCombo: r.maxCombo
		});
		recordKanaStats(r.unitOutcomes);
		sound.play('bell');
		phase = 'result';
	}

	function onkeydown(e: KeyboardEvent) {
		if (phase !== 'run' || !run) return;
		if (e.ctrlKey || e.metaKey || e.altKey) return;
		if ((e.target as HTMLElement | null)?.tagName === 'INPUT') return;
		// Tab replays the question; Shift+Tab is left alone so the page stays navigable.
		if (e.key === 'Tab' && !e.shiftKey) {
			e.preventDefault();
			play();
			return;
		}
		if (e.key.length !== 1) return;
		e.preventDefault();
		// press() may swap in the next question's session; remember the units being typed.
		const units = run.session.units;
		const res = run.press(e.key, performance.now());
		if (!res) return;
		sound.play(res.ok ? 'key' : 'error');
		const kana = units[res.unitIndex]?.kana ?? '';
		if (res.ok) {
			wrongStreak = 0;
			stuck = false;
		} else {
			wrongStreak += 1;
			if (wrongStreak >= STUCK_AFTER) {
				stuck = true;
				reveal(kana);
			}
		}
		if (res.unitDone) {
			wrongStreak = 0;
			stuck = false;
			reveal(kana);
		}
		if (run.finished) finish(run);
	}

	onDestroy(() => {
		clearReveal();
		stopSpeaking();
	});

	const masked = $derived.by(() => {
		if (!run) return [] as string[];
		void run.tick;
		return run.session.units.map(() => '●');
	});
</script>

<svelte:head><title>{m.listen_title()} · {m.seo_site_name()}</title></svelte:head>
<svelte:window {onkeydown} />

<div class="container stack listen">
	<header class="stack head">
		<h1>{m.listen_title()}</h1>
		{#if phase === 'setup'}<p class="muted">{m.listen_lead()}</p>{/if}
	</header>

	{#if voice === 'checking'}
		<p class="muted center">{m.listen_checking()}</p>
	{:else if voice === 'none'}
		<section class="stack card no-voice" aria-labelledby="no-voice-title">
			<h2 id="no-voice-title">{m.listen_no_voice_title()}</h2>
			<p class="muted">{m.listen_no_voice_body()}</p>
			<p><a class="btn" href={resolve('/learn')}>{m.listen_no_voice_back()}</a></p>
		</section>
	{:else if phase === 'setup'}
		<section class="stack setup">
			<fieldset class="choice">
				<legend>{m.listen_pool_label()}</legend>
				<div class="row">
					{#each TIMED_POOL_IDS as id (id)}
						<button
							type="button"
							class="btn"
							aria-pressed={pool === id}
							onclick={() => (pool = id)}
						>
							{poolLabel[id]()}
						</button>
					{/each}
				</div>
			</fieldset>
			<p class="center">
				<button type="button" class="btn btn--primary" onclick={start}>{m.listen_start()}</button>
			</p>
			<p class="muted center small">{m.listen_count_hint({ count: QUESTION_COUNT })}</p>
		</section>
	{:else if phase === 'run' && run}
		<section class="stack practice">
			<p class="muted progress">
				{m.listen_progress({ current: run.index + 1, total: run.total })}
			</p>
			<div class="quiz" aria-label={m.listen_masked({ current: run.index + 1, total: run.total })}>
				<p class="mask" class:speaking aria-hidden="true">
					{#each masked as dot, i (i)}
						<span class="dot" class:current={i === run.unitIndex}>{dot}</span>
					{/each}
				</p>
				<p class="reveal muted" lang="ja" aria-live="polite">
					{#if revealed}{revealed}{/if}
				</p>
				<p class="typed" aria-hidden="true">
					<span>{run.typed}</span>{#if stuck}<span class="rest"
							>{run.hint.slice(run.typed.length)}</span
						>{/if}
				</p>
			</div>
			<div class="row replay">
				<button type="button" class="btn btn--primary" onclick={play}>
					<Icon name="speaker" />
					{m.listen_replay()}
				</button>
				<span class="muted small" aria-live="polite">
					{#if speaking}{m.listen_speaking()}{/if}
				</span>
			</div>
			<p class="muted center small">{m.listen_replay_hint()}</p>
			{#if settings.showKeyboard}
				<Keyboard next={stuck ? run.nextKey : ''} />
			{/if}
			{#if coarsePointer}
				<p class="muted notice">{m.typing_mobile_notice()}</p>
			{/if}
			<div class="row tools">
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
				<button type="button" class="btn" onclick={quit}>{m.listen_cancel()}</button>
			</div>
		</section>
	{:else if phase === 'result' && result && run}
		<p class="muted center">{poolLabel[pool]()}</p>
		<ResultPanel
			{result}
			wrongUnits={run.wrongUnits}
			{newBest}
			durationMs={run.durationMs}
			maxCombo={run.maxCombo}
			errors={errors ?? undefined}
			onpracticeWrong={start}
			onretry={start}
			retryLabel={m.listen_again()}
			showPracticeWrong={false}
		/>
		<p class="center">
			<button type="button" class="btn" onclick={() => (phase = 'setup')}>
				{m.listen_change_pool()}
			</button>
		</p>
	{/if}
</div>

<style>
	.listen {
		gap: var(--space-8);
	}
	.head {
		gap: var(--space-2);
	}
	.setup {
		gap: var(--space-8);
	}
	.choice {
		border: 0;
		padding: 0;
		margin: 0;
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
	}
	legend {
		padding: 0;
		font-weight: 500;
		margin-bottom: var(--space-2);
	}
	.center {
		text-align: center;
	}
	.small {
		font-size: 0.875rem;
	}
	.no-voice {
		padding: var(--space-6);
		gap: var(--space-4);
	}
	.practice {
		gap: var(--space-6);
		align-items: center;
	}
	.quiz {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--space-2);
		min-height: 12rem;
	}
	.mask {
		font-size: clamp(3rem, 12vw, 6rem);
		line-height: 1.15;
		letter-spacing: 0.08em;
		color: var(--border);
		display: flex;
		justify-content: center;
	}
	.mask.speaking .dot.current {
		color: var(--accent);
	}
	.dot.current {
		color: var(--fg-muted);
		transition: color var(--dur-fast) var(--ease-out);
	}
	.reveal {
		min-height: 3rem;
		font-size: 2.25rem;
		font-weight: 500;
		line-height: 1.2;
	}
	.typed {
		min-height: 2rem;
		font-size: 1.375rem;
		letter-spacing: 0.1em;
		font-variant-numeric: tabular-nums;
	}
	.typed .rest {
		color: var(--fg-muted);
	}
	.replay {
		justify-content: center;
	}
	.notice {
		font-size: 0.875rem;
		text-align: center;
	}
	.tools {
		justify-content: center;
		margin-top: var(--space-4);
	}
	@media (prefers-reduced-motion: reduce) {
		.dot.current {
			transition: none;
		}
	}
</style>

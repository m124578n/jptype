<script lang="ts">
	import { onDestroy } from 'svelte';
	import {
		TIMED_POOL_IDS,
		TIMED_POOLS,
		TIMED_SECONDS,
		timedMode,
		WORDS_N5,
		type LessonHint,
		type TimedPoolId,
		type TimedSeconds
	} from '@jptype/data';
	import type { ScoreResult } from '@jptype/engine';
	import { m } from '$lib/paraglide/messages';
	import Icon from '$lib/components/Icon.svelte';
	import Keyboard from '$lib/components/Keyboard.svelte';
	import ResultPanel from '$lib/components/ResultPanel.svelte';
	import TypingArea from '$lib/components/TypingArea.svelte';
	import type { ErrorAnalysis } from '$lib/practice/errors';
	import { PracticeRun } from '$lib/practice/run.svelte';
	import { TypewriterSound } from '$lib/practice/sound';
	import { submitPracticeRun } from '$lib/practice/submit';
	import {
		DEFAULT_SETTINGS,
		loadSettings,
		recordKanaStats,
		recordResult,
		saveSettings,
		type Settings
	} from '$lib/storage';

	const poolLabel: Record<TimedPoolId, () => string> = {
		allhira: m.timed_pool_allhira,
		allkata: m.timed_pool_allkata,
		all: m.timed_pool_all,
		n5: m.timed_pool_n5,
		n4: m.timed_pool_n4,
		n3: m.timed_pool_n3,
		n2: m.timed_pool_n2,
		n1: m.timed_pool_n1,
		slang: m.timed_pool_slang
	};

	/** Kanji + 繁體中文 shown above the target in the N5 word pool. */
	const N5_HINTS: Record<string, LessonHint> = Object.fromEntries(
		WORDS_N5.map((w) => [
			w.kana,
			w.kanji === undefined ? { zh: w.zh } : { kanji: w.kanji, zh: w.zh }
		])
	);

	let { data } = $props();

	type Phase = 'setup' | 'run' | 'result';
	let phase = $state<Phase>('setup');
	let rank = $state<number | undefined>(undefined);
	let unranked = $state<'accuracy' | undefined>(undefined);
	let pool = $state<TimedPoolId>('allhira');
	let seconds = $state<TimedSeconds>(60);
	let run = $state.raw<PracticeRun | null>(null);
	let result = $state<ScoreResult | null>(null);
	let newBest = $state(false);
	let errors = $state<ErrorAnalysis | null>(null);
	let remainingMs = $state(0);
	let timer: ReturnType<typeof setInterval> | null = null;

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
	function updateSetting<K extends keyof Settings>(key: K, value: Settings[K]) {
		settings = { ...settings, [key]: value };
		saveSettings(settings);
	}

	const mode = $derived(timedMode(pool, seconds));
	const hints = $derived(pool === 'n5' ? N5_HINTS : undefined);

	function start() {
		clearTimer();
		run = new PracticeRun(TIMED_POOLS[pool], { endless: true });
		result = null;
		remainingMs = seconds * 1000;
		phase = 'run';
	}

	function startTimer() {
		clearTimer();
		timer = setInterval(() => {
			if (!run) return;
			remainingMs = Math.max(0, seconds * 1000 - run.elapsed(performance.now()));
			if (remainingMs === 0) finish(run, performance.now());
		}, 100);
	}

	function clearTimer() {
		if (timer) clearInterval(timer);
		timer = null;
	}

	function finish(r: PracticeRun, nowMs: number) {
		clearTimer();
		r.stop(nowMs);
		const s = r.result();
		result = s;
		errors = r.errorAnalysis();
		newBest = recordResult(mode, s, { durationMs: r.durationMs, maxCombo: r.maxCombo });
		recordKanaStats(r.unitOutcomes);
		sound.play('bell');
		phase = 'result';
		rank = undefined;
		unranked = undefined;
		const submittedMode = mode;
		void submitPracticeRun(r, submittedMode, {
			loggedIn: !!data.user,
			turnstileSiteKey: data.turnstileSiteKey
		}).then((res) => {
			if (run !== r) return;
			if (res?.rank !== undefined) rank = res.rank;
			if (res?.unranked !== undefined) unranked = res.unranked;
		});
	}

	function onkeydown(e: KeyboardEvent) {
		if (phase !== 'run' || !run) return;
		if (e.ctrlKey || e.metaKey || e.altKey) return;
		if ((e.target as HTMLElement | null)?.tagName === 'INPUT') return;
		if (e.key.length !== 1) return;
		e.preventDefault();
		const wasStarted = run.started;
		const res = run.press(e.key, performance.now());
		if (!res) return;
		if (!wasStarted) startTimer();
		sound.play(res.ok ? 'key' : 'error');
	}

	onDestroy(clearTimer);

	const remainingLabel = $derived(
		`${Math.floor(remainingMs / 1000)}.${Math.floor((remainingMs % 1000) / 100)}`
	);
</script>

<svelte:head><title>{m.timed_title()} · {m.seo_site_name()}</title></svelte:head>
<svelte:window {onkeydown} />

<div class="container stack timed">
	<header class="stack head">
		<h1>{m.timed_title()}</h1>
		{#if phase === 'setup'}<p class="muted">{m.timed_lead()}</p>{/if}
	</header>

	{#if phase === 'setup'}
		<section class="stack setup">
			<fieldset class="choice">
				<legend>{m.timed_pool_label()}</legend>
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
			<fieldset class="choice">
				<legend>{m.timed_seconds_label()}</legend>
				<div class="row">
					{#each TIMED_SECONDS as s (s)}
						<button
							type="button"
							class="btn"
							aria-pressed={seconds === s}
							onclick={() => (seconds = s)}
						>
							{m.timed_seconds_option({ seconds: s })}
						</button>
					{/each}
				</div>
			</fieldset>
			<p class="center">
				<button type="button" class="btn btn--primary" onclick={start}>{m.timed_start()}</button>
			</p>
			<p class="muted center small">{m.timed_start_hint()}</p>
		</section>
	{:else if phase === 'run' && run}
		<section class="stack practice" aria-live="off">
			<p class="timer" class:urgent={remainingMs > 0 && remainingMs <= 10_000} aria-live="off">
				{#if run.started}{remainingLabel}{:else}{seconds}.0{/if}
				<span class="muted unit-s">s</span>
			</p>
			<TypingArea {run} showHint={settings.showHint} {hints} />
			{#if settings.showKeyboard}
				<Keyboard next={run.nextKey} />
			{/if}
			{#if coarsePointer}
				<p class="muted notice">{m.typing_mobile_notice()}</p>
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
				<button
					type="button"
					class="btn"
					onclick={() => {
						clearTimer();
						phase = 'setup';
					}}
				>
					{m.timed_cancel()}
				</button>
			</div>
		</section>
	{:else if phase === 'result' && result && run}
		<p class="muted center">{poolLabel[pool]()} · {m.timed_seconds_option({ seconds })}</p>
		<ResultPanel
			{result}
			wrongUnits={run.wrongUnits}
			{newBest}
			{rank}
			{unranked}
			durationMs={run.durationMs}
			maxCombo={run.maxCombo}
			errors={errors ?? undefined}
			onpracticeWrong={start}
			onretry={start}
			retryLabel={m.timed_again()}
			showPracticeWrong={false}
		/>
		<p class="center">
			<button
				type="button"
				class="btn"
				onclick={() => {
					phase = 'setup';
				}}
			>
				{m.timed_change_settings()}
			</button>
		</p>
	{/if}
</div>

<style>
	.timed {
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
	.practice {
		gap: var(--space-6);
		align-items: center;
	}
	.timer {
		font-size: 2rem;
		font-weight: 700;
		font-variant-numeric: tabular-nums;
		line-height: 1;
		transition: color var(--dur) var(--ease-out);
	}
	.timer.urgent {
		color: var(--danger);
	}
	.unit-s {
		font-size: 1rem;
		font-weight: 400;
		margin-left: 2px;
	}
	.notice {
		font-size: 0.875rem;
		text-align: center;
	}
	.tools {
		justify-content: center;
		margin-top: var(--space-4);
	}
</style>

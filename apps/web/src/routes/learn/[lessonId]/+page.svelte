<script lang="ts">
	import type { KanaEntry } from '@jptype/data';
	import type { ScoreResult } from '@jptype/engine';
	import { m } from '$lib/paraglide/messages';
	import { resolve } from '$app/paths';
	import Icon from '$lib/components/Icon.svelte';
	import KanaCard from '$lib/components/KanaCard.svelte';
	import Keyboard from '$lib/components/Keyboard.svelte';
	import ResultPanel from '$lib/components/ResultPanel.svelte';
	import TypingArea from '$lib/components/TypingArea.svelte';
	import { weakPool } from '$lib/practice/questions';
	import { PracticeRun } from '$lib/practice/run.svelte';
	import { TypewriterSound } from '$lib/practice/sound';
	import {
		DEFAULT_SETTINGS,
		loadSettings,
		recordKanaStats,
		recordResult,
		saveSettings,
		type Settings
	} from '$lib/storage';

	let { data } = $props();
	const lesson = $derived(data.lesson);
	const katakana = $derived(lesson.id.startsWith('kata'));

	type Phase = 'intro' | 'practice' | 'result';
	let phase = $state<Phase>('intro');
	let run = $state.raw<PracticeRun | null>(null);
	let result = $state<ScoreResult | null>(null);
	let newBest = $state(false);
	let selected = $state<KanaEntry | null>(null);

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

	// Reset to the intro when navigating between lessons.
	$effect(() => {
		void lesson.id;
		phase = 'intro';
		run = null;
		selected = null;
	});

	function start(pool: readonly string[]) {
		run = new PracticeRun(pool);
		result = null;
		phase = 'practice';
	}

	function finish(r: PracticeRun) {
		const s = r.result();
		result = s;
		newBest = recordResult(lesson.id, s);
		recordKanaStats(r.unitOutcomes);
		sound.play('bell');
		phase = 'result';
	}

	function onkeydown(e: KeyboardEvent) {
		if (phase !== 'practice' || !run) return;
		if (e.ctrlKey || e.metaKey || e.altKey) return;
		if ((e.target as HTMLElement | null)?.tagName === 'INPUT') return;
		if (e.key.length !== 1) return;
		e.preventDefault();
		const res = run.press(e.key, performance.now());
		if (!res) return;
		sound.play(res.ok ? 'key' : 'error');
		if (run.finished) finish(run);
	}

	const highlightKeys = $derived(
		[...(selected?.romaji[0] ?? '')].filter((ch, i, all) => all.indexOf(ch) === i)
	);
</script>

<svelte:head><title>{lesson.title} · {m.app_name()}</title></svelte:head>
<svelte:window {onkeydown} />

<div class="container stack lesson">
	<header class="row head">
		<a class="muted back" href={resolve('/learn')}>← {m.lesson_back_to_map()}</a>
		<h1 lang="ja">{lesson.title}</h1>
	</header>

	{#if phase === 'intro'}
		<section class="stack intro" aria-labelledby="intro-title">
			<div>
				<h2 id="intro-title">{m.lesson_intro_title()}</h2>
				<p class="muted">{m.lesson_intro_lead()}</p>
			</div>
			<div class="cards">
				{#each lesson.intro as entry (entry.kana)}
					<KanaCard
						{entry}
						{katakana}
						selected={selected?.kana === entry.kana}
						onselect={(e) => (selected = e)}
					/>
				{/each}
			</div>
			<Keyboard highlight={highlightKeys} />
			<p class="center">
				<button type="button" class="btn btn--primary" onclick={() => start(lesson.units)}>
					{m.lesson_start_practice()}
				</button>
			</p>
		</section>
	{:else if phase === 'practice' && run}
		<section class="stack practice" aria-live="polite">
			<p class="muted progress">
				{m.lesson_practice_progress({ current: run.index + 1, total: run.total })}
			</p>
			<TypingArea {run} showHint={settings.showHint} />
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
				<button type="button" class="btn" onclick={() => start(lesson.units)}>
					{m.lesson_restart()}
				</button>
			</div>
		</section>
	{:else if phase === 'result' && result && run}
		<ResultPanel
			{result}
			wrongUnits={run.wrongUnits}
			{newBest}
			onpracticeWrong={() => run && start(weakPool(run.wrongUnits, lesson.units))}
			onretry={() => start(lesson.units)}
		/>
	{/if}
</div>

<style>
	.lesson {
		gap: var(--space-8);
	}
	.head {
		flex-direction: column;
		align-items: flex-start;
		gap: var(--space-2);
	}
	.back {
		text-decoration: none;
		font-size: 0.875rem;
	}
	.intro {
		gap: var(--space-6);
	}
	.cards {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-3);
		justify-content: center;
	}
	.center {
		text-align: center;
	}
	.practice {
		gap: var(--space-6);
		align-items: center;
	}
	.progress {
		font-variant-numeric: tabular-nums;
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

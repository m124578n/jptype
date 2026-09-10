<script lang="ts">
	import { onMount } from 'svelte';
	import type { ScoreResult } from '@jptype/engine';
	import { m } from '$lib/paraglide/messages';
	import { resolve } from '$app/paths';
	import Icon from '$lib/components/Icon.svelte';
	import Keyboard from '$lib/components/Keyboard.svelte';
	import ResultPanel from '$lib/components/ResultPanel.svelte';
	import TypingArea from '$lib/components/TypingArea.svelte';
	import { PracticeRun } from '$lib/practice/run.svelte';
	import { TypewriterSound } from '$lib/practice/sound';
	import { findSong, type Song } from '$lib/songs';
	import {
		DEFAULT_SETTINGS,
		loadSettings,
		recordResult,
		saveSettings,
		type Settings
	} from '$lib/storage';

	let { data } = $props();

	// Songs live in this browser only; read after mount so SSR and hydration agree.
	let song = $state.raw<Song | null>(null);
	let loaded = $state(false);
	let run = $state.raw<PracticeRun | null>(null);
	let result = $state<ScoreResult | null>(null);
	let newBest = $state(false);

	let settings = $state<Settings>({ ...DEFAULT_SETTINGS });
	let coarsePointer = $state(false);
	const sound = new TypewriterSound();

	onMount(() => {
		settings = loadSettings();
		coarsePointer = window.matchMedia('(pointer: coarse)').matches;
		song = findSong(data.id) ?? null;
		loaded = true;
		start();
	});

	$effect(() => {
		sound.enabled = settings.sound;
		sound.volume = settings.volume;
	});

	function updateSetting<K extends keyof Settings>(key: K, value: Settings[K]) {
		settings = { ...settings, [key]: value };
		saveSettings(settings);
	}

	function start() {
		if (!song) return;
		// Lyric lines are typed in order, one line per question.
		run = new PracticeRun(song.lines, { sequence: song.lines });
		result = null;
		newBest = false;
	}

	function finish(r: PracticeRun) {
		const s = r.result();
		result = s;
		newBest = recordResult(`song:${data.id}`, s);
		sound.play('bell');
	}

	function onkeydown(e: KeyboardEvent) {
		const r = run;
		if (!r || result !== null || r.finished) return;
		if (e.ctrlKey || e.metaKey || e.altKey) return;
		const tag = (e.target as HTMLElement | null)?.tagName;
		if (tag === 'INPUT' || tag === 'TEXTAREA') return;
		if (e.key.length !== 1) return;
		e.preventDefault();
		const res = r.press(e.key, performance.now());
		if (!res) return;
		sound.play(res.ok ? 'key' : 'error');
		if (r.finished) finish(r);
	}

	const previous = $derived(run && run.index > 0 ? run.questions[run.index - 1] : undefined);
	const upcoming = $derived(run ? run.questions[run.index + 1] : undefined);
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
			<p class="muted small">{m.songs_play_hint()}</p>
		</header>

		<div class="player">
			<iframe
				src={`https://www.youtube-nocookie.com/embed/${song.youtubeId}`}
				title={m.songs_player_title({ title: song.title })}
				allow="encrypted-media; picture-in-picture"
				allowfullscreen
			></iframe>
		</div>

		{#if run && result === null}
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
					<button type="button" class="btn" onclick={start}>{m.songs_restart()}</button>
				</div>
			</section>
		{:else if run && result}
			<ResultPanel
				{result}
				wrongUnits={run.wrongUnits}
				{newBest}
				onpracticeWrong={start}
				onretry={start}
				retryLabel={m.songs_again()}
				showPracticeWrong={false}
			/>
			<p class="center">
				<a class="btn" href={resolve('/songs')}>{m.songs_back()}</a>
			</p>
		{/if}
	{/if}
</div>

<style>
	.song {
		gap: var(--space-8);
	}
	.head {
		gap: var(--space-2);
	}
	.small {
		font-size: 0.875rem;
	}
	.center {
		text-align: center;
	}
	.player {
		position: relative;
		aspect-ratio: 16 / 9;
		width: 100%;
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: var(--radius-lg);
		overflow: hidden;
	}
	.player iframe {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		border: 0;
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
	.tools {
		justify-content: center;
		margin-top: var(--space-4);
	}
</style>

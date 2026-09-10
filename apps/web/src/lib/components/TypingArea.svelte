<script lang="ts">
	import type { LessonHint } from '@jptype/data';
	import { m } from '$lib/paraglide/messages';
	import type { PracticeRun } from '$lib/practice/run.svelte';

	let {
		run,
		showHint = true,
		hints
	}: {
		run: PracticeRun;
		showHint?: boolean;
		/** Kanji + 繁體中文 for word/sentence questions, keyed by the question's kana. */
		hints?: Record<string, LessonHint>;
	} = $props();

	const meaning = $derived(hints?.[run.current]);

	const units = $derived.by(() => {
		void run.tick;
		return run.session.units;
	});
	const currentKana = $derived(units[run.unitIndex]?.kana ?? '');

	// Shake/flash for 160 ms after a wrong key (spec §10); re-triggers on each error.
	let shaking = $state(false);
	$effect(() => {
		if (run.lastWrongAt === 0) return;
		shaking = true;
		const id = setTimeout(() => (shaking = false), 160);
		return () => clearTimeout(id);
	});
</script>

<div
	class="typing"
	aria-label={m.typing_status({ current: run.index + 1, total: run.total, kana: currentKana })}
>
	{#if meaning}
		<p class="meaning muted">
			{#if meaning.kanji}<span lang="ja">{meaning.kanji}</span>{/if}
			<span class="zh">{meaning.zh}</span>
		</p>
	{/if}
	<p class="target" lang="ja" class:shake={shaking}>
		{#each units as unit, i (i)}
			<span
				class="unit"
				class:done={i < run.unitIndex}
				class:current={i === run.unitIndex}
				class:wrong={i === run.unitIndex && shaking}>{unit.kana}</span
			>
		{/each}
	</p>
	<p class="hint" aria-hidden="true">
		{#if showHint}
			<span class="typed">{run.typed}</span><span class="rest"
				>{run.hint.slice(run.typed.length)}</span
			>
		{:else}
			<span class="typed">{run.typed}</span>
		{/if}
	</p>
</div>

<style>
	.typing {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--space-3);
		min-height: 9rem;
	}
	.meaning {
		display: flex;
		flex-wrap: wrap;
		justify-content: center;
		gap: var(--space-2);
		font-size: 1rem;
		text-align: center;
	}
	.zh {
		font-size: 0.875rem;
	}
	.target {
		font-size: clamp(3rem, 12vw, 6rem);
		font-weight: 500;
		line-height: 1.15;
		letter-spacing: 0.04em;
		display: flex;
		flex-wrap: wrap;
		justify-content: center;
	}
	.unit {
		padding: 0 0.04em;
		border-radius: var(--radius-sm);
		transition: color var(--dur-fast) var(--ease-out);
	}
	.unit.done {
		color: var(--fg-muted);
	}
	.unit.current {
		color: var(--accent);
	}
	.unit.wrong {
		color: var(--danger);
		background: var(--danger-soft);
	}
	.hint {
		min-height: 2rem;
		font-size: 1.375rem;
		letter-spacing: 0.1em;
		font-variant-numeric: tabular-nums;
		color: var(--fg-muted);
	}
	.typed {
		color: var(--fg);
	}
	.shake {
		animation: shake 160ms var(--ease-out);
	}
	@keyframes shake {
		0% {
			transform: translateX(0);
		}
		30% {
			transform: translateX(-3px);
		}
		60% {
			transform: translateX(3px);
		}
		100% {
			transform: translateX(0);
		}
	}
</style>

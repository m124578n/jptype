<script lang="ts">
	import type { LessonHint } from '@jptype/data';
	import { m } from '$lib/paraglide/messages';
	import { COMBO_VISIBLE_AT } from '$lib/practice/combo';
	import type { TypingRun } from '$lib/practice/run.svelte';

	let {
		run,
		showHint = true,
		hints,
		tokens
	}: {
		run: TypingRun;
		showHint?: boolean;
		/** Kanji + 繁體中文 for word/sentence questions, keyed by the question's kana. */
		hints?: Record<string, LessonHint>;
		/**
		 * Furigana split of the current question (M4-1d lyrics): each surface with the reading
		 * typed for it, readings joining to the question's kana. When given (and aligned), the
		 * line is drawn as the surfaces with the kana over each kanji, typing progress and all.
		 */
		tokens?: readonly { surface: string; reading: string }[];
	} = $props();

	const meaning = $derived(hints?.[run.current]);

	const units = $derived.by(() => {
		void run.tick;
		return run.session.units;
	});
	const currentKana = $derived(units[run.unitIndex]?.kana ?? '');

	type CharState = 'done' | 'current' | 'upcoming';
	/** Every kana character of the question with the state of the unit it belongs to. */
	const chars = $derived.by(() => {
		const out: { ch: string; state: CharState }[] = [];
		units.forEach((unit, i) => {
			const state: CharState =
				i < run.unitIndex ? 'done' : i === run.unitIndex ? 'current' : 'upcoming';
			for (const ch of [...unit.kana]) out.push({ ch, state });
		});
		return out;
	});

	/** The ruby line: tokens with their characters, or null when there are none / they do not add up. */
	const ruby = $derived.by(() => {
		if (!tokens || tokens.length === 0) return null;
		const total = tokens.reduce((n, t) => n + [...t.reading].length, 0);
		if (total !== chars.length) return null;
		let pos = 0;
		return tokens.map((t) => {
			const n = [...t.reading].length;
			const own = chars.slice(pos, pos + n);
			pos += n;
			const state: CharState | 'plain' =
				own.length === 0
					? 'plain'
					: own.some((c) => c.state === 'current')
						? 'current'
						: own.every((c) => c.state === 'done')
							? 'done'
							: 'upcoming';
			// Kana tokens are typed as they stand; only a surface that differs gets furigana.
			return {
				surface: t.surface,
				chars: own,
				annotate: t.surface !== t.reading && own.length > 0,
				state
			};
		});
	});

	// Shake/flash for 160 ms after a wrong key (spec §10); re-triggers on each error.
	let shaking = $state(false);
	$effect(() => {
		if (run.lastWrongAt === 0) return;
		shaking = true;
		const id = setTimeout(() => (shaking = false), 160);
		return () => clearTimeout(id);
	});

	// Combo (M4-3): a quiet counter once the streak is worth mentioning, with a short accent
	// flash when a milestone is crossed. No confetti — MASTER.md「不要遊戲化」.
	const showCombo = $derived(run.combo >= COMBO_VISIBLE_AT);
	let flashing = $state(false);
	$effect(() => {
		if (run.milestoneAt === 0) return;
		flashing = true;
		const id = setTimeout(() => (flashing = false), 500);
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
	{#if ruby}
		<p class="target ruby" lang="ja" class:shake={shaking}>
			{#each ruby as token, i (i)}
				{#if token.annotate}
					<ruby class="tok {token.state}" class:wrong={token.state === 'current' && shaking}
						>{token.surface}<rp>(</rp><rt
							>{#each token.chars as c, j (j)}<span class="rc {c.state}">{c.ch}</span>{/each}</rt
						><rp>)</rp></ruby
					>
				{:else if token.chars.length === 0}
					<span class="tok plain">{token.surface}</span>
				{:else}
					{#each token.chars as c, j (j)}<span
							class="unit {c.state}"
							class:wrong={c.state === 'current' && shaking}>{c.ch}</span
						>{/each}
				{/if}
			{/each}
		</p>
	{:else}
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
	{/if}
	<p class="hint" aria-hidden="true">
		{#if showHint}
			<span class="typed">{run.typed}</span><span class="rest"
				>{run.hint.slice(run.typed.length)}</span
			>
		{:else}
			<span class="typed">{run.typed}</span>
		{/if}
	</p>
	<p
		class="combo muted"
		class:on={showCombo}
		class:flash={showCombo && flashing}
		aria-hidden="true"
	>
		{m.stats_combo({ count: run.combo })}
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
	/* Furigana line: surfaces in the base size, the typed kana small over each kanji. */
	.ruby {
		line-height: 1.9;
		align-items: baseline;
	}
	.ruby ruby {
		ruby-position: over;
		ruby-align: center;
		padding: 0 0.04em;
		border-radius: var(--radius-sm);
		transition: color var(--dur-fast) var(--ease-out);
	}
	.ruby rt {
		font-size: 0.42em;
		font-weight: 400;
		letter-spacing: 0.02em;
		line-height: 1;
		color: var(--fg-muted);
	}
	.tok.done {
		color: var(--fg-muted);
	}
	.tok.current {
		color: var(--accent);
	}
	.tok.plain {
		color: var(--fg-muted);
	}
	.tok.wrong {
		color: var(--danger);
		background: var(--danger-soft);
	}
	.rc.done {
		opacity: 0.45;
	}
	.rc.current {
		color: var(--accent);
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
	.combo {
		font-size: 0.875rem;
		letter-spacing: 0.08em;
		font-variant-numeric: tabular-nums;
		min-height: 1.25rem;
		opacity: 0;
		transition:
			opacity var(--dur-fast) var(--ease-out),
			color var(--dur-fast) var(--ease-out);
	}
	.combo.on {
		opacity: 1;
	}
	.combo.flash {
		color: var(--accent);
		animation: combo-pop 500ms var(--ease-out);
	}
	@keyframes combo-pop {
		0% {
			transform: scale(1);
		}
		25% {
			transform: scale(1.18);
		}
		100% {
			transform: scale(1);
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.combo {
			transition: none;
		}
		.combo.flash {
			animation: none;
		}
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

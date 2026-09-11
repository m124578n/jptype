<script lang="ts">
	import type { ScoreResult } from '@jptype/engine';
	import { m } from '$lib/paraglide/messages';
	import { resolve } from '$app/paths';
	import { formatAccuracy, formatDuration, formatKpm } from '$lib/format';
	import type { ErrorAnalysis } from '$lib/practice/errors';

	let {
		result,
		wrongUnits,
		newBest = false,
		onpracticeWrong,
		onretry,
		retryLabel = m.result_retry(),
		showPracticeWrong = true,
		rank,
		unranked,
		durationMs,
		maxCombo,
		errors
	}: {
		result: ScoreResult;
		wrongUnits: string[];
		newBest?: boolean;
		onpracticeWrong: () => void;
		onretry: () => void;
		retryLabel?: string;
		showPracticeWrong?: boolean;
		/** Weekly rank from the server (logged-in, unflagged runs only). */
		rank?: number | undefined;
		/** Why the server kept the run off the boards ('accuracy' = under 90 %). */
		unranked?: 'accuracy' | undefined;
		/** Typing time of the run (M4-3). Omitted → the Time tile is hidden. */
		durationMs?: number | undefined;
		/** Longest streak of correct keys (M4-3). Omitted → the Max Combo tile is hidden. */
		maxCombo?: number | undefined;
		/** Top wrong kana / spellings, from `run.errorAnalysis()` (M4-3). */
		errors?: ErrorAnalysis | undefined;
	} = $props();

	const offerWrong = $derived(showPracticeWrong && wrongUnits.length > 0);
	const topSpellings = $derived(errors?.spellings ?? []);

	/**
	 * The wrong-kana list (spec §7.3), with the top offenders first and their counts. Kana that
	 * did not make the top 5 keep their place at the end without a count.
	 */
	const wrongChips = $derived.by(() => {
		const counted = errors?.units ?? [];
		const rest = wrongUnits.filter((kana) => !counted.some((u) => u.kana === kana));
		return [...counted, ...rest.map((kana) => ({ kana, count: 0 }))];
	});
</script>

<section class="stack result" aria-labelledby="result-title">
	<div class="row heading">
		<h2 id="result-title">{m.result_title()}</h2>
		{#if newBest}<span class="badge">{m.result_new_best()}</span>{/if}
		{#if rank !== undefined}<span class="badge">{m.result_rank({ rank })}</span>{/if}
	</div>
	{#if unranked === 'accuracy'}
		<p class="muted unranked">{m.result_unranked_accuracy()}</p>
	{/if}

	<dl class="stats">
		<div>
			<dt class="muted">{m.result_kpm()}</dt>
			<dd>{formatKpm(result.kpm)}</dd>
		</div>
		<div>
			<dt class="muted">{m.result_accuracy()}</dt>
			<dd>{formatAccuracy(result.accuracy)}</dd>
		</div>
		<div>
			<dt class="muted">{m.result_score()}</dt>
			<dd class="score">{result.score}</dd>
		</div>
	</dl>

	<dl class="stats stats--minor">
		{#if durationMs !== undefined}
			<div>
				<dt class="muted">{m.stats_time()}</dt>
				<dd>{formatDuration(durationMs)}</dd>
			</div>
		{/if}
		{#if maxCombo !== undefined}
			<div>
				<dt class="muted">{m.stats_max_combo()}</dt>
				<dd>{maxCombo}</dd>
			</div>
		{/if}
		<div>
			<dt class="muted">{m.stats_errors()}</dt>
			<dd>{result.wrongKeys}</dd>
		</div>
	</dl>

	<div class="stack wrong">
		<h3>{m.result_wrong_title()}</h3>
		{#if wrongChips.length === 0}
			<p class="muted">{m.result_wrong_none()}</p>
		{:else}
			<ul class="chips" lang="ja">
				{#each wrongChips as chip (chip.kana)}
					<li class="chip">
						{chip.kana}{#if chip.count > 0}<span class="count">×{chip.count}</span>{/if}
					</li>
				{/each}
			</ul>
		{/if}
	</div>

	{#if topSpellings.length > 0}
		<div class="stack block">
			<h3>{m.stats_top_spellings_title()}</h3>
			<ul class="spellings">
				{#each topSpellings as s (`${s.kana}|${s.expected}|${s.typed}`)}
					<li>
						<span class="kana" lang="ja">{s.kana}</span>
						<span class="pair"
							><span class="expected">{s.expected}</span>
							<span class="arrow" aria-hidden="true">→</span>
							<span class="typed">{s.typed}</span></span
						>
						<span class="count">×{s.count}</span>
					</li>
				{/each}
			</ul>
			<p class="muted note">{m.stats_top_spellings_note()}</p>
		</div>
	{/if}

	<div class="row actions">
		{#if offerWrong}
			<button type="button" class="btn btn--primary" onclick={onpracticeWrong}>
				{m.result_practice_wrong()}
			</button>
		{/if}
		<button type="button" class="btn" class:btn--primary={!offerWrong} onclick={onretry}>
			{retryLabel}
		</button>
		<a class="btn" href={resolve('/learn')}>{m.lesson_back_to_map()}</a>
	</div>
</section>

<style>
	.unranked {
		margin: 0;
		font-size: 0.875rem;
	}
	.result {
		gap: var(--space-8);
	}
	.heading {
		justify-content: center;
	}
	.badge {
		font-size: 0.875rem;
		font-weight: 500;
		color: var(--accent);
		border: 1px solid var(--accent);
		border-radius: 999px;
		padding: 2px 10px;
	}
	.stats {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: var(--space-4);
		margin: 0;
		text-align: center;
	}
	.stats dt {
		font-size: 0.875rem;
	}
	.stats dd {
		margin: 0;
		font-size: clamp(2rem, 6vw, 3rem);
		font-weight: 700;
		font-variant-numeric: tabular-nums;
		line-height: 1.1;
	}
	.stats--minor {
		margin-top: calc(-1 * var(--space-4));
	}
	.stats--minor dd {
		font-size: 1.5rem;
		font-weight: 500;
	}
	.score {
		color: var(--accent);
	}
	.wrong {
		align-items: center;
		text-align: center;
	}
	.chips {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-wrap: wrap;
		justify-content: center;
		gap: var(--space-2);
	}
	.chip {
		font-size: 1.5rem;
		padding: var(--space-1) var(--space-3);
		border-radius: var(--radius);
		background: var(--danger-soft);
		color: var(--danger);
	}
	.block {
		align-items: center;
		text-align: center;
		gap: var(--space-3);
	}
	.count {
		font-size: 0.875rem;
		color: var(--fg-muted);
		margin-left: var(--space-1);
		font-variant-numeric: tabular-nums;
	}
	.chip .count {
		color: inherit;
		opacity: 0.75;
	}
	.spellings {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
		width: min(100%, 22rem);
	}
	.spellings li {
		display: grid;
		grid-template-columns: 2.5rem 1fr auto;
		align-items: baseline;
		gap: var(--space-3);
		text-align: left;
		padding: var(--space-2) var(--space-3);
		border: 1px solid var(--border);
		border-radius: var(--radius);
		background: var(--surface);
	}
	.spellings .kana {
		font-size: 1.25rem;
	}
	.pair {
		letter-spacing: 0.06em;
	}
	.expected {
		color: var(--accent);
	}
	.arrow {
		color: var(--fg-muted);
		margin: 0 var(--space-1);
	}
	.spellings .typed {
		color: var(--danger);
	}
	.note {
		font-size: 0.8125rem;
	}
	.actions {
		justify-content: center;
	}
</style>

<script lang="ts">
	import type { ScoreResult } from '@jptype/engine';
	import { m } from '$lib/paraglide/messages';
	import { resolve } from '$app/paths';
	import { formatAccuracy, formatKpm } from '$lib/format';

	let {
		result,
		wrongUnits,
		newBest = false,
		onpracticeWrong,
		onretry,
		retryLabel = m.result_retry(),
		showPracticeWrong = true,
		rank
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
	} = $props();

	const offerWrong = $derived(showPracticeWrong && wrongUnits.length > 0);
</script>

<section class="stack result" aria-labelledby="result-title">
	<div class="row heading">
		<h2 id="result-title">{m.result_title()}</h2>
		{#if newBest}<span class="badge">{m.result_new_best()}</span>{/if}
		{#if rank !== undefined}<span class="badge">{m.result_rank({ rank })}</span>{/if}
	</div>

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

	<div class="stack wrong">
		<h3>{m.result_wrong_title()}</h3>
		{#if wrongUnits.length === 0}
			<p class="muted">{m.result_wrong_none()}</p>
		{:else}
			<ul class="chips" lang="ja">
				{#each wrongUnits as kana (kana)}
					<li class="chip">{kana}</li>
				{/each}
			</ul>
		{/if}
	</div>

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
	.actions {
		justify-content: center;
	}
</style>

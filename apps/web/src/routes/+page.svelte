<script lang="ts">
	import { m } from '$lib/paraglide/messages';
	import { resolve } from '$app/paths';

	let { data } = $props();
	const boardHref = $derived(
		`${resolve('/leaderboard')}?${new URLSearchParams({ mode: data.mode, period: 'week' })}`
	);
</script>

<section class="container hero stack">
	<h1>{m.home_tagline()}</h1>
	<p class="lead muted">{m.home_lead()}</p>
	<p><a class="btn btn--primary cta" href={resolve('/learn')}>{m.home_cta_start()}</a></p>
</section>

<section class="container benefits">
	<div>
		<h3>{m.home_benefit_1_title()}</h3>
		<p class="muted">{m.home_benefit_1_body()}</p>
	</div>
	<div>
		<h3>{m.home_benefit_2_title()}</h3>
		<p class="muted">{m.home_benefit_2_body()}</p>
	</div>
	<div>
		<h3>{m.home_benefit_3_title()}</h3>
		<p class="muted">{m.home_benefit_3_body()}</p>
	</div>
</section>

{#if data.top.length > 0}
	<section class="container top stack" aria-labelledby="top-title">
		<h2 id="top-title">{m.home_top_title()}</h2>
		<ol class="top-list card">
			{#each data.top as e (e.userId)}
				<li>
					<span class="rank muted">{e.rank}</span>
					<span class="name">{e.name}</span>
					<span class="score">{e.best}</span>
				</li>
			{/each}
		</ol>
		<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- boardHref is resolve('/leaderboard') + query -->
		<p><a href={boardHref}>{m.home_top_more()}</a></p>
	</section>
{/if}

<style>
	.hero {
		text-align: center;
		gap: var(--space-6);
		padding-top: var(--space-12);
	}
	.lead {
		font-size: 1.125rem;
		max-width: 32em;
		margin-inline: auto;
	}
	.cta {
		min-height: 52px;
		padding-inline: var(--space-8);
		font-size: 1.125rem;
	}
	.benefits {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
		gap: var(--space-8);
		margin-top: var(--space-24);
	}
	.benefits h3 {
		margin-bottom: var(--space-2);
	}
	.top {
		margin-top: var(--space-24);
		gap: var(--space-4);
	}
	.top-list {
		list-style: none;
		margin: 0;
		padding: var(--space-2) var(--space-4);
	}
	.top-list li {
		display: grid;
		grid-template-columns: 2em 1fr auto;
		gap: var(--space-3);
		padding: var(--space-3) 0;
		border-bottom: 1px solid var(--border);
		font-variant-numeric: tabular-nums;
	}
	.top-list li:last-child {
		border-bottom: 0;
	}
	.score {
		font-weight: 700;
		color: var(--accent);
	}
</style>

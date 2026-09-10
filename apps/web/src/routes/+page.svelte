<script lang="ts">
	import { onMount } from 'svelte';
	import { LESSONS } from '@jptype/data';
	import { m } from '$lib/paraglide/messages';
	import { resolve } from '$app/paths';
	import Icon from '$lib/components/Icon.svelte';
	import { loadResults, type LessonResults } from '$lib/storage';

	let { data } = $props();
	const boardHref = $derived(
		`${resolve('/leaderboard')}?${new URLSearchParams({ mode: data.mode, period: 'week' })}`
	);

	/** One entry card per practice surface (ROADMAP M4-4). */
	const entries = [
		{
			href: resolve('/learn'),
			icon: 'book',
			title: m.home_card_learn_title,
			body: m.home_card_learn_body
		},
		{
			href: resolve('/timed'),
			icon: 'clock',
			title: m.home_card_timed_title,
			body: m.home_card_timed_body
		},
		{
			href: resolve('/contents'),
			icon: 'newspaper',
			title: m.home_card_contents_title,
			body: m.home_card_contents_body
		},
		{
			href: resolve('/listen'),
			icon: 'speaker',
			title: m.home_card_listen_title,
			body: m.home_card_listen_body
		},
		{
			href: resolve('/songs'),
			icon: 'music',
			title: m.home_card_songs_title,
			body: m.home_card_songs_body
		}
	] as const;

	/**
	 * 你的進度. Signed out this is the only record there is, so it is read from localStorage after
	 * mount; signed in the real statistics live on `/me` and the home page just points there
	 * (no extra server query — `+page.server.ts` only fetches the weekly board).
	 */
	let results = $state<LessonResults>({});
	onMount(() => {
		results = loadResults();
	});

	const records = $derived(Object.values(results));
	const hasRecords = $derived(records.length > 0);
	const todayCount = $derived(records.filter((r) => isToday(r.lastAt)).length);
	const bestScore = $derived(records.reduce((best, r) => Math.max(best, r.best.score), 0));
	const lessonsDone = $derived(LESSONS.filter((lesson) => results[lesson.id] !== undefined).length);

	/** Same calendar day in the reader's own timezone. */
	function isToday(at: number): boolean {
		const then = new Date(at);
		const now = new Date();
		return (
			then.getFullYear() === now.getFullYear() &&
			then.getMonth() === now.getMonth() &&
			then.getDate() === now.getDate()
		);
	}
</script>

<section class="container hero stack">
	<h1>{m.home_tagline()}</h1>
	<p class="lead muted">{m.home_lead()}</p>
	<p><a class="btn btn--primary cta" href={resolve('/learn')}>{m.home_cta_start()}</a></p>
	{#if data.user === null}
		<p class="muted small">{m.home_anon_note()}</p>
	{/if}
</section>

<section class="container explore stack" aria-labelledby="explore-title">
	<h2 id="explore-title">{m.home_explore_title()}</h2>
	<ul class="entries">
		{#each entries as entry (entry.href)}
			<li>
				<a class="card entry" href={entry.href}>
					<span class="glyph"><Icon name={entry.icon} size={24} /></span>
					<span class="entry-title">{entry.title()}</span>
					<span class="muted small">{entry.body()}</span>
				</a>
			</li>
		{/each}
	</ul>
</section>

<section class="container progress stack" aria-labelledby="progress-title">
	<h2 id="progress-title">{m.home_progress_title()}</h2>
	{#if data.user}
		<div class="card panel stack">
			<p>{m.home_progress_hello({ name: data.user.name })}</p>
			<p class="muted small">{m.home_progress_signed_in()}</p>
			<p><a class="btn" href={resolve('/me')}>{m.home_progress_me()}</a></p>
		</div>
	{:else if hasRecords}
		<div class="card panel stack">
			<ul class="stats">
				<li>
					{todayCount > 0
						? m.home_progress_today({ count: todayCount })
						: m.home_progress_today_none()}
				</li>
				<li>{m.home_progress_best({ score: bestScore })}</li>
				<li>{m.home_progress_lessons({ done: lessonsDone, total: LESSONS.length })}</li>
			</ul>
			<p class="muted small">{m.home_progress_local()}</p>
		</div>
	{:else}
		<div class="card panel stack">
			<p class="muted">{m.home_progress_empty()}</p>
			<p><a class="btn" href={resolve('/learn')}>{m.home_cta_start()}</a></p>
		</div>
	{/if}
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
	.small {
		font-size: 0.875rem;
	}
	.explore,
	.progress {
		margin-top: var(--space-16);
		gap: var(--space-4);
	}
	.entries {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
		gap: var(--space-4);
	}
	.entry {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
		height: 100%;
		padding: var(--space-4) var(--space-6);
		text-decoration: none;
		transition: border-color var(--dur-fast) var(--ease-out);
	}
	.entry:hover {
		border-color: var(--fg-muted);
	}
	.glyph {
		color: var(--accent);
		line-height: 1;
	}
	.entry-title {
		font-size: 1.125rem;
		font-weight: 500;
	}
	.panel {
		padding: var(--space-4) var(--space-6);
		gap: var(--space-3);
	}
	.panel p {
		margin: 0;
	}
	.stats {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
		gap: var(--space-3);
		font-variant-numeric: tabular-nums;
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

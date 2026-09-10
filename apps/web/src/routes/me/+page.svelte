<script lang="ts">
	import { onMount } from 'svelte';
	import { m } from '$lib/paraglide/messages';
	import { resolve } from '$app/paths';
	import KanaHeatmap from '$lib/components/KanaHeatmap.svelte';
	import { formatAccuracy, formatKpm } from '$lib/format';
	import {
		loadKanaStats,
		loadResults,
		weakKana,
		type KanaStats,
		type LessonResults
	} from '$lib/storage';

	let { data } = $props();

	// Anonymous fallback: whatever this browser has recorded.
	let localStats: KanaStats = $state({});
	let localResults: LessonResults = $state({});
	onMount(() => {
		if (!data.stats) {
			localStats = loadKanaStats();
			localResults = loadResults();
		}
	});

	const heat = $derived.by(() => {
		if (data.stats) {
			return Object.fromEntries(
				data.stats.kanaStats.map((s) => [s.kana, { attempts: s.attempts, errors: s.errors }])
			);
		}
		return localStats;
	});
	const weak = $derived(data.stats ? data.stats.weak : weakKana(localStats));
	const localAttempts = $derived(Object.values(localResults).reduce((a, r) => a + r.attempts, 0));

	function modeLabel(mode: string): string {
		if (mode === 'weak') return m.me_mode_weak();
		const [kind, a, b] = mode.split(':');
		if (kind === 'timed') return `${m.nav_timed()} ${a} ${b}s`;
		return `${m.nav_learn()} ${a ?? ''}`;
	}
	const dateFmt = new Intl.DateTimeFormat('zh-TW', {
		month: 'numeric',
		day: 'numeric',
		hour: '2-digit',
		minute: '2-digit',
		timeZone: 'Asia/Taipei'
	});
</script>

<svelte:head><title>{m.me_title()} · {m.app_name()}</title></svelte:head>

<div class="container container--wide stack me">
	<header class="stack head">
		<h1>{m.me_title()}</h1>
		{#if !data.user}
			<p class="muted">
				{m.me_anon_lead()}
				<a href={resolve('/login')}>{m.nav_login()}</a>
			</p>
		{/if}
	</header>

	<section class="stats">
		{#if data.stats}
			<div class="card stat">
				<span class="muted">{m.me_total_runs()}</span><strong>{data.stats.totalRuns}</strong>
			</div>
			<div class="card stat">
				<span class="muted">{m.me_streak()}</span><strong
					>{m.me_days({ days: data.stats.streak })}</strong
				>
			</div>
			<div class="card stat">
				<span class="muted">{m.me_active_30()}</span><strong
					>{m.me_days({ days: data.stats.activeDays30 })}</strong
				>
			</div>
		{:else}
			<div class="card stat">
				<span class="muted">{m.me_total_runs()}</span><strong>{localAttempts}</strong>
			</div>
		{/if}
		<div class="card stat">
			<span class="muted">{m.me_weak_count()}</span><strong>{weak.length}</strong>
		</div>
	</section>

	<section class="stack" aria-labelledby="weak-title">
		<div class="row between">
			<h2 id="weak-title">{m.me_weak_title()}</h2>
			<a class="btn btn--primary" href={resolve('/learn/weak')}>{m.me_weak_practice()}</a>
		</div>
		{#if weak.length === 0}
			<p class="muted">{m.me_weak_none()}</p>
		{:else}
			<ul class="chips" lang="ja">
				{#each weak as k (k)}<li class="chip">{k}</li>{/each}
			</ul>
		{/if}
	</section>

	<section class="stack" aria-labelledby="heat-title">
		<h2 id="heat-title">{m.me_heat_title()}</h2>
		<KanaHeatmap stats={heat} />
	</section>

	{#if data.stats}
		<section class="stack" aria-labelledby="hist-title">
			<h2 id="hist-title">{m.me_history_title()}</h2>
			{#if data.stats.recent.length === 0}
				<p class="muted">{m.me_history_none()}</p>
			{:else}
				<div class="table-wrap">
					<table>
						<thead>
							<tr>
								<th scope="col">{m.me_col_when()}</th>
								<th scope="col">{m.me_col_mode()}</th>
								<th scope="col" class="num">{m.result_score()}</th>
								<th scope="col" class="num">{m.result_kpm()}</th>
								<th scope="col" class="num">{m.result_accuracy()}</th>
							</tr>
						</thead>
						<tbody>
							{#each data.stats.recent as r (r.id)}
								<tr>
									<td class="muted">{dateFmt.format(new Date(r.createdAt))}</td>
									<td>{modeLabel(r.mode)}</td>
									<td class="num score">{r.score}</td>
									<td class="num">{formatKpm(r.kpm)}</td>
									<td class="num">{formatAccuracy(r.accuracy)}</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			{/if}
		</section>
	{/if}
</div>

<style>
	.me {
		gap: var(--space-12);
	}
	.head {
		gap: var(--space-2);
	}
	.stats {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
		gap: var(--space-3);
	}
	.stat {
		padding: var(--space-4) var(--space-6);
		display: flex;
		flex-direction: column;
		gap: var(--space-1);
	}
	.stat strong {
		font-size: 1.75rem;
		font-variant-numeric: tabular-nums;
	}
	.between {
		justify-content: space-between;
	}
	.chips {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2);
	}
	.chip {
		font-size: 1.25rem;
		padding: var(--space-1) var(--space-3);
		border-radius: var(--radius);
		background: var(--danger-soft);
		color: var(--danger);
	}
	.table-wrap {
		overflow-x: auto;
		border: 1px solid var(--border);
		border-radius: var(--radius-lg);
		background: var(--surface);
	}
	table {
		width: 100%;
		border-collapse: collapse;
		font-variant-numeric: tabular-nums;
	}
	th,
	td {
		padding: var(--space-3) var(--space-4);
		text-align: left;
		border-bottom: 1px solid var(--border);
	}
	th {
		font-size: 0.875rem;
		font-weight: 500;
		color: var(--fg-muted);
	}
	tbody tr:last-child td {
		border-bottom: 0;
	}
	.num {
		text-align: right;
		white-space: nowrap;
	}
	.score {
		font-weight: 700;
		color: var(--accent);
	}
</style>

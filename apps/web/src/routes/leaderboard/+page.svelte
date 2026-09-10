<script lang="ts">
	import { TIMED_POOL_IDS, TIMED_SECONDS, timedMode, type TimedPoolId } from '@jptype/data';
	import { m } from '$lib/paraglide/messages';
	import { resolve } from '$app/paths';
	import { formatAccuracy, formatKpm } from '$lib/format';

	let { data } = $props();

	const poolLabel: Record<TimedPoolId, () => string> = {
		allhira: m.timed_pool_allhira,
		allkata: m.timed_pool_allkata,
		all: m.timed_pool_all
	};

	function href(pool: TimedPoolId, seconds: (typeof TIMED_SECONDS)[number], period: string) {
		const q = new URLSearchParams({ mode: timedMode(pool, seconds), period });
		return `${resolve('/leaderboard')}?${q}`;
	}

	const inTop = $derived(!!data.me && data.board?.entries.some((e) => e.userId === data.user?.id));
</script>

<svelte:head><title>{m.leaderboard_title()} · {m.app_name()}</title></svelte:head>

<div class="container container--wide stack lb">
	<header class="stack head">
		<h1>{m.leaderboard_title()}</h1>
		<p class="muted">{m.leaderboard_lead()}</p>
	</header>

	<!-- eslint-disable svelte/no-navigation-without-resolve -- href() applies resolve(); only a query string is appended -->
	<nav class="stack filters" aria-label={m.leaderboard_filters()}>
		<div class="row" role="group" aria-label={m.timed_pool_label()}>
			{#each TIMED_POOL_IDS as pool (pool)}
				<a
					class="btn"
					href={href(pool, data.seconds, data.period)}
					aria-pressed={data.pool === pool}
					data-sveltekit-noscroll>{poolLabel[pool]()}</a
				>
			{/each}
		</div>
		<div class="row" role="group" aria-label={m.timed_seconds_label()}>
			{#each TIMED_SECONDS as s (s)}
				<a
					class="btn"
					href={href(data.pool, s, data.period)}
					aria-pressed={data.seconds === s}
					data-sveltekit-noscroll>{m.timed_seconds_option({ seconds: s })}</a
				>
			{/each}
		</div>
		<div class="row" role="group" aria-label={m.leaderboard_period()}>
			<a
				class="btn"
				href={href(data.pool, data.seconds, 'week')}
				aria-pressed={data.period === 'week'}
				data-sveltekit-noscroll>{m.leaderboard_week()}</a
			>
			<a
				class="btn"
				href={href(data.pool, data.seconds, 'all')}
				aria-pressed={data.period === 'all'}
				data-sveltekit-noscroll>{m.leaderboard_all()}</a
			>
		</div>
	</nav>
	<!-- eslint-enable svelte/no-navigation-without-resolve -->

	{#if data.board?.week}
		<p class="muted small">{m.leaderboard_week_label({ week: data.board.week })}</p>
	{/if}

	{#if !data.board || data.board.entries.length === 0}
		<p class="card empty muted">{m.leaderboard_empty()}</p>
	{:else}
		<div class="table-wrap">
			<table>
				<thead>
					<tr>
						<th scope="col" class="num">#</th>
						<th scope="col">{m.leaderboard_col_user()}</th>
						<th scope="col" class="num">{m.result_score()}</th>
						<th scope="col" class="num">{m.result_kpm()}</th>
						<th scope="col" class="num">{m.result_accuracy()}</th>
					</tr>
				</thead>
				<tbody>
					{#each data.board.entries as e (e.userId)}
						<tr class:me={e.userId === data.user?.id}>
							<td class="num">{e.rank}</td>
							<td>
								<span class="user">
									{#if e.image}<img
											class="avatar"
											src={e.image}
											alt=""
											width="24"
											height="24"
										/>{/if}
									<span class="name">{e.name}</span>
								</span>
							</td>
							<td class="num score">{e.best}</td>
							<td class="num">{formatKpm(e.kpm)}</td>
							<td class="num">{formatAccuracy(e.accuracy)}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{/if}

	{#if data.user}
		<p class="card mine">
			{#if data.me}
				{m.leaderboard_me({ rank: data.me.rank, score: data.me.best })}
				{#if inTop}<span class="muted">{m.leaderboard_me_in_top()}</span>{/if}
			{:else}
				{m.leaderboard_me_none()}
				<a href={resolve('/timed')}>{m.nav_timed()}</a>
			{/if}
		</p>
	{:else}
		<p class="muted small center">
			{m.leaderboard_login_hint()}
			<a href={resolve('/login')}>{m.nav_login()}</a>
		</p>
	{/if}
</div>

<style>
	.lb {
		gap: var(--space-8);
	}
	.head {
		gap: var(--space-2);
	}
	.filters {
		gap: var(--space-3);
	}
	.filters .btn {
		min-height: 40px;
		padding-inline: var(--space-4);
	}
	.small {
		font-size: 0.875rem;
	}
	.center {
		text-align: center;
	}
	.empty {
		padding: var(--space-8);
		text-align: center;
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
	tr.me td {
		background: var(--accent-soft);
	}
	.user {
		display: inline-flex;
		align-items: center;
		gap: var(--space-2);
	}
	.avatar {
		border-radius: 50%;
	}
	.name {
		max-width: 14em;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.mine {
		padding: var(--space-4) var(--space-6);
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-3);
		align-items: center;
		justify-content: center;
	}
</style>

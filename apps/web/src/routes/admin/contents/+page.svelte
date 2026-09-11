<script lang="ts">
	import { m } from '$lib/paraglide/messages';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { difficultyLabel, jlptLabel, statusLabel, typeLabel } from '$lib/contents-labels';
	import { formatDateTime } from '$lib/format';

	function percent(value: number | null): string {
		return value === null ? '—' : `${Math.round(value * 100)}%`;
	}

	let { data } = $props();

	// Seeded from the URL, then owned by the input until the next navigation.
	let search = $derived(data.query.q);

	function listHref(status: string, q: string) {
		const entries = Object.entries({ status, q }).filter(
			([key, value]) => value !== '' && !(key === 'status' && value === 'all')
		);
		const query = new URLSearchParams(Object.fromEntries(entries)).toString();
		return query === '' ? resolve('/admin/contents') : `${resolve('/admin/contents')}?${query}`;
	}

	function submitSearch(event: SubmitEvent) {
		event.preventDefault();
		// eslint-disable-next-line svelte/no-navigation-without-resolve -- listHref() applies resolve()
		void goto(listHref(data.status, search.trim()));
	}
</script>

<svelte:head><title>{m.admin_contents_title()} · {m.seo_site_name()}</title></svelte:head>

<div class="container container--wide stack admin">
	<header class="stack head">
		<h1>{m.admin_contents_title()}</h1>
		<p class="muted">{m.admin_contents_lead()}</p>
		<p class="row">
			<a class="btn btn--primary" href={resolve('/admin/contents/new')}>
				{m.admin_contents_new()}
			</a>
			<a class="btn" href={resolve('/admin')}>{m.admin_title()}</a>
		</p>
	</header>

	<form class="row search" onsubmit={submitSearch}>
		<label class="visually-hidden" for="admin-content-search">
			{m.admin_contents_search()}
		</label>
		<input
			id="admin-content-search"
			type="search"
			bind:value={search}
			placeholder={m.admin_contents_search_placeholder()}
		/>
		<button type="submit" class="btn">{m.admin_contents_search()}</button>
	</form>

	<!-- eslint-disable svelte/no-navigation-without-resolve -- listHref() applies resolve(); only a query string is appended -->
	<nav class="row filters" aria-label={m.admin_contents_filter_label()}>
		<a
			class="btn btn--small"
			href={listHref('all', data.query.q)}
			aria-current={data.status === 'all' ? 'true' : undefined}>{m.admin_contents_filter_all()}</a
		>
		<a
			class="btn btn--small"
			href={listHref('draft', data.query.q)}
			aria-current={data.status === 'draft' ? 'true' : undefined}
			>{m.admin_contents_status_draft()}</a
		>
		<a
			class="btn btn--small"
			href={listHref('published', data.query.q)}
			aria-current={data.status === 'published' ? 'true' : undefined}
			>{m.admin_contents_status_published()}</a
		>
	</nav>
	<!-- eslint-enable svelte/no-navigation-without-resolve -->

	{#if data.list.contents.length === 0}
		<p class="card empty muted">{m.admin_contents_empty()}</p>
	{:else}
		<div class="table-wrap">
			<table>
				<thead>
					<tr>
						<th scope="col">{m.admin_contents_col_title()}</th>
						<th scope="col">{m.admin_contents_col_type()}</th>
						<th scope="col">{m.admin_contents_col_status()}</th>
						<th scope="col" class="num">{m.admin_contents_col_lines()}</th>
						<th
							scope="col"
							class="num"
							title={m.admin_contents_stats_note({ days: data.statsDays })}
						>
							{m.admin_contents_col_views()}
						</th>
						<th
							scope="col"
							class="num"
							title={m.admin_contents_stats_note({ days: data.statsDays })}
						>
							{m.admin_contents_col_starts()}
						</th>
						<th
							scope="col"
							class="num"
							title={m.admin_contents_stats_note({ days: data.statsDays })}
						>
							{m.admin_contents_col_completes()}
						</th>
						<th
							scope="col"
							class="num"
							title={m.admin_contents_stats_note({ days: data.statsDays })}
						>
							{m.admin_contents_col_conversion()}
						</th>
						<th scope="col">{m.admin_contents_col_updated()}</th>
					</tr>
				</thead>
				<tbody>
					{#each data.list.contents as content (content.id)}
						<tr>
							<td>
								<a href={resolve('/admin/contents/[id]', { id: content.id })}>{content.title}</a>
								{#if content.jlptLevel !== 'unknown'}
									<span class="muted small">{jlptLabel[content.jlptLevel]()}</span>
								{/if}
								<span class="muted small">{difficultyLabel[content.difficulty]()}</span>
							</td>
							<td>{typeLabel[content.type]()}</td>
							<td>{statusLabel[content.status]()}</td>
							<td class="num">{content.lineCount}</td>
							<td class="num">{data.stats[content.id]?.views ?? 0}</td>
							<td class="num">{data.stats[content.id]?.starts ?? 0}</td>
							<td class="num">{data.stats[content.id]?.completes ?? 0}</td>
							<td class="num">{percent(data.stats[content.id]?.conversion ?? null)}</td>
							<td class="when">{formatDateTime(content.updatedAt)}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
		<p class="muted small">
			{m.admin_contents_total({ count: data.list.total })} ·
			{m.admin_contents_stats_note({ days: data.statsDays })}
		</p>
	{/if}
</div>

<style>
	.admin {
		gap: var(--space-8);
	}
	.head {
		gap: var(--space-2);
	}
	.small {
		font-size: 0.875rem;
	}
	.search {
		gap: var(--space-2);
	}
	.search input {
		font: inherit;
		color: var(--fg);
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: var(--radius);
		padding: var(--space-2) var(--space-3);
		min-height: 44px;
		flex: 1;
		min-width: 12rem;
		max-width: 24rem;
	}
	.filters {
		gap: var(--space-2);
	}
	.btn--small {
		min-height: 36px;
		padding-inline: var(--space-4);
		font-size: 0.875rem;
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
	}
	th,
	td {
		padding: var(--space-3) var(--space-4);
		text-align: left;
		vertical-align: top;
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
	td span {
		display: block;
	}
	.num {
		text-align: right;
		font-variant-numeric: tabular-nums;
	}
	.when {
		white-space: nowrap;
	}
</style>

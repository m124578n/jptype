<script lang="ts">
	import { onMount } from 'svelte';
	import { m } from '$lib/paraglide/messages';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import Icon from '$lib/components/Icon.svelte';
	import {
		CONTENT_TYPES,
		DIFFICULTIES,
		JLPT_LEVELS,
		thumbnailUrl,
		type ContentSummary
	} from '$lib/contents';
	import { difficultyLabel, jlptLabel, typeIcon, typeLabel } from '$lib/contents-labels';
	import { loadResults, type LessonResults } from '$lib/storage';

	let { data } = $props();

	/** Personal bests live in this browser (`content:{id}`), so they are read after mount. */
	let results = $state<LessonResults>({});
	onMount(() => {
		results = loadResults();
	});

	// Seeded from the URL, then owned by the input until the next navigation.
	let search = $derived(data.query.q);

	/** One URL for the list: only the filters that are actually set become query parameters. */
	function listHref(next: {
		type: string;
		jlpt: string;
		difficulty: string;
		q: string;
		page: string;
	}) {
		const entries = Object.entries(next).filter(
			([key, value]) => value !== '' && !(key === 'page' && value === '1')
		);
		const query = new URLSearchParams(Object.fromEntries(entries)).toString();
		return query === '' ? resolve('/contents') : `${resolve('/contents')}?${query}`;
	}

	function current(): { type: string; jlpt: string; difficulty: string; q: string; page: string } {
		return {
			type: data.query.type ?? '',
			jlpt: data.query.jlptLevel ?? '',
			difficulty: data.query.difficulty ?? '',
			q: data.query.q,
			page: '1'
		};
	}

	/** Change one filter (or the page); every other filter is kept. */
	function filterHref(key: 'type' | 'jlpt' | 'difficulty' | 'page', value: string) {
		return listHref({ ...current(), [key]: value });
	}

	function submitSearch(event: SubmitEvent) {
		event.preventDefault();
		// eslint-disable-next-line svelte/no-navigation-without-resolve -- listHref() applies resolve()
		void goto(listHref({ ...current(), q: search.trim() }));
	}

	function bestOf(id: string): number | null {
		return results[`content:${id}`]?.best.score ?? null;
	}

	const lastPage = $derived(Math.max(1, Math.ceil(data.list.total / data.list.pageSize)));

	function tags(content: ContentSummary): string[] {
		const out = [typeLabel[content.type](), difficultyLabel[content.difficulty]()];
		if (content.jlptLevel !== 'unknown') out.push(jlptLabel[content.jlptLevel]());
		if (content.timedCount >= 2) out.push(m.contents_tag_sync());
		return out;
	}
</script>

<svelte:head><title>{m.contents_title()} · {m.app_name()}</title></svelte:head>

<div class="container container--wide stack contents">
	<header class="stack head">
		<h1>{m.contents_title()}</h1>
		<p class="muted">{m.contents_lead()}</p>
	</header>

	<form class="row search" onsubmit={submitSearch}>
		<label class="visually-hidden" for="content-search">{m.contents_search_label()}</label>
		<input
			id="content-search"
			type="search"
			bind:value={search}
			placeholder={m.contents_search_placeholder()}
		/>
		<button type="submit" class="btn">{m.contents_search_button()}</button>
	</form>

	<!-- eslint-disable svelte/no-navigation-without-resolve -- filterHref() applies resolve(); only a query string is appended -->
	<nav class="stack filters" aria-label={m.contents_filters()}>
		<div class="row" role="group" aria-label={m.contents_filter_type()}>
			<a
				class="btn btn--small"
				href={filterHref('type', '')}
				aria-current={data.query.type === undefined ? 'true' : undefined}
				data-sveltekit-noscroll>{m.contents_filter_all()}</a
			>
			{#each CONTENT_TYPES as type (type)}
				<a
					class="btn btn--small"
					href={filterHref('type', type)}
					aria-current={data.query.type === type ? 'true' : undefined}
					data-sveltekit-noscroll>{typeLabel[type]()}</a
				>
			{/each}
		</div>
		<div class="row" role="group" aria-label={m.contents_filter_jlpt()}>
			<a
				class="btn btn--small"
				href={filterHref('jlpt', '')}
				aria-current={data.query.jlptLevel === undefined ? 'true' : undefined}
				data-sveltekit-noscroll>{m.contents_filter_all()}</a
			>
			{#each JLPT_LEVELS as level (level)}
				<a
					class="btn btn--small"
					href={filterHref('jlpt', level)}
					aria-current={data.query.jlptLevel === level ? 'true' : undefined}
					data-sveltekit-noscroll>{jlptLabel[level]()}</a
				>
			{/each}
		</div>
		<div class="row" role="group" aria-label={m.contents_filter_difficulty()}>
			<a
				class="btn btn--small"
				href={filterHref('difficulty', '')}
				aria-current={data.query.difficulty === undefined ? 'true' : undefined}
				data-sveltekit-noscroll>{m.contents_filter_all()}</a
			>
			{#each DIFFICULTIES as level (level)}
				<a
					class="btn btn--small"
					href={filterHref('difficulty', level)}
					aria-current={data.query.difficulty === level ? 'true' : undefined}
					data-sveltekit-noscroll>{difficultyLabel[level]()}</a
				>
			{/each}
		</div>
	</nav>

	{#if data.list.contents.length === 0}
		<p class="card empty muted">{m.contents_empty()}</p>
	{:else}
		<ul class="cards">
			{#each data.list.contents as content (content.id)}
				<li class="card item">
					<a class="thumb" href={resolve('/contents/[id]', { id: content.id })}>
						{#if content.videoId}
							<img
								src={thumbnailUrl(content.videoId)}
								alt=""
								loading="lazy"
								width="320"
								height="180"
							/>
						{:else}
							<span class="glyph"><Icon name={typeIcon[content.type]} size={32} /></span>
						{/if}
					</a>
					<div class="stack body">
						<h2 class="name">
							<a href={resolve('/contents/[id]', { id: content.id })}>{content.title}</a>
						</h2>
						{#if content.description !== ''}
							<p class="muted desc">{content.description}</p>
						{/if}
						<p class="row tags">
							{#each tags(content) as tag (tag)}
								<span class="tag">{tag}</span>
							{/each}
							<span class="muted small">{m.contents_lines({ count: content.lineCount })}</span>
						</p>
						<p class="muted small best">
							{#if bestOf(content.id) !== null}
								{m.contents_best({ score: bestOf(content.id) ?? 0 })}
							{:else}
								{m.contents_not_started()}
							{/if}
						</p>
					</div>
				</li>
			{/each}
		</ul>

		{#if lastPage > 1}
			<nav class="row pager" aria-label={m.contents_pager()}>
				{#if data.list.page > 1}
					<a class="btn" href={filterHref('page', String(data.list.page - 1))}
						>{m.contents_prev()}</a
					>
				{/if}
				<span class="muted small">
					{m.contents_page({ page: data.list.page, total: lastPage })}
				</span>
				{#if data.list.page < lastPage}
					<a class="btn" href={filterHref('page', String(data.list.page + 1))}
						>{m.contents_next()}</a
					>
				{/if}
			</nav>
		{/if}
	{/if}
	<!-- eslint-enable svelte/no-navigation-without-resolve -->
</div>

<style>
	.contents {
		gap: var(--space-8);
	}
	.head {
		gap: var(--space-2);
	}
	.search {
		gap: var(--space-2);
		flex-wrap: wrap;
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
	.btn--small {
		min-height: 36px;
		padding-inline: var(--space-4);
		font-size: 0.875rem;
	}
	.filters {
		gap: var(--space-2);
	}
	.filters .row {
		flex-wrap: wrap;
		gap: var(--space-2);
	}
	.cards {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
		gap: var(--space-4);
	}
	.item {
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
		padding: 0;
		overflow: hidden;
	}
	.thumb {
		display: block;
		aspect-ratio: 16 / 9;
		background: var(--surface);
		border-bottom: 1px solid var(--border);
	}
	.thumb img {
		width: 100%;
		height: 100%;
		object-fit: cover;
		display: block;
	}
	.glyph {
		display: flex;
		align-items: center;
		justify-content: center;
		height: 100%;
		color: var(--fg-muted);
	}
	.body {
		gap: var(--space-2);
		padding: 0 var(--space-4) var(--space-4);
	}
	.name {
		font-size: 1.125rem;
		margin: 0;
	}
	.name a {
		text-decoration: none;
	}
	.desc,
	.best {
		margin: 0;
	}
	.desc {
		font-size: 0.875rem;
		display: -webkit-box;
		-webkit-line-clamp: 2;
		line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}
	.tags {
		flex-wrap: wrap;
		gap: var(--space-2);
		margin: 0;
	}
	.tag {
		font-size: 0.75rem;
		padding: 2px var(--space-2);
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
		color: var(--fg-muted);
	}
	.small {
		font-size: 0.875rem;
	}
	.empty {
		padding: var(--space-8);
		text-align: center;
	}
	.pager {
		justify-content: center;
		align-items: center;
		gap: var(--space-4);
	}
</style>

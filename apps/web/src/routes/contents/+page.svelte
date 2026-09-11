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
	import { loadReview, recentSubjects, type RecentSubject } from '$lib/review';
	import { loadResults, type LessonResults } from '$lib/storage';

	let { data } = $props();

	/** Personal bests live in this browser (`content:{id}`), so they are read after mount. */
	let results = $state<LessonResults>({});
	/** 最近練過: the last few contents / songs practised on this device, newest first. */
	let recent = $state<RecentSubject[]>([]);
	onMount(() => {
		results = loadResults();
		recent = recentSubjects(loadReview(), results);
	});

	/**
	 * The review store remembers the title of everything practised since M4-2; anything older is
	 * named from the current listing when it happens to be on this page, and otherwise skipped —
	 * a bare id would tell the reader nothing.
	 */
	const recentShown = $derived(
		recent
			.map((item) => ({
				...item,
				title:
					item.title !== ''
						? item.title
						: (data.list.contents.find((c) => c.id === item.id)?.title ?? '')
			}))
			.filter((item) => item.title !== '')
	);

	function recentHref(item: RecentSubject): string {
		return item.kind === 'song'
			? resolve('/library/[id]', { id: item.id })
			: resolve('/contents/[id]', { id: item.id });
	}

	// Seeded from the URL, then owned by the input until the next navigation.
	let search = $derived(data.query.q);

	/** One URL for the list: only the filters that are actually set become query parameters. */
	function listHref(next: {
		type: string;
		jlpt: string;
		difficulty: string;
		source: string;
		q: string;
		page: string;
	}) {
		const entries = Object.entries(next).filter(
			([key, value]) => value !== '' && !(key === 'page' && value === '1')
		);
		const query = new URLSearchParams(Object.fromEntries(entries)).toString();
		return query === '' ? resolve('/contents') : `${resolve('/contents')}?${query}`;
	}

	function current(): {
		type: string;
		jlpt: string;
		difficulty: string;
		source: string;
		q: string;
		page: string;
	} {
		return {
			type: data.query.type ?? '',
			jlpt: data.query.jlptLevel ?? '',
			difficulty: data.query.difficulty ?? '',
			source: data.query.owner === 'all' ? '' : data.query.owner,
			q: data.query.q,
			page: '1'
		};
	}

	/** Change one filter (or the page); every other filter is kept. */
	function filterHref(key: 'type' | 'jlpt' | 'difficulty' | 'source' | 'page', value: string) {
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
	const filtered = $derived(
		data.query.type !== undefined ||
			data.query.jlptLevel !== undefined ||
			data.query.difficulty !== undefined ||
			data.query.owner !== 'all' ||
			data.query.q !== ''
	);

	/** User-provided content is practised on /library (the song machinery); platform content on /contents. */
	function practiceHref(content: ContentSummary): string {
		return content.ownerId === null
			? resolve('/contents/[id]', { id: content.id })
			: resolve('/library/[id]', { id: content.id });
	}

	function tags(content: ContentSummary): string[] {
		const out = [typeLabel[content.type]()];
		if (content.ownerId !== null) out.push(m.contents_tag_user());
		else out.push(difficultyLabel[content.difficulty]());
		if (content.jlptLevel !== 'unknown') out.push(jlptLabel[content.jlptLevel]());
		if (content.timedCount >= 2) out.push(m.contents_tag_sync());
		return out;
	}
</script>

<svelte:head><title>{m.contents_title()} · {m.seo_site_name()}</title></svelte:head>

<div class="container container--wide stack contents">
	<header class="stack head">
		<h1>{m.contents_title()}</h1>
		<p class="muted">{m.contents_lead()}</p>
	</header>

	{#if recentShown.length > 0}
		<section class="stack recent" aria-labelledby="recent-title">
			<h2 id="recent-title" class="recent-title">{m.contents_recent_title()}</h2>
			<ul class="recent-list">
				{#each recentShown as item (item.subject)}
					<li>
						<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- recentHref() applies resolve() -->
						<a class="card recent-item" href={recentHref(item)}>
							<span class="recent-name">{item.title}</span>
							<span class="muted small">{m.contents_best({ score: item.best })}</span>
						</a>
					</li>
				{/each}
			</ul>
		</section>
	{/if}

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
		<div class="row" role="group" aria-label={m.contents_filter_source()}>
			<a
				class="btn btn--small"
				href={filterHref('source', '')}
				aria-current={data.query.owner === 'all' ? 'true' : undefined}
				data-sveltekit-noscroll>{m.contents_filter_all()}</a
			>
			<a
				class="btn btn--small"
				href={filterHref('source', 'platform')}
				aria-current={data.query.owner === 'platform' ? 'true' : undefined}
				data-sveltekit-noscroll>{m.contents_source_platform()}</a
			>
			<a
				class="btn btn--small"
				href={filterHref('source', 'user')}
				aria-current={data.query.owner === 'user' ? 'true' : undefined}
				data-sveltekit-noscroll>{m.contents_source_user()}</a
			>
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
		<div class="card empty stack">
			<p class="muted">{m.contents_empty()}</p>
			{#if filtered}
				<p><a class="btn" href={resolve('/contents')}>{m.contents_clear_filters()}</a></p>
			{/if}
		</div>
	{:else}
		<ul class="cards">
			{#each data.list.contents as content (content.id)}
				<li class="card item">
					<a class="thumb" href={practiceHref(content)}>
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
							<a href={practiceHref(content)}>{content.title}</a>
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
		align-items: center;
		gap: var(--space-4);
	}
	.empty p {
		margin: 0;
	}
	.recent {
		gap: var(--space-3);
	}
	.recent-title {
		font-size: 1rem;
		font-weight: 500;
		margin: 0;
	}
	.recent-list {
		list-style: none;
		margin: 0;
		padding: 0 0 var(--space-1);
		display: flex;
		gap: var(--space-3);
		overflow-x: auto;
	}
	.recent-item {
		display: flex;
		flex-direction: column;
		gap: var(--space-1);
		padding: var(--space-3) var(--space-4);
		min-width: 12rem;
		text-decoration: none;
	}
	.recent-name {
		font-weight: 500;
	}
	.pager {
		justify-content: center;
		align-items: center;
		gap: var(--space-4);
	}
</style>

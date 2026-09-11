<script lang="ts">
	import { onMount } from 'svelte';
	import { m } from '$lib/paraglide/messages';
	import { resolve } from '$app/paths';
	import YouTubePlayer from '$lib/components/YouTubePlayer.svelte';
	import { applyTiming, type TimingCandidate } from '$lib/song-hash';
	import { timedCount } from '$lib/song-timing';
	import {
		lyricsSearchUrl,
		newSongId,
		parseLyrics,
		parseYoutubeId,
		saveSong,
		validateLines,
		type LineIssue,
		type Song,
		type SongLine
	} from '$lib/songs';
	import {
		countTimingUse,
		createSong,
		fetchPublicSongs,
		findSharedTiming,
		importLocalSongs,
		loadLibrary,
		localEntry,
		removeEntry,
		type LibraryEntry,
		type PublicList
	} from '$lib/songs-api';
	import { convertLines, needsReading } from '$lib/songs-kana';
	import { watchUrl } from '$lib/youtube';

	let { data } = $props();
	const loggedIn = $derived(data.user !== null);

	// The library is read after mount: signed in it comes from the account, otherwise from
	// localStorage — either way the server-rendered shell must not depend on it.
	let entries = $state<LibraryEntry[]>([]);
	let ready = $state(false);
	let offline = $state(false);
	let importable = $state<Song[]>([]);
	let importing = $state(false);
	let importDone = $state(0);
	let importFailed = $state(0);
	let saveFailed = $state(false);
	/** Three takedowns and this account may no longer publish anything. */
	let suspended = $state(false);

	async function refresh() {
		const library = await loadLibrary(data.user !== null);
		entries = library.songs;
		offline = library.offline;
		importable = library.importable;
		suspended = library.publish.suspended;
		ready = true;
	}

	onMount(() => void refresh());
	onMount(() => void loadPublic(1));

	let title = $state('');
	let url = $state('');
	let lyrics = $state('');
	let errors = $state<string[]>([]);
	let issues = $state<LineIssue[]>([]);
	let saving = $state(false);
	/**
	 * Readings to confirm (M4-1d): set when the paste had kanji and the browser converted it.
	 * While non-null the form shows this list instead of the textarea; saving uses it.
	 */
	let converted = $state<SongLine[] | null>(null);
	let converting = $state('');
	let convertFailed = $state(false);
	/** Once the user edits the title themselves, YouTube must not overwrite it. */
	let titleEdited = $state(false);

	const videoId = $derived(parseYoutubeId(url));

	// ── Shared timeline offered for this exact paste ────────────────────────────────────────────
	let shared = $state.raw<TimingCandidate | null>(null);
	let sharedStarts = $state.raw<number[] | null>(null);
	let lookupTimer: ReturnType<typeof setTimeout> | null = null;

	/**
	 * Ask the server whether somebody already timed this exact reading. Only hashes of the pasted
	 * lines are compared (computed here in the browser); the lyrics never leave the page.
	 */
	async function lookupTiming() {
		shared = null;
		sharedStarts = null;
		const video = videoId;
		if (video === null) return;
		const lines = parseLyrics(lyrics);
		if (lines.length < 2) return;
		const found = await findSharedTiming(video, lines);
		if (found && found.starts.length === lines.length) shared = found;
	}

	function scheduleLookup() {
		if (lookupTimer !== null) clearTimeout(lookupTimer);
		lookupTimer = setTimeout(() => void lookupTiming(), 400);
	}

	function applyShared() {
		if (!shared) return;
		sharedStarts = shared.starts;
	}

	function playerReady(info: { title: string }) {
		if (!titleEdited && title.trim() === '' && info.title !== '') title = info.title;
	}

	function withSharedStarts(lines: SongLine[]): SongLine[] {
		const starts = sharedStarts;
		return starts !== null && starts.length === lines.length ? applyTiming(lines, starts) : lines;
	}

	/** The confirmed reading of line `i` was edited; keep `original` only while it still differs. */
	function editReading(i: number, text: string) {
		if (!converted) return;
		converted = converted.map((line, index) => {
			if (index !== i) return line;
			const next: SongLine = { ...line, text };
			if (next.original === text) delete next.original;
			return next;
		});
	}

	function backToLyrics() {
		converted = null;
		issues = [];
		errors = [];
	}

	/** Lines that still contain something the engine cannot type, 1-based, for the list. */
	const unresolvedLines = $derived(
		converted ? converted.flatMap((line, i) => (needsReading(line) ? [i + 1] : [])) : []
	);

	async function submit(event: SubmitEvent) {
		event.preventDefault();
		saveFailed = false;
		convertFailed = false;
		const found: string[] = [];
		const t = title.trim();
		if (t === '') found.push(m.songs_error_title());
		if (videoId === null) found.push(m.songs_error_url());
		const parsed = converted ?? parseLyrics(lyrics);
		if (parsed.length === 0) found.push(m.songs_error_lyrics());
		issues = parsed.length === 0 ? [] : validateLines(parsed);
		errors = found;
		if (found.length > 0 || videoId === null) return;

		// Kanji in the paste: convert in the browser and let the user confirm before saving.
		if (issues.length > 0 && converted === null) {
			converting = m.songs_convert_loading();
			try {
				converted = await convertLines(parsed, (stage) => {
					converting = stage === 'loading' ? m.songs_convert_loading() : m.songs_convert_working();
				});
				issues = validateLines(converted);
			} catch {
				convertFailed = true;
			} finally {
				converting = '';
			}
			return;
		}
		if (issues.length > 0) return;

		const lines = withSharedStarts(parsed);
		saving = true;
		if (loggedIn && !offline) {
			const created = await createSong({ title: t, videoId, lines });
			saving = false;
			if (!created) {
				saveFailed = true;
				return;
			}
			entries = [created, ...entries];
		} else {
			const now = Date.now();
			const song: Song = {
				id: newSongId(),
				title: t,
				youtubeId: videoId,
				lines,
				createdAt: now,
				updatedAt: now
			};
			saveSong(song);
			saving = false;
			entries = [localEntry(song), ...entries.filter((e) => e.id !== song.id)];
		}

		if (shared && sharedStarts !== null) void countTimingUse(shared.id);
		title = '';
		url = '';
		lyrics = '';
		converted = null;
		issues = [];
		titleEdited = false;
		shared = null;
		sharedStarts = null;
	}

	async function remove(entry: LibraryEntry) {
		if (!window.confirm(m.songs_delete_confirm({ title: entry.title }))) return;
		const ok = await removeEntry(entry);
		if (!ok) {
			saveFailed = true;
			return;
		}
		entries = entries.filter((e) => e.id !== entry.id);
	}

	async function runImport() {
		importing = true;
		const result = await importLocalSongs();
		importing = false;
		importDone = result.imported;
		importFailed = result.failed;
		await refresh();
	}

	// ── Public library (plain list, newest first, no curation) ──────────────────────────────────
	let query = $state('');
	let publicList = $state.raw<PublicList | null>(null);
	let publicLoading = $state(false);

	async function loadPublic(page: number) {
		publicLoading = true;
		publicList = await fetchPublicSongs(query.trim(), page);
		publicLoading = false;
	}

	function searchPublic(event: SubmitEvent) {
		event.preventDefault();
		void loadPublic(1);
	}

	const publicPages = $derived(
		publicList === null ? 1 : Math.max(1, Math.ceil(publicList.total / publicList.pageSize))
	);
</script>

<svelte:head><title>{m.songs_title()} · {m.app_name()}</title></svelte:head>

<div class="container stack songs">
	<header class="stack head">
		<h1>{m.songs_title()}</h1>
		<p class="muted">{m.songs_lead()}</p>
		<p class="muted small">{loggedIn ? m.songs_privacy_account() : m.songs_privacy()}</p>
		{#if !loggedIn}
			<p class="muted small">
				{m.songs_login_hint()}
				<a href={resolve('/login')}>{m.nav_login()}</a>
			</p>
		{/if}
		{#if offline}
			<p class="error small" role="alert">{m.songs_offline()}</p>
		{/if}
		{#if suspended}
			<p class="error small" role="alert">{m.songs_publish_suspended()}</p>
		{/if}
	</header>

	{#if importable.length > 0}
		<section class="card import stack">
			<strong>{m.songs_import_title({ count: importable.length })}</strong>
			<p class="muted small">{m.songs_import_body()}</p>
			<p>
				<button type="button" class="btn btn--primary" disabled={importing} onclick={runImport}>
					{importing ? m.songs_importing() : m.songs_import_button()}
				</button>
			</p>
		</section>
	{/if}
	{#if importDone > 0}
		<p class="ok small" role="status">{m.songs_import_done({ count: importDone })}</p>
	{/if}
	{#if importFailed > 0}
		<p class="error small" role="alert">{m.songs_import_failed({ count: importFailed })}</p>
	{/if}

	<section class="stack">
		<h2>{m.songs_list_title()}</h2>
		{#if ready && entries.length === 0}
			<p class="muted">{m.songs_empty()}</p>
		{:else if entries.length > 0}
			<ul class="list">
				{#each entries as entry (entry.id)}
					<li class="card item">
						<div class="stack info">
							<span class="name">{entry.title}</span>
							<span class="muted small">
								{m.songs_line_count({ count: entry.lines.length })}
								·
								{timedCount(entry.lines) === 0
									? m.songs_untimed()
									: m.songs_timed_count({ count: timedCount(entry.lines) })}
								·
								{entry.status === 'removed'
									? m.songs_status_removed()
									: entry.visibility === 'public'
										? m.songs_visibility_public()
										: m.songs_visibility_private()}
							</span>
						</div>
						<a class="btn btn--primary" href={resolve('/songs/[id]', { id: entry.id })}>
							{m.songs_practice()}
						</a>
						<a class="btn" href={resolve('/songs/[id]/timing', { id: entry.id })}>
							{m.songs_timing_link()}
						</a>
						<button type="button" class="btn" onclick={() => remove(entry)}>
							{m.songs_delete()}
						</button>
					</li>
				{/each}
			</ul>
		{/if}
		{#if saveFailed}
			<p class="error small" role="alert">{m.songs_save_failed()}</p>
		{/if}
	</section>

	<section class="stack">
		<h2>{m.songs_add_title()}</h2>
		<form class="stack form" onsubmit={submit}>
			<div class="stack field">
				<label for="song-url">{m.songs_field_url()}</label>
				<input
					id="song-url"
					type="text"
					bind:value={url}
					oninput={scheduleLookup}
					autocomplete="off"
					spellcheck="false"
				/>
				<p class="muted small">{m.songs_field_url_hint()}</p>
			</div>

			{#if videoId !== null}
				<!-- Mounted paused: it is how we learn the title, and it lets the user check the video. -->
				<YouTubePlayer {videoId} {title} onready={playerReady} />
			{/if}

			<div class="stack field">
				<label for="song-title">{m.songs_field_title()}</label>
				<input
					id="song-title"
					type="text"
					bind:value={title}
					oninput={() => (titleEdited = true)}
					placeholder={m.songs_field_title_placeholder()}
					autocomplete="off"
				/>
			</div>

			<div class="stack field">
				<p class="muted small">{m.songs_source_hint()}</p>
				<p class="row links">
					{#if title.trim() !== ''}
						<a
							class="btn"
							href={lyricsSearchUrl(title)}
							target="_blank"
							rel="external noopener noreferrer"
						>
							{m.songs_search_lyrics()}
						</a>
					{/if}
					{#if videoId !== null}
						<a
							class="btn"
							href={watchUrl(videoId)}
							target="_blank"
							rel="external noopener noreferrer"
						>
							{m.songs_open_youtube()}
						</a>
					{/if}
				</p>
			</div>

			{#if converted === null}
				<div class="stack field">
					<label for="song-lyrics">{m.songs_field_lyrics()}</label>
					<textarea
						id="song-lyrics"
						rows="10"
						bind:value={lyrics}
						oninput={scheduleLookup}
						lang="ja"
						spellcheck="false"></textarea>
					<p class="muted small">{m.songs_field_lyrics_hint()}</p>
					<p class="muted small">{m.songs_field_lyrics_sync_hint()}</p>
				</div>
			{:else}
				<div class="stack field readings" role="region" aria-labelledby="readings-title">
					<h3 id="readings-title">{m.songs_convert_title()}</h3>
					<p class="muted small">{m.songs_convert_lead()}</p>
					<ol class="stack reading-list">
						{#each converted as line, i (i)}
							<li class="stack reading" class:bad={unresolvedLines.includes(i + 1)}>
								{#if line.original !== undefined}
									<span class="muted small original" lang="ja">{line.original}</span>
								{/if}
								<label class="visually-hidden" for="reading-{i}">
									{m.songs_convert_kana({ line: i + 1 })}
								</label>
								<input
									id="reading-{i}"
									type="text"
									value={line.text}
									oninput={(e) => editReading(i, e.currentTarget.value)}
									lang="ja"
									autocomplete="off"
									spellcheck="false"
								/>
							</li>
						{/each}
					</ol>
					<p class="row">
						<button type="button" class="btn" onclick={backToLyrics}>
							{m.songs_convert_back()}
						</button>
					</p>
				</div>
			{/if}
			{#if converting !== ''}
				<p class="muted small" role="status">{converting}</p>
			{/if}
			{#if convertFailed}
				<p class="error small" role="alert">{m.songs_convert_failed()}</p>
			{/if}

			{#if shared !== null}
				<div class="stack shared" role="status">
					{#if sharedStarts === null}
						<p>{m.songs_timing_apply_found()}</p>
						<p>
							<button type="button" class="btn" onclick={applyShared}>
								{m.songs_timing_apply()}
							</button>
						</p>
					{:else}
						<p class="ok">{m.songs_timing_applied({ count: sharedStarts.length })}</p>
					{/if}
					<p class="muted small">{m.songs_timing_apply_hint()}</p>
				</div>
			{/if}

			{#if errors.length > 0 || issues.length > 0}
				<div class="stack problems" role="alert">
					{#each errors as error (error)}
						<p class="error">{error}</p>
					{/each}
					{#if issues.length > 0}
						<p class="error">{m.songs_error_chars_lead()}</p>
						<ul class="chips">
							{#each issues as issue (`${issue.line}:${issue.char}`)}
								<li class="chip" lang="ja">
									{m.songs_error_char({ line: issue.line, char: issue.char })}
								</li>
							{/each}
						</ul>
					{/if}
				</div>
			{/if}

			<p>
				<button type="submit" class="btn btn--primary" disabled={saving || converting !== ''}>
					{saving ? m.songs_saving() : m.songs_save()}
				</button>
			</p>
		</form>
	</section>

	<section class="stack">
		<h2>{m.songs_public_section_title()}</h2>
		<p class="muted small">{m.songs_public_lead()}</p>
		<form class="row" onsubmit={searchPublic}>
			<label class="visually-hidden" for="public-q">{m.songs_public_search()}</label>
			<input id="public-q" type="search" bind:value={query} />
			<button type="submit" class="btn" disabled={publicLoading}>
				{m.songs_public_search_button()}
			</button>
		</form>

		{#if publicList !== null && publicList.songs.length === 0}
			<p class="muted">{m.songs_public_empty()}</p>
		{:else if publicList !== null}
			<ul class="list">
				{#each publicList.songs as song (song.id)}
					<li class="card item">
						<div class="stack info">
							<span class="name">{song.title}</span>
							<span class="muted small">
								{m.songs_public_meta({ lines: song.lineCount, timed: song.timedCount })}
							</span>
						</div>
						<a class="btn btn--primary" href={resolve('/songs/[id]', { id: song.id })}>
							{m.songs_practice()}
						</a>
						<a class="btn" href="{resolve('/copyright')}?song={song.id}">
							{m.songs_public_report()}
						</a>
					</li>
				{/each}
			</ul>
			<p class="row pager">
				<button
					type="button"
					class="btn"
					disabled={publicList.page <= 1 || publicLoading}
					onclick={() => loadPublic((publicList?.page ?? 1) - 1)}
				>
					{m.songs_public_prev()}
				</button>
				<span class="muted small">
					{m.songs_public_page({ page: publicList.page, total: publicList.total })}
				</span>
				<button
					type="button"
					class="btn"
					disabled={publicList.page >= publicPages || publicLoading}
					onclick={() => loadPublic((publicList?.page ?? 1) + 1)}
				>
					{m.songs_public_next()}
				</button>
			</p>
		{/if}
	</section>
</div>

<style>
	.songs {
		gap: var(--space-12);
	}
	.head {
		gap: var(--space-3);
	}
	.small {
		font-size: 0.875rem;
	}
	.import {
		padding: var(--space-4) var(--space-6);
		gap: var(--space-2);
		border-color: var(--accent);
	}
	.import p {
		margin: 0;
	}
	.list {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
	}
	.item {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-3);
		padding: var(--space-4) var(--space-6);
	}
	.info {
		flex: 1;
		gap: 0;
		min-width: 10rem;
	}
	.name {
		font-weight: 500;
	}
	.form {
		gap: var(--space-6);
	}
	.field {
		gap: var(--space-2);
	}
	.links {
		flex-wrap: wrap;
		gap: var(--space-3);
	}
	.pager {
		justify-content: center;
	}
	label {
		font-weight: 500;
	}
	input,
	textarea {
		font: inherit;
		color: var(--fg);
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: var(--radius);
		padding: var(--space-3) var(--space-4);
		width: 100%;
	}
	input {
		min-height: 44px;
	}
	input[type='search'] {
		flex: 1;
		width: auto;
		min-width: 8rem;
	}
	textarea {
		resize: vertical;
		line-height: 1.8;
	}
	.shared {
		gap: var(--space-2);
		border: 1px solid var(--accent);
		border-radius: var(--radius);
		padding: var(--space-4);
	}
	.shared p {
		margin: 0;
	}
	.readings {
		gap: var(--space-3);
	}
	.readings h3 {
		margin: 0;
	}
	.reading-list {
		gap: var(--space-2);
		margin: 0;
		padding-left: 1.5rem;
	}
	.reading {
		gap: var(--space-1);
	}
	.reading.bad input {
		border-color: var(--danger);
	}
	.original {
		line-height: 1.5;
	}
	.problems {
		gap: var(--space-2);
		border: 1px solid var(--danger);
		border-radius: var(--radius);
		padding: var(--space-4);
	}
	.error {
		color: var(--danger);
	}
	.ok {
		color: var(--accent);
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
		font-size: 0.875rem;
		padding: var(--space-1) var(--space-3);
		border-radius: var(--radius);
		background: var(--danger-soft);
		color: var(--danger);
	}
</style>

<script lang="ts">
	import { onMount } from 'svelte';
	import { m } from '$lib/paraglide/messages';
	import { resolve } from '$app/paths';
	import {
		deleteSong,
		loadSongs,
		newSongId,
		parseLyrics,
		parseYoutubeId,
		saveSong,
		validateLines,
		type LineIssue,
		type Song
	} from '$lib/songs';

	// The library lives in localStorage only, so it is read after mount (SSR renders the shell).
	let songs = $state<Song[]>([]);
	let ready = $state(false);
	onMount(() => {
		songs = loadSongs();
		ready = true;
	});

	let title = $state('');
	let url = $state('');
	let lyrics = $state('');
	let errors = $state<string[]>([]);
	let issues = $state<LineIssue[]>([]);

	function submit(event: SubmitEvent) {
		event.preventDefault();
		const found: string[] = [];
		const t = title.trim();
		if (t === '') found.push(m.songs_error_title());
		const youtubeId = parseYoutubeId(url);
		if (youtubeId === null) found.push(m.songs_error_url());
		const lines = parseLyrics(lyrics);
		if (lines.length === 0) found.push(m.songs_error_lyrics());
		issues = lines.length === 0 ? [] : validateLines(lines);
		errors = found;
		if (found.length > 0 || issues.length > 0 || youtubeId === null) return;

		const now = Date.now();
		songs = saveSong({
			id: newSongId(),
			title: t,
			youtubeId,
			lines,
			createdAt: now,
			updatedAt: now
		});
		title = '';
		url = '';
		lyrics = '';
	}

	function remove(song: Song) {
		if (!window.confirm(m.songs_delete_confirm({ title: song.title }))) return;
		songs = deleteSong(song.id);
	}
</script>

<svelte:head><title>{m.songs_title()} · {m.app_name()}</title></svelte:head>

<div class="container stack songs">
	<header class="stack head">
		<h1>{m.songs_title()}</h1>
		<p class="muted">{m.songs_lead()}</p>
		<p class="muted small">{m.songs_privacy()}</p>
	</header>

	<section class="stack">
		<h2>{m.songs_list_title()}</h2>
		{#if ready && songs.length === 0}
			<p class="muted">{m.songs_empty()}</p>
		{:else if songs.length > 0}
			<ul class="list">
				{#each songs as song (song.id)}
					<li class="card item">
						<div class="stack info">
							<span class="name">{song.title}</span>
							<span class="muted small">{m.songs_line_count({ count: song.lines.length })}</span>
						</div>
						<a class="btn btn--primary" href={resolve('/songs/[id]', { id: song.id })}>
							{m.songs_practice()}
						</a>
						<button type="button" class="btn" onclick={() => remove(song)}>
							{m.songs_delete()}
						</button>
					</li>
				{/each}
			</ul>
		{/if}
	</section>

	<section class="stack">
		<h2>{m.songs_add_title()}</h2>
		<form class="stack form" onsubmit={submit}>
			<div class="stack field">
				<label for="song-title">{m.songs_field_title()}</label>
				<input
					id="song-title"
					type="text"
					bind:value={title}
					placeholder={m.songs_field_title_placeholder()}
					autocomplete="off"
				/>
			</div>

			<div class="stack field">
				<label for="song-url">{m.songs_field_url()}</label>
				<input id="song-url" type="text" bind:value={url} autocomplete="off" spellcheck="false" />
				<p class="muted small">{m.songs_field_url_hint()}</p>
			</div>

			<div class="stack field">
				<label for="song-lyrics">{m.songs_field_lyrics()}</label>
				<textarea id="song-lyrics" rows="10" bind:value={lyrics} lang="ja" spellcheck="false"
				></textarea>
				<p class="muted small">{m.songs_field_lyrics_hint()}</p>
			</div>

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
				<button type="submit" class="btn btn--primary">{m.songs_save()}</button>
			</p>
		</form>
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
	textarea {
		resize: vertical;
		line-height: 1.8;
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

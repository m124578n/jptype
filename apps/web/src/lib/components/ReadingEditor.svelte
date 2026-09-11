<script lang="ts">
	import { untrack } from 'svelte';
	import { m } from '$lib/paraglide/messages';
	import { applyFix, editableToken, fixIssues, fixedLine } from '$lib/reading-edit';
	import type { SongLine } from '$lib/songs';

	/**
	 * Inline editor for one lyric line's reading (owner 2026-09-11). With tokens: one input per
	 * kanji token, kana tokens fixed; without: the whole kana line. `onsave` receives the song's
	 * lines with the fix applied to every identical line.
	 */
	let {
		line,
		lines,
		onsave,
		oncancel,
		busy = false,
		error = ''
	}: {
		line: SongLine;
		lines: readonly SongLine[];
		onsave: (next: SongLine[], fixed: SongLine) => void;
		oncancel: () => void;
		busy?: boolean;
		error?: string;
	} = $props();

	// Seeded from the line once; the editor owns the draft from then on.
	let readings = $state<string[]>(untrack(() => line.tokens?.map((t) => t.reading) ?? []));
	let text = $state(untrack(() => line.text));

	const draft = $derived(line.tokens ? fixedLine(line, { readings }) : fixedLine(line, { text }));
	const issues = $derived(fixIssues(draft));
	const changed = $derived(draft.text !== line.text);

	function submit(event: SubmitEvent) {
		event.preventDefault();
		if (issues.length > 0 || !changed) return;
		onsave(applyFix(lines, line.text, draft), draft);
	}
</script>

<form class="stack editor" onsubmit={submit} aria-label={m.songs_fix_reading()}>
	<p class="muted small lead">{m.songs_fix_reading_lead()}</p>
	{#if line.tokens}
		<div class="row tokens" lang="ja">
			{#each line.tokens as token, i (i)}
				{#if editableToken(token)}
					<label class="stack token">
						<span class="surface">{token.surface}</span>
						<input type="text" bind:value={readings[i]} autocomplete="off" spellcheck="false" />
					</label>
				{:else if token.reading === ''}
					<span class="stack token fixed muted">
						<span class="surface">{token.surface}</span>
						<span class="reading">&nbsp;</span>
					</span>
				{:else}
					<span class="stack token fixed">
						<span class="surface">{token.surface}</span>
						<span class="reading muted">{token.reading}</span>
					</span>
				{/if}
			{/each}
		</div>
	{:else}
		<label class="stack whole">
			<span class="small">{m.songs_fix_reading_line()}</span>
			<input type="text" bind:value={text} lang="ja" autocomplete="off" spellcheck="false" />
		</label>
	{/if}
	<p class="preview" lang="ja">
		<span class="muted small">{m.songs_fix_preview()}</span>
		{draft.text}
	</p>
	{#if issues.length > 0 && draft.text !== ''}
		<p class="error small" role="alert">
			{m.songs_fix_error({ chars: issues.map((i) => i.char).join(' ') })}
		</p>
	{/if}
	{#if error !== ''}
		<p class="error small" role="alert">{error}</p>
	{/if}
	<p class="row actions">
		<button
			type="submit"
			class="btn btn--small btn--primary"
			disabled={busy || issues.length > 0 || !changed}
		>
			{busy ? m.songs_saving() : m.songs_fix_save()}
		</button>
		<button type="button" class="btn btn--small" onclick={oncancel} disabled={busy}>
			{m.songs_fix_cancel()}
		</button>
	</p>
</form>

<style>
	.editor {
		gap: var(--space-3);
		width: 100%;
	}
	.lead {
		margin: 0;
	}
	.small {
		font-size: 0.875rem;
	}
	.tokens {
		flex-wrap: wrap;
		gap: var(--space-2);
		align-items: flex-end;
		justify-content: center;
	}
	.token {
		gap: var(--space-1);
		align-items: center;
	}
	.surface {
		font-size: 1.5rem;
		line-height: 1.3;
	}
	.reading {
		font-size: 0.875rem;
		min-height: 36px;
		display: inline-flex;
		align-items: center;
	}
	.whole {
		gap: var(--space-1);
	}
	input {
		font: inherit;
		font-size: 1rem;
		color: var(--fg);
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: var(--radius);
		padding: var(--space-1) var(--space-2);
		min-height: 36px;
		width: 100%;
	}
	.token input {
		width: max(5.5rem, 3.5em);
		text-align: center;
	}
	.preview {
		margin: 0;
		text-align: center;
		font-size: 1.125rem;
	}
	.preview .small {
		display: block;
	}
	.error {
		color: var(--danger);
	}
	.actions {
		justify-content: center;
		gap: var(--space-2);
	}
	.btn--small {
		min-height: 36px;
		padding-inline: var(--space-4);
		font-size: 0.875rem;
	}
</style>

<script lang="ts">
	import { untrack } from 'svelte';
	import { m } from '$lib/paraglide/messages';
	import { goto, invalidateAll } from '$app/navigation';
	import { resolve } from '$app/paths';
	import ContentMetaForm from '$lib/components/ContentMetaForm.svelte';
	import YouTubePlayer from '$lib/components/YouTubePlayer.svelte';
	import type { ContentStatus } from '$lib/contents';
	import {
		deleteContent,
		saveLines,
		setContentStatus,
		updateContent,
		type ContentInputBody,
		type LineDraft
	} from '$lib/contents-api';
	import { segment, toKana, toRomaji, loadTokenizer } from '$lib/ja';
	import { validateLines } from '$lib/songs';
	import type { PlayerController } from '$lib/youtube';

	let { data } = $props();

	// ── Metadata ───────────────────────────────────────────────────────────────────────────────
	let meta = $state<ContentInputBody>(untrack(toBody));
	let metaBusy = $state(false);
	let metaError = $state('');
	let metaNote = $state('');
	let status = $state<ContentStatus>(untrack(() => data.content.status));

	function toBody(): ContentInputBody {
		return {
			type: data.content.type,
			title: data.content.title,
			description: data.content.description,
			videoId: data.content.videoId ?? '',
			jlptLevel: data.content.jlptLevel,
			difficulty: data.content.difficulty,
			sourceType: data.content.sourceType,
			sourceUrl: data.content.sourceUrl,
			sourceName: data.content.sourceName,
			license: data.content.license,
			rightsStatus: data.content.rightsStatus
		};
	}

	async function saveMeta() {
		metaBusy = true;
		metaError = '';
		metaNote = '';
		const result = await updateContent(data.content.id, meta);
		metaBusy = false;
		if (!result.ok) {
			metaError = m.admin_contents_save_failed({ reason: result.error });
			return;
		}
		metaNote = m.admin_contents_saved();
		await invalidateAll();
	}

	async function removeContent() {
		if (!window.confirm(m.admin_contents_delete_confirm({ title: data.content.title }))) return;
		metaBusy = true;
		const result = await deleteContent(data.content.id);
		metaBusy = false;
		if (!result.ok) {
			metaError = m.admin_contents_save_failed({ reason: result.error });
			return;
		}
		await goto(resolve('/admin/contents'));
	}

	// ── Publish ────────────────────────────────────────────────────────────────────────────────
	let publishBusy = $state(false);
	let publishError = $state('');

	function publishMessage(error: string): string {
		if (error === 'rights not cleared') return m.admin_contents_publish_error_rights();
		if (error === 'no typeable line') return m.admin_contents_publish_error_lines();
		return m.admin_contents_save_failed({ reason: error });
	}

	async function togglePublish() {
		const next: ContentStatus = status === 'published' ? 'draft' : 'published';
		publishBusy = true;
		publishError = '';
		const result = await setContentStatus(data.content.id, next);
		publishBusy = false;
		if (!result.ok) {
			publishError = publishMessage(result.error);
			return;
		}
		status = result.body.status;
		await invalidateAll();
	}

	// ── Lines ──────────────────────────────────────────────────────────────────────────────────
	let lines = $state<LineDraft[]>(
		untrack(() =>
			data.lines.map((l) => ({
				startTime: l.startTime,
				endTime: l.endTime,
				originalText: l.originalText,
				kanaText: l.kanaText,
				romajiText: l.romajiText
			}))
		)
	);
	let dirty = $state(false);
	let linesBusy = $state(false);
	let linesNote = $state('');
	let linesError = $state('');

	function change() {
		dirty = true;
		linesNote = '';
	}

	/** Characters of each line the engine cannot type; the admin fixes them before publishing. */
	const issues = $derived(
		lines.map((line) =>
			line.kanaText.trim() === ''
				? [m.admin_contents_line_empty()]
				: validateLines([{ text: line.kanaText }]).map((i) => i.char)
		)
	);
	const typeable = $derived(issues.filter((i) => i.length === 0).length);

	function blank(): LineDraft {
		return { startTime: null, endTime: null, originalText: '', kanaText: '', romajiText: '' };
	}

	function move(index: number, delta: number) {
		const target = index + delta;
		if (target < 0 || target >= lines.length) return;
		const next = [...lines];
		const [item] = next.splice(index, 1);
		if (item) next.splice(target, 0, item);
		lines = next;
		change();
	}

	function removeLine(index: number) {
		lines = lines.filter((_, i) => i !== index);
		change();
	}

	function addLine() {
		lines = [...lines, blank()];
		change();
	}

	function refreshRomaji(index: number) {
		const line = lines[index];
		if (!line) return;
		line.romajiText = toRomaji(line.kanaText);
		change();
	}

	async function saveAllLines() {
		linesBusy = true;
		linesError = '';
		linesNote = '';
		const result = await saveLines(data.content.id, lines);
		linesBusy = false;
		if (!result.ok) {
			linesError = m.admin_contents_save_failed({ reason: result.error });
			return;
		}
		dirty = false;
		linesNote = m.admin_contents_lines_saved();
		await invalidateAll();
	}

	// ── Import (paste → 斷句 → 漢字→かな → ローマ字) ────────────────────────────────────────────
	let paste = $state('');
	let replaceLines = $state(true);
	let importing = $state(false);
	let importStage = $state('');
	let importError = $state('');

	async function runImport() {
		const sentences = segment(paste);
		importError = '';
		importStage = '';
		if (sentences.length === 0) {
			importError = m.admin_contents_import_empty();
			return;
		}
		importing = true;
		importStage = m.admin_contents_import_loading();
		try {
			// The dictionary (~17 MB) is fetched from our own origin on first use only.
			const tokenizer = await loadTokenizer();
			importStage = m.admin_contents_import_working({ count: sentences.length });
			const drafts: LineDraft[] = [];
			for (const sentence of sentences) {
				const { kana } = await toKana(sentence, tokenizer);
				drafts.push({
					startTime: null,
					endTime: null,
					originalText: sentence,
					kanaText: kana,
					romajiText: toRomaji(kana)
				});
			}
			lines = replaceLines ? drafts : [...lines, ...drafts];
			paste = '';
			importStage = m.admin_contents_import_done({ count: drafts.length });
			change();
		} catch {
			importError = m.admin_contents_import_failed();
			importStage = '';
		} finally {
			importing = false;
		}
	}

	// ── Player (start / end stamping, like the song timing editor) ──────────────────────────────
	let controller = $state<PlayerController | undefined>(undefined);
	let playerFailed = $state(false);

	function round2(seconds: number): number {
		return Math.round(seconds * 100) / 100;
	}

	function stamp(index: number, field: 'startTime' | 'endTime') {
		const at = controller?.currentTime();
		const line = lines[index];
		if (at === undefined || !line) return;
		line[field] = round2(at);
		change();
	}

	function playFrom(index: number) {
		const start = lines[index]?.startTime;
		if (start === null || start === undefined) return;
		controller?.seekTo(start);
		controller?.play();
	}

	/** The **saved** video id: the form may still hold an unnormalized URL. */
	const videoId = $derived(data.content.videoId ?? '');
</script>

<svelte:head
	><title>{data.content.title} · {m.admin_contents_title()} · {m.seo_site_name()}</title
	></svelte:head
>

<div class="container container--wide stack page">
	<header class="stack head">
		<a class="muted back" href={resolve('/admin/contents')}>← {m.admin_contents_title()}</a>
		<h1>{data.content.title}</h1>
		<p class="row status">
			<span class="tag"
				>{status === 'published'
					? m.admin_contents_status_published()
					: m.admin_contents_status_draft()}</span
			>
			<span class="muted small">
				{m.admin_contents_typeable({ typeable, total: lines.length })}
			</span>
			<button type="button" class="btn btn--small" disabled={publishBusy} onclick={togglePublish}>
				{status === 'published' ? m.admin_contents_unpublish() : m.admin_contents_publish()}
			</button>
			{#if status === 'published'}
				<a class="btn btn--small" href={resolve('/contents/[id]', { id: data.content.id })}>
					{m.contents_open()}
				</a>
			{/if}
		</p>
		{#if publishError !== ''}<p class="error small" role="alert">{publishError}</p>{/if}
		<p class="muted small">{m.admin_contents_rights_rule()}</p>
	</header>

	<section class="stack block" aria-labelledby="meta-title">
		<h2 id="meta-title">{m.admin_contents_meta_title()}</h2>
		<ContentMetaForm
			bind:value={meta}
			busy={metaBusy}
			error={metaError}
			note={metaNote}
			submitLabel={m.admin_contents_save()}
			onsubmit={saveMeta}
		/>
		<p>
			<button type="button" class="btn btn--small" disabled={metaBusy} onclick={removeContent}>
				{m.admin_contents_delete()}
			</button>
		</p>
	</section>

	<section class="stack block" aria-labelledby="import-title">
		<h2 id="import-title">{m.admin_contents_import_title()}</h2>
		<p class="muted small">{m.admin_contents_import_lead()}</p>
		<label class="visually-hidden" for="import-text">{m.admin_contents_import_paste()}</label>
		<textarea
			id="import-text"
			rows="6"
			bind:value={paste}
			placeholder={m.admin_contents_import_placeholder()}></textarea>
		<div class="row">
			<button type="button" class="btn btn--primary" disabled={importing} onclick={runImport}>
				{m.admin_contents_import_run()}
			</button>
			<label class="row check">
				<input type="checkbox" bind:checked={replaceLines} />
				<span class="small">{m.admin_contents_import_replace()}</span>
			</label>
			<span class="muted small" aria-live="polite">
				{#if importError !== ''}<span class="error">{importError}</span>{:else}{importStage}{/if}
			</span>
		</div>
	</section>

	{#if videoId !== ''}
		<section class="stack block" aria-labelledby="player-title">
			<h2 id="player-title">{m.admin_contents_player_title()}</h2>
			<p class="muted small">{m.admin_contents_player_lead()}</p>
			<YouTubePlayer
				{videoId}
				title={data.content.title}
				bind:controller
				onfail={() => (playerFailed = true)}
			/>
			{#if playerFailed}<p class="muted small">{m.songs_player_failed()}</p>{/if}
		</section>
	{/if}

	<section class="stack block" aria-labelledby="lines-title">
		<h2 id="lines-title">{m.admin_contents_editor_title()}</h2>
		<p class="muted small">{m.admin_contents_editor_lead()}</p>

		{#if lines.length === 0}
			<p class="card empty muted">{m.admin_contents_editor_empty()}</p>
		{:else}
			<div class="table-wrap">
				<table>
					<thead>
						<tr>
							<th scope="col" class="num">#</th>
							<th scope="col">{m.admin_contents_col_original()}</th>
							<th scope="col">{m.admin_contents_col_kana()}</th>
							<th scope="col">{m.admin_contents_col_romaji()}</th>
							<th scope="col">{m.admin_contents_col_time()}</th>
							<th scope="col">{m.admin_contents_col_actions()}</th>
						</tr>
					</thead>
					<tbody>
						{#each lines as line, i (i)}
							<tr>
								<td class="num">{i + 1}</td>
								<td>
									<label class="visually-hidden" for="original-{i}">
										{m.admin_contents_col_original()}
									</label>
									<input
										id="original-{i}"
										type="text"
										lang="ja"
										bind:value={line.originalText}
										oninput={change}
									/>
								</td>
								<td>
									<label class="visually-hidden" for="kana-{i}">
										{m.admin_contents_col_kana()}
									</label>
									<input
										id="kana-{i}"
										type="text"
										lang="ja"
										class:bad={issues[i] && issues[i].length > 0}
										bind:value={line.kanaText}
										oninput={change}
									/>
									{#if issues[i] && issues[i].length > 0}
										<span class="error small">
											{m.admin_contents_line_untypeable({ chars: issues[i].join(' ') })}
										</span>
									{/if}
								</td>
								<td>
									<label class="visually-hidden" for="romaji-{i}">
										{m.admin_contents_col_romaji()}
									</label>
									<input
										id="romaji-{i}"
										type="text"
										bind:value={line.romajiText}
										oninput={change}
									/>
									<button type="button" class="btn btn--small" onclick={() => refreshRomaji(i)}>
										{m.admin_contents_romaji_refresh()}
									</button>
								</td>
								<td class="times">
									<label class="visually-hidden" for="start-{i}">start</label>
									<input
										id="start-{i}"
										type="number"
										step="0.01"
										min="0"
										bind:value={line.startTime}
										oninput={change}
									/>
									<label class="visually-hidden" for="end-{i}">end</label>
									<input
										id="end-{i}"
										type="number"
										step="0.01"
										min="0"
										bind:value={line.endTime}
										oninput={change}
									/>
									{#if videoId !== ''}
										<span class="row stamps">
											<button
												type="button"
												class="btn btn--small"
												onclick={() => stamp(i, 'startTime')}
											>
												{m.admin_contents_fill_start()}
											</button>
											<button
												type="button"
												class="btn btn--small"
												onclick={() => stamp(i, 'endTime')}
											>
												{m.admin_contents_fill_end()}
											</button>
											<button type="button" class="btn btn--small" onclick={() => playFrom(i)}>
												{m.admin_contents_play_from()}
											</button>
										</span>
									{/if}
								</td>
								<td>
									<span class="row rowtools">
										<button
											type="button"
											class="btn btn--icon"
											aria-label={m.admin_contents_line_up()}
											title={m.admin_contents_line_up()}
											disabled={i === 0}
											onclick={() => move(i, -1)}>↑</button
										>
										<button
											type="button"
											class="btn btn--icon"
											aria-label={m.admin_contents_line_down()}
											title={m.admin_contents_line_down()}
											disabled={i === lines.length - 1}
											onclick={() => move(i, 1)}>↓</button
										>
										<button type="button" class="btn btn--small" onclick={() => removeLine(i)}>
											{m.admin_contents_line_delete()}
										</button>
									</span>
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		{/if}

		<div class="row">
			<button type="button" class="btn" onclick={addLine}>{m.admin_contents_line_add()}</button>
			<button
				type="button"
				class="btn btn--primary"
				disabled={linesBusy || !dirty}
				onclick={saveAllLines}
			>
				{m.admin_contents_save_lines()}
			</button>
			<span class="muted small" aria-live="polite">
				{#if linesError !== ''}
					<span class="error">{linesError}</span>
				{:else if linesNote !== ''}
					{linesNote}
				{:else if dirty}
					{m.admin_contents_unsaved()}
				{/if}
			</span>
		</div>
	</section>
</div>

<style>
	.page {
		gap: var(--space-12);
	}
	.head {
		gap: var(--space-2);
	}
	.back {
		text-decoration: none;
		font-size: 0.875rem;
	}
	.block {
		gap: var(--space-4);
	}
	.block h2 {
		font-size: 1.25rem;
		margin: 0;
	}
	.block p {
		margin: 0;
	}
	.small {
		font-size: 0.875rem;
	}
	.error {
		color: var(--danger);
	}
	.status {
		gap: var(--space-3);
		flex-wrap: wrap;
	}
	.tag {
		font-size: 0.75rem;
		padding: 2px var(--space-2);
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
		color: var(--fg-muted);
	}
	.check {
		gap: var(--space-2);
		cursor: pointer;
	}
	.check input {
		width: auto;
		min-height: 0;
	}
	textarea,
	input {
		font: inherit;
		color: var(--fg);
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: var(--radius);
		padding: var(--space-2) var(--space-3);
		min-height: 36px;
		width: 100%;
	}
	textarea {
		min-height: 8rem;
		resize: vertical;
	}
	input.bad {
		border-color: var(--danger);
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
		min-width: 60rem;
	}
	th,
	td {
		padding: var(--space-2) var(--space-3);
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
	.num {
		text-align: right;
		font-variant-numeric: tabular-nums;
		white-space: nowrap;
	}
	.times {
		min-width: 12rem;
	}
	.times input {
		margin-bottom: var(--space-2);
	}
	.stamps,
	.rowtools {
		gap: var(--space-2);
		flex-wrap: wrap;
	}
	.btn--small {
		min-height: 36px;
		padding-inline: var(--space-3);
		font-size: 0.875rem;
	}
	.btn--icon {
		width: 36px;
		min-height: 36px;
		padding: 0;
	}
</style>

<script lang="ts">
	import { m } from '$lib/paraglide/messages';
	import { invalidateAll } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { formatDateTime } from '$lib/format';
	import { removeAdminSong, resolveReport } from '$lib/songs-api';

	let { data } = $props();

	/** One note box per report row; keyed by report id, kept as an array (no Map in components). */
	let notes = $state<{ id: string; text: string }[]>([]);
	let busy = $state('');
	let failed = $state('');

	function noteOf(id: string): string {
		return notes.find((n) => n.id === id)?.text ?? '';
	}

	function setNote(id: string, text: string) {
		const rest = notes.filter((n) => n.id !== id);
		notes = [...rest, { id, text }];
	}

	function statusLabel(status: string): string {
		if (status === 'removed') return m.admin_status_removed();
		if (status === 'rejected') return m.admin_status_rejected();
		return m.admin_status_open();
	}

	async function resolveOne(id: string, action: 'removed' | 'rejected', title: string) {
		if (action === 'removed' && !window.confirm(m.admin_confirm_remove({ title }))) return;
		busy = id;
		failed = '';
		const ok = await resolveReport(id, action, noteOf(id));
		busy = '';
		if (!ok) {
			failed = id;
			return;
		}
		setNote(id, '');
		await invalidateAll();
	}

	async function removeOne(id: string, title: string) {
		if (!window.confirm(m.admin_confirm_remove({ title }))) return;
		busy = id;
		failed = '';
		const ok = await removeAdminSong(id, noteOf(id));
		busy = '';
		if (!ok) {
			failed = id;
			return;
		}
		setNote(id, '');
		await invalidateAll();
	}
</script>

<svelte:head><title>{m.admin_title()} · {m.app_name()}</title></svelte:head>

<div class="container container--wide stack admin">
	<header class="stack head">
		<h1>{m.admin_title()}</h1>
		<p class="muted">{m.admin_lead()}</p>
	</header>

	<section class="stack">
		<div class="row between">
			<h2>{m.admin_reports_title()}</h2>
			<span class="row">
				<a
					class="btn btn--small"
					href={resolve('/admin')}
					aria-current={data.status === 'open' ? 'true' : undefined}
				>
					{m.admin_filter_open()}
				</a>
				<a
					class="btn btn--small"
					href="{resolve('/admin')}?status=all"
					aria-current={data.status === 'all' ? 'true' : undefined}
				>
					{m.admin_filter_all()}
				</a>
			</span>
		</div>

		{#if data.reports.length === 0}
			<p class="muted">{m.admin_reports_empty()}</p>
		{:else}
			<div class="table-wrap">
				<table>
					<thead>
						<tr>
							<th scope="col">{m.admin_col_when()}</th>
							<th scope="col">{m.admin_col_song()}</th>
							<th scope="col">{m.admin_col_reporter()}</th>
							<th scope="col">{m.admin_col_claim()}</th>
							<th scope="col">{m.admin_col_status()}</th>
							<th scope="col">{m.admin_col_action()}</th>
						</tr>
					</thead>
					<tbody>
						{#each data.reports as report (report.id)}
							<tr>
								<td class="when">{formatDateTime(report.createdAt)}</td>
								<td>
									{#if report.songId && report.songTitle}
										<a href={resolve('/songs/[id]', { id: report.songId })}>{report.songTitle}</a>
									{:else}
										<span class="muted">{m.admin_song_gone()}</span>
									{/if}
									{#if report.videoId !== ''}
										<span class="muted small mono">{report.videoId}</span>
									{/if}
								</td>
								<td class="break">{report.reporterContact}</td>
								<td class="break claim">{report.claim}</td>
								<td>
									{statusLabel(report.status)}
									{#if report.adminNote}
										<span class="muted small">{report.adminNote}</span>
									{/if}
								</td>
								<td>
									{#if report.status === 'open'}
										<div class="stack actions">
											<label class="visually-hidden" for="note-{report.id}">
												{m.admin_note_label()}
											</label>
											<input
												id="note-{report.id}"
												type="text"
												value={noteOf(report.id)}
												oninput={(e) => setNote(report.id, e.currentTarget.value)}
												placeholder={m.admin_note_label()}
											/>
											<span class="row">
												<button
													type="button"
													class="btn btn--small"
													disabled={busy === report.id}
													onclick={() =>
														resolveOne(report.id, 'removed', report.songTitle ?? report.videoId)}
												>
													{m.admin_action_remove()}
												</button>
												<button
													type="button"
													class="btn btn--small"
													disabled={busy === report.id}
													onclick={() =>
														resolveOne(report.id, 'rejected', report.songTitle ?? report.videoId)}
												>
													{m.admin_action_reject()}
												</button>
											</span>
											{#if busy === report.id}
												<span class="muted small">{m.admin_working()}</span>
											{/if}
											{#if failed === report.id}
												<span class="error small">{m.admin_failed()}</span>
											{/if}
										</div>
									{/if}
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		{/if}
	</section>

	<section class="stack">
		<h2>{m.admin_songs_title()}</h2>
		<p class="muted">{m.admin_songs_lead()}</p>
		<form class="row" method="get" action={resolve('/admin')}>
			{#if data.status === 'all'}
				<input type="hidden" name="status" value="all" />
			{/if}
			<label class="visually-hidden" for="admin-q">{m.admin_songs_search()}</label>
			<input id="admin-q" type="search" name="q" value={data.q} />
			<button type="submit" class="btn">{m.admin_songs_search()}</button>
		</form>

		{#if data.q !== '' && data.songs.length === 0}
			<p class="muted">{m.admin_songs_empty()}</p>
		{:else if data.songs.length > 0}
			<div class="table-wrap">
				<table>
					<thead>
						<tr>
							<th scope="col">{m.admin_col_song()}</th>
							<th scope="col">{m.admin_col_owner()}</th>
							<th scope="col">{m.admin_col_visibility()}</th>
							<th scope="col">{m.admin_col_status()}</th>
							<th scope="col">{m.admin_col_action()}</th>
						</tr>
					</thead>
					<tbody>
						{#each data.songs as song (song.id)}
							<tr>
								<td>
									<a href={resolve('/songs/[id]', { id: song.id })}>{song.title}</a>
									<span class="muted small">{m.songs_line_count({ count: song.lineCount })}</span>
								</td>
								<td class="break mono small">{song.ownerId}</td>
								<td>
									{song.visibility === 'public'
										? m.songs_visibility_public()
										: m.songs_visibility_private()}
								</td>
								<td>
									{song.status === 'removed' ? m.admin_status_removed() : m.admin_status_open()}
									{#if song.removedReason}
										<span class="muted small">{song.removedReason}</span>
									{/if}
								</td>
								<td>
									{#if song.status === 'active'}
										<div class="stack actions">
											<label class="visually-hidden" for="reason-{song.id}">
												{m.admin_note_label()}
											</label>
											<input
												id="reason-{song.id}"
												type="text"
												value={noteOf(song.id)}
												oninput={(e) => setNote(song.id, e.currentTarget.value)}
												placeholder={m.admin_note_label()}
											/>
											<button
												type="button"
												class="btn btn--small"
												disabled={busy === song.id}
												onclick={() => removeOne(song.id, song.title)}
											>
												{m.admin_action_remove()}
											</button>
											{#if failed === song.id}
												<span class="error small">{m.admin_failed()}</span>
											{/if}
										</div>
									{/if}
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		{/if}
	</section>
</div>

<style>
	.admin {
		gap: var(--space-12);
	}
	.head {
		gap: var(--space-3);
	}
	.between {
		justify-content: space-between;
	}
	.small {
		font-size: 0.875rem;
	}
	.mono {
		font-variant-numeric: tabular-nums;
		word-break: break-all;
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
	.when {
		white-space: nowrap;
	}
	.break {
		word-break: break-word;
	}
	.claim {
		max-width: 24rem;
		white-space: pre-wrap;
	}
	.actions {
		gap: var(--space-2);
		min-width: 12rem;
	}
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
	.btn--small {
		min-height: 36px;
		padding-inline: var(--space-4);
		font-size: 0.875rem;
	}
	.error {
		color: var(--danger);
	}
</style>

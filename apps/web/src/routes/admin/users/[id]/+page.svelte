<script lang="ts">
	import { m } from '$lib/paraglide/messages';
	import { invalidateAll } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { deleteRun, reinstateUser, setRunFlag } from '$lib/admin-users-api';
	import { formatAccuracy, formatDateTime, formatDuration, formatKpm } from '$lib/format';
	import { modeLabel } from '$lib/mode-label';

	let { data } = $props();

	let busy = $state('');
	let failed = $state('');
	let reinstated = $state(false);

	const hasRecord = $derived(data.user.strikes > 0 || data.user.suspendedAt !== null);

	async function act(id: string, action: () => Promise<boolean>) {
		busy = id;
		failed = '';
		const ok = await action();
		busy = '';
		if (!ok) {
			failed = id;
			return;
		}
		await invalidateAll();
	}

	function toggleFlag(runId: string, flagged: boolean) {
		void act(runId, () => setRunFlag(runId, !flagged));
	}

	function removeRun(runId: string) {
		if (!window.confirm(m.admin_runs_delete_confirm())) return;
		void act(runId, () => deleteRun(runId));
	}

	function reinstate() {
		const ok = window.confirm(
			m.admin_user_reinstate_confirm({ name: data.user.name, strikes: data.user.strikes })
		);
		if (!ok) return;
		reinstated = false;
		void act(data.user.id, async () => {
			const done = await reinstateUser(data.user.id);
			reinstated = done;
			return done;
		});
	}
</script>

<svelte:head
	><title>{data.user.name} · {m.admin_users_title()} · {m.seo_site_name()}</title></svelte:head
>

<div class="container container--wide stack admin">
	<header class="stack head">
		<p><a href={resolve('/admin/users')}>← {m.admin_user_back()}</a></p>
		<h1 class="row who">
			{#if data.user.image}
				<img class="avatar" src={data.user.image} alt="" width="40" height="40" />
			{/if}
			{data.user.name}
		</h1>
		<p class="muted break">{data.user.email} · <span class="mono">{data.user.id}</span></p>
	</header>

	<section class="stack">
		<h2>{m.admin_user_title()}</h2>
		<dl class="facts">
			<div>
				<dt>{m.admin_users_col_joined()}</dt>
				<dd>{formatDateTime(data.user.createdAt)}</dd>
			</div>
			<div>
				<dt>{m.admin_users_col_runs()}</dt>
				<dd>{data.user.runCount}</dd>
			</div>
			<div>
				<dt>{m.admin_users_col_last()}</dt>
				<dd>
					{data.user.lastRunAt === null
						? m.admin_users_never()
						: formatDateTime(data.user.lastRunAt)}
				</dd>
			</div>
			<div>
				<dt>{m.admin_users_col_songs()}</dt>
				<dd>{data.user.songCount}</dd>
			</div>
			<div>
				<dt>{m.admin_users_col_strikes()}</dt>
				<dd>
					{data.user.strikes}
					{#if data.user.suspendedAt !== null}
						<span class="error small">{m.admin_users_suspended()}</span>
					{/if}
				</dd>
			</div>
		</dl>
		{#if hasRecord}
			<p class="row">
				<button type="button" class="btn" disabled={busy === data.user.id} onclick={reinstate}>
					{m.admin_user_reinstate()}
				</button>
				{#if failed === data.user.id}
					<span class="error small">{m.admin_failed()}</span>
				{/if}
			</p>
		{:else if reinstated}
			<p class="muted small">{m.admin_user_reinstated()}</p>
		{/if}
	</section>

	<section class="stack">
		<h2>{m.admin_runs_title({ count: data.runsLimit })}</h2>
		{#if data.runs.length === 0}
			<p class="muted">{m.admin_runs_empty()}</p>
		{:else}
			<div class="table-wrap">
				<table>
					<thead>
						<tr>
							<th scope="col">{m.me_col_when()}</th>
							<th scope="col">{m.me_col_mode()}</th>
							<th scope="col">{m.admin_runs_col_score()}</th>
							<th scope="col">{m.admin_runs_col_kpm()}</th>
							<th scope="col">{m.admin_runs_col_accuracy()}</th>
							<th scope="col">{m.admin_runs_col_duration()}</th>
							<th scope="col">{m.admin_runs_col_combo()}</th>
							<th scope="col">{m.admin_runs_col_flag()}</th>
							<th scope="col">{m.admin_col_action()}</th>
						</tr>
					</thead>
					<tbody>
						{#each data.runs as run (run.id)}
							<tr class:flagged={run.flagged}>
								<td class="when">{formatDateTime(run.createdAt)}</td>
								<td>{modeLabel(run.mode)}</td>
								<td class="num">{run.score}</td>
								<td class="num">{formatKpm(run.kpm)}</td>
								<td class="num">{formatAccuracy(run.accuracy)}</td>
								<td class="num">{formatDuration(run.durationMs)}</td>
								<td class="num">{run.maxCombo ?? '—'}</td>
								<td>
									{run.flagged ? m.admin_runs_flagged() : m.admin_runs_clean()}
									{#if run.unrankedReason === 'accuracy'}
										<span class="muted small">{m.admin_runs_unranked_accuracy()}</span>
									{/if}
								</td>
								<td>
									<div class="row actions">
										<button
											type="button"
											class="btn btn--small"
											disabled={busy === run.id}
											onclick={() => toggleFlag(run.id, run.flagged)}
										>
											{run.flagged ? m.admin_runs_unflag() : m.admin_runs_flag()}
										</button>
										<button
											type="button"
											class="btn btn--small"
											disabled={busy === run.id}
											onclick={() => removeRun(run.id)}
										>
											{m.admin_runs_delete()}
										</button>
									</div>
									{#if failed === run.id}
										<span class="error small">{m.admin_failed()}</span>
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
		gap: var(--space-10);
	}
	.head {
		gap: var(--space-3);
	}
	.who {
		gap: var(--space-3);
		align-items: center;
	}
	.avatar {
		border-radius: 50%;
	}
	.small {
		font-size: 0.875rem;
	}
	.mono {
		font-variant-numeric: tabular-nums;
	}
	.break {
		word-break: break-all;
	}
	.facts {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(10rem, 1fr));
		gap: var(--space-4);
		margin: 0;
	}
	.facts div {
		padding: var(--space-3) var(--space-4);
		border: 1px solid var(--border);
		border-radius: var(--radius-lg);
		background: var(--surface);
	}
	dt {
		font-size: 0.875rem;
		color: var(--fg-muted);
	}
	dd {
		margin: var(--space-1) 0 0;
		font-variant-numeric: tabular-nums;
	}
	dd span {
		display: block;
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
	tr.flagged td {
		color: var(--fg-muted);
	}
	.when {
		white-space: nowrap;
	}
	.num {
		font-variant-numeric: tabular-nums;
	}
	.actions {
		gap: var(--space-2);
		flex-wrap: nowrap;
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

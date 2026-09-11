<script lang="ts">
	import { m } from '$lib/paraglide/messages';
	import { resolve } from '$app/paths';
	import { formatDateTime } from '$lib/format';

	let { data } = $props();
</script>

<svelte:head><title>{m.admin_users_title()} · {m.app_name()}</title></svelte:head>

<div class="container container--wide stack admin">
	<header class="stack head">
		<h1>{m.admin_users_title()}</h1>
		<p class="muted">{m.admin_users_lead()}</p>
		<p class="row">
			<a class="btn" href={resolve('/admin')}>{m.admin_title()}</a>
			<a class="btn" href={resolve('/admin/contents')}>{m.admin_contents_title()}</a>
		</p>
	</header>

	<form class="row" method="get" action={resolve('/admin/users')}>
		<label class="visually-hidden" for="admin-user-q">{m.admin_users_search()}</label>
		<input
			id="admin-user-q"
			type="search"
			name="q"
			value={data.q}
			placeholder={m.admin_users_search_placeholder()}
		/>
		<button type="submit" class="btn">{m.admin_users_search()}</button>
	</form>

	{#if data.users.length === 0}
		<p class="muted">{m.admin_users_empty()}</p>
	{:else}
		<div class="table-wrap">
			<table>
				<thead>
					<tr>
						<th scope="col">{m.admin_users_col_user()}</th>
						<th scope="col">{m.admin_users_col_joined()}</th>
						<th scope="col">{m.admin_users_col_runs()}</th>
						<th scope="col">{m.admin_users_col_last()}</th>
						<th scope="col">{m.admin_users_col_strikes()}</th>
						<th scope="col">{m.admin_users_col_songs()}</th>
					</tr>
				</thead>
				<tbody>
					{#each data.users as u (u.id)}
						<tr>
							<td>
								<a href={resolve('/admin/users/[id]', { id: u.id })}>{u.name}</a>
								<span class="muted small break">{u.email}</span>
							</td>
							<td class="when">{formatDateTime(u.createdAt)}</td>
							<td class="num">{u.runCount}</td>
							<td class="when">
								{u.lastRunAt === null ? m.admin_users_never() : formatDateTime(u.lastRunAt)}
							</td>
							<td class="num">
								{u.strikes}
								{#if u.suspendedAt !== null}
									<span class="error small">{m.admin_users_suspended()}</span>
								{/if}
							</td>
							<td class="num">{u.songCount}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{/if}
</div>

<style>
	.admin {
		gap: var(--space-8);
	}
	.head {
		gap: var(--space-3);
	}
	.small {
		font-size: 0.875rem;
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
	.num {
		font-variant-numeric: tabular-nums;
	}
	.break {
		word-break: break-all;
	}
	input {
		font: inherit;
		color: var(--fg);
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: var(--radius);
		padding: var(--space-2) var(--space-3);
		min-height: 36px;
		max-width: 24rem;
		width: 100%;
	}
	.error {
		color: var(--danger);
	}
</style>

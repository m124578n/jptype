<script lang="ts">
	import { onMount } from 'svelte';
	import { m } from '$lib/paraglide/messages';
	import { resolve } from '$app/paths';
	import {
		achievementStatsFromHistory,
		ACHIEVEMENT_IDS,
		EMPTY_ACHIEVEMENT_STATS,
		isUnlocked,
		type AchievementId
	} from '$lib/achievements';
	import Icon from '$lib/components/Icon.svelte';
	import KanaHeatmap from '$lib/components/KanaHeatmap.svelte';
	import { formatAccuracy, formatDateTime, formatDuration, formatKpm } from '$lib/format';
	import { EMPTY_PRACTICE_SUMMARY, summarize } from '$lib/stats';
	import {
		loadHistory,
		loadKanaStats,
		loadResults,
		weakKana,
		type KanaStats,
		type LessonResults,
		type RunHistoryEntry
	} from '$lib/storage';

	let { data } = $props();

	// Anonymous fallback: whatever this browser has recorded.
	let localStats: KanaStats = $state({});
	let localResults: LessonResults = $state({});
	let localHistory: RunHistoryEntry[] = $state([]);
	/** Only read after mount, so SSR and hydration agree. */
	let localNow = $state(0);
	onMount(() => {
		if (!data.stats) {
			localStats = loadKanaStats();
			localResults = loadResults();
			localHistory = loadHistory();
			localNow = Date.now();
		}
	});

	const heat = $derived.by(() => {
		if (data.stats) {
			return Object.fromEntries(
				data.stats.kanaStats.map((s) => [s.kana, { attempts: s.attempts, errors: s.errors }])
			);
		}
		return localStats;
	});
	const weak = $derived(data.stats ? data.stats.weak : weakKana(localStats));
	const localAttempts = $derived(Object.values(localResults).reduce((a, r) => a + r.attempts, 0));

	// M4-3: practice time + 30-day averages, from D1 when signed in and from this browser's
	// rolling history otherwise (both go through the same `summarize`).
	const summary = $derived.by(() => {
		if (data.stats) return data.stats.summary;
		if (localNow === 0) return EMPTY_PRACTICE_SUMMARY;
		return summarize(
			localHistory.map((h) => ({
				at: h.at,
				durationMs: h.durationMs,
				kpm: h.kpm,
				accuracy: h.accuracy
			})),
			localNow
		);
	});

	const achievementStats = $derived.by(() => {
		if (data.stats) return data.stats.achievements;
		if (localNow === 0) return EMPTY_ACHIEVEMENT_STATS;
		return achievementStatsFromHistory(localHistory);
	});

	const achievementLabel: Record<AchievementId, () => string> = {
		first_practice: m.achv_first_practice,
		perfect: m.achv_perfect,
		lessons_10: m.achv_lessons_10,
		kpm_100: m.achv_kpm_100,
		combo_100: m.achv_combo_100
	};
	const achievementHint: Record<AchievementId, () => string> = {
		first_practice: m.achv_first_practice_hint,
		perfect: m.achv_perfect_hint,
		lessons_10: m.achv_lessons_10_hint,
		kpm_100: m.achv_kpm_100_hint,
		combo_100: m.achv_combo_100_hint
	};
	const achievementIcon: Record<
		AchievementId,
		'sparkles' | 'target' | 'list-checks' | 'zap' | 'flame'
	> = {
		first_practice: 'sparkles',
		perfect: 'target',
		lessons_10: 'list-checks',
		kpm_100: 'zap',
		combo_100: 'flame'
	};
	const achievements = $derived(
		ACHIEVEMENT_IDS.map((id) => ({ id, unlocked: isUnlocked(id, achievementStats) }))
	);
	const unlockedCount = $derived(achievements.filter((a) => a.unlocked).length);

	function modeLabel(mode: string): string {
		if (mode === 'weak') return m.me_mode_weak();
		const [kind, a, b] = mode.split(':');
		if (kind === 'timed') return `${m.nav_timed()} ${a} ${b}s`;
		return `${m.nav_learn()} ${a ?? ''}`;
	}
	/** Unread first; a notice stays visible after it is read, it is a record. */
	const unreadNotices = $derived(data.notices.filter((n) => n.readAt === null));

	function noticeTitle(kind: string): string {
		if (kind === 'song_removed') return m.notice_song_removed_title();
		if (kind === 'suspended') return m.notice_suspended_title();
		return m.notice_generic_title();
	}

	function noticeBody(kind: string): string {
		if (kind === 'song_removed') return m.notice_song_removed_body();
		if (kind === 'suspended') return m.notice_suspended_body();
		return '';
	}

	const dateFmt = new Intl.DateTimeFormat('zh-TW', {
		month: 'numeric',
		day: 'numeric',
		hour: '2-digit',
		minute: '2-digit',
		timeZone: 'Asia/Taipei'
	});
</script>

<svelte:head><title>{m.me_title()} · {m.app_name()}</title></svelte:head>

<div class="container container--wide stack me">
	<header class="stack head">
		<h1>{m.me_title()}</h1>
		{#if !data.user}
			<p class="muted">
				{m.me_anon_lead()}
				<a href={resolve('/login')}>{m.nav_login()}</a>
			</p>
		{/if}
	</header>

	{#if unreadNotices.length > 0}
		<section class="stack notices" aria-live="polite">
			<h2>{m.notice_title()}</h2>
			<ul class="list">
				{#each unreadNotices as notice (notice.id)}
					<li class="card notice">
						<strong>{noticeTitle(notice.kind)}</strong>
						<span class="muted small">{formatDateTime(notice.createdAt)}</span>
						<p>{noticeBody(notice.kind)}</p>
						{#if notice.message !== ''}
							<p class="detail">{notice.message}</p>
						{/if}
					</li>
				{/each}
			</ul>
			<form method="post" action="?/readNotices">
				<button type="submit" class="btn">{m.notice_mark_read()}</button>
			</form>
		</section>
	{/if}

	<section class="stats">
		{#if data.stats}
			<div class="card stat">
				<span class="muted">{m.me_total_runs()}</span><strong>{data.stats.totalRuns}</strong>
			</div>
			<div class="card stat">
				<span class="muted">{m.me_streak()}</span><strong
					>{m.me_days({ days: data.stats.streak })}</strong
				>
			</div>
			<div class="card stat">
				<span class="muted">{m.me_active_30()}</span><strong
					>{m.me_days({ days: data.stats.activeDays30 })}</strong
				>
			</div>
		{:else}
			<div class="card stat">
				<span class="muted">{m.me_total_runs()}</span><strong>{localAttempts}</strong>
			</div>
		{/if}
		<div class="card stat">
			<span class="muted">{m.me_weak_count()}</span><strong>{weak.length}</strong>
		</div>
		<div class="card stat">
			<span class="muted">{m.stats_today_time()}</span><strong
				>{formatDuration(summary.todayMs)}</strong
			>
		</div>
		<div class="card stat">
			<span class="muted">{m.stats_week_time()}</span><strong
				>{formatDuration(summary.weekMs)}</strong
			>
		</div>
		<div class="card stat">
			<span class="muted">{m.stats_avg_accuracy_30()}</span><strong
				>{summary.runs30 === 0 ? '—' : formatAccuracy(summary.avgAccuracy30)}</strong
			>
		</div>
		<div class="card stat">
			<span class="muted">{m.stats_avg_kpm_30()}</span><strong
				>{summary.runs30 === 0 ? '—' : formatKpm(summary.avgKpm30)}</strong
			>
		</div>
	</section>

	<section class="stack" aria-labelledby="achv-title">
		<div class="row between">
			<h2 id="achv-title">{m.achv_title()}</h2>
			<span class="muted"
				>{m.achv_progress({ unlocked: unlockedCount, total: achievements.length })}</span
			>
		</div>
		<ul class="badges">
			{#each achievements as a (a.id)}
				<li class="card badge" class:locked={!a.unlocked}>
					<span class="badge-icon" aria-hidden="true"
						><Icon name={achievementIcon[a.id]} size={22} /></span
					>
					<span class="badge-text">
						<strong>{achievementLabel[a.id]()}</strong>
						<span class="muted small">{achievementHint[a.id]()}</span>
					</span>
					<span class="visually-hidden">
						{a.unlocked ? m.achv_state_unlocked() : m.achv_state_locked()}
					</span>
				</li>
			{/each}
		</ul>
	</section>

	<section class="stack" aria-labelledby="weak-title">
		<div class="row between">
			<h2 id="weak-title">{m.me_weak_title()}</h2>
			<a class="btn btn--primary" href={resolve('/learn/weak')}>{m.me_weak_practice()}</a>
		</div>
		{#if weak.length === 0}
			<p class="muted">{m.me_weak_none()}</p>
		{:else}
			<ul class="chips" lang="ja">
				{#each weak as k (k)}<li class="chip">{k}</li>{/each}
			</ul>
		{/if}
	</section>

	<section class="stack" aria-labelledby="heat-title">
		<h2 id="heat-title">{m.me_heat_title()}</h2>
		<KanaHeatmap stats={heat} />
	</section>

	{#if data.stats}
		<section class="stack" aria-labelledby="hist-title">
			<h2 id="hist-title">{m.me_history_title()}</h2>
			{#if data.stats.recent.length === 0}
				<p class="muted">{m.me_history_none()}</p>
			{:else}
				<div class="table-wrap">
					<table>
						<thead>
							<tr>
								<th scope="col">{m.me_col_when()}</th>
								<th scope="col">{m.me_col_mode()}</th>
								<th scope="col" class="num">{m.result_score()}</th>
								<th scope="col" class="num">{m.result_kpm()}</th>
								<th scope="col" class="num">{m.result_accuracy()}</th>
							</tr>
						</thead>
						<tbody>
							{#each data.stats.recent as r (r.id)}
								<tr>
									<td class="muted">{dateFmt.format(new Date(r.createdAt))}</td>
									<td>{modeLabel(r.mode)}</td>
									<td class="num score">{r.score}</td>
									<td class="num">{formatKpm(r.kpm)}</td>
									<td class="num">{formatAccuracy(r.accuracy)}</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			{/if}
		</section>
	{/if}
</div>

<style>
	.me {
		gap: var(--space-12);
	}
	.head {
		gap: var(--space-2);
	}
	.notices .list {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
	}
	.notice {
		padding: var(--space-4) var(--space-6);
		border-color: var(--accent);
	}
	.notice p {
		margin: var(--space-2) 0 0;
	}
	.notice .small {
		font-size: 0.875rem;
	}
	.notice .detail {
		color: var(--fg-muted);
		word-break: break-word;
	}
	.stats {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
		gap: var(--space-3);
	}
	.stat {
		padding: var(--space-4) var(--space-6);
		display: flex;
		flex-direction: column;
		gap: var(--space-1);
	}
	.stat strong {
		font-size: 1.75rem;
		font-variant-numeric: tabular-nums;
	}
	.between {
		justify-content: space-between;
	}
	.badges {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
		gap: var(--space-3);
	}
	.badge {
		padding: var(--space-4);
		display: flex;
		align-items: center;
		gap: var(--space-3);
	}
	.badge-icon {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 40px;
		height: 40px;
		flex: 0 0 auto;
		border-radius: 999px;
		background: var(--accent-soft);
		color: var(--accent);
	}
	.badge-text {
		display: flex;
		flex-direction: column;
		gap: 2px;
		min-width: 0;
	}
	.badge-text .small {
		font-size: 0.8125rem;
	}
	.badge.locked {
		border-style: dashed;
	}
	.badge.locked .badge-icon {
		background: transparent;
		border: 1px solid var(--border);
		color: var(--fg-muted);
	}
	.badge.locked .badge-text strong {
		color: var(--fg-muted);
		font-weight: 500;
	}
	.visually-hidden {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip-path: inset(50%);
		white-space: nowrap;
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
		font-size: 1.25rem;
		padding: var(--space-1) var(--space-3);
		border-radius: var(--radius);
		background: var(--danger-soft);
		color: var(--danger);
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
		font-variant-numeric: tabular-nums;
	}
	th,
	td {
		padding: var(--space-3) var(--space-4);
		text-align: left;
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
		white-space: nowrap;
	}
	.score {
		font-weight: 700;
		color: var(--accent);
	}
</style>

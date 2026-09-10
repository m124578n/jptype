import { TIMED_POOL_IDS, TIMED_SECONDS, timedMode } from '@jptype/data';
import type { KvLike } from './leaderboard.ts';
import type { RunStore } from './runs/store.ts';
import { weekOf } from './week.ts';

/** Minimal R2 surface used by the cleanup job (Cloudflare R2Bucket is compatible). */
export interface R2Like {
	list(options: {
		prefix: string;
		cursor?: string;
		limit?: number;
	}): Promise<{ objects: { key: string; uploaded: Date }[]; truncated: boolean; cursor?: string }>;
	delete(keys: string | string[]): Promise<void>;
}

export const LOG_RETENTION_DAYS = 90;
const DAY_MS = 86_400_000;
const WEEK_MS = 7 * DAY_MS;

export function snapshotKey(mode: string, week: string): string {
	return `lbsnap:${mode}:${week}`;
}

/** Every leaderboard mode (timed pools × seconds). */
export function allTimedModes(): string[] {
	return TIMED_POOL_IDS.flatMap((pool) => TIMED_SECONDS.map((s) => timedMode(pool, s)));
}

/**
 * Spec §3 cron, part 1: freeze last week's top 100 of every timed mode into KV (no TTL).
 * Runs Monday 00:00 Taipei, so "last week" is the week containing `now − 7 days`.
 * Returns the week label that was snapshotted.
 */
export async function snapshotLastWeek(
	deps: { store: RunStore; kv: KvLike; now?: () => number },
	nowMs = deps.now?.() ?? Date.now()
): Promise<{ week: string; modes: number }> {
	const week = weekOf(nowMs - WEEK_MS);
	let modes = 0;
	for (const mode of allTimedModes()) {
		const rows = await deps.store.top100(mode, week);
		const entries = rows.map((r, i) => ({ ...r, rank: i + 1 }));
		await deps.kv.put(
			snapshotKey(mode, week),
			JSON.stringify({ mode, period: 'week', week, entries, computedAt: nowMs })
		);
		modes += 1;
	}
	return { week, modes };
}

/**
 * Spec §3 cron, part 2: delete raw key logs (`runs/{id}.json`) older than 90 days.
 * Returns the number of deleted objects.
 */
export async function deleteOldLogs(r2: R2Like, nowMs = Date.now()): Promise<number> {
	const cutoff = nowMs - LOG_RETENTION_DAYS * DAY_MS;
	let cursor: string | undefined;
	let deleted = 0;
	do {
		const page = await r2.list({ prefix: 'runs/', cursor, limit: 500 });
		const stale = page.objects.filter((o) => o.uploaded.getTime() < cutoff).map((o) => o.key);
		if (stale.length > 0) {
			await r2.delete(stale);
			deleted += stale.length;
		}
		cursor = page.truncated ? page.cursor : undefined;
	} while (cursor);
	return deleted;
}

import { parseMode } from '@jptype/data';
import type { LeaderboardRow, RunStore } from './runs/store.ts';
import { weekOf } from './week.ts';

export type Period = 'week' | 'all';

export interface LeaderboardEntry extends LeaderboardRow {
	rank: number;
}

export interface Leaderboard {
	mode: string;
	period: Period;
	/** ISO week label for period=week, null for all-time. */
	week: string | null;
	entries: LeaderboardEntry[];
	/** Epoch ms when this list was computed (KV cache age is visible to the UI). */
	computedAt: number;
}

export interface MyRank {
	rank: number;
	best: number;
}

/** Minimal KV surface (Cloudflare KVNamespace is compatible). */
export interface KvLike {
	get(key: string): Promise<string | null>;
	put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>;
}

export const CACHE_TTL_SECONDS = 60;

export function cacheKey(mode: string, week: string | null): string {
	return `lb:${mode}:${week ?? 'all'}`;
}

export function isPeriod(value: unknown): value is Period {
	return value === 'week' || value === 'all';
}

/**
 * Top 100 for a mode/period, cached in KV for 60 s (spec §3, §8).
 * Returns null for an unknown mode.
 */
export async function getLeaderboard(
	deps: { store: RunStore; kv: KvLike; now?: () => number },
	mode: string,
	period: Period
): Promise<Leaderboard | null> {
	if (!parseMode(mode)) return null;
	const now = deps.now?.() ?? Date.now();
	const week = period === 'week' ? weekOf(now) : null;
	const key = cacheKey(mode, week);

	const cached = await deps.kv.get(key);
	if (cached) {
		try {
			return JSON.parse(cached) as Leaderboard;
		} catch {
			// fall through and recompute
		}
	}

	const rows = await deps.store.top100(mode, week);
	const board: Leaderboard = {
		mode,
		period,
		week,
		entries: rows.map((r, i) => ({ ...r, rank: i + 1 })),
		computedAt: now
	};
	await deps.kv.put(key, JSON.stringify(board), { expirationTtl: CACHE_TTL_SECONDS });
	return board;
}

/** The viewer's own rank: from the cached list when present, otherwise counted in D1. */
export async function getMyRank(
	store: RunStore,
	board: Leaderboard,
	userId: string
): Promise<MyRank | null> {
	const inList = board.entries.find((e) => e.userId === userId);
	if (inList) return { rank: inList.rank, best: inList.best };
	const best = await store.userBest(board.mode, board.week, userId);
	if (best === null) return null;
	return { rank: await store.rankOf(board.mode, board.week, best), best };
}

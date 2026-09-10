import type { AchievementStats } from '../achievements.ts';
import { summarize, SUMMARY_DAYS, type PracticeSummary, type RunSample } from '../stats.ts';
import { DAY_MS, taipeiDate } from '../time.ts';
import type { Run } from './db/schema.ts';

export { taipeiDate };

/**
 * Consecutive practice days ending today or yesterday (Taipei). A streak is not broken
 * until a full day passes without a run.
 */
export function streak(days: Iterable<string>, nowMs: number): number {
	const set = new Set(days);
	let cursor = nowMs;
	if (!set.has(taipeiDate(cursor))) cursor -= DAY_MS;
	let n = 0;
	while (set.has(taipeiDate(cursor))) {
		n += 1;
		cursor -= DAY_MS;
	}
	return n;
}

export interface KanaStatRow {
	kana: string;
	attempts: number;
	errors: number;
}

/** Spec §7.3: weak kana = error rate > 20 % with at least 3 attempts, worst first. */
export function weakKanaFrom(stats: readonly KanaStatRow[]): string[] {
	return stats
		.filter((s) => s.attempts >= 3 && s.errors / s.attempts > 0.2)
		.sort((a, b) => b.errors / b.attempts - a.errors / a.attempts)
		.map((s) => s.kana);
}

/** Data behind /me and GET /api/me/stats. */
export interface UserStore {
	recentRuns(userId: string, limit: number): Promise<Run[]>;
	kanaStatsFor(userId: string): Promise<KanaStatRow[]>;
	/** createdAt of every run by the user since `sinceMs` (for streak / activity). */
	runTimes(userId: string, sinceMs: number): Promise<number[]>;
	totalRuns(userId: string): Promise<number>;
	/** One row per run since `sinceMs`, for practice time and the 30-day averages (M4-3). */
	runSamples(userId: string, sinceMs: number): Promise<RunSample[]>;
	/** All-time bests the achievement rules need (M4-3); `totalRuns` is filled in separately. */
	achievementTotals(userId: string): Promise<Omit<AchievementStats, 'totalRuns'>>;
}

export interface MyStats {
	recent: Run[];
	kanaStats: KanaStatRow[];
	weak: string[];
	streak: number;
	totalRuns: number;
	/** Distinct practice days in the last 30 days (Taipei). */
	activeDays30: number;
	/** Today / this week practice time and 30-day averages (M4-3). */
	summary: PracticeSummary;
	/** Input to `unlockedAchievements` (M4-3). */
	achievements: AchievementStats;
}

export async function getMyStats(
	store: UserStore,
	userId: string,
	nowMs = Date.now()
): Promise<MyStats> {
	const [recent, kanaStats, times, totalRuns, samples, totals] = await Promise.all([
		store.recentRuns(userId, 20),
		store.kanaStatsFor(userId),
		store.runTimes(userId, nowMs - 400 * DAY_MS),
		store.totalRuns(userId),
		store.runSamples(userId, nowMs - SUMMARY_DAYS * DAY_MS),
		store.achievementTotals(userId)
	]);
	const days = times.map(taipeiDate);
	const cutoff30 = taipeiDate(nowMs - 30 * DAY_MS);
	return {
		recent,
		kanaStats,
		weak: weakKanaFrom(kanaStats),
		streak: streak(days, nowMs),
		totalRuns,
		activeDays30: new Set(days.filter((d) => d > cutoff30)).size,
		summary: summarize(samples, nowMs),
		achievements: { ...totals, totalRuns }
	};
}

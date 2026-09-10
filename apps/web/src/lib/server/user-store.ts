import { and, count, desc, eq, gt, sql } from 'drizzle-orm';
import { PERFECT_MIN_KEYS } from '../achievements.ts';
import type { Db } from './db/index.ts';
import { kanaStats, runs } from './db/schema.ts';
import type { UserStore } from './me.ts';

export function d1UserStore(db: Db): UserStore {
	return {
		recentRuns: (userId, limit) =>
			db
				.select()
				.from(runs)
				.where(eq(runs.userId, userId))
				.orderBy(desc(runs.createdAt))
				.limit(limit),

		kanaStatsFor: (userId) =>
			db
				.select({ kana: kanaStats.kana, attempts: kanaStats.attempts, errors: kanaStats.errors })
				.from(kanaStats)
				.where(eq(kanaStats.userId, userId)),

		runTimes: async (userId, sinceMs) => {
			const rows = await db
				.select({ t: runs.createdAt })
				.from(runs)
				.where(and(eq(runs.userId, userId), gt(runs.createdAt, sinceMs)));
			return rows.map((r) => r.t);
		},

		totalRuns: async (userId) => {
			const [row] = await db.select({ n: count() }).from(runs).where(eq(runs.userId, userId));
			return row?.n ?? 0;
		},

		runSamples: async (userId, sinceMs) => {
			const rows = await db
				.select({
					at: runs.createdAt,
					durationMs: runs.durationMs,
					kpm: runs.kpm,
					accuracy: runs.accuracy
				})
				.from(runs)
				.where(and(eq(runs.userId, userId), gt(runs.createdAt, sinceMs)));
			return rows;
		},

		achievementTotals: async (userId) => {
			const [row] = await db
				.select({
					maxCombo: sql<number | null>`max(${runs.maxCombo})`,
					bestKpm: sql<number | null>`max(${runs.kpm})`,
					perfectRuns: sql<number>`sum(case when ${runs.accuracy} >= 1
						and ${runs.correctKeys} + ${runs.wrongKeys} >= ${PERFECT_MIN_KEYS}
						then 1 else 0 end)`
				})
				.from(runs)
				.where(eq(runs.userId, userId));
			return {
				maxCombo: row?.maxCombo ?? 0,
				bestKpm: row?.bestKpm ?? 0,
				perfectRuns: row?.perfectRuns ?? 0
			};
		}
	};
}

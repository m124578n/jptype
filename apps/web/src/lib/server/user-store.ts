import { and, count, desc, eq, gt } from 'drizzle-orm';
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
		}
	};
}

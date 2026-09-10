import { and, count, desc, eq, gt, isNotNull, sql } from 'drizzle-orm';
import type { Db } from '../db/index.ts';
import { kanaStats, runs, type NewRun } from '../db/schema.ts';

/** Persistence needed by submitRun(); implemented on D1, faked in tests. */
export interface RunStore {
	insertRun(run: NewRun): Promise<void>;
	/** Runs by `userId` with createdAt > since. */
	countRunsSince(userId: string, since: number): Promise<number>;
	upsertKanaStats(
		userId: string,
		outcomes: readonly { kana: string; error: boolean }[],
		now: number
	): Promise<void>;
	/** Score of the 100th best user for this mode/week (null when fewer than 100). */
	hundredthScore(mode: string, week: string | null): Promise<number | null>;
	/** 1-based rank of `score` among users' best scores for mode/week. */
	rankOf(mode: string, week: string | null, score: number): Promise<number>;
}

export function d1RunStore(db: Db): RunStore {
	return {
		async insertRun(run) {
			await db.insert(runs).values(run);
		},

		async countRunsSince(userId, since) {
			const [row] = await db
				.select({ n: count() })
				.from(runs)
				.where(and(eq(runs.userId, userId), gt(runs.createdAt, since)));
			return row?.n ?? 0;
		},

		async upsertKanaStats(userId, outcomes, now) {
			// Collapse repeats of the same unit within one run first.
			const agg = new Map<string, { attempts: number; errors: number }>();
			for (const o of outcomes) {
				const a = agg.get(o.kana) ?? { attempts: 0, errors: 0 };
				a.attempts += 1;
				if (o.error) a.errors += 1;
				agg.set(o.kana, a);
			}
			for (const [kana, a] of agg) {
				await db
					.insert(kanaStats)
					.values({ userId, kana, attempts: a.attempts, errors: a.errors, lastSeenAt: now })
					.onConflictDoUpdate({
						target: [kanaStats.userId, kanaStats.kana],
						set: {
							attempts: sql`${kanaStats.attempts} + ${a.attempts}`,
							errors: sql`${kanaStats.errors} + ${a.errors}`,
							lastSeenAt: now
						}
					});
			}
		},

		async hundredthScore(mode, week) {
			const rows = await db
				.select({ best: sql<number>`max(${runs.score})`.as('best') })
				.from(runs)
				.where(
					and(
						eq(runs.mode, mode),
						eq(runs.flagged, 0),
						isNotNull(runs.userId),
						week === null ? undefined : eq(runs.week, week)
					)
				)
				.groupBy(runs.userId)
				.orderBy(desc(sql`best`))
				.limit(1)
				.offset(99);
			return rows[0]?.best ?? null;
		},

		async rankOf(mode, week, score) {
			const bests = db
				.select({ best: sql<number>`max(${runs.score})`.as('best') })
				.from(runs)
				.where(
					and(
						eq(runs.mode, mode),
						eq(runs.flagged, 0),
						isNotNull(runs.userId),
						week === null ? undefined : eq(runs.week, week)
					)
				)
				.groupBy(runs.userId)
				.as('bests');
			const [row] = await db.select({ n: count() }).from(bests).where(gt(bests.best, score));
			return (row?.n ?? 0) + 1;
		}
	};
}

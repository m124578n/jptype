import { and, count, desc, eq, gt, isNotNull, isNull, sql } from 'drizzle-orm';
import type { Db } from '../db/index.ts';
import { kanaStats, runs, user, type NewRun } from '../db/schema.ts';

export interface LeaderboardRow {
	userId: string;
	name: string;
	image: string | null;
	best: number;
	kpm: number;
	accuracy: number;
}

/** Persistence needed by submitRun() / leaderboards; implemented on D1, faked in tests. */
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
	/** Spec §4 leaderboard query: best score per user, top 100. `week` null → all-time. */
	top100(mode: string, week: string | null): Promise<LeaderboardRow[]>;
	/** A user's best unflagged score for mode/week (null when none). */
	userBest(mode: string, week: string | null, userId: string): Promise<number | null>;
}

/** A run counts for the boards when it is signed in, not flagged and not under the accuracy floor. */
function rankedFilter(mode: string, week: string | null) {
	return and(
		eq(runs.mode, mode),
		eq(runs.flagged, 0),
		isNull(runs.unrankedReason),
		isNotNull(runs.userId),
		week === null ? undefined : eq(runs.week, week)
	);
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
				.where(rankedFilter(mode, week))
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
				.where(rankedFilter(mode, week))
				.groupBy(runs.userId)
				.as('bests');
			const [row] = await db.select({ n: count() }).from(bests).where(gt(bests.best, score));
			return (row?.n ?? 0) + 1;
		},

		async top100(mode, week) {
			// SQLite returns the kpm/accuracy of the row that holds max(score) (bare-column rule).
			const rows = await db
				.select({
					userId: sql<string>`${runs.userId}`,
					name: user.name,
					image: user.image,
					best: sql<number>`max(${runs.score})`.as('best'),
					kpm: runs.kpm,
					accuracy: runs.accuracy
				})
				.from(runs)
				.innerJoin(user, eq(user.id, runs.userId))
				.where(rankedFilter(mode, week))
				.groupBy(runs.userId)
				.orderBy(desc(sql`best`), desc(runs.accuracy))
				.limit(100);
			return rows.map((r) => ({ ...r, image: r.image ?? null }));
		},

		async userBest(mode, week, userId) {
			const [row] = await db
				.select({ best: sql<number | null>`max(${runs.score})` })
				.from(runs)
				.where(and(rankedFilter(mode, week), eq(runs.userId, userId)));
			return row?.best ?? null;
		}
	};
}

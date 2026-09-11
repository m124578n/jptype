/**
 * Persistence for the admin user / run console (M4-4). Implemented on D1 below, faked in the
 * service tests (same shape as `SongStore`). Nothing here reads lyrics or key logs: the console
 * shows who practised what, with which score, and whether anticheat flagged it.
 */
import { and, count, desc, eq, inArray, isNotNull, max, or, sql, type SQL } from 'drizzle-orm';
import type { Db } from '../db/index.ts';
import { contents, notices, runs, user, userStrikes, type NewNoticeRow } from '../db/schema.ts';

/** One row of the user list: the account plus what the admin needs to judge it at a glance. */
export interface AdminUserSummary {
	id: string;
	name: string;
	email: string;
	image: string | null;
	createdAt: number;
	plan: string;
	runCount: number;
	lastRunAt: number | null;
	/** Notice-and-takedown record (`user_strikes`). */
	strikes: number;
	suspendedAt: number | null;
	/** User-provided contents (songs) in the account, any status. */
	songCount: number;
}

/** One practice run as the console shows it (`runs` row, `flagged` as a boolean). */
export interface AdminRun {
	id: string;
	userId: string | null;
	mode: string;
	score: number;
	kpm: number;
	accuracy: number;
	correctKeys: number;
	wrongKeys: number;
	durationMs: number;
	maxCombo: number | null;
	week: string;
	flagged: boolean;
	/** 'accuracy' when the run was under the 90 % floor (stored, never ranked). */
	unrankedReason: string | null;
	createdAt: number;
}

export interface AdminUserStore {
	/** Name / e-mail search, newest account first. */
	searchUsers(q: string, limit: number): Promise<AdminUserSummary[]>;
	getUser(id: string): Promise<AdminUserSummary | undefined>;
	recentRuns(userId: string, limit: number): Promise<AdminRun[]>;
	getRun(id: string): Promise<AdminRun | undefined>;
	setRunFlag(id: string, flagged: boolean): Promise<void>;
	deleteRun(id: string): Promise<void>;
	/** Drop the strike record entirely (strikes 0, not suspended). */
	clearStrikes(userId: string): Promise<void>;
	insertNotice(row: NewNoticeRow): Promise<void>;
}

/** `LIKE` pattern for a free-text search; `%`, `_` and `\` in the query are literal. */
function likePattern(q: string): string {
	return `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
}

function userLike(q: string): SQL | undefined {
	if (q === '') return undefined;
	const pattern = likePattern(q);
	return or(
		sql`${user.email} LIKE ${pattern} ESCAPE '\\'`,
		sql`${user.name} LIKE ${pattern} ESCAPE '\\'`
	);
}

function toRun(row: typeof runs.$inferSelect): AdminRun {
	return {
		id: row.id,
		userId: row.userId ?? null,
		mode: row.mode,
		score: row.score,
		kpm: row.kpm,
		accuracy: row.accuracy,
		correctKeys: row.correctKeys,
		wrongKeys: row.wrongKeys,
		durationMs: row.durationMs,
		maxCombo: row.maxCombo ?? null,
		week: row.week,
		flagged: row.flagged === 1,
		unrankedReason: row.unrankedReason ?? null,
		createdAt: row.createdAt
	};
}

/** D1 caps the bound parameters per statement; `IN (...)` lists stay well under it. */
const ID_BATCH = 80;

export function d1AdminUserStore(db: Db): AdminUserStore {
	/** The plain account columns; `created_at` read as the raw epoch ms it is stored as. */
	function accounts(where: SQL | undefined, limit: number) {
		return db
			.select({
				id: user.id,
				name: user.name,
				email: user.email,
				image: user.image,
				createdAt: sql<number>`${user.createdAt}`,
				plan: user.plan
			})
			.from(user)
			.where(where)
			.orderBy(desc(user.createdAt))
			.limit(limit);
	}

	/** Run, strike and song aggregates for a page of users, a few queries per 80 ids. */
	async function summaries(
		rows: Awaited<ReturnType<typeof accounts>>
	): Promise<AdminUserSummary[]> {
		const runStats = new Map<string, { n: number; last: number | null }>();
		const strikeRows = new Map<string, { strikes: number; suspendedAt: number | null }>();
		const songCounts = new Map<string, number>();
		const ids = rows.map((r) => r.id);
		for (let i = 0; i < ids.length; i += ID_BATCH) {
			const part = ids.slice(i, i + ID_BATCH);
			const [runRows, strikes, songs] = await Promise.all([
				db
					.select({ userId: runs.userId, n: count(), last: max(runs.createdAt) })
					.from(runs)
					.where(and(isNotNull(runs.userId), inArray(runs.userId, part)))
					.groupBy(runs.userId),
				db.select().from(userStrikes).where(inArray(userStrikes.userId, part)),
				db
					.select({ ownerId: contents.ownerId, n: count() })
					.from(contents)
					.where(and(isNotNull(contents.ownerId), inArray(contents.ownerId, part)))
					.groupBy(contents.ownerId)
			]);
			for (const r of runRows) {
				if (r.userId) runStats.set(r.userId, { n: Number(r.n), last: r.last ?? null });
			}
			for (const s of strikes) {
				strikeRows.set(s.userId, { strikes: s.strikes, suspendedAt: s.suspendedAt ?? null });
			}
			for (const s of songs) if (s.ownerId) songCounts.set(s.ownerId, Number(s.n));
		}
		return rows.map((r) => ({
			id: r.id,
			name: r.name,
			email: r.email,
			image: r.image ?? null,
			createdAt: Number(r.createdAt),
			plan: r.plan ?? 'free',
			runCount: runStats.get(r.id)?.n ?? 0,
			lastRunAt: runStats.get(r.id)?.last ?? null,
			strikes: strikeRows.get(r.id)?.strikes ?? 0,
			suspendedAt: strikeRows.get(r.id)?.suspendedAt ?? null,
			songCount: songCounts.get(r.id) ?? 0
		}));
	}

	return {
		async searchUsers(q, limit) {
			return summaries(await accounts(userLike(q), limit));
		},

		async getUser(id) {
			const [found] = await summaries(await accounts(eq(user.id, id), 1));
			return found;
		},

		async recentRuns(userId, limit) {
			const rows = await db
				.select()
				.from(runs)
				.where(eq(runs.userId, userId))
				.orderBy(desc(runs.createdAt))
				.limit(limit);
			return rows.map(toRun);
		},

		async getRun(id) {
			const [row] = await db.select().from(runs).where(eq(runs.id, id)).limit(1);
			return row ? toRun(row) : undefined;
		},

		async setRunFlag(id, flagged) {
			await db
				.update(runs)
				.set({ flagged: flagged ? 1 : 0 })
				.where(eq(runs.id, id));
		},

		async deleteRun(id) {
			await db.delete(runs).where(eq(runs.id, id));
		},

		async clearStrikes(userId) {
			await db.delete(userStrikes).where(eq(userStrikes.userId, userId));
		},

		async insertNotice(row) {
			await db.insert(notices).values(row);
		}
	};
}

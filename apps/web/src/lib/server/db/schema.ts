import { sql } from 'drizzle-orm';
import { index, integer, primaryKey, real, sqliteTable, text } from 'drizzle-orm/sqlite-core';

// Better Auth generates `user`, `session`, `account`, `verification` (spec §4).
// Those are added in M2 via `npx @better-auth/cli generate`; `runs.userId`
// gets its FK to `user.id` at that point.

/** One practice run or timed race (spec §4). */
export const runs = sqliteTable(
	'runs',
	{
		id: text('id').primaryKey(), // ulid
		userId: text('user_id'), // null → anonymous, not ranked
		mode: text('mode').notNull(), // 'lesson:hira-a' | 'timed:allhira:60' | ...
		kpm: integer('kpm').notNull(),
		accuracy: real('accuracy').notNull(), // 0..1
		score: integer('score').notNull(),
		correctKeys: integer('correct_keys').notNull(),
		wrongKeys: integer('wrong_keys').notNull(),
		durationMs: integer('duration_ms').notNull(),
		week: text('week').notNull(), // 'YYYY-Www' in Asia/Taipei
		flagged: integer('flagged').notNull().default(0), // 1 → anticheat suspect
		createdAt: integer('created_at').notNull() // epoch ms
	},
	(t) => [
		index('runs_lb').on(t.mode, t.week, sql`${t.score} DESC`),
		index('runs_user').on(t.userId, sql`${t.createdAt} DESC`)
	]
);

/** Per-user, per-kana attempt stats for the weak-spot heatmap / SRS (spec §4, §7.3). */
export const kanaStats = sqliteTable(
	'kana_stats',
	{
		userId: text('user_id').notNull(),
		kana: text('kana').notNull(), // one unit: 'か' 'きゃ' 'っか'
		attempts: integer('attempts').notNull().default(0),
		errors: integer('errors').notNull().default(0),
		lastSeenAt: integer('last_seen_at').notNull()
	},
	(t) => [primaryKey({ columns: [t.userId, t.kana] })]
);

export type Run = typeof runs.$inferSelect;
export type NewRun = typeof runs.$inferInsert;
export type KanaStat = typeof kanaStats.$inferSelect;

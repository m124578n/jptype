/**
 * Persistence for the content analytics counters (M4-4「分析事件」). Implemented on D1 below,
 * faked in the service tests. Rows are daily counts per content and kind — never a person.
 */
import { and, gte, inArray, sql, sum } from 'drizzle-orm';
import type { Db } from '../db/index.ts';
import { contentEventsDaily } from '../db/schema.ts';

export const EVENT_KINDS = ['view', 'start', 'complete'] as const;
export type EventKind = (typeof EVENT_KINDS)[number];

export function isEventKind(value: unknown): value is EventKind {
	return EVENT_KINDS.includes(value as EventKind);
}

/** Totals of one content over a window, plus the derived conversion. */
export interface ContentStats {
	views: number;
	starts: number;
	completes: number;
	/** completes / starts, or null when nothing was started. */
	conversion: number | null;
}

export interface EventStore {
	/** `count += 1` for (day, content, kind), inserting the row on first sight. */
	bump(day: string, contentId: string, kind: EventKind): Promise<void>;
	/** Per-content totals for the listed ids on or after `sinceDay` ('YYYY-MM-DD'). */
	totals(
		contentIds: readonly string[],
		sinceDay: string
	): Promise<Map<string, Record<EventKind, number>>>;
}

/** D1 caps the bound parameters per statement; `IN (...)` lists are split accordingly. */
const ID_BATCH = 80;

export function d1EventStore(db: Db): EventStore {
	return {
		async bump(day, contentId, kind) {
			await db
				.insert(contentEventsDaily)
				.values({ day, contentId, kind, count: 1 })
				.onConflictDoUpdate({
					target: [contentEventsDaily.day, contentEventsDaily.contentId, contentEventsDaily.kind],
					set: { count: sql`${contentEventsDaily.count} + 1` }
				});
		},

		async totals(contentIds, sinceDay) {
			const out = new Map<string, Record<EventKind, number>>();
			for (let i = 0; i < contentIds.length; i += ID_BATCH) {
				const part = contentIds.slice(i, i + ID_BATCH);
				if (part.length === 0) continue;
				const rows = await db
					.select({
						contentId: contentEventsDaily.contentId,
						kind: contentEventsDaily.kind,
						n: sum(contentEventsDaily.count)
					})
					.from(contentEventsDaily)
					.where(
						and(inArray(contentEventsDaily.contentId, part), gte(contentEventsDaily.day, sinceDay))
					)
					.groupBy(contentEventsDaily.contentId, contentEventsDaily.kind);
				for (const row of rows) {
					if (!isEventKind(row.kind)) continue;
					const totals = out.get(row.contentId) ?? { view: 0, start: 0, complete: 0 };
					totals[row.kind] = Number(row.n ?? 0);
					out.set(row.contentId, totals);
				}
			}
			return out;
		}
	};
}

/**
 * Content analytics (M4-4「分析事件」): three events per content — `view` (the practice page
 * was served), `start` (the first key of a run) and `complete` (a run finished) — kept as
 * daily counters, so the admin console can show "how many who start actually finish" per
 * content. Pure functions over the stores, unit-tested against fakes.
 *
 * What is deliberately *not* here: no user id, no session id, no IP, no per-event rows. A
 * counter cannot be joined back to a person, which is the whole point (DECISIONS「分析事件」).
 * Only published platform content is counted: a private song id must not become guessable by
 * bumping it, and drafts are not reachable anyway.
 */
import { DAY_MS, taipeiDate } from '../../time.ts';
import type { ContentStore } from '../contents/store.ts';
import { isEventKind, type ContentStats, type EventKind, type EventStore } from './store.ts';

export interface EventDeps {
	events: EventStore;
	contents: Pick<ContentStore, 'getContent'>;
	now?: () => number;
}

export type Result<T> = { ok: true; body: T } | { ok: false; status: 400 | 404; error: string };

/** The admin console sums the last 30 days (today included). */
export const STATS_DAYS = 30;

export interface EventInput {
	contentId: string;
	kind: EventKind;
}

/** POST /api/events body: `{ contentId, kind }`. */
export function parseEventInput(raw: unknown): EventInput | string {
	if (!raw || typeof raw !== 'object') return 'body must be an object';
	const b = raw as Record<string, unknown>;
	if (typeof b.contentId !== 'string' || b.contentId === '' || b.contentId.length > 64) {
		return 'contentId invalid';
	}
	if (!isEventKind(b.kind)) return 'kind invalid';
	return { contentId: b.contentId, kind: b.kind };
}

/**
 * Count one event for a published platform content; anything else is a 404 that reveals
 * nothing (same answer as for an id that does not exist).
 */
export async function recordEvent(
	input: EventInput,
	deps: EventDeps
): Promise<Result<{ counted: true }>> {
	const content = await deps.contents.getContent(input.contentId);
	if (!content || content.ownerId !== null || content.status !== 'published') {
		return { ok: false, status: 404, error: 'content not found' };
	}
	const now = deps.now?.() ?? Date.now();
	await deps.events.bump(taipeiDate(now), input.contentId, input.kind);
	return { ok: true, body: { counted: true } };
}

/** First day of the window: today minus (days − 1), in Taipei. */
export function windowStart(nowMs: number, days = STATS_DAYS): string {
	return taipeiDate(nowMs - (days - 1) * DAY_MS);
}

export function toStats(totals: Record<EventKind, number> | undefined): ContentStats {
	const views = totals?.view ?? 0;
	const starts = totals?.start ?? 0;
	const completes = totals?.complete ?? 0;
	return {
		views,
		starts,
		completes,
		conversion: starts === 0 ? null : Math.min(1, completes / starts)
	};
}

/** Stats of the listed contents over the last `STATS_DAYS` days, every id present. */
export async function contentStats(
	contentIds: readonly string[],
	deps: Pick<EventDeps, 'events' | 'now'>
): Promise<Record<string, ContentStats>> {
	const now = deps.now?.() ?? Date.now();
	const totals = await deps.events.totals(contentIds, windowStart(now));
	return Object.fromEntries(contentIds.map((id) => [id, toStats(totals.get(id))]));
}

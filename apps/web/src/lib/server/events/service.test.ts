import { describe, expect, it } from 'vitest';
import type { ContentRecord } from '../contents/store.ts';
import {
	contentStats,
	parseEventInput,
	recordEvent,
	toStats,
	windowStart,
	type EventDeps
} from './service.ts';
import type { EventKind, EventStore } from './store.ts';

const NOW = Date.parse('2026-09-11T03:00:00Z'); // 2026-09-11 11:00 Taipei

function content(over: Partial<ContentRecord> = {}): ContentRecord {
	return {
		id: 'C1',
		type: 'anime',
		title: 'テスト',
		description: '',
		videoId: null,
		jlptLevel: 'N5',
		difficulty: 'easy',
		status: 'published',
		sourceType: 'original',
		sourceUrl: '',
		sourceName: '',
		license: '',
		rightsStatus: 'cleared',
		createdBy: 'admin1',
		ownerId: null,
		publicConsentAt: null,
		removedReason: null,
		createdAt: NOW,
		updatedAt: NOW,
		...over
	};
}

function fake(contents: ContentRecord[] = [content()]) {
	/** `${day}|${contentId}|${kind}` → count */
	const rows = new Map<string, number>();
	const events: EventStore = {
		bump: async (day, contentId, kind) => {
			const key = `${day}|${contentId}|${kind}`;
			rows.set(key, (rows.get(key) ?? 0) + 1);
		},
		totals: async (ids, sinceDay) => {
			const out = new Map<string, Record<EventKind, number>>();
			for (const [key, n] of rows) {
				const [day, id, kind] = key.split('|') as [string, string, EventKind];
				if (day < sinceDay || !ids.includes(id)) continue;
				const t = out.get(id) ?? { view: 0, start: 0, complete: 0 };
				t[kind] += n;
				out.set(id, t);
			}
			return out;
		}
	};
	const deps: EventDeps = {
		events,
		contents: { getContent: async (id) => contents.find((c) => c.id === id) },
		now: () => NOW
	};
	return { deps, rows };
}

describe('parseEventInput', () => {
	it('wants a content id and a known kind', () => {
		expect(parseEventInput({ contentId: 'C1', kind: 'start' })).toEqual({
			contentId: 'C1',
			kind: 'start'
		});
		expect(parseEventInput({ contentId: 'C1', kind: 'click' })).toMatch(/kind/);
		expect(parseEventInput({ contentId: '', kind: 'view' })).toMatch(/contentId/);
		expect(parseEventInput('x')).toMatch(/object/);
	});
});

describe('recordEvent', () => {
	it('bumps the Taipei day counter of a published platform content', async () => {
		const f = fake();
		await recordEvent({ contentId: 'C1', kind: 'view' }, f.deps);
		await recordEvent({ contentId: 'C1', kind: 'view' }, f.deps);
		await recordEvent({ contentId: 'C1', kind: 'start' }, f.deps);
		expect([...f.rows]).toEqual([
			['2026-09-11|C1|view', 2],
			['2026-09-11|C1|start', 1]
		]);
	});

	it('404s a draft, a user-provided content and an unknown id alike', async () => {
		const f = fake([content({ id: 'D', status: 'draft' }), content({ id: 'S', ownerId: 'u1' })]);
		for (const id of ['D', 'S', 'nope']) {
			expect(await recordEvent({ contentId: id, kind: 'view' }, f.deps)).toMatchObject({
				ok: false,
				status: 404
			});
		}
		expect(f.rows.size).toBe(0);
	});
});

describe('stats', () => {
	it('starts the 30-day window 29 days ago, Taipei', () => {
		expect(windowStart(NOW)).toBe('2026-08-13');
		expect(windowStart(NOW, 1)).toBe('2026-09-11');
	});

	it('derives the conversion and caps it at 1', () => {
		expect(toStats(undefined)).toEqual({ views: 0, starts: 0, completes: 0, conversion: null });
		expect(toStats({ view: 10, start: 4, complete: 1 }).conversion).toBe(0.25);
		expect(toStats({ view: 0, start: 2, complete: 5 }).conversion).toBe(1);
	});

	it('sums only the window and answers for every id asked', async () => {
		const f = fake();
		f.rows.set('2026-08-12|C1|start', 9); // the day before the window
		f.rows.set('2026-08-13|C1|start', 2);
		f.rows.set('2026-09-11|C1|start', 2);
		f.rows.set('2026-09-11|C1|complete', 3);
		f.rows.set('2026-09-11|C1|view', 7);
		const stats = await contentStats(['C1', 'C2'], f.deps);
		expect(stats.C1).toEqual({ views: 7, starts: 4, completes: 3, conversion: 0.75 });
		expect(stats.C2).toEqual({ views: 0, starts: 0, completes: 0, conversion: null });
	});
});

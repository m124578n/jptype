import { beforeEach, describe, expect, it } from 'vitest';
import {
	applyOutcomes,
	hashLine,
	loadReview,
	missedLines,
	recentSubjects,
	recordLineOutcomes,
	reviewErrorCount,
	saveReview,
	type ReviewStore
} from './review.ts';
import type { LessonResults } from './storage.ts';

class MemoryStorage implements Storage {
	private map = new Map<string, string>();
	get length() {
		return this.map.size;
	}
	clear() {
		this.map.clear();
	}
	getItem(key: string) {
		return this.map.get(key) ?? null;
	}
	key(i: number) {
		return [...this.map.keys()][i] ?? null;
	}
	removeItem(key: string) {
		this.map.delete(key);
	}
	setItem(key: string, value: string) {
		this.map.set(key, value);
	}
}

// Made-up kana lines, like every other test in this repo.
const A = 'あさひ';
const B = 'ゆきのひ';
const C = 'かぜとみず';
/** The same keys `recordResult` uses. */
const contentSubject = (id: string) => `content:${id}`;
const SUBJECT = contentSubject('c1');

beforeEach(() => {
	globalThis.localStorage = new MemoryStorage();
});

describe('hashLine', () => {
	it('is stable and distinguishes different text', () => {
		expect(hashLine(A)).toBe(hashLine(A));
		expect(hashLine(A)).not.toBe(hashLine(B));
		expect(hashLine(A)).toMatch(/^[0-9a-f]{8}$/);
	});
});

describe('applyOutcomes', () => {
	it('records errors, attempts and the last practice time', () => {
		const store = applyOutcomes(
			{},
			SUBJECT,
			[
				{ text: A, errors: 2 },
				{ text: B, errors: 0 }
			],
			{ title: '朝', now: 1000 }
		);
		const entry = store[SUBJECT];
		expect(entry?.title).toBe('朝');
		expect(entry?.updatedAt).toBe(1000);
		expect(entry?.lines).toEqual([
			{ hash: hashLine(A), errors: 2, totalErrors: 2, attempts: 1, lastAt: 1000 },
			{ hash: hashLine(B), errors: 0, totalErrors: 0, attempts: 1, lastAt: 1000 }
		]);
	});

	it('accumulates across runs and keeps the latest run as the current state', () => {
		const first = applyOutcomes({}, SUBJECT, [{ text: A, errors: 3 }], { now: 1000 });
		const second = applyOutcomes(first, SUBJECT, [{ text: A, errors: 1 }], { now: 2000 });
		expect(second[SUBJECT]?.lines[0]).toEqual({
			hash: hashLine(A),
			errors: 1,
			totalErrors: 4,
			attempts: 2,
			lastAt: 2000
		});
	});

	it('leaves lines the run never reached untouched', () => {
		const first = applyOutcomes(
			{},
			SUBJECT,
			[
				{ text: A, errors: 1 },
				{ text: B, errors: 2 }
			],
			{ now: 1000 }
		);
		const second = applyOutcomes(first, SUBJECT, [{ text: A, errors: 0 }], { now: 2000 });
		expect(second[SUBJECT]?.lines[1]).toEqual(first[SUBJECT]?.lines[1]);
	});

	it('keeps the stored title when a later run does not supply one, and ignores empty lines', () => {
		const first = applyOutcomes({}, SUBJECT, [{ text: A, errors: 1 }], { title: '朝', now: 1 });
		const second = applyOutcomes(first, SUBJECT, [{ text: '', errors: 5 }], { now: 2 });
		expect(second[SUBJECT]?.title).toBe('朝');
		expect(second[SUBJECT]?.lines).toHaveLength(1);
	});

	it('does not mutate the store it is given', () => {
		const first = applyOutcomes({}, SUBJECT, [{ text: A, errors: 1 }], { now: 1000 });
		const snapshot = JSON.stringify(first);
		applyOutcomes(first, SUBJECT, [{ text: A, errors: 0 }], { now: 2000 });
		expect(JSON.stringify(first)).toBe(snapshot);
	});

	it('drops the least recently practised subjects past the cap', () => {
		let store: ReviewStore = {};
		for (let i = 0; i < 45; i++) {
			store = applyOutcomes(store, contentSubject(`c${i}`), [{ text: A, errors: 1 }], {
				now: 1000 + i
			});
		}
		const subjects = Object.keys(store);
		expect(subjects).toHaveLength(40);
		expect(subjects).not.toContain(contentSubject('c0'));
		expect(subjects).toContain(contentSubject('c44'));
	});
});

describe('missedLines', () => {
	const store = applyOutcomes(
		{},
		SUBJECT,
		[
			{ text: A, errors: 2 },
			{ text: B, errors: 0 },
			{ text: C, errors: 1 }
		],
		{ now: 1000 }
	);

	it('returns only lines whose latest run had errors, in content order', () => {
		expect(missedLines(store, SUBJECT, [A, B, C])).toEqual([
			{ text: A, index: 0, errors: 2 },
			{ text: C, index: 2, errors: 1 }
		]);
	});

	it('ignores lines that are no longer part of the content', () => {
		expect(missedLines(store, SUBJECT, [B, C])).toEqual([{ text: C, index: 1, errors: 1 }]);
	});

	it('asks for a repeated line only once', () => {
		expect(missedLines(store, SUBJECT, [A, B, A])).toEqual([{ text: A, index: 0, errors: 2 }]);
	});

	it('is empty for an unknown subject and after a clean run', () => {
		expect(missedLines(store, contentSubject('other'), [A])).toEqual([]);
		const clean = applyOutcomes(store, SUBJECT, [{ text: A, errors: 0 }], { now: 2000 });
		expect(missedLines(clean, SUBJECT, [A, B, C])).toEqual([{ text: C, index: 2, errors: 1 }]);
	});
});

describe('reviewErrorCount', () => {
	it('reports the errors of the latest run, or 0', () => {
		const store = applyOutcomes({}, SUBJECT, [{ text: A, errors: 4 }], { now: 1 });
		expect(reviewErrorCount(store, SUBJECT, A)).toBe(4);
		expect(reviewErrorCount(store, SUBJECT, B)).toBe(0);
		expect(reviewErrorCount(store, SUBJECT, '')).toBe(0);
	});
});

describe('recentSubjects', () => {
	const results: LessonResults = {
		'hira-a': { best: { score: 90, kpm: 100, accuracy: 1 }, attempts: 3, lastAt: 5000 },
		'content:c1': { best: { score: 80, kpm: 90, accuracy: 0.9 }, attempts: 2, lastAt: 3000 },
		'song:s1': { best: { score: 70, kpm: 80, accuracy: 0.9 }, attempts: 1, lastAt: 4000 },
		'timed:allhira:60': { best: { score: 60, kpm: 70, accuracy: 0.9 }, attempts: 1, lastAt: 6000 }
	};

	it('keeps content and song results only, newest first, with the remembered titles', () => {
		const store = applyOutcomes({}, 'song:s1', [{ text: A, errors: 0 }], {
			title: '雪の日',
			now: 4000
		});
		expect(recentSubjects(store, results)).toEqual([
			{
				subject: 'song:s1',
				kind: 'song',
				id: 's1',
				title: '雪の日',
				best: 70,
				attempts: 1,
				lastAt: 4000
			},
			{
				subject: 'content:c1',
				kind: 'content',
				id: 'c1',
				title: '',
				best: 80,
				attempts: 2,
				lastAt: 3000
			}
		]);
	});

	it('honours the limit', () => {
		expect(recentSubjects({}, results, 1)).toHaveLength(1);
	});
});

describe('localStorage round trip', () => {
	it('starts empty and survives a save/load', () => {
		expect(loadReview()).toEqual({});
		const store = recordLineOutcomes(SUBJECT, [{ text: A, errors: 2 }], { title: '朝', now: 10 });
		expect(loadReview()).toEqual(store);
		expect(missedLines(loadReview(), SUBJECT, [A])).toHaveLength(1);
	});

	it('ignores corrupted or foreign data', () => {
		localStorage.setItem('jptype:review', '{not json');
		expect(loadReview()).toEqual({});
		localStorage.setItem('jptype:review', JSON.stringify({ [SUBJECT]: { lines: 'nope' } }));
		expect(loadReview()).toEqual({});
		localStorage.setItem(
			'jptype:review',
			JSON.stringify({ [SUBJECT]: { title: 7, lines: [{ hash: 'x' }, null], updatedAt: 'no' } })
		);
		expect(loadReview()).toEqual({ [SUBJECT]: { title: '', lines: [], updatedAt: 0 } });
	});

	it('keeps its own key, not the results one', () => {
		saveReview({ [SUBJECT]: { title: '', lines: [], updatedAt: 1 } });
		expect(localStorage.getItem('jptype:results')).toBeNull();
		expect(localStorage.getItem('jptype:review')).not.toBeNull();
	});
});

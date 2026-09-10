import { describe, expect, it } from 'vitest';
import { EMPTY_PRACTICE_SUMMARY, summarize, type RunSample } from './stats.ts';

const T = (s: string) => Date.parse(s);
// 2026-09-10 11:00 Taipei, a Thursday: the ISO week runs Mon 09-07 … Sun 09-13.
const NOW = T('2026-09-10T03:00:00Z');

const run = (at: number, durationMs: number, kpm = 100, accuracy = 1): RunSample => ({
	at,
	durationMs,
	kpm,
	accuracy
});

describe('summarize', () => {
	it('is all zeroes without runs', () => {
		expect(summarize([], NOW)).toEqual(EMPTY_PRACTICE_SUMMARY);
	});

	it('sums today and this week on the Taipei calendar', () => {
		const s = summarize(
			[
				run(T('2026-09-10T01:00:00Z'), 60_000), // today
				run(T('2026-09-09T16:30:00Z'), 30_000), // 2026-09-10 00:30 Taipei → also today
				run(T('2026-09-08T02:00:00Z'), 45_000), // Tuesday, same week
				run(T('2026-09-06T02:00:00Z'), 90_000) // Sunday, previous ISO week
			],
			NOW
		);
		expect(s.todayMs).toBe(90_000);
		expect(s.weekMs).toBe(135_000);
		expect(s.runs30).toBe(4);
	});

	it('averages accuracy and kpm over the window', () => {
		const s = summarize(
			[run(T('2026-09-10T01:00:00Z'), 1000, 120, 1), run(T('2026-09-05T01:00:00Z'), 1000, 80, 0.8)],
			NOW
		);
		expect(s.avgKpm30).toBe(100);
		expect(s.avgAccuracy30).toBeCloseTo(0.9, 10);
	});

	it('ignores samples older than 30 days', () => {
		const s = summarize([run(T('2026-07-01T01:00:00Z'), 60_000, 200, 1)], NOW);
		expect(s).toEqual(EMPTY_PRACTICE_SUMMARY);
	});
});

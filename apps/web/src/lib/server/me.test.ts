import { describe, expect, it } from 'vitest';
import { getMyStats, streak, taipeiDate, weakKanaFrom, type UserStore } from './me.ts';

const T = (s: string) => Date.parse(s);

describe('taipeiDate', () => {
	it('uses Taipei wall-clock dates', () => {
		expect(taipeiDate(T('2026-09-10T15:59:00Z'))).toBe('2026-09-10'); // 23:59 Taipei
		expect(taipeiDate(T('2026-09-10T16:00:00Z'))).toBe('2026-09-11'); // 00:00 next day
	});
});

describe('streak', () => {
	const now = T('2026-09-10T03:00:00Z'); // 2026-09-10 11:00 Taipei

	it('counts consecutive days ending today', () => {
		expect(streak(['2026-09-08', '2026-09-09', '2026-09-10'], now)).toBe(3);
	});

	it('still counts when today has no run yet (ends yesterday)', () => {
		expect(streak(['2026-09-08', '2026-09-09'], now)).toBe(2);
	});

	it('is broken by a missing day', () => {
		expect(streak(['2026-09-07', '2026-09-08', '2026-09-10'], now)).toBe(1);
		expect(streak(['2026-09-07', '2026-09-08'], now)).toBe(0);
		expect(streak([], now)).toBe(0);
	});
});

describe('weakKanaFrom', () => {
	it('applies the 20 % / 3 attempts rule and sorts worst first', () => {
		expect(
			weakKanaFrom([
				{ kana: 'し', attempts: 3, errors: 2 },
				{ kana: 'ち', attempts: 10, errors: 3 },
				{ kana: 'か', attempts: 2, errors: 2 },
				{ kana: 'あ', attempts: 10, errors: 2 }
			])
		).toEqual(['し', 'ち']);
	});
});

describe('getMyStats', () => {
	it('assembles recent runs, stats, weak list, streak and activity', async () => {
		const now = T('2026-09-10T03:00:00Z');
		const store: UserStore = {
			recentRuns: async () => [],
			kanaStatsFor: async () => [{ kana: 'し', attempts: 4, errors: 3 }],
			runTimes: async () => [
				T('2026-09-10T01:00:00Z'),
				T('2026-09-09T01:00:00Z'),
				T('2026-09-09T02:00:00Z'),
				T('2026-07-01T01:00:00Z')
			],
			totalRuns: async () => 12
		};
		const s = await getMyStats(store, 'u', now);
		expect(s.weak).toEqual(['し']);
		expect(s.streak).toBe(2);
		expect(s.activeDays30).toBe(2);
		expect(s.totalRuns).toBe(12);
	});
});

import { describe, expect, it } from 'vitest';
import { score, type KeyEvent } from '../src/index.ts';

const ev = (ok: boolean, t = 0): KeyEvent => ({ t, key: 'a', ok });

describe('score', () => {
	it('returns zeros for an empty log (accuracy is 0, not NaN)', () => {
		expect(score([], 60_000)).toEqual({
			kpm: 0,
			accuracy: 0,
			score: 0,
			correctKeys: 0,
			wrongKeys: 0
		});
	});

	it('counts correct and wrong keys separately', () => {
		const r = score([ev(true), ev(true), ev(false), ev(true)], 60_000);
		expect(r.correctKeys).toBe(3);
		expect(r.wrongKeys).toBe(1);
		expect(r.accuracy).toBeCloseTo(0.75);
	});

	it('computes kpm from correct keys per minute', () => {
		// 30 correct keys in 30 s → 60 kpm
		const r = score(
			Array.from({ length: 30 }, () => ev(true)),
			30_000
		);
		expect(r.kpm).toBeCloseTo(60);
		expect(r.accuracy).toBe(1);
		expect(r.score).toBe(60);
	});

	it('penalises score by accuracy squared and rounds', () => {
		// 60 correct + 20 wrong in 60 s → kpm 60, accuracy 0.75 → 60 * 0.5625 = 33.75 → 34
		const log = [
			...Array.from({ length: 60 }, () => ev(true)),
			...Array.from({ length: 20 }, () => ev(false))
		];
		const r = score(log, 60_000);
		expect(r.kpm).toBeCloseTo(60);
		expect(r.score).toBe(34);
	});

	it('does not divide by zero when duration is 0', () => {
		const r = score([ev(true)], 0);
		expect(r.kpm).toBe(0);
		expect(r.score).toBe(0);
	});
});

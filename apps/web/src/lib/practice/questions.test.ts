import { describe, expect, it } from 'vitest';
import { pickQuestions, weakPool } from './questions.ts';

function seeded(seed: number) {
	let s = seed;
	return () => {
		s = (s * 1664525 + 1013904223) % 4294967296;
		return s / 4294967296;
	};
}

describe('pickQuestions', () => {
	it('returns exactly `count` items drawn from the pool', () => {
		const pool = ['あ', 'い', 'う'];
		const q = pickQuestions(pool, 20, seeded(1));
		expect(q).toHaveLength(20);
		expect(q.every((x) => pool.includes(x))).toBe(true);
	});

	it('never repeats the same item twice in a row when the pool has more than one item', () => {
		const q = pickQuestions(['か', 'き'], 50, seeded(7));
		for (let i = 1; i < q.length; i++) expect(q[i]).not.toBe(q[i - 1]);
	});

	it('repeats when the pool has a single item', () => {
		expect(pickQuestions(['ん'], 3, seeded(3))).toEqual(['ん', 'ん', 'ん']);
	});

	it('returns [] for an empty pool or non-positive count', () => {
		expect(pickQuestions([], 5)).toEqual([]);
		expect(pickQuestions(['あ'], 0)).toEqual([]);
	});
});

describe('weakPool', () => {
	it('weights wrong units 3:1 against remaining lesson units', () => {
		const pool = weakPool(['し', 'ち', 'し'], ['さ', 'し', 'す', 'せ', 'そ', 'ち']);
		expect(pool.filter((u) => u === 'し')).toHaveLength(3);
		expect(pool.filter((u) => u === 'ち')).toHaveLength(3);
		expect(pool.filter((u) => u === 'さ')).toHaveLength(1);
	});

	it('falls back to the lesson pool when nothing was wrong', () => {
		expect(weakPool([], ['あ', 'い'])).toEqual(['あ', 'い']);
	});
});

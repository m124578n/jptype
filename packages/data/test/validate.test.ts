import { describe, expect, it } from 'vitest';
import { validateKana, type KanaEntry } from '../src/index.ts';

const entry = (over: Partial<KanaEntry> = {}): KanaEntry => ({
	kana: 'か',
	kata: 'カ',
	romaji: ['ka', 'ca'],
	group: 'seion',
	row: 'ka',
	...over
});

describe('validateKana', () => {
	it('accepts a well-formed table', () => {
		expect(validateKana([entry(), entry({ kana: 'き', kata: 'キ', romaji: ['ki'] })])).toEqual([]);
	});

	it('rejects duplicate kana', () => {
		const errors = validateKana([entry(), entry({ kata: 'キ' })]);
		expect(errors).toHaveLength(1);
		expect(errors[0]).toMatch(/duplicate kana/);
	});

	it('rejects duplicate katakana mapping', () => {
		const errors = validateKana([entry(), entry({ kana: 'き' })]);
		expect(errors.some((e) => /duplicate kata/.test(e))).toBe(true);
	});

	it('rejects entries with no romaji', () => {
		expect(validateKana([entry({ romaji: [] })])).toEqual(
			expect.arrayContaining([expect.stringMatching(/no romaji/)])
		);
	});

	it("rejects romaji outside [a-z'-]", () => {
		const errors = validateKana([entry({ romaji: ['ka', 'KA', 'k a', "n'", 'xtu-'] })]);
		expect(errors).toHaveLength(2);
		expect(errors[0]).toMatch(/"KA"/);
		expect(errors[1]).toMatch(/"k a"/);
	});

	it('rejects repeated spellings inside one entry', () => {
		const errors = validateKana([entry({ romaji: ['ka', 'ka'] })]);
		expect(errors).toEqual([expect.stringMatching(/duplicate romaji/)]);
	});
});

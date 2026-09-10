import { describe, expect, it } from 'vitest';
import { analyzeErrors, describeError, type KeyError } from './errors.ts';

const err = (kana: string, romaji: string[], typed: string, key: string): KeyError => ({
	kana,
	romaji,
	typed,
	key
});

describe('describeError', () => {
	it('reports the whole attempt when it could start some kana spelling', () => {
		// Expecting ち (chi / ti); the typist started `t` then pressed `u` → they spelled つ.
		expect(describeError(err('ち', ['chi', 'ti'], 't', 'u'))).toEqual({
			kana: 'ち',
			expected: 'ti',
			typed: 'tu',
			count: 1
		});
	});

	it('reports just the key when the attempt spells nothing', () => {
		expect(describeError(err('し', ['shi', 'si'], 'sh', 'q'))).toEqual({
			kana: 'し',
			expected: 'shi',
			typed: 'q',
			count: 1
		});
	});

	it('picks the spelling that is still compatible with what was typed', () => {
		// After `s` both shi and si are live, so the hint (and `expected`) is the first one.
		expect(describeError(err('し', ['shi', 'si'], 's', 'a')).expected).toBe('shi');
		// After `sh` only shi survives.
		expect(describeError(err('し', ['shi', 'si'], 'sh', 'a')).expected).toBe('shi');
	});

	it('uses the standard spelling for a wrong key at the start of a unit', () => {
		expect(describeError(err('か', ['ka', 'ca'], '', 'j'))).toEqual({
			kana: 'か',
			expected: 'ka',
			typed: 'j',
			count: 1
		});
	});

	it('falls back to an empty expectation when a unit has no spellings', () => {
		expect(describeError(err('　', [], '', 'x')).expected).toBe('');
	});
});

describe('analyzeErrors', () => {
	it('is empty for a clean run', () => {
		expect(analyzeErrors([])).toEqual({ units: [], spellings: [] });
	});

	it('counts wrong keys per kana and per expected→typed pair', () => {
		const analysis = analyzeErrors([
			err('し', ['shi', 'si'], 's', 'a'),
			err('し', ['shi', 'si'], 's', 'a'),
			err('か', ['ka', 'ca'], '', 'j'),
			err('し', ['shi', 'si'], 'sh', 'q')
		]);
		expect(analysis.units).toEqual([
			{ kana: 'し', count: 3 },
			{ kana: 'か', count: 1 }
		]);
		expect(analysis.spellings).toEqual([
			{ kana: 'し', expected: 'shi', typed: 'sa', count: 2 },
			{ kana: 'か', expected: 'ka', typed: 'j', count: 1 },
			{ kana: 'し', expected: 'shi', typed: 'q', count: 1 }
		]);
	});

	it('keeps first-error order between equal counts and honours the limit', () => {
		const errors = ['あ', 'い', 'う', 'え', 'お', 'か'].map((k) => err(k, ['x'], '', 'z'));
		const analysis = analyzeErrors(errors, 2);
		expect(analysis.units).toEqual([
			{ kana: 'あ', count: 1 },
			{ kana: 'い', count: 1 }
		]);
		expect(analysis.spellings).toHaveLength(2);
	});
});

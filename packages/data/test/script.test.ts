import { describe, expect, it } from 'vitest';
import { toHiragana, toKatakana } from '../src/script.ts';

describe('toKatakana / toHiragana', () => {
	it('converts hiragana to katakana and back', () => {
		expect(toKatakana('きゃ')).toBe('キャ');
		expect(toKatakana('ゔ')).toBe('ヴ');
		expect(toHiragana('ッチ')).toBe('っち');
	});

	it('leaves non-kana characters alone', () => {
		expect(toKatakana('ー、。a1 ')).toBe('ー、。a1 ');
		expect(toHiragana('ー、。a1 ')).toBe('ー、。a1 ');
	});

	it('is idempotent on the target script', () => {
		expect(toKatakana('カ')).toBe('カ');
		expect(toHiragana('か')).toBe('か');
	});
});

import { describe, expect, it } from 'vitest';
import { KANA, SYMBOLS, findKana, validateKana } from '../src/index.ts';

describe('KANA table', () => {
	it('passes validation', () => {
		expect(validateKana(KANA)).toEqual([]);
	});

	it('covers every row of the gojūon plus dakuon/handakuon/yōon/foreign/small', () => {
		const kana = new Set(KANA.map((e) => e.kana));
		for (const k of 'あいうえおかきくけこさしすせそたちつてとなにぬねのはひふへほまみむめもやゆよらりるれろわをん') {
			expect(kana.has(k), k).toBe(true);
		}
		for (const k of 'がぎぐげござじずぜぞだぢづでどばびぶべぼぱぴぷぺぽ')
			expect(kana.has(k), k).toBe(true);
		for (const k of [
			'きゃ',
			'しゃ',
			'じゃ',
			'ちゃ',
			'ぢゃ',
			'にゃ',
			'ひゃ',
			'びゃ',
			'ぴゃ',
			'みゃ',
			'りゃ',
			'ぎゃ'
		]) {
			expect(kana.has(k), k).toBe(true);
		}
		for (const k of [
			'しぇ',
			'てぃ',
			'でぃ',
			'ふぁ',
			'うぃ',
			'ゔ',
			'ゔぁ',
			'つぁ',
			'いぇ',
			'ふゅ',
			'とぅ',
			'どぅ'
		]) {
			expect(kana.has(k), k).toBe(true);
		}
		for (const k of 'ぁぃぅぇぉゃゅょっ') expect(kana.has(k), k).toBe(true);
		// 46 清音 + 20 濁音 + 5 半濁音 + 36 拗音 + 25 外來語音 + 9 小字
		expect(KANA).toHaveLength(141);
	});

	it('uses the spec standard spelling as the first romaji', () => {
		const first = (k: string) => findKana(k)?.romaji[0];
		expect(first('し')).toBe('shi');
		expect(first('ち')).toBe('chi');
		expect(first('つ')).toBe('tsu');
		expect(first('ふ')).toBe('fu');
		expect(first('じ')).toBe('ji');
		expect(first('しゃ')).toBe('sha');
		expect(first('ちゃ')).toBe('cha');
		expect(first('っ')).toBe('xtu');
		expect(first('ん')).toBe('nn');
	});

	it('includes the alternate spellings from the spec', () => {
		expect(findKana('し')?.romaji).toEqual(['shi', 'si', 'ci']);
		expect(findKana('く')?.romaji).toEqual(['ku', 'cu', 'qu']);
		expect(findKana('じゃ')?.romaji).toEqual(['ja', 'jya', 'zya']);
		expect(findKana('てぃ')?.romaji).toEqual(['thi', "t'i"]);
		expect(findKana('っ')?.romaji).toEqual(['xtu', 'ltu', 'xtsu', 'ltsu']);
		expect(findKana('ん')?.romaji).toEqual(['nn', "n'", 'xn']);
	});

	it('findKana resolves katakana through the kata field', () => {
		expect(findKana('カ')?.kana).toBe('か');
		expect(findKana('ッ')?.kana).toBe('っ');
		expect(findKana('ヴァ')?.kana).toBe('ゔぁ');
		expect(findKana('漢')).toBeUndefined();
	});

	it('SYMBOLS maps the spec punctuation', () => {
		expect(SYMBOLS).toEqual({ ー: '-', '、': ',', '。': '.', '？': '?', '！': '!' });
	});
});

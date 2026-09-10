import { describe, expect, it } from 'vitest';
import { keepsSurface, readingOf, toKana, tokensToKana, type RawToken } from './kana.ts';

/**
 * The tokenizer is faked everywhere: loading the real 17 MB IPADIC in a unit test would be both
 * slow and pointless — what we own is the reading → hiragana step, not MeCab.
 */
function fakeTokenizer(tokens: readonly RawToken[]) {
	return { tokenize: () => [...tokens] };
}

const SENTENCE: RawToken[] = [
	{ surface_form: '今日', reading: 'キョウ' },
	{ surface_form: 'は', reading: 'ハ' },
	{ surface_form: 'いい', reading: 'イイ' },
	{ surface_form: '天気', reading: 'テンキ' },
	{ surface_form: 'です', reading: 'デス' },
	{ surface_form: '。' }
];

describe('keepsSurface', () => {
	it('is true for kana, punctuation and ASCII', () => {
		expect(keepsSurface('ひらがな')).toBe(true);
		expect(keepsSurface('カタカナー')).toBe(true);
		expect(keepsSurface('。、！？「」')).toBe(true);
		expect(keepsSurface('ok 12')).toBe(true);
	});

	it('is false as soon as a kanji appears', () => {
		expect(keepsSurface('天気')).toBe(false);
		expect(keepsSurface('あ日')).toBe(false);
	});
});

describe('readingOf', () => {
	it('converts a katakana reading to hiragana', () => {
		expect(readingOf({ surface_form: '天気', reading: 'テンキ' })).toBe('てんき');
		expect(readingOf({ surface_form: '学校', reading: 'ガッコウ' })).toBe('がっこう');
	});

	it('keeps a kana surface instead of its reading, so は stays は and katakana stays katakana', () => {
		expect(readingOf({ surface_form: 'は', reading: 'ワ' })).toBe('は');
		expect(readingOf({ surface_form: 'ハート', reading: 'ハート' })).toBe('ハート');
	});

	it('keeps the surface of an unknown word (no reading)', () => {
		expect(readingOf({ surface_form: '泗水' })).toBe('泗水');
		expect(readingOf({ surface_form: '泗水', reading: '*' })).toBe('泗水');
	});
});

describe('tokensToKana', () => {
	it('joins the readings and reports one token per surface', () => {
		const result = tokensToKana(SENTENCE);
		expect(result.kana).toBe('きょうはいいてんきです。');
		expect(result.tokens).toHaveLength(6);
		expect(result.tokens[0]).toEqual({ surface: '今日', reading: 'きょう' });
		expect(result.tokens[5]).toEqual({ surface: '。', reading: '。' });
	});
});

describe('toKana', () => {
	it('uses the injected tokenizer and never touches the dictionary', async () => {
		await expect(toKana('今日はいい天気です。', fakeTokenizer(SENTENCE))).resolves.toEqual({
			kana: 'きょうはいいてんきです。',
			tokens: tokensToKana(SENTENCE).tokens
		});
	});

	it('short-circuits empty input without a tokenizer', async () => {
		await expect(toKana('')).resolves.toEqual({ kana: '', tokens: [] });
	});
});

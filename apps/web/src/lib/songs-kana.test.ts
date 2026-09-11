import { describe, expect, it } from 'vitest';
import type { RawToken, Tokenizer } from './ja/kana.ts';
import {
	convertLines,
	convertLinesWith,
	needsDictionary,
	needsReading,
	stripPunctuation,
	unresolved
} from './songs-kana.ts';

/** Placeholder text only — no real lyrics. The tokenizer is faked; MeCab is not what we own. */
const READINGS: Record<string, RawToken[]> = {
	今日はいい天気: [
		{ surface_form: '今日', reading: 'キョウ' },
		{ surface_form: 'は', reading: 'ハ' },
		{ surface_form: 'いい', reading: 'イイ' },
		{ surface_form: '天気', reading: 'テンキ' }
	],
	'「今日」…': [
		{ surface_form: '「' },
		{ surface_form: '今日', reading: 'キョウ' },
		{ surface_form: '」' },
		{ surface_form: '…' }
	],
	謎の言葉: [
		{ surface_form: '謎', reading: 'ナゾ' },
		{ surface_form: 'の', reading: 'ノ' },
		{ surface_form: '言葉' } // unknown to the dictionary: no reading
	]
};

const tokenizer: Tokenizer = {
	tokenize: (text) => READINGS[text] ?? [{ surface_form: text }]
};

describe('needsReading', () => {
	it('is false for kana, the engine symbols and ASCII, true for kanji or other punctuation', () => {
		expect(needsReading({ text: 'あいうえお ー、。？！ok' })).toBe(false);
		expect(needsReading({ text: '今日' })).toBe(true);
		expect(needsReading({ text: '「あ」' })).toBe(true);
	});
});

describe('stripPunctuation', () => {
	it('drops what the engine cannot type and keeps what it can', () => {
		expect(stripPunctuation('「あい」…うえ（お）〜')).toBe('あいうえお');
		expect(stripPunctuation('あい、うえ。ー？！')).toBe('あい、うえ。ー？！');
		expect(stripPunctuation('ok - 12')).toBe('ok - 12');
	});

	it('collapses the spaces punctuation leaves behind', () => {
		expect(stripPunctuation('あ ・ い　…　う')).toBe('あ い う');
	});

	it('leaves kanji alone: that is the dictionary’s job', () => {
		expect(stripPunctuation('「今日」')).toBe('今日');
	});
});

describe('convertLinesWith', () => {
	it('converts only the lines that need it and keeps the pasted text as original', () => {
		const out = convertLinesWith(
			[
				{ text: 'あいうえお', start: 1 },
				{ text: '今日はいい天気', start: 2.5 }
			],
			tokenizer
		);
		expect(out).toEqual([
			{ text: 'あいうえお', start: 1 },
			{ text: 'きょうはいいてんき', start: 2.5, original: '今日はいい天気' }
		]);
	});

	it('strips punctuation without the dictionary, and after a reading too', () => {
		expect(convertLinesWith([{ text: '「あい」…' }], tokenizer)).toEqual([
			{ text: 'あい', original: '「あい」…' }
		]);
		expect(convertLinesWith([{ text: '「今日」…' }], tokenizer)).toEqual([
			{ text: 'きょう', original: '「今日」…' }
		]);
	});

	it('drops a line that is nothing but punctuation', () => {
		expect(convertLinesWith([{ text: '…' }, { text: 'あ' }], tokenizer)).toEqual([{ text: 'あ' }]);
	});

	it('leaves unknown words as they are so the user sees what to fix', () => {
		const out = convertLinesWith([{ text: '謎の言葉' }], tokenizer);
		expect(out[0]).toEqual({ text: 'なぞの言葉', original: '謎の言葉' });
		expect(unresolved(out)).toEqual([0]);
	});

	it('does not mutate the input', () => {
		const input = [{ text: '今日はいい天気' }];
		convertLinesWith(input, tokenizer);
		expect(input).toEqual([{ text: '今日はいい天気' }]);
	});
});

describe('convertLines', () => {
	it('never fetches the dictionary for kana and punctuation only', async () => {
		expect(needsDictionary([{ text: '「あい」' }])).toBe(false);
		expect(needsDictionary([{ text: '「今日」' }])).toBe(true);
		const stages: string[] = [];
		const out = await convertLines([{ text: '「あい」…' }, { text: 'う' }], (s) => stages.push(s));
		expect(out).toEqual([{ text: 'あい', original: '「あい」…' }, { text: 'う' }]);
		expect(stages).toEqual([]);
	});
});

import { describe, expect, it } from 'vitest';
import { tokenize } from '../src/index.ts';

const kanas = (text: string) => tokenize(text).map((u) => u.kana);
const romaji = (text: string, i: number) => tokenize(text)[i]?.romaji ?? [];

describe('tokenize – longest match', () => {
	it('splits plain hiragana into single units', () => {
		expect(kanas('あいう')).toEqual(['あ', 'い', 'う']);
	});

	it('prefers 2-character yōon over single kana', () => {
		expect(kanas('きょう')).toEqual(['きょ', 'う']);
		expect(romaji('きょう', 0)).toEqual(['kyo']);
	});

	it('handles katakana through the kata mapping', () => {
		expect(kanas('キョウ')).toEqual(['キョ', 'ウ']);
		expect(romaji('キョウ', 0)).toEqual(['kyo']);
	});

	it('handles foreign-sound digraphs', () => {
		expect(kanas('ティファニー')).toEqual(['ティ', 'ファ', 'ニ', 'ー']);
		expect(romaji('ティファニー', 0)).toEqual(['thi', "t'i"]);
	});

	it('returns no units for an empty string', () => {
		expect(tokenize('')).toEqual([]);
	});
});

describe('tokenize – sokuon っ', () => {
	it('merges っ into a following consonant unit (がっこう)', () => {
		const units = tokenize('がっこう');
		expect(units.map((u) => u.kana)).toEqual(['が', 'っこ', 'う']);
		expect(units[1]?.romaji[0]).toBe('kko');
		expect(units[1]?.romaji).toEqual(
			expect.arrayContaining(['kko', 'cco', 'xtuko', 'ltuko', 'xtsuko', 'ltsuko', 'xtuco'])
		);
	});

	it('accepts cchi / tti / tchi for っち (マッチ)', () => {
		const units = tokenize('マッチ');
		expect(units.map((u) => u.kana)).toEqual(['マ', 'ッチ']);
		expect(units[1]?.romaji).toEqual(expect.arrayContaining(['cchi', 'tti', 'tchi', 'xtuchi']));
		expect(units[1]?.romaji[0]).toBe('cchi');
	});

	it('doubles every spelling of a yōon (っしゃ → ssha, ssya)', () => {
		expect(romaji('いっしゃ', 1)).toEqual(expect.arrayContaining(['ssha', 'ssya']));
	});

	it('stays a standalone small tsu at the end of the text', () => {
		expect(kanas('あっ')).toEqual(['あ', 'っ']);
		expect(romaji('あっ', 1)).toEqual(['xtu', 'ltu', 'xtsu', 'ltsu']);
	});

	it('stays standalone before a vowel or ん', () => {
		expect(kanas('っあ')).toEqual(['っ', 'あ']);
		expect(kanas('っん')).toEqual(['っ', 'ん']);
		expect(romaji('っん', 0)).toEqual(['xtu', 'ltu', 'xtsu', 'ltsu']);
	});

	it('stays standalone before a symbol or space', () => {
		expect(kanas('っー')).toEqual(['っ', 'ー']);
		expect(kanas('っ か')).toEqual(['っ', ' ', 'か']);
	});
});

describe('tokenize – ん', () => {
	it("only accepts nn / n' / xn before a unit starting with n (こんにちは)", () => {
		const units = tokenize('こんにちは');
		expect(units.map((u) => u.kana)).toEqual(['こ', 'ん', 'に', 'ち', 'は']);
		expect(units[1]?.romaji).toEqual(['nn', "n'", 'xn']);
	});

	it('also accepts a bare n before a plain consonant (かんたん)', () => {
		const units = tokenize('かんたん');
		expect(units[1]?.romaji).toContain('n');
		expect(units[1]?.romaji).toEqual(expect.arrayContaining(['nn', "n'", 'xn']));
		// final ん: no bare n
		expect(units[3]?.romaji).toEqual(['nn', "n'", 'xn']);
	});

	it('rejects a bare n before vowels and y-units', () => {
		expect(romaji('んあ', 0)).not.toContain('n');
		expect(romaji('んや', 0)).not.toContain('n');
		expect(romaji('きんよう', 1)).not.toContain('n');
	});

	it('rejects a bare n when any spelling of the next unit begins with a vowel or n/y', () => {
		// う has spellings u / wu → u starts with a vowel → no bare n
		expect(romaji('んう', 0)).not.toContain('n');
	});

	it('allows a bare n before a merged sokuon unit (しんっか is consonant-led)', () => {
		expect(romaji('しんっか', 1)).toContain('n');
	});

	it('rejects a bare n at the end of the text or before symbols/spaces', () => {
		expect(romaji('ん', 0)).toEqual(['nn', "n'", 'xn']);
		expect(romaji('ん。', 0)).toEqual(['nn', "n'", 'xn']);
		expect(romaji('ん か', 0)).toEqual(['nn', "n'", 'xn']);
	});
});

describe('tokenize – symbols, spaces, ASCII', () => {
	it('maps ー to "-" (コーヒー)', () => {
		const units = tokenize('コーヒー');
		expect(units.map((u) => u.kana)).toEqual(['コ', 'ー', 'ヒ', 'ー']);
		expect(units[1]?.romaji).toEqual(['-']);
	});

	it('maps Japanese punctuation to ASCII keys', () => {
		expect(tokenize('、。？！').map((u) => u.romaji)).toEqual([[','], ['.'], ['?'], ['!']]);
	});

	it('keeps spaces as a unit typed with space', () => {
		expect(tokenize('あ い').map((u) => u.romaji)).toEqual([['a'], [' '], ['i']]);
	});

	it('passes ASCII letters, digits and punctuation through, lower-cased', () => {
		expect(tokenize('N5!').map((u) => u.romaji)).toEqual([['n'], ['5'], ['!']]);
		expect(tokenize('N5!').map((u) => u.kana)).toEqual(['N', '5', '!']);
	});

	it('passes unknown characters (e.g. kanji) through as themselves', () => {
		expect(tokenize('日').map((u) => u.romaji)).toEqual([['日']]);
	});
});

describe('tokenize – edge cases', () => {
	it('only merges the っ directly before a consonant (っっか)', () => {
		expect(kanas('っっか')).toEqual(['っ', 'っか']);
	});

	it('treats a full-width space like a space', () => {
		expect(tokenize('あ　い').map((u) => u.romaji)).toEqual([['a'], [' '], ['i']]);
	});

	it('allows a bare n before ASCII consonants and punctuation but not before digits', () => {
		expect(romaji('んk', 0)).toContain('n');
		expect(romaji('ん5', 0)).not.toContain('n');
	});
});

describe('tokenize – "\n" question boundary', () => {
	it('produces no unit and separates questions', () => {
		expect(kanas('か\nき')).toEqual(['か', 'き']);
		expect(tokenize('か\n\nき\n')).toHaveLength(2);
	});

	it('blocks っ merging and the bare-n rule across the boundary', () => {
		expect(kanas('っ\nか')).toEqual(['っ', 'か']);
		expect(romaji('ん\nか', 0)).toEqual(['nn', "n'", 'xn']);
	});

	it('equals the concatenation of tokenizing each question alone', () => {
		const questions = ['がっこう', 'かんたん', 'マッチ', 'こんにちは', 'ん', 'っ'];
		expect(tokenize(questions.join('\n'))).toEqual(questions.flatMap((q) => tokenize(q)));
	});
});

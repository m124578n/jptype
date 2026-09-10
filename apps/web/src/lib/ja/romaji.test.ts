import { describe, expect, it } from 'vitest';
import { toRomaji } from './romaji.ts';

describe('toRomaji', () => {
	it('uses the standard spelling of each kana', () => {
		expect(toRomaji('しずか')).toBe('shizuka');
		expect(toRomaji('ちゃ')).toBe('cha');
		expect(toRomaji('きょう')).toBe('kyou');
	});

	it('doubles the consonant after っ', () => {
		expect(toRomaji('がっこう')).toBe('gakkou');
		expect(toRomaji('まって')).toBe('matte');
		expect(toRomaji('マッチ')).toBe('macchi');
	});

	it('drops っ when there is no consonant to double', () => {
		expect(toRomaji('あっ')).toBe('a');
	});

	it("writes ん as n, and as n' before a vowel or y", () => {
		expect(toRomaji('しんぶん')).toBe('shinbun');
		expect(toRomaji('こんにちは')).toBe('konnichiha');
		expect(toRomaji('きんようび')).toBe("kin'youbi");
		expect(toRomaji('あんい')).toBe("an'i");
	});

	it('repeats the previous vowel for ー', () => {
		expect(toRomaji('コーヒー')).toBe('koohii');
		expect(toRomaji('ラーメン')).toBe('raamen');
	});

	it('maps 、。？！ and keeps spaces and ASCII', () => {
		expect(toRomaji('はい、そうです。')).toBe('hai,soudesu.');
		expect(toRomaji('なに？')).toBe('nani?');
		expect(toRomaji('すごい！')).toBe('sugoi!');
		expect(toRomaji('あ い ok')).toBe('a i ok');
	});

	it('copies characters it cannot read, so an unfinished line still shows something', () => {
		expect(toRomaji('あ日')).toBe('a日');
	});

	it('returns an empty string for empty input', () => {
		expect(toRomaji('')).toBe('');
	});
});

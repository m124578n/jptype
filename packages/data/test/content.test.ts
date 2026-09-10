import { describe, expect, it } from 'vitest';
import {
	findKana,
	findLesson,
	SENTENCES,
	toHiragana,
	WORDS_N5,
	type SentenceEntry,
	type WordEntry
} from '../src/index.ts';

/** Characters that are typeable without being kana table entries (spec §5.2 符號). */
const SYMBOL_CHARS = ['ー', '、', '。'];

/** Longest-match walk over a reading; throws on anything the tokenizer could not type. */
function assertTypeable(text: string, where: string): void {
	const chars = [...toHiragana(text)];
	let i = 0;
	while (i < chars.length) {
		const ch = chars[i] ?? '';
		if (SYMBOL_CHARS.includes(ch)) {
			i += 1;
			continue;
		}
		const two = chars.slice(i, i + 2).join('');
		if (findKana(two)) i += 2;
		else if (findKana(ch)) i += 1;
		else throw new Error(`${where}: "${text}" contains untypeable "${ch}"`);
	}
}

const glossed = (entries: readonly (WordEntry | SentenceEntry)[]) =>
	entries.filter((e) => e.zh.trim().length === 0);

describe('WORDS_N5', () => {
	it('has exactly 100 entries with unique readings', () => {
		expect(WORDS_N5).toHaveLength(100);
		const kana = WORDS_N5.map((w) => w.kana);
		expect(new Set(kana).size).toBe(kana.length);
	});

	it('every reading is typeable kana (plus ー) with no kanji, and every gloss is filled', () => {
		for (const w of WORDS_N5) {
			assertTypeable(w.kana, 'words-n5');
			expect(w.kana, w.kana).not.toMatch(/[、。\s]/);
			expect(w.kanji?.length ?? 1, w.kana).toBeGreaterThan(0);
		}
		expect(glossed(WORDS_N5)).toEqual([]);
	});

	it('covers っ, ん and long vowels', () => {
		expect(WORDS_N5.some((w) => w.kana.includes('っ'))).toBe(true);
		expect(WORDS_N5.some((w) => w.kana.includes('ん'))).toBe(true);
		expect(WORDS_N5.some((w) => w.kana.includes('ー'))).toBe(true);
		expect(WORDS_N5.some((w) => w.kana.includes('ょう'))).toBe(true);
	});
});

describe('SENTENCES', () => {
	it('has exactly 20 entries with unique readings', () => {
		expect(SENTENCES).toHaveLength(20);
		const kana = SENTENCES.map((s) => s.kana);
		expect(new Set(kana).size).toBe(kana.length);
	});

	it('readings are 8–20 kana, typeable, no spaces, punctuation only 、。', () => {
		for (const s of SENTENCES) {
			assertTypeable(s.kana, 'sentences');
			expect([...s.kana].length, s.kana).toBeGreaterThanOrEqual(8);
			expect([...s.kana].length, s.kana).toBeLessThanOrEqual(20);
			// JS \s already covers U+3000, so no ideographic space needs to appear here.
			expect(s.kana, s.kana).not.toMatch(/\s/u);
			expect(s.kana.replace(/[、。]/g, ''), s.kana).not.toMatch(/[^\p{Script=Hiragana}ー]/u);
		}
	});

	it('every sentence has a kanji form and a translation', () => {
		for (const s of SENTENCES) expect(s.kanji.length, s.kana).toBeGreaterThan(0);
		expect(glossed(SENTENCES)).toEqual([]);
	});
});

describe('content lessons', () => {
	it('n5-words and sentences are word-mode lessons with a hint per unit', () => {
		for (const [id, entries] of [
			['n5-words', WORDS_N5],
			['sentences', SENTENCES]
		] as const) {
			const lesson = findLesson(id);
			expect(lesson, id).toBeDefined();
			expect(lesson?.mode).toBe('word');
			expect(lesson?.intro).toEqual([]);
			expect(lesson?.units).toEqual(entries.map((e) => e.kana));
			for (const e of entries) {
				const hint = lesson?.hints?.[e.kana];
				expect(hint?.zh, e.kana).toBe(e.zh);
				expect(hint?.kanji, e.kana).toBe(e.kanji);
			}
		}
	});
});

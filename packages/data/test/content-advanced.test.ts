import { describe, expect, it } from 'vitest';
import {
	BUSINESS,
	findKana,
	findLesson,
	LESSON_GROUPS,
	NETSLANG,
	SENTENCES,
	SENTENCES_N1,
	SENTENCES_N2,
	SENTENCES_N3,
	SENTENCES_N4,
	TIMED_POOLS,
	toHiragana,
	WORDS_N1,
	WORDS_N2,
	WORDS_N3,
	WORDS_N4,
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

describe.each([
	['WORDS_N4', WORDS_N4, 100],
	['WORDS_N3', WORDS_N3, 100],
	['WORDS_N2', WORDS_N2, 100],
	['WORDS_N1', WORDS_N1, 100],
	['NETSLANG', NETSLANG, 60]
] as const)('%s', (name, words, count) => {
	it(`has exactly ${count} entries with unique readings`, () => {
		expect(words).toHaveLength(count);
		const kana = words.map((w) => w.kana);
		expect(new Set(kana).size).toBe(kana.length);
	});

	it('every reading is typeable kana (plus ー) with no kanji, and every gloss is filled', () => {
		for (const w of words) {
			assertTypeable(w.kana, name);
			expect(w.kana, w.kana).not.toMatch(/[、。\s]/);
			expect(w.kanji?.length ?? 1, w.kana).toBeGreaterThan(0);
		}
		expect(glossed(words)).toEqual([]);
	});
});

it('the vocabulary lists do not repeat a reading across levels', () => {
	const all = [...WORDS_N5, ...WORDS_N4, ...WORDS_N3, ...WORDS_N2, ...WORDS_N1].map((w) => w.kana);
	const dupes = all.filter((k, i) => all.indexOf(k) !== i);
	expect(dupes).toEqual([]);
});

describe.each([
	['SENTENCES_N4', SENTENCES_N4, 20, 12, 34],
	['SENTENCES_N3', SENTENCES_N3, 20, 16, 44],
	['SENTENCES_N2', SENTENCES_N2, 20, 16, 48],
	['SENTENCES_N1', SENTENCES_N1, 20, 20, 52],
	['BUSINESS', BUSINESS, 30, 8, 48]
] as const)('%s', (name, sentences, count, min, max) => {
	it(`has exactly ${count} entries with unique readings`, () => {
		expect(sentences).toHaveLength(count);
		const kana = sentences.map((s) => s.kana);
		expect(new Set(kana).size).toBe(kana.length);
	});

	it(`readings are ${min}–${max} kana, typeable, no spaces, punctuation only 、。`, () => {
		for (const s of sentences) {
			assertTypeable(s.kana, name);
			expect([...s.kana].length, s.kana).toBeGreaterThanOrEqual(min);
			expect([...s.kana].length, s.kana).toBeLessThanOrEqual(max);
			expect(s.kana, s.kana).not.toMatch(/\s/u);
			expect(s.kana.replace(/[、。]/g, ''), s.kana).not.toMatch(
				/[^\p{Script=Hiragana}\p{Script=Katakana}ー]/u
			);
		}
	});

	it('every sentence has a kanji form and a translation, and is not an N5 sentence', () => {
		for (const s of sentences) expect(s.kanji.length, s.kana).toBeGreaterThan(0);
		expect(glossed(sentences)).toEqual([]);
		const n5 = new Set(SENTENCES.map((s) => s.kana));
		expect(sentences.filter((s) => n5.has(s.kana))).toEqual([]);
	});
});

describe('中高階 lessons and pools', () => {
	it('every new set is a word-mode lesson with a hint per unit', () => {
		for (const [id, entries] of [
			['n4-words', WORDS_N4],
			['n3-words', WORDS_N3],
			['sentences-n4', SENTENCES_N4],
			['sentences-n3', SENTENCES_N3],
			['n2-words', WORDS_N2],
			['n1-words', WORDS_N1],
			['sentences-n2', SENTENCES_N2],
			['sentences-n1', SENTENCES_N1],
			['business', BUSINESS],
			['netslang', NETSLANG]
		] as const) {
			const lesson = findLesson(id);
			expect(lesson, id).toBeDefined();
			expect(lesson?.mode).toBe('word');
			expect(lesson?.units).toEqual(entries.map((e) => e.kana));
			for (const e of entries) expect(lesson?.hints?.[e.kana]?.zh, e.kana).toBe(e.zh);
		}
	});

	it('the lesson map groups them: 中階 → 高階 → 實用, after the N5 group', () => {
		const ids = LESSON_GROUPS.map((g) => g.id);
		expect(ids.slice(ids.indexOf('content'))).toEqual([
			'content',
			'advanced',
			'expert',
			'practical'
		]);
		const groupOf = (id: string) => LESSON_GROUPS.find((g) => g.id === id)?.lessonIds;
		expect(groupOf('advanced')).toEqual(['n4-words', 'sentences-n4', 'n3-words', 'sentences-n3']);
		expect(groupOf('expert')).toEqual(['n2-words', 'sentences-n2', 'n1-words', 'sentences-n1']);
		expect(groupOf('practical')).toEqual(['business', 'netslang']);
	});

	it('timed mode offers the N4–N1 vocabulary and 網路用語 as pools', () => {
		expect(TIMED_POOLS.n4).toEqual(WORDS_N4.map((w) => w.kana));
		expect(TIMED_POOLS.n3).toEqual(WORDS_N3.map((w) => w.kana));
		expect(TIMED_POOLS.n2).toEqual(WORDS_N2.map((w) => w.kana));
		expect(TIMED_POOLS.n1).toEqual(WORDS_N1.map((w) => w.kana));
		expect(TIMED_POOLS.slang).toEqual(NETSLANG.map((w) => w.kana));
	});
});

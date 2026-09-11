import { describe, expect, it } from 'vitest';
import { LESSONS, LESSON_GROUPS, findLesson, KANA, findKana, toHiragana } from '../src/index.ts';

describe('LESSONS', () => {
	it('has unique ids and every group references existing lessons', () => {
		const ids = LESSONS.map((l) => l.id);
		expect(new Set(ids).size).toBe(ids.length);
		for (const g of LESSON_GROUPS) {
			for (const id of g.lessonIds) expect(findLesson(id), id).toBeDefined();
		}
		// every lesson belongs to exactly one group
		const grouped = LESSON_GROUPS.flatMap((g) => g.lessonIds);
		expect([...grouped].sort()).toEqual([...ids].sort());
	});

	it('follows the spec order: hira rows → … → foreign → N5 words → sentences', () => {
		expect(LESSONS.map((l) => l.id)).toEqual([
			'hira-a',
			'hira-ka',
			'hira-sa',
			'hira-ta',
			'hira-na',
			'hira-ha',
			'hira-ma',
			'hira-ya',
			'hira-ra',
			'hira-wa',
			'hira-all',
			'hira-dakuon',
			'hira-youon',
			'sokuon-chouon',
			'kata-a',
			'kata-ka',
			'kata-sa',
			'kata-ta',
			'kata-na',
			'kata-ha',
			'kata-ma',
			'kata-ya',
			'kata-ra',
			'kata-wa',
			'kata-all',
			'kata-dakuon',
			'kata-youon',
			'foreign',
			'n5-words',
			'sentences',
			'n4-words',
			'sentences-n4',
			'n3-words',
			'sentences-n3',
			'n2-words',
			'sentences-n2',
			'n1-words',
			'sentences-n1',
			'business',
			'netslang'
		]);
	});

	it('every unit is typeable: made only of table kana, ー、。 or spaces', () => {
		for (const lesson of LESSONS) {
			expect(lesson.units.length, lesson.id).toBeGreaterThan(0);
			for (const unit of lesson.units) {
				const stripped = toHiragana(unit).replace(/[ー、。]/g, '');
				// greedy check: every char (or digraph) must exist in the table
				const chars = [...stripped];
				let i = 0;
				while (i < chars.length) {
					const two = chars.slice(i, i + 2).join('');
					if (findKana(two)) i += 2;
					else if (findKana(chars[i] ?? '')) i += 1;
					else throw new Error(`${lesson.id}: "${unit}" contains untypeable "${chars[i]}"`);
				}
			}
		}
	});

	it('kana-mode lessons use single table entries as units, intro matches units', () => {
		for (const lesson of LESSONS.filter((l) => l.mode === 'kana')) {
			for (const unit of lesson.units) expect(findKana(unit), `${lesson.id} ${unit}`).toBeDefined();
			expect(lesson.intro.map((e) => e.kana)).toEqual([
				...new Set(lesson.units.map((u) => toHiragana(u)))
			]);
		}
	});

	it('hira-wa includes ん; hira-all covers all 46 seion', () => {
		expect(findLesson('hira-wa')?.units).toEqual(['わ', 'を', 'ん']);
		expect(findLesson('hira-all')?.units).toHaveLength(46);
	});

	it('katakana lessons present katakana units but hiragana intro entries', () => {
		const kataKa = findLesson('kata-ka');
		expect(kataKa?.units).toEqual(['カ', 'キ', 'ク', 'ケ', 'コ']);
		expect(kataKa?.intro.map((e) => e.kata)).toEqual(['カ', 'キ', 'ク', 'ケ', 'コ']);
	});

	it('sokuon-chouon and foreign are word-mode lessons with intro entries for their sounds', () => {
		const s = findLesson('sokuon-chouon');
		expect(s?.mode).toBe('word');
		expect(s?.units).toEqual(expect.arrayContaining(['がっこう', 'きって', 'おかあさん']));
		expect(s?.intro.map((e) => e.kana)).toEqual(['っ']);

		const f = findLesson('foreign');
		expect(f?.mode).toBe('word');
		expect(f?.units).toEqual(expect.arrayContaining(['ティー', 'ファン', 'ヴァイオリン']));
		expect(f?.intro.every((e) => e.group === 'foreign')).toBe(true);
		expect(f?.intro.length).toBe(KANA.filter((e) => e.group === 'foreign').length);
	});

	it('findLesson returns undefined for unknown ids', () => {
		expect(findLesson('nope')).toBeUndefined();
	});
});

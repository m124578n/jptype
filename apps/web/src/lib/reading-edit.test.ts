import { describe, expect, it } from 'vitest';
import { applyFix, editableToken, fixIssues, fixedLine } from './reading-edit.ts';
import type { SongLine } from './songs.ts';

/** Placeholder text only — no real lyrics. */
const LINE: SongLine = {
	text: 'きょうはいいてんき',
	original: '今日はいい天気',
	tokens: [
		{ surface: '今日', reading: 'きょう' },
		{ surface: 'は', reading: 'は' },
		{ surface: 'いい', reading: 'いい' },
		{ surface: '天気', reading: 'てんき' }
	]
};

describe('editableToken', () => {
	it('is true for kanji surfaces only', () => {
		expect(editableToken({ surface: '今日', reading: 'きょう' })).toBe(true);
		expect(editableToken({ surface: 'は', reading: 'は' })).toBe(false);
		expect(editableToken({ surface: '「', reading: '' })).toBe(false);
	});
});

describe('fixedLine', () => {
	it('rebuilds the text from the edited readings and keeps the tokens aligned', () => {
		const next = fixedLine(LINE, { readings: ['こんにち', 'は', 'いい', 'てんき'] });
		expect(next.text).toBe('こんにちはいいてんき');
		expect(next.original).toBe('今日はいい天気');
		expect(next.tokens?.[0]).toEqual({ surface: '今日', reading: 'こんにち' });
		expect(fixIssues(next)).toEqual([]);
	});

	it('edits the whole kana text of a line without tokens', () => {
		const next = fixedLine({ text: 'あい', original: '「あい」' }, { text: ' あいう ' });
		expect(next).toEqual({ text: 'あいう', original: '「あい」' });
	});

	it('reports characters the engine still cannot type, and an empty line', () => {
		expect(fixIssues(fixedLine(LINE, { readings: ['今日', 'は', 'いい', 'てんき'] }))).toHaveLength(
			2
		);
		expect(fixIssues(fixedLine({ text: 'あ' }, { text: '' }))).toHaveLength(1);
	});

	it('does not mutate the input line', () => {
		const copy = structuredClone(LINE);
		fixedLine(LINE, { readings: ['x', 'は', 'いい', 'てんき'] });
		expect(LINE).toEqual(copy);
	});
});

describe('applyFix', () => {
	it('replaces every line with the old text and keeps each line’s own start', () => {
		const fixed = fixedLine(LINE, { readings: ['こんにち', 'は', 'いい', 'てんき'] });
		const lines: SongLine[] = [
			{ ...LINE, start: 1 },
			{ text: 'あ', start: 5 },
			{ ...LINE, start: 30 },
			{ ...LINE }
		];
		const out = applyFix(lines, LINE.text, fixed);
		expect(out.map((l) => l.text)).toEqual([
			'こんにちはいいてんき',
			'あ',
			'こんにちはいいてんき',
			'こんにちはいいてんき'
		]);
		expect(out.map((l) => l.start)).toEqual([1, 5, 30, undefined]);
		expect(out[1]).toBe(lines[1]);
	});
});

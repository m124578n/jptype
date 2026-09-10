import { describe, expect, it } from 'vitest';
import {
	clearAllTimings,
	clearLineTiming,
	firstUntimedIndex,
	formatTime,
	nudgeLine,
	stampLine,
	timedCount
} from './song-timing.ts';
import type { SongLine } from './songs.ts';

// Placeholder kana only — never real lyrics (DECISIONS.md「歌詞打字」).
const lines: SongLine[] = [{ text: 'あいうえお' }, { text: 'かきくけこ', start: 9 }];

describe('stampLine', () => {
	it('stamps the given line and leaves the others alone', () => {
		expect(stampLine(lines, 0, 3.456)).toEqual([
			{ text: 'あいうえお', start: 3.46 },
			{ text: 'かきくけこ', start: 9 }
		]);
	});

	it('overwrites a timestamp the paste already carried', () => {
		expect(stampLine(lines, 1, 12.5)[1]).toEqual({ text: 'かきくけこ', start: 12.5 });
	});

	it('clamps negative times to 0 and never mutates the input', () => {
		const before = structuredClone(lines);
		expect(stampLine(lines, 0, -4)[0]).toEqual({ text: 'あいうえお', start: 0 });
		expect(lines).toEqual(before);
	});

	it('ignores an out-of-range index or a non-finite time', () => {
		expect(stampLine(lines, 5, 1)).toEqual(lines);
		expect(stampLine(lines, -1, 1)).toEqual(lines);
		expect(stampLine(lines, 0, Number.NaN)).toEqual(lines);
	});
});

describe('nudgeLine', () => {
	it('shifts an existing start in both directions', () => {
		expect(nudgeLine(lines, 1, 0.5)[1]).toEqual({ text: 'かきくけこ', start: 9.5 });
		expect(nudgeLine(lines, 1, -0.5)[1]).toEqual({ text: 'かきくけこ', start: 8.5 });
	});

	it('never goes below zero', () => {
		expect(nudgeLine([{ text: 'あ', start: 0.2 }], 0, -0.5)[0]).toEqual({ text: 'あ', start: 0 });
	});

	it('does nothing to a line that has no timing yet', () => {
		expect(nudgeLine(lines, 0, 0.5)).toEqual(lines);
	});
});

describe('clearLineTiming / clearAllTimings', () => {
	it('drops one timing', () => {
		expect(clearLineTiming(lines, 1)).toEqual([{ text: 'あいうえお' }, { text: 'かきくけこ' }]);
		expect(clearLineTiming(lines, 9)).toEqual(lines);
	});

	it('drops every timing', () => {
		expect(clearAllTimings(lines)).toEqual([{ text: 'あいうえお' }, { text: 'かきくけこ' }]);
	});
});

describe('timedCount / firstUntimedIndex', () => {
	it('counts timed lines and finds where to resume', () => {
		expect(timedCount(lines)).toBe(1);
		expect(firstUntimedIndex(lines)).toBe(0);
		const all = stampLine(lines, 0, 1);
		expect(timedCount(all)).toBe(2);
		expect(firstUntimedIndex(all)).toBe(2);
		expect(firstUntimedIndex([])).toBe(0);
	});
});

describe('formatTime', () => {
	it('formats as m:ss.cc', () => {
		expect(formatTime(0)).toBe('0:00.00');
		expect(formatTime(9.5)).toBe('0:09.50');
		expect(formatTime(65.25)).toBe('1:05.25');
		expect(formatTime(600)).toBe('10:00.00');
	});

	it('shows a dash when there is no timing', () => {
		expect(formatTime(undefined)).toBe('—');
		expect(formatTime(Number.NaN)).toBe('—');
	});
});

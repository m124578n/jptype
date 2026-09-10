import { describe, expect, it } from 'vitest';
import { BOUNDARY } from '@jptype/engine';
import { SongSyncRun } from './song-sync.svelte.ts';
import type { SongLine } from '../songs.ts';

// Placeholder kana only — never real lyrics (DECISIONS.md「歌詞打字」).
const LINES: SongLine[] = [
	{ text: 'あ', start: 0 },
	{ text: 'い', start: 10 },
	{ text: 'う', start: 20 }
];

/** Type a whole one-kana line; `nowMs` is the wall clock, video time is separate. */
function type(run: SongSyncRun, keys: string, from: number): number {
	let now = from;
	for (const key of keys) run.press(key, (now += 100));
	return now;
}

describe('SongSyncRun – construction', () => {
	it('keeps only timed lines, sorted by start time', () => {
		const run = new SongSyncRun([
			{ text: 'う', start: 20 },
			{ text: 'えお' }, // no timing: sync mode cannot place it
			{ text: 'あ', start: 0 }
		]);
		expect(run.lines).toEqual([
			{ text: 'あ', start: 0 },
			{ text: 'う', start: 20 }
		]);
		expect(run.total).toBe(2);
		expect(run.current).toBe('あ');
		expect(run.finished).toBe(false);
	});

	it('is finished immediately when nothing is timed', () => {
		const run = new SongSyncRun([{ text: 'あ' }]);
		expect(run.total).toBe(0);
		expect(run.finished).toBe(true);
		expect(run.press('a', 0)).toBeNull();
	});
});

describe('SongSyncRun – time to line', () => {
	it('maps a playback position to the last line that has started', () => {
		const run = new SongSyncRun(LINES);
		expect(run.lineIndexAt(-5)).toBe(0); // before the song starts: wait on line 1
		expect(run.lineIndexAt(0)).toBe(0);
		expect(run.lineIndexAt(9.99)).toBe(0);
		expect(run.lineIndexAt(10)).toBe(1);
		expect(run.lineIndexAt(19)).toBe(1);
		expect(run.lineIndexAt(999)).toBe(2);
	});

	it('does nothing while the position stays inside the current line', () => {
		const run = new SongSyncRun(LINES);
		run.timeUpdate(5);
		expect(run.index).toBe(0);
		expect(run.skippedLines).toBe(0);
	});
});

describe('SongSyncRun – advance and skip', () => {
	it('advances without a skip when the line was finished in time', () => {
		const run = new SongSyncRun(LINES);
		type(run, 'a', 1000);
		expect(run.lineDone).toBe(true);
		run.timeUpdate(10);
		expect(run.index).toBe(1);
		expect(run.current).toBe('い');
		expect(run.lineDone).toBe(false);
		expect(run.skippedLines).toBe(0);
	});

	it('follows the song even when the line is unfinished, counting it as skipped', () => {
		const run = new SongSyncRun(LINES);
		run.timeUpdate(10);
		expect(run.index).toBe(1);
		expect(run.skippedLines).toBe(1);
	});

	it('counts every line jumped over', () => {
		const run = new SongSyncRun(LINES);
		run.timeUpdate(20);
		expect(run.index).toBe(2);
		expect(run.skippedLines).toBe(2);
	});

	it('ignores keys once the current line is done, and resumes on the next line', () => {
		const run = new SongSyncRun(LINES);
		type(run, 'a', 1000);
		expect(run.press('a', 2000)).toBeNull();
		run.timeUpdate(10);
		expect(run.press('i', 2100)?.ok).toBe(true);
		expect(run.lineDone).toBe(true);
	});

	it('finishes as soon as the last line is typed', () => {
		const run = new SongSyncRun(LINES);
		run.timeUpdate(20);
		type(run, 'u', 1000);
		expect(run.finished).toBe(true);
		expect(run.skippedLines).toBe(2);
		expect(run.press('u', 5000)).toBeNull();
	});
});

describe('SongSyncRun – seek', () => {
	it('restarts the line the user landed on and clears its buffer', () => {
		const run = new SongSyncRun([
			{ text: 'かき', start: 0 },
			{ text: 'い', start: 10 }
		]);
		run.press('k', 1000);
		expect(run.typed).toBe('k');
		run.seek(2); // same line, but the audio moved: start it over
		expect(run.index).toBe(0);
		expect(run.typed).toBe('');
		expect(run.unitIndex).toBe(0);
	});

	it('rewinding to an earlier line un-skips it and gives it another go', () => {
		const run = new SongSyncRun(LINES);
		run.timeUpdate(10);
		expect(run.skippedLines).toBe(1);
		run.seek(0);
		expect(run.index).toBe(0);
		expect(run.skippedLines).toBe(0);
		expect(run.press('a', 1000)?.ok).toBe(true);
	});

	it('keeps the keys already logged when the line restarts', () => {
		const run = new SongSyncRun(LINES);
		run.press('x', 1000); // wrong key on line 1
		run.seek(0);
		type(run, 'a', 2000);
		run.finish(3000);
		expect(run.result()).toMatchObject({ correctKeys: 1, wrongKeys: 1 });
		expect(run.wrongUnits).toEqual([]); // the wrong key belonged to the discarded attempt
	});
});

describe('SongSyncRun – finish and result', () => {
	it('counts an unfinished current line as skipped when the video ends', () => {
		const run = new SongSyncRun(LINES);
		type(run, 'a', 1000);
		run.timeUpdate(10);
		run.finish(5000);
		expect(run.finished).toBe(true);
		// Line 2 was left unfinished; line 3 never started, so it was never skipped either.
		expect(run.skippedLines).toBe(1);
	});

	it('scores the merged log across lines', () => {
		const run = new SongSyncRun(LINES);
		let now = type(run, 'a', 1000); // 1100
		run.timeUpdate(10);
		now = type(run, 'xi', now); // one wrong, one right
		run.timeUpdate(20);
		type(run, 'u', now);
		expect(run.finished).toBe(true);
		expect(run.skippedLines).toBe(0);
		expect(run.result()).toMatchObject({ correctKeys: 3, wrongKeys: 1, accuracy: 0.75 });
		expect(run.durationMs).toBe(300); // first key 1100 → last key 1400
		expect(run.wrongUnits).toEqual(['い']);
		expect(run.unitOutcomes).toEqual([
			{ kana: 'あ', error: false },
			{ kana: 'い', error: true },
			{ kana: 'う', error: false }
		]);
	});

	it('joins the lines reached so far with the engine boundary', () => {
		const run = new SongSyncRun(LINES);
		expect(run.text).toBe('あ');
		run.timeUpdate(10);
		expect(run.text).toBe(['あ', 'い'].join(BOUNDARY));
	});

	it('ignores a second finish and stops reacting to the timeline', () => {
		const run = new SongSyncRun(LINES);
		run.finish(1000);
		const skipped = run.skippedLines;
		run.finish(2000);
		run.timeUpdate(20);
		run.seek(0);
		expect(run.index).toBe(0);
		expect(run.skippedLines).toBe(skipped);
	});
	it('is replayable only while every line was typed once, in order', () => {
		const run = new SongSyncRun(LINES);
		expect(run.replayable).toBe(true);

		const now = type(run, 'a', 0);
		run.timeUpdate(10); // line 1 finished, the song moves on
		expect(run.replayable).toBe(true);

		type(run, 'i', now);
		run.timeUpdate(20);
		run.seek(20); // re-entering a line leaves its keys in the log twice over
		expect(run.replayable).toBe(false);
	});

	it('is not replayable once a line was skipped', () => {
		const run = new SongSyncRun(LINES);
		run.timeUpdate(10); // the first line was never typed
		expect(run.skippedLines).toBe(1);
		expect(run.replayable).toBe(false);
	});
});

import { describe, expect, it } from 'vitest';
import { replay } from '@jptype/engine';
import { PracticeRun } from './run.svelte.ts';

const fixedRng = () => 0; // always the first pool item

describe('PracticeRun – fixed count', () => {
	it('walks through every question and finishes', () => {
		const run = new PracticeRun(['か'], { count: 3, rng: fixedRng });
		expect(run.total).toBe(3);
		expect(run.current).toBe('か');
		expect(run.nextKey).toBe('k');

		let now = 1000;
		for (let i = 0; i < 3; i++) {
			expect(run.press('k', (now += 100))?.ok).toBe(true);
			expect(run.press('a', (now += 100))?.unitDone).toBe(true);
		}
		expect(run.finished).toBe(true);
		expect(run.durationMs).toBe(500);
		expect(run.result()).toMatchObject({ correctKeys: 6, wrongKeys: 0, accuracy: 1 });
	});

	it('tracks wrong units by first-attempt errors and exposes nextKey from the hint', () => {
		const run = new PracticeRun(['し'], { count: 2, rng: fixedRng });
		expect(run.press('x', 0)?.ok).toBe(false);
		expect(run.lastWrongAt).toBe(0);
		expect(run.nextKey).toBe('s');
		run.press('s', 10);
		expect(run.typed).toBe('s');
		expect(run.nextKey).toBe('h');
		run.press('h', 20);
		run.press('i', 30);
		expect(run.index).toBe(1);
		run.press('s', 40);
		run.press('i', 50); // si also completes し
		expect(run.finished).toBe(true);
		expect(run.wrongUnits).toEqual(['し']);
		expect(run.unitOutcomes).toEqual([
			{ kana: 'し', error: true },
			{ kana: 'し', error: false }
		]);
		expect(run.result()).toMatchObject({ correctKeys: 5, wrongKeys: 1 });
	});

	it('ignores non-typing keys and presses after finishing', () => {
		const run = new PracticeRun(['あ'], { count: 1, rng: fixedRng });
		expect(run.press('Shift', 0)).toBeNull();
		expect(run.durationMs).toBe(0);
		expect(run.started).toBe(false);
		run.press('a', 5);
		expect(run.finished).toBe(true);
		expect(run.press('a', 6)).toBeNull();
	});

	it('is finished immediately for an empty pool', () => {
		expect(new PracticeRun([], { count: 5 }).finished).toBe(true);
	});

	it('text + log replay to the same score on the engine (server-side verification path)', () => {
		const run = new PracticeRun(['がっこう', 'かんたん'], { count: 4, rng: fixedRng });
		// fixedRng picks index 0 but never the same twice in a row → alternates
		expect(run.questions).toEqual(['がっこう', 'かんたん', 'がっこう', 'かんたん']);
		const keys = 'gakkou' + 'kantann' + 'gakkou' + 'kantann';
		[...keys].forEach((k, i) => run.press(k, i * 50));
		expect(run.finished).toBe(true);
		expect(run.text).toBe('がっこう\nかんたん\nがっこう\nかんたん');
		expect(replay(run.text, run.log, run.durationMs)).toEqual(run.result());
	});
});

describe('PracticeRun – endless (timed)', () => {
	it('keeps producing questions until stopped and keeps the partial question', () => {
		const run = new PracticeRun(['か', 'き'], { endless: true, rng: fixedRng });
		expect(run.total).toBe(Infinity);
		let now = 0;
		for (let i = 0; i < 5; i++) {
			run.press('k', (now += 100));
			run.press(run.nextKey, (now += 100));
		}
		expect(run.index).toBe(5);
		expect(run.questions).toHaveLength(6);
		run.press('k', (now += 100)); // half of the 6th question
		run.stop(now + 400);
		expect(run.finished).toBe(true);
		expect(run.durationMs).toBe(now + 400 - 100);
		expect(run.log).toHaveLength(11);
		expect(run.text.split('\n')).toHaveLength(6);
		expect(run.press('a', now + 500)).toBeNull();
		expect(replay(run.text, run.log, run.durationMs)).toEqual(run.result());
	});

	it('stop() before any key yields an empty result', () => {
		const run = new PracticeRun(['か'], { endless: true, rng: fixedRng });
		run.stop(1000);
		expect(run.finished).toBe(true);
		expect(run.result()).toMatchObject({ correctKeys: 0, wrongKeys: 0, score: 0 });
	});

	it('elapsed() is 0 before the first key and counts from it afterwards', () => {
		const run = new PracticeRun(['か'], { endless: true, rng: fixedRng });
		expect(run.elapsed(5000)).toBe(0);
		run.press('k', 1000);
		expect(run.elapsed(1500)).toBe(500);
	});
});

describe('PracticeRun – sequence (song lines)', () => {
	it('uses the given questions verbatim and in order, repeats included', () => {
		const lines = ['あい', 'あい', 'うえ'];
		const run = new PracticeRun(lines, { sequence: lines });
		expect(run.questions).toEqual(lines);
		expect(run.total).toBe(3);
		let now = 0;
		[...('ai' + 'ai' + 'ue')].forEach((k) => run.press(k, (now += 50)));
		expect(run.finished).toBe(true);
		expect(run.text).toBe('あい\nあい\nうえ');
		expect(replay(run.text, run.log, run.durationMs)).toEqual(run.result());
	});

	it('takes precedence over count and endless', () => {
		const run = new PracticeRun(['か'], {
			sequence: ['き'],
			count: 5,
			endless: true,
			rng: fixedRng
		});
		expect(run.questions).toEqual(['き']);
		expect(run.total).toBe(1);
		run.press('k', 0);
		run.press('i', 10);
		expect(run.finished).toBe(true);
		expect(run.questions).toEqual(['き']);
	});

	it('is finished immediately for an empty sequence', () => {
		expect(new PracticeRun([], { sequence: [] }).finished).toBe(true);
	});
});

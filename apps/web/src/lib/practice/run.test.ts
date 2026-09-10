import { describe, expect, it } from 'vitest';
import { PracticeRun } from './run.svelte.ts';

const fixedRng = () => 0; // always the first pool item

describe('PracticeRun', () => {
	it('walks through every question and finishes', () => {
		const run = new PracticeRun(['か'], 3, fixedRng);
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
		const run = new PracticeRun(['し'], 2, fixedRng);
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
		const run = new PracticeRun(['あ'], 1, fixedRng);
		expect(run.press('Shift', 0)).toBeNull();
		expect(run.durationMs).toBe(0);
		run.press('a', 5);
		expect(run.finished).toBe(true);
		expect(run.press('a', 6)).toBeNull();
	});

	it('is finished immediately for an empty pool', () => {
		expect(new PracticeRun([], 5).finished).toBe(true);
	});
});

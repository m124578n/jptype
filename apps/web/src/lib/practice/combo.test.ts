import { describe, expect, it } from 'vitest';
import type { KeyEvent } from '@jptype/engine';
import { applyComboKey, maxComboFromLog, milestoneCrossed, type ComboState } from './combo.ts';

const state = (): ComboState => ({ combo: 0, maxCombo: 0, milestone: 0, milestoneAt: 0 });
const log = (pattern: string): KeyEvent[] =>
	[...pattern].map((c, i) => ({ t: i * 10, key: 'a', ok: c === '.' }));

describe('milestoneCrossed', () => {
	it('fires exactly on the crossing key', () => {
		expect(milestoneCrossed(9, 10)).toBe(10);
		expect(milestoneCrossed(10, 11)).toBe(0);
		expect(milestoneCrossed(49, 50)).toBe(50);
		expect(milestoneCrossed(99, 100)).toBe(100);
		expect(milestoneCrossed(100, 101)).toBe(0);
	});

	it('reports the highest milestone when the combo jumps', () => {
		expect(milestoneCrossed(0, 60)).toBe(50);
	});
});

describe('applyComboKey', () => {
	it('counts correct keys and remembers the best streak', () => {
		const s = state();
		for (let i = 0; i < 12; i++) applyComboKey(s, true, i);
		expect(s.combo).toBe(12);
		expect(s.maxCombo).toBe(12);
		applyComboKey(s, false, 99);
		expect(s.combo).toBe(0);
		expect(s.maxCombo).toBe(12);
		applyComboKey(s, true, 100);
		expect(s.combo).toBe(1);
		expect(s.maxCombo).toBe(12);
	});

	it('records the milestone and its timestamp', () => {
		const s = state();
		for (let i = 1; i <= 9; i++) applyComboKey(s, true, i);
		expect(s.milestone).toBe(0);
		expect(s.milestoneAt).toBe(0);
		applyComboKey(s, true, 1234);
		expect(s.milestone).toBe(10);
		expect(s.milestoneAt).toBe(1234);
		// Later keys leave the milestone alone until the next one is reached.
		applyComboKey(s, true, 1300);
		expect(s.milestoneAt).toBe(1234);
	});
});

describe('maxComboFromLog', () => {
	it('finds the longest run of accepted keys', () => {
		expect(maxComboFromLog([])).toBe(0);
		expect(maxComboFromLog(log('xxx'))).toBe(0);
		expect(maxComboFromLog(log('..x...x.'))).toBe(3);
		expect(maxComboFromLog(log('.....'))).toBe(5);
	});
});

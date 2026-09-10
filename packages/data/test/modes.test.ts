import { describe, expect, it } from 'vitest';
import {
	lessonMode,
	parseMode,
	poolForMode,
	TIMED_POOLS,
	timedMode,
	toKatakana,
	findLesson
} from '../src/index.ts';

describe('TIMED_POOLS', () => {
	it('allhira = seion + dakuon + handakuon + yōon in hiragana (no small kana, no foreign)', () => {
		expect(TIMED_POOLS.allhira).toHaveLength(46 + 20 + 5 + 36);
		expect(TIMED_POOLS.allhira).toContain('きゃ');
		expect(TIMED_POOLS.allhira).not.toContain('っ');
		expect(TIMED_POOLS.allhira).not.toContain('ふぁ');
		expect(TIMED_POOLS.allhira.every((k) => toKatakana(k) !== k)).toBe(true);
	});

	it('allkata adds the foreign sounds and is all katakana', () => {
		expect(TIMED_POOLS.allkata).toHaveLength(46 + 20 + 5 + 36 + 25);
		expect(TIMED_POOLS.allkata).toContain('ファ');
		expect(TIMED_POOLS.allkata.every((k) => toKatakana(k) === k)).toBe(true);
	});

	it('all is the union', () => {
		expect(TIMED_POOLS.all).toHaveLength(TIMED_POOLS.allhira.length + TIMED_POOLS.allkata.length);
	});
});

describe('mode strings', () => {
	it('round-trips timed modes', () => {
		expect(timedMode('allhira', 60)).toBe('timed:allhira:60');
		expect(parseMode('timed:allhira:60')).toEqual({ kind: 'timed', pool: 'allhira', seconds: 60 });
		expect(parseMode('timed:all:120')).toEqual({ kind: 'timed', pool: 'all', seconds: 120 });
	});

	it('round-trips lesson modes', () => {
		expect(lessonMode('hira-a')).toBe('lesson:hira-a');
		expect(parseMode('lesson:hira-a')).toEqual({ kind: 'lesson', lessonId: 'hira-a' });
	});

	it('rejects malformed or unknown modes', () => {
		for (const bad of [
			'',
			'timed',
			'timed:allhira',
			'timed:allhira:45',
			'timed:n5:60',
			'lesson:',
			'lesson:nope',
			'lesson:hira-a:1',
			'race:allhira:60'
		]) {
			expect(parseMode(bad), bad).toBeUndefined();
		}
	});

	it('poolForMode returns the timed pool or the lesson units', () => {
		expect(poolForMode('timed:allkata:30')).toBe(TIMED_POOLS.allkata);
		expect(poolForMode('lesson:kata-ka')).toBe(findLesson('kata-ka')?.units);
		expect(poolForMode('nope')).toBeUndefined();
	});
});

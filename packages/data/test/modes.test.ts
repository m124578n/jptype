import { describe, expect, it } from 'vitest';
import {
	contentMode,
	lessonMode,
	parseMode,
	poolForMode,
	TIMED_POOLS,
	timedMode,
	toKatakana,
	findLesson,
	WEAK_MODE,
	WORDS_N5
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

	it('n5 is the 100 word readings (spec §7.2)', () => {
		expect(TIMED_POOLS.n5).toEqual(WORDS_N5.map((w) => w.kana));
		expect(TIMED_POOLS.n5).toHaveLength(100);
	});
});

describe('mode strings', () => {
	it('round-trips timed modes', () => {
		expect(timedMode('allhira', 60)).toBe('timed:allhira:60');
		expect(parseMode('timed:allhira:60')).toEqual({ kind: 'timed', pool: 'allhira', seconds: 60 });
		expect(parseMode('timed:all:120')).toEqual({ kind: 'timed', pool: 'all', seconds: 120 });
		expect(parseMode('timed:n5:60')).toEqual({ kind: 'timed', pool: 'n5', seconds: 60 });
	});

	it('parses the weak-practice mode with the full pool', () => {
		expect(parseMode(WEAK_MODE)).toEqual({ kind: 'weak' });
		expect(poolForMode('weak')).toBe(TIMED_POOLS.all);
	});

	it('round-trips lesson modes', () => {
		expect(lessonMode('hira-a')).toBe('lesson:hira-a');
		expect(parseMode('lesson:hira-a')).toEqual({ kind: 'lesson', lessonId: 'hira-a' });
	});

	it('round-trips content modes with a shape-only id check', () => {
		expect(contentMode('01JABCDEF0123456789ABCDEF')).toBe('content:01JABCDEF0123456789ABCDEF');
		expect(parseMode('content:01JABCDEF0123456789ABCDEF')).toEqual({
			kind: 'content',
			contentId: '01JABCDEF0123456789ABCDEF'
		});
		// The pool of a content lives in D1, so this package cannot supply one.
		expect(poolForMode('content:01JABCDEF0123456789ABCDEF')).toBeUndefined();
	});

	it('rejects malformed or unknown modes', () => {
		for (const bad of [
			'',
			'timed',
			'timed:allhira',
			'timed:allhira:45',
			'timed:n5:45',
			'timed:words:60',
			'lesson:',
			'lesson:nope',
			'lesson:hira-a:1',
			'race:allhira:60',
			'content:',
			'content:a:b',
			'content:has space',
			`content:${'x'.repeat(65)}`
		]) {
			expect(parseMode(bad), bad).toBeUndefined();
		}
	});

	it('poolForMode returns the timed pool or the lesson units', () => {
		expect(poolForMode('timed:allkata:30')).toBe(TIMED_POOLS.allkata);
		expect(poolForMode('timed:n5:120')).toBe(TIMED_POOLS.n5);
		expect(poolForMode('lesson:kata-ka')).toBe(findLesson('kata-ka')?.units);
		expect(poolForMode('nope')).toBeUndefined();
	});
});

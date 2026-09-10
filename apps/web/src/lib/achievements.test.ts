import { describe, expect, it } from 'vitest';
import {
	achievementStatsFromHistory,
	ACHIEVEMENT_IDS,
	EMPTY_ACHIEVEMENT_STATS,
	isUnlocked,
	unlockedAchievements
} from './achievements.ts';
import type { RunHistoryEntry } from './storage.ts';

const stats = (over: Partial<typeof EMPTY_ACHIEVEMENT_STATS> = {}) => ({
	...EMPTY_ACHIEVEMENT_STATS,
	...over
});

const entry = (over: Partial<RunHistoryEntry> = {}): RunHistoryEntry => ({
	mode: 'lesson:hira-a',
	score: 90,
	kpm: 90,
	accuracy: 0.95,
	durationMs: 30_000,
	keys: 40,
	maxCombo: 12,
	at: 1000,
	...over
});

describe('unlockedAchievements', () => {
	it('unlocks nothing before the first run', () => {
		expect(unlockedAchievements(EMPTY_ACHIEVEMENT_STATS)).toEqual([]);
	});

	it('unlocks First Practice on the first run only', () => {
		expect(unlockedAchievements(stats({ totalRuns: 1 }))).toEqual(['first_practice']);
	});

	it('applies each threshold exactly', () => {
		expect(isUnlocked('lessons_10', stats({ totalRuns: 9 }))).toBe(false);
		expect(isUnlocked('lessons_10', stats({ totalRuns: 10 }))).toBe(true);
		expect(isUnlocked('kpm_100', stats({ bestKpm: 99 }))).toBe(false);
		expect(isUnlocked('kpm_100', stats({ bestKpm: 100 }))).toBe(true);
		expect(isUnlocked('combo_100', stats({ maxCombo: 99 }))).toBe(false);
		expect(isUnlocked('combo_100', stats({ maxCombo: 100 }))).toBe(true);
		expect(isUnlocked('perfect', stats({ perfectRuns: 1 }))).toBe(true);
	});

	it('returns everything in display order once all rules pass', () => {
		expect(
			unlockedAchievements({ totalRuns: 10, maxCombo: 100, bestKpm: 120, perfectRuns: 2 })
		).toEqual([...ACHIEVEMENT_IDS]);
	});
});

describe('achievementStatsFromHistory', () => {
	it('is empty for an empty history', () => {
		expect(achievementStatsFromHistory([])).toEqual(EMPTY_ACHIEVEMENT_STATS);
	});

	it('takes the best combo and kpm and counts long perfect runs', () => {
		expect(
			achievementStatsFromHistory([
				entry({ maxCombo: 30, kpm: 80 }),
				entry({ maxCombo: 110, kpm: 140, accuracy: 1, keys: 25 }),
				entry({ accuracy: 1, keys: 19 }) // perfect but too short
			])
		).toEqual({ totalRuns: 3, maxCombo: 110, bestKpm: 140, perfectRuns: 1 });
	});
});

import type { RunHistoryEntry } from './storage.ts';

/**
 * Achievements (ROADMAP M4-3). Derived, never stored: every rule is a threshold over numbers
 * `/me` already has, so there is no `user_achievements` table to keep in sync and no way for a
 * badge to disagree with the stats next to it.
 */

export type AchievementId = 'first_practice' | 'combo_100' | 'kpm_100' | 'perfect' | 'lessons_10';

/** A run only counts as Perfect if it was long enough to be worth something. */
export const PERFECT_MIN_KEYS = 20;
export const COMBO_TARGET = 100;
/** ROADMAP says "CPM > 100"; the engine measures keys per minute, so KPM ≥ 100 is the rule. */
export const KPM_TARGET = 100;
export const RUNS_TARGET = 10;

/** Everything the rules look at, from D1 for logged-in users and from localStorage otherwise. */
export interface AchievementStats {
	/** Runs ever recorded. */
	totalRuns: number;
	/** Best `max_combo` over all runs. */
	maxCombo: number;
	bestKpm: number;
	/** Runs with accuracy 1 and at least `PERFECT_MIN_KEYS` keys. */
	perfectRuns: number;
}

export const EMPTY_ACHIEVEMENT_STATS: AchievementStats = {
	totalRuns: 0,
	maxCombo: 0,
	bestKpm: 0,
	perfectRuns: 0
};

/** Display order on `/me`: easiest first. */
export const ACHIEVEMENT_IDS: readonly AchievementId[] = [
	'first_practice',
	'perfect',
	'lessons_10',
	'kpm_100',
	'combo_100'
];

const RULES: Readonly<Record<AchievementId, (s: AchievementStats) => boolean>> = {
	first_practice: (s) => s.totalRuns >= 1,
	perfect: (s) => s.perfectRuns >= 1,
	lessons_10: (s) => s.totalRuns >= RUNS_TARGET,
	kpm_100: (s) => s.bestKpm >= KPM_TARGET,
	combo_100: (s) => s.maxCombo >= COMBO_TARGET
};

export function isUnlocked(id: AchievementId, stats: AchievementStats): boolean {
	return RULES[id](stats);
}

/** Unlocked ids in `ACHIEVEMENT_IDS` order. */
export function unlockedAchievements(stats: AchievementStats): AchievementId[] {
	return ACHIEVEMENT_IDS.filter((id) => isUnlocked(id, stats));
}

/** The same numbers from this browser's rolling run history (logged-out `/me`). */
export function achievementStatsFromHistory(history: readonly RunHistoryEntry[]): AchievementStats {
	const stats = { ...EMPTY_ACHIEVEMENT_STATS, totalRuns: history.length };
	for (const run of history) {
		if (run.maxCombo > stats.maxCombo) stats.maxCombo = run.maxCombo;
		if (run.kpm > stats.bestKpm) stats.bestKpm = run.kpm;
		if (run.accuracy >= 1 && run.keys >= PERFECT_MIN_KEYS) stats.perfectRuns += 1;
	}
	return stats;
}

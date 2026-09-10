import { DAY_MS, taipeiDate, weekOf } from './time.ts';

/**
 * Practice-time and 30-day averages (ROADMAP M4-3). One implementation for both sides of `/me`:
 * the server feeds it rows from `runs`, the logged-out page feeds it the localStorage history.
 */

/** The only fields the summary needs from a run. */
export interface RunSample {
	/** epoch ms */
	at: number;
	durationMs: number;
	kpm: number;
	/** 0..1 */
	accuracy: number;
}

export interface PracticeSummary {
	/** Typing time today (Taipei calendar day). */
	todayMs: number;
	/** Typing time this ISO week (Taipei, weeks start Monday). */
	weekMs: number;
	/** Mean accuracy of the last 30 days, 0..1; 0 when there are no runs. */
	avgAccuracy30: number;
	/** Mean KPM of the last 30 days; 0 when there are no runs. */
	avgKpm30: number;
	/** How many runs the averages are based on. */
	runs30: number;
}

export const EMPTY_PRACTICE_SUMMARY: PracticeSummary = {
	todayMs: 0,
	weekMs: 0,
	avgAccuracy30: 0,
	avgKpm30: 0,
	runs30: 0
};

/** Days of history the averages look at. */
export const SUMMARY_DAYS = 30;

/**
 * `samples` is expected to already be the last 30 days; anything older is ignored here too, so
 * passing a longer window is harmless. Today and this week are subsets of that window.
 */
export function summarize(samples: readonly RunSample[], nowMs: number): PracticeSummary {
	const today = taipeiDate(nowMs);
	const week = weekOf(nowMs);
	const cutoff = nowMs - SUMMARY_DAYS * DAY_MS;

	let todayMs = 0;
	let weekMs = 0;
	let accuracy = 0;
	let kpm = 0;
	let runs30 = 0;

	for (const s of samples) {
		if (s.at <= cutoff) continue;
		if (taipeiDate(s.at) === today) todayMs += s.durationMs;
		if (weekOf(s.at) === week) weekMs += s.durationMs;
		accuracy += s.accuracy;
		kpm += s.kpm;
		runs30 += 1;
	}

	return {
		todayMs,
		weekMs,
		avgAccuracy30: runs30 === 0 ? 0 : accuracy / runs30,
		avgKpm30: runs30 === 0 ? 0 : kpm / runs30,
		runs30
	};
}

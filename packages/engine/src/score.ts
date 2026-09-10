import type { KeyEvent, ScoreResult } from './types.ts';

/**
 * Spec §6.5:
 *   correctKeys = ok=true count, wrongKeys = ok=false count
 *   kpm         = correctKeys / (durationMs / 60000)
 *   accuracy    = correctKeys / (correctKeys + wrongKeys)   (0 when no keys)
 *   score       = round(kpm * accuracy ** 2)
 */
export function score(log: readonly KeyEvent[], durationMs: number): ScoreResult {
	let correctKeys = 0;
	let wrongKeys = 0;
	for (const e of log) {
		if (e.ok) correctKeys++;
		else wrongKeys++;
	}
	const total = correctKeys + wrongKeys;
	const accuracy = total === 0 ? 0 : correctKeys / total;
	const kpm = durationMs > 0 ? correctKeys / (durationMs / 60_000) : 0;
	return {
		kpm,
		accuracy,
		score: Math.round(kpm * accuracy ** 2),
		correctKeys,
		wrongKeys
	};
}

import type { KeyEvent } from '@jptype/engine';

/**
 * Combo = consecutive **accepted keys** (M4-3). One wrong key resets it to 0; keys the engine
 * ignores (Shift, Backspace…) never reach the counter because they are not logged.
 * Units and questions do not matter: finishing a question keeps the streak alive.
 */

/** Combo values worth celebrating; the UI flashes when one is crossed. */
export const COMBO_MILESTONES: readonly number[] = [10, 20, 50, 100];

/** Only show the live combo once it is worth looking at. */
export const COMBO_VISIBLE_AT = 5;

/**
 * The milestone crossed by going from `before` to `after` consecutive correct keys, or 0.
 * The combo grows one key at a time so at most one milestone is ever crossed; `Math.max`
 * only guards against a caller that jumps.
 */
export function milestoneCrossed(before: number, after: number): number {
	let hit = 0;
	for (const m of COMBO_MILESTONES) {
		if (before < m && after >= m) hit = Math.max(hit, m);
	}
	return hit;
}

/** The four counters a run keeps for its combo; `PracticeRun` and `SongSyncRun` both satisfy it. */
export interface ComboState {
	combo: number;
	maxCombo: number;
	milestone: number;
	milestoneAt: number;
}

/**
 * Fold one **logged** key into the counters, in place. Callers must not pass keys the engine
 * ignored: they are not part of the streak in either direction.
 */
export function applyComboKey(state: ComboState, ok: boolean, nowMs: number): void {
	if (!ok) {
		state.combo = 0;
		return;
	}
	const before = state.combo;
	state.combo = before + 1;
	if (state.combo > state.maxCombo) state.maxCombo = state.combo;
	const hit = milestoneCrossed(before, state.combo);
	if (hit > 0) {
		state.milestone = hit;
		state.milestoneAt = nowMs;
	}
}

/**
 * Longest run of accepted keys in a key log. The server recomputes `runs.max_combo` with this
 * instead of trusting the client's number (DECISIONS「M4-3 實作」).
 */
export function maxComboFromLog(log: readonly KeyEvent[]): number {
	let best = 0;
	let current = 0;
	for (const e of log) {
		if (e.ok) {
			current += 1;
			if (current > best) best = current;
		} else {
			current = 0;
		}
	}
	return best;
}

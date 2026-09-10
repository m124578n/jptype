import { KANA, SYMBOLS } from '@jptype/data';

/**
 * Error analysis for the result page (ROADMAP M4-3): which kana the typist got wrong, and
 * which *spellings* they reached for instead.
 *
 * Input is one record per rejected key, captured by `PracticeRun` / `SongSyncRun` while the run
 * happens. It is not re-derived from `log`, because a log only replays cleanly for a run whose
 * `text` matches it: 同步模式 skips and re-types lines, and a timed run stops mid-question.
 * Recording at press time costs one small object per wrong key and is always exact.
 */

/** One rejected key, with everything needed to name the mistake. */
export interface KeyError {
	/** The unit the typist was on. */
	kana: string;
	/** Every spelling that unit accepted here, hint first. */
	romaji: readonly string[];
	/** Letters already accepted for the unit when the wrong key arrived ('' at a unit's start). */
	typed: string;
	/** The rejected key, lowercased. */
	key: string;
}

export interface WrongUnitCount {
	kana: string;
	/** Rejected keys pressed while this kana was the target. */
	count: number;
}

export interface WrongSpelling {
	kana: string;
	/** The spelling the engine was waiting for, e.g. `shi`. */
	expected: string;
	/** What the typist appears to have been spelling instead, e.g. `si`, or a single stray key. */
	typed: string;
	count: number;
}

export interface ErrorAnalysis {
	units: WrongUnitCount[];
	spellings: WrongSpelling[];
}

export const EMPTY_ERROR_ANALYSIS: ErrorAnalysis = { units: [], spellings: [] };

/** Every prefix of every romaji spelling in the kana table, plus the symbol keys. */
const SPELLING_PREFIXES: ReadonlySet<string> = (() => {
	const prefixes = new Set<string>();
	const add = (spelling: string) => {
		for (let i = 1; i <= spelling.length; i++) prefixes.add(spelling.slice(0, i));
	};
	for (const entry of KANA) for (const r of entry.romaji) add(r);
	for (const s of Object.values(SYMBOLS)) add(s);
	// The engine also accepts a bare `ん` and doubled consonants for っ; both are covered by
	// the table's own prefixes ('n' from な行, 'kk' is handled below by the single-key fallback).
	return prefixes;
})();

/**
 * Heuristic (kept deliberately dumb so the result is reproducible):
 *
 * - `expected` is the spelling the engine was still waiting for — the first one compatible with
 *   what had already been typed, i.e. exactly the hint shown on screen.
 * - `attempt` = accepted prefix + the rejected key. When that string could start *some* kana's
 *   spelling, the typist was plausibly spelling a different romanization, so report the whole
 *   attempt (`shi → si`). Otherwise it was a stray key, so report just the key (`shi → q`).
 *
 * A key that would have been accepted never reaches here, so `attempt` is never a valid
 * continuation of `expected` itself.
 */
export function describeError(error: KeyError): WrongSpelling {
	const expected = error.romaji.find((r) => r.startsWith(error.typed)) ?? error.romaji[0] ?? '';
	const attempt = error.typed + error.key;
	return {
		kana: error.kana,
		expected,
		typed: SPELLING_PREFIXES.has(attempt) ? attempt : error.key,
		count: 1
	};
}

function rank<T extends { count: number }>(rows: T[], limit: number): T[] {
	// Sort is stable, so equal counts keep first-error order.
	return rows.sort((a, b) => b.count - a.count).slice(0, limit);
}

/** Top wrong kana and top wrong spellings, most frequent first. */
export function analyzeErrors(errors: readonly KeyError[], limit = 5): ErrorAnalysis {
	const unitCounts: WrongUnitCount[] = [];
	const spellings: WrongSpelling[] = [];

	for (const error of errors) {
		const unit = unitCounts.find((u) => u.kana === error.kana);
		if (unit) unit.count += 1;
		else unitCounts.push({ kana: error.kana, count: 1 });

		const described = describeError(error);
		const same = spellings.find(
			(s) =>
				s.kana === described.kana &&
				s.expected === described.expected &&
				s.typed === described.typed
		);
		if (same) same.count += 1;
		else spellings.push(described);
	}

	return { units: rank(unitCounts, limit), spellings: rank(spellings, limit) };
}

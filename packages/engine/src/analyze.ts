import { score } from './score.ts';
import { isTypingKey, TypingSession } from './session.ts';
import type { KeyEvent, ScoreResult } from './types.ts';

export interface UnitOutcome {
	kana: string;
	/** True when at least one wrong key was pressed while this unit was current. */
	error: boolean;
}

export interface Analysis {
	result: ScoreResult;
	/** One entry per completed unit, in order (a partially typed last unit is omitted). */
	outcomes: UnitOutcome[];
}

export type AnalyzeResult = Analysis | { invalid: string };

/**
 * `replay()` plus per-unit outcomes (spec §9.7: kana_stats are updated from whether each
 * unit was typed correctly on the first attempt). Same validation rules as `replay()`.
 */
export function analyze(
	text: string,
	log: readonly KeyEvent[],
	durationMs?: number
): AnalyzeResult {
	if (log.length === 0) return { invalid: 'empty log' };

	const session = new TypingSession(text);
	const outcomes: UnitOutcome[] = [];
	let lastT = -Infinity;
	let currentErrored = false;

	for (const [i, e] of log.entries()) {
		if (typeof e.t !== 'number' || !Number.isFinite(e.t) || e.t < lastT) {
			return { invalid: `event ${i}: time is not monotonic` };
		}
		lastT = e.t;
		if (typeof e.key !== 'string' || !isTypingKey(e.key)) {
			return { invalid: `event ${i}: key "${String(e.key)}" is not a typing key` };
		}
		if (session.finished) return { invalid: `event ${i}: key after text finished` };

		const unit = session.units[session.progress.unitIndex];
		const r = session.press(e.key, e.t);
		if (r.ok !== e.ok) return { invalid: `event ${i}: ok=${e.ok} but engine says ${r.ok}` };
		if (!r.ok) currentErrored = true;
		if (r.unitDone && unit) {
			outcomes.push({ kana: unit.kana, error: currentErrored });
			currentErrored = false;
		}
	}

	return { result: score(session.log, durationMs ?? lastT), outcomes };
}

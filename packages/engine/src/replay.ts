import { score } from './score.ts';
import { isTypingKey, TypingSession } from './session.ts';
import type { KeyEvent, ScoreResult } from './types.ts';

export type ReplayResult = ScoreResult | { invalid: string };

/**
 * Server-side verification (spec §6.1): re-run `log` against `text` with a fresh session and
 * require every recorded `ok` to match what the engine would have decided. Returns the
 * recomputed score, never the client's numbers.
 *
 * `durationMs` defaults to the timestamp of the last event (events are relative to session start).
 * The text may be only partially typed (timed mode).
 */
export function replay(text: string, log: readonly KeyEvent[], durationMs?: number): ReplayResult {
	if (log.length === 0) return { invalid: 'empty log' };

	const session = new TypingSession(text);
	let lastT = -Infinity;

	for (const [i, e] of log.entries()) {
		if (typeof e.t !== 'number' || !Number.isFinite(e.t) || e.t < lastT) {
			return { invalid: `event ${i}: time is not monotonic` };
		}
		lastT = e.t;
		if (typeof e.key !== 'string' || !isTypingKey(e.key)) {
			return { invalid: `event ${i}: key "${String(e.key)}" is not a typing key` };
		}
		if (session.finished) return { invalid: `event ${i}: key after text finished` };

		const r = session.press(e.key, e.t);
		if (r.ok !== e.ok) return { invalid: `event ${i}: ok=${e.ok} but engine says ${r.ok}` };
	}

	return score(session.log, durationMs ?? lastT);
}

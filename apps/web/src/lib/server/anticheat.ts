import type { KeyEvent, ScoreResult } from '@jptype/engine';
import type { ParsedMode } from '@jptype/data';

export interface AnticheatInput {
	log: readonly KeyEvent[];
	durationMs: number;
	mode: ParsedMode;
	result: ScoreResult;
	/** Runs by the same user in the last 5 minutes, excluding this one (rule 6). */
	recentRuns: number;
}

export const KPM_LIMIT = 800;
export const MIN_MEDIAN_INTERVAL_MS = 40;
export const MIN_STDDEV_MS = 8;
export const STDDEV_MIN_KEYS = 30;
export const DURATION_TOLERANCE_MS = 3000;
export const TIMED_OVERRUN_MS = 2000;
export const MAX_RUNS_PER_5MIN = 20;

function median(values: number[]): number {
	const s = [...values].sort((a, b) => a - b);
	const mid = Math.floor(s.length / 2);
	return s.length % 2 ? (s[mid] as number) : ((s[mid - 1] as number) + (s[mid] as number)) / 2;
}

function stddev(values: number[]): number {
	const mean = values.reduce((a, b) => a + b, 0) / values.length;
	const variance = values.reduce((a, b) => a + (b - mean) ** 2, 0) / values.length;
	return Math.sqrt(variance);
}

/**
 * Spec §9.5. Returns every rule that fired (empty → clean). The response never exposes
 * these reasons; they are for logs / future review tooling only.
 */
export function anticheatReasons(input: AnticheatInput): string[] {
	const { log, durationMs, mode, result, recentRuns } = input;
	const reasons: string[] = [];

	if (result.kpm > KPM_LIMIT) reasons.push('kpm_too_high');

	const intervals: number[] = [];
	for (let i = 1; i < log.length; i++) {
		intervals.push((log[i] as KeyEvent).t - (log[i - 1] as KeyEvent).t);
	}
	if (intervals.length > 0 && median(intervals) < MIN_MEDIAN_INTERVAL_MS) {
		reasons.push('median_interval_too_short');
	}
	if (log.length > STDDEV_MIN_KEYS && stddev(intervals) < MIN_STDDEV_MS) {
		reasons.push('rhythm_too_regular');
	}

	const first = log[0];
	const last = log[log.length - 1];
	if (first && last && Math.abs(last.t - first.t - durationMs) > DURATION_TOLERANCE_MS) {
		reasons.push('duration_mismatch');
	}

	if (mode.kind === 'timed' && durationMs > mode.seconds * 1000 + TIMED_OVERRUN_MS) {
		reasons.push('timed_overrun');
	}

	if (recentRuns >= MAX_RUNS_PER_5MIN) reasons.push('too_many_runs');

	return reasons;
}

import { describe, expect, it } from 'vitest';
import type { KeyEvent } from '@jptype/engine';
import { anticheatReasons, type AnticheatInput } from './anticheat.ts';

/** n correct keys spaced `step` ms apart, with optional per-key jitter. */
function log(n: number, step: number, jitter = 0): KeyEvent[] {
	let t = 0;
	return Array.from({ length: n }, (_, i) => {
		t += step + (jitter ? ((i * 7919) % (2 * jitter + 1)) - jitter : 0);
		return { t, key: 'a', ok: true };
	});
}

function input(over: Partial<AnticheatInput> = {}): AnticheatInput {
	const l = over.log ?? log(60, 150, 40);
	const span = (l[l.length - 1]?.t ?? 0) - (l[0]?.t ?? 0);
	return {
		log: l,
		durationMs: span,
		mode: { kind: 'timed', pool: 'allhira', seconds: 60 },
		result: { kpm: 400, accuracy: 1, score: 400, correctKeys: l.length, wrongKeys: 0 },
		recentRuns: 0,
		...over
	};
}

describe('anticheatReasons', () => {
	it('is empty for a human-looking run', () => {
		expect(anticheatReasons(input())).toEqual([]);
	});

	it('flags kpm above 800', () => {
		expect(anticheatReasons(input({ result: { ...input().result, kpm: 801 } }))).toContain(
			'kpm_too_high'
		);
	});

	it('flags a median key interval under 40 ms', () => {
		const l = log(50, 30, 5);
		expect(anticheatReasons(input({ log: l }))).toContain('median_interval_too_short');
	});

	it('flags machine-like rhythm (stddev < 8 ms over > 30 keys) but not short logs', () => {
		expect(anticheatReasons(input({ log: log(40, 100, 0) }))).toContain('rhythm_too_regular');
		expect(anticheatReasons(input({ log: log(30, 100, 0) }))).not.toContain('rhythm_too_regular');
	});

	it('flags when the log span disagrees with durationMs by more than 3 s', () => {
		const base = input();
		expect(anticheatReasons({ ...base, durationMs: base.durationMs + 3001 })).toContain(
			'duration_mismatch'
		);
		expect(anticheatReasons({ ...base, durationMs: base.durationMs + 2999 })).not.toContain(
			'duration_mismatch'
		);
	});

	it('flags timed runs longer than the limit + 2 s', () => {
		const l = log(400, 160, 40); // ~64 s span
		const span = (l[l.length - 1]?.t ?? 0) - (l[0]?.t ?? 0);
		expect(span).toBeGreaterThan(62_000);
		expect(anticheatReasons(input({ log: l, durationMs: span }))).toContain('timed_overrun');
		expect(
			anticheatReasons(input({ log: l, durationMs: span, mode: { kind: 'lesson', lessonId: 'x' } }))
		).not.toContain('timed_overrun');
	});

	it('flags more than 20 runs in 5 minutes', () => {
		expect(anticheatReasons(input({ recentRuns: 20 }))).toContain('too_many_runs');
		expect(anticheatReasons(input({ recentRuns: 19 }))).not.toContain('too_many_runs');
	});
});

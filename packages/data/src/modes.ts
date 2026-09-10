import { KANA } from './kana.ts';
import { findLesson } from './lessons.ts';

/** Pools selectable in timed mode (spec §7.2). `n5` arrives with M3. */
export const TIMED_POOL_IDS = ['allhira', 'allkata', 'all'] as const;
export type TimedPoolId = (typeof TIMED_POOL_IDS)[number];

export const TIMED_SECONDS = [30, 60, 120] as const;
export type TimedSeconds = (typeof TIMED_SECONDS)[number];

const CORE = KANA.filter((e) => e.group !== 'small' && e.group !== 'foreign');
const FOREIGN = KANA.filter((e) => e.group === 'foreign');

const ALL_HIRA = CORE.map((e) => e.kana);
const ALL_KATA = [...CORE, ...FOREIGN].map((e) => e.kata);

export const TIMED_POOLS: Readonly<Record<TimedPoolId, readonly string[]>> = {
	allhira: ALL_HIRA,
	allkata: ALL_KATA,
	all: [...ALL_HIRA, ...ALL_KATA]
};

/** Mode string for 弱項練習 (spec §7.3): questions may be any kana, so its pool is `all`. */
export const WEAK_MODE = 'weak';

export type ParsedMode =
	| { kind: 'timed'; pool: TimedPoolId; seconds: TimedSeconds }
	| { kind: 'lesson'; lessonId: string }
	| { kind: 'weak' };

export function timedMode(pool: TimedPoolId, seconds: TimedSeconds): string {
	return `timed:${pool}:${seconds}`;
}

export function lessonMode(lessonId: string): string {
	return `lesson:${lessonId}`;
}

/** Parse a `mode` string (`timed:{pool}:{seconds}` | `lesson:{id}` | `weak`); undefined when malformed. */
export function parseMode(mode: string): ParsedMode | undefined {
	if (mode === WEAK_MODE) return { kind: 'weak' };
	const parts = mode.split(':');
	if (parts[0] === 'timed' && parts.length === 3) {
		const pool = parts[1] as TimedPoolId;
		const seconds = Number(parts[2]) as TimedSeconds;
		if (!TIMED_POOL_IDS.includes(pool) || !TIMED_SECONDS.includes(seconds)) return undefined;
		return { kind: 'timed', pool, seconds };
	}
	if (parts[0] === 'lesson' && parts.length === 2 && parts[1] && findLesson(parts[1])) {
		return { kind: 'lesson', lessonId: parts[1] };
	}
	return undefined;
}

/** Question pool a mode draws from; undefined for unknown modes. */
export function poolForMode(mode: string): readonly string[] | undefined {
	const parsed = parseMode(mode);
	if (!parsed) return undefined;
	if (parsed.kind === 'timed') return TIMED_POOLS[parsed.pool];
	if (parsed.kind === 'weak') return TIMED_POOLS.all;
	return findLesson(parsed.lessonId)?.units;
}

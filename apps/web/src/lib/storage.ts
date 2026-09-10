/**
 * localStorage persistence for the logged-out experience (spec M1).
 * Every read is defensive: storage may be unavailable, empty or corrupted.
 */
import type { ScoreResult } from '@jptype/engine';

const PREFIX = 'jptype:';

export interface Settings {
	sound: boolean;
	volume: number; // 0..1
	showHint: boolean;
	showKeyboard: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
	sound: true,
	volume: 0.6,
	showHint: true,
	showKeyboard: true
};

export interface LessonResult {
	best: Pick<ScoreResult, 'score' | 'kpm' | 'accuracy'>;
	attempts: number;
	lastAt: number; // epoch ms
}

export type LessonResults = Record<string, LessonResult>;

export interface KanaStat {
	attempts: number;
	errors: number;
}

export type KanaStats = Record<string, KanaStat>;

function read<T>(key: string, fallback: T): T {
	try {
		const raw = globalThis.localStorage?.getItem(PREFIX + key);
		if (raw === null || raw === undefined) return fallback;
		return { ...fallback, ...(JSON.parse(raw) as object) } as T;
	} catch {
		return fallback;
	}
}

function write(key: string, value: unknown): void {
	try {
		globalThis.localStorage?.setItem(PREFIX + key, JSON.stringify(value));
	} catch {
		// quota / private mode: silently ignore
	}
}

export function loadSettings(): Settings {
	return read('settings', DEFAULT_SETTINGS);
}

export function saveSettings(settings: Settings): void {
	write('settings', settings);
}

export function loadResults(): LessonResults {
	return read<LessonResults>('results', {});
}

/** Record a finished run; returns true when it set a new best score. */
export function recordResult(lessonId: string, result: ScoreResult, now = Date.now()): boolean {
	const all = loadResults();
	const prev = all[lessonId];
	const isBest = !prev || result.score > prev.best.score;
	all[lessonId] = {
		best: isBest ? { score: result.score, kpm: result.kpm, accuracy: result.accuracy } : prev.best,
		attempts: (prev?.attempts ?? 0) + 1,
		lastAt: now
	};
	write('results', all);
	return isBest;
}

export function loadKanaStats(): KanaStats {
	return read<KanaStats>('kana_stats', {});
}

/** Merge per-unit outcomes of one run into the stored kana stats. */
export function recordKanaStats(outcomes: Iterable<{ kana: string; error: boolean }>): void {
	const stats = loadKanaStats();
	for (const { kana, error } of outcomes) {
		const s = stats[kana] ?? { attempts: 0, errors: 0 };
		s.attempts += 1;
		if (error) s.errors += 1;
		stats[kana] = s;
	}
	write('kana_stats', stats);
}

/** Spec §7.3: weak kana = error rate > 20 % with at least 3 attempts. */
export function weakKana(stats: KanaStats): string[] {
	return Object.entries(stats)
		.filter(([, s]) => s.attempts >= 3 && s.errors / s.attempts > 0.2)
		.sort((a, b) => b[1].errors / b[1].attempts - a[1].errors / a[1].attempts)
		.map(([kana]) => kana);
}

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

/**
 * One finished run, kept so the logged-out `/me` can show practice time, 30-day averages and
 * achievements without a server (M4-3). `keys` and `maxCombo` are what the achievement rules
 * need on top of the score; both default to 0 for callers that do not have them.
 */
export interface RunHistoryEntry {
	mode: string;
	score: number;
	kpm: number;
	/** 0..1 */
	accuracy: number;
	durationMs: number;
	/** Correct + wrong keys of the run. */
	keys: number;
	maxCombo: number;
	/** epoch ms */
	at: number;
}

/** Rolling window; old entries fall off the front. */
export const HISTORY_LIMIT = 200;

/** Arrays must not be merged key-by-key the way `read` merges objects. */
function readArray<T>(key: string): T[] {
	try {
		const raw = globalThis.localStorage?.getItem(PREFIX + key);
		if (raw === null || raw === undefined) return [];
		const parsed: unknown = JSON.parse(raw);
		return Array.isArray(parsed) ? (parsed as T[]) : [];
	} catch {
		return [];
	}
}

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

/** Runs recorded in this browser, oldest first (at most `HISTORY_LIMIT`). */
export function loadHistory(): RunHistoryEntry[] {
	return readArray<RunHistoryEntry>('history');
}

/** Append one run to the rolling history, dropping the oldest entries past the cap. */
export function recordHistory(entry: RunHistoryEntry): void {
	const history = loadHistory();
	history.push(entry);
	write('history', history.slice(-HISTORY_LIMIT));
}

/**
 * Record a finished run: per-mode best/attempts, plus one entry in the rolling history.
 * Returns true when it set a new best score.
 *
 * `durationMs` / `maxCombo` are optional so older call sites keep compiling; a run submitted
 * without them simply contributes 0 practice time and no combo achievement.
 */
export function recordResult(
	lessonId: string,
	result: ScoreResult,
	opts: { now?: number; durationMs?: number; maxCombo?: number } = {}
): boolean {
	const now = opts.now ?? Date.now();
	const all = loadResults();
	const prev = all[lessonId];
	const isBest = !prev || result.score > prev.best.score;
	all[lessonId] = {
		best: isBest ? { score: result.score, kpm: result.kpm, accuracy: result.accuracy } : prev.best,
		attempts: (prev?.attempts ?? 0) + 1,
		lastAt: now
	};
	write('results', all);
	recordHistory({
		mode: lessonId,
		score: result.score,
		kpm: result.kpm,
		accuracy: result.accuracy,
		durationMs: opts.durationMs ?? 0,
		keys: result.correctKeys + result.wrongKeys,
		maxCombo: opts.maxCombo ?? 0,
		at: now
	});
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

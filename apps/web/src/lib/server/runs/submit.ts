import { parseMode, poolForMode, type ParsedMode } from '@jptype/data';
import { analyze, BOUNDARY, type KeyEvent } from '@jptype/engine';
import { maxComboFromLog } from '../../practice/combo.ts';
import { anticheatReasons } from '../anticheat.ts';
import { ulid } from '../ulid.ts';
import { weekOf } from '../week.ts';
import type { RunStore } from './store.ts';

export interface RunSubmission {
	mode: string;
	text: string;
	durationMs: number;
	log: KeyEvent[];
	/**
	 * The client's own combo count (M4-3). Validated but **not stored**: the value written to
	 * `runs.max_combo` is recomputed from `log`, which the replay already proved genuine.
	 */
	maxCombo?: number;
}

/** Why an honest run is kept off the boards. Shown to the user, unlike an anticheat flag. */
export type UnrankedReason = 'accuracy';

export interface RunResponse {
	runId: string;
	score: number;
	kpm: number;
	accuracy: number;
	/** Present for logged-in, unflagged, ranked runs: rank on the weekly board. */
	rank?: number;
	/** Present when the run was stored but does not count for the boards (DECISIONS「分數規則定案」). */
	unranked?: UnrankedReason;
}

export type SubmitResult =
	{ ok: true; body: RunResponse } | { ok: false; status: 400; error: string };

export interface SubmitDeps {
	store: RunStore;
	/** R2-like: persist the raw key log (spec §9.6). */
	putLog(runId: string, log: readonly KeyEvent[]): Promise<void>;
	/** KV-like: drop cached leaderboards (spec §9.8). */
	invalidateLeaderboard(mode: string, week: string): Promise<void>;
	/**
	 * Pools that `@jptype/data` cannot supply, i.e. `content:{id}` whose lines live in D1
	 * (`server/mode.ts`). Returning undefined falls back to the static pool of the mode.
	 */
	poolForMode?(mode: string, parsed: ParsedMode): Promise<readonly string[] | undefined>;
	now?: () => number;
	newId?: (nowMs: number) => string;
}

export const MAX_LOG_EVENTS = 6000;
/** Below this accuracy a run is stored but never ranked (owner decision 2026-09-11). */
export const MIN_RANKED_ACCURACY = 0.9;

/** The reason a run stays off the boards, or null when it is eligible. */
export function unrankedReasonFor(accuracy: number): UnrankedReason | null {
	return accuracy < MIN_RANKED_ACCURACY ? 'accuracy' : null;
}
export const MAX_TEXT_CHARS = 4000;
const FIVE_MINUTES = 5 * 60 * 1000;

/** Structural validation of the JSON body; returns an error message or the typed body. */
export function parseSubmission(raw: unknown): RunSubmission | string {
	if (!raw || typeof raw !== 'object') return 'body must be an object';
	const b = raw as Record<string, unknown>;
	if (typeof b.mode !== 'string') return 'mode must be a string';
	if (typeof b.text !== 'string' || b.text.length > MAX_TEXT_CHARS) return 'text invalid';
	if (typeof b.durationMs !== 'number' || !Number.isFinite(b.durationMs) || b.durationMs < 0) {
		return 'durationMs invalid';
	}
	if (!Array.isArray(b.log) || b.log.length === 0 || b.log.length > MAX_LOG_EVENTS) {
		return 'log invalid';
	}
	const log: KeyEvent[] = [];
	for (const e of b.log as unknown[]) {
		if (!e || typeof e !== 'object') return 'log event invalid';
		const { t, key, ok } = e as Record<string, unknown>;
		if (typeof t !== 'number' || typeof key !== 'string' || typeof ok !== 'boolean') {
			return 'log event invalid';
		}
		log.push({ t, key, ok });
	}
	// Optional; a combo cannot exceed the number of keys pressed.
	if (b.maxCombo !== undefined) {
		if (
			typeof b.maxCombo !== 'number' ||
			!Number.isInteger(b.maxCombo) ||
			b.maxCombo < 0 ||
			b.maxCombo > log.length
		) {
			return 'maxCombo invalid';
		}
	}
	const sub: RunSubmission = {
		mode: b.mode,
		text: b.text,
		durationMs: Math.round(b.durationMs),
		log
	};
	if (b.maxCombo !== undefined) sub.maxCombo = b.maxCombo;
	return sub;
}

/** Spec §9.3: every question in `text` must come from the mode's pool. */
export function textMatchesPool(text: string, pool: readonly string[]): boolean {
	const questions = text.split(BOUNDARY);
	return questions.length > 0 && questions.every((q) => pool.includes(q));
}

/** Spec §9 steps 3–8. Session/Turnstile (steps 1–2) are handled by the route. */
export async function submitRun(
	userId: string | null,
	sub: RunSubmission,
	deps: SubmitDeps
): Promise<SubmitResult> {
	const now = deps.now?.() ?? Date.now();
	const parsed = parseMode(sub.mode);
	if (!parsed) return { ok: false, status: 400, error: 'unknown mode' };
	const pool = (await deps.poolForMode?.(sub.mode, parsed)) ?? poolForMode(sub.mode);
	if (!pool || pool.length === 0) return { ok: false, status: 400, error: 'unknown mode' };
	if (!textMatchesPool(sub.text, pool)) {
		return { ok: false, status: 400, error: 'text does not belong to mode' };
	}

	const analysis = analyze(sub.text, sub.log, sub.durationMs);
	if ('invalid' in analysis) return { ok: false, status: 400, error: 'log does not replay' };
	const { result, outcomes } = analysis;

	const recentRuns = userId ? await deps.store.countRunsSince(userId, now - FIVE_MINUTES) : 0;
	const reasons = anticheatReasons({
		log: sub.log,
		durationMs: sub.durationMs,
		mode: parsed,
		result,
		recentRuns
	});
	const flagged = reasons.length > 0;
	const unranked = unrankedReasonFor(result.accuracy);

	const runId = (deps.newId ?? ulid)(now);
	const week = weekOf(now);
	await deps.store.insertRun({
		id: runId,
		userId,
		mode: sub.mode,
		kpm: Math.round(result.kpm),
		accuracy: result.accuracy,
		score: result.score,
		correctKeys: result.correctKeys,
		wrongKeys: result.wrongKeys,
		durationMs: sub.durationMs,
		// Recomputed, never the client's number (DECISIONS「M4-3 實作」).
		maxCombo: maxComboFromLog(sub.log),
		week,
		flagged: flagged ? 1 : 0,
		unrankedReason: unranked,
		createdAt: now
	});
	await deps.putLog(runId, sub.log);

	const body: RunResponse = {
		runId,
		score: result.score,
		kpm: result.kpm,
		accuracy: result.accuracy
	};
	if (unranked) body.unranked = unranked;

	if (userId) {
		await deps.store.upsertKanaStats(userId, outcomes, now);
		// An anticheat flag stays silent; the accuracy floor is told to the user (`unranked`).
		if (!flagged && !unranked) {
			const hundredth = await deps.store.hundredthScore(sub.mode, week);
			if (hundredth === null || result.score >= hundredth) {
				await deps.invalidateLeaderboard(sub.mode, week);
			}
			body.rank = await deps.store.rankOf(sub.mode, week, result.score);
		}
	}

	return { ok: true, body };
}

import { parseMode, poolForMode } from '@jptype/data';
import { analyze, BOUNDARY, type KeyEvent } from '@jptype/engine';
import { anticheatReasons } from '../anticheat.ts';
import { ulid } from '../ulid.ts';
import { weekOf } from '../week.ts';
import type { RunStore } from './store.ts';

export interface RunSubmission {
	mode: string;
	text: string;
	durationMs: number;
	log: KeyEvent[];
}

export interface RunResponse {
	runId: string;
	score: number;
	kpm: number;
	accuracy: number;
	/** Present for logged-in, unflagged runs: rank on the weekly board. */
	rank?: number;
}

export type SubmitResult =
	{ ok: true; body: RunResponse } | { ok: false; status: 400; error: string };

export interface SubmitDeps {
	store: RunStore;
	/** R2-like: persist the raw key log (spec §9.6). */
	putLog(runId: string, log: readonly KeyEvent[]): Promise<void>;
	/** KV-like: drop cached leaderboards (spec §9.8). */
	invalidateLeaderboard(mode: string, week: string): Promise<void>;
	now?: () => number;
	newId?: (nowMs: number) => string;
}

export const MAX_LOG_EVENTS = 6000;
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
	return { mode: b.mode, text: b.text, durationMs: Math.round(b.durationMs), log };
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
	const pool = poolForMode(sub.mode);
	if (!parsed || !pool) return { ok: false, status: 400, error: 'unknown mode' };
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
		week,
		flagged: flagged ? 1 : 0,
		createdAt: now
	});
	await deps.putLog(runId, sub.log);

	const body: RunResponse = {
		runId,
		score: result.score,
		kpm: result.kpm,
		accuracy: result.accuracy
	};

	if (userId) {
		await deps.store.upsertKanaStats(userId, outcomes, now);
		if (!flagged) {
			const hundredth = await deps.store.hundredthScore(sub.mode, week);
			if (hundredth === null || result.score >= hundredth) {
				await deps.invalidateLeaderboard(sub.mode, week);
			}
			body.rank = await deps.store.rankOf(sub.mode, week, result.score);
		}
	}

	return { ok: true, body };
}

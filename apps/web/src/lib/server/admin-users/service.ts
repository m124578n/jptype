/**
 * Admin user / run services (M4-4「使用者與練習紀錄管理」): pure functions over an
 * `AdminUserStore`, unit-tested against a fake store, so the routes stay a few lines each.
 *
 * What an admin can do here, and why each is bounded the way it is:
 * - **search users** and read one user's recent runs — no lyrics, no key logs, no e-mail sent;
 * - **flag / unflag a run**: anticheat is heuristic (spec §9.5), so a human can overrule it both
 *   ways. A flagged run keeps its row and score but leaves the leaderboard, exactly like an
 *   automatic flag; the cached board of that mode / week is dropped so the change shows within
 *   the request, not after the 60 s TTL;
 * - **delete a run**: the row *and* its R2 key log go, since the log is only kept to explain
 *   the score;
 * - **reinstate**: clear the notice-and-takedown strikes (and the suspension they caused) and
 *   tell the user in-app. Removed songs stay removed — reinstating restores the *right to
 *   publish*, it does not undo a takedown.
 */
import { ulid } from '../ulid.ts';
import type { AdminRun, AdminUserStore, AdminUserSummary } from './store.ts';

export interface AdminUserDeps {
	store: AdminUserStore;
	/** KV-like: drop the cached boards of a mode / week (same hook as `submitRun`). */
	invalidateLeaderboard(mode: string, week: string): Promise<void>;
	/** R2-like: remove `runs/{id}.json`; missing keys are not an error. */
	deleteKeylog(runId: string): Promise<void>;
	now?: () => number;
	newId?: (nowMs: number) => string;
}

export type ErrorStatus = 400 | 401 | 403 | 404 | 409;
export type Result<T> = { ok: true; body: T } | { ok: false; status: ErrorStatus; error: string };

export const MAX_QUERY_CHARS = 80;
export const SEARCH_LIMIT = 50;
export const RUNS_LIMIT = 50;

function fail(
	status: ErrorStatus,
	error: string
): { ok: false; status: ErrorStatus; error: string } {
	return { ok: false, status, error };
}

function clock(deps: AdminUserDeps): number {
	return deps.now?.() ?? Date.now();
}

function id(deps: AdminUserDeps, nowMs: number): string {
	return (deps.newId ?? ulid)(nowMs);
}

// ── Body validation ────────────────────────────────────────────────────────────────────────────

export function parseFlagInput(raw: unknown): { flagged: boolean } | string {
	if (!raw || typeof raw !== 'object') return 'body must be an object';
	const flagged = (raw as Record<string, unknown>).flagged;
	if (typeof flagged !== 'boolean') return 'flagged must be a boolean';
	return { flagged };
}

// ── Reads ──────────────────────────────────────────────────────────────────────────────────────

/** Title search over e-mail and name. An empty query lists the newest accounts. */
export function searchUsers(q: string, deps: AdminUserDeps): Promise<AdminUserSummary[]> {
	return deps.store.searchUsers(q.trim().slice(0, MAX_QUERY_CHARS), SEARCH_LIMIT);
}

export interface AdminUserDetail {
	user: AdminUserSummary;
	runs: AdminRun[];
}

export async function getUserDetail(
	userId: string,
	deps: AdminUserDeps
): Promise<Result<AdminUserDetail>> {
	const user = await deps.store.getUser(userId);
	if (!user) return fail(404, 'user not found');
	return { ok: true, body: { user, runs: await deps.store.recentRuns(userId, RUNS_LIMIT) } };
}

// ── Runs ───────────────────────────────────────────────────────────────────────────────────────

/**
 * Flag or unflag one run. Only a ranked run (signed-in user) can move a leaderboard, so only
 * then is the cache dropped; setting the flag it already has changes nothing.
 */
export async function setRunFlag(
	runId: string,
	flagged: boolean,
	deps: AdminUserDeps
): Promise<Result<AdminRun>> {
	const run = await deps.store.getRun(runId);
	if (!run) return fail(404, 'run not found');
	if (run.flagged === flagged) return { ok: true, body: run };
	await deps.store.setRunFlag(runId, flagged);
	if (run.userId !== null) await deps.invalidateLeaderboard(run.mode, run.week);
	return { ok: true, body: { ...run, flagged } };
}

/** Remove a run and its key log; a ranked, unflagged run also drops its cached board. */
export async function deleteRun(
	runId: string,
	deps: AdminUserDeps
): Promise<Result<{ deleted: true }>> {
	const run = await deps.store.getRun(runId);
	if (!run) return fail(404, 'run not found');
	await deps.store.deleteRun(runId);
	await deps.deleteKeylog(runId);
	if (run.userId !== null && !run.flagged) await deps.invalidateLeaderboard(run.mode, run.week);
	return { ok: true, body: { deleted: true } };
}

// ── Strikes ────────────────────────────────────────────────────────────────────────────────────

/**
 * Clear a user's strikes and suspension, with an in-app notice when there was anything to
 * clear. Their removed songs stay removed.
 */
export async function reinstateUser(
	userId: string,
	deps: AdminUserDeps
): Promise<Result<{ strikes: 0; suspended: false; notified: boolean }>> {
	const user = await deps.store.getUser(userId);
	if (!user) return fail(404, 'user not found');
	const hadRecord = user.strikes > 0 || user.suspendedAt !== null;
	if (hadRecord) {
		const now = clock(deps);
		await deps.store.clearStrikes(userId);
		await deps.store.insertNotice({
			id: id(deps, now),
			userId,
			kind: 'reinstated',
			message: '',
			createdAt: now,
			readAt: null
		});
	}
	return { ok: true, body: { strikes: 0, suspended: false, notified: hadRecord } };
}

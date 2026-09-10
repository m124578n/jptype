import type { KeyEvent } from '@jptype/engine';
import { submitRun, type RunResponse } from '$lib/api';
import { getTurnstileToken } from '$lib/turnstile-client';

/** What a run has to expose to be scored server-side; `PracticeRun` and `SongSyncRun` both do. */
export interface SubmittableRun {
	readonly text: string;
	readonly log: KeyEvent[];
	readonly durationMs: number;
	readonly maxCombo: number;
}

/**
 * Send a finished run to the server (spec §8). Logged-in users attach a Turnstile token
 * when a site key is configured. Never throws; null means "keep the local result".
 */
export async function submitPracticeRun(
	run: SubmittableRun,
	mode: string,
	opts: { loggedIn: boolean; turnstileSiteKey: string }
): Promise<RunResponse | null> {
	const log = run.log;
	if (log.length === 0) return null;
	const turnstileToken = opts.loggedIn ? await getTurnstileToken(opts.turnstileSiteKey) : undefined;
	return submitRun({
		mode,
		text: run.text,
		durationMs: run.durationMs,
		log,
		maxCombo: run.maxCombo,
		...(turnstileToken ? { turnstileToken } : {})
	});
}

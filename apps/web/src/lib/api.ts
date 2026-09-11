import type { KeyEvent } from '@jptype/engine';

export interface RunSubmissionBody {
	mode: string;
	text: string;
	durationMs: number;
	log: KeyEvent[];
	/** Longest streak of correct keys; the server re-derives it from `log` anyway (M4-3). */
	maxCombo?: number;
	turnstileToken?: string;
}

export interface RunResponse {
	runId: string;
	score: number;
	kpm: number;
	accuracy: number;
	rank?: number;
	/** Stored but not ranked, and why: 'accuracy' = under the 90 % floor. */
	unranked?: 'accuracy';
}

/** POST /api/runs. Resolves to null on any failure; the UI keeps its local result. */
export async function submitRun(body: RunSubmissionBody): Promise<RunResponse | null> {
	try {
		const res = await fetch('/api/runs', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify(body)
		});
		if (!res.ok) return null;
		return (await res.json()) as RunResponse;
	} catch {
		return null;
	}
}

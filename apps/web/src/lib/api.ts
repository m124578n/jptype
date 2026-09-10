import type { KeyEvent } from '@jptype/engine';

export interface RunSubmissionBody {
	mode: string;
	text: string;
	durationMs: number;
	log: KeyEvent[];
	turnstileToken?: string;
}

export interface RunResponse {
	runId: string;
	score: number;
	kpm: number;
	accuracy: number;
	rank?: number;
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

import { error, json, type RequestHandler } from '@sveltejs/kit';
import { createDb } from '$lib/server/db';
import { d1RunStore } from '$lib/server/runs/store';
import { parseSubmission, submitRun } from '$lib/server/runs/submit';
import { verifyTurnstile } from '$lib/server/turnstile';

/**
 * POST /api/runs — spec §8 / §9.
 * body: { mode, text, durationMs, log, turnstileToken? }
 * Anonymous runs are scored and stored (userId null) but never ranked.
 */
export const POST: RequestHandler = async ({ request, locals, platform }) => {
	const env = platform?.env;
	if (!env) error(503, 'no bindings');

	let raw: unknown;
	try {
		raw = await request.json();
	} catch {
		error(400, 'invalid JSON');
	}
	const parsed = parseSubmission(raw);
	if (typeof parsed === 'string') error(400, parsed);

	const userId = locals.user?.id ?? null;

	// Step 2: Turnstile for logged-in users, only when the secret is configured.
	if (userId && env.TURNSTILE_SECRET_KEY) {
		const token = (raw as { turnstileToken?: unknown }).turnstileToken;
		if (typeof token !== 'string') error(400, 'turnstile token required');
		const ip = request.headers.get('cf-connecting-ip') ?? undefined;
		if (!(await verifyTurnstile(env.TURNSTILE_SECRET_KEY, token, ip))) {
			error(403, 'turnstile failed');
		}
	}

	const result = await submitRun(userId, parsed, {
		store: d1RunStore(createDb(env.DB)),
		putLog: (id, log) =>
			env.R2.put(`runs/${id}.json`, JSON.stringify(log), {
				httpMetadata: { contentType: 'application/json' }
			}).then(() => undefined),
		invalidateLeaderboard: async (mode, week) => {
			await Promise.all([env.KV.delete(`lb:${mode}:${week}`), env.KV.delete(`lb:${mode}:all`)]);
		}
	});

	if (!result.ok) error(result.status, result.error);
	return json(result.body, { status: 201 });
};

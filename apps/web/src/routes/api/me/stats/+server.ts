import { error, json, type RequestHandler } from '@sveltejs/kit';
import { createDb } from '$lib/server/db';
import { getMyStats } from '$lib/server/me';
import { d1UserStore } from '$lib/server/user-store';

/** GET /api/me/stats — spec §8: recent runs, kana_stats, streak. Requires a session. */
export const GET: RequestHandler = async ({ locals, platform }) => {
	const env = platform?.env;
	if (!env) error(503, 'no bindings');
	if (!locals.user) error(401, 'login required');
	const stats = await getMyStats(d1UserStore(createDb(env.DB)), locals.user.id);
	return json(stats, { headers: { 'cache-control': 'private, no-store' } });
};

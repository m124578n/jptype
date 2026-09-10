import { error, json, type RequestHandler } from '@sveltejs/kit';
import { createDb } from '$lib/server/db';
import { getLeaderboard, getMyRank, isPeriod } from '$lib/server/leaderboard';
import { d1RunStore } from '$lib/server/runs/store';

/** GET /api/leaderboard?mode=timed:allhira:60&period=week|all — spec §8. */
export const GET: RequestHandler = async ({ url, locals, platform }) => {
	const env = platform?.env;
	if (!env) error(503, 'no bindings');

	const mode = url.searchParams.get('mode') ?? 'timed:allhira:60';
	const period = url.searchParams.get('period') ?? 'week';
	if (!isPeriod(period)) error(400, 'period must be week or all');

	const store = d1RunStore(createDb(env.DB));
	const board = await getLeaderboard({ store, kv: env.KV }, mode, period);
	if (!board) error(400, 'unknown mode');

	const me = locals.user ? await getMyRank(store, board, locals.user.id) : null;
	return json({ ...board, me }, { headers: { 'cache-control': 'private, max-age=30' } });
};

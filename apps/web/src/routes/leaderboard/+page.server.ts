import { error } from '@sveltejs/kit';
import { parseMode } from '@jptype/data';
import type { PageServerLoad } from './$types';
import { createDb } from '$lib/server/db';
import { getLeaderboard, getMyRank, isPeriod } from '$lib/server/leaderboard';
import { d1RunStore } from '$lib/server/runs/store';

const DEFAULT_MODE = 'timed:allhira:60';

export const load: PageServerLoad = async ({ url, locals, platform }) => {
	const mode = url.searchParams.get('mode') ?? DEFAULT_MODE;
	const periodParam = url.searchParams.get('period') ?? 'week';
	const period = isPeriod(periodParam) ? periodParam : 'week';
	const parsed = parseMode(mode);
	if (!parsed || parsed.kind !== 'timed') error(404, 'unknown mode');

	const env = platform?.env;
	if (!env) {
		// Prerender / no bindings: render an empty board rather than failing.
		return { mode, period, pool: parsed.pool, seconds: parsed.seconds, board: null, me: null };
	}

	const store = d1RunStore(createDb(env.DB));
	const board = await getLeaderboard({ store, kv: env.KV }, mode, period);
	const me = board && locals.user ? await getMyRank(store, board, locals.user.id) : null;
	return { mode, period, pool: parsed.pool, seconds: parsed.seconds, board, me };
};

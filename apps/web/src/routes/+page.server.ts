import type { PageServerLoad } from './$types';
import { createDb } from '$lib/server/db';
import { getLeaderboard } from '$lib/server/leaderboard';
import { d1RunStore } from '$lib/server/runs/store';

const HOME_MODE = 'timed:allhira:60';

/** Home page: this week's top 5 for the default timed mode (spec §10). */
export const load: PageServerLoad = async ({ platform }) => {
	const env = platform?.env;
	if (!env) return { top: [], week: null, mode: HOME_MODE };
	const board = await getLeaderboard(
		{ store: d1RunStore(createDb(env.DB)), kv: env.KV },
		HOME_MODE,
		'week'
	);
	return { top: board?.entries.slice(0, 5) ?? [], week: board?.week ?? null, mode: HOME_MODE };
};

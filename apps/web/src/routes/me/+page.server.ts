import type { PageServerLoad } from './$types';
import { createDb } from '$lib/server/db';
import { getMyStats } from '$lib/server/me';
import { d1UserStore } from '$lib/server/user-store';

/** Logged-in users get server stats; anonymous visitors get null and the page falls back to localStorage. */
export const load: PageServerLoad = async ({ locals, platform }) => {
	const env = platform?.env;
	if (!locals.user || !env) return { stats: null };
	return { stats: await getMyStats(d1UserStore(createDb(env.DB)), locals.user.id) };
};

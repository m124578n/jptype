import type { PageServerLoad } from './$types';
import { createDb } from '$lib/server/db';
import { weakKanaFrom } from '$lib/server/me';
import { d1UserStore } from '$lib/server/user-store';

/** Weak kana from D1 for logged-in users; null lets the page use localStorage. */
export const load: PageServerLoad = async ({ locals, platform }) => {
	const env = platform?.env;
	if (!locals.user || !env) return { weak: null };
	const stats = await d1UserStore(createDb(env.DB)).kanaStatsFor(locals.user.id);
	return { weak: weakKanaFrom(stats) };
};

import { fail, type Actions } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { createDb } from '$lib/server/db';
import { getMyStats } from '$lib/server/me';
import { listNotices, markNoticesRead } from '$lib/server/songs/service';
import { d1SongStore } from '$lib/server/songs/store';
import { d1UserStore } from '$lib/server/user-store';

/** Logged-in users get server stats; anonymous visitors get null and the page falls back to localStorage. */
export const load: PageServerLoad = async ({ locals, platform }) => {
	const env = platform?.env;
	if (!locals.user || !env) return { stats: null, notices: [] };
	const db = createDb(env.DB);
	return {
		stats: await getMyStats(d1UserStore(db), locals.user.id),
		// In-app notices only: a takedown never sends mail from the Worker.
		notices: await listNotices(locals.user.id, { store: d1SongStore(db) })
	};
};

export const actions: Actions = {
	/** Plain form POST, so the notice list can be cleared without JavaScript. */
	readNotices: async ({ locals, platform }) => {
		const env = platform?.env;
		if (!locals.user || !env) return fail(401);
		await markNoticesRead(locals.user.id, { store: d1SongStore(createDb(env.DB)) });
		return { read: true };
	}
};

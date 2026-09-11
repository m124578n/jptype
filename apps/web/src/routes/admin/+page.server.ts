import { error } from '@sveltejs/kit';
import { building } from '$app/environment';
import type { PageServerLoad } from './$types';
import { isAdmin } from '$lib/server/admin';
import { createDb } from '$lib/server/db';
import { platformEnv } from '$lib/server/platform';
import { listReports, searchSongsAsAdmin } from '$lib/server/songs/service';
import { d1SongStore } from '$lib/server/songs/store';

/**
 * Admin console (DECISIONS「歌曲功能定案」item 5). The e-mail allowlist is checked here **and**
 * again in every `/api/admin/*` handler; the nav flag alone grants nothing.
 * Lyrics are never loaded: handling a notice needs titles, owners and status only.
 */
export const load: PageServerLoad = async (event) => {
	const env = building ? undefined : platformEnv(event);
	if (!env) error(503, 'no bindings');
	if (!event.locals.user) error(401, 'login required');
	if (!isAdmin(event.locals.user, env)) error(403, 'admin only');

	const deps = { store: d1SongStore(createDb(env.DB)) };
	const status = event.url.searchParams.get('status') === 'all' ? 'all' : 'open';
	const q = (event.url.searchParams.get('q') ?? '').trim();
	const songs = q === '' ? [] : await searchSongsAsAdmin(q, deps);

	return { status, q, reports: await listReports(status, deps), songs };
};

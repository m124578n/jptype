import { error } from '@sveltejs/kit';
import { building } from '$app/environment';
import type { PageServerLoad } from './$types';
import { isAdmin } from '$lib/server/admin';
import { d1ContentStore } from '$lib/server/contents/store';
import { listContentsAsAdmin, parseListQuery } from '$lib/server/contents/service';
import { createDb } from '$lib/server/db';
import { contentStats, STATS_DAYS } from '$lib/server/events/service';
import { d1EventStore } from '$lib/server/events/store';
import { platformEnv } from '$lib/server/platform';

/**
 * `/admin/contents` — the import console (DECISIONS「歌曲功能定案」item 5 for who counts as an
 * admin). Checked here **and** again in every `/api/admin/*` handler.
 */
export const load: PageServerLoad = async (event) => {
	const env = building ? undefined : platformEnv(event);
	if (!env) error(503, 'no bindings');
	if (!event.locals.user) error(401, 'login required');
	if (!isAdmin(event.locals.user, env)) error(403, 'admin only');

	const statusParam = event.url.searchParams.get('status');
	const status = statusParam === 'draft' || statusParam === 'published' ? statusParam : 'all';
	const query = parseListQuery(event.url.searchParams, status);
	const db = createDb(env.DB);
	const list = await listContentsAsAdmin(query, { store: d1ContentStore(db) });
	const stats = await contentStats(
		list.contents.map((c) => c.id),
		{ events: d1EventStore(db) }
	);
	return { query, status, list, stats, statsDays: STATS_DAYS };
};

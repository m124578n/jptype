import { building } from '$app/environment';
import type { PageServerLoad } from './$types';
import { d1ContentStore } from '$lib/server/contents/store';
import { listPublicContents, PAGE_SIZE, parseListQuery } from '$lib/server/contents/service';
import { createDb } from '$lib/server/db';
import { platformEnv } from '$lib/server/platform';

/** `/contents` — published contents only, filtered by the query string. Nothing is curated. */
export const load: PageServerLoad = async (event) => {
	const query = parseListQuery(event.url.searchParams, 'published');
	const env = building ? undefined : platformEnv(event);
	if (!env) {
		return {
			query,
			list: { contents: [], total: 0, page: query.page, pageSize: PAGE_SIZE }
		};
	}
	const deps = { store: d1ContentStore(createDb(env.DB)) };
	return { query, list: await listPublicContents(query, deps) };
};

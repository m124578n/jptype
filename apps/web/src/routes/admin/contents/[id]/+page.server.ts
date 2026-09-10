import { error } from '@sveltejs/kit';
import { building } from '$app/environment';
import type { PageServerLoad } from './$types';
import { isAdmin } from '$lib/server/admin';
import { getContentAsAdmin } from '$lib/server/contents/service';
import { d1ContentStore } from '$lib/server/contents/store';
import { createDb } from '$lib/server/db';
import { platformEnv } from '$lib/server/platform';

/** `/admin/contents/[id]` — metadata, import step and Line Editor for one content, any status. */
export const load: PageServerLoad = async (event) => {
	const env = building ? undefined : platformEnv(event);
	if (!env) error(503, 'no bindings');
	if (!event.locals.user) error(401, 'login required');
	if (!isAdmin(event.locals.user, env)) error(403, 'admin only');

	const deps = { store: d1ContentStore(createDb(env.DB)) };
	const found = await getContentAsAdmin(event.params.id, deps);
	if (!found.ok) error(found.status, found.error);
	return { content: found.body.content, lines: found.body.lines };
};

import { error } from '@sveltejs/kit';
import { building } from '$app/environment';
import type { PageServerLoad } from './$types';
import { isAdmin } from '$lib/server/admin';
import { platformEnv } from '$lib/server/platform';

/** `/admin/contents/new` — the gate only; the form posts to `/api/admin/contents`. */
export const load: PageServerLoad = (event) => {
	const env = building ? undefined : platformEnv(event);
	if (!env) error(503, 'no bindings');
	if (!event.locals.user) error(401, 'login required');
	if (!isAdmin(event.locals.user, env)) error(403, 'admin only');
	return {};
};

import { error } from '@sveltejs/kit';
import { building } from '$app/environment';
import type { PageServerLoad } from './$types';
import { isAdmin } from '$lib/server/admin';
import { adminUserDeps } from '$lib/server/admin-users/route';
import { searchUsers } from '$lib/server/admin-users/service';
import { platformEnv } from '$lib/server/platform';

/** `/admin/users?q=` — account search. Checked here **and** again in every `/api/admin/*`. */
export const load: PageServerLoad = async (event) => {
	const env = building ? undefined : platformEnv(event);
	if (!env) error(503, 'no bindings');
	if (!event.locals.user) error(401, 'login required');
	if (!isAdmin(event.locals.user, env)) error(403, 'admin only');

	const q = (event.url.searchParams.get('q') ?? '').trim();
	return { q, users: await searchUsers(q, adminUserDeps(event)) };
};

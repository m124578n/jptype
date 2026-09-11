import { error } from '@sveltejs/kit';
import { building } from '$app/environment';
import type { PageServerLoad } from './$types';
import { isAdmin } from '$lib/server/admin';
import { adminUserDeps } from '$lib/server/admin-users/route';
import { getUserDetail, RUNS_LIMIT } from '$lib/server/admin-users/service';
import { platformEnv } from '$lib/server/platform';

/** `/admin/users/[id]` — one account, its strike record and recent runs. */
export const load: PageServerLoad = async (event) => {
	const env = building ? undefined : platformEnv(event);
	if (!env) error(503, 'no bindings');
	if (!event.locals.user) error(401, 'login required');
	if (!isAdmin(event.locals.user, env)) error(403, 'admin only');

	const found = await getUserDetail(event.params.id, adminUserDeps(event));
	if (!found.ok) error(found.status, found.error);
	return { user: found.body.user, runs: found.body.runs, runsLimit: RUNS_LIMIT };
};

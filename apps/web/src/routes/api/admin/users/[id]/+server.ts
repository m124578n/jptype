import type { RequestHandler } from '@sveltejs/kit';
import { adminUserDeps, requireAdmin, respond } from '$lib/server/admin-users/route';
import { getUserDetail } from '$lib/server/admin-users/service';

/** GET /api/admin/users/[id] — one account with its recent runs. */
export const GET: RequestHandler = async (event) => {
	requireAdmin(event);
	const deps = adminUserDeps(event);
	return respond(await getUserDetail(event.params.id ?? '', deps));
};

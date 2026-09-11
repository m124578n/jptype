import { json, type RequestHandler } from '@sveltejs/kit';
import { adminUserDeps, requireAdmin } from '$lib/server/admin-users/route';
import { searchUsers } from '$lib/server/admin-users/service';

/** GET /api/admin/users?q= — accounts by e-mail or name with run / strike / song counts. */
export const GET: RequestHandler = async (event) => {
	requireAdmin(event);
	const deps = adminUserDeps(event);
	return json({ users: await searchUsers(event.url.searchParams.get('q') ?? '', deps) });
};

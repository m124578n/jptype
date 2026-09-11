import type { RequestHandler } from '@sveltejs/kit';
import { adminUserDeps, requireAdmin, respond } from '$lib/server/admin-users/route';
import { reinstateUser } from '$lib/server/admin-users/service';

/**
 * POST /api/admin/users/[id]/reinstate — clear the user's strikes and suspension and notify
 * them in-app. Removed songs stay removed: this restores the right to publish, nothing else.
 */
export const POST: RequestHandler = async (event) => {
	requireAdmin(event);
	const deps = adminUserDeps(event);
	return respond(await reinstateUser(event.params.id ?? '', deps));
};

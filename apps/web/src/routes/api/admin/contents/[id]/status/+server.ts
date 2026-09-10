import type { RequestHandler } from '@sveltejs/kit';
import { parseStatusInput, setContentStatus } from '$lib/server/contents/service';
import { contentDeps, parsed, readJson, requireAdmin, respond } from '$lib/server/contents/route';

/**
 * POST /api/admin/contents/[id]/status — publish / unpublish.
 * Publishing needs `rightsStatus = 'cleared'` and at least one typeable line; the service
 * answers 409 with the reason, which the admin page shows as-is.
 */
export const POST: RequestHandler = async (event) => {
	requireAdmin(event);
	const deps = contentDeps(event);
	const { status } = parsed(parseStatusInput(await readJson(event.request)));
	return respond(await setContentStatus(event.params.id ?? '', status, deps));
};

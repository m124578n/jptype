import type { RequestHandler } from '@sveltejs/kit';
import { getPublicContent } from '$lib/server/contents/service';
import { contentDeps, respond } from '$lib/server/contents/route';

/** GET /api/contents/[id] — one published content with its lines. A draft is a 404. */
export const GET: RequestHandler = async (event) => {
	const deps = contentDeps(event);
	return respond(await getPublicContent(event.params.id ?? '', deps));
};

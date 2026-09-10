import { json, type RequestHandler } from '@sveltejs/kit';
import { listPublicContents, parseListQuery } from '$lib/server/contents/service';
import { contentDeps } from '$lib/server/contents/route';

/**
 * GET /api/contents?type=&jlpt=&difficulty=&q=&page= — published contents, newest update first.
 * Drafts never appear here; the list carries no lines, only what a card needs.
 */
export const GET: RequestHandler = async (event) => {
	const deps = contentDeps(event);
	const query = parseListQuery(event.url.searchParams, 'published');
	return json(await listPublicContents(query, deps));
};

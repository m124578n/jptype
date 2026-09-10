import { json, type RequestHandler } from '@sveltejs/kit';
import {
	createContent,
	listContentsAsAdmin,
	parseContentInput,
	parseListQuery
} from '$lib/server/contents/service';
import { contentDeps, parsed, readJson, requireAdmin, respond } from '$lib/server/contents/route';

/** GET /api/admin/contents?status=&q=… — every content, drafts included. */
export const GET: RequestHandler = async (event) => {
	requireAdmin(event);
	const deps = contentDeps(event);
	const statusParam = event.url.searchParams.get('status');
	const status = statusParam === 'draft' || statusParam === 'published' ? statusParam : 'all';
	return json(await listContentsAsAdmin(parseListQuery(event.url.searchParams, status), deps));
};

/** POST /api/admin/contents — import one content. Always created as a draft. */
export const POST: RequestHandler = async (event) => {
	const userId = requireAdmin(event);
	const deps = contentDeps(event);
	const input = parsed(parseContentInput(await readJson(event.request)));
	return respond(await createContent(userId, input, deps), 201);
};

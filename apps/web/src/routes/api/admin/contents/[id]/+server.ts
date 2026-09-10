import type { RequestHandler } from '@sveltejs/kit';
import {
	deleteContent,
	getContentAsAdmin,
	parseContentPatchInput,
	updateContent
} from '$lib/server/contents/service';
import { contentDeps, parsed, readJson, requireAdmin, respond } from '$lib/server/contents/route';

/** GET /api/admin/contents/[id] — one content with its lines, in any status. */
export const GET: RequestHandler = async (event) => {
	requireAdmin(event);
	const deps = contentDeps(event);
	return respond(await getContentAsAdmin(event.params.id ?? '', deps));
};

/** PUT /api/admin/contents/[id] — patch the metadata (never the lines; see /lines). */
export const PUT: RequestHandler = async (event) => {
	requireAdmin(event);
	const deps = contentDeps(event);
	const patch = parsed(parseContentPatchInput(await readJson(event.request)));
	return respond(await updateContent(event.params.id ?? '', patch, deps));
};

/** DELETE /api/admin/contents/[id] — remove the content and its lines. */
export const DELETE: RequestHandler = async (event) => {
	requireAdmin(event);
	const deps = contentDeps(event);
	return respond(await deleteContent(event.params.id ?? '', deps));
};

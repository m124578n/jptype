import type { RequestHandler } from '@sveltejs/kit';
import { parseLinesInput, setContentLines } from '$lib/server/contents/service';
import { contentDeps, parsed, readJson, requireAdmin, respond } from '$lib/server/contents/route';

/**
 * PUT /api/admin/contents/[id]/lines — replace the whole line table.
 * The Line Editor reorders, inserts and deletes rows, so it saves the table as a unit.
 */
export const PUT: RequestHandler = async (event) => {
	requireAdmin(event);
	const deps = contentDeps(event);
	const lines = parsed(parseLinesInput(await readJson(event.request)));
	return respond(await setContentLines(event.params.id ?? '', lines, deps));
};

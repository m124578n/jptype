import type { RequestHandler } from '@sveltejs/kit';
import { parseRemoveInput, removeSongAsAdmin } from '$lib/server/songs/service';
import { parsed, readJson, requireAdmin, respond, songDeps } from '$lib/server/songs/route';

/**
 * POST /api/admin/songs/[id]/remove — body `{ reason? }`. Takes a song down outside the report
 * flow (same consequences: reason on the row, a strike, an in-app notice for the owner).
 */
export const POST: RequestHandler = async (event) => {
	requireAdmin(event);
	const deps = songDeps(event);
	const input = parsed(parseRemoveInput(await readJson(event.request)));
	return respond(await removeSongAsAdmin(event.params.id ?? '', input.reason, deps));
};

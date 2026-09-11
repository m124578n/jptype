import type { RequestHandler } from '@sveltejs/kit';
import {
	adminUserDeps,
	parsed,
	readJson,
	requireAdmin,
	respond
} from '$lib/server/admin-users/route';
import { deleteRun, parseFlagInput, setRunFlag } from '$lib/server/admin-users/service';

/**
 * POST /api/admin/runs/[id] — body `{ flagged }`. Overrules anticheat either way; a flagged
 * run keeps its score but leaves the leaderboard, and the cached board is dropped at once.
 */
export const POST: RequestHandler = async (event) => {
	requireAdmin(event);
	const deps = adminUserDeps(event);
	const { flagged } = parsed(parseFlagInput(await readJson(event.request)));
	return respond(await setRunFlag(event.params.id ?? '', flagged, deps));
};

/** DELETE /api/admin/runs/[id] — the row and its R2 key log. */
export const DELETE: RequestHandler = async (event) => {
	requireAdmin(event);
	const deps = adminUserDeps(event);
	return respond(await deleteRun(event.params.id ?? '', deps));
};

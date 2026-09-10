import type { RequestHandler } from '@sveltejs/kit';
import { parseResolveInput, resolveReport } from '$lib/server/songs/service';
import { parsed, readJson, requireAdmin, respond, songDeps } from '$lib/server/songs/route';

/**
 * POST /api/admin/reports/[id] — body `{ action: 'removed' | 'rejected', adminNote? }`.
 * `removed` takes the song down, records the reason, adds a strike to the owner (suspending
 * publishing at three) and leaves them an in-app notice.
 */
export const POST: RequestHandler = async (event) => {
	requireAdmin(event);
	const deps = songDeps(event);
	const input = parsed(parseResolveInput(await readJson(event.request)));
	return respond(await resolveReport(event.params.id ?? '', input, deps));
};

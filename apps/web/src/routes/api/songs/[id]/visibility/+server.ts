import type { RequestHandler } from '@sveltejs/kit';
import { parseVisibilityInput, setVisibility } from '$lib/server/songs/service';
import { parsed, readJson, requireUser, respond, songDeps } from '$lib/server/songs/route';

/**
 * POST /api/songs/[id]/visibility — body `{ visibility, consent? }`.
 * Going public needs `consent: true` (the rights declaration) and is refused for a suspended
 * account or a removed song; the consent time is recorded on the row.
 */
export const POST: RequestHandler = async (event) => {
	const userId = requireUser(event);
	const deps = songDeps(event);
	const input = parsed(parseVisibilityInput(await readJson(event.request)));
	return respond(await setVisibility(userId, event.params.id ?? '', input, deps));
};

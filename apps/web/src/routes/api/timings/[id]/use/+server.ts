import type { RequestHandler } from '@sveltejs/kit';
import { useTiming } from '$lib/server/songs/service';
import { respond, songDeps } from '$lib/server/songs/route';

/**
 * POST /api/timings/[id]/use — count one application of a shared timeline. It only orders the
 * candidate list, so anonymous visitors may call it too.
 */
export const POST: RequestHandler = async (event) => {
	const deps = songDeps(event);
	return respond(await useTiming(event.params.id ?? '', deps));
};

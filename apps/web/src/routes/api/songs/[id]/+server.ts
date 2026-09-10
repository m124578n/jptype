import { json, type RequestHandler } from '@sveltejs/kit';
import {
	deleteOwnSong,
	getSongFor,
	parseSongPatchInput,
	updateSong
} from '$lib/server/songs/service';
import { parsed, readJson, requireUser, respond, songDeps } from '$lib/server/songs/route';

/**
 * GET /api/songs/[id] — the owner's song in any state, or a public + active one for anyone
 * (including anonymous visitors, who can practise public songs). Anything else is 404, so a
 * private song never reveals that it exists.
 */
export const GET: RequestHandler = async (event) => {
	const deps = songDeps(event);
	const result = await getSongFor(event.locals.user?.id ?? null, event.params.id ?? '', deps);
	if (!result.ok) return respond(result);
	return json({ song: result.body.song, isOwner: result.body.isOwner });
};

/** PUT /api/songs/[id] — owner only; any subset of title / videoId / lines. */
export const PUT: RequestHandler = async (event) => {
	const userId = requireUser(event);
	const deps = songDeps(event);
	const patch = parsed(parseSongPatchInput(await readJson(event.request)));
	return respond(await updateSong(userId, event.params.id ?? '', patch, deps));
};

/** DELETE /api/songs/[id] — owner only. */
export const DELETE: RequestHandler = async (event) => {
	const userId = requireUser(event);
	const deps = songDeps(event);
	return respond(await deleteOwnSong(userId, event.params.id ?? '', deps));
};

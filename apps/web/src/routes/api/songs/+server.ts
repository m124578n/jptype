import { json, type RequestHandler } from '@sveltejs/kit';
import { createSong, listMySongs, parseSongInput, publishState } from '$lib/server/songs/service';
import { parsed, readJson, requireUser, respond, songDeps } from '$lib/server/songs/route';

/** GET /api/songs — the signed-in user's own library (private lyrics included). */
export const GET: RequestHandler = async (event) => {
	const userId = requireUser(event);
	const deps = songDeps(event);
	const [songs, publish] = await Promise.all([
		listMySongs(userId, deps),
		publishState(userId, deps)
	]);
	return json({ songs, publish });
};

/** POST /api/songs — add one song. Always created private; publishing is a separate step. */
export const POST: RequestHandler = async (event) => {
	const userId = requireUser(event);
	const deps = songDeps(event);
	const input = parsed(parseSongInput(await readJson(event.request)));
	return respond(await createSong(userId, input, deps), 201);
};

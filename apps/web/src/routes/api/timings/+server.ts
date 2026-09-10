import { json, type RequestHandler } from '@sveltejs/kit';
import { findTimings, parseTimingInput, publishTiming } from '$lib/server/songs/service';
import { parsed, readJson, requireUser, respond, songDeps } from '$lib/server/songs/route';

/**
 * GET /api/timings?videoId= — shared timelines for one video: line count, one SHA-256 per line and
 * the start seconds. No lyric text is stored or returned; the browser hashes its own paste and
 * only offers the timeline when every hash matches. Open to anonymous visitors too.
 */
export const GET: RequestHandler = async (event) => {
	const deps = songDeps(event);
	const timings = await findTimings(event.url.searchParams.get('videoId') ?? '', deps);
	return json({ timings });
};

/** POST /api/timings — share the timeline the user just tapped out. Login required. */
export const POST: RequestHandler = async (event) => {
	const userId = requireUser(event);
	const deps = songDeps(event);
	const input = parsed(parseTimingInput(await readJson(event.request)));
	return respond(await publishTiming(userId, input, deps), 201);
};

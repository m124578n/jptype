import { json, type RequestHandler } from '@sveltejs/kit';
import { listPublicSongs, parseListQuery } from '$lib/server/songs/service';
import { songDeps } from '$lib/server/songs/route';

/**
 * GET /api/songs/public?q=&page= — every song its owner chose to publish, newest update first.
 * A plain search over titles: nothing here is curated, promoted or recommended by us
 * (DECISIONS「歌曲功能定案」item 4). No lyrics are returned, only titles and counts.
 */
export const GET: RequestHandler = async (event) => {
	const deps = songDeps(event);
	const query = parseListQuery(event.url.searchParams);
	return json(await listPublicSongs(query, deps));
};

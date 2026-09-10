import { json, type RequestHandler } from '@sveltejs/kit';
import { searchSongsAsAdmin } from '$lib/server/songs/service';
import { requireAdmin, songDeps } from '$lib/server/songs/route';

/**
 * GET /api/admin/songs?q= — title search across every owner and status, for handling notices.
 * Lyrics are not returned; the admin table needs titles, owners and status only.
 */
export const GET: RequestHandler = async (event) => {
	requireAdmin(event);
	const deps = songDeps(event);
	const found = await searchSongsAsAdmin(event.url.searchParams.get('q') ?? '', deps);
	return json({
		songs: found.map((s) => ({
			id: s.id,
			title: s.title,
			ownerId: s.ownerId,
			videoId: s.videoId,
			lineCount: s.lines.length,
			visibility: s.visibility,
			status: s.status,
			removedReason: s.removedReason,
			updatedAt: s.updatedAt
		}))
	});
};

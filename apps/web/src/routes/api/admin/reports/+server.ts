import { json, type RequestHandler } from '@sveltejs/kit';
import { listReports } from '$lib/server/songs/service';
import { requireAdmin, songDeps } from '$lib/server/songs/route';

/** GET /api/admin/reports?status=open|removed|rejected|all — admin only. */
export const GET: RequestHandler = async (event) => {
	requireAdmin(event);
	const deps = songDeps(event);
	const raw = event.url.searchParams.get('status') ?? 'open';
	const status =
		raw === 'all' || raw === 'removed' || raw === 'rejected' || raw === 'open' ? raw : 'open';
	return json({ reports: await listReports(status, deps) });
};

import type { RequestHandler } from '@sveltejs/kit';
import { fileReport, parseReportInput } from '$lib/server/songs/service';
import { parsed, readJson, respond, songDeps } from '$lib/server/songs/route';

/**
 * POST /api/reports — the notice half of notice-and-takedown (/copyright form and the 檢舉 link
 * next to each public song). Open to anyone, signed in or not: a rights holder has no account
 * here. The report is stored for the record; nothing is e-mailed from the Worker.
 */
export const POST: RequestHandler = async (event) => {
	const deps = songDeps(event);
	const input = parsed(parseReportInput(await readJson(event.request)));
	return respond(await fileReport(input, deps), 201);
};

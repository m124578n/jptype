import type { RequestHandler } from '@sveltejs/kit';
import { eventDeps, parsed, readJson } from '$lib/server/events/route';
import { parseEventInput, recordEvent } from '$lib/server/events/service';

/**
 * POST /api/events — body `{ contentId, kind: 'start' | 'complete' | 'view' }`, sent by the
 * practice page with `sendBeacon`. Counts one event for a published content; 204 either way
 * so the beacon has nothing to read, 404 only for an id that is not a published content.
 * Anonymous by design: nothing about the caller is stored.
 */
export const POST: RequestHandler = async (event) => {
	const deps = eventDeps(event);
	const input = parsed(parseEventInput(await readJson(event.request)));
	const result = await recordEvent(input, deps);
	return new Response(null, { status: result.ok ? 204 : result.status });
};

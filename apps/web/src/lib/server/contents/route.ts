/**
 * Plumbing for the `/api/contents` and `/api/admin/contents/*` routes: bindings → deps,
 * JSON → validated body, service `Result` → JSON response.
 *
 * The session / admin / JSON helpers are shared with the song routes; only the deps differ.
 */
import { error, type RequestEvent } from '@sveltejs/kit';
import { createDb } from '../db/index.ts';
import { platformEnv } from '../platform.ts';
import { d1ContentStore } from './store.ts';
import type { ContentDeps } from './service.ts';

export { parsed, readJson, requireAdmin, requireUser, respond } from '../songs/route.ts';

/** Bindings for this request; 503 when there are none (prerender / no platform). */
export function contentDeps(event: Pick<RequestEvent, 'platform'>): ContentDeps {
	const env = platformEnv(event);
	if (!env) error(503, 'no bindings');
	return { store: d1ContentStore(createDb(env.DB)) };
}

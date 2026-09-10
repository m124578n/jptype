/**
 * Shared plumbing for the `/api/songs`, `/api/timings`, `/api/reports` and `/api/admin/*` routes,
 * so each handler stays a few lines: bindings → deps, session → user id, JSON → validated body,
 * service `Result` → JSON response.
 */
import { error, json, type RequestEvent } from '@sveltejs/kit';
import { isAdmin } from '../admin.ts';
import { createDb } from '../db/index.ts';
import { platformEnv } from '../platform.ts';
import type { Result, SongDeps } from './service.ts';
import { d1SongStore } from './store.ts';

/** Bindings for this request; 503 when there are none (prerender / no platform). */
export function songDeps(event: Pick<RequestEvent, 'platform'>): SongDeps {
	const env = platformEnv(event);
	if (!env) error(503, 'no bindings');
	return { store: d1SongStore(createDb(env.DB)) };
}

export function requireUser(event: Pick<RequestEvent, 'locals'>): string {
	const id = event.locals.user?.id;
	if (!id) error(401, 'login required');
	return id;
}

/** 401 when signed out, 403 when the e-mail is not in `ADMIN_EMAILS`. */
export function requireAdmin(event: Pick<RequestEvent, 'locals' | 'platform'>): string {
	const id = requireUser(event);
	if (!isAdmin(event.locals.user, platformEnv(event))) error(403, 'admin only');
	return id;
}

export async function readJson(request: Request): Promise<unknown> {
	try {
		return await request.json();
	} catch {
		error(400, 'invalid JSON');
	}
}

/** Validate with a `parse*` function, or fail the request with 400 and its message. */
export function parsed<T>(value: T | string): T {
	if (typeof value === 'string') error(400, value);
	return value;
}

export function respond<T>(result: Result<T>, status = 200): Response {
	if (!result.ok) error(result.status, result.error);
	return json(result.body, { status });
}

/** Bindings → deps for the analytics counters (`/api/events`, the content page, the admin list). */
import { error, type RequestEvent } from '@sveltejs/kit';
import { d1ContentStore } from '../contents/store.ts';
import { createDb } from '../db/index.ts';
import { platformEnv } from '../platform.ts';
import type { EventDeps } from './service.ts';
import { d1EventStore } from './store.ts';

export { parsed, readJson } from '../songs/route.ts';

/** 503 when there are no bindings (prerender / no platform). */
export function eventDeps(event: Pick<RequestEvent, 'platform'>): EventDeps {
	const env = platformEnv(event);
	if (!env) error(503, 'no bindings');
	const db = createDb(env.DB);
	return { events: d1EventStore(db), contents: d1ContentStore(db) };
}

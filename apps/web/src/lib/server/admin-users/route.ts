/**
 * Plumbing for `/api/admin/users/*` and `/api/admin/runs/*`: bindings → deps. The session /
 * admin / JSON helpers are the ones every admin route shares.
 */
import { error, type RequestEvent } from '@sveltejs/kit';
import { createDb } from '../db/index.ts';
import { platformEnv } from '../platform.ts';
import type { AdminUserDeps } from './service.ts';
import { d1AdminUserStore } from './store.ts';

export { parsed, readJson, requireAdmin, respond } from '../songs/route.ts';

/** Bindings for this request; 503 when there are none (prerender / no platform). */
export function adminUserDeps(event: Pick<RequestEvent, 'platform'>): AdminUserDeps {
	const env = platformEnv(event);
	if (!env) error(503, 'no bindings');
	return {
		store: d1AdminUserStore(createDb(env.DB)),
		// Same keys `submitRun` drops (spec §9.8), so a flag shows up before the 60 s TTL.
		invalidateLeaderboard: async (mode, week) => {
			await Promise.all([env.KV.delete(`lb:${mode}:${week}`), env.KV.delete(`lb:${mode}:all`)]);
		},
		deleteKeylog: async (runId) => {
			await env.R2.delete(`runs/${runId}.json`);
		}
	};
}

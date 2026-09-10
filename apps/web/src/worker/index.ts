/**
 * Worker entry (wrangler `main`). Wraps SvelteKit's generated worker so we can add the
 * `scheduled` handler for the weekly cron (spec §3) — adapter-cloudflare only emits `fetch`.
 *
 * The adapter writes its bundle to whatever `main` says in the config it reads, so it is
 * given wrangler.adapter.jsonc (main = .svelte-kit/cloudflare/_worker.js) and never this file.
 * Run `pnpm build` before `wrangler dev` / `wrangler deploy`.
 */
// eslint-disable-next-line @typescript-eslint/ban-ts-comment -- the import is untyped JS and absent before a build; ts-expect-error would flip between builds
// @ts-ignore
import kit from '../../.svelte-kit/cloudflare/_worker.js';
import { createDb } from '../lib/server/db/index.ts';
import { d1RunStore } from '../lib/server/runs/store.ts';
import { deleteOldLogs, snapshotLastWeek } from '../lib/server/scheduled.ts';

const kitWorker = kit as ExportedHandler<Env>;

async function runScheduled(env: Env, scheduledTime: number): Promise<void> {
	const store = d1RunStore(createDb(env.DB));
	const snap = await snapshotLastWeek({ store, kv: env.KV }, scheduledTime);
	const deleted = await deleteOldLogs(env.R2, scheduledTime);
	console.log(`[cron] snapshot ${snap.week} (${snap.modes} modes), deleted ${deleted} old logs`);
}

export default {
	fetch: (request, env, ctx) => kitWorker.fetch!(request, env, ctx),
	scheduled: (event, env, ctx) => {
		ctx.waitUntil(runScheduled(env, event.scheduledTime));
	}
} satisfies ExportedHandler<Env>;

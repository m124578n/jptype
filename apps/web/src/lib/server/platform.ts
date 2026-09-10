import type { RequestEvent } from '@sveltejs/kit';

/**
 * Bindings for this request, or undefined when unavailable: while prerendering, in unit tests,
 * and in `vite dev` on a prerenderable route (adapter-cloudflare's proxy throws there on
 * purpose — prerendered pages are served as static assets in production and never reach us).
 */
export function platformEnv(event: Pick<RequestEvent, 'platform'>): Env | undefined {
	const env = event.platform?.env;
	if (!env) return undefined;
	try {
		// Touching any property triggers the dev-time guard.
		void env.DB;
		return env;
	} catch {
		return undefined;
	}
}

import { building } from '$app/environment';
import type { LayoutServerLoad } from './$types';
import { isAdmin } from '$lib/server/admin';
import { platformEnv } from '$lib/server/platform';

/**
 * Expose the signed-in user and public config to every page.
 * Prerendered routes (lesson pages) must not touch platform.env; they get the defaults and
 * the real values arrive on client-side navigation / non-prerendered pages.
 *
 * `isAdmin` only decides whether the 管理 link is drawn — every admin route checks again on the
 * server, so a forged client value buys nothing.
 */
export const load: LayoutServerLoad = (event) => {
	const u = event.locals.user;
	const env = building ? undefined : platformEnv(event);
	return {
		user: u ? { id: u.id, name: u.name, image: u.image ?? null } : null,
		turnstileSiteKey: env?.PUBLIC_TURNSTILE_SITE_KEY ?? '',
		isAdmin: isAdmin(u, env)
	};
};

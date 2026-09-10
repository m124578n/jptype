import { building } from '$app/environment';
import type { LayoutServerLoad } from './$types';

/**
 * Expose the signed-in user and public config to every page.
 * Prerendered routes (lesson pages) must not touch platform.env; they get the defaults and
 * the real values arrive on client-side navigation / non-prerendered pages.
 */
export const load: LayoutServerLoad = ({ locals, platform }) => {
	const u = locals.user;
	const env = building ? undefined : platform?.env;
	return {
		user: u ? { id: u.id, name: u.name, image: u.image ?? null } : null,
		turnstileSiteKey: env?.PUBLIC_TURNSTILE_SITE_KEY ?? ''
	};
};

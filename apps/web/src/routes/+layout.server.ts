import type { LayoutServerLoad } from './$types';

/** Expose the signed-in user and public config to every page. */
export const load: LayoutServerLoad = ({ locals, platform }) => {
	const u = locals.user;
	return {
		user: u ? { id: u.id, name: u.name, image: u.image ?? null } : null,
		turnstileSiteKey: platform?.env?.PUBLIC_TURNSTILE_SITE_KEY ?? ''
	};
};

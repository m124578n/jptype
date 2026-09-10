import type { LayoutServerLoad } from './$types';

/** Expose the signed-in user to every page (null when anonymous or prerendering). */
export const load: LayoutServerLoad = ({ locals }) => {
	const u = locals.user;
	return {
		user: u ? { id: u.id, name: u.name, image: u.image ?? null } : null
	};
};

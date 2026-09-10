import { building } from '$app/environment';
import type { PageServerLoad } from './$types';
import { platformEnv } from '$lib/server/platform';

/** The notice-and-takedown contact comes from the `PUBLIC_CONTACT_EMAIL` var, never hard-coded. */
export const load: PageServerLoad = (event) => {
	const env = building ? undefined : platformEnv(event);
	return { contactEmail: env?.PUBLIC_CONTACT_EMAIL ?? '' };
};

import { building } from '$app/environment';
import type { PageServerLoad } from './$types';
import { platformEnv } from '$lib/server/platform';

/** Same contact address as /copyright, from the `PUBLIC_CONTACT_EMAIL` var. */
export const load: PageServerLoad = (event) => {
	const env = building ? undefined : platformEnv(event);
	return { contactEmail: env?.PUBLIC_CONTACT_EMAIL ?? '' };
};

import type { Handle } from '@sveltejs/kit';
import { sequence } from '@sveltejs/kit/hooks';
import { building } from '$app/environment';
import { svelteKitHandler } from 'better-auth/svelte-kit';
import { getTextDirection } from '$lib/paraglide/runtime';
import { paraglideMiddleware } from '$lib/paraglide/server';
import { getAuth } from '$lib/server/auth';

const handleParaglide: Handle = ({ event, resolve }) =>
	paraglideMiddleware(event.request, ({ request, locale }) => {
		event.request = request;

		return resolve(event, {
			transformPageChunk: ({ html }) =>
				html
					.replace('%paraglide.lang%', locale)
					.replace('%paraglide.dir%', getTextDirection(locale))
		});
	});

/** Mounts Better Auth at /api/auth/* and exposes the session on `event.locals`. */
const handleAuth: Handle = async ({ event, resolve }) => {
	event.locals.user = null;
	event.locals.session = null;

	// No bindings while prerendering / building, and none in unit tests.
	const env = event.platform?.env;
	if (building || !env?.DB) return resolve(event);

	const auth = getAuth(env, event.url.origin);
	const session = await auth.api.getSession({ headers: event.request.headers });
	if (session) {
		event.locals.user = session.user;
		event.locals.session = session.session;
	}
	return svelteKitHandler({ event, resolve, auth, building });
};

export const handle: Handle = sequence(handleAuth, handleParaglide);

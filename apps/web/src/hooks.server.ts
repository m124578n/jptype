import type { Handle } from '@sveltejs/kit';
import { sequence } from '@sveltejs/kit/hooks';
import { building } from '$app/environment';
import { svelteKitHandler } from 'better-auth/svelte-kit';
import { getTextDirection } from '$lib/paraglide/runtime';
import { paraglideMiddleware } from '$lib/paraglide/server';
import { getAuth } from '$lib/server/auth';
import { platformEnv } from '$lib/server/platform';

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

	// No bindings while prerendering / building, in unit tests, or on prerenderable routes in dev.
	const env = building ? undefined : platformEnv(event);
	if (!env) return resolve(event);

	const auth = getAuth(env, event.url.origin);
	const session = await auth.api.getSession({ headers: event.request.headers });
	if (session) {
		event.locals.user = session.user;
		event.locals.session = session.session;
	}
	return svelteKitHandler({ event, resolve, auth, building });
};

export const handle: Handle = sequence(handleAuth, handleParaglide);

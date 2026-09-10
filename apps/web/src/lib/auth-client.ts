import { createAuthClient } from 'better-auth/svelte';

/** Browser-side Better Auth client; talks to /api/auth/* on the same origin. */
export const authClient = createAuthClient({ basePath: '/api/auth' });

export type Provider = 'google' | 'line';

export function signInWith(provider: Provider, callbackURL = '/learn') {
	return authClient.signIn.social({ provider, callbackURL });
}

export function signOut() {
	return authClient.signOut();
}

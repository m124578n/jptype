// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
import type { Auth } from '$lib/server/auth';

type SessionData = NonNullable<Awaited<ReturnType<Auth['api']['getSession']>>>;

declare global {
	namespace App {
		interface Platform {
			env: Env;
			ctx: ExecutionContext;
			caches: CacheStorage;
			cf?: IncomingRequestCfProperties;
		}

		interface Locals {
			user: SessionData['user'] | null;
			session: SessionData['session'] | null;
		}

		// interface Error {}
		// interface PageData {}
		// interface PageState {}
	}

	// Secrets set with `wrangler secret put` / .dev.vars are not in wrangler.jsonc,
	// so `wrangler types` cannot see them. Merge them into the generated global `Env`.
	interface Env {
		BETTER_AUTH_SECRET: string;
		GOOGLE_CLIENT_ID: string;
		GOOGLE_CLIENT_SECRET: string;
		LINE_CHANNEL_ID: string;
		LINE_CHANNEL_SECRET: string;
		TURNSTILE_SECRET_KEY: string;
	}
}

export {};

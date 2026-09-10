import { betterAuth } from 'better-auth';
import { drizzleAdapter } from '@better-auth/drizzle-adapter';
import { dev } from '$app/environment';
import { createDb, schema } from './db/index.ts';

export interface AuthEnv {
	DB: D1Database;
	BETTER_AUTH_SECRET: string;
	GOOGLE_CLIENT_ID: string;
	GOOGLE_CLIENT_SECRET: string;
	LINE_CHANNEL_ID: string;
	LINE_CHANNEL_SECRET: string;
}

/** Build the Better Auth options for one deployment origin. Exported for tests. */
export function authOptions(env: AuthEnv, origin: string) {
	return {
		appName: 'jptype',
		baseURL: origin,
		basePath: '/api/auth',
		secret: env.BETTER_AUTH_SECRET,
		trustedOrigins: [origin],
		database: drizzleAdapter(createDb(env.DB), {
			provider: 'sqlite' as const,
			schema: {
				user: schema.user,
				session: schema.session,
				account: schema.account,
				verification: schema.verification
			}
		}),
		socialProviders: {
			google: { clientId: env.GOOGLE_CLIENT_ID, clientSecret: env.GOOGLE_CLIENT_SECRET },
			line: { clientId: env.LINE_CHANNEL_ID, clientSecret: env.LINE_CHANNEL_SECRET }
		},
		user: {
			additionalFields: {
				// spec §12: reserve a plan column; no paywall in v1
				plan: {
					type: 'string' as const,
					required: false,
					defaultValue: 'free',
					input: false
				}
			}
		},
		session: {
			cookieCache: { enabled: true, maxAge: 5 * 60 }
		},
		advanced: {
			database: { generateId: 'uuid' as const }
		}
	};
}

export type Auth = ReturnType<typeof betterAuth<ReturnType<typeof authOptions>>>;

// Bindings are per-request on Workers; one auth instance per env object per origin.
const cache = new WeakMap<object, Map<string, Auth>>();

/**
 * Get (or lazily create) the Better Auth instance for this request's bindings + origin.
 * In `vite dev` the platform proxy keeps the same `env` object across Miniflare restarts while
 * its binding stubs get "poisoned", so caching is production-only.
 */
export function getAuth(env: AuthEnv, origin: string): Auth {
	if (dev) return betterAuth(authOptions(env, origin));
	let byOrigin = cache.get(env);
	if (!byOrigin) {
		byOrigin = new Map();
		cache.set(env, byOrigin);
	}
	let auth = byOrigin.get(origin);
	if (!auth) {
		auth = betterAuth(authOptions(env, origin));
		byOrigin.set(origin, auth);
	}
	return auth;
}

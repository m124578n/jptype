// Used ONLY by `@better-auth/cli generate` to emit the Drizzle schema for Better Auth's
// tables (spec §4: user / session / account / verification are generated, not hand-written).
// The runtime instance lives in src/lib/server/auth.ts and is built per request from D1.
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from '@better-auth/drizzle-adapter';

export const auth = betterAuth({
	database: drizzleAdapter({} as never, { provider: 'sqlite' }),
	socialProviders: {
		google: { clientId: 'x', clientSecret: 'x' },
		line: { clientId: 'x', clientSecret: 'x' }
	},
	user: {
		additionalFields: {
			// spec §12: reserve a plan column; no paywall in v1
			plan: { type: 'string', required: false, defaultValue: 'free', input: false }
		}
	}
});

import { defineConfig } from 'drizzle-kit';

// Migrations are generated here and applied with `wrangler d1 migrations apply`
// (spec §1). drizzle-kit only needs the schema + dialect for `generate`.
export default defineConfig({
	dialect: 'sqlite',
	driver: 'd1-http',
	schema: './src/lib/server/db/schema.ts',
	out: './drizzle',
	strict: true,
	verbose: true
});

import { drizzle } from 'drizzle-orm/d1';
import * as schema from './schema.ts';

export type Db = ReturnType<typeof createDb>;

/** Build a Drizzle client from the D1 binding on `event.platform.env.DB`. */
export function createDb(d1: D1Database) {
	return drizzle(d1, { schema });
}

export { schema };

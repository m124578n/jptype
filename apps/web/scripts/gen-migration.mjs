// Write the drizzle snapshot + journal entry for a hand-written migration.
// `drizzle-kit generate` prompts for column renames and needs a TTY, so the SQL of a migration
// that renames or moves data is written by hand and only the snapshot comes from drizzle-kit.
// Usage: node scripts/gen-migration.mjs <tag>   e.g. node scripts/gen-migration.mjs 0005_unify_songs
import { generateSQLiteDrizzleJson } from 'drizzle-kit/api';
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const tag = process.argv[2];
if (!tag || !/^\d{4}_/.test(tag)) throw new Error('usage: gen-migration.mjs <NNNN_name>');
if (!existsSync(`drizzle/${tag}.sql`)) throw new Error(`write drizzle/${tag}.sql first`);
const idx = Number(tag.slice(0, 4));
const meta = 'drizzle/meta';
const prevFile = readdirSync(meta)
	.filter((f) => f.endsWith('_snapshot.json') && Number(f.slice(0, 4)) < idx)
	.sort()
	.at(-1);
const prev = JSON.parse(readFileSync(`${meta}/${prevFile}`, 'utf8'));
const schema = await import(pathToFileURL('src/lib/server/db/schema.ts').href);
const cur = await generateSQLiteDrizzleJson(schema, prev.id);
writeFileSync(`${meta}/${tag.slice(0, 4)}_snapshot.json`, JSON.stringify(cur, null, 2) + '\n');
const journal = JSON.parse(readFileSync(`${meta}/_journal.json`, 'utf8'));
journal.entries = journal.entries.filter((e) => e.idx !== idx);
journal.entries.push({ idx, version: '6', when: Date.now(), tag, breakpoints: true });
writeFileSync(`${meta}/_journal.json`, JSON.stringify(journal, null, 2) + '\n');
console.log('snapshot + journal written for', tag, '(prev', prevFile + ')');

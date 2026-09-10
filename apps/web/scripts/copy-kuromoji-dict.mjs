// Copies kuromoji's IPADIC (~17 MB of .dat.gz) into static/dict/kuromoji so it is served from our
// own origin at /dict/kuromoji/*.dat.gz (no external API, nothing committed: the folder is
// git-ignored). Runs before dev/build; skips files that are already up to date.
import { copyFileSync, mkdirSync, readdirSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const src = join(here, '..', 'node_modules', 'kuromoji', 'dict');
const dest = join(here, '..', 'static', 'dict', 'kuromoji');

/** Same size as the source → already copied. */
function isFresh(from, to) {
	try {
		return statSync(to).size === statSync(from).size;
	} catch {
		return false;
	}
}

mkdirSync(dest, { recursive: true });
let copied = 0;
for (const name of readdirSync(src)) {
	if (!name.endsWith('.dat.gz')) continue;
	const from = join(src, name);
	const to = join(dest, name);
	if (!isFresh(from, to)) {
		copyFileSync(from, to);
		copied += 1;
	}
}
console.log(`[kuromoji] dict ready at static/dict/kuromoji (${copied} file(s) copied)`);

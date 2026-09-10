/**
 * 漢字 → かな for the import pipeline (M4-1), **in the browser**.
 *
 * Spec §1: the Worker runtime never calls an external API, so a reading service is out. Instead
 * the admin's browser runs kuromoji (MeCab IPADIC) over the pasted text; the 17 MB dictionary is
 * served from our own origin at `DICT_PATH` (copied out of `node_modules/kuromoji/dict` at
 * build/dev time by `vite-plugin-static-copy` — it is never committed). Nothing is uploaded,
 * nothing is fetched from a third party, and the result is only a suggestion: the Line Editor
 * lets the admin correct every line before it is saved.
 *
 * The dictionary is loaded once per page, lazily, and only when an import actually runs.
 */
import { toHiragana } from '@jptype/data';

/** Where the dictionary is served from; see `vite.config.ts`. */
export const DICT_PATH = '/dict/kuromoji';

/** The part of a kuromoji token we use. `reading` is katakana, missing for unknown words. */
export interface RawToken {
	surface_form: string;
	reading?: string;
}

/** Just enough of kuromoji's tokenizer to be faked in tests. */
export interface Tokenizer {
	tokenize(text: string): RawToken[];
}

/** One token with the reading that was actually used, so the editor can show its work. */
export interface JaToken {
	surface: string;
	reading: string;
}

export interface KanaResult {
	kana: string;
	tokens: JaToken[];
}

/**
 * Characters that are already typeable as they stand: kana, the CJK punctuation block,
 * full-width forms and printable ASCII. A surface made only of these keeps its own spelling
 * (so ハート stays katakana and は stays は instead of becoming the reading ワ).
 */
const KEEP_AS_IS =
	/^[\u3000-\u303F\u3041-\u309F\u30A0-\u30FF\uFF01-\uFF60\u0020-\u007E\u2018-\u201D\s]*$/;

export function keepsSurface(surface: string): boolean {
	return KEEP_AS_IS.test(surface);
}

/** The reading a token contributes: its own surface when typeable, else katakana → hiragana. */
export function readingOf(token: RawToken): string {
	const surface = token.surface_form;
	if (keepsSurface(surface)) return surface;
	const reading = token.reading;
	// Unknown words have no reading; keep the surface so the admin sees what still needs fixing.
	if (reading === undefined || reading === '' || reading === '*') return surface;
	return toHiragana(reading);
}

/** Join a token list into one kana line, keeping each token's resolved reading. */
export function tokensToKana(tokens: readonly RawToken[]): KanaResult {
	const out: JaToken[] = tokens.map((t) => ({ surface: t.surface_form, reading: readingOf(t) }));
	return { kana: out.map((t) => t.reading).join(''), tokens: out };
}

let pending: Promise<Tokenizer> | null = null;

/**
 * Load (once) the kuromoji tokenizer. The prebuilt browser bundle is used on purpose: the
 * package's `src/` entry pulls in node's `path`, which Vite does not polyfill.
 */
export function loadTokenizer(dicPath: string = DICT_PATH): Promise<Tokenizer> {
	pending ??= import('kuromoji/build/kuromoji.js')
		.then(
			(mod) =>
				new Promise<Tokenizer>((resolve, reject) => {
					mod.default.builder({ dicPath }).build((err, tokenizer) => {
						if (err) reject(err instanceof Error ? err : new Error(String(err)));
						else resolve(tokenizer);
					});
				})
		)
		.catch((err: unknown) => {
			pending = null; // a failed load must not poison the next attempt
			throw err;
		});
	return pending;
}

/**
 * Kana reading of one line. Pass a `tokenizer` to skip the dictionary (tests, or a caller that
 * already loaded it for a whole paste).
 */
export async function toKana(text: string, tokenizer?: Tokenizer): Promise<KanaResult> {
	if (text === '') return { kana: '', tokens: [] };
	const tk = tokenizer ?? (await loadTokenizer());
	return tokensToKana(tk.tokenize(text));
}

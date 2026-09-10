/**
 * Types for the prebuilt kuromoji browser bundle (the package ships none, and we do not add
 * `@types/kuromoji` for three calls — same decision as `youtube-iframe.d.ts`).
 *
 * `build/kuromoji.js` is the browserified UMD build: it already contains the browser dictionary
 * loader (XHR + gunzip) and a `path` shim, which the `src/` entry point does not.
 */
declare module 'kuromoji/build/kuromoji.js' {
	/** One IPADIC token. Only the two fields the import pipeline reads are declared. */
	export interface KuromojiToken {
		surface_form: string;
		/** Katakana reading; absent for words that are not in the dictionary. */
		reading?: string;
	}

	export interface KuromojiTokenizer {
		tokenize(text: string): KuromojiToken[];
	}

	export interface KuromojiBuilder {
		build(done: (err: unknown, tokenizer: KuromojiTokenizer) => void): void;
	}

	export interface Kuromoji {
		/** `dicPath` is a URL in the browser; the loader appends `/<name>.dat.gz`. */
		builder(option: { dicPath: string }): KuromojiBuilder;
	}

	const kuromoji: Kuromoji;
	export default kuromoji;
}

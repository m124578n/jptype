/**
 * Browser-side Japanese analysis for the M4-1 import pipeline:
 * paste → `segment` → `toKana` (kuromoji, our own dictionary copy) → `toRomaji` → Line Editor.
 *
 * Everything here runs in the admin's browser. The Worker never analyses text and never calls an
 * external service (spec §1).
 */
export { segment } from './segment.ts';
export { toRomaji } from './romaji.ts';
export {
	DICT_PATH,
	keepsSurface,
	loadTokenizer,
	readingOf,
	toKana,
	tokensToKana,
	type JaToken,
	type KanaResult,
	type RawToken,
	type Tokenizer
} from './kana.ts';

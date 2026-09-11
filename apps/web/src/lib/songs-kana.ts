/**
 * 漢字 → かな (and punctuation clean-up) for pasted lyrics (M4-1d). The same browser-side
 * kuromoji pipeline the admin import uses (`lib/ja/kana.ts`): nothing leaves the page, the
 * dictionary comes from our own origin, and the result is a *suggestion* the user confirms line
 * by line before saving.
 *
 * Two things make a pasted line untypeable and both are handled here:
 * - **punctuation / symbols** the engine has no key for (「」『』…・〜（）etc.) are dropped from
 *   the typing text — ー、。？！ and ASCII stay, they are typeable;
 * - **kanji** are replaced by their reading through kuromoji.
 * A line that changed keeps the pasted text in `original`. A line that went through the
 * dictionary also keeps the token split in `tokens` (`surface` → `reading`, readings joined ===
 * `text`), which is what lets the practice page draw furigana over each kanji instead of a kana
 * line above the whole sentence. A line that was typeable as pasted keeps its exact spelling,
 * so the shared-timeline hashes of a plain kana paste do not change.
 */
import { loadTokenizer, readingOf, type Tokenizer } from './ja/kana.ts';
import { tokensAligned, validateLines, type SongLine, type SongToken } from './songs.ts';

/** True when the engine cannot type the text as it stands. */
export function needsReading(line: Pick<SongLine, 'text'>): boolean {
	return validateLines([{ text: line.text }]).length > 0;
}

const PUNCT_OR_SYMBOL = /[\p{P}\p{S}]/u;

function typeableChar(ch: string): boolean {
	return validateLines([{ text: ch }]).length === 0;
}

/** Drop the characters the engine cannot type; spaces are left for `collapseSpaces`. */
function dropUntypeable(text: string): string {
	return [...text].filter((ch) => !PUNCT_OR_SYMBOL.test(ch) || typeableChar(ch)).join('');
}

/**
 * Drop punctuation and symbols the engine cannot type; collapse the spaces that leaves behind.
 * Kana, kanji, letters and digits are untouched (kanji are the dictionary's job).
 */
export function stripPunctuation(text: string): string {
	return dropUntypeable(text).replace(/\s+/g, ' ').trim();
}

/** Whether the dictionary is needed at all: something untypeable remains once punctuation is gone. */
export function needsDictionary(lines: readonly SongLine[]): boolean {
	return lines.some((line) => needsReading({ text: stripPunctuation(line.text) }));
}

/**
 * Tokens → the typing text plus tokens whose readings concatenate to exactly that text.
 * Punctuation goes out of the readings (the surface keeps it, so 「 still shows in the ruby
 * line with nothing to type), and the spaces between tokens are collapsed the same way
 * `stripPunctuation` collapses them.
 */
export function alignTokens(raw: readonly SongToken[]): { text: string; tokens: SongToken[] } {
	const tokens: SongToken[] = [];
	let text = '';
	for (const token of raw) {
		let reading = dropUntypeable(token.reading).replace(/\s+/g, ' ');
		// No double spaces across token boundaries, no leading space on the line.
		if (reading.startsWith(' ') && (text === '' || text.endsWith(' '))) reading = reading.slice(1);
		tokens.push({ surface: token.surface, reading });
		text += reading;
	}
	// Trailing space: strip it from the line and from the token that carried it.
	while (text.endsWith(' ')) {
		text = text.slice(0, -1);
		for (let i = tokens.length - 1; i >= 0; i--) {
			const t = tokens[i] as SongToken;
			if (t.reading !== '') {
				tokens[i] = { surface: t.surface, reading: t.reading.slice(0, -1) };
				break;
			}
		}
	}
	return { text, tokens };
}

/**
 * Pure half: make every line typeable with the given tokenizer (only consulted for lines that
 * still need a reading after punctuation is stripped). Lines left empty are dropped.
 */
export function convertLinesWith(lines: readonly SongLine[], tokenizer: Tokenizer): SongLine[] {
	const out: SongLine[] = [];
	for (const line of lines) {
		if (!needsReading(line)) {
			out.push({ ...line });
			continue;
		}
		const stripped = stripPunctuation(line.text);
		if (!needsReading({ text: stripped })) {
			if (stripped !== '') out.push({ ...line, text: stripped, original: line.text });
			continue;
		}
		const raw = tokenizer
			.tokenize(line.text)
			.map((t) => ({ surface: t.surface_form, reading: readingOf(t) }));
		const { text, tokens } = alignTokens(raw);
		if (text === '') continue;
		out.push({ ...line, text, original: line.text, tokens });
	}
	return out;
}

/** Indexes of the lines that still need a reading after conversion (unknown words keep their surface). */
export function unresolved(lines: readonly SongLine[]): number[] {
	return lines.flatMap((line, i) => (needsReading(line) ? [i] : []));
}

/**
 * A line whose kana the user edited: keep `original`, keep `tokens` only while they still add
 * up to the text (otherwise the furigana would point at the wrong kanji).
 */
export function withEditedText(line: SongLine, text: string): SongLine {
	const next: SongLine = { ...line, text };
	if (next.original === text) delete next.original;
	if (next.tokens !== undefined && !tokensAligned(next.tokens, text)) delete next.tokens;
	return next;
}

/** Stands in when no line needs a reading, so the 17 MB dictionary is never fetched for punctuation. */
const NO_TOKENIZER: Tokenizer = {
	tokenize: () => {
		throw new Error('dictionary needed but not loaded');
	}
};

/**
 * Convert a paste. The dictionary (~17 MB, from our origin, loaded once) is fetched only when a
 * line still has kanji after punctuation is stripped; `onStage` reports the slow steps so the
 * form can say what it is waiting for.
 */
export async function convertLines(
	lines: readonly SongLine[],
	onStage?: (stage: 'loading' | 'converting') => void
): Promise<SongLine[]> {
	if (!needsDictionary(lines)) return convertLinesWith(lines, NO_TOKENIZER);
	onStage?.('loading');
	const tokenizer = await loadTokenizer();
	onStage?.('converting');
	return convertLinesWith(lines, tokenizer);
}

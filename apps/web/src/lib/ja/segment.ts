/**
 * Sentence segmentation for the import pipeline (M4-1).
 *
 * Pasted text becomes one typing question per sentence: a break after 。！？ (and their ASCII
 * cousins) and at every newline. The terminator stays on the sentence it ends — the engine can
 * type 。！？ (they are in `SYMBOLS`) and dropping them would change what the learner reads.
 * Blank lines and stray whitespace disappear.
 */

/** Characters that end a sentence; ASCII `.` is **not** one (it appears inside 1.5, U.S.A.). */
const TERMINATORS = ['。', '！', '？', '!', '?'];

/** Closing marks that belong to the sentence they follow, e.g. 「…！」. */
const CLOSERS = ['」', '』', '）', ')', '”', '’', '】', '》'];

export function segment(text: string): string[] {
	const out: string[] = [];
	let buffer = '';

	const flush = () => {
		const trimmed = buffer.trim();
		if (trimmed !== '') out.push(trimmed);
		buffer = '';
	};

	const chars = [...text];
	for (let i = 0; i < chars.length; i++) {
		const ch = chars[i] as string;
		if (ch === '\n' || ch === '\r') {
			flush();
			continue;
		}
		buffer += ch;
		if (!TERMINATORS.includes(ch)) continue;
		// A run of terminators (「本当！？」) and any closing bracket stay with this sentence.
		while (i + 1 < chars.length && TERMINATORS.includes(chars[i + 1] as string)) {
			buffer += chars[++i] as string;
		}
		while (i + 1 < chars.length && CLOSERS.includes(chars[i + 1] as string)) {
			buffer += chars[++i] as string;
		}
		flush();
	}
	flush();
	return out;
}

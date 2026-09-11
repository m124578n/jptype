/**
 * Fixing a reading after the fact (owner 2026-09-11: finding a wrong furigana halfway through a
 * song or the timing editor must not mean re-pasting). Pure helpers behind `ReadingEditor`:
 * build the corrected line and apply it to every identical line of the song.
 */
import {
	tokensAligned,
	validateLines,
	type LineIssue,
	type SongLine,
	type SongToken
} from './songs.ts';

/** A token whose surface the engine cannot type as is (kanji) gets an editable reading. */
export function editableToken(token: SongToken): boolean {
	return token.reading !== '' && validateLines([{ text: token.surface }]).length > 0;
}

/**
 * The line with new readings (one per token, same order) or, for a line without tokens, a new
 * kana text. `original` stays; tokens stay only while their readings still add up to the text.
 */
export function fixedLine(
	line: SongLine,
	edit: { readings: string[] } | { text: string }
): SongLine {
	const next: SongLine = { ...line };
	if ('readings' in edit && line.tokens !== undefined) {
		const tokens: SongToken[] = line.tokens.map((t, i) => ({
			surface: t.surface,
			reading: (edit.readings[i] ?? t.reading).trim()
		}));
		next.text = tokens.map((t) => t.reading).join('');
		next.tokens = tokens;
	} else if ('text' in edit) {
		next.text = edit.text.trim();
	}
	if (next.original === next.text) delete next.original;
	if (next.tokens !== undefined && !tokensAligned(next.tokens, next.text)) delete next.tokens;
	return next;
}

/** Characters the engine still cannot type in the corrected line (empty → savable). */
export function fixIssues(line: SongLine): LineIssue[] {
	return line.text === '' ? [{ line: 1, char: '' }] : validateLines([{ text: line.text }]);
}

/**
 * Put the corrected line in place of every line that had the old text — a chorus repeats, and
 * a wrong reading is wrong every time. Each line keeps its own `start`.
 */
export function applyFix(lines: readonly SongLine[], oldText: string, fixed: SongLine): SongLine[] {
	return lines.map((line) => {
		if (line.text !== oldText) return line;
		const { start: _start, ...rest } = fixed;
		void _start;
		return line.start === undefined ? { ...rest } : { ...rest, start: line.start };
	});
}

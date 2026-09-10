/**
 * Kana → romaji for the import pipeline (M4-1).
 *
 * This is the **reading aid** shown next to a line (`content_lines.romajiText`), not the set of
 * spellings the engine accepts — `@jptype/engine` keeps owning what may be typed. So every kana
 * uses its standard (first) spelling from `@jptype/data`, plus the three contextual rules a
 * reader expects:
 *
 * - っ doubles the next consonant (がっこう → gakkou); with no consonant after it, it is dropped;
 * - ん is `n'` before a vowel or y (きんようび → kin'youbi) and plain `n` otherwise
 *   (しんぶん → shinbun, こんにちは → konnichiha);
 * - ー repeats the previous vowel (コーヒー → koohii).
 *
 * Anything that is not kana passes through `SYMBOLS` (、。？！) or is copied as-is, so a line the
 * admin has not finished converting still produces something readable.
 */
import { findKana, MAX_KANA_LENGTH, SYMBOLS, type KanaEntry } from '@jptype/data';

const SOKUON = ['っ', 'ッ'];
const HATSUON = ['ん', 'ン'];
const CHOONPU = 'ー';
const VOWELS = ['a', 'i', 'u', 'e', 'o'];

interface Unit {
	text: string;
	entry: KanaEntry | undefined;
}

/** Longest-match split into kana units, the way the engine tokenizes (拗音 before 単音). */
function units(kana: string): Unit[] {
	const chars = [...kana];
	const out: Unit[] = [];
	let i = 0;
	while (i < chars.length) {
		let matched = 0;
		let entry: KanaEntry | undefined;
		for (let len = Math.min(MAX_KANA_LENGTH, chars.length - i); len >= 1; len--) {
			const found = findKana(chars.slice(i, i + len).join(''));
			if (found) {
				matched = len;
				entry = found;
				break;
			}
		}
		if (matched === 0) {
			out.push({ text: chars[i] as string, entry: undefined });
			i += 1;
			continue;
		}
		out.push({ text: chars.slice(i, i + matched).join(''), entry });
		i += matched;
	}
	return out;
}

/** First romaji letter of the unit at `index`, following っ chains; '' past the end. */
function initialAt(list: readonly Unit[], index: number): string {
	for (let i = index; i < list.length && i < index + 4; i++) {
		const unit = list[i] as Unit;
		if (SOKUON.includes(unit.text)) continue; // っ takes the next unit's consonant
		if (unit.text === CHOONPU) return '';
		const spelling = unit.entry?.romaji[0] ?? SYMBOLS[unit.text] ?? unit.text;
		return spelling.charAt(0).toLowerCase();
	}
	return '';
}

function lastVowel(romaji: string): string {
	for (let i = romaji.length - 1; i >= 0; i--) {
		const ch = romaji.charAt(i);
		if (VOWELS.includes(ch)) return ch;
	}
	return '';
}

/** Standard-spelling romaji for a kana string; see the module comment for the three rules. */
export function toRomaji(kana: string): string {
	const list = units(kana);
	let out = '';
	list.forEach((unit, index) => {
		if (SOKUON.includes(unit.text)) {
			const next = initialAt(list, index + 1);
			// Nothing to double at the end of a line or before a vowel: drop the small つ.
			if (next !== '' && !VOWELS.includes(next) && next !== 'n') out += next;
			return;
		}
		if (HATSUON.includes(unit.text)) {
			const next = initialAt(list, index + 1);
			out += VOWELS.includes(next) || next === 'y' ? "n'" : 'n';
			return;
		}
		if (unit.text === CHOONPU) {
			out += lastVowel(out);
			return;
		}
		if (unit.entry) {
			out += unit.entry.romaji[0] ?? '';
			return;
		}
		out += SYMBOLS[unit.text] ?? unit.text;
	});
	return out;
}

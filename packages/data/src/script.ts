// Hiragana U+3041..U+3096 ↔ Katakana U+30A1..U+30F6 differ by a fixed offset.
const OFFSET = 0x60;
const HIRA_START = 0x3041;
const HIRA_END = 0x3096;
const KATA_START = HIRA_START + OFFSET;
const KATA_END = HIRA_END + OFFSET;

/** Convert every hiragana character to katakana; other characters are returned unchanged. */
export function toKatakana(text: string): string {
	let out = '';
	for (const ch of text) {
		const cp = ch.codePointAt(0) ?? 0;
		out += cp >= HIRA_START && cp <= HIRA_END ? String.fromCodePoint(cp + OFFSET) : ch;
	}
	return out;
}

/** Convert every katakana character to hiragana; other characters are returned unchanged. */
export function toHiragana(text: string): string {
	let out = '';
	for (const ch of text) {
		const cp = ch.codePointAt(0) ?? 0;
		out += cp >= KATA_START && cp <= KATA_END ? String.fromCodePoint(cp - OFFSET) : ch;
	}
	return out;
}

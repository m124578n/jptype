import type { KanaEntry } from './types.ts';

const ROMAJI_PATTERN = /^[a-z'-]+$/;

/**
 * Spec §5.3 checks. Returns a list of human-readable problems; empty means valid.
 *  - no duplicate `kana`
 *  - every entry has ≥ 1 romaji
 *  - every romaji matches /^[a-z'-]+$/
 *  - hiragana ↔ katakana mapping is one-to-one (no duplicate `kata`, kana ≠ kata unless both sides agree)
 */
export function validateKana(entries: readonly KanaEntry[]): string[] {
	const errors: string[] = [];
	const seenKana = new Map<string, number>();
	const seenKata = new Map<string, number>();

	entries.forEach((entry, i) => {
		const where = `#${i} (${entry.kana})`;

		if (seenKana.has(entry.kana)) {
			errors.push(`${where}: duplicate kana, first seen at #${seenKana.get(entry.kana)}`);
		} else {
			seenKana.set(entry.kana, i);
		}

		if (seenKata.has(entry.kata)) {
			errors.push(
				`${where}: duplicate kata "${entry.kata}", first seen at #${seenKata.get(entry.kata)}`
			);
		} else {
			seenKata.set(entry.kata, i);
		}

		if (entry.romaji.length === 0) {
			errors.push(`${where}: no romaji`);
		}
		for (const r of entry.romaji) {
			if (!ROMAJI_PATTERN.test(r)) {
				errors.push(`${where}: romaji "${r}" contains characters outside [a-z'-]`);
			}
		}
		if (new Set(entry.romaji).size !== entry.romaji.length) {
			errors.push(`${where}: duplicate romaji spellings`);
		}
	});

	return errors;
}

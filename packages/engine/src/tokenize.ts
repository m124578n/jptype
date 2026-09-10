import { findKana, MAX_KANA_LENGTH, SYMBOLS } from '@jptype/data';
import type { Unit } from './types.ts';

const VOWELS = new Set(['a', 'i', 'u', 'e', 'o']);
/** ん may be typed as a bare `n` only if none of the next unit's spellings start with one of these. */
const N_BLOCKERS = new Set([...VOWELS, 'n', 'y']);
const SOKUON = new Set(['っ', 'ッ']);
const HATSUON = new Set(['ん', 'ン']);
/** Standalone spellings for っ, also accepted as a prefix when it merges (spec §6.2). */
const SOKUON_PREFIXES = ['xtu', 'ltu', 'xtsu', 'ltsu'];
/** Spellings that ん always accepts (spec §6.3). */
const HATSUON_FIXED = ['nn', "n'", 'xn'];

/**
 * Question separator: produces no unit and blocks っ / ん context across it, so
 * `tokenize(a + '\n' + b)` equals `[...tokenize(a), ...tokenize(b)]`. Lets a run of
 * several questions be replayed server-side as one text.
 */
export const BOUNDARY = '\n';

/** A raw token before context rules are applied. */
interface Raw {
	kana: string;
	/** True when the token came from the kana table (as opposed to symbol / space / ASCII). */
	isKana: boolean;
	romaji: string[];
	boundary?: true;
}

/** Step 1 (spec §6.2.1): longest-match split into raw tokens. */
function split(text: string): Raw[] {
	const chars = [...text];
	const out: Raw[] = [];
	let i = 0;
	while (i < chars.length) {
		let matched = false;
		for (let len = Math.min(MAX_KANA_LENGTH, chars.length - i); len >= 1; len--) {
			const slice = chars.slice(i, i + len).join('');
			const entry = findKana(slice);
			if (entry) {
				out.push({ kana: slice, isKana: true, romaji: [...entry.romaji] });
				i += len;
				matched = true;
				break;
			}
		}
		if (matched) continue;

		const ch = chars.slice(i, i + 1).join('');
		const symbol = SYMBOLS[ch];
		if (ch === BOUNDARY) out.push({ kana: ch, isKana: false, romaji: [], boundary: true });
		else if (symbol !== undefined) out.push({ kana: ch, isKana: false, romaji: [symbol] });
		else if (ch === ' ' || ch === '　') out.push({ kana: ch, isKana: false, romaji: [' '] });
		else out.push({ kana: ch, isKana: false, romaji: [ch.toLowerCase()] });
		i += 1;
	}
	return out;
}

/** Can っ be merged into this following token? Only into real kana that start with a consonant. */
function acceptsSokuon(next: Raw | undefined): next is Raw {
	if (next === undefined || !next.isKana) return false;
	if (SOKUON.has(next.kana) || HATSUON.has(next.kana)) return false;
	return next.romaji.every((s) => !VOWELS.has(s.charAt(0)));
}

/** Spellings of a merged っ+X unit (spec §6.2.2). */
function sokuonRomaji(next: string[]): string[] {
	const doubled = next.map((s) => s.charAt(0) + s);
	const tchi = next.filter((s) => s.startsWith('ch')).map((s) => 't' + s);
	const prefixed = SOKUON_PREFIXES.flatMap((p) => next.map((s) => p + s));
	return [...new Set([...doubled, ...tchi, ...prefixed])];
}

/** Spellings of ん given the spellings of the following unit, if any (spec §6.3). */
function hatsuonRomaji(nextRomaji: string[] | undefined): string[] {
	const allowBareN =
		nextRomaji !== undefined &&
		nextRomaji.every((s) => /^[a-z]/.test(s) && !N_BLOCKERS.has(s.charAt(0)));
	return allowBareN ? ['n', ...HATSUON_FIXED] : [...HATSUON_FIXED];
}

/**
 * Split target text into typing units with context-expanded spellings (spec §6.2 / §6.3).
 * Works on hiragana and katakana alike; symbols, spaces and ASCII pass through.
 */
export function tokenize(text: string): Unit[] {
	const raws = split(text);

	// Pass 1: merge っ into the following unit (boundaries never merge: they are not kana).
	const merged: Raw[] = [];
	for (let i = 0; i < raws.length; i++) {
		const r = raws[i] as Raw;
		const next = raws[i + 1];
		if (SOKUON.has(r.kana) && acceptsSokuon(next)) {
			merged.push({ kana: r.kana + next.kana, isKana: true, romaji: sokuonRomaji(next.romaji) });
			i += 1;
			continue;
		}
		merged.push(r);
	}

	// Pass 2: resolve ん against the following unit (a boundary counts as "nothing follows"),
	// then drop boundaries.
	const units: Unit[] = [];
	for (let i = 0; i < merged.length; i++) {
		const u = merged[i] as Raw;
		if (u.boundary) continue;
		const next = merged[i + 1];
		const nextRomaji = next && !next.boundary ? next.romaji : undefined;
		units.push({
			kana: u.kana,
			romaji: HATSUON.has(u.kana) ? hatsuonRomaji(nextRomaji) : u.romaji
		});
	}
	return units;
}

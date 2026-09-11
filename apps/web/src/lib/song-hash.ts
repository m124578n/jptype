/**
 * Hashing and matching for **shared timelines** (M4-1b).
 *
 * A timeline is useful to anyone who pasted the same reading of the same song, but lyric text must
 * never leave the owner's row — so what is shared is only the video id, the line count, one hex
 * SHA-256 per line text and the `start` seconds (DECISIONS「歌曲功能定案」item 3). A candidate is
 * offered only when *every* line hash matches, which means the two pastes are character-identical.
 *
 * Everything here is isomorphic: `crypto.subtle` exists in the Worker, in the browser and in Node,
 * so the same function hashes on the server and in the add-song form.
 */
import type { SongLine } from './songs.ts';

/** Shared timeline as stored, with its JSON columns already parsed. */
export interface TimingCandidate {
	id: string;
	videoId: string;
	lineCount: number;
	lineHashes: string[];
	starts: number[];
	useCount: number;
	createdAt: number;
}

const HEX = /^[0-9a-f]{64}$/;

function toHex(buffer: ArrayBuffer): string {
	let out = '';
	for (const byte of new Uint8Array(buffer)) out += byte.toString(16).padStart(2, '0');
	return out;
}

/** Hex SHA-256 of the UTF-8 bytes of `text`. */
export async function hashLine(text: string): Promise<string> {
	const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
	return toHex(digest);
}

/** One hex SHA-256 per line text, in order. The text itself is never returned or stored. */
export async function hashLines(texts: readonly string[]): Promise<string[]> {
	const out: string[] = [];
	for (const text of texts) out.push(await hashLine(text));
	return out;
}

export function isHashList(value: unknown): value is string[] {
	return Array.isArray(value) && value.every((h) => typeof h === 'string' && HEX.test(h));
}

function sameHashes(a: readonly string[], b: readonly string[]): boolean {
	return a.length === b.length && a.every((h, i) => h === b[i]);
}

/**
 * The best candidate whose line hashes are identical to `hashes`, or null.
 * "Best" = most applied so far, then newest; nothing is curated beyond that.
 */
export function matchTiming(
	candidates: readonly TimingCandidate[],
	hashes: readonly string[]
): TimingCandidate | null {
	const matches = candidates.filter(
		(c) => c.lineCount === hashes.length && sameHashes(c.lineHashes, hashes)
	);
	if (matches.length === 0) return null;
	const sorted = matches
		.slice()
		.sort((a, b) => b.useCount - a.useCount || b.createdAt - a.createdAt);
	return sorted[0] ?? null;
}

/** Put `starts` onto `lines` (same length, already matched). Non-finite times are dropped. */
export function applyTiming(lines: readonly SongLine[], starts: readonly number[]): SongLine[] {
	return lines.map((line, i) => {
		const start = starts[i];
		const { start: _start, ...rest } = line;
		void _start;
		return start !== undefined && Number.isFinite(start) ? { ...rest, start } : rest;
	});
}

/** The start seconds of a fully timed song, or null when any line is missing a time. */
export function startsOf(lines: readonly SongLine[]): number[] | null {
	const starts: number[] = [];
	for (const line of lines) {
		if (line.start === undefined) return null;
		starts.push(line.start);
	}
	return starts.length > 0 ? starts : null;
}

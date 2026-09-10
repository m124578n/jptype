/**
 * User-owned song library for 歌詞打字 (M3 C).
 *
 * Copyright: lyrics are **pasted by the user** and live only in this browser's
 * localStorage. Nothing here ever fetches, bundles or uploads lyrics, and the app
 * never ships lyrics of real songs (see DECISIONS.md「歌詞打字」). Only the YouTube
 * video id is stored so the official (nocookie) player can be embedded.
 *
 * Every read is defensive, like `storage.ts`: storage may be missing, empty or corrupted.
 */
import { findKana, MAX_KANA_LENGTH, SYMBOLS } from '@jptype/data';

const KEY = 'jptype:songs';

export interface Song {
	id: string;
	title: string;
	youtubeId: string;
	/** One typing question per line, already normalized by `parseLyrics`. */
	lines: string[];
	createdAt: number; // epoch ms
	updatedAt: number; // epoch ms
}

/** A character the typing engine cannot type, with the 1-based line it appears on. */
export interface LineIssue {
	line: number;
	char: string;
}

function isSong(value: unknown): value is Song {
	if (typeof value !== 'object' || value === null) return false;
	const s = value as Partial<Song>;
	return (
		typeof s.id === 'string' &&
		s.id !== '' &&
		typeof s.title === 'string' &&
		typeof s.youtubeId === 'string' &&
		Array.isArray(s.lines) &&
		s.lines.every((l) => typeof l === 'string') &&
		typeof s.createdAt === 'number' &&
		typeof s.updatedAt === 'number'
	);
}

/** All saved songs, newest update first. Unknown / corrupted entries are dropped. */
export function loadSongs(): Song[] {
	try {
		const raw = globalThis.localStorage?.getItem(KEY);
		if (raw === null || raw === undefined) return [];
		const parsed: unknown = JSON.parse(raw);
		if (!Array.isArray(parsed)) return [];
		return parsed.filter(isSong).sort((a, b) => b.updatedAt - a.updatedAt);
	} catch {
		return [];
	}
}

function writeSongs(songs: Song[]): void {
	try {
		globalThis.localStorage?.setItem(KEY, JSON.stringify(songs));
	} catch {
		// quota / private mode: silently ignore
	}
}

export function findSong(id: string): Song | undefined {
	return loadSongs().find((s) => s.id === id);
}

/** Insert or replace a song (matched by id). Returns the stored list. */
export function saveSong(song: Song): Song[] {
	const songs = loadSongs().filter((s) => s.id !== song.id);
	songs.push(song);
	songs.sort((a, b) => b.updatedAt - a.updatedAt);
	writeSongs(songs);
	return songs;
}

export function deleteSong(id: string): Song[] {
	const songs = loadSongs().filter((s) => s.id !== id);
	writeSongs(songs);
	return songs;
}

/** Collision-resistant enough for a per-browser list; `randomUUID` when available. */
export function newSongId(): string {
	const uuid = globalThis.crypto?.randomUUID?.();
	return uuid ?? `s${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
}

const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;

const YOUTUBE_HOSTS = [
	'youtube.com',
	'www.youtube.com',
	'm.youtube.com',
	'music.youtube.com',
	'youtube-nocookie.com',
	'www.youtube-nocookie.com'
];
const SHORT_HOSTS = ['youtu.be', 'www.youtu.be'];
/** Path prefixes that carry the id as the next segment. */
const PATH_PREFIXES = ['embed', 'shorts', 'v', 'live'];

/**
 * Extract the 11-character video id from a watch URL, youtu.be short link, shorts or
 * embed URL, or accept a bare id. Anything else returns null.
 */
export function parseYoutubeId(input: string): string | null {
	const text = input.trim();
	if (text === '') return null;
	if (VIDEO_ID.test(text)) return text;

	let url: URL;
	try {
		url = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(text) ? text : `https://${text}`);
	} catch {
		return null;
	}
	if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;

	const host = url.hostname.toLowerCase();
	const segments = url.pathname.split('/').filter((s) => s !== '');

	let candidate: string | undefined;
	if (SHORT_HOSTS.includes(host)) {
		candidate = segments[0];
	} else if (YOUTUBE_HOSTS.includes(host)) {
		if (segments[0] === 'watch') candidate = url.searchParams.get('v') ?? undefined;
		else if (segments.length >= 2 && PATH_PREFIXES.includes(segments[0] as string))
			candidate = segments[1];
	}
	return candidate !== undefined && VIDEO_ID.test(candidate) ? candidate : null;
}

/** U+3000 IDEOGRAPHIC SPACE (full-width space), as often pasted from Japanese text. */
const IDEOGRAPHIC_SPACE = '　';

/**
 * One typing question per lyric line: split on newlines, full-width spaces become normal
 * spaces, surrounding whitespace trimmed, empty lines dropped.
 */
export function parseLyrics(text: string): string[] {
	return text
		.split(/\r\n|\r|\n/)
		.map((line) => line.replaceAll(IDEOGRAPHIC_SPACE, ' ').trim())
		.filter((line) => line !== '');
}

/** Printable ASCII is typed as-is by the engine (`ch.toLowerCase()`). */
const ASCII = /^[\x20-\x7e]$/;

function isTypeableChar(ch: string): boolean {
	return SYMBOLS[ch] !== undefined || ch === ' ' || ch === IDEOGRAPHIC_SPACE || ASCII.test(ch);
}

/**
 * Characters the engine cannot type, so the user can fix them before saving.
 * Typeable = a kana from `@jptype/data` (longest match, like the tokenizer), the symbols in
 * `SYMBOLS` (ー、。？！), a space, or printable ASCII. Kanji are **not** typeable: the user
 * must paste the hiragana / katakana reading instead. Each offending character is reported
 * once per line, in order of first appearance; `line` is 1-based.
 */
export function validateLines(lines: string[]): LineIssue[] {
	const issues: LineIssue[] = [];
	lines.forEach((line, index) => {
		const chars = [...line];
		const seen: string[] = [];
		let i = 0;
		while (i < chars.length) {
			let matched = 0;
			for (let len = Math.min(MAX_KANA_LENGTH, chars.length - i); len >= 1; len--) {
				if (findKana(chars.slice(i, i + len).join(''))) {
					matched = len;
					break;
				}
			}
			if (matched > 0) {
				i += matched;
				continue;
			}
			const ch = chars[i] as string;
			if (!isTypeableChar(ch) && !seen.includes(ch)) {
				seen.push(ch);
				issues.push({ line: index + 1, char: ch });
			}
			i += 1;
		}
	});
	return issues;
}

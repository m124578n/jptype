/**
 * User-owned song library for 歌詞打字 (M3 C + sync mode) — the **localStorage half**.
 *
 * Copyright: lyrics are **pasted by the user**. Nothing here ever fetches or bundles lyrics, and
 * the app never ships lyrics of real songs (see DECISIONS.md「歌詞打字」). Only the YouTube video
 * id is stored so the official (nocookie) player can be embedded.
 *
 * Since M4-1b a signed-in user's library lives in D1 instead (private by default, publishable by
 * the owner alone — see `songs-api.ts` and `server/songs/`); this module stays the store for
 * anonymous visitors and the source of the parsing / validation helpers both halves share.
 *
 * Every read is defensive, like `storage.ts`: storage may be missing, empty or corrupted.
 */
import { findKana, MAX_KANA_LENGTH, SYMBOLS } from '@jptype/data';

const KEY = 'jptype:songs';
const MODE_KEY = 'jptype:songMode';

/** One typing question. `start` (seconds into the video) is what enables sync mode. */
export interface SongLine {
	text: string;
	start?: number;
}

export interface Song {
	id: string;
	title: string;
	youtubeId: string;
	/** One typing question per line, already normalized by `parseLyrics`. */
	lines: SongLine[];
	createdAt: number; // epoch ms
	updatedAt: number; // epoch ms
}

/** Songs saved before timestamps existed hold plain strings; both shapes are read. */
type StoredLine = string | SongLine;
type StoredSong = Omit<Song, 'lines'> & { lines: StoredLine[] };

/** A character the typing engine cannot type, with the 1-based line it appears on. */
export interface LineIssue {
	line: number;
	char: string;
}

/** Practice mode of `/songs/[id]`; remembered across visits. */
export type SongMode = 'sync' | 'free';

function isStoredLine(value: unknown): value is StoredLine {
	if (typeof value === 'string') return true;
	if (typeof value !== 'object' || value === null) return false;
	const line = value as Partial<SongLine>;
	if (typeof line.text !== 'string') return false;
	return (
		line.start === undefined || (typeof line.start === 'number' && Number.isFinite(line.start))
	);
}

function isStoredSong(value: unknown): value is StoredSong {
	if (typeof value !== 'object' || value === null) return false;
	const s = value as Partial<StoredSong>;
	return (
		typeof s.id === 'string' &&
		s.id !== '' &&
		typeof s.title === 'string' &&
		typeof s.youtubeId === 'string' &&
		Array.isArray(s.lines) &&
		s.lines.every(isStoredLine) &&
		typeof s.createdAt === 'number' &&
		typeof s.updatedAt === 'number'
	);
}

/** Migrate one stored line (legacy `string`, current `{ text, start? }`) to the current shape. */
function toLine(line: StoredLine): SongLine {
	if (typeof line === 'string') return { text: line };
	return line.start === undefined ? { text: line.text } : { text: line.text, start: line.start };
}

function toSong(song: StoredSong): Song {
	return { ...song, lines: song.lines.map(toLine) };
}

/** All saved songs, newest update first. Unknown / corrupted entries are dropped. */
export function loadSongs(): Song[] {
	try {
		const raw = globalThis.localStorage?.getItem(KEY);
		if (raw === null || raw === undefined) return [];
		const parsed: unknown = JSON.parse(raw);
		if (!Array.isArray(parsed)) return [];
		return parsed
			.filter(isStoredSong)
			.map(toSong)
			.sort((a, b) => b.updatedAt - a.updatedAt);
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

/** Sync mode needs a timeline: at least two lines carrying a start time. */
export function hasSync(song: Pick<Song, 'lines'>): boolean {
	return song.lines.filter((l) => l.start !== undefined).length >= 2;
}

export function loadSongMode(): SongMode {
	try {
		return globalThis.localStorage?.getItem(MODE_KEY) === 'sync' ? 'sync' : 'free';
	} catch {
		return 'free';
	}
}

export function saveSongMode(mode: SongMode): void {
	try {
		globalThis.localStorage?.setItem(MODE_KEY, mode);
	} catch {
		// quota / private mode: silently ignore
	}
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

/**
 * A plain web search the user can run to find a kana reading of the lyrics themselves.
 * We link out and nothing more: no site is endorsed, nothing is fetched, and the app never sees
 * the result — the user copies what they want and pastes it into the form.
 */
export function lyricsSearchUrl(title: string): string {
	return `https://www.google.com/search?q=${encodeURIComponent(`${title.trim()} 歌詞 ひらがな`)}`;
}

/** U+3000 IDEOGRAPHIC SPACE (full-width space), as often pasted from Japanese text. */
const IDEOGRAPHIC_SPACE = '　';
/** U+FEFF byte-order mark, prepended by many editors / clipboards. Built from an escape so the
 * source file itself stays free of invisible characters. */
const BOM = new RegExp('\\uFEFF', 'g');

/**
 * LRC time tag at the start of a line: `[mm:ss]`, `[mm:ss.xx]` or the legacy `[mm:ss:xx]`.
 * Inside brackets the third group is always a fraction of a second, never hours — that is
 * what the LRC format means; bare (unbracketed) timestamps use `hh:mm:ss` instead.
 */
const TIME_TAG = /^\s*\[(\d{1,3}):(\d{1,2})(?:[.:](\d{1,3}))?\]/;
/** Bare leading timestamp, `m:ss`, `mm:ss.xx` or `h:mm:ss`, followed by the text. */
const BARE_TIME = /^(\d{1,3}):(\d{1,2})(?::(\d{1,2}))?(?:\.(\d{1,3}))?[ \t]+(?=\S)/;
/** LRC metadata, e.g. `[ti:…]` / `[ar:…]` / `[offset:…]`: dropped, it is not a lyric. */
const ID_TAG = /^\[[A-Za-z]+:[^\]]*\]$/;
/** Enhanced-LRC per-word timings `<mm:ss.xx>`: stripped, the engine types words not syllables. */
const WORD_TAG = /<\d{1,3}:\d{1,2}(?:[.:]\d{1,3})?>/g;

/** `12` → 0.12 s, `5` → 0.5 s, `125` → 0.125 s (LRC hundredths, tolerating 1 or 3 digits). */
function fraction(digits: string | undefined): number {
	return digits === undefined ? 0 : Number(`0.${digits}`);
}

/**
 * One typing question per lyric line.
 *
 * Accepts plain text (one line per row, no timing) and LRC: `[mm:ss.xx]text`, several tags on
 * one line (the text is repeated at each time), metadata tags (dropped), enhanced word tags
 * (stripped) and bare `mm:ss` / `hh:mm:ss` prefixes. BOM, full-width spaces and blank lines are
 * cleaned up. When *every* line ends up timed the result is sorted by time, so a multi-tag LRC
 * file comes out in playback order; otherwise the pasted order is kept.
 */
export function parseLyrics(text: string): SongLine[] {
	const lines: SongLine[] = [];
	for (const raw of text.replace(BOM, '').split(/\r\n|\r|\n/)) {
		let rest = raw.replaceAll(IDEOGRAPHIC_SPACE, ' ');
		const starts: number[] = [];
		for (;;) {
			const tag = TIME_TAG.exec(rest);
			if (!tag) break;
			starts.push(Number(tag[1]) * 60 + Number(tag[2]) + fraction(tag[3]));
			rest = rest.slice(tag[0].length);
		}
		if (starts.length === 0) {
			const bare = BARE_TIME.exec(rest.trim());
			if (bare) {
				const [h, mm, ss] =
					bare[3] === undefined
						? [0, Number(bare[1]), Number(bare[2])]
						: [Number(bare[1]), Number(bare[2]), Number(bare[3])];
				starts.push(h * 3600 + mm * 60 + ss + fraction(bare[4]));
				rest = rest.trim().slice(bare[0].length);
			}
		}
		rest = rest.replace(WORD_TAG, '').trim();
		if (rest === '') continue;
		if (starts.length === 0) {
			if (ID_TAG.test(rest)) continue;
			lines.push({ text: rest });
			continue;
		}
		for (const start of starts) lines.push({ text: rest, start });
	}
	if (lines.length > 0 && lines.every((l) => l.start !== undefined)) {
		lines.sort((a, b) => (a.start as number) - (b.start as number));
	}
	return lines;
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
export function validateLines(lines: readonly SongLine[]): LineIssue[] {
	const issues: LineIssue[] = [];
	lines.forEach((line, index) => {
		const chars = [...line.text];
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

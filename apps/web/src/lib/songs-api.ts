/**
 * Browser side of the song API (M4-1b).
 *
 * A signed-in user's library lives in D1 (as user-provided content since M4-1c, which changes
 * nothing on this side) and syncs across devices; an anonymous visitor keeps
 * using `localStorage` exactly as before. Both are read through `LibraryEntry`, so the pages do
 * not branch on where a song came from beyond the `remote` flag.
 *
 * Every call resolves to `null` (or an `{ error }`) instead of throwing: the lyric library must
 * stay usable when the network or the bindings are unavailable.
 */
import type { ContentType } from './contents.ts';
import { hashLines, matchTiming, type TimingCandidate } from './song-hash.ts';
import {
	deleteSong as deleteLocalSong,
	findSong,
	loadSongs,
	saveSong,
	type Song,
	type SongLine
} from './songs.ts';

export type SongVisibility = 'private' | 'public';
export type SongStatus = 'active' | 'removed';

/** A user's content as the server stores it (`videoId`, not `youtubeId`). */
export interface ServerSong {
	id: string;
	ownerId: string;
	type: ContentType;
	videoId: string | null;
	title: string;
	lines: SongLine[];
	visibility: SongVisibility;
	publicConsentAt: number | null;
	status: SongStatus;
	removedReason: string | null;
	createdAt: number;
	updatedAt: number;
}

/** One row of the library list, from D1 or from localStorage. */
export interface LibraryEntry {
	id: string;
	type: ContentType;
	title: string;
	/** '' for text-only content. */
	youtubeId: string;
	lines: SongLine[];
	createdAt: number;
	updatedAt: number;
	visibility: SongVisibility;
	status: SongStatus;
	/** true → stored in D1 (publishable, synced); false → this browser only. */
	remote: boolean;
}

export interface PublicSongSummary {
	id: string;
	type: ContentType;
	title: string;
	videoId: string | null;
	lineCount: number;
	timedCount: number;
	updatedAt: number;
}

export interface PublicList {
	songs: PublicSongSummary[];
	total: number;
	page: number;
	pageSize: number;
}

export interface PublishState {
	strikes: number;
	suspended: boolean;
}

function toEntry(song: ServerSong): LibraryEntry {
	return {
		id: song.id,
		type: song.type,
		title: song.title,
		youtubeId: song.videoId ?? '',
		lines: song.lines,
		createdAt: song.createdAt,
		updatedAt: song.updatedAt,
		visibility: song.visibility,
		status: song.status,
		remote: true
	};
}

/** A localStorage song seen through the same shape: private by definition, never removed. */
export function localEntry(song: Song): LibraryEntry {
	return { ...song, visibility: 'private', status: 'active', remote: false };
}

/** `LibraryEntry` back to the `Song` the practice pages take. */
export function toSong(entry: LibraryEntry): Song {
	return {
		id: entry.id,
		type: entry.type,
		title: entry.title,
		youtubeId: entry.youtubeId,
		lines: entry.lines,
		createdAt: entry.createdAt,
		updatedAt: entry.updatedAt
	};
}

async function request<T>(
	url: string,
	init?: RequestInit
): Promise<{ ok: true; body: T } | { ok: false; status: number }> {
	try {
		const res = await fetch(url, init);
		if (!res.ok) return { ok: false, status: res.status };
		if (res.status === 204) return { ok: true, body: undefined as T };
		return { ok: true, body: (await res.json()) as T };
	} catch {
		return { ok: false, status: 0 };
	}
}

function postJson(url: string, body: unknown, method = 'POST'): RequestInit {
	return { method, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) };
}

// ── Own library ────────────────────────────────────────────────────────────────────────────────

export async function fetchMyLibrary(): Promise<{
	songs: LibraryEntry[];
	publish: PublishState;
} | null> {
	const res = await request<{ songs: ServerSong[]; publish: PublishState }>('/api/songs');
	if (!res.ok) return null;
	return { songs: res.body.songs.map(toEntry), publish: res.body.publish };
}

export interface SongInputBody {
	type: ContentType;
	title: string;
	/** Any YouTube URL shape or id; null / '' for text-only content. */
	videoId: string | null;
	lines: SongLine[];
}

export async function createSong(input: SongInputBody): Promise<LibraryEntry | null> {
	const res = await request<ServerSong>('/api/songs', postJson('/api/songs', input));
	return res.ok ? toEntry(res.body) : null;
}

export async function updateSong(
	id: string,
	patch: Partial<SongInputBody>
): Promise<LibraryEntry | null> {
	const url = `/api/songs/${encodeURIComponent(id)}`;
	const res = await request<ServerSong>(url, postJson(url, patch, 'PUT'));
	return res.ok ? toEntry(res.body) : null;
}

export async function deleteSong(id: string): Promise<boolean> {
	const url = `/api/songs/${encodeURIComponent(id)}`;
	const res = await request<{ deleted: true }>(url, { method: 'DELETE' });
	return res.ok;
}

/** `{ song, isOwner }` for a song the caller may see, or null (404 / offline). */
export async function fetchSong(
	id: string
): Promise<{ song: ServerSong; isOwner: boolean } | null> {
	const res = await request<{ song: ServerSong; isOwner: boolean }>(
		`/api/songs/${encodeURIComponent(id)}`
	);
	return res.ok ? res.body : null;
}

/** Publish / unpublish. `consent` is the rights declaration and is required to go public. */
export async function setVisibility(
	id: string,
	visibility: SongVisibility,
	consent: boolean
): Promise<{ ok: true; song: ServerSong } | { ok: false; status: number }> {
	const url = `/api/songs/${encodeURIComponent(id)}/visibility`;
	const res = await request<ServerSong>(url, postJson(url, { visibility, consent }));
	return res.ok ? { ok: true, song: res.body } : res;
}

export async function fetchPublicSongs(q: string, page: number): Promise<PublicList | null> {
	const params = new URLSearchParams();
	if (q !== '') params.set('q', q);
	if (page > 1) params.set('page', String(page));
	const suffix = params.toString();
	const res = await request<PublicList>(`/api/songs/public${suffix === '' ? '' : `?${suffix}`}`);
	return res.ok ? res.body : null;
}

// ── Shared timelines ───────────────────────────────────────────────────────────────────────────

export async function fetchTimings(videoId: string): Promise<TimingCandidate[]> {
	const res = await request<{ timings: TimingCandidate[] }>(
		`/api/timings?videoId=${encodeURIComponent(videoId)}`
	);
	return res.ok ? res.body.timings : [];
}

/**
 * A shared timeline for this exact paste, or null. The hashing happens here in the browser, so
 * the lyric text is never sent while looking for a timeline.
 */
export async function findSharedTiming(
	videoId: string,
	lines: readonly SongLine[]
): Promise<TimingCandidate | null> {
	if (lines.length === 0) return null;
	const candidates = await fetchTimings(videoId);
	if (candidates.length === 0) return null;
	const hashes = await hashLines(lines.map((l) => l.text));
	return matchTiming(candidates, hashes);
}

export async function publishTiming(
	videoId: string,
	lines: readonly SongLine[],
	starts: readonly number[]
): Promise<{ id: string; created: boolean } | null> {
	const hashes = await hashLines(lines.map((l) => l.text));
	const res = await request<{ id: string; created: boolean }>(
		'/api/timings',
		postJson('/api/timings', { videoId, lineHashes: hashes, starts })
	);
	return res.ok ? res.body : null;
}

export async function countTimingUse(id: string): Promise<void> {
	await request(`/api/timings/${encodeURIComponent(id)}/use`, { method: 'POST' });
}

// ── Notice and takedown ────────────────────────────────────────────────────────────────────────

export interface ReportBody {
	/** The reported song's id (the `/songs/[id]` in the URL). */
	contentId?: string | null;
	videoId?: string;
	reporterContact: string;
	claim: string;
}

export async function fileReport(body: ReportBody): Promise<boolean> {
	const res = await request<{ id: string }>('/api/reports', postJson('/api/reports', body));
	return res.ok;
}

// ── Admin ──────────────────────────────────────────────────────────────────────────────────────

export interface AdminReport {
	id: string;
	contentId: string | null;
	videoId: string;
	reporterContact: string;
	claim: string;
	status: 'open' | 'removed' | 'rejected';
	adminNote: string | null;
	createdAt: number;
	resolvedAt: number | null;
	songTitle: string | null;
	songOwnerId: string | null;
	songStatus: SongStatus | null;
}

export interface AdminSong {
	id: string;
	title: string;
	ownerId: string;
	videoId: string;
	lineCount: number;
	visibility: SongVisibility;
	status: SongStatus;
	removedReason: string | null;
	updatedAt: number;
}

export async function resolveReport(
	id: string,
	action: 'removed' | 'rejected',
	adminNote: string
): Promise<boolean> {
	const url = `/api/admin/reports/${encodeURIComponent(id)}`;
	const res = await request(url, postJson(url, { action, adminNote }));
	return res.ok;
}

export async function searchAdminSongs(q: string): Promise<AdminSong[]> {
	const res = await request<{ songs: AdminSong[] }>(`/api/admin/songs?q=${encodeURIComponent(q)}`);
	return res.ok ? res.body.songs : [];
}

export async function removeAdminSong(id: string, reason: string): Promise<boolean> {
	const url = `/api/admin/songs/${encodeURIComponent(id)}/remove`;
	const res = await request(url, postJson(url, { reason }));
	return res.ok;
}

// ── Library facade: D1 when signed in, localStorage when not ────────────────────────────────────

export interface Library {
	songs: LibraryEntry[];
	publish: PublishState;
	/** true → signed in but the server could not be reached; the local list is shown instead. */
	offline: boolean;
	/** Local songs still sitting in this browser while signed in → offer the one-click import. */
	importable: Song[];
}

const NO_STRIKES: PublishState = { strikes: 0, suspended: false };

export async function loadLibrary(loggedIn: boolean): Promise<Library> {
	const local = loadSongs();
	if (!loggedIn) {
		return { songs: local.map(localEntry), publish: NO_STRIKES, offline: false, importable: [] };
	}
	const remote = await fetchMyLibrary();
	if (!remote) {
		return { songs: local.map(localEntry), publish: NO_STRIKES, offline: true, importable: [] };
	}
	return { songs: remote.songs, publish: remote.publish, offline: false, importable: local };
}

/**
 * One song for the practice / timing pages. Signed in: the account's copy first, then this
 * browser's. Signed out: this browser's first, then the public API — a published song is playable
 * by anyone, including anonymous visitors.
 */
export async function loadOne(
	id: string,
	loggedIn: boolean
): Promise<{ entry: LibraryEntry; isOwner: boolean } | null> {
	const local = findSong(id);
	if (!loggedIn && local) return { entry: localEntry(local), isOwner: true };
	const remote = await fetchSong(id);
	if (remote) return { entry: toEntry(remote.song), isOwner: remote.isOwner };
	return local ? { entry: localEntry(local), isOwner: true } : null;
}

/** Persist edited lines (the timing editor) back to wherever the song lives. */
export async function saveEntryLines(
	entry: LibraryEntry,
	lines: readonly SongLine[]
): Promise<LibraryEntry | null> {
	const copy = lines.map((l) => ({ ...l }));
	if (!entry.remote) {
		const song: Song = { ...toSong(entry), lines: copy, updatedAt: Date.now() };
		saveSong(song);
		return localEntry(song);
	}
	return updateSong(entry.id, { lines: copy });
}

export async function removeEntry(entry: LibraryEntry): Promise<boolean> {
	if (!entry.remote) {
		deleteLocalSong(entry.id);
		return true;
	}
	return deleteSong(entry.id);
}

/**
 * Move this browser's songs into the signed-in account. Each song that lands on the server is
 * dropped from localStorage, so the list does not appear twice.
 */
export async function importLocalSongs(): Promise<{ imported: number; failed: number }> {
	let imported = 0;
	let failed = 0;
	for (const song of loadSongs()) {
		const created = await createSong({
			type: song.type,
			title: song.title,
			videoId: song.youtubeId === '' ? null : song.youtubeId,
			lines: song.lines
		});
		if (created) {
			deleteLocalSong(song.id);
			imported += 1;
		} else {
			failed += 1;
		}
	}
	return { imported, failed };
}

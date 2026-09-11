/**
 * Song services (M4-1b): pure functions over a `SongStore`, so every rule below is unit-tested
 * against a fake store and the API routes stay thin (same pattern as `runs/submit.ts`).
 *
 * Storage-wise a song is user-provided content (M4-1c): a `contents` row owned by the user plus
 * its `content_lines`; `store.ts` / `mapping.ts` hide that, and nothing here changes because
 * of it — a private song is still a song only its owner can read.
 *
 * The rules that matter, from DECISIONS「歌曲功能定案」:
 * - lyrics are **private by default**; only the owner reads a private song;
 * - going public needs an explicit rights declaration (`consent: true`), whose time is recorded;
 * - shared timelines carry hashes and seconds only, never text;
 * - a notice-and-takedown removal sets `status = 'removed'`, adds a strike, and at three strikes
 *   the user is suspended from publishing and their public songs go back to private;
 * - every step leaves a row behind (report status, removal reason, in-app notice).
 */
import { parseYoutubeId, type SongLine } from '../../songs.ts';
import { isHashList, matchTiming, type TimingCandidate } from '../../song-hash.ts';
import { ulid } from '../ulid.ts';
import type {
	AdminSongSummary,
	NoticeRecord,
	PublicSongSummary,
	ReportStatus,
	SongRecord,
	SongStore,
	SongVisibility,
	StrikeRecord,
	TakedownRecord
} from './store.ts';

export interface SongDeps {
	store: SongStore;
	now?: () => number;
	newId?: (nowMs: number) => string;
}

export type ErrorStatus = 400 | 401 | 403 | 404 | 409;
export type Result<T> = { ok: true; body: T } | { ok: false; status: ErrorStatus; error: string };

export const MAX_TITLE_CHARS = 120;
export const MAX_LINES = 500;
export const MAX_LINE_CHARS = 300;
export const MAX_CLAIM_CHARS = 4000;
export const MAX_CONTACT_CHARS = 200;
export const MAX_REASON_CHARS = 500;
export const MAX_QUERY_CHARS = 80;
export const PUBLIC_PAGE_SIZE = 20;
export const ADMIN_SEARCH_LIMIT = 50;
export const NOTICE_LIMIT = 20;
/** Three removals and the account may no longer publish (DECISIONS item 4). */
export const STRIKE_LIMIT = 3;
/** A timeline only helps if it actually spans the song. */
export const MIN_TIMED_LINES = 2;

function fail(
	status: ErrorStatus,
	error: string
): { ok: false; status: ErrorStatus; error: string } {
	return { ok: false, status, error };
}

function clock(deps: SongDeps): number {
	return deps.now?.() ?? Date.now();
}

function id(deps: SongDeps, nowMs: number): string {
	return (deps.newId ?? ulid)(nowMs);
}

// ── Body validation (shape only, like `parseSubmission`) ────────────────────────────────────────

export interface SongInput {
	title: string;
	videoId: string;
	lines: SongLine[];
}

export type SongPatchInput = Partial<SongInput>;

function parseLinesField(raw: unknown): SongLine[] | string {
	if (!Array.isArray(raw)) return 'lines must be an array';
	if (raw.length === 0) return 'lines must not be empty';
	if (raw.length > MAX_LINES) return 'too many lines';
	const lines: SongLine[] = [];
	for (const item of raw as unknown[]) {
		if (typeof item === 'string') {
			if (item.length > MAX_LINE_CHARS) return 'line too long';
			lines.push({ text: item });
			continue;
		}
		if (!item || typeof item !== 'object') return 'line invalid';
		const { text, start } = item as { text?: unknown; start?: unknown };
		if (typeof text !== 'string' || text === '') return 'line invalid';
		if (text.length > MAX_LINE_CHARS) return 'line too long';
		if (start === undefined || start === null) {
			lines.push({ text });
			continue;
		}
		if (typeof start !== 'number' || !Number.isFinite(start) || start < 0)
			return 'line start invalid';
		lines.push({ text, start: Math.round(start * 100) / 100 });
	}
	return lines;
}

/** `{ title }` when valid, `{ error }` otherwise — a bare string would be ambiguous here. */
function parseTitleField(raw: unknown): { title: string } | { error: string } {
	if (typeof raw !== 'string') return { error: 'title must be a string' };
	const title = raw.trim();
	if (title === '') return { error: 'title must not be empty' };
	if (title.length > MAX_TITLE_CHARS) return { error: 'title too long' };
	return { title };
}

/** POST /api/songs body. `videoId` accepts any YouTube URL shape and is normalized to the 11-char id. */
export function parseSongInput(raw: unknown): SongInput | string {
	if (!raw || typeof raw !== 'object') return 'body must be an object';
	const b = raw as Record<string, unknown>;
	const title = parseTitleField(b.title);
	if ('error' in title) return title.error;
	if (typeof b.videoId !== 'string') return 'videoId must be a string';
	const videoId = parseYoutubeId(b.videoId);
	if (videoId === null) return 'videoId invalid';
	const lines = parseLinesField(b.lines);
	if (typeof lines === 'string') return lines;
	return { title: title.title, videoId, lines };
}

/** PUT /api/songs/[id] body: any subset of the three fields, at least one. */
export function parseSongPatchInput(raw: unknown): SongPatchInput | string {
	if (!raw || typeof raw !== 'object') return 'body must be an object';
	const b = raw as Record<string, unknown>;
	const patch: SongPatchInput = {};
	if (b.title !== undefined) {
		const title = parseTitleField(b.title);
		if ('error' in title) return title.error;
		patch.title = title.title;
	}
	if (b.videoId !== undefined) {
		if (typeof b.videoId !== 'string') return 'videoId must be a string';
		const videoId = parseYoutubeId(b.videoId);
		if (videoId === null) return 'videoId invalid';
		patch.videoId = videoId;
	}
	if (b.lines !== undefined) {
		const lines = parseLinesField(b.lines);
		if (typeof lines === 'string') return lines;
		patch.lines = lines;
	}
	if (patch.title === undefined && patch.videoId === undefined && patch.lines === undefined) {
		return 'nothing to update';
	}
	return patch;
}

export interface VisibilityInput {
	visibility: SongVisibility;
	consent: boolean;
}

export function parseVisibilityInput(raw: unknown): VisibilityInput | string {
	if (!raw || typeof raw !== 'object') return 'body must be an object';
	const b = raw as Record<string, unknown>;
	if (b.visibility !== 'private' && b.visibility !== 'public') return 'visibility invalid';
	if (b.consent !== undefined && typeof b.consent !== 'boolean') return 'consent invalid';
	return { visibility: b.visibility, consent: b.consent === true };
}

export interface TimingInput {
	videoId: string;
	lineHashes: string[];
	starts: number[];
}

export function parseTimingInput(raw: unknown): TimingInput | string {
	if (!raw || typeof raw !== 'object') return 'body must be an object';
	const b = raw as Record<string, unknown>;
	if (typeof b.videoId !== 'string') return 'videoId must be a string';
	const videoId = parseYoutubeId(b.videoId);
	if (videoId === null) return 'videoId invalid';
	if (!isHashList(b.lineHashes)) return 'lineHashes invalid';
	if (b.lineHashes.length < MIN_TIMED_LINES) return 'too few lines';
	if (b.lineHashes.length > MAX_LINES) return 'too many lines';
	if (!Array.isArray(b.starts) || b.starts.length !== b.lineHashes.length) return 'starts invalid';
	const starts: number[] = [];
	for (const s of b.starts as unknown[]) {
		if (typeof s !== 'number' || !Number.isFinite(s) || s < 0) return 'starts invalid';
		starts.push(Math.round(s * 100) / 100);
	}
	return { videoId, lineHashes: b.lineHashes, starts };
}

export interface ReportInput {
	/** The reported song's content id (the `/songs/[id]` in the URL). */
	contentId: string | null;
	videoId: string;
	reporterContact: string;
	claim: string;
}

/** Body of POST /api/reports. `songId` is still accepted as the old name of `contentId`. */
export function parseReportInput(raw: unknown): ReportInput | string {
	if (!raw || typeof raw !== 'object') return 'body must be an object';
	const b = raw as Record<string, unknown>;
	const rawId = b.contentId ?? b.songId;
	if (rawId !== undefined && rawId !== null && typeof rawId !== 'string') {
		return 'contentId invalid';
	}
	if (typeof b.reporterContact !== 'string') return 'reporterContact must be a string';
	const contact = b.reporterContact.trim();
	if (contact === '' || contact.length > MAX_CONTACT_CHARS) return 'reporterContact invalid';
	if (typeof b.claim !== 'string') return 'claim must be a string';
	const claim = b.claim.trim();
	if (claim === '' || claim.length > MAX_CLAIM_CHARS) return 'claim invalid';
	const videoId = typeof b.videoId === 'string' ? (parseYoutubeId(b.videoId) ?? '') : '';
	const contentId = typeof rawId === 'string' && rawId !== '' ? rawId : null;
	if (contentId === null && videoId === '') return 'contentId or videoId required';
	return { contentId, videoId, reporterContact: contact, claim };
}

export interface ResolveInput {
	action: 'removed' | 'rejected';
	adminNote: string;
}

export function parseResolveInput(raw: unknown): ResolveInput | string {
	if (!raw || typeof raw !== 'object') return 'body must be an object';
	const b = raw as Record<string, unknown>;
	if (b.action !== 'removed' && b.action !== 'rejected') return 'action invalid';
	if (b.adminNote !== undefined && typeof b.adminNote !== 'string') return 'adminNote invalid';
	const note = typeof b.adminNote === 'string' ? b.adminNote.trim() : '';
	if (note.length > MAX_REASON_CHARS) return 'adminNote too long';
	return { action: b.action, adminNote: note };
}

export function parseRemoveInput(raw: unknown): { reason: string } | string {
	if (!raw || typeof raw !== 'object') return 'body must be an object';
	const b = raw as Record<string, unknown>;
	if (b.reason !== undefined && typeof b.reason !== 'string') return 'reason invalid';
	const reason = typeof b.reason === 'string' ? b.reason.trim() : '';
	if (reason.length > MAX_REASON_CHARS) return 'reason too long';
	return { reason };
}

/** `?q=` / `?page=` of the public list. Out-of-range values fall back instead of erroring. */
export function parseListQuery(params: URLSearchParams): { q: string; page: number } {
	const q = (params.get('q') ?? '').trim().slice(0, MAX_QUERY_CHARS);
	const raw = Number(params.get('page') ?? '1');
	const page = Number.isFinite(raw) && raw >= 1 ? Math.floor(raw) : 1;
	return { q, page };
}

// ── Owner-side services ────────────────────────────────────────────────────────────────────────

export async function createSong(
	userId: string,
	input: SongInput,
	deps: SongDeps
): Promise<Result<SongRecord>> {
	const now = clock(deps);
	const song: SongRecord = {
		id: id(deps, now),
		ownerId: userId,
		videoId: input.videoId,
		title: input.title,
		lines: input.lines,
		visibility: 'private',
		publicConsentAt: null,
		status: 'active',
		removedReason: null,
		createdAt: now,
		updatedAt: now
	};
	await deps.store.insertSong(song);
	return { ok: true, body: song };
}

export function listMySongs(userId: string, deps: SongDeps): Promise<SongRecord[]> {
	return deps.store.listByOwner(userId);
}

/**
 * One song for a caller: the owner sees their own in any state, everyone else (including
 * anonymous visitors) only a `public` + `active` one. Anything else is a 404 — a private song
 * must not even admit it exists.
 */
export async function getSongFor(
	userId: string | null,
	songId: string,
	deps: SongDeps
): Promise<Result<{ song: SongRecord; isOwner: boolean }>> {
	const song = await deps.store.getSong(songId);
	if (!song) return fail(404, 'song not found');
	if (userId !== null && song.ownerId === userId)
		return { ok: true, body: { song, isOwner: true } };
	if (song.visibility === 'public' && song.status === 'active') {
		return { ok: true, body: { song, isOwner: false } };
	}
	return fail(404, 'song not found');
}

async function ownSong(
	userId: string,
	songId: string,
	deps: SongDeps
): Promise<Result<SongRecord>> {
	const song = await deps.store.getSong(songId);
	if (!song || song.ownerId !== userId) return fail(404, 'song not found');
	return { ok: true, body: song };
}

export async function updateSong(
	userId: string,
	songId: string,
	patch: SongPatchInput,
	deps: SongDeps
): Promise<Result<SongRecord>> {
	const found = await ownSong(userId, songId, deps);
	if (!found.ok) return found;
	const now = clock(deps);
	await deps.store.patchSong(songId, { ...patch, updatedAt: now });
	return { ok: true, body: { ...found.body, ...patch, updatedAt: now } };
}

export async function deleteOwnSong(
	userId: string,
	songId: string,
	deps: SongDeps
): Promise<Result<{ deleted: true }>> {
	const found = await ownSong(userId, songId, deps);
	if (!found.ok) return found;
	await deps.store.deleteSong(songId);
	return { ok: true, body: { deleted: true } };
}

/**
 * Publish or unpublish. Going public is the moment the user takes responsibility for the lyrics,
 * so it needs `consent: true` and the time is written to `publicConsentAt`. A suspended account
 * (three removals) cannot publish at all; a removed song cannot be republished.
 */
export async function setVisibility(
	userId: string,
	songId: string,
	input: VisibilityInput,
	deps: SongDeps
): Promise<Result<SongRecord>> {
	const found = await ownSong(userId, songId, deps);
	if (!found.ok) return found;
	const song = found.body;
	const now = clock(deps);

	if (input.visibility === 'private') {
		await deps.store.patchSong(songId, { visibility: 'private', updatedAt: now });
		return { ok: true, body: { ...song, visibility: 'private', updatedAt: now } };
	}

	if (song.status !== 'active') return fail(403, 'song removed');
	if (!input.consent) return fail(400, 'consent required');
	const strikes = await deps.store.getStrikes(userId);
	if (isSuspended(strikes)) return fail(403, 'publishing suspended');

	await deps.store.patchSong(songId, {
		visibility: 'public',
		publicConsentAt: now,
		updatedAt: now
	});
	return {
		ok: true,
		body: { ...song, visibility: 'public', publicConsentAt: now, updatedAt: now }
	};
}

export function isSuspended(strikes: StrikeRecord): boolean {
	return strikes.suspendedAt !== null || strikes.strikes >= STRIKE_LIMIT;
}

/** Whether this user may publish right now, for the song page's toggle. */
export async function publishState(
	userId: string,
	deps: SongDeps
): Promise<{ strikes: number; suspended: boolean }> {
	const strikes = await deps.store.getStrikes(userId);
	return { strikes: strikes.strikes, suspended: isSuspended(strikes) };
}

// ── Public list (plain search, newest first, no curation) ───────────────────────────────────────

export interface PublicListResult {
	songs: PublicSongSummary[];
	total: number;
	page: number;
	pageSize: number;
}

export async function listPublicSongs(
	query: { q: string; page: number },
	deps: SongDeps
): Promise<PublicListResult> {
	const page = Math.max(1, Math.floor(query.page));
	const { rows, total } = await deps.store.listPublic(
		query.q,
		PUBLIC_PAGE_SIZE,
		(page - 1) * PUBLIC_PAGE_SIZE
	);
	return { songs: rows, total, page, pageSize: PUBLIC_PAGE_SIZE };
}

// ── Shared timelines ───────────────────────────────────────────────────────────────────────────

export function findTimings(videoId: string, deps: SongDeps): Promise<TimingCandidate[]> {
	const video = parseYoutubeId(videoId);
	return video === null ? Promise.resolve([]) : deps.store.findTimings(video);
}

/**
 * Share the timeline the user just made. An identical hash set for the same video is returned
 * as-is instead of inserted twice, so the table does not fill up with duplicates.
 */
export async function publishTiming(
	userId: string,
	input: TimingInput,
	deps: SongDeps
): Promise<Result<{ id: string; created: boolean }>> {
	const existing = await deps.store.findTimings(input.videoId);
	const duplicate = matchTiming(existing, input.lineHashes);
	if (duplicate) return { ok: true, body: { id: duplicate.id, created: false } };

	const now = clock(deps);
	const timingId = id(deps, now);
	await deps.store.insertTiming({
		id: timingId,
		videoId: input.videoId,
		lineCount: input.lineHashes.length,
		lineHashes: JSON.stringify(input.lineHashes),
		starts: JSON.stringify(input.starts),
		createdBy: userId,
		useCount: 0,
		createdAt: now
	});
	return { ok: true, body: { id: timingId, created: true } };
}

/** Count one application of a shared timeline (ordering hint only). */
export async function useTiming(timingId: string, deps: SongDeps): Promise<Result<{ used: true }>> {
	const timing = await deps.store.getTiming(timingId);
	if (!timing) return fail(404, 'timing not found');
	await deps.store.bumpUseCount(timingId);
	return { ok: true, body: { used: true } };
}

// ── Notice and takedown ────────────────────────────────────────────────────────────────────────

export async function fileReport(
	input: ReportInput,
	deps: SongDeps
): Promise<Result<{ id: string }>> {
	const now = clock(deps);
	let videoId = input.videoId;
	let contentId = input.contentId;
	if (contentId !== null) {
		const song = await deps.store.getSong(contentId);
		if (!song) contentId = null;
		else if (videoId === '') videoId = song.videoId;
	}
	if (contentId === null && videoId === '') return fail(400, 'contentId or videoId required');
	const reportId = id(deps, now);
	await deps.store.insertReport({
		id: reportId,
		contentId,
		videoId,
		reporterContact: input.reporterContact,
		claim: input.claim,
		status: 'open',
		adminNote: null,
		createdAt: now,
		resolvedAt: null
	});
	return { ok: true, body: { id: reportId } };
}

export function listReports(
	status: ReportStatus | 'all',
	deps: SongDeps
): Promise<TakedownRecord[]> {
	return deps.store.listReports(status);
}

export interface RemovalOutcome {
	contentId: string;
	ownerId: string;
	strikes: number;
	suspended: boolean;
}

/**
 * Take a song down: `status = 'removed'` with the reason on the row, one strike for the owner,
 * and an in-app notice (never e-mail — the Worker makes no outbound calls). The third strike
 * suspends publishing and pushes every public song of that owner back to private.
 */
async function removeSongAndStrike(
	song: SongRecord,
	reason: string,
	deps: SongDeps
): Promise<RemovalOutcome> {
	const now = clock(deps);
	await deps.store.patchSong(song.id, {
		status: 'removed',
		removedReason: reason === '' ? null : reason,
		visibility: 'private',
		updatedAt: now
	});

	const before = await deps.store.getStrikes(song.ownerId);
	const strikes = before.strikes + 1;
	const suspended = strikes >= STRIKE_LIMIT;
	await deps.store.setStrikes(song.ownerId, {
		strikes,
		suspendedAt: suspended ? (before.suspendedAt ?? now) : before.suspendedAt
	});

	await deps.store.insertNotice({
		id: id(deps, now),
		userId: song.ownerId,
		kind: 'song_removed',
		message: reason === '' ? song.title : `${song.title}｜${reason}`,
		createdAt: now,
		readAt: null
	});
	if (suspended && before.suspendedAt === null) {
		await deps.store.unpublishAll(song.ownerId, now);
		await deps.store.insertNotice({
			id: id(deps, now),
			userId: song.ownerId,
			kind: 'suspended',
			message: '',
			createdAt: now,
			readAt: null
		});
	}
	return { contentId: song.id, ownerId: song.ownerId, strikes, suspended };
}

export async function resolveReport(
	reportId: string,
	input: ResolveInput,
	deps: SongDeps
): Promise<Result<{ status: ReportStatus; removal: RemovalOutcome | null }>> {
	const report = await deps.store.getReport(reportId);
	if (!report) return fail(404, 'report not found');
	if (report.status !== 'open') return fail(409, 'report already resolved');

	let removal: RemovalOutcome | null = null;
	if (input.action === 'removed' && report.contentId !== null) {
		const song = await deps.store.getSong(report.contentId);
		if (song && song.status === 'active') {
			removal = await removeSongAndStrike(song, input.adminNote, deps);
		}
	}
	const now = clock(deps);
	await deps.store.patchReport(reportId, {
		status: input.action,
		adminNote: input.adminNote === '' ? null : input.adminNote,
		resolvedAt: now
	});
	return { ok: true, body: { status: input.action, removal } };
}

/** Admin removal without a report (e.g. the owner themselves asked, or an obvious case). */
export async function removeSongAsAdmin(
	songId: string,
	reason: string,
	deps: SongDeps
): Promise<Result<RemovalOutcome>> {
	const song = await deps.store.getSong(songId);
	if (!song) return fail(404, 'song not found');
	if (song.status !== 'active') return fail(409, 'song already removed');
	return { ok: true, body: await removeSongAndStrike(song, reason, deps) };
}

/** Title search for the admin console: summaries only, the lyrics are never loaded. */
export function searchSongsAsAdmin(q: string, deps: SongDeps): Promise<AdminSongSummary[]> {
	return deps.store.searchSongs(q.slice(0, MAX_QUERY_CHARS), ADMIN_SEARCH_LIMIT);
}

// ── Notices ────────────────────────────────────────────────────────────────────────────────────

export function listNotices(userId: string, deps: SongDeps): Promise<NoticeRecord[]> {
	return deps.store.listNotices(userId, NOTICE_LIMIT);
}

export function markNoticesRead(userId: string, deps: SongDeps): Promise<void> {
	return deps.store.markNoticesRead(userId, clock(deps));
}

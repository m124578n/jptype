/**
 * Persistence for the song services. Since M4-1c a song **is** a `contents` row (`ownerId` set,
 * `sourceType = 'user_provided'`) plus its `content_lines`; the mapping between the song view
 * and those rows lives in `mapping.ts`. Shared timelines, reports, strikes and notices keep
 * their own tables. Implemented on D1 below, faked in the service tests (same shape as
 * `RunStore`).
 */
import { and, asc, count, desc, eq, inArray, isNotNull, isNull, sql, type SQL } from 'drizzle-orm';
import type { SongLine } from '../../songs.ts';
import type { TimingCandidate } from '../../song-hash.ts';
import type { Db } from '../db/index.ts';
import {
	contentLines,
	contents,
	notices,
	songTimings,
	takedownRequests,
	userStrikes,
	type ContentRow,
	type NewNoticeRow,
	type NewSongTimingRow,
	type NewTakedownRow,
	type TakedownRow
} from '../db/schema.ts';
import { chunk, LINE_BATCH } from '../contents/store.ts';
import {
	isSongRow,
	linesToRows,
	rowsToLines,
	songToContentRow,
	statusPatchOf,
	toSongRecord
} from './mapping.ts';

export type SongVisibility = 'private' | 'public';
export type SongStatus = 'active' | 'removed';
export type ReportStatus = 'open' | 'removed' | 'rejected';

/** A song as the API and the pages see it. */
export interface SongRecord {
	id: string;
	ownerId: string;
	videoId: string;
	title: string;
	lines: SongLine[];
	visibility: SongVisibility;
	publicConsentAt: number | null;
	status: SongStatus;
	removedReason: string | null;
	createdAt: number;
	updatedAt: number;
}

/** What the public list shows: no lyrics, so the list itself distributes nothing. */
export interface PublicSongSummary {
	id: string;
	title: string;
	videoId: string;
	lineCount: number;
	timedCount: number;
	updatedAt: number;
}

/** What the admin console shows: titles, owners and status — never the lyrics. */
export interface AdminSongSummary {
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

export interface TakedownRecord {
	id: string;
	/** The reported `contents` row (a song); null once that row is gone. */
	contentId: string | null;
	videoId: string;
	reporterContact: string;
	claim: string;
	status: ReportStatus;
	adminNote: string | null;
	createdAt: number;
	resolvedAt: number | null;
	/** Joined for the admin table; null when the song row is gone. */
	songTitle: string | null;
	songOwnerId: string | null;
	songStatus: SongStatus | null;
}

export interface NoticeRecord {
	id: string;
	kind: string;
	message: string;
	createdAt: number;
	readAt: number | null;
}

export interface StrikeRecord {
	strikes: number;
	suspendedAt: number | null;
}

export interface SongPatch {
	title?: string;
	videoId?: string;
	lines?: SongLine[];
	visibility?: SongVisibility;
	publicConsentAt?: number | null;
	status?: SongStatus;
	removedReason?: string | null;
	updatedAt: number;
}

export interface SongStore {
	insertSong(song: SongRecord): Promise<void>;
	getSong(id: string): Promise<SongRecord | undefined>;
	patchSong(id: string, patch: SongPatch): Promise<void>;
	deleteSong(id: string): Promise<void>;
	listByOwner(ownerId: string): Promise<SongRecord[]>;
	/** Public + active songs, title search, newest update first. */
	listPublic(
		q: string,
		limit: number,
		offset: number
	): Promise<{ rows: PublicSongSummary[]; total: number }>;
	/** Admin song search across every owner and status. */
	searchSongs(q: string, limit: number): Promise<AdminSongSummary[]>;
	/** Make every public song of one owner private again (used when they get suspended). */
	unpublishAll(ownerId: string, now: number): Promise<number>;

	insertTiming(row: NewSongTimingRow): Promise<void>;
	findTimings(videoId: string): Promise<TimingCandidate[]>;
	getTiming(id: string): Promise<TimingCandidate | undefined>;
	bumpUseCount(id: string): Promise<void>;

	insertReport(row: NewTakedownRow): Promise<void>;
	getReport(id: string): Promise<TakedownRecord | undefined>;
	listReports(status: ReportStatus | 'all'): Promise<TakedownRecord[]>;
	patchReport(
		id: string,
		patch: { status: ReportStatus; adminNote: string | null; resolvedAt: number }
	): Promise<void>;

	getStrikes(userId: string): Promise<StrikeRecord>;
	setStrikes(userId: string, value: StrikeRecord): Promise<void>;

	insertNotice(row: NewNoticeRow): Promise<void>;
	listNotices(userId: string, limit: number): Promise<NoticeRecord[]>;
	markNoticesRead(userId: string, now: number): Promise<void>;
}

function parseNumbers(raw: string): number[] {
	try {
		const parsed: unknown = JSON.parse(raw);
		if (!Array.isArray(parsed)) return [];
		return parsed.filter((n): n is number => typeof n === 'number' && Number.isFinite(n));
	} catch {
		return [];
	}
}

function parseStrings(raw: string): string[] {
	try {
		const parsed: unknown = JSON.parse(raw);
		if (!Array.isArray(parsed)) return [];
		return parsed.filter((s): s is string => typeof s === 'string');
	} catch {
		return [];
	}
}

/** `LIKE` pattern for a free-text search; `%`, `_` and `\` in the query are literal. */
function likePattern(q: string): string {
	return `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
}

function titleLike(q: string) {
	return q === '' ? undefined : sql`${contents.title} LIKE ${likePattern(q)} ESCAPE '\\'`;
}

/** Every song row: user-provided content, whatever its status. */
const IS_SONG = isNotNull(contents.ownerId);

/** D1 caps the bound parameters per statement; `IN (...)` lists are split accordingly. */
const ID_BATCH = 80;

export function d1SongStore(db: Db): SongStore {
	/** The lines of several songs in one go, keyed by song id and already in order. */
	async function linesFor(ids: string[]): Promise<Map<string, SongLine[]>> {
		const byId = new Map<string, SongLine[]>(ids.map((id) => [id, []]));
		for (const part of chunk(ids, ID_BATCH)) {
			const rows = await db
				.select({
					contentId: contentLines.contentId,
					kanaText: contentLines.kanaText,
					originalText: contentLines.originalText,
					startTime: contentLines.startTime,
					metadata: contentLines.metadata
				})
				.from(contentLines)
				.where(inArray(contentLines.contentId, part))
				.orderBy(asc(contentLines.contentId), asc(contentLines.order));
			for (const row of rows) byId.get(row.contentId)?.push(...rowsToLines([row]));
		}
		return byId;
	}

	/** Line and timed-line counts for several songs, for the lists that show no lyrics. */
	async function countsFor(ids: string[]): Promise<Map<string, { lines: number; timed: number }>> {
		const byId = new Map<string, { lines: number; timed: number }>();
		for (const part of chunk(ids, ID_BATCH)) {
			const rows = await db
				.select({
					contentId: contentLines.contentId,
					lines: count(),
					timed: sql<number>`sum(case when ${contentLines.startTime} is null then 0 else 1 end)`
				})
				.from(contentLines)
				.where(inArray(contentLines.contentId, part))
				.groupBy(contentLines.contentId);
			for (const row of rows) {
				byId.set(row.contentId, { lines: Number(row.lines), timed: Number(row.timed ?? 0) });
			}
		}
		return byId;
	}

	async function songsOf(rows: ContentRow[]): Promise<SongRecord[]> {
		const songRows = rows.filter(isSongRow);
		const lines = await linesFor(songRows.map((r) => r.id));
		return songRows.map((row) => toSongRecord(row, lines.get(row.id) ?? []));
	}

	async function reportRows(where: SQL | undefined) {
		const rows = await db
			.select({
				r: takedownRequests,
				songTitle: contents.title,
				songOwnerId: contents.ownerId,
				songStatus: contents.status
			})
			.from(takedownRequests)
			.leftJoin(contents, eq(contents.id, takedownRequests.contentId))
			.where(where)
			.orderBy(asc(takedownRequests.createdAt));
		return rows.map(({ r, songTitle, songOwnerId, songStatus }) =>
			toReport(r, songTitle, songOwnerId, songStatus)
		);
	}

	function toReport(
		r: TakedownRow,
		songTitle: string | null,
		songOwnerId: string | null,
		songStatus: string | null
	): TakedownRecord {
		return {
			id: r.id,
			contentId: r.contentId ?? null,
			videoId: r.videoId ?? '',
			reporterContact: r.reporterContact,
			claim: r.claim,
			status: (r.status === 'removed' || r.status === 'rejected'
				? r.status
				: 'open') as ReportStatus,
			adminNote: r.adminNote ?? null,
			createdAt: r.createdAt,
			resolvedAt: r.resolvedAt ?? null,
			songTitle: songTitle ?? null,
			songOwnerId: songOwnerId ?? null,
			songStatus: songStatus === null ? null : songStatus === 'removed' ? 'removed' : 'active'
		};
	}

	return {
		async insertSong(song) {
			// One batch: the content row and its lines land together or not at all.
			const inserts = chunk(linesToRows(song.id, song.lines), LINE_BATCH).map((part) =>
				db.insert(contentLines).values(part)
			);
			await db.batch([db.insert(contents).values(songToContentRow(song)), ...inserts]);
		},

		async getSong(id) {
			const [row] = await db
				.select()
				.from(contents)
				.where(and(eq(contents.id, id), IS_SONG))
				.limit(1);
			if (!row) return undefined;
			const [song] = await songsOf([row]);
			return song;
		},

		async patchSong(id, patch) {
			const set: Record<string, unknown> = { updatedAt: patch.updatedAt };
			if (patch.title !== undefined) set.title = patch.title;
			if (patch.videoId !== undefined) set.videoId = patch.videoId;
			if (patch.publicConsentAt !== undefined) set.publicConsentAt = patch.publicConsentAt;
			if (patch.removedReason !== undefined) set.removedReason = patch.removedReason;
			const status = statusPatchOf(patch);
			if (status) {
				set.status = status.keepRemoved
					? sql`case when ${contents.status} = 'removed' then ${contents.status} else ${status.status} end`
					: status.status;
			}
			const update = db
				.update(contents)
				.set(set)
				.where(and(eq(contents.id, id), IS_SONG));
			if (patch.lines === undefined) {
				await update;
				return;
			}
			// Replacing the lines goes with the row update in one batch (like `setLines`).
			const del = db.delete(contentLines).where(eq(contentLines.contentId, id));
			const inserts = chunk(linesToRows(id, patch.lines), LINE_BATCH).map((part) =>
				db.insert(contentLines).values(part)
			);
			await db.batch([update, del, ...inserts]);
		},

		async deleteSong(id) {
			// content_lines has ON DELETE cascade, but D1 only enforces it with foreign keys on,
			// so the lines go first and the delete stays correct either way.
			await db.batch([
				db.delete(contentLines).where(eq(contentLines.contentId, id)),
				db.delete(contents).where(and(eq(contents.id, id), IS_SONG))
			]);
		},

		async listByOwner(ownerId) {
			const rows = await db
				.select()
				.from(contents)
				.where(eq(contents.ownerId, ownerId))
				.orderBy(desc(contents.updatedAt));
			return songsOf(rows);
		},

		async listPublic(q, limit, offset) {
			const where = and(IS_SONG, eq(contents.status, 'published'), titleLike(q));
			const rows = await db
				.select({
					id: contents.id,
					title: contents.title,
					videoId: contents.videoId,
					updatedAt: contents.updatedAt
				})
				.from(contents)
				.where(where)
				.orderBy(desc(contents.updatedAt))
				.limit(limit)
				.offset(offset);
			const [totals] = await db.select({ n: count() }).from(contents).where(where);
			const counts = await countsFor(rows.map((r) => r.id));
			return {
				rows: rows.map((r) => ({
					id: r.id,
					title: r.title,
					videoId: r.videoId ?? '',
					lineCount: counts.get(r.id)?.lines ?? 0,
					timedCount: counts.get(r.id)?.timed ?? 0,
					updatedAt: r.updatedAt
				})),
				total: totals?.n ?? 0
			};
		},

		async searchSongs(q, limit) {
			const rows = await db
				.select()
				.from(contents)
				.where(and(IS_SONG, titleLike(q)))
				.orderBy(desc(contents.updatedAt))
				.limit(limit);
			const songRows = rows.filter(isSongRow);
			const counts = await countsFor(songRows.map((r) => r.id));
			return songRows.map((row) => {
				const song = toSongRecord(row, []);
				return {
					id: song.id,
					title: song.title,
					ownerId: song.ownerId,
					videoId: song.videoId,
					lineCount: counts.get(row.id)?.lines ?? 0,
					visibility: song.visibility,
					status: song.status,
					removedReason: song.removedReason,
					updatedAt: song.updatedAt
				};
			});
		},

		async unpublishAll(ownerId, now) {
			const where = and(eq(contents.ownerId, ownerId), eq(contents.status, 'published'));
			const [totals] = await db.select({ n: count() }).from(contents).where(where);
			const n = totals?.n ?? 0;
			if (n === 0) return 0;
			await db.update(contents).set({ status: 'draft', updatedAt: now }).where(where);
			return n;
		},

		async insertTiming(row) {
			await db.insert(songTimings).values(row);
		},

		async findTimings(videoId) {
			const rows = await db
				.select()
				.from(songTimings)
				.where(eq(songTimings.videoId, videoId))
				.orderBy(desc(songTimings.useCount))
				.limit(50);
			return rows.map((r) => ({
				id: r.id,
				videoId: r.videoId,
				lineCount: r.lineCount,
				lineHashes: parseStrings(r.lineHashes),
				starts: parseNumbers(r.starts),
				useCount: r.useCount,
				createdAt: r.createdAt
			}));
		},

		async getTiming(id) {
			const [r] = await db.select().from(songTimings).where(eq(songTimings.id, id)).limit(1);
			if (!r) return undefined;
			return {
				id: r.id,
				videoId: r.videoId,
				lineCount: r.lineCount,
				lineHashes: parseStrings(r.lineHashes),
				starts: parseNumbers(r.starts),
				useCount: r.useCount,
				createdAt: r.createdAt
			};
		},

		async bumpUseCount(id) {
			await db
				.update(songTimings)
				.set({ useCount: sql`${songTimings.useCount} + 1` })
				.where(eq(songTimings.id, id));
		},

		async insertReport(row) {
			await db.insert(takedownRequests).values(row);
		},

		async getReport(id) {
			const rows = await reportRows(eq(takedownRequests.id, id));
			return rows[0];
		},

		async listReports(status) {
			return reportRows(status === 'all' ? undefined : eq(takedownRequests.status, status));
		},

		async patchReport(id, patch) {
			await db
				.update(takedownRequests)
				.set({ status: patch.status, adminNote: patch.adminNote, resolvedAt: patch.resolvedAt })
				.where(eq(takedownRequests.id, id));
		},

		async getStrikes(userId) {
			const [row] = await db
				.select()
				.from(userStrikes)
				.where(eq(userStrikes.userId, userId))
				.limit(1);
			return { strikes: row?.strikes ?? 0, suspendedAt: row?.suspendedAt ?? null };
		},

		async setStrikes(userId, value) {
			await db
				.insert(userStrikes)
				.values({ userId, strikes: value.strikes, suspendedAt: value.suspendedAt })
				.onConflictDoUpdate({
					target: userStrikes.userId,
					set: { strikes: value.strikes, suspendedAt: value.suspendedAt }
				});
		},

		async insertNotice(row) {
			await db.insert(notices).values(row);
		},

		async listNotices(userId, limit) {
			const rows = await db
				.select()
				.from(notices)
				.where(eq(notices.userId, userId))
				.orderBy(desc(notices.createdAt))
				.limit(limit);
			return rows.map((r) => ({
				id: r.id,
				kind: r.kind,
				message: r.message,
				createdAt: r.createdAt,
				readAt: r.readAt ?? null
			}));
		},

		async markNoticesRead(userId, now) {
			await db
				.update(notices)
				.set({ readAt: now })
				.where(and(eq(notices.userId, userId), isNull(notices.readAt)));
		}
	};
}

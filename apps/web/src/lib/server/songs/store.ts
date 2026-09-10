import { and, asc, count, desc, eq, isNull, sql, type SQL } from 'drizzle-orm';
import type { SongLine } from '../../songs.ts';
import type { TimingCandidate } from '../../song-hash.ts';
import type { Db } from '../db/index.ts';
import {
	notices,
	songTimings,
	songs,
	takedownRequests,
	userStrikes,
	type NewNoticeRow,
	type NewSongRow,
	type NewSongTimingRow,
	type NewTakedownRow,
	type SongRow,
	type TakedownRow
} from '../db/schema.ts';

export type SongVisibility = 'private' | 'public';
export type SongStatus = 'active' | 'removed';
export type ReportStatus = 'open' | 'removed' | 'rejected';

/** A song with its `lines` JSON already parsed. */
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

export interface TakedownRecord {
	id: string;
	songId: string | null;
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

/**
 * Persistence used by the song services: implemented on D1 below, faked in unit tests
 * (same shape as `RunStore`).
 */
export interface SongStore {
	insertSong(row: NewSongRow): Promise<void>;
	getSong(id: string): Promise<SongRecord | undefined>;
	patchSong(id: string, patch: SongPatch): Promise<void>;
	deleteSong(id: string): Promise<void>;
	listByOwner(ownerId: string): Promise<SongRecord[]>;
	/** `status='active' AND visibility='public'`, title search, newest update first. */
	listPublic(
		q: string,
		limit: number,
		offset: number
	): Promise<{ rows: PublicSongSummary[]; total: number }>;
	/** Admin song search across every owner and status. */
	searchSongs(q: string, limit: number): Promise<SongRecord[]>;
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

function parseLines(raw: string): SongLine[] {
	try {
		const parsed: unknown = JSON.parse(raw);
		if (!Array.isArray(parsed)) return [];
		const lines: SongLine[] = [];
		for (const item of parsed) {
			if (!item || typeof item !== 'object') continue;
			const { text, start } = item as { text?: unknown; start?: unknown };
			if (typeof text !== 'string') continue;
			lines.push(typeof start === 'number' && Number.isFinite(start) ? { text, start } : { text });
		}
		return lines;
	} catch {
		return [];
	}
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

function toRecord(row: SongRow): SongRecord {
	return {
		id: row.id,
		ownerId: row.ownerId,
		videoId: row.videoId,
		title: row.title,
		lines: parseLines(row.lines),
		visibility: row.visibility === 'public' ? 'public' : 'private',
		publicConsentAt: row.publicConsentAt ?? null,
		status: row.status === 'removed' ? 'removed' : 'active',
		removedReason: row.removedReason ?? null,
		createdAt: row.createdAt,
		updatedAt: row.updatedAt
	};
}

/** `LIKE` pattern for a free-text search; `%`, `_` and `\` in the query are literal. */
function likePattern(q: string): string {
	return `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
}

function titleLike(q: string) {
	return q === '' ? undefined : sql`${songs.title} LIKE ${likePattern(q)} ESCAPE '\\'`;
}

export function d1SongStore(db: Db): SongStore {
	async function reportRows(where: SQL | undefined) {
		const rows = await db
			.select({
				r: takedownRequests,
				songTitle: songs.title,
				songOwnerId: songs.ownerId,
				songStatus: songs.status
			})
			.from(takedownRequests)
			.leftJoin(songs, eq(songs.id, takedownRequests.songId))
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
			songId: r.songId ?? null,
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
		async insertSong(row) {
			await db.insert(songs).values(row);
		},

		async getSong(id) {
			const [row] = await db.select().from(songs).where(eq(songs.id, id)).limit(1);
			return row ? toRecord(row) : undefined;
		},

		async patchSong(id, patch) {
			const set: Partial<NewSongRow> = { updatedAt: patch.updatedAt };
			if (patch.title !== undefined) set.title = patch.title;
			if (patch.videoId !== undefined) set.videoId = patch.videoId;
			if (patch.lines !== undefined) set.lines = JSON.stringify(patch.lines);
			if (patch.visibility !== undefined) set.visibility = patch.visibility;
			if (patch.publicConsentAt !== undefined) set.publicConsentAt = patch.publicConsentAt;
			if (patch.status !== undefined) set.status = patch.status;
			if (patch.removedReason !== undefined) set.removedReason = patch.removedReason;
			await db.update(songs).set(set).where(eq(songs.id, id));
		},

		async deleteSong(id) {
			await db.delete(songs).where(eq(songs.id, id));
		},

		async listByOwner(ownerId) {
			const rows = await db
				.select()
				.from(songs)
				.where(eq(songs.ownerId, ownerId))
				.orderBy(desc(songs.updatedAt));
			return rows.map(toRecord);
		},

		async listPublic(q, limit, offset) {
			const where = and(eq(songs.visibility, 'public'), eq(songs.status, 'active'), titleLike(q));
			const rows = await db
				.select({
					id: songs.id,
					title: songs.title,
					videoId: songs.videoId,
					lines: songs.lines,
					updatedAt: songs.updatedAt
				})
				.from(songs)
				.where(where)
				.orderBy(desc(songs.updatedAt))
				.limit(limit)
				.offset(offset);
			const [totals] = await db.select({ n: count() }).from(songs).where(where);
			return {
				rows: rows.map((r) => {
					const lines = parseLines(r.lines);
					return {
						id: r.id,
						title: r.title,
						videoId: r.videoId,
						lineCount: lines.length,
						timedCount: lines.filter((l) => l.start !== undefined).length,
						updatedAt: r.updatedAt
					};
				}),
				total: totals?.n ?? 0
			};
		},

		async searchSongs(q, limit) {
			const rows = await db
				.select()
				.from(songs)
				.where(titleLike(q))
				.orderBy(desc(songs.updatedAt))
				.limit(limit);
			return rows.map(toRecord);
		},

		async unpublishAll(ownerId, now) {
			const rows = await db
				.select({ id: songs.id })
				.from(songs)
				.where(and(eq(songs.ownerId, ownerId), eq(songs.visibility, 'public')));
			if (rows.length === 0) return 0;
			await db
				.update(songs)
				.set({ visibility: 'private', updatedAt: now })
				.where(and(eq(songs.ownerId, ownerId), eq(songs.visibility, 'public')));
			return rows.length;
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

import {
	and,
	asc,
	count,
	desc,
	eq,
	inArray,
	isNotNull,
	isNull,
	or,
	sql,
	type SQL
} from 'drizzle-orm';
import {
	isContentType,
	isDifficulty,
	isJlptLevel,
	type ContentLine,
	type ContentMeta,
	type ContentStatus,
	type ContentSummary,
	type ContentType,
	type Difficulty,
	type JlptLevel
} from '../../contents.ts';
import type { Db } from '../db/index.ts';
import {
	contentLines,
	contents,
	type ContentLineRow,
	type ContentRow,
	type NewContentLineRow,
	type NewContentRow
} from '../db/schema.ts';

/** A content row as the app sees it, with the enum columns narrowed. */
export interface ContentRecord extends ContentMeta {
	createdBy: string | null;
	/** User-provided content: when the owner ticked the rights declaration (null → never). */
	publicConsentAt: number | null;
	/** Set together with `status = 'removed'`. */
	removedReason: string | null;
}

export interface ContentLineRecord extends ContentLine {
	id: string;
}

export interface ContentPatch {
	type?: ContentType;
	title?: string;
	description?: string;
	videoId?: string | null;
	jlptLevel?: JlptLevel;
	difficulty?: Difficulty;
	status?: ContentStatus;
	sourceType?: string;
	sourceUrl?: string;
	sourceName?: string;
	license?: string;
	rightsStatus?: string;
	publicConsentAt?: number | null;
	removedReason?: string | null;
	updatedAt: number;
}

/**
 * `status: 'all'` is the admin view; the public list always passes `'published'`.
 * `owner` separates platform content (`ownerId IS NULL`, the admin console and `/contents`) from
 * user-provided content (`ownerId` set, the song library); no caller lists both together.
 */
export interface ContentFilter {
	status: ContentStatus | 'all';
	owner: 'platform' | 'user';
	type?: ContentType;
	jlptLevel?: JlptLevel;
	difficulty?: Difficulty;
	q: string;
}

/** Persistence for the content services; implemented on D1, faked in the service tests. */
export interface ContentStore {
	insertContent(row: NewContentRow): Promise<void>;
	getContent(id: string): Promise<ContentRecord | undefined>;
	patchContent(id: string, patch: ContentPatch): Promise<void>;
	deleteContent(id: string): Promise<void>;
	listContents(
		filter: ContentFilter,
		limit: number,
		offset: number
	): Promise<{ rows: ContentSummary[]; total: number }>;
	getLines(contentId: string): Promise<ContentLineRecord[]>;
	/** Replace every line of a content in one go (the Line Editor saves the whole table). */
	setLines(contentId: string, rows: NewContentLineRow[]): Promise<void>;
}

function narrowType(value: string): ContentType {
	return isContentType(value) ? value : 'free';
}

function narrowJlpt(value: string): JlptLevel {
	return isJlptLevel(value) ? value : 'unknown';
}

function narrowDifficulty(value: string): Difficulty {
	return isDifficulty(value) ? value : 'normal';
}

function narrowStatus(value: string): ContentStatus {
	return value === 'published' || value === 'removed' ? value : 'draft';
}

function toRecord(row: ContentRow): ContentRecord {
	return {
		id: row.id,
		type: narrowType(row.type),
		title: row.title,
		description: row.description,
		videoId: row.videoId ?? null,
		jlptLevel: narrowJlpt(row.jlptLevel),
		difficulty: narrowDifficulty(row.difficulty),
		status: narrowStatus(row.status),
		sourceType: row.sourceType as ContentRecord['sourceType'],
		sourceUrl: row.sourceUrl,
		sourceName: row.sourceName,
		license: row.license,
		rightsStatus: row.rightsStatus === 'cleared' ? 'cleared' : 'unknown',
		createdBy: row.createdBy ?? null,
		ownerId: row.ownerId ?? null,
		publicConsentAt: row.publicConsentAt ?? null,
		removedReason: row.removedReason ?? null,
		createdAt: row.createdAt,
		updatedAt: row.updatedAt
	};
}

export function toLine(row: ContentLineRow): ContentLineRecord {
	return {
		id: row.id,
		order: row.order,
		startTime: row.startTime ?? null,
		endTime: row.endTime ?? null,
		originalText: row.originalText,
		kanaText: row.kanaText,
		romajiText: row.romajiText,
		metadata: row.metadata ?? null
	};
}

/** Plain `LIKE` search over title and description; `_` and `%` in the query are escaped. */
function textLike(q: string): SQL | undefined {
	const term = q.trim();
	if (term === '') return undefined;
	const pattern = `%${term.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
	return or(
		sql`${contents.title} LIKE ${pattern} ESCAPE '\\'`,
		sql`${contents.description} LIKE ${pattern} ESCAPE '\\'`
	);
}

function filterWhere(filter: ContentFilter): SQL | undefined {
	return and(
		filter.owner === 'platform' ? isNull(contents.ownerId) : isNotNull(contents.ownerId),
		filter.status === 'all' ? undefined : eq(contents.status, filter.status),
		filter.type === undefined ? undefined : eq(contents.type, filter.type),
		filter.jlptLevel === undefined ? undefined : eq(contents.jlptLevel, filter.jlptLevel),
		filter.difficulty === undefined ? undefined : eq(contents.difficulty, filter.difficulty),
		textLike(filter.q)
	);
}

export function d1ContentStore(db: Db): ContentStore {
	/** Line counts for a page of contents, in one query over the ids. */
	async function counts(ids: string[]) {
		if (ids.length === 0) return [];
		const rows = await db
			.select({
				contentId: contentLines.contentId,
				lineCount: count(),
				timedCount: sql<number>`sum(case when ${contentLines.startTime} is null then 0 else 1 end)`
			})
			.from(contentLines)
			.where(inArray(contentLines.contentId, ids))
			.groupBy(contentLines.contentId);
		return rows;
	}

	return {
		async insertContent(row) {
			await db.insert(contents).values(row);
		},

		async getContent(id) {
			const [row] = await db.select().from(contents).where(eq(contents.id, id)).limit(1);
			return row ? toRecord(row) : undefined;
		},

		async patchContent(id, patch) {
			const set: Partial<NewContentRow> = { updatedAt: patch.updatedAt };
			if (patch.type !== undefined) set.type = patch.type;
			if (patch.title !== undefined) set.title = patch.title;
			if (patch.description !== undefined) set.description = patch.description;
			if (patch.videoId !== undefined) set.videoId = patch.videoId;
			if (patch.jlptLevel !== undefined) set.jlptLevel = patch.jlptLevel;
			if (patch.difficulty !== undefined) set.difficulty = patch.difficulty;
			if (patch.status !== undefined) set.status = patch.status;
			if (patch.sourceType !== undefined) set.sourceType = patch.sourceType;
			if (patch.sourceUrl !== undefined) set.sourceUrl = patch.sourceUrl;
			if (patch.sourceName !== undefined) set.sourceName = patch.sourceName;
			if (patch.license !== undefined) set.license = patch.license;
			if (patch.rightsStatus !== undefined) set.rightsStatus = patch.rightsStatus;
			if (patch.publicConsentAt !== undefined) set.publicConsentAt = patch.publicConsentAt;
			if (patch.removedReason !== undefined) set.removedReason = patch.removedReason;
			await db.update(contents).set(set).where(eq(contents.id, id));
		},

		async deleteContent(id) {
			// content_lines has ON DELETE cascade, but D1 only enforces it with foreign keys on,
			// so the lines go first and the delete stays correct either way.
			await db.delete(contentLines).where(eq(contentLines.contentId, id));
			await db.delete(contents).where(eq(contents.id, id));
		},

		async listContents(filter, limit, offset) {
			const where = filterWhere(filter);
			const rows = await db
				.select()
				.from(contents)
				.where(where)
				.orderBy(desc(contents.updatedAt))
				.limit(limit)
				.offset(offset);
			const [totals] = await db.select({ n: count() }).from(contents).where(where);
			const byId = await counts(rows.map((r) => r.id));
			return {
				rows: rows.map((row) => {
					const record = toRecord(row);
					const c = byId.find((x) => x.contentId === row.id);
					return {
						id: record.id,
						type: record.type,
						title: record.title,
						description: record.description,
						videoId: record.videoId,
						jlptLevel: record.jlptLevel,
						difficulty: record.difficulty,
						status: record.status,
						updatedAt: record.updatedAt,
						lineCount: Number(c?.lineCount ?? 0),
						timedCount: Number(c?.timedCount ?? 0)
					};
				}),
				total: totals?.n ?? 0
			};
		},

		async getLines(contentId) {
			const rows = await db
				.select()
				.from(contentLines)
				.where(eq(contentLines.contentId, contentId))
				.orderBy(asc(contentLines.order));
			return rows.map(toLine);
		},

		async setLines(contentId, rows) {
			// D1 has no interactive transaction, but it does have batches: one delete plus the
			// inserts go to the database together, so a content is never left half-edited.
			const del = db.delete(contentLines).where(eq(contentLines.contentId, contentId));
			const inserts = chunk(rows, LINE_BATCH).map((part) => db.insert(contentLines).values(part));
			await db.batch([del, ...inserts]);
		}
	};
}

/** Lines per INSERT: D1 caps the bound parameters per statement (9 columns × 20 rows). */
export const LINE_BATCH = 20;

/** Split a line list into INSERT-sized parts. */
export function chunk<T>(items: readonly T[], size: number): T[][] {
	const out: T[][] = [];
	for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size) as T[]);
	return out;
}

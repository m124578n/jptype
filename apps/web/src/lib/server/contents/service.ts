/**
 * Content services (M4-1): pure functions over a `ContentStore`, unit-tested against a fake
 * store, so the API routes stay a few lines each — the same shape as `runs/submit.ts` and
 * `songs/service.ts`.
 *
 * The rules that matter:
 * - everything here is about **platform content** (`ownerId === null`): a user-provided row
 *   (the song library, M4-1c) is invisible to these services — the admin console never opens a
 *   user's private lyrics, and `/contents` never lists them (ROADMAP M4-1);
 * - contents and lines are **admin-only** to write; the route checks `ADMIN_EMAILS` first;
 * - a content may only be published when `rightsStatus === 'cleared'` **and** at least one line
 *   is typeable by the engine (ROADMAP M4-1「rightsStatus 不明者不得發布」);
 * - the public list and the public get show `published` contents only — a draft 404s, so an
 *   unfinished import is not readable by guessing its id;
 * - `setLines` replaces the whole line table of a content in one batch: the Line Editor edits the
 *   table as a unit (reorder, delete, insert), and a partial save would break the ordering.
 */
import {
	isContentType,
	isDifficulty,
	isJlptLevel,
	isRightsStatus,
	isSourceType,
	typeableCount,
	type ContentLine,
	type ContentStatus,
	type ContentSummary,
	type ContentType,
	type Difficulty,
	type JlptLevel,
	type RightsStatus,
	type SourceType
} from '../../contents.ts';
import { parseYoutubeId } from '../../songs.ts';
import type { NewContentLineRow } from '../db/schema.ts';
import { ulid } from '../ulid.ts';
import type { ContentFilter, ContentLineRecord, ContentRecord, ContentStore } from './store.ts';

export interface ContentDeps {
	store: ContentStore;
	now?: () => number;
	newId?: (nowMs: number) => string;
}

export type ErrorStatus = 400 | 401 | 403 | 404 | 409;
export type Result<T> = { ok: true; body: T } | { ok: false; status: ErrorStatus; error: string };

export const MAX_TITLE_CHARS = 120;
export const MAX_DESCRIPTION_CHARS = 2000;
export const MAX_SOURCE_CHARS = 500;
export const MAX_LINES = 1000;
export const MAX_LINE_CHARS = 300;
export const MAX_METADATA_CHARS = 2000;
export const MAX_QUERY_CHARS = 80;
export const PAGE_SIZE = 24;
export const ADMIN_PAGE_SIZE = 50;
/** Longest video position we accept, in seconds (≈ 24 h): a typo must not become a timeline. */
export const MAX_TIME_S = 86_400;

function fail(
	status: ErrorStatus,
	error: string
): { ok: false; status: ErrorStatus; error: string } {
	return { ok: false, status, error };
}

function clock(deps: ContentDeps): number {
	return deps.now?.() ?? Date.now();
}

function id(deps: ContentDeps, nowMs: number): string {
	return (deps.newId ?? ulid)(nowMs);
}

// ── Body validation (shape only, like `parseSubmission`) ────────────────────────────────────────

export interface ContentInput {
	type: ContentType;
	title: string;
	description: string;
	videoId: string | null;
	jlptLevel: JlptLevel;
	difficulty: Difficulty;
	sourceType: SourceType;
	sourceUrl: string;
	sourceName: string;
	license: string;
	rightsStatus: RightsStatus;
}

export type ContentPatchInput = Partial<ContentInput>;

export interface LineInput {
	startTime: number | null;
	endTime: number | null;
	originalText: string;
	kanaText: string;
	romajiText: string;
	metadata: string | null;
}

function text(raw: unknown, max: number): string | null {
	if (typeof raw !== 'string') return null;
	const value = raw.trim();
	return value.length > max ? null : value;
}

/** `videoId` accepts any YouTube URL shape; an empty string clears it. */
function videoIdField(raw: unknown): string | null | 'invalid' {
	if (raw === null || raw === undefined || raw === '') return null;
	if (typeof raw !== 'string') return 'invalid';
	return parseYoutubeId(raw) ?? 'invalid';
}

function timeField(raw: unknown): number | null | 'invalid' {
	if (raw === null || raw === undefined || raw === '') return null;
	if (typeof raw !== 'number' || !Number.isFinite(raw) || raw < 0 || raw > MAX_TIME_S) {
		return 'invalid';
	}
	return Math.round(raw * 100) / 100;
}

/** POST /api/admin/contents body. */
export function parseContentInput(raw: unknown): ContentInput | string {
	if (!raw || typeof raw !== 'object') return 'body must be an object';
	const b = raw as Record<string, unknown>;

	const title = text(b.title, MAX_TITLE_CHARS);
	if (title === null || title === '') return 'title invalid';
	if (!isContentType(b.type)) return 'type invalid';

	const description = text(b.description ?? '', MAX_DESCRIPTION_CHARS);
	if (description === null) return 'description invalid';

	const videoId = videoIdField(b.videoId);
	if (videoId === 'invalid') return 'videoId invalid';

	const jlptLevel = b.jlptLevel ?? 'unknown';
	if (!isJlptLevel(jlptLevel)) return 'jlptLevel invalid';
	const difficulty = b.difficulty ?? 'normal';
	if (!isDifficulty(difficulty)) return 'difficulty invalid';
	if (!isSourceType(b.sourceType)) return 'sourceType invalid';
	if (!isRightsStatus(b.rightsStatus ?? 'unknown')) return 'rightsStatus invalid';

	const sourceUrl = text(b.sourceUrl ?? '', MAX_SOURCE_CHARS);
	const sourceName = text(b.sourceName ?? '', MAX_SOURCE_CHARS);
	const license = text(b.license ?? '', MAX_SOURCE_CHARS);
	if (sourceUrl === null || sourceName === null || license === null) return 'source fields invalid';

	return {
		type: b.type,
		title,
		description,
		videoId,
		jlptLevel,
		difficulty,
		sourceType: b.sourceType,
		sourceUrl,
		sourceName,
		license,
		rightsStatus: (b.rightsStatus ?? 'unknown') as RightsStatus
	};
}

/** PUT /api/admin/contents/[id] body: any subset of the fields, at least one. */
export function parseContentPatchInput(raw: unknown): ContentPatchInput | string {
	if (!raw || typeof raw !== 'object') return 'body must be an object';
	const b = raw as Record<string, unknown>;
	const patch: ContentPatchInput = {};

	if (b.title !== undefined) {
		const title = text(b.title, MAX_TITLE_CHARS);
		if (title === null || title === '') return 'title invalid';
		patch.title = title;
	}
	if (b.type !== undefined) {
		if (!isContentType(b.type)) return 'type invalid';
		patch.type = b.type;
	}
	if (b.description !== undefined) {
		const description = text(b.description, MAX_DESCRIPTION_CHARS);
		if (description === null) return 'description invalid';
		patch.description = description;
	}
	if (b.videoId !== undefined) {
		const videoId = videoIdField(b.videoId);
		if (videoId === 'invalid') return 'videoId invalid';
		patch.videoId = videoId;
	}
	if (b.jlptLevel !== undefined) {
		if (!isJlptLevel(b.jlptLevel)) return 'jlptLevel invalid';
		patch.jlptLevel = b.jlptLevel;
	}
	if (b.difficulty !== undefined) {
		if (!isDifficulty(b.difficulty)) return 'difficulty invalid';
		patch.difficulty = b.difficulty;
	}
	if (b.sourceType !== undefined) {
		if (!isSourceType(b.sourceType)) return 'sourceType invalid';
		patch.sourceType = b.sourceType;
	}
	if (b.rightsStatus !== undefined) {
		if (!isRightsStatus(b.rightsStatus)) return 'rightsStatus invalid';
		patch.rightsStatus = b.rightsStatus;
	}
	for (const key of ['sourceUrl', 'sourceName', 'license'] as const) {
		if (b[key] === undefined) continue;
		const value = text(b[key], MAX_SOURCE_CHARS);
		if (value === null) return `${key} invalid`;
		patch[key] = value;
	}

	if (Object.keys(patch).length === 0) return 'nothing to update';
	return patch;
}

/** PUT /api/admin/contents/[id]/lines body: the whole line table, in order. */
export function parseLinesInput(raw: unknown): LineInput[] | string {
	const list = (raw as { lines?: unknown } | null)?.lines ?? raw;
	if (!Array.isArray(list)) return 'lines must be an array';
	if (list.length > MAX_LINES) return 'too many lines';

	const lines: LineInput[] = [];
	for (const item of list as unknown[]) {
		if (!item || typeof item !== 'object') return 'line invalid';
		const l = item as Record<string, unknown>;

		const kanaText = text(l.kanaText, MAX_LINE_CHARS);
		if (kanaText === null || kanaText === '') return 'kanaText invalid';
		const originalText = text(l.originalText ?? kanaText, MAX_LINE_CHARS);
		if (originalText === null) return 'originalText invalid';
		const romajiText = text(l.romajiText ?? '', MAX_LINE_CHARS);
		if (romajiText === null) return 'romajiText invalid';

		const startTime = timeField(l.startTime);
		if (startTime === 'invalid') return 'startTime invalid';
		const endTime = timeField(l.endTime);
		if (endTime === 'invalid') return 'endTime invalid';

		let metadata: string | null = null;
		if (l.metadata !== undefined && l.metadata !== null && l.metadata !== '') {
			if (typeof l.metadata !== 'string' || l.metadata.length > MAX_METADATA_CHARS) {
				return 'metadata invalid';
			}
			metadata = l.metadata;
		}

		lines.push({ startTime, endTime, originalText, kanaText, romajiText, metadata });
	}
	return lines;
}

/** `{ status }` when valid, the message otherwise — a bare string would be ambiguous here. */
export function parseStatusInput(raw: unknown): { status: ContentStatus } | string {
	if (!raw || typeof raw !== 'object') return 'body must be an object';
	const status = (raw as Record<string, unknown>).status;
	if (status !== 'draft' && status !== 'published') return 'status invalid';
	return { status };
}

export interface ListQuery extends ContentFilter {
	page: number;
}

/** `?type=&jlpt=&difficulty=&q=&page=` — an unknown value drops the filter instead of erroring. */
export function parseListQuery(params: URLSearchParams, status: ContentStatus | 'all'): ListQuery {
	const type = params.get('type');
	const jlpt = params.get('jlpt');
	const difficulty = params.get('difficulty');
	const rawPage = Number(params.get('page') ?? '1');
	return {
		status,
		owner: 'platform',
		...(isContentType(type) ? { type } : {}),
		...(isJlptLevel(jlpt) ? { jlptLevel: jlpt } : {}),
		...(isDifficulty(difficulty) ? { difficulty } : {}),
		q: (params.get('q') ?? '').trim().slice(0, MAX_QUERY_CHARS),
		page: Number.isFinite(rawPage) && rawPage >= 1 ? Math.floor(rawPage) : 1
	};
}

// ── Admin services ─────────────────────────────────────────────────────────────────────────────

/** A platform content by id; a user-provided row is a 404 here, like a missing one. */
async function platformContent(
	contentId: string,
	deps: ContentDeps
): Promise<ContentRecord | undefined> {
	const found = await deps.store.getContent(contentId);
	return found && found.ownerId === null ? found : undefined;
}

export async function createContent(
	userId: string,
	input: ContentInput,
	deps: ContentDeps
): Promise<Result<ContentRecord>> {
	const now = clock(deps);
	const contentId = id(deps, now);
	await deps.store.insertContent({
		id: contentId,
		type: input.type,
		title: input.title,
		description: input.description,
		videoId: input.videoId,
		jlptLevel: input.jlptLevel,
		difficulty: input.difficulty,
		status: 'draft',
		sourceType: input.sourceType,
		sourceUrl: input.sourceUrl,
		sourceName: input.sourceName,
		license: input.license,
		rightsStatus: input.rightsStatus,
		createdBy: userId,
		ownerId: null,
		publicConsentAt: null,
		removedReason: null,
		createdAt: now,
		updatedAt: now
	});
	return {
		ok: true,
		body: {
			...input,
			id: contentId,
			status: 'draft',
			createdBy: userId,
			ownerId: null,
			publicConsentAt: null,
			removedReason: null,
			createdAt: now,
			updatedAt: now
		}
	};
}

export async function updateContent(
	contentId: string,
	patch: ContentPatchInput,
	deps: ContentDeps
): Promise<Result<ContentRecord>> {
	const found = await platformContent(contentId, deps);
	if (!found) return fail(404, 'content not found');
	const now = clock(deps);
	await deps.store.patchContent(contentId, { ...patch, updatedAt: now });
	return { ok: true, body: { ...found, ...patch, updatedAt: now } };
}

export async function deleteContent(
	contentId: string,
	deps: ContentDeps
): Promise<Result<{ deleted: true }>> {
	const found = await platformContent(contentId, deps);
	if (!found) return fail(404, 'content not found');
	await deps.store.deleteContent(contentId);
	return { ok: true, body: { deleted: true } };
}

/** Replace the whole line table of a content; `order` is the position in the array. */
export async function setContentLines(
	contentId: string,
	lines: readonly LineInput[],
	deps: ContentDeps
): Promise<Result<{ lines: ContentLineRecord[] }>> {
	const found = await platformContent(contentId, deps);
	if (!found) return fail(404, 'content not found');
	const now = clock(deps);

	const rows: NewContentLineRow[] = lines.map((line, index) => ({
		id: id(deps, now + index),
		contentId,
		order: index,
		startTime: line.startTime,
		endTime: line.endTime,
		originalText: line.originalText,
		kanaText: line.kanaText,
		romajiText: line.romajiText,
		metadata: line.metadata
	}));
	await deps.store.setLines(contentId, rows);
	await deps.store.patchContent(contentId, { updatedAt: now });

	// A published content whose lines all became untypeable would be broken; drop it to draft.
	const stored = await deps.store.getLines(contentId);
	if (found.status === 'published' && typeableCount(stored) === 0) {
		await deps.store.patchContent(contentId, { status: 'draft', updatedAt: now });
	}
	return { ok: true, body: { lines: stored } };
}

/**
 * Publish / unpublish. Publishing is the moment the content becomes practisable by everyone, so
 * it needs cleared rights and at least one line the engine can type.
 */
export async function setContentStatus(
	contentId: string,
	status: ContentStatus,
	deps: ContentDeps
): Promise<Result<ContentRecord>> {
	const found = await platformContent(contentId, deps);
	if (!found) return fail(404, 'content not found');
	const now = clock(deps);

	if (status === 'published') {
		if (found.rightsStatus !== 'cleared') return fail(409, 'rights not cleared');
		const lines = await deps.store.getLines(contentId);
		if (typeableCount(lines) === 0) return fail(409, 'no typeable line');
	}
	await deps.store.patchContent(contentId, { status, updatedAt: now });
	return { ok: true, body: { ...found, status, updatedAt: now } };
}

export interface ContentList {
	contents: ContentSummary[];
	total: number;
	page: number;
	pageSize: number;
}

async function list(query: ListQuery, pageSize: number, deps: ContentDeps): Promise<ContentList> {
	const { page, ...filter } = query;
	const { rows, total } = await deps.store.listContents(filter, pageSize, (page - 1) * pageSize);
	return { contents: rows, total, page, pageSize };
}

/** Admin list: every status of the platform content, newest update first. */
export function listContentsAsAdmin(query: ListQuery, deps: ContentDeps): Promise<ContentList> {
	return list({ ...query, owner: 'platform' }, ADMIN_PAGE_SIZE, deps);
}

/**
 * Public list: published platform content only. Plain filters and search, newest first —
 * nothing is curated, and a user's published song is found on `/songs`, not here.
 */
export function listPublicContents(query: ListQuery, deps: ContentDeps): Promise<ContentList> {
	return list({ ...query, status: 'published', owner: 'platform' }, PAGE_SIZE, deps);
}

export interface ContentDetail {
	content: ContentRecord;
	lines: ContentLineRecord[];
}

/** Admin detail: any status. */
export async function getContentAsAdmin(
	contentId: string,
	deps: ContentDeps
): Promise<Result<ContentDetail>> {
	const content = await platformContent(contentId, deps);
	if (!content) return fail(404, 'content not found');
	return { ok: true, body: { content, lines: await deps.store.getLines(contentId) } };
}

/** Public detail: a draft is a 404, exactly like a content that does not exist. */
export async function getPublicContent(
	contentId: string,
	deps: ContentDeps
): Promise<Result<ContentDetail>> {
	const content = await platformContent(contentId, deps);
	if (!content || content.status !== 'published') return fail(404, 'content not found');
	return { ok: true, body: { content, lines: await deps.store.getLines(contentId) } };
}

/**
 * The question pool of `content:{id}` for `POST /api/runs`: the kana of every published line.
 * Undefined when the content is not published platform content, which makes the run fail
 * validation — a user's song stays out of the leaderboard (ROADMAP M3 C「不進榜」).
 */
export async function contentPool(
	contentId: string,
	deps: ContentDeps
): Promise<readonly string[] | undefined> {
	const content = await platformContent(contentId, deps);
	if (!content || content.status !== 'published') return undefined;
	const lines = await deps.store.getLines(contentId);
	return lines.map((l: Pick<ContentLine, 'kanaText'>) => l.kanaText);
}

/**
 * How a song maps onto the unified content model (M4-1c).
 *
 * A song is a `contents` row with `ownerId` set and `sourceType = 'user_provided'`, plus one
 * `content_lines` row per lyric line. The song API keeps talking in `visibility` + `status`
 * (what the pages and the service tests were written against); this module is the one place
 * that translates between that view and the `contents.status` column:
 *
 * | song view                                 | contents.status |
 * | ----------------------------------------- | --------------- |
 * | `visibility: 'private'`, `status: 'active'` | `'draft'`       |
 * | `visibility: 'public'`, `status: 'active'`  | `'published'`   |
 * | `status: 'removed'` (any visibility)        | `'removed'`     |
 *
 * Pure functions only, so the mapping is unit-tested without D1.
 */
import { isContentType } from '../../contents.ts';
import { toRomaji } from '../../ja/romaji.ts';
import { tokensAligned, type SongLine, type SongToken } from '../../songs.ts';
import type { ContentRow, NewContentLineRow, NewContentRow } from '../db/schema.ts';
import type { SongPatch, SongRecord, SongStatus, SongVisibility } from './store.ts';

export type SongContentStatus = 'draft' | 'published' | 'removed';

/** `contents.status` for a song in the given state. */
export function contentStatusOf(visibility: SongVisibility, status: SongStatus): SongContentStatus {
	if (status === 'removed') return 'removed';
	return visibility === 'public' ? 'published' : 'draft';
}

/** The song view of a `contents.status` value; anything unexpected reads as private + active. */
export function songStateOf(status: string): { visibility: SongVisibility; status: SongStatus } {
	if (status === 'removed') return { visibility: 'private', status: 'removed' };
	return { visibility: status === 'published' ? 'public' : 'private', status: 'active' };
}

/**
 * The `contents.status` a patch asks for, or undefined when it touches neither field.
 * A visibility change alone must not resurrect a removed song, so the store applies the
 * result with `keepRemoved` (SQL `CASE WHEN status = 'removed' THEN status ELSE ? END`).
 */
export function statusPatchOf(
	patch: Pick<SongPatch, 'visibility' | 'status'>
): { status: SongContentStatus; keepRemoved: boolean } | undefined {
	if (patch.status === 'removed') return { status: 'removed', keepRemoved: false };
	if (patch.status === 'active') {
		return { status: patch.visibility === 'public' ? 'published' : 'draft', keepRemoved: false };
	}
	if (patch.visibility !== undefined) {
		return { status: patch.visibility === 'public' ? 'published' : 'draft', keepRemoved: true };
	}
	return undefined;
}

/** The `contents` row for a song; everything a song does not have takes the platform default. */
export function songToContentRow(song: SongRecord): NewContentRow {
	return {
		id: song.id,
		type: song.type,
		title: song.title,
		description: '',
		videoId: song.videoId,
		jlptLevel: 'unknown',
		difficulty: 'normal',
		status: contentStatusOf(song.visibility, song.status),
		sourceType: 'user_provided',
		sourceUrl: '',
		sourceName: '',
		license: '',
		// The owner's declaration lives in `publicConsentAt`; nobody has verified the rights.
		rightsStatus: 'unknown',
		createdBy: song.ownerId,
		ownerId: song.ownerId,
		publicConsentAt: song.publicConsentAt,
		removedReason: song.removedReason,
		createdAt: song.createdAt,
		updatedAt: song.updatedAt
	};
}

/** Deterministic line id: the lines of a song are always replaced as a whole. */
export function lineId(contentId: string, order: number): string {
	return `${contentId}-${String(order).padStart(4, '0')}`;
}

/**
 * `content_lines` rows for a song's lines. `kanaText` is what the engine types; `originalText`
 * is the pasted line with its kanji when the reading was converted in the browser (M4-1d),
 * otherwise the same kana; the romaji is derived so the row looks like any other content line.
 */
export function linesToRows(contentId: string, lines: readonly SongLine[]): NewContentLineRow[] {
	return lines.map((line, order) => ({
		id: lineId(contentId, order),
		contentId,
		order,
		startTime: line.start ?? null,
		endTime: null,
		originalText: line.original ?? line.text,
		kanaText: line.text,
		romajiText: toRomaji(line.text),
		metadata: line.tokens === undefined ? null : JSON.stringify({ tokens: packTokens(line.tokens) })
	}));
}

/** `[[surface, reading], …]` — the compact form `content_lines.metadata` holds. */
function packTokens(tokens: readonly SongToken[]): [string, string][] {
	return tokens.map((t) => [t.surface, t.reading]);
}

/** The tokens in a metadata JSON string, if it holds any that still add up to `text`. */
export function unpackTokens(
	metadata: string | null | undefined,
	text: string
): SongToken[] | undefined {
	if (!metadata) return undefined;
	try {
		const parsed: unknown = JSON.parse(metadata);
		const raw = (parsed as { tokens?: unknown } | null)?.tokens;
		if (!Array.isArray(raw)) return undefined;
		const tokens: SongToken[] = [];
		for (const pair of raw as unknown[]) {
			if (!Array.isArray(pair) || typeof pair[0] !== 'string' || typeof pair[1] !== 'string') {
				return undefined;
			}
			tokens.push({ surface: pair[0], reading: pair[1] });
		}
		return tokensAligned(tokens, text) ? tokens : undefined;
	} catch {
		return undefined;
	}
}

/** Back to the song shape; rows must already be in `order`. */
export function rowsToLines(
	rows: readonly {
		kanaText: string;
		originalText?: string;
		startTime?: number | null;
		metadata?: string | null;
	}[]
): SongLine[] {
	return rows.map((row) => {
		const line: SongLine = { text: row.kanaText };
		if (row.startTime !== null && row.startTime !== undefined) line.start = row.startTime;
		if (row.originalText !== undefined && row.originalText !== row.kanaText) {
			line.original = row.originalText;
		}
		const tokens = unpackTokens(row.metadata, row.kanaText);
		if (tokens) line.tokens = tokens;
		return line;
	});
}

/** Whether a `contents` row is a song at all (user-provided rows only reach the song API). */
export function isSongRow(
	row: Pick<ContentRow, 'ownerId'>
): row is ContentRow & { ownerId: string } {
	return typeof row.ownerId === 'string' && row.ownerId !== '';
}

export function toSongRecord(row: ContentRow & { ownerId: string }, lines: SongLine[]): SongRecord {
	const state = songStateOf(row.status);
	return {
		id: row.id,
		ownerId: row.ownerId,
		type: isContentType(row.type) ? row.type : 'free',
		videoId: row.videoId ?? null,
		title: row.title,
		lines,
		visibility: state.visibility,
		publicConsentAt: row.publicConsentAt ?? null,
		status: state.status,
		removedReason: row.removedReason ?? null,
		createdAt: row.createdAt,
		updatedAt: row.updatedAt
	};
}

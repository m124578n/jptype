/**
 * The content model shared by the browser and the Worker (M4-1).
 *
 * Every practice surface beyond the kana lessons — songs, anime lines, news, novels, JLPT drills,
 * free text — is a `contents` row plus its `content_lines`. The repo ships **zero** content.
 * Platform content (`ownerId === null`) is imported by an admin through `/admin/contents`, and
 * the rights columns below record where it came from; nothing may be published while
 * `rightsStatus` is `'unknown'`. User-provided content (`ownerId` set, M4-1c) is a user's own
 * lyric paste: private unless the owner publishes it, and never in the public content list.
 */
import { validateLines } from './songs.ts';

export const CONTENT_TYPES = ['song', 'anime', 'news', 'novel', 'jlpt', 'free'] as const;
export type ContentType = (typeof CONTENT_TYPES)[number];

export const JLPT_LEVELS = ['N5', 'N4', 'N3', 'N2', 'N1', 'unknown'] as const;
export type JlptLevel = (typeof JLPT_LEVELS)[number];

export const DIFFICULTIES = ['easy', 'normal', 'hard', 'expert'] as const;
export type Difficulty = (typeof DIFFICULTIES)[number];

/**
 * `draft` → only its author reads it; `published` → practisable by everyone; `removed` → taken
 * down after a rights notice (user-provided content only), kept on record but never shown.
 */
export const CONTENT_STATUSES = ['draft', 'published', 'removed'] as const;
export type ContentStatus = (typeof CONTENT_STATUSES)[number];

export const SOURCE_TYPES = [
	'original',
	'licensed',
	'public_domain',
	'user_provided',
	'other'
] as const;
export type SourceType = (typeof SOURCE_TYPES)[number];

export const RIGHTS_STATUSES = ['cleared', 'unknown'] as const;
export type RightsStatus = (typeof RIGHTS_STATUSES)[number];

/** Rights metadata, required on every content (ROADMAP M4-1). */
export interface ContentRights {
	sourceType: SourceType;
	sourceUrl: string;
	sourceName: string;
	license: string;
	rightsStatus: RightsStatus;
}

export interface ContentMeta extends ContentRights {
	id: string;
	type: ContentType;
	title: string;
	description: string;
	/** 11-char YouTube id, or null when the content is not timed to a video. */
	videoId: string | null;
	jlptLevel: JlptLevel;
	difficulty: Difficulty;
	status: ContentStatus;
	/** The user who owns this content, or null for platform content imported by an admin. */
	ownerId: string | null;
	createdAt: number;
	updatedAt: number;
}

/** One typing question. `kanaText` is what the engine types; the rest is context for the reader. */
export interface ContentLine {
	order: number;
	startTime: number | null;
	endTime: number | null;
	originalText: string;
	kanaText: string;
	romajiText: string;
	metadata: string | null;
}

/** What the list pages show: no lines, just enough for a card. */
export interface ContentSummary {
	id: string;
	type: ContentType;
	title: string;
	description: string;
	videoId: string | null;
	jlptLevel: JlptLevel;
	difficulty: Difficulty;
	status: ContentStatus;
	updatedAt: number;
	lineCount: number;
	/** Lines that carry a `startTime`; two or more make a sync run possible. */
	timedCount: number;
}

export function isContentType(value: unknown): value is ContentType {
	return CONTENT_TYPES.includes(value as ContentType);
}

export function isJlptLevel(value: unknown): value is JlptLevel {
	return JLPT_LEVELS.includes(value as JlptLevel);
}

export function isDifficulty(value: unknown): value is Difficulty {
	return DIFFICULTIES.includes(value as Difficulty);
}

export function isContentStatus(value: unknown): value is ContentStatus {
	return CONTENT_STATUSES.includes(value as ContentStatus);
}

export function isSourceType(value: unknown): value is SourceType {
	return SOURCE_TYPES.includes(value as SourceType);
}

export function isRightsStatus(value: unknown): value is RightsStatus {
	return RIGHTS_STATUSES.includes(value as RightsStatus);
}

/** YouTube's own thumbnail; the only third-party asset a content card loads. */
export function thumbnailUrl(videoId: string): string {
	return `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`;
}

/** A line can be practised only when the engine can type every character of its kana. */
export function isTypeable(kanaText: string): boolean {
	const text = kanaText.trim();
	if (text === '') return false;
	return validateLines([{ text }]).length === 0;
}

/** Spec for publishing: at least one line the engine can actually type. */
export function typeableCount(lines: readonly Pick<ContentLine, 'kanaText'>[]): number {
	return lines.filter((l) => isTypeable(l.kanaText)).length;
}

/** Sync mode needs a timeline: two or more lines with a start time (same rule as 歌詞同步). */
export function hasTimeline(lines: readonly Pick<ContentLine, 'startTime'>[]): boolean {
	return lines.filter((l) => l.startTime !== null).length >= 2;
}

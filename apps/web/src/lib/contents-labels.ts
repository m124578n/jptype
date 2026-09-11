/**
 * zh-TW labels and icons for the content enums, in one place so the public list, the content
 * page and the admin console name a type the same way. Every string still comes from Paraglide.
 */
import { m } from '$lib/paraglide/messages';
import type { ContentStatus, ContentType, Difficulty, JlptLevel } from './contents.ts';

export const typeLabel: Record<ContentType, () => string> = {
	song: m.contents_type_song,
	anime: m.contents_type_anime,
	news: m.contents_type_news,
	novel: m.contents_type_novel,
	jlpt: m.contents_type_jlpt,
	free: m.contents_type_free
};

export const typeIcon: Record<
	ContentType,
	'music' | 'film' | 'newspaper' | 'book' | 'clipboard' | 'pen'
> = {
	song: 'music',
	anime: 'film',
	news: 'newspaper',
	novel: 'book',
	jlpt: 'clipboard',
	free: 'pen'
};

export const jlptLabel: Record<JlptLevel, () => string> = {
	N5: m.contents_jlpt_n5,
	N4: m.contents_jlpt_n4,
	N3: m.contents_jlpt_n3,
	N2: m.contents_jlpt_n2,
	N1: m.contents_jlpt_n1,
	unknown: m.contents_jlpt_unknown
};

export const difficultyLabel: Record<Difficulty, () => string> = {
	easy: m.contents_difficulty_easy,
	normal: m.contents_difficulty_normal,
	hard: m.contents_difficulty_hard,
	expert: m.contents_difficulty_expert
};

export const statusLabel: Record<ContentStatus, () => string> = {
	draft: m.admin_contents_status_draft,
	published: m.admin_contents_status_published,
	removed: m.admin_contents_status_removed
};

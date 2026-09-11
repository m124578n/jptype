import { describe, expect, it } from 'vitest';
import type { ContentRow } from '../db/schema.ts';
import {
	contentStatusOf,
	isSongRow,
	lineId,
	linesToRows,
	rowsToLines,
	songStateOf,
	songToContentRow,
	statusPatchOf,
	toSongRecord
} from './mapping.ts';
import type { SongRecord } from './store.ts';

const NOW = Date.parse('2026-09-11T03:00:00Z');

/** Placeholder kana only — the project never ships or tests with real lyrics. */
const SONG: SongRecord = {
	id: 'S1',
	ownerId: 'u1',
	videoId: 'dQw4w9WgXcQ',
	title: 'テスト',
	lines: [{ text: 'あいうえお', start: 1.5 }, { text: 'かきくけこ' }],
	visibility: 'private',
	publicConsentAt: null,
	status: 'active',
	removedReason: null,
	createdAt: NOW - 1000,
	updatedAt: NOW
};

function contentRow(over: Partial<ContentRow> = {}): ContentRow {
	return { ...songToContentRow(SONG), ...over } as ContentRow;
}

describe('status mapping', () => {
	it('folds visibility + status into contents.status', () => {
		expect(contentStatusOf('private', 'active')).toBe('draft');
		expect(contentStatusOf('public', 'active')).toBe('published');
		expect(contentStatusOf('public', 'removed')).toBe('removed');
		expect(contentStatusOf('private', 'removed')).toBe('removed');
	});

	it('reads contents.status back as the song view', () => {
		expect(songStateOf('draft')).toEqual({ visibility: 'private', status: 'active' });
		expect(songStateOf('published')).toEqual({ visibility: 'public', status: 'active' });
		expect(songStateOf('removed')).toEqual({ visibility: 'private', status: 'removed' });
		expect(songStateOf('garbage')).toEqual({ visibility: 'private', status: 'active' });
	});

	it('round-trips every song state', () => {
		for (const visibility of ['private', 'public'] as const) {
			const state = songStateOf(contentStatusOf(visibility, 'active'));
			expect(state).toEqual({ visibility, status: 'active' });
		}
		expect(songStateOf(contentStatusOf('public', 'removed')).status).toBe('removed');
	});

	it('turns a patch into a status update that cannot resurrect a removed song', () => {
		expect(statusPatchOf({})).toBeUndefined();
		expect(statusPatchOf({ visibility: 'public' })).toEqual({
			status: 'published',
			keepRemoved: true
		});
		expect(statusPatchOf({ visibility: 'private' })).toEqual({
			status: 'draft',
			keepRemoved: true
		});
		// A takedown wins over the visibility it is sent with.
		expect(statusPatchOf({ status: 'removed', visibility: 'private' })).toEqual({
			status: 'removed',
			keepRemoved: false
		});
		expect(statusPatchOf({ status: 'active', visibility: 'public' })).toEqual({
			status: 'published',
			keepRemoved: false
		});
	});
});

describe('row mapping', () => {
	it('writes a song as user-provided content owned by its user', () => {
		expect(songToContentRow(SONG)).toMatchObject({
			id: 'S1',
			type: 'song',
			title: 'テスト',
			videoId: 'dQw4w9WgXcQ',
			status: 'draft',
			sourceType: 'user_provided',
			rightsStatus: 'unknown',
			ownerId: 'u1',
			createdBy: 'u1',
			publicConsentAt: null,
			removedReason: null,
			createdAt: NOW - 1000,
			updatedAt: NOW
		});
		expect(songToContentRow({ ...SONG, visibility: 'public', publicConsentAt: NOW })).toMatchObject(
			{
				status: 'published',
				publicConsentAt: NOW
			}
		);
	});

	it('writes one content line per lyric line, kana in every text column', () => {
		const rows = linesToRows('S1', SONG.lines);
		expect(rows).toHaveLength(2);
		expect(rows[0]).toEqual({
			id: lineId('S1', 0),
			contentId: 'S1',
			order: 0,
			startTime: 1.5,
			endTime: null,
			originalText: 'あいうえお',
			kanaText: 'あいうえお',
			romajiText: 'aiueo',
			metadata: null
		});
		expect(rows[1]).toMatchObject({ id: 'S1-0001', order: 1, startTime: null });
	});

	it('reads the lines back exactly, without a start when there is none', () => {
		expect(rowsToLines(linesToRows('S1', SONG.lines))).toEqual(SONG.lines);
	});

	it('keeps the pasted kanji line as originalText and reads it back as original (M4-1d)', () => {
		const lines = [{ text: 'きょうはいいてんき', original: '今日はいい天気', start: 2 }];
		const rows = linesToRows('S1', lines);
		expect(rows[0]).toMatchObject({
			originalText: '今日はいい天気',
			kanaText: 'きょうはいいてんき',
			romajiText: 'kyouhaiitenki'
		});
		expect(rowsToLines(rows)).toEqual(lines);
	});

	it('round-trips a song through a content row', () => {
		const row = contentRow();
		expect(isSongRow(row)).toBe(true);
		expect(toSongRecord(row as ContentRow & { ownerId: string }, SONG.lines)).toEqual(SONG);
	});

	it('reads a removed row as removed and private, whatever the reason', () => {
		const row = contentRow({ status: 'removed', removedReason: '權利人通知' });
		expect(toSongRecord(row as ContentRow & { ownerId: string }, [])).toMatchObject({
			status: 'removed',
			visibility: 'private',
			removedReason: '權利人通知'
		});
	});

	it('does not take a platform content for a song', () => {
		expect(isSongRow(contentRow({ ownerId: null }))).toBe(false);
	});
});

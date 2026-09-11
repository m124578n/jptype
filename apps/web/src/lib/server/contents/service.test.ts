import { describe, expect, it } from 'vitest';
import type { ContentSummary } from '../../contents.ts';
import type { NewContentLineRow, NewContentRow } from '../db/schema.ts';
import {
	contentPool,
	createContent,
	deleteContent,
	getContentAsAdmin,
	getPublicContent,
	listContentsAsAdmin,
	listPublicContents,
	parseContentInput,
	parseContentPatchInput,
	parseLinesInput,
	parseListQuery,
	parseStatusInput,
	setContentLines,
	setContentStatus,
	updateContent,
	type ContentDeps,
	type ContentInput,
	type LineInput
} from './service.ts';
import type { ContentFilter, ContentLineRecord, ContentRecord, ContentStore } from './store.ts';

const NOW = Date.parse('2026-09-10T03:00:00Z');

const INPUT: ContentInput = {
	type: 'anime',
	title: 'テスト台詞',
	description: '自作の練習用短文',
	videoId: null,
	jlptLevel: 'N5',
	difficulty: 'easy',
	sourceType: 'original',
	sourceUrl: '',
	sourceName: '自作',
	license: 'CC0',
	rightsStatus: 'cleared'
};

function line(over: Partial<LineInput> = {}): LineInput {
	return {
		startTime: null,
		endTime: null,
		originalText: '今日はいい天気です。',
		kanaText: 'きょうはいいてんきです。',
		romajiText: 'kyouhaiitenkidesu.',
		metadata: null,
		...over
	};
}

/** In-memory ContentStore: the services are pure over this interface, so the tests need no D1. */
function fakeStore() {
	const rows: NewContentRow[] = [];
	const lines: NewContentLineRow[] = [];

	function toRecord(row: NewContentRow): ContentRecord {
		return {
			id: row.id,
			type: row.type as ContentRecord['type'],
			title: row.title,
			description: row.description ?? '',
			videoId: row.videoId ?? null,
			jlptLevel: (row.jlptLevel ?? 'unknown') as ContentRecord['jlptLevel'],
			difficulty: (row.difficulty ?? 'normal') as ContentRecord['difficulty'],
			status: (row.status ?? 'draft') as ContentRecord['status'],
			sourceType: (row.sourceType ?? 'original') as ContentRecord['sourceType'],
			sourceUrl: row.sourceUrl ?? '',
			sourceName: row.sourceName ?? '',
			license: row.license ?? '',
			rightsStatus: (row.rightsStatus ?? 'unknown') as ContentRecord['rightsStatus'],
			createdBy: row.createdBy ?? null,
			ownerId: row.ownerId ?? null,
			publicConsentAt: row.publicConsentAt ?? null,
			removedReason: row.removedReason ?? null,
			createdAt: row.createdAt,
			updatedAt: row.updatedAt
		};
	}

	function toLine(row: NewContentLineRow): ContentLineRecord {
		return {
			id: row.id,
			order: row.order,
			startTime: row.startTime ?? null,
			endTime: row.endTime ?? null,
			originalText: row.originalText,
			kanaText: row.kanaText,
			romajiText: row.romajiText ?? '',
			metadata: row.metadata ?? null
		};
	}

	function matches(row: NewContentRow, filter: ContentFilter): boolean {
		if ((filter.owner === 'platform') !== (row.ownerId === null || row.ownerId === undefined))
			return false;
		if (filter.status !== 'all' && (row.status ?? 'draft') !== filter.status) return false;
		if (filter.type !== undefined && row.type !== filter.type) return false;
		if (filter.jlptLevel !== undefined && row.jlptLevel !== filter.jlptLevel) return false;
		if (filter.difficulty !== undefined && row.difficulty !== filter.difficulty) return false;
		return filter.q === '' || row.title.includes(filter.q);
	}

	const store: ContentStore = {
		insertContent: async (row) => {
			rows.push(row);
		},
		getContent: async (id) => {
			const row = rows.find((r) => r.id === id);
			return row ? toRecord(row) : undefined;
		},
		patchContent: async (id, patch) => {
			const row = rows.find((r) => r.id === id);
			if (row) Object.assign(row, patch);
		},
		deleteContent: async (id) => {
			const index = rows.findIndex((r) => r.id === id);
			if (index >= 0) rows.splice(index, 1);
			for (let i = lines.length - 1; i >= 0; i--) {
				if (lines[i]?.contentId === id) lines.splice(i, 1);
			}
		},
		listContents: async (filter, limit, offset) => {
			const found = rows
				.filter((r) => matches(r, filter))
				.sort((a, b) => b.updatedAt - a.updatedAt);
			const page: ContentSummary[] = found.slice(offset, offset + limit).map((row) => {
				const own = lines.filter((l) => l.contentId === row.id);
				const record = toRecord(row);
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
					lineCount: own.length,
					timedCount: own.filter((l) => l.startTime !== null && l.startTime !== undefined).length
				};
			});
			return { rows: page, total: found.length };
		},
		getLines: async (contentId) =>
			lines
				.filter((l) => l.contentId === contentId)
				.sort((a, b) => a.order - b.order)
				.map(toLine),
		setLines: async (contentId, next) => {
			for (let i = lines.length - 1; i >= 0; i--) {
				if (lines[i]?.contentId === contentId) lines.splice(i, 1);
			}
			lines.push(...next);
		}
	};

	let counter = 0;
	const deps: ContentDeps = {
		store,
		now: () => NOW,
		newId: () => `C${++counter}`
	};

	/** A user's published song, as the song store writes it (M4-1c): owned, user-provided. */
	async function seedUserSong(id: string): Promise<void> {
		rows.push({
			id,
			type: 'song',
			title: 'ユーザーの歌',
			description: '',
			videoId: 'dQw4w9WgXcQ',
			jlptLevel: 'unknown',
			difficulty: 'normal',
			status: 'published',
			sourceType: 'user_provided',
			sourceUrl: '',
			sourceName: '',
			license: '',
			rightsStatus: 'unknown',
			createdBy: 'u1',
			ownerId: 'u1',
			publicConsentAt: NOW,
			removedReason: null,
			createdAt: NOW,
			updatedAt: NOW
		});
		lines.push({
			id: `${id}-0000`,
			contentId: id,
			order: 0,
			startTime: null,
			endTime: null,
			originalText: 'あいうえお',
			kanaText: 'あいうえお',
			romajiText: 'aiueo',
			metadata: null
		});
	}
	return { store, deps, rows, lines, seedUserSong };
}

describe('parseContentInput', () => {
	it('accepts a full body and normalizes a YouTube URL to its id', () => {
		const parsed = parseContentInput({
			...INPUT,
			videoId: 'https://www.youtube.com/watch?v=abcdefghijk'
		});
		expect(parsed).toMatchObject({ title: 'テスト台詞', type: 'anime', videoId: 'abcdefghijk' });
	});

	it('defaults the optional fields and leaves videoId null', () => {
		const parsed = parseContentInput({ title: 'たいとる', type: 'free', sourceType: 'original' });
		expect(parsed).toMatchObject({
			description: '',
			videoId: null,
			jlptLevel: 'unknown',
			difficulty: 'normal',
			rightsStatus: 'unknown'
		});
	});

	it('rejects malformed bodies with a message', () => {
		expect(parseContentInput(null)).toMatch(/object/);
		expect(parseContentInput({ ...INPUT, title: '' })).toMatch(/title/);
		expect(parseContentInput({ ...INPUT, title: 'x'.repeat(200) })).toMatch(/title/);
		expect(parseContentInput({ ...INPUT, type: 'podcast' })).toMatch(/type/);
		expect(parseContentInput({ ...INPUT, videoId: 'https://example.com/x' })).toMatch(/videoId/);
		expect(parseContentInput({ ...INPUT, jlptLevel: 'N9' })).toMatch(/jlptLevel/);
		expect(parseContentInput({ ...INPUT, difficulty: 'insane' })).toMatch(/difficulty/);
		expect(parseContentInput({ ...INPUT, sourceType: 'scraped' })).toMatch(/sourceType/);
		expect(parseContentInput({ ...INPUT, rightsStatus: 'probably' })).toMatch(/rightsStatus/);
	});
});

describe('parseContentPatchInput', () => {
	it('takes any subset and clears videoId with an empty string', () => {
		expect(parseContentPatchInput({ title: ' あたらしい ' })).toEqual({ title: 'あたらしい' });
		expect(parseContentPatchInput({ videoId: '' })).toEqual({ videoId: null });
	});

	it('rejects an empty patch and bad values', () => {
		expect(parseContentPatchInput({})).toMatch(/nothing/);
		expect(parseContentPatchInput({ type: 'nope' })).toMatch(/type/);
		expect(parseContentPatchInput({ license: 'x'.repeat(900) })).toMatch(/license/);
	});
});

describe('parseLinesInput', () => {
	it('accepts a `lines` wrapper or a bare array and rounds times to 1/100 s', () => {
		const parsed = parseLinesInput({ lines: [line({ startTime: 1.239, endTime: 4 })] });
		expect(parsed).toEqual([
			{
				startTime: 1.24,
				endTime: 4,
				originalText: '今日はいい天気です。',
				kanaText: 'きょうはいいてんきです。',
				romajiText: 'kyouhaiitenkidesu.',
				metadata: null
			}
		]);
		expect(parseLinesInput([line()])).toHaveLength(1);
	});

	it('accepts an empty table (clearing every line)', () => {
		expect(parseLinesInput({ lines: [] })).toEqual([]);
	});

	it('falls back to the kana when no original text is given', () => {
		const parsed = parseLinesInput([{ kanaText: 'あいうえお' }]);
		expect(parsed).toMatchObject([{ originalText: 'あいうえお', romajiText: '' }]);
	});

	it('rejects malformed lines', () => {
		expect(parseLinesInput({ lines: 'x' })).toMatch(/array/);
		expect(parseLinesInput([{ kanaText: '' }])).toMatch(/kanaText/);
		expect(parseLinesInput([line({ startTime: -1 })])).toMatch(/startTime/);
		expect(parseLinesInput([line({ endTime: 999_999 })])).toMatch(/endTime/);
	});
});

describe('parseStatusInput / parseListQuery', () => {
	it('accepts the two statuses only', () => {
		expect(parseStatusInput({ status: 'published' })).toEqual({ status: 'published' });
		expect(parseStatusInput({ status: 'removed' })).toMatch(/status/);
	});

	it('drops unknown filter values instead of failing', () => {
		const q = parseListQuery(
			new URLSearchParams({ type: 'song', jlpt: 'N9', difficulty: 'hard', q: ' うた ', page: '2' }),
			'published'
		);
		expect(q).toEqual({
			status: 'published',
			owner: 'platform',
			type: 'song',
			difficulty: 'hard',
			q: 'うた',
			page: 2
		});
	});

	it('falls back to page 1', () => {
		expect(parseListQuery(new URLSearchParams({ page: '0' }), 'all').page).toBe(1);
		expect(parseListQuery(new URLSearchParams({ page: 'x' }), 'all').page).toBe(1);
	});
});

describe('createContent', () => {
	it('always starts as a draft and records the admin who imported it', async () => {
		const { deps, rows } = fakeStore();
		const result = await createContent('admin1', INPUT, deps);
		expect(result.ok && result.body).toMatchObject({
			id: 'C1',
			status: 'draft',
			createdBy: 'admin1'
		});
		expect(rows[0]).toMatchObject({ status: 'draft', createdAt: NOW, updatedAt: NOW });
	});
});

describe('updateContent / deleteContent', () => {
	it('patches an existing content and 404s an unknown one', async () => {
		const { deps } = fakeStore();
		await createContent('admin1', INPUT, deps);
		const patched = await updateContent('C1', { title: 'あたらしい' }, deps);
		expect(patched.ok && patched.body.title).toBe('あたらしい');
		expect(await updateContent('nope', { title: 'x' }, deps)).toMatchObject({ status: 404 });
	});

	it('deletes the content with its lines', async () => {
		const { deps, lines } = fakeStore();
		await createContent('admin1', INPUT, deps);
		await setContentLines('C1', [line()], deps);
		expect(lines).toHaveLength(1);
		expect(await deleteContent('C1', deps)).toMatchObject({ ok: true });
		expect(lines).toHaveLength(0);
		expect(await deleteContent('C1', deps)).toMatchObject({ status: 404 });
	});
});

describe('setContentLines', () => {
	it('replaces the whole table and renumbers `order`', async () => {
		const { deps } = fakeStore();
		await createContent('admin1', INPUT, deps);
		await setContentLines('C1', [line(), line({ kanaText: 'さようなら' })], deps);
		const replaced = await setContentLines('C1', [line({ kanaText: 'おはよう' })], deps);
		expect(replaced.ok && replaced.body.lines.map((l) => [l.order, l.kanaText])).toEqual([
			[0, 'おはよう']
		]);
	});

	it('drops a published content back to draft when no line is typeable any more', async () => {
		const { deps } = fakeStore();
		await createContent('admin1', INPUT, deps);
		await setContentLines('C1', [line()], deps);
		await setContentStatus('C1', 'published', deps);
		await setContentLines('C1', [line({ kanaText: '天気' })], deps);
		const after = await getContentAsAdmin('C1', deps);
		expect(after.ok && after.body.content.status).toBe('draft');
	});
});

describe('setContentStatus', () => {
	it('publishes a content with cleared rights and a typeable line', async () => {
		const { deps } = fakeStore();
		await createContent('admin1', INPUT, deps);
		await setContentLines('C1', [line()], deps);
		const published = await setContentStatus('C1', 'published', deps);
		expect(published.ok && published.body.status).toBe('published');
	});

	it('refuses to publish while the rights are unknown', async () => {
		const { deps } = fakeStore();
		await createContent('admin1', { ...INPUT, rightsStatus: 'unknown' }, deps);
		await setContentLines('C1', [line()], deps);
		expect(await setContentStatus('C1', 'published', deps)).toMatchObject({
			status: 409,
			error: 'rights not cleared'
		});
	});

	it('refuses to publish without a typeable line (kanji is not typeable)', async () => {
		const { deps } = fakeStore();
		await createContent('admin1', INPUT, deps);
		await setContentLines('C1', [line({ kanaText: '天気' })], deps);
		expect(await setContentStatus('C1', 'published', deps)).toMatchObject({
			status: 409,
			error: 'no typeable line'
		});
	});

	it('unpublishes without any check', async () => {
		const { deps } = fakeStore();
		await createContent('admin1', { ...INPUT, rightsStatus: 'unknown' }, deps);
		const back = await setContentStatus('C1', 'draft', deps);
		expect(back.ok && back.body.status).toBe('draft');
	});
});

describe('admin reads', () => {
	it('keeps a user-provided song out of the admin console entirely (M4-1c)', async () => {
		const { deps, seedUserSong } = fakeStore();
		await seedUserSong('S1');
		await createContent('admin1', INPUT, deps);

		const list = await listContentsAsAdmin(parseListQuery(new URLSearchParams(), 'all'), deps);
		expect(list.contents.map((c) => c.id)).toEqual(['C1']);
		expect(await getContentAsAdmin('S1', deps)).toMatchObject({ status: 404 });
		expect(await updateContent('S1', { title: 'x' }, deps)).toMatchObject({ status: 404 });
		expect(await setContentLines('S1', [line()], deps)).toMatchObject({ status: 404 });
		expect(await setContentStatus('S1', 'draft', deps)).toMatchObject({ status: 404 });
		expect(await deleteContent('S1', deps)).toMatchObject({ status: 404 });
	});
});

describe('public reads', () => {
	it('lists published contents only, with the filters applied', async () => {
		const { deps } = fakeStore();
		await createContent('admin1', INPUT, deps);
		await setContentLines('C1', [line()], deps);
		await setContentStatus('C1', 'published', deps);
		await createContent('admin1', { ...INPUT, title: 'したがき' }, deps);

		const all = await listPublicContents(parseListQuery(new URLSearchParams(), 'published'), deps);
		expect(all.contents.map((c) => c.id)).toEqual(['C1']);
		expect(all.contents[0]).toMatchObject({ lineCount: 1, timedCount: 0 });

		const filtered = await listPublicContents(
			parseListQuery(new URLSearchParams({ type: 'song' }), 'published'),
			deps
		);
		expect(filtered.contents).toHaveLength(0);
	});

	it('never lists or serves a user-provided song, published or not (M4-1c)', async () => {
		const { deps, seedUserSong } = fakeStore();
		await seedUserSong('S1');
		await createContent('admin1', INPUT, deps);
		await setContentLines('C1', [line()], deps);
		await setContentStatus('C1', 'published', deps);

		const all = await listPublicContents(parseListQuery(new URLSearchParams(), 'published'), deps);
		expect(all.contents.map((c) => c.id)).toEqual(['C1']);
		expect(await getPublicContent('S1', deps)).toMatchObject({ status: 404 });
	});

	it('404s a draft, and returns the lines of a published content', async () => {
		const { deps } = fakeStore();
		await createContent('admin1', INPUT, deps);
		await setContentLines('C1', [line({ startTime: 12.5 })], deps);
		expect(await getPublicContent('C1', deps)).toMatchObject({ status: 404 });

		await setContentStatus('C1', 'published', deps);
		const found = await getPublicContent('C1', deps);
		expect(found.ok && found.body.lines[0]).toMatchObject({ order: 0, startTime: 12.5 });
	});
});

describe('contentPool', () => {
	it('is the kana of every line of a published content', async () => {
		const { deps } = fakeStore();
		await createContent('admin1', INPUT, deps);
		await setContentLines('C1', [line(), line({ kanaText: 'さようなら' })], deps);
		await setContentStatus('C1', 'published', deps);
		await expect(contentPool('C1', deps)).resolves.toEqual([
			'きょうはいいてんきです。',
			'さようなら'
		]);
	});

	it('is undefined for a draft or an unknown content', async () => {
		const { deps } = fakeStore();
		await createContent('admin1', INPUT, deps);
		await setContentLines('C1', [line()], deps);
		await expect(contentPool('C1', deps)).resolves.toBeUndefined();
		await expect(contentPool('nope', deps)).resolves.toBeUndefined();
	});

	it("is undefined for a user's published song: songs stay out of the leaderboard", async () => {
		const { deps, seedUserSong } = fakeStore();
		await seedUserSong('S1');
		await expect(contentPool('S1', deps)).resolves.toBeUndefined();
	});
});

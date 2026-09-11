import { describe, expect, it } from 'vitest';
import { hashLines } from '../../song-hash.ts';
import type { SongLine } from '../../songs.ts';
import {
	createSong,
	deleteOwnSong,
	fileReport,
	findTimings,
	getSongFor,
	listMySongs,
	listNotices,
	listPublicSongs,
	parseListQuery,
	parseRemoveInput,
	parseReportInput,
	parseResolveInput,
	parseSongInput,
	parseSongPatchInput,
	parseTimingInput,
	parseVisibilityInput,
	publishState,
	publishTiming,
	removeSongAsAdmin,
	resolveReport,
	setVisibility,
	updateSong,
	useTiming,
	type SongDeps
} from './service.ts';
import type {
	NoticeRecord,
	PublicSongSummary,
	SongRecord,
	SongStore,
	StrikeRecord,
	TakedownRecord
} from './store.ts';

/** Placeholder kana only — the project never ships or tests with real lyrics. */
const LINES: SongLine[] = [{ text: 'あいうえお' }, { text: 'かきくけこ' }, { text: 'さしすせそ' }];
const VIDEO = 'dQw4w9WgXcQ';
const NOW = Date.parse('2026-09-10T03:00:00Z');

function song(over: Partial<SongRecord> = {}): SongRecord {
	return {
		id: 'S1',
		ownerId: 'u1',
		videoId: VIDEO,
		title: 'テスト',
		lines: LINES,
		visibility: 'private',
		publicConsentAt: null,
		status: 'active',
		removedReason: null,
		createdAt: NOW - 1000,
		updatedAt: NOW - 1000,
		...over
	};
}

interface Fake {
	store: SongStore;
	songs: Map<string, SongRecord>;
	notices: NoticeRecord[];
	strikes: Map<string, StrikeRecord>;
	reports: Map<string, TakedownRecord>;
	timings: Map<string, { lineHashes: string[]; starts: number[]; useCount: number }>;
}

function fakeStore(seed: { songs?: SongRecord[]; strikes?: [string, StrikeRecord][] } = {}): Fake {
	const songs = new Map<string, SongRecord>((seed.songs ?? []).map((s) => [s.id, s]));
	const strikes = new Map<string, StrikeRecord>(seed.strikes ?? []);
	const reports = new Map<string, TakedownRecord>();
	const timings = new Map<string, { lineHashes: string[]; starts: number[]; useCount: number }>();
	const timingMeta = new Map<string, { videoId: string; createdAt: number }>();
	const notices: NoticeRecord[] = [];

	const store: SongStore = {
		insertSong: async (record) => {
			songs.set(record.id, { ...record, lines: record.lines.map((l) => ({ ...l })) });
		},
		getSong: async (id) => songs.get(id),
		patchSong: async (id, patch) => {
			const found = songs.get(id);
			if (!found) return;
			songs.set(id, { ...found, ...patch });
		},
		deleteSong: async (id) => {
			songs.delete(id);
		},
		listByOwner: async (ownerId) =>
			[...songs.values()]
				.filter((s) => s.ownerId === ownerId)
				.sort((a, b) => b.updatedAt - a.updatedAt),
		listPublic: async (q, limit, offset) => {
			const all = [...songs.values()]
				.filter((s) => s.visibility === 'public' && s.status === 'active')
				.filter((s) => q === '' || s.title.includes(q))
				.sort((a, b) => b.updatedAt - a.updatedAt);
			const rows: PublicSongSummary[] = all.slice(offset, offset + limit).map((s) => ({
				id: s.id,
				title: s.title,
				videoId: s.videoId,
				lineCount: s.lines.length,
				timedCount: s.lines.filter((l) => l.start !== undefined).length,
				updatedAt: s.updatedAt
			}));
			return { rows, total: all.length };
		},
		searchSongs: async (q, limit) =>
			[...songs.values()]
				.filter((s) => q === '' || s.title.includes(q))
				.slice(0, limit)
				.map((s) => ({
					id: s.id,
					title: s.title,
					ownerId: s.ownerId,
					videoId: s.videoId,
					lineCount: s.lines.length,
					visibility: s.visibility,
					status: s.status,
					removedReason: s.removedReason,
					updatedAt: s.updatedAt
				})),
		unpublishAll: async (ownerId, now) => {
			let n = 0;
			for (const [id, s] of songs) {
				if (s.ownerId === ownerId && s.visibility === 'public') {
					songs.set(id, { ...s, visibility: 'private', updatedAt: now });
					n += 1;
				}
			}
			return n;
		},
		insertTiming: async (row) => {
			timings.set(row.id, {
				lineHashes: JSON.parse(row.lineHashes) as string[],
				starts: JSON.parse(row.starts) as number[],
				useCount: row.useCount ?? 0
			});
			timingMeta.set(row.id, { videoId: row.videoId, createdAt: row.createdAt });
		},
		findTimings: async (videoId) =>
			[...timings.entries()]
				.filter(([id]) => timingMeta.get(id)?.videoId === videoId)
				.map(([id, t]) => ({
					id,
					videoId,
					lineCount: t.lineHashes.length,
					lineHashes: t.lineHashes,
					starts: t.starts,
					useCount: t.useCount,
					createdAt: timingMeta.get(id)?.createdAt ?? 0
				})),
		getTiming: async (id) => {
			const t = timings.get(id);
			const meta = timingMeta.get(id);
			if (!t || !meta) return undefined;
			return {
				id,
				videoId: meta.videoId,
				lineCount: t.lineHashes.length,
				lineHashes: t.lineHashes,
				starts: t.starts,
				useCount: t.useCount,
				createdAt: meta.createdAt
			};
		},
		bumpUseCount: async (id) => {
			const t = timings.get(id);
			if (t) timings.set(id, { ...t, useCount: t.useCount + 1 });
		},
		insertReport: async (row) => {
			reports.set(row.id, {
				id: row.id,
				contentId: row.contentId ?? null,
				videoId: row.videoId ?? '',
				reporterContact: row.reporterContact,
				claim: row.claim,
				status: 'open',
				adminNote: null,
				createdAt: row.createdAt,
				resolvedAt: null,
				songTitle: null,
				songOwnerId: null,
				songStatus: null
			});
		},
		getReport: async (id) => reports.get(id),
		listReports: async (status) =>
			[...reports.values()].filter((r) => status === 'all' || r.status === status),
		patchReport: async (id, patch) => {
			const found = reports.get(id);
			if (found) reports.set(id, { ...found, ...patch });
		},
		getStrikes: async (userId) => strikes.get(userId) ?? { strikes: 0, suspendedAt: null },
		setStrikes: async (userId, value) => {
			strikes.set(userId, value);
		},
		insertNotice: async (row) => {
			notices.push({
				id: row.id,
				kind: row.kind,
				message: row.message,
				createdAt: row.createdAt,
				readAt: null
			});
		},
		listNotices: async () => notices.slice(),
		markNoticesRead: async () => {}
	};
	return { store, songs, notices, strikes, reports, timings };
}

let counter = 0;
function deps(fake: Fake): SongDeps {
	counter = 0;
	return { store: fake.store, now: () => NOW, newId: () => `ID${++counter}` };
}

describe('body validation', () => {
	const body = { title: ' テスト ', videoId: `https://youtu.be/${VIDEO}`, lines: LINES };

	it('trims the title and normalizes any YouTube URL to the video id', () => {
		expect(parseSongInput(body)).toEqual({ title: 'テスト', videoId: VIDEO, lines: LINES });
	});

	it('accepts plain strings as lines and rounds starts to centiseconds', () => {
		const r = parseSongInput({ ...body, lines: ['あ', { text: 'い', start: 1.2349 }] });
		expect(r).toMatchObject({ lines: [{ text: 'あ' }, { text: 'い', start: 1.23 }] });
	});

	it('rejects malformed song bodies with a message', () => {
		expect(parseSongInput(null)).toMatch(/object/);
		expect(parseSongInput({ ...body, title: '  ' })).toMatch(/title/);
		expect(parseSongInput({ ...body, title: 'x'.repeat(200) })).toMatch(/title/);
		expect(parseSongInput({ ...body, videoId: 'https://example.com/x' })).toMatch(/videoId/);
		expect(parseSongInput({ ...body, lines: [] })).toMatch(/lines/);
		expect(parseSongInput({ ...body, lines: [{ text: 'あ', start: -1 }] })).toMatch(/start/);
		expect(parseSongInput({ ...body, lines: [{ text: 'x'.repeat(400) }] })).toMatch(/too long/);
		expect(parseSongInput({ ...body, lines: Array.from({ length: 501 }, () => 'あ') })).toMatch(
			/too many/
		);
	});

	it('takes a partial patch but needs at least one field', () => {
		expect(parseSongPatchInput({ title: 'x' })).toEqual({ title: 'x' });
		expect(parseSongPatchInput({ lines: ['あ'] })).toEqual({ lines: [{ text: 'あ' }] });
		expect(parseSongPatchInput({})).toMatch(/nothing/);
	});

	it('requires a known visibility and treats a missing consent as false', () => {
		expect(parseVisibilityInput({ visibility: 'public', consent: true })).toEqual({
			visibility: 'public',
			consent: true
		});
		expect(parseVisibilityInput({ visibility: 'private' })).toEqual({
			visibility: 'private',
			consent: false
		});
		expect(parseVisibilityInput({ visibility: 'world' })).toMatch(/visibility/);
	});

	it('checks timing bodies against the hash format and the starts length', async () => {
		const lineHashes = await hashLines(LINES.map((l) => l.text));
		expect(parseTimingInput({ videoId: VIDEO, lineHashes, starts: [0, 1, 2] })).toEqual({
			videoId: VIDEO,
			lineHashes,
			starts: [0, 1, 2]
		});
		expect(parseTimingInput({ videoId: VIDEO, lineHashes: ['zz'], starts: [0] })).toMatch(
			/lineHashes/
		);
		expect(
			parseTimingInput({ videoId: VIDEO, lineHashes: lineHashes.slice(0, 1), starts: [0] })
		).toMatch(/too few/);
		expect(parseTimingInput({ videoId: VIDEO, lineHashes, starts: [0, 1] })).toMatch(/starts/);
		expect(parseTimingInput({ videoId: VIDEO, lineHashes, starts: [0, 1, -2] })).toMatch(/starts/);
	});

	it('needs a contact and a claim on a report, plus something to point at', () => {
		const report = { contentId: 'S1', reporterContact: ' a@b.c ', claim: ' 我是權利人 ' };
		const parsed = {
			contentId: 'S1',
			videoId: '',
			reporterContact: 'a@b.c',
			claim: '我是權利人'
		};
		expect(parseReportInput(report)).toEqual(parsed);
		// The pre-M4-1c body field is still understood.
		expect(parseReportInput({ ...report, contentId: undefined, songId: 'S1' })).toEqual(parsed);
		expect(parseReportInput({ ...report, reporterContact: '' })).toMatch(/reporterContact/);
		expect(parseReportInput({ ...report, claim: '' })).toMatch(/claim/);
		expect(parseReportInput({ reporterContact: 'a@b.c', claim: 'x' })).toMatch(/required/);
	});

	it('only takes the two resolve actions', () => {
		expect(parseResolveInput({ action: 'removed', adminNote: ' note ' })).toEqual({
			action: 'removed',
			adminNote: 'note'
		});
		expect(parseResolveInput({ action: 'ignore' })).toMatch(/action/);
		expect(parseRemoveInput({})).toEqual({ reason: '' });
		expect(parseRemoveInput({ reason: 'x'.repeat(600) })).toMatch(/too long/);
	});

	it('falls back instead of failing on a bad ?q= / ?page=', () => {
		expect(parseListQuery(new URLSearchParams('q=%20a%20&page=3'))).toEqual({ q: 'a', page: 3 });
		expect(parseListQuery(new URLSearchParams('page=0'))).toEqual({ q: '', page: 1 });
		expect(parseListQuery(new URLSearchParams('page=abc'))).toEqual({ q: '', page: 1 });
	});
});

describe('own library', () => {
	it('creates songs private, whatever the client asks for', async () => {
		const fake = fakeStore();
		const r = await createSong('u1', { title: 'テスト', videoId: VIDEO, lines: LINES }, deps(fake));
		expect(r.ok && r.body.visibility).toBe('private');
		expect(r.ok && r.body.publicConsentAt).toBeNull();
		expect(await listMySongs('u1', deps(fake))).toHaveLength(1);
	});

	it('hides someone else’s private song behind a 404, for edit and delete too', async () => {
		const fake = fakeStore({ songs: [song()] });
		const d = deps(fake);
		expect(await getSongFor('u2', 'S1', d)).toMatchObject({ ok: false, status: 404 });
		expect(await getSongFor(null, 'S1', d)).toMatchObject({ ok: false, status: 404 });
		expect(await updateSong('u2', 'S1', { title: 'x' }, d)).toMatchObject({ status: 404 });
		expect(await deleteOwnSong('u2', 'S1', d)).toMatchObject({ status: 404 });
		expect(fake.songs.has('S1')).toBe(true);
	});

	it('lets anyone (even signed out) read a public, active song', async () => {
		const fake = fakeStore({ songs: [song({ visibility: 'public' })] });
		const r = await getSongFor(null, 'S1', deps(fake));
		expect(r.ok && r.body.isOwner).toBe(false);
		expect(r.ok && r.body.song.lines).toEqual(LINES);
	});

	it('stops showing a removed song to everyone but its owner', async () => {
		const fake = fakeStore({ songs: [song({ visibility: 'public', status: 'removed' })] });
		expect(await getSongFor(null, 'S1', deps(fake))).toMatchObject({ status: 404 });
		expect(await getSongFor('u1', 'S1', deps(fake))).toMatchObject({ ok: true });
	});

	it('updates and deletes the owner’s own song', async () => {
		const fake = fakeStore({ songs: [song()] });
		const timed = [{ text: 'あいうえお', start: 1 }];
		await updateSong('u1', 'S1', { lines: timed }, deps(fake));
		expect(fake.songs.get('S1')?.lines).toEqual(timed);
		expect(await deleteOwnSong('u1', 'S1', deps(fake))).toMatchObject({ ok: true });
		expect(fake.songs.has('S1')).toBe(false);
	});
});

describe('visibility and consent', () => {
	it('refuses to publish without the rights declaration', async () => {
		const fake = fakeStore({ songs: [song()] });
		const r = await setVisibility('u1', 'S1', { visibility: 'public', consent: false }, deps(fake));
		expect(r).toMatchObject({ ok: false, status: 400, error: 'consent required' });
		expect(fake.songs.get('S1')?.visibility).toBe('private');
	});

	it('records the moment of consent when publishing', async () => {
		const fake = fakeStore({ songs: [song()] });
		const r = await setVisibility('u1', 'S1', { visibility: 'public', consent: true }, deps(fake));
		expect(r.ok && r.body.visibility).toBe('public');
		expect(fake.songs.get('S1')).toMatchObject({ visibility: 'public', publicConsentAt: NOW });
	});

	it('unpublishes without asking for consent again', async () => {
		const fake = fakeStore({ songs: [song({ visibility: 'public', publicConsentAt: 1 })] });
		const r = await setVisibility(
			'u1',
			'S1',
			{ visibility: 'private', consent: false },
			deps(fake)
		);
		expect(r.ok).toBe(true);
		expect(fake.songs.get('S1')?.visibility).toBe('private');
	});

	it('blocks a suspended account from publishing anything', async () => {
		const fake = fakeStore({
			songs: [song()],
			strikes: [['u1', { strikes: 3, suspendedAt: NOW - 10 }]]
		});
		const r = await setVisibility('u1', 'S1', { visibility: 'public', consent: true }, deps(fake));
		expect(r).toMatchObject({ ok: false, status: 403, error: 'publishing suspended' });
		expect(await publishState('u1', deps(fake))).toEqual({ strikes: 3, suspended: true });
	});

	it('never republishes a removed song', async () => {
		const fake = fakeStore({ songs: [song({ status: 'removed' })] });
		const r = await setVisibility('u1', 'S1', { visibility: 'public', consent: true }, deps(fake));
		expect(r).toMatchObject({ ok: false, status: 403, error: 'song removed' });
	});
});

describe('public list', () => {
	it('returns only public + active songs, newest first, paginated', async () => {
		const fake = fakeStore({
			songs: [
				song({ id: 'A', title: 'あ', visibility: 'public', updatedAt: 3 }),
				song({ id: 'B', title: 'い', visibility: 'public', updatedAt: 5 }),
				song({ id: 'C', title: 'う', visibility: 'private', updatedAt: 9 }),
				song({ id: 'D', title: 'え', visibility: 'public', status: 'removed', updatedAt: 9 })
			]
		});
		const r = await listPublicSongs({ q: '', page: 1 }, deps(fake));
		expect(r.songs.map((s) => s.id)).toEqual(['B', 'A']);
		expect(r.total).toBe(2);
		expect(r.pageSize).toBe(20);
	});

	it('searches titles and never leaks lyrics', async () => {
		const fake = fakeStore({ songs: [song({ visibility: 'public' })] });
		const r = await listPublicSongs({ q: 'テスト', page: 1 }, deps(fake));
		expect(r.songs[0]).toEqual({
			id: 'S1',
			title: 'テスト',
			videoId: VIDEO,
			lineCount: 3,
			timedCount: 0,
			updatedAt: NOW - 1000
		});
		expect(JSON.stringify(r)).not.toContain('あいうえお');
	});
});

describe('shared timelines', () => {
	const starts = [0, 1.5, 3];

	async function share(fake: Fake, lines = LINES) {
		const lineHashes = await hashLines(lines.map((l) => l.text));
		return publishTiming('u1', { videoId: VIDEO, lineHashes, starts }, deps(fake));
	}

	it('stores hashes and seconds, never the text', async () => {
		const fake = fakeStore();
		const r = await share(fake);
		expect(r.ok && r.body.created).toBe(true);
		expect(JSON.stringify([...fake.timings.values()])).not.toContain('あいうえお');
	});

	it('offers the timeline back for an identical paste only', async () => {
		const fake = fakeStore();
		await share(fake);
		const candidates = await findTimings(VIDEO, deps(fake));
		const same = await hashLines(LINES.map((l) => l.text));
		const different = await hashLines(['あいうえお', 'かきくけこ', 'たちつてと']);
		expect(candidates).toHaveLength(1);
		expect(candidates[0]?.starts).toEqual(starts);
		expect(same).toEqual(candidates[0]?.lineHashes);
		expect(different).not.toEqual(candidates[0]?.lineHashes);
	});

	it('does not store the same timeline twice', async () => {
		const fake = fakeStore();
		const first = await share(fake);
		const second = await share(fake);
		expect(second).toMatchObject({ ok: true, body: { created: false } });
		expect(first.ok && second.ok && second.body.id).toBe(first.ok ? first.body.id : '');
		expect(fake.timings.size).toBe(1);
	});

	it('ignores an unknown video id instead of failing', async () => {
		expect(await findTimings('not a url', deps(fakeStore()))).toEqual([]);
	});

	it('counts applications and 404s on an unknown timeline', async () => {
		const fake = fakeStore();
		const r = await share(fake);
		const id = r.ok ? r.body.id : '';
		expect(await useTiming(id, deps(fake))).toMatchObject({ ok: true });
		expect([...fake.timings.values()][0]?.useCount).toBe(1);
		expect(await useTiming('nope', deps(fake))).toMatchObject({ ok: false, status: 404 });
	});
});

describe('notice and takedown', () => {
	const report = { contentId: 'S1', videoId: '', reporterContact: 'a@b.c', claim: '我是權利人' };

	it('fills the video id in from the reported song', async () => {
		const fake = fakeStore({ songs: [song({ visibility: 'public' })] });
		const r = await fileReport(report, deps(fake));
		expect(r.ok).toBe(true);
		expect([...fake.reports.values()][0]).toMatchObject({ contentId: 'S1', videoId: VIDEO });
	});

	it('keeps a report whose song is already gone, as long as a video id is given', async () => {
		const fake = fakeStore();
		const r = await fileReport({ ...report, videoId: VIDEO }, deps(fake));
		expect(r.ok).toBe(true);
		expect([...fake.reports.values()][0]).toMatchObject({ contentId: null, videoId: VIDEO });
	});

	it('removes the song, strikes the owner and leaves them a notice', async () => {
		const fake = fakeStore({ songs: [song({ visibility: 'public' })] });
		await fileReport(report, deps(fake));
		const reportId = [...fake.reports.keys()][0] as string;
		const r = await resolveReport(
			reportId,
			{ action: 'removed', adminNote: '權利人通知' },
			deps(fake)
		);

		expect(r.ok && r.body.removal).toMatchObject({
			contentId: 'S1',
			strikes: 1,
			suspended: false
		});
		expect(fake.songs.get('S1')).toMatchObject({
			status: 'removed',
			visibility: 'private',
			removedReason: '權利人通知'
		});
		expect(fake.reports.get(reportId)).toMatchObject({ status: 'removed', resolvedAt: NOW });
		expect(fake.notices).toHaveLength(1);
		expect(fake.notices[0]).toMatchObject({ kind: 'song_removed' });
		expect(fake.notices[0]?.message).toContain('テスト');
	});

	it('rejecting a report changes nothing but the report', async () => {
		const fake = fakeStore({ songs: [song({ visibility: 'public' })] });
		await fileReport(report, deps(fake));
		const reportId = [...fake.reports.keys()][0] as string;
		const r = await resolveReport(reportId, { action: 'rejected', adminNote: '' }, deps(fake));
		expect(r.ok && r.body.removal).toBeNull();
		expect(fake.songs.get('S1')).toMatchObject({ status: 'active', visibility: 'public' });
		expect(fake.strikes.size).toBe(0);
		expect(fake.notices).toHaveLength(0);
	});

	it('refuses to resolve the same report twice', async () => {
		const fake = fakeStore({ songs: [song()] });
		await fileReport(report, deps(fake));
		const reportId = [...fake.reports.keys()][0] as string;
		await resolveReport(reportId, { action: 'rejected', adminNote: '' }, deps(fake));
		expect(
			await resolveReport(reportId, { action: 'removed', adminNote: '' }, deps(fake))
		).toMatchObject({ ok: false, status: 409 });
	});

	it('404s on an unknown report', async () => {
		expect(
			await resolveReport('nope', { action: 'rejected', adminNote: '' }, deps(fakeStore()))
		).toMatchObject({ ok: false, status: 404 });
	});

	it('suspends on the third removal and pulls the other public songs back', async () => {
		const fake = fakeStore({
			songs: [
				song({ id: 'S1', visibility: 'public' }),
				song({ id: 'S2', visibility: 'public' }),
				song({ id: 'S3', visibility: 'public' }),
				song({ id: 'S4', visibility: 'public' })
			],
			strikes: [['u1', { strikes: 2, suspendedAt: null }]]
		});
		const r = await removeSongAsAdmin('S1', '第三次', deps(fake));
		expect(r.ok && r.body).toMatchObject({ strikes: 3, suspended: true });
		expect(fake.strikes.get('u1')).toEqual({ strikes: 3, suspendedAt: NOW });
		expect(fake.songs.get('S2')?.visibility).toBe('private');
		expect(fake.songs.get('S4')?.visibility).toBe('private');
		expect(fake.notices.map((n) => n.kind)).toEqual(['song_removed', 'suspended']);

		// A fourth removal keeps counting but does not re-announce the suspension.
		await removeSongAsAdmin('S2', '', deps(fake));
		expect(fake.strikes.get('u1')).toEqual({ strikes: 4, suspendedAt: NOW });
		expect(fake.notices.filter((n) => n.kind === 'suspended')).toHaveLength(1);
	});

	it('will not remove the same song twice', async () => {
		const fake = fakeStore({ songs: [song({ status: 'removed' })] });
		expect(await removeSongAsAdmin('S1', '', deps(fake))).toMatchObject({ status: 409 });
		expect(await removeSongAsAdmin('missing', '', deps(fake))).toMatchObject({ status: 404 });
	});

	it('shows the owner their notices', async () => {
		const fake = fakeStore({ songs: [song()] });
		await removeSongAsAdmin('S1', 'reason', deps(fake));
		expect(await listNotices('u1', deps(fake))).toHaveLength(1);
	});
});

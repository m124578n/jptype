import { beforeEach, describe, expect, it } from 'vitest';
import {
	deleteSong,
	findSong,
	hasSync,
	loadSongMode,
	loadSongs,
	lyricsSearchUrl,
	newSongId,
	parseLyrics,
	parseYoutubeId,
	saveSong,
	saveSongMode,
	validateLines,
	type Song,
	type SongLine
} from './songs.ts';

class MemoryStorage implements Storage {
	private map = new Map<string, string>();
	get length() {
		return this.map.size;
	}
	clear() {
		this.map.clear();
	}
	getItem(key: string) {
		return this.map.get(key) ?? null;
	}
	key(i: number) {
		return [...this.map.keys()][i] ?? null;
	}
	removeItem(key: string) {
		this.map.delete(key);
	}
	setItem(key: string, value: string) {
		this.map.set(key, value);
	}
}

// Made-up placeholder text only — never real lyrics (DECISIONS.md「歌詞打字」).
function song(over: Partial<Song> = {}): Song {
	return {
		id: 'a',
		title: 'テスト',
		youtubeId: 'Kz7Aq3bN1xY',
		lines: [{ text: 'あいうえお' }, { text: 'かきくけこ' }],
		createdAt: 1000,
		updatedAt: 1000,
		...over
	};
}

beforeEach(() => {
	globalThis.localStorage = new MemoryStorage();
});

describe('loadSongs', () => {
	it('returns an empty list when nothing is stored or storage is corrupted', () => {
		expect(loadSongs()).toEqual([]);
		localStorage.setItem('jptype:songs', '{not json');
		expect(loadSongs()).toEqual([]);
		localStorage.setItem('jptype:songs', '{"a":1}');
		expect(loadSongs()).toEqual([]);
	});

	it('drops entries with the wrong shape', () => {
		localStorage.setItem(
			'jptype:songs',
			JSON.stringify([
				song(),
				{ id: 'b' },
				null,
				{ ...song({ id: 'c' }), lines: [1, 2] },
				{ ...song({ id: 'd' }), lines: [{ text: 'あ', start: 'x' }] },
				{ ...song({ id: 'e' }), lines: [{ start: 3 }] }
			])
		);
		expect(loadSongs().map((s) => s.id)).toEqual(['a']);
	});

	it('migrates songs saved as plain strings before timestamps existed', () => {
		localStorage.setItem(
			'jptype:songs',
			JSON.stringify([{ ...song(), lines: ['あいうえお', 'かきくけこ'] }])
		);
		expect(loadSongs()[0]?.lines).toEqual([{ text: 'あいうえお' }, { text: 'かきくけこ' }]);
	});

	it('keeps start times and drops non-finite ones with the whole entry', () => {
		saveSong(song({ lines: [{ text: 'あ', start: 1.25 }, { text: 'い' }] }));
		expect(loadSongs()[0]?.lines).toEqual([{ text: 'あ', start: 1.25 }, { text: 'い' }]);
	});

	it('sorts by updatedAt, newest first', () => {
		saveSong(song({ id: 'a', updatedAt: 1000 }));
		saveSong(song({ id: 'b', updatedAt: 3000 }));
		saveSong(song({ id: 'c', updatedAt: 2000 }));
		expect(loadSongs().map((s) => s.id)).toEqual(['b', 'c', 'a']);
	});
});

describe('saveSong / deleteSong / findSong', () => {
	it('round-trips a song', () => {
		saveSong(song());
		expect(loadSongs()).toEqual([song()]);
		expect(findSong('a')).toEqual(song());
		expect(findSong('nope')).toBeUndefined();
	});

	it('replaces an existing song with the same id instead of duplicating it', () => {
		saveSong(song());
		saveSong(song({ title: 'べつのだい', updatedAt: 2000 }));
		expect(loadSongs()).toHaveLength(1);
		expect(loadSongs()[0]?.title).toBe('べつのだい');
	});

	it('deletes by id and ignores unknown ids', () => {
		saveSong(song());
		saveSong(song({ id: 'b' }));
		expect(deleteSong('a').map((s) => s.id)).toEqual(['b']);
		expect(deleteSong('zzz').map((s) => s.id)).toEqual(['b']);
		expect(loadSongs().map((s) => s.id)).toEqual(['b']);
	});

	it('falls back gracefully without localStorage', () => {
		// @ts-expect-error simulate an environment without storage
		delete globalThis.localStorage;
		expect(loadSongs()).toEqual([]);
		expect(saveSong(song())).toEqual([song()]);
		expect(deleteSong('a')).toEqual([]);
	});
});

describe('hasSync', () => {
	it('needs at least two timed lines', () => {
		expect(hasSync({ lines: [] })).toBe(false);
		expect(hasSync({ lines: [{ text: 'あ' }, { text: 'い' }] })).toBe(false);
		expect(hasSync({ lines: [{ text: 'あ', start: 0 }, { text: 'い' }] })).toBe(false);
		expect(
			hasSync({
				lines: [{ text: 'あ', start: 0 }, { text: 'い' }, { text: 'う', start: 9 }]
			})
		).toBe(true);
	});
});

describe('song mode preference', () => {
	it('defaults to free and remembers sync', () => {
		expect(loadSongMode()).toBe('free');
		saveSongMode('sync');
		expect(loadSongMode()).toBe('sync');
		saveSongMode('free');
		expect(loadSongMode()).toBe('free');
	});

	it('falls back to free without localStorage', () => {
		// @ts-expect-error simulate an environment without storage
		delete globalThis.localStorage;
		expect(() => saveSongMode('sync')).not.toThrow();
		expect(loadSongMode()).toBe('free');
	});
});

describe('newSongId', () => {
	it('returns a non-empty unique id', () => {
		const a = newSongId();
		expect(a.length).toBeGreaterThan(0);
		expect(newSongId()).not.toBe(a);
	});
});

describe('lyricsSearchUrl', () => {
	it('builds an encoded web search and never fetches anything', () => {
		const url = lyricsSearchUrl(' テスト うた ');
		expect(url.startsWith('https://www.google.com/search?q=')).toBe(true);
		expect(decodeURIComponent(url.slice('https://www.google.com/search?q='.length))).toBe(
			'テスト うた 歌詞 ひらがな'
		);
	});
});

describe('parseYoutubeId', () => {
	const id = 'Kz7Aq3bN1xY';

	it('accepts a bare 11-character id', () => {
		expect(parseYoutubeId(id)).toBe(id);
		expect(parseYoutubeId(`  ${id}  `)).toBe(id);
		expect(parseYoutubeId('_-Ab0123456')).toBe('_-Ab0123456');
	});

	it('accepts watch URLs with extra query parameters', () => {
		expect(parseYoutubeId(`https://www.youtube.com/watch?v=${id}`)).toBe(id);
		expect(parseYoutubeId(`https://www.youtube.com/watch?v=${id}&t=42s&list=PLxx`)).toBe(id);
		expect(parseYoutubeId(`http://youtube.com/watch?v=${id}`)).toBe(id);
		expect(parseYoutubeId(`https://m.youtube.com/watch?v=${id}`)).toBe(id);
		expect(parseYoutubeId(`https://music.youtube.com/watch?v=${id}`)).toBe(id);
		expect(parseYoutubeId(`www.youtube.com/watch?v=${id}`)).toBe(id);
	});

	it('accepts short, shorts and embed links', () => {
		expect(parseYoutubeId(`https://youtu.be/${id}`)).toBe(id);
		expect(parseYoutubeId(`https://youtu.be/${id}?t=30`)).toBe(id);
		expect(parseYoutubeId(`https://www.youtube.com/shorts/${id}`)).toBe(id);
		expect(parseYoutubeId(`https://www.youtube.com/embed/${id}`)).toBe(id);
		expect(parseYoutubeId(`https://www.youtube-nocookie.com/embed/${id}`)).toBe(id);
		expect(parseYoutubeId(`https://www.youtube.com/live/${id}`)).toBe(id);
	});

	it('rejects anything else', () => {
		expect(parseYoutubeId('')).toBeNull();
		expect(parseYoutubeId('   ')).toBeNull();
		expect(parseYoutubeId('not a url')).toBeNull();
		expect(parseYoutubeId('Kz7Aq3bN1x')).toBeNull(); // 10 chars
		expect(parseYoutubeId('Kz7Aq3bN1xY1')).toBeNull(); // 12 chars
		expect(parseYoutubeId('Kz7Aq3bN1x!')).toBeNull(); // bad character
		expect(parseYoutubeId(`https://vimeo.com/watch?v=${id}`)).toBeNull();
		expect(parseYoutubeId('https://www.youtube.com/watch?v=')).toBeNull();
		expect(parseYoutubeId('https://www.youtube.com/')).toBeNull();
		expect(parseYoutubeId(`https://evil.example.com/youtube.com/watch?v=${id}`)).toBeNull();
		expect(parseYoutubeId(`javascript:alert(1)//youtu.be/${id}`)).toBeNull();
	});
});

describe('parseLyrics', () => {
	it('splits on newlines, trims and drops empty lines', () => {
		expect(parseLyrics('  あいうえお \n\n かきくけこ\r\nさしすせそ\r')).toEqual([
			{ text: 'あいうえお' },
			{ text: 'かきくけこ' },
			{ text: 'さしすせそ' }
		]);
	});

	it('turns full-width spaces into normal spaces', () => {
		expect(parseLyrics('　あい　うえお　')).toEqual([{ text: 'あい うえお' }]);
	});

	it('strips a byte-order mark from the pasted text', () => {
		const bom = String.fromCharCode(0xfeff);
		expect(parseLyrics(`${bom}[00:01.50]あいうえお`)).toEqual([{ text: 'あいうえお', start: 1.5 }]);
	});

	it('returns an empty list for blank input', () => {
		expect(parseLyrics('')).toEqual([]);
		expect(parseLyrics('\n 　\n')).toEqual([]);
	});

	it('reads LRC time tags, with and without hundredths', () => {
		expect(parseLyrics('[00:12.34]あいうえお\n[01:05]かきくけこ')).toEqual([
			{ text: 'あいうえお', start: 12.34 },
			{ text: 'かきくけこ', start: 65 }
		]);
	});

	it('accepts the legacy colon form and one- or three-digit fractions', () => {
		expect(parseLyrics('[00:02:50]あ\n[00:03.5]い\n[00:04.125]う')).toEqual([
			{ text: 'あ', start: 2.5 },
			{ text: 'い', start: 3.5 },
			{ text: 'う', start: 4.125 }
		]);
	});

	it('repeats the text for every tag on a line and sorts a fully timed file by time', () => {
		expect(parseLyrics('[00:30.00][00:10.00]あいうえお\n[00:20.00]かきくけこ')).toEqual([
			{ text: 'あいうえお', start: 10 },
			{ text: 'かきくけこ', start: 20 },
			{ text: 'あいうえお', start: 30 }
		]);
	});

	it('keeps the pasted order when only some lines are timed', () => {
		expect(parseLyrics('[00:20.00]あ\nい\n[00:10.00]う')).toEqual([
			{ text: 'あ', start: 20 },
			{ text: 'い' },
			{ text: 'う', start: 10 }
		]);
	});

	it('drops metadata tags and timing-only lines', () => {
		expect(parseLyrics('[ti:てすと]\n[ar:だれか]\n[offset:+100]\n[00:01.00]\nあいうえお')).toEqual([
			{ text: 'あいうえお' }
		]);
	});

	it('strips enhanced-LRC per-word timings', () => {
		expect(parseLyrics('[00:01.00]<00:01.00>あい<00:01.50>うえお')).toEqual([
			{ text: 'あいうえお', start: 1 }
		]);
	});

	it('accepts bare mm:ss and hh:mm:ss prefixes (and sorts the fully timed result)', () => {
		expect(parseLyrics('0:07 あいうえお\n1:02:03\tかきくけこ\n2:00.5  さしすせそ')).toEqual([
			{ text: 'あいうえお', start: 7 },
			{ text: 'さしすせそ', start: 120.5 },
			{ text: 'かきくけこ', start: 3723 }
		]);
	});

	it('leaves a colon inside a lyric line alone', () => {
		expect(parseLyrics('あい:うえお')).toEqual([{ text: 'あい:うえお' }]);
	});
});

describe('validateLines', () => {
	const lines = (...texts: string[]): SongLine[] => texts.map((text) => ({ text }));

	it('accepts kana, yōon, katakana, symbols, spaces and ASCII', () => {
		expect(
			validateLines(
				lines(
					'あいうえお',
					'きゃっきゃ',
					'ラーメン',
					'ねえ、そう。ほんとう？やった！',
					'ひらがな カタカナ',
					'ok 123'
				)
			)
		).toEqual([]);
	});

	it('reports kanji with a 1-based line number', () => {
		expect(validateLines(lines('あいうえお', 'かん字のよみ'))).toEqual([{ line: 2, char: '字' }]);
	});

	it('reports each bad character once per line, in order', () => {
		expect(validateLines(lines('♪あ♪い★', 'ふつう', '★'))).toEqual([
			{ line: 1, char: '♪' },
			{ line: 1, char: '★' },
			{ line: 3, char: '★' }
		]);
	});

	it('does not mistake the second half of a yōon for a standalone character', () => {
		expect(validateLines(lines('しゅくだい', 'ちょっと'))).toEqual([]);
	});

	it('checks the text of timed lines too', () => {
		expect(validateLines([{ text: 'かん字', start: 3 }])).toEqual([{ line: 1, char: '字' }]);
	});

	it('returns nothing for an empty list', () => {
		expect(validateLines([])).toEqual([]);
	});
});

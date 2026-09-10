import { beforeEach, describe, expect, it } from 'vitest';
import {
	deleteSong,
	findSong,
	loadSongs,
	newSongId,
	parseLyrics,
	parseYoutubeId,
	saveSong,
	validateLines,
	type Song
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
		lines: ['あいうえお', 'かきくけこ'],
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
			JSON.stringify([song(), { id: 'b' }, null, { ...song({ id: 'c' }), lines: [1, 2] }])
		);
		expect(loadSongs().map((s) => s.id)).toEqual(['a']);
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

describe('newSongId', () => {
	it('returns a non-empty unique id', () => {
		const a = newSongId();
		expect(a.length).toBeGreaterThan(0);
		expect(newSongId()).not.toBe(a);
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
			'あいうえお',
			'かきくけこ',
			'さしすせそ'
		]);
	});

	it('turns full-width spaces into normal spaces', () => {
		expect(parseLyrics('　あい　うえお　')).toEqual(['あい うえお']);
	});

	it('returns an empty list for blank input', () => {
		expect(parseLyrics('')).toEqual([]);
		expect(parseLyrics('\n 　\n')).toEqual([]);
	});
});

describe('validateLines', () => {
	it('accepts kana, yōon, katakana, symbols, spaces and ASCII', () => {
		expect(
			validateLines([
				'あいうえお',
				'きゃっきゃ',
				'ラーメン',
				'ねえ、そう。ほんとう？やった！',
				'ひらがな カタカナ',
				'ok 123'
			])
		).toEqual([]);
	});

	it('reports kanji with a 1-based line number', () => {
		expect(validateLines(['あいうえお', 'かん字のよみ'])).toEqual([{ line: 2, char: '字' }]);
	});

	it('reports each bad character once per line, in order', () => {
		expect(validateLines(['♪あ♪い★', 'ふつう', '★'])).toEqual([
			{ line: 1, char: '♪' },
			{ line: 1, char: '★' },
			{ line: 3, char: '★' }
		]);
	});

	it('does not mistake the second half of a yōon for a standalone character', () => {
		expect(validateLines(['しゅくだい', 'ちょっと'])).toEqual([]);
	});

	it('returns nothing for an empty list', () => {
		expect(validateLines([])).toEqual([]);
	});
});

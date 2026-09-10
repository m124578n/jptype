import { describe, expect, it } from 'vitest';
import {
	applyTiming,
	hashLine,
	hashLines,
	isHashList,
	matchTiming,
	startsOf,
	type TimingCandidate
} from './song-hash.ts';

/** Placeholder kana, never real lyrics (CLAUDE.md / DECISIONS). */
const LINES = ['あいうえお', 'かきくけこ', 'さしすせそ'];

function candidate(
	over: Partial<TimingCandidate> & Pick<TimingCandidate, 'lineHashes'>
): TimingCandidate {
	return {
		id: 'T1',
		videoId: 'dQw4w9WgXcQ',
		lineCount: over.lineHashes.length,
		starts: [0, 1, 2],
		useCount: 0,
		createdAt: 1,
		...over
	};
}

describe('hashLine / hashLines', () => {
	it('is the standard hex SHA-256', async () => {
		// Well-known vector: SHA-256('abc').
		expect(await hashLine('abc')).toBe(
			'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'
		);
	});

	it('hashes every line, in order, as 64 hex characters', async () => {
		const hashes = await hashLines(LINES);
		expect(hashes).toHaveLength(3);
		expect(isHashList(hashes)).toBe(true);
		expect(hashes[0]).toBe(await hashLine(LINES[0] as string));
	});

	it('is deterministic and separates different text', async () => {
		const a = await hashLines(LINES);
		const b = await hashLines(LINES);
		const c = await hashLines(['あいうえお', 'かきくけこ', 'たちつてと']);
		expect(a).toEqual(b);
		expect(a[2]).not.toBe(c[2]);
	});

	it('rejects anything that is not a list of hex digests', () => {
		expect(isHashList(['zz'])).toBe(false);
		expect(isHashList('abc')).toBe(false);
		expect(isHashList([1])).toBe(false);
	});
});

describe('matchTiming', () => {
	it('needs every hash to be equal', async () => {
		const hashes = await hashLines(LINES);
		const other = await hashLines(['あいうえお', 'かきくけこ', 'たちつてと']);
		expect(matchTiming([candidate({ lineHashes: hashes })], hashes)?.id).toBe('T1');
		expect(matchTiming([candidate({ lineHashes: other })], hashes)).toBeNull();
	});

	it('rejects a different line count even when the prefix matches', async () => {
		const hashes = await hashLines(LINES);
		const short = hashes.slice(0, 2);
		expect(matchTiming([candidate({ lineHashes: short, starts: [0, 1] })], hashes)).toBeNull();
	});

	it('prefers the most applied candidate, then the newest', async () => {
		const hashes = await hashLines(LINES);
		const a = candidate({ id: 'A', lineHashes: hashes, useCount: 1, createdAt: 10 });
		const b = candidate({ id: 'B', lineHashes: hashes, useCount: 5, createdAt: 1 });
		const c = candidate({ id: 'C', lineHashes: hashes, useCount: 5, createdAt: 9 });
		expect(matchTiming([a, b, c], hashes)?.id).toBe('C');
	});

	it('returns null when there is nothing to match', async () => {
		expect(matchTiming([], await hashLines(LINES))).toBeNull();
	});
});

describe('applyTiming / startsOf', () => {
	it('puts the shared starts onto the pasted lines', () => {
		const lines = LINES.map((text) => ({ text }));
		expect(applyTiming(lines, [1.5, 3, 4.25])).toEqual([
			{ text: LINES[0], start: 1.5 },
			{ text: LINES[1], start: 3 },
			{ text: LINES[2], start: 4.25 }
		]);
	});

	it('leaves a line untimed when its start is missing or not finite', () => {
		const lines = LINES.map((text) => ({ text }));
		expect(applyTiming(lines, [1, Number.NaN])).toEqual([
			{ text: LINES[0], start: 1 },
			{ text: LINES[1] },
			{ text: LINES[2] }
		]);
	});

	it('only reports starts when the whole song is timed', () => {
		expect(
			startsOf([
				{ text: 'あ', start: 0 },
				{ text: 'い', start: 2 }
			])
		).toEqual([0, 2]);
		expect(startsOf([{ text: 'あ', start: 0 }, { text: 'い' }])).toBeNull();
		expect(startsOf([])).toBeNull();
	});
});

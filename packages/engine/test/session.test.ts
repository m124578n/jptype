import { describe, expect, it } from 'vitest';
import { TypingSession } from '../src/index.ts';

/** Type a whole string, returning the result of each press. */
function typeAll(session: TypingSession, keys: string, startMs = 0, stepMs = 100) {
	return [...keys].map((k, i) => session.press(k, startMs + i * stepMs));
}

describe('TypingSession – happy paths', () => {
	it('finishes しんぶん with shinbunn', () => {
		const s = new TypingSession('しんぶん');
		const results = typeAll(s, 'shinbunn');
		expect(results.every((r) => r.ok)).toBe(true);
		expect(results.at(-1)?.finished).toBe(true);
		expect(s.log).toHaveLength(8);
	});

	it('finishes しんぶん with sinbunn', () => {
		const s = new TypingSession('しんぶん');
		const results = typeAll(s, 'sinbunn');
		expect(results.every((r) => r.ok)).toBe(true);
		expect(results.at(-1)?.finished).toBe(true);
	});

	it('reports unitDone and advances unitIndex when a spelling completes', () => {
		const s = new TypingSession('かき');
		expect(s.press('k', 0)).toMatchObject({
			ok: true,
			unitIndex: 0,
			unitDone: false,
			finished: false
		});
		expect(s.press('a', 1)).toMatchObject({
			ok: true,
			unitIndex: 0,
			unitDone: true,
			finished: false
		});
		expect(s.progress.unitIndex).toBe(1);
		expect(s.press('k', 2)).toMatchObject({ ok: true, unitIndex: 1, unitDone: false });
		expect(s.press('i', 3)).toMatchObject({
			ok: true,
			unitIndex: 1,
			unitDone: true,
			finished: true
		});
	});

	it('types a sokuon unit with a doubled consonant (がっこう → gakkou)', () => {
		const s = new TypingSession('がっこう');
		const results = typeAll(s, 'gakkou');
		expect(results.every((r) => r.ok)).toBe(true);
		expect(results.at(-1)?.finished).toBe(true);
	});

	it('is case-insensitive', () => {
		const s = new TypingSession('か');
		expect(s.press('K', 0).ok).toBe(true);
		expect(s.press('A', 1).finished).toBe(true);
		expect(s.log.map((e) => e.key)).toEqual(['k', 'a']);
	});

	it('is finished immediately for an empty text', () => {
		const s = new TypingSession('');
		expect(s.progress).toEqual({ unitIndex: 0, typed: '', hint: '' });
		expect(s.press('a', 0)).toMatchObject({ ok: false, finished: true });
		expect(s.log).toEqual([]);
	});
});

describe('TypingSession – wrong keys', () => {
	it('does not advance or change the buffer on a wrong key', () => {
		const s = new TypingSession('し');
		expect(s.press('s', 0).ok).toBe(true);
		const wrong = s.press('k', 1);
		expect(wrong).toMatchObject({ ok: false, unitIndex: 0, unitDone: false, finished: false });
		expect(s.progress.typed).toBe('s');
		expect(s.press('h', 2).ok).toBe(true);
		expect(s.press('i', 3).finished).toBe(true);
	});

	it('logs wrong keys with ok=false', () => {
		const s = new TypingSession('あ');
		s.press('x', 10);
		s.press('a', 20);
		expect(s.log).toEqual([
			{ t: 10, key: 'x', ok: false },
			{ t: 20, key: 'a', ok: true }
		]);
	});

	it('ignores presses after the text is finished', () => {
		const s = new TypingSession('あ');
		s.press('a', 0);
		const after = s.press('a', 1);
		expect(after).toMatchObject({ ok: false, finished: true });
		expect(s.log).toHaveLength(1);
	});
});

describe('TypingSession – hint', () => {
	it('shows the standard spelling before any key', () => {
		expect(new TypingSession('し').progress.hint).toBe('shi');
	});

	it('keeps shi after s, switches to ti after t for ち', () => {
		const shi = new TypingSession('し');
		shi.press('s', 0);
		expect(shi.progress.hint).toBe('shi');

		const chi = new TypingSession('ち');
		chi.press('t', 0);
		expect(chi.progress.hint).toBe('ti');
		expect(chi.press('t', 1).hint).toBe('ti');
	});

	it('returns the hint of the next unit once a unit completes', () => {
		const s = new TypingSession('かき');
		expect(s.press('k', 0).hint).toBe('ka');
		expect(s.press('a', 1).hint).toBe('ki');
	});

	it('prefers the bare n hint for ん when allowed, nn otherwise', () => {
		expect(new TypingSession('かんたん').units[1]?.romaji[0]).toBe('n');
		const s = new TypingSession('こんにちは');
		s.press('k', 0);
		s.press('o', 1);
		expect(s.progress.hint).toBe('nn');
	});

	it('is empty when finished', () => {
		const s = new TypingSession('あ');
		expect(s.press('a', 0).hint).toBe('');
	});
});

describe('TypingSession – ignored input', () => {
	it('ignores modifier and multi-character keys without logging', () => {
		const s = new TypingSession('か');
		for (const key of ['Shift', 'Control', 'Backspace', 'Enter', 'ArrowLeft', '']) {
			const r = s.press(key, 0);
			expect(r).toMatchObject({ ok: true, unitIndex: 0, unitDone: false, finished: false });
		}
		expect(s.log).toEqual([]);
		expect(s.progress.typed).toBe('');
	});
});

describe('TypingSession – joined questions', () => {
	it('types across a "\n" boundary without any extra key', () => {
		const s = new TypingSession('か\nき');
		const results = typeAll(s, 'kaki');
		expect(results.every((r) => r.ok)).toBe(true);
		expect(results.at(-1)?.finished).toBe(true);
	});
});

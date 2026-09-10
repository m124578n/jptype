import { describe, expect, it } from 'vitest';
import { replay, TypingSession, type KeyEvent } from '../src/index.ts';

function record(text: string, keys: string, stepMs = 100): KeyEvent[] {
	const s = new TypingSession(text);
	[...keys].forEach((k, i) => s.press(k, i * stepMs));
	return s.log;
}

describe('replay', () => {
	it('reproduces the score of an honest log', () => {
		const log = record('しんぶん', 'shinbunn'); // 8 keys, t = 0..700
		const r = replay('しんぶん', log);
		expect(r).toEqual({
			kpm: 8 / (700 / 60_000),
			accuracy: 1,
			score: Math.round(8 / (700 / 60_000)),
			correctKeys: 8,
			wrongKeys: 0
		});
	});

	it('uses an explicit duration when given', () => {
		const log = record('あ', 'a');
		expect(replay('あ', log, 60_000)).toMatchObject({ kpm: 1, correctKeys: 1 });
	});

	it('keeps wrong keys from the log', () => {
		const log = record('あ', 'xa');
		expect(replay('あ', log)).toMatchObject({ correctKeys: 1, wrongKeys: 1, accuracy: 0.5 });
	});

	it('accepts a partially typed text (timed mode ends mid-text)', () => {
		const log = record('あいう', 'ai');
		expect(replay('あいう', log)).toMatchObject({ correctKeys: 2, wrongKeys: 0 });
	});

	it('returns invalid when ok=true events are inserted', () => {
		const log = record('あい', 'ai');
		const tampered = [...log, { t: 200, key: 'u', ok: true }];
		expect(replay('あい', tampered)).toEqual({ invalid: expect.stringMatching(/event 2/) });
	});

	it('returns invalid when a wrong key is marked ok', () => {
		const log = record('あ', 'xa').map((e) => ({ ...e, ok: true }));
		expect(replay('あ', log)).toMatchObject({ invalid: expect.stringMatching(/event 0/) });
	});

	it('returns invalid when a correct key is marked wrong', () => {
		const log = record('あ', 'a').map((e) => ({ ...e, ok: false }));
		expect(replay('あ', log)).toMatchObject({ invalid: expect.any(String) });
	});

	it('returns invalid when timestamps go backwards', () => {
		const log: KeyEvent[] = [
			{ t: 100, key: 'a', ok: true },
			{ t: 50, key: 'i', ok: true }
		];
		expect(replay('あい', log)).toMatchObject({ invalid: expect.stringMatching(/time/) });
	});

	it('returns invalid for keys the session would ignore', () => {
		expect(replay('あ', [{ t: 0, key: 'Shift', ok: true }])).toMatchObject({
			invalid: expect.stringMatching(/key/)
		});
	});

	it('returns invalid for an empty log', () => {
		expect(replay('あ', [])).toMatchObject({ invalid: expect.any(String) });
	});
});

describe('replay – malformed input', () => {
	it('returns invalid for a non-numeric timestamp', () => {
		expect(replay('あ', [{ t: Number.NaN, key: 'a', ok: true }])).toMatchObject({
			invalid: expect.stringMatching(/time/)
		});
	});

	it('returns invalid for a non-string key', () => {
		const bogus = [{ t: 0, key: 7, ok: true }] as unknown as KeyEvent[];
		expect(replay('あ', bogus)).toMatchObject({ invalid: expect.stringMatching(/key/) });
	});
});

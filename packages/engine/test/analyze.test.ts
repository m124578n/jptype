import { describe, expect, it } from 'vitest';
import { analyze, replay, TypingSession, type KeyEvent } from '../src/index.ts';

function record(text: string, keys: string, stepMs = 100): KeyEvent[] {
	const s = new TypingSession(text);
	[...keys].forEach((k, i) => s.press(k, i * stepMs));
	return s.log;
}

describe('analyze', () => {
	it('returns the same score as replay plus per-unit outcomes', () => {
		const log = record('がっこう', 'gazkkou'); // wrong 'z' inside っこ (x would start xtuko)
		const a = analyze('がっこう', log);
		expect(a).not.toHaveProperty('invalid');
		if ('invalid' in a) throw new Error(a.invalid);
		expect(a.result).toEqual(replay('がっこう', log));
		expect(a.outcomes).toEqual([
			{ kana: 'が', error: false },
			{ kana: 'っこ', error: true },
			{ kana: 'う', error: false }
		]);
	});

	it('omits a partially typed last unit and spans question boundaries', () => {
		const log = record('か\nき', 'kak');
		const a = analyze('か\nき', log);
		if ('invalid' in a) throw new Error(a.invalid);
		expect(a.outcomes).toEqual([{ kana: 'か', error: false }]);
		expect(a.result.correctKeys).toBe(3);
	});

	it('rejects tampered logs like replay does', () => {
		const log = record('あ', 'xa').map((e) => ({ ...e, ok: true }));
		expect(analyze('あ', log)).toMatchObject({ invalid: expect.stringMatching(/event 0/) });
		expect(analyze('あ', [])).toEqual({ invalid: 'empty log' });
		expect(analyze('あ', [{ t: 0, key: 'Shift', ok: true }])).toMatchObject({
			invalid: expect.stringMatching(/key/)
		});
		expect(analyze('あ', [{ t: Number.NaN, key: 'a', ok: true }])).toMatchObject({
			invalid: expect.stringMatching(/time/)
		});
		expect(
			analyze('あ', [
				{ t: 0, key: 'a', ok: true },
				{ t: 1, key: 'a', ok: true }
			])
		).toMatchObject({ invalid: expect.stringMatching(/finished/) });
	});

	it('honours an explicit duration', () => {
		const log = record('あ', 'a');
		const a = analyze('あ', log, 60_000);
		if ('invalid' in a) throw new Error(a.invalid);
		expect(a.result.kpm).toBe(1);
	});
});

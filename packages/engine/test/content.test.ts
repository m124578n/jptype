import { describe, expect, it } from 'vitest';
import { SENTENCES, WORDS_N5 } from '@jptype/data';
import { TypingSession } from '../src/index.ts';

/**
 * End-to-end guard for the M3 content (spec §7.1 items 8–9): the data package can only check
 * that readings are made of table kana, so prove here that the tokenizer + state machine
 * actually accept every N5 word and sentence when typed with the hinted spelling.
 */
describe('N5 words and sentences', () => {
	it('every reading types to completion following its hint', () => {
		for (const target of [...WORDS_N5.map((w) => w.kana), ...SENTENCES.map((s) => s.kana)]) {
			const s = new TypingSession(target);
			let t = 0;
			let guard = 0;
			while (!s.finished && guard++ < 200) {
				const p = s.progress;
				const key = p.hint.charAt(p.typed.length);
				expect(key, `${target} stuck at ${p.typed}`).not.toBe('');
				const r = s.press(key, (t += 10));
				expect(r.ok, `${target}: key ${key} rejected`).toBe(true);
			}
			expect(s.finished, target).toBe(true);
		}
	});
});

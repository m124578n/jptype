import { describe, expect, it } from 'vitest';
import { segment } from './segment.ts';

describe('segment', () => {
	it('splits on 。and keeps the terminator', () => {
		expect(segment('きょうはあめです。あしたははれです。')).toEqual([
			'きょうはあめです。',
			'あしたははれです。'
		]);
	});

	it('splits on ！？ and their ASCII forms', () => {
		expect(segment('すごい！ほんとう？ok!done?')).toEqual([
			'すごい！',
			'ほんとう？',
			'ok!',
			'done?'
		]);
	});

	it('keeps a run of terminators and a closing bracket with its sentence', () => {
		expect(segment('「なに！？」といった。')).toEqual(['「なに！？」', 'といった。']);
	});

	it('splits on newlines and drops blank lines and stray spaces', () => {
		expect(segment('  いちぎょうめ  \n\n\r\nにぎょうめ\n')).toEqual(['いちぎょうめ', 'にぎょうめ']);
	});

	it('keeps a trailing sentence without a terminator', () => {
		expect(segment('まだつづく')).toEqual(['まだつづく']);
	});

	it('does not split on an ASCII period inside a number', () => {
		expect(segment('ねだんは1.5まんえんです。')).toEqual(['ねだんは1.5まんえんです。']);
	});

	it('returns nothing for empty or blank input', () => {
		expect(segment('')).toEqual([]);
		expect(segment('   \n\t\n')).toEqual([]);
	});
});

import { KANA } from './kana.ts';
import { toKatakana } from './script.ts';
import { BUSINESS } from './business.ts';
import { NETSLANG } from './netslang.ts';
import { SENTENCES } from './sentences.ts';
import { SENTENCES_N1 } from './sentences-n1.ts';
import { SENTENCES_N2 } from './sentences-n2.ts';
import { SENTENCES_N3 } from './sentences-n3.ts';
import { SENTENCES_N4 } from './sentences-n4.ts';
import type { KanaEntry, Lesson, LessonHint, WordEntry } from './types.ts';
import { WORDS_N1 } from './words-n1.ts';
import { WORDS_N2 } from './words-n2.ts';
import { WORDS_N3 } from './words-n3.ts';
import { WORDS_N4 } from './words-n4.ts';
import { WORDS_N5 } from './words-n5.ts';

/** A titled section of the lesson map (spec §7.1 numbering). */
export interface LessonGroup {
	id: string;
	title: string;
	lessonIds: string[];
}

const byGroup = (group: KanaEntry['group']) => KANA.filter((e) => e.group === group);
const byRow = (row: string) => KANA.filter((e) => e.row === row);

/** Gojūon rows in teaching order. わ行 also carries ん. */
const ROWS: { key: string; title: string; entries: KanaEntry[] }[] = [
	{ key: 'a', title: 'あ行', entries: byRow('a') },
	{ key: 'ka', title: 'か行', entries: byRow('ka') },
	{ key: 'sa', title: 'さ行', entries: byRow('sa') },
	{ key: 'ta', title: 'た行', entries: byRow('ta') },
	{ key: 'na', title: 'な行', entries: byRow('na') },
	{ key: 'ha', title: 'は行', entries: byRow('ha') },
	{ key: 'ma', title: 'ま行', entries: byRow('ma') },
	{ key: 'ya', title: 'や行', entries: byRow('ya') },
	{ key: 'ra', title: 'ら行', entries: byRow('ra') },
	{ key: 'wa', title: 'わ行・ん', entries: [...byRow('wa'), ...byRow('n')] }
];

const SEION = byGroup('seion');
const DAKUON = [...byGroup('dakuon'), ...byGroup('handakuon')];
const YOUON = byGroup('youon');
const FOREIGN = byGroup('foreign');
const SOKUON = KANA.filter((e) => e.kana === 'っ');

function kanaLesson(id: string, title: string, entries: KanaEntry[], katakana = false): Lesson {
	return {
		id,
		title,
		mode: 'kana',
		units: entries.map((e) => (katakana ? e.kata : e.kana)),
		intro: entries
	};
}

function wordLesson(id: string, title: string, units: string[], intro: KanaEntry[]): Lesson {
	return { id, title, mode: 'word', units, intro };
}

/**
 * Word/sentence lesson (spec §7.1 items 8–9): no intro cards, but every question carries a
 * kanji + 繁體中文 hint. `SentenceEntry` is assignable to `WordEntry` (its `kanji` is required).
 */
function contentLesson(id: string, title: string, entries: readonly WordEntry[]): Lesson {
	const hints: Record<string, LessonHint> = {};
	for (const e of entries) {
		hints[e.kana] = e.kanji === undefined ? { zh: e.zh } : { kanji: e.kanji, zh: e.zh };
	}
	return { id, title, mode: 'word', units: entries.map((e) => e.kana), intro: [], hints };
}

/** 促音・長音 practice words (spec §7.1 item 5). */
const SOKUON_CHOUON_WORDS = [
	'がっこう',
	'きって',
	'おかあさん',
	'おにいさん',
	'おねえさん',
	'おとうさん',
	'おばあさん',
	'おじいさん',
	'いっしょ',
	'きっぷ',
	'ざっし',
	'せっけん',
	'まっすぐ',
	'ゆっくり',
	'ちょっと',
	'にっき',
	'きょう',
	'とうきょう',
	'べんきょう',
	'りょこう'
];

/** 外來語音 practice words (spec §7.1 item 7). */
const FOREIGN_WORDS = [
	'ティー',
	'パーティー',
	'ファン',
	'ファイル',
	'フォーク',
	'ヴァイオリン',
	'ディズニー',
	'チェック',
	'シェフ',
	'ジェット',
	'ウィンドウ',
	'ウェブ',
	'ツアー',
	'イェール',
	'フィルム',
	'フェリー',
	'デュエット',
	'ヴィザ',
	'トゥース',
	'カフェ'
];

function script(prefix: 'hira' | 'kata'): Lesson[] {
	const kata = prefix === 'kata';
	const t = (s: string) => (kata ? toKatakana(s) : s);
	return [
		...ROWS.map((r) => kanaLesson(`${prefix}-${r.key}`, t(r.title), r.entries, kata)),
		kanaLesson(`${prefix}-all`, kata ? '片假名綜合' : '平假名綜合', SEION, kata),
		kanaLesson(`${prefix}-dakuon`, kata ? '片假名 濁音・半濁音' : '濁音・半濁音', DAKUON, kata),
		kanaLesson(`${prefix}-youon`, kata ? '片假名 拗音' : '拗音', YOUON, kata)
	];
}

/** All lessons in spec §7.1 order (items 1–9), then the 中高階 set (2026-09-11). */
export const LESSONS: readonly Lesson[] = [
	...script('hira'),
	wordLesson('sokuon-chouon', '促音・長音', SOKUON_CHOUON_WORDS, SOKUON),
	...script('kata'),
	wordLesson('foreign', '外來語音', FOREIGN_WORDS, FOREIGN),
	contentLesson('n5-words', 'N5 單字', WORDS_N5),
	contentLesson('sentences', '短句', SENTENCES),
	contentLesson('n4-words', 'N4 單字', WORDS_N4),
	contentLesson('sentences-n4', 'N4 句子', SENTENCES_N4),
	contentLesson('n3-words', 'N3 單字', WORDS_N3),
	contentLesson('sentences-n3', 'N3 句子', SENTENCES_N3),
	contentLesson('n2-words', 'N2 單字', WORDS_N2),
	contentLesson('sentences-n2', 'N2 句子', SENTENCES_N2),
	contentLesson('n1-words', 'N1 單字', WORDS_N1),
	contentLesson('sentences-n1', 'N1 句子', SENTENCES_N1),
	contentLesson('business', '商用・書信', BUSINESS),
	contentLesson('netslang', '網路用語', NETSLANG)
];

export const LESSON_GROUPS: readonly LessonGroup[] = [
	{ id: 'hiragana', title: '平假名', lessonIds: ROWS.map((r) => `hira-${r.key}`) },
	{
		id: 'hiragana-more',
		title: '平假名進階',
		lessonIds: ['hira-all', 'hira-dakuon', 'hira-youon']
	},
	{ id: 'sokuon', title: '促音・長音', lessonIds: ['sokuon-chouon'] },
	{ id: 'katakana', title: '片假名', lessonIds: ROWS.map((r) => `kata-${r.key}`) },
	{
		id: 'katakana-more',
		title: '片假名進階',
		lessonIds: ['kata-all', 'kata-dakuon', 'kata-youon']
	},
	{ id: 'foreign', title: '外來語音', lessonIds: ['foreign'] },
	{ id: 'content', title: '單字與短句（N5）', lessonIds: ['n5-words', 'sentences'] },
	{
		id: 'advanced',
		title: '中階（N4・N3）',
		lessonIds: ['n4-words', 'sentences-n4', 'n3-words', 'sentences-n3']
	},
	{
		id: 'expert',
		title: '高階（N2・N1）',
		lessonIds: ['n2-words', 'sentences-n2', 'n1-words', 'sentences-n1']
	},
	{ id: 'practical', title: '實用：商用・書信與網路用語', lessonIds: ['business', 'netslang'] }
];

const byId = new Map(LESSONS.map((l) => [l.id, l]));

export function findLesson(id: string): Lesson | undefined {
	return byId.get(id);
}

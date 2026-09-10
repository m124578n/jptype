import { KANA } from './kana.ts';
import { toKatakana } from './script.ts';
import type { KanaEntry, Lesson } from './types.ts';

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

/** All lessons in spec §7.1 order (items 1–7; N5 words and sentences are M3). */
export const LESSONS: readonly Lesson[] = [
	...script('hira'),
	wordLesson('sokuon-chouon', '促音・長音', SOKUON_CHOUON_WORDS, SOKUON),
	...script('kata'),
	wordLesson('foreign', '外來語音', FOREIGN_WORDS, FOREIGN)
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
	{ id: 'foreign', title: '外來語音', lessonIds: ['foreign'] }
];

const byId = new Map(LESSONS.map((l) => [l.id, l]));

export function findLesson(id: string): Lesson | undefined {
	return byId.get(id);
}

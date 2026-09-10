import { toKatakana } from './script.ts';
import type { KanaEntry, KanaGroup } from './types.ts';

/** Build one entry; `kata` is derived (validated bidirectionally by `validateKana`). */
function k(kana: string, romaji: string[], group: KanaGroup, row: string): KanaEntry {
	return { kana, kata: toKatakana(kana), romaji, group, row };
}

const seion = (kana: string, romaji: string[], row: string) => k(kana, romaji, 'seion', row);
const dakuon = (kana: string, romaji: string[], row: string) => k(kana, romaji, 'dakuon', row);
const handakuon = (kana: string, romaji: string[], row: string) =>
	k(kana, romaji, 'handakuon', row);
const youon = (kana: string, romaji: string[], row: string) => k(kana, romaji, 'youon', row);
const foreign = (kana: string, romaji: string[], row: string) => k(kana, romaji, 'foreign', row);
const small = (kana: string, romaji: string[]) => k(kana, romaji, 'small', 'small');

/**
 * Kana ↔ romaji table (spec §5.2). First spelling is the standard hint.
 * Spellings follow what MS-IME and Google 日本語入力 both accept.
 * `ん` only lists its context-free spellings; the bare `n` is added by the engine (spec §6.3).
 */
export const KANA: readonly KanaEntry[] = [
	// ── 清音 ──────────────────────────────────────────────────────────────────
	seion('あ', ['a'], 'a'),
	seion('い', ['i'], 'a'),
	seion('う', ['u', 'wu'], 'a'),
	seion('え', ['e'], 'a'),
	seion('お', ['o'], 'a'),

	seion('か', ['ka', 'ca'], 'ka'),
	seion('き', ['ki'], 'ka'),
	seion('く', ['ku', 'cu', 'qu'], 'ka'),
	seion('け', ['ke'], 'ka'),
	seion('こ', ['ko', 'co'], 'ka'),

	seion('さ', ['sa'], 'sa'),
	seion('し', ['shi', 'si', 'ci'], 'sa'),
	seion('す', ['su'], 'sa'),
	seion('せ', ['se', 'ce'], 'sa'),
	seion('そ', ['so'], 'sa'),

	seion('た', ['ta'], 'ta'),
	seion('ち', ['chi', 'ti'], 'ta'),
	seion('つ', ['tsu', 'tu'], 'ta'),
	seion('て', ['te'], 'ta'),
	seion('と', ['to'], 'ta'),

	seion('な', ['na'], 'na'),
	seion('に', ['ni'], 'na'),
	seion('ぬ', ['nu'], 'na'),
	seion('ね', ['ne'], 'na'),
	seion('の', ['no'], 'na'),

	seion('は', ['ha'], 'ha'),
	seion('ひ', ['hi'], 'ha'),
	seion('ふ', ['fu', 'hu'], 'ha'),
	seion('へ', ['he'], 'ha'),
	seion('ほ', ['ho'], 'ha'),

	seion('ま', ['ma'], 'ma'),
	seion('み', ['mi'], 'ma'),
	seion('む', ['mu'], 'ma'),
	seion('め', ['me'], 'ma'),
	seion('も', ['mo'], 'ma'),

	seion('や', ['ya'], 'ya'),
	seion('ゆ', ['yu'], 'ya'),
	seion('よ', ['yo'], 'ya'),

	seion('ら', ['ra'], 'ra'),
	seion('り', ['ri'], 'ra'),
	seion('る', ['ru'], 'ra'),
	seion('れ', ['re'], 'ra'),
	seion('ろ', ['ro'], 'ra'),

	seion('わ', ['wa'], 'wa'),
	seion('を', ['wo'], 'wa'),
	seion('ん', ['nn', "n'", 'xn'], 'n'),

	// ── 濁音 ──────────────────────────────────────────────────────────────────
	dakuon('が', ['ga'], 'ga'),
	dakuon('ぎ', ['gi'], 'ga'),
	dakuon('ぐ', ['gu'], 'ga'),
	dakuon('げ', ['ge'], 'ga'),
	dakuon('ご', ['go'], 'ga'),

	dakuon('ざ', ['za'], 'za'),
	dakuon('じ', ['ji', 'zi'], 'za'),
	dakuon('ず', ['zu'], 'za'),
	dakuon('ぜ', ['ze'], 'za'),
	dakuon('ぞ', ['zo'], 'za'),

	dakuon('だ', ['da'], 'da'),
	dakuon('ぢ', ['di'], 'da'),
	dakuon('づ', ['du'], 'da'),
	dakuon('で', ['de'], 'da'),
	dakuon('ど', ['do'], 'da'),

	dakuon('ば', ['ba'], 'ba'),
	dakuon('び', ['bi'], 'ba'),
	dakuon('ぶ', ['bu'], 'ba'),
	dakuon('べ', ['be'], 'ba'),
	dakuon('ぼ', ['bo'], 'ba'),

	// ── 半濁音 ────────────────────────────────────────────────────────────────
	handakuon('ぱ', ['pa'], 'pa'),
	handakuon('ぴ', ['pi'], 'pa'),
	handakuon('ぷ', ['pu'], 'pa'),
	handakuon('ぺ', ['pe'], 'pa'),
	handakuon('ぽ', ['po'], 'pa'),

	// ── 拗音 ──────────────────────────────────────────────────────────────────
	youon('きゃ', ['kya'], 'kya'),
	youon('きゅ', ['kyu'], 'kya'),
	youon('きょ', ['kyo'], 'kya'),
	youon('ぎゃ', ['gya'], 'gya'),
	youon('ぎゅ', ['gyu'], 'gya'),
	youon('ぎょ', ['gyo'], 'gya'),

	youon('しゃ', ['sha', 'sya'], 'sha'),
	youon('しゅ', ['shu', 'syu'], 'sha'),
	youon('しょ', ['sho', 'syo'], 'sha'),
	youon('じゃ', ['ja', 'jya', 'zya'], 'ja'),
	youon('じゅ', ['ju', 'jyu', 'zyu'], 'ja'),
	youon('じょ', ['jo', 'jyo', 'zyo'], 'ja'),

	youon('ちゃ', ['cha', 'tya', 'cya'], 'cha'),
	youon('ちゅ', ['chu', 'tyu', 'cyu'], 'cha'),
	youon('ちょ', ['cho', 'tyo', 'cyo'], 'cha'),
	youon('ぢゃ', ['dya'], 'dya'),
	youon('ぢゅ', ['dyu'], 'dya'),
	youon('ぢょ', ['dyo'], 'dya'),

	youon('にゃ', ['nya'], 'nya'),
	youon('にゅ', ['nyu'], 'nya'),
	youon('にょ', ['nyo'], 'nya'),
	youon('ひゃ', ['hya'], 'hya'),
	youon('ひゅ', ['hyu'], 'hya'),
	youon('ひょ', ['hyo'], 'hya'),
	youon('びゃ', ['bya'], 'bya'),
	youon('びゅ', ['byu'], 'bya'),
	youon('びょ', ['byo'], 'bya'),
	youon('ぴゃ', ['pya'], 'pya'),
	youon('ぴゅ', ['pyu'], 'pya'),
	youon('ぴょ', ['pyo'], 'pya'),
	youon('みゃ', ['mya'], 'mya'),
	youon('みゅ', ['myu'], 'mya'),
	youon('みょ', ['myo'], 'mya'),
	youon('りゃ', ['rya'], 'rya'),
	youon('りゅ', ['ryu'], 'rya'),
	youon('りょ', ['ryo'], 'rya'),

	// ── 外來語音（主要用於片假名）────────────────────────────────────────────
	foreign('しぇ', ['she', 'sye'], 'she'),
	foreign('じぇ', ['je', 'jye', 'zye'], 'she'),
	foreign('ちぇ', ['che', 'tye', 'cye'], 'she'),
	foreign('てぃ', ['thi', "t'i"], 'thi'),
	foreign('でぃ', ['dhi', "d'i"], 'thi'),
	foreign('とぅ', ['twu', "t'u"], 'thi'),
	foreign('どぅ', ['dwu', "d'u"], 'thi'),
	foreign('ふぁ', ['fa'], 'fa'),
	foreign('ふぃ', ['fi'], 'fa'),
	foreign('ふぇ', ['fe'], 'fa'),
	foreign('ふぉ', ['fo'], 'fa'),
	foreign('ふゅ', ['fyu'], 'fa'),
	foreign('うぃ', ['wi'], 'wi'),
	foreign('うぇ', ['we'], 'wi'),
	foreign('うぉ', ['who'], 'wi'),
	foreign('いぇ', ['ye'], 'wi'),
	foreign('ゔ', ['vu'], 'va'),
	foreign('ゔぁ', ['va'], 'va'),
	foreign('ゔぃ', ['vi'], 'va'),
	foreign('ゔぇ', ['ve'], 'va'),
	foreign('ゔぉ', ['vo'], 'va'),
	foreign('つぁ', ['tsa'], 'tsa'),
	foreign('つぃ', ['tsi'], 'tsa'),
	foreign('つぇ', ['tse'], 'tsa'),
	foreign('つぉ', ['tso'], 'tsa'),

	// ── 小字（單獨出現時；促音合併規則在 engine §6.2）──────────────────────
	small('ぁ', ['xa', 'la']),
	small('ぃ', ['xi', 'li']),
	small('ぅ', ['xu', 'lu']),
	small('ぇ', ['xe', 'le']),
	small('ぉ', ['xo', 'lo']),
	small('ゃ', ['xya', 'lya']),
	small('ゅ', ['xyu', 'lyu']),
	small('ょ', ['xyo', 'lyo']),
	small('っ', ['xtu', 'ltu', 'xtsu', 'ltsu'])
];

/** Punctuation / prolonged-sound mark → the single key that types it (spec §5.2 符號). */
export const SYMBOLS: Readonly<Record<string, string>> = {
	ー: '-',
	'、': ',',
	'。': '.',
	'？': '?',
	'！': '!'
};

/** Longest kana string in the table, in code points (used by the tokenizer's longest match). */
export const MAX_KANA_LENGTH = Math.max(...KANA.map((e) => [...e.kana].length));

const byKana = new Map<string, KanaEntry>();
for (const e of KANA) {
	byKana.set(e.kana, e);
	byKana.set(e.kata, e);
}

/** Look up an entry by its hiragana or katakana form. */
export function findKana(text: string): KanaEntry | undefined {
	return byKana.get(text);
}

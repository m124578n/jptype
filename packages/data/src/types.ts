export type KanaGroup = 'seion' | 'dakuon' | 'handakuon' | 'youon' | 'foreign' | 'small';

/** Spec §5.1 */
export interface KanaEntry {
	/** Display form (hiragana). */
	kana: string;
	/** Matching katakana. */
	kata: string;
	/** Every accepted spelling; the first one is the standard hint. */
	romaji: string[];
	group: KanaGroup;
	/** Row used to assemble lessons: 'a', 'ka', 'sa', ... */
	row: string;
}

export type LessonMode = 'kana' | 'word';

/** Spec §7.1 item 8: one N5 vocabulary entry. */
export interface WordEntry {
	/** Reading, and the typed target: hiragana, katakana for loanwords. */
	kana: string;
	/** Usual written form, when it differs from the reading. */
	kanji?: string;
	/** Short 繁體中文 gloss. */
	zh: string;
}

/** Spec §7.1 item 9: one short sentence. */
export interface SentenceEntry {
	/** Full reading, and the typed target: kana plus 、。 only. */
	kana: string;
	/** Natural written form with kanji. */
	kanji: string;
	/** 繁體中文 translation. */
	zh: string;
}

/** Meaning shown next to a word/sentence question, keyed by the unit's kana. */
export interface LessonHint {
	kanji?: string;
	zh: string;
}

/** Spec §7.1 */
export interface Lesson {
	id: string;
	title: string;
	/** Question pool. */
	units: string[];
	/** Entries shown on the intro page; empty for word/sentence lessons. */
	intro: KanaEntry[];
	mode: LessonMode;
	/** Kanji + 繁體中文 shown above the target while practising, keyed by unit kana. */
	hints?: Record<string, LessonHint>;
}

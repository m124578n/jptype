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

/** Spec §7.1 */
export interface Lesson {
	id: string;
	title: string;
	/** Question pool. */
	units: string[];
	/** Entries shown on the intro page. */
	intro: KanaEntry[];
	mode: LessonMode;
}

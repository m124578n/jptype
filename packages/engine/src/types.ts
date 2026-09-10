/** One typing target: a kana (or symbol) plus every romaji spelling accepted for it in context. */
export interface Unit {
	kana: string;
	/** Context-expanded spellings (sokuon, ん rules applied). First entry is the standard hint. */
	romaji: string[];
}

/** One key press recorded during a session. `t` is milliseconds since session start. */
export interface KeyEvent {
	t: number;
	key: string;
	ok: boolean;
}

export interface PressResult {
	ok: boolean;
	unitIndex: number;
	unitDone: boolean;
	finished: boolean;
	hint: string;
}

export interface ScoreResult {
	kpm: number;
	/** 0..1 */
	accuracy: number;
	score: number;
	correctKeys: number;
	wrongKeys: number;
}

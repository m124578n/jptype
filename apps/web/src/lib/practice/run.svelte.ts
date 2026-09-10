import {
	BOUNDARY,
	TypingSession,
	score,
	type KeyEvent,
	type PressResult,
	type ScoreResult
} from '@jptype/engine';
import { applyComboKey } from './combo.ts';
import { analyzeErrors, type ErrorAnalysis, type KeyError } from './errors.ts';
import { pickNext, pickQuestions, QUESTIONS_PER_RUN, type Rng } from './questions.ts';

export interface UnitOutcome {
	kana: string;
	error: boolean;
}

/**
 * What `TypingArea` (and `Keyboard`) need from a run. Implemented by `PracticeRun` and by
 * `SongSyncRun`, which drives its own questions from the video's timeline instead of a pool.
 */
export interface TypingRun {
	readonly index: number;
	readonly total: number;
	readonly current: string;
	readonly unitIndex: number;
	/** Bumped on every accepted/rejected key so derived UI recomputes. */
	readonly tick: number;
	readonly session: TypingSession;
	readonly typed: string;
	readonly hint: string;
	readonly nextKey: string;
	readonly lastWrongAt: number;
	/** Consecutive accepted keys (M4-3); 0 right after a wrong key. */
	readonly combo: number;
	/** Highest `combo` reached so far. */
	readonly maxCombo: number;
	/** Last combo milestone crossed (0 before the first one), for the UI's accent flash. */
	readonly milestone: number;
	/** `nowMs` of the last milestone; bumped on every crossing so the flash re-triggers. */
	readonly milestoneAt: number;
}

export interface RunOptions {
	/** Fixed number of questions (lesson mode). Ignored when `endless` is set. */
	count?: number;
	/** Keep generating questions until `stop()` is called (timed mode). */
	endless?: boolean;
	/**
	 * Use exactly these questions, in this order (song mode: lyric lines).
	 * Takes precedence over `count` / `endless`; the pool is then unused.
	 */
	sequence?: readonly string[];
	rng?: Rng;
}

/**
 * One practice run: a sequence of questions, each typed with its own TypingSession.
 * Reactive (Svelte 5 runes) so the UI can bind directly to it.
 *
 * `text` (questions joined with the engine BOUNDARY) + `log` reproduce the run exactly
 * through `replay()` on the server.
 */
export class PracticeRun implements TypingRun {
	readonly questions: string[] = $state([]);
	index = $state(0);
	session = $state.raw<TypingSession>(new TypingSession(''));
	/** Bumped on every accepted/rejected key so derived UI recomputes. */
	tick = $state(0);
	finished = $state(false);
	lastWrongAt = $state(0);
	combo = $state(0);
	maxCombo = $state(0);
	milestone = $state(0);
	milestoneAt = $state(0);

	private readonly pool: readonly string[];
	private readonly endless: boolean;
	private readonly rng: Rng;
	private startedAt: number | null = null;
	private lastKeyAt = 0;
	private readonly events: KeyEvent[] = [];
	private readonly outcomes: UnitOutcome[] = [];
	private readonly errors: KeyError[] = [];
	private currentUnitErrored = false;
	private stoppedAt: number | null = null;

	constructor(pool: readonly string[], options: RunOptions = {}) {
		this.pool = pool;
		this.endless = options.sequence ? false : (options.endless ?? false);
		this.rng = options.rng ?? Math.random;
		if (options.sequence) {
			this.questions.push(...options.sequence);
		} else {
			const count = this.endless ? 1 : (options.count ?? QUESTIONS_PER_RUN);
			this.questions.push(...pickQuestions(pool, count, this.rng));
		}
		this.session = new TypingSession(this.questions[0] ?? '');
		this.finished = this.questions.length === 0;
	}

	/** Number of questions; Infinity while endless. */
	get total(): number {
		return this.endless ? Infinity : this.questions.length;
	}

	get current(): string {
		return this.questions[this.index] ?? '';
	}

	/** Zero-based index of the unit being typed inside the current question. */
	get unitIndex(): number {
		void this.tick;
		return this.session.progress.unitIndex;
	}

	get typed(): string {
		void this.tick;
		return this.session.progress.typed;
	}

	get hint(): string {
		void this.tick;
		return this.session.progress.hint;
	}

	/** The single key the user should press next ('' when nothing is expected). */
	get nextKey(): string {
		return this.hint.charAt(this.typed.length);
	}

	get started(): boolean {
		return this.startedAt !== null;
	}

	/** Elapsed typing time: first key → last key, or → stop() when stopped. */
	get durationMs(): number {
		if (this.startedAt === null) return 0;
		return (this.stoppedAt ?? this.lastKeyAt) - this.startedAt;
	}

	/** Milliseconds since the first key, for a live timer. 0 before the first key. */
	elapsed(nowMs: number): number {
		return this.startedAt === null ? 0 : nowMs - this.startedAt;
	}

	press(key: string, nowMs: number): PressResult | null {
		if (this.finished) return null;
		// The clock starts on the first *logged* key; ignored keys (Shift…) must not start it.
		const startedAt = this.startedAt ?? nowMs;
		const t = nowMs - startedAt;

		const before = this.session.log.length;
		const result = this.session.press(key, t);
		const logged = this.session.log.length > before;
		if (!logged) return null; // ignored key (modifier etc.)

		this.startedAt = startedAt;
		this.lastKeyAt = nowMs;
		const unit = this.session.units[result.unitIndex];
		applyComboKey(this, result.ok, nowMs);
		if (!result.ok) {
			this.currentUnitErrored = true;
			this.lastWrongAt = nowMs;
			// A rejected key never enters the buffer, so `typed` still holds the accepted prefix.
			if (unit) {
				this.errors.push({
					kana: unit.kana,
					romaji: unit.romaji,
					typed: this.session.progress.typed,
					key: this.session.log[this.session.log.length - 1]?.key ?? ''
				});
			}
		}
		if (result.unitDone && unit) {
			this.outcomes.push({ kana: unit.kana, error: this.currentUnitErrored });
			this.currentUnitErrored = false;
		}
		if (result.finished) this.advance();
		this.tick += 1;
		return result;
	}

	/** End the run now (timer expired). Keeps the partially typed question in text + log. */
	stop(nowMs: number): void {
		if (this.finished) return;
		this.events.push(...this.session.log);
		this.stoppedAt = this.startedAt === null ? null : nowMs;
		this.finished = true;
		this.tick += 1;
	}

	private advance(): void {
		this.events.push(...this.session.log);
		if (this.endless) {
			this.questions.push(pickNext(this.pool, this.current, this.rng));
		} else if (this.index + 1 >= this.questions.length) {
			this.finished = true;
			return;
		}
		this.index += 1;
		this.session = new TypingSession(this.current);
	}

	/** Units the user got wrong at least once, deduplicated, in order of first error. */
	get wrongUnits(): string[] {
		void this.tick;
		const wrong = this.outcomes.filter((o) => o.error).map((o) => o.kana);
		return wrong.filter((kana, i) => wrong.indexOf(kana) === i);
	}

	get unitOutcomes(): readonly UnitOutcome[] {
		return this.outcomes;
	}

	/** One record per rejected key, in order; input to `analyzeErrors`. */
	get keyErrors(): readonly KeyError[] {
		void this.tick;
		return this.errors;
	}

	/** Most-often-wrong kana and spellings for the result page (M4-3). */
	errorAnalysis(limit = 5): ErrorAnalysis {
		return analyzeErrors(this.errors, limit);
	}

	/** Questions shown so far (including a partially typed last one), joined for replay(). */
	get text(): string {
		return this.questions.slice(0, this.index + 1).join(BOUNDARY);
	}

	/** Full key log, run-relative timestamps. Valid after finish/stop. */
	get log(): KeyEvent[] {
		return this.finished ? this.events.slice() : [...this.events, ...this.session.log];
	}

	result(): ScoreResult {
		return score(this.log, this.durationMs);
	}
}

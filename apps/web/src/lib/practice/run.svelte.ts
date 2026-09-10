import {
	TypingSession,
	score,
	type KeyEvent,
	type PressResult,
	type ScoreResult
} from '@jptype/engine';
import { pickQuestions, QUESTIONS_PER_RUN } from './questions.ts';

export interface UnitOutcome {
	kana: string;
	error: boolean;
}

/**
 * One practice run: a sequence of questions, each typed with its own TypingSession.
 * Reactive (Svelte 5 runes) so the UI can bind directly to it.
 */
export class PracticeRun {
	readonly questions: readonly string[];
	index = $state(0);
	session = $state.raw<TypingSession>(new TypingSession(''));
	/** Bumped on every accepted/rejected key so derived UI recomputes. */
	tick = $state(0);
	finished = $state(false);
	lastWrongAt = $state(0);

	private startedAt: number | null = null;
	private lastKeyAt = 0;
	private readonly log: KeyEvent[] = [];
	private readonly outcomes: UnitOutcome[] = [];
	private currentUnitErrored = false;

	constructor(pool: readonly string[], count = QUESTIONS_PER_RUN, rng?: () => number) {
		this.questions = pickQuestions(pool, count, rng);
		this.session = new TypingSession(this.questions[0] ?? '');
		this.finished = this.questions.length === 0;
	}

	get total(): number {
		return this.questions.length;
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

	get durationMs(): number {
		return this.startedAt === null ? 0 : this.lastKeyAt - this.startedAt;
	}

	press(key: string, nowMs: number): PressResult | null {
		if (this.finished) return null;
		if (this.startedAt === null) this.startedAt = nowMs;
		const t = nowMs - this.startedAt;

		const before = this.session.log.length;
		const result = this.session.press(key, t);
		const logged = this.session.log.length > before;
		if (!logged) return null; // ignored key (modifier etc.)

		this.lastKeyAt = nowMs;
		const unit = this.session.units[result.unitIndex];
		if (!result.ok) {
			this.currentUnitErrored = true;
			this.lastWrongAt = nowMs;
		}
		if (result.unitDone && unit) {
			this.outcomes.push({ kana: unit.kana, error: this.currentUnitErrored });
			this.currentUnitErrored = false;
		}
		if (result.finished) this.advance();
		this.tick += 1;
		return result;
	}

	private advance(): void {
		// Fold the finished question's events into the run log (times are already run-relative).
		this.log.push(...this.session.log);
		if (this.index + 1 >= this.questions.length) {
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

	result(): ScoreResult {
		return score(this.log, this.durationMs);
	}
}

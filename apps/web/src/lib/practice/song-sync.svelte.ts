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
import type { TypingRun, UnitOutcome } from './run.svelte.ts';

/**
 * A line this controller can be fed: the typed text plus, optionally, where it starts in the
 * video. Both a lyric line (`SongLine`) and an imported content line fit, which is how the same
 * controller drives `/songs/[id]` and `/contents/[id]` (M4-1).
 */
export interface TimedLine {
	text: string;
	start?: number;
	/** The line as pasted (kanji) when `text` is a converted reading (M4-1d). */
	original?: string;
}

/** A line that carries a start time; only these take part in sync mode. */
export interface SyncLine {
	text: string;
	start: number;
	original?: string;
}

/**
 * Seconds before a line's start at which typing it is already accepted: a tapped time is
 * rarely exact and singers come in a hair early.
 */
export const LEAD_S = 0.5;

/**
 * Sync mode ("唱到哪打到哪"): the **video** decides which line is current, not the typist.
 * Used by 歌詞同步 and by any imported content whose lines carry start times (M4-1).
 *
 * `PracticeRun` advances when a question is finished, which is exactly wrong here — the song
 * does not wait. So this is its own controller: one `TypingSession` per line, driven by
 * `timeUpdate(seconds)` from the YouTube player. A line the user did not finish before the next
 * one starts is counted in `skippedLines` and left behind; a finished line simply waits (`lineDone`).
 *
 * Lines without a start time are dropped: sync mode needs a timeline for every question it shows
 * (the timing editor at `/songs/[id]/timing` is how the user gives them one).
 *
 * Intros and interludes: the first line becomes current at video time 0 (`lineIndexAt`), but it
 * is `pending` — keys are ignored — until the video reaches its start (minus `LEAD_S`). While a
 * line is pending, or once it is done and the next one is still ahead, `waitingFor` says which
 * video second the typist is waiting for, so the page can count down to the *lyric*, not to the
 * video (the owner's 2026-09-11 test: "3-2-1 was out of sync with the lyrics").
 *
 * `text` + `log` are kept the way `PracticeRun` keeps them so the result is scored identically,
 * but they do **not** round-trip through `replay()` — skipped and re-typed lines break that
 * correspondence. That is fine: song results never leave the browser (DECISIONS.md「歌詞打字」).
 */
export class SongSyncRun implements TypingRun {
	/** Timed lines only, sorted by start time. */
	readonly lines: readonly SyncLine[];

	index = $state(0);
	session = $state.raw<TypingSession>(new TypingSession(''));
	tick = $state(0);
	finished = $state(false);
	lastWrongAt = $state(0);
	combo = $state(0);
	maxCombo = $state(0);
	milestone = $state(0);
	milestoneAt = $state(0);
	/** Lines the song moved past before the user finished them. */
	skippedLines = $state(0);
	/** Last playback position reported by the player (video seconds). */
	position = $state(0);

	private startedAt: number | null = null;
	private lastKeyAt = 0;
	private stoppedAt: number | null = null;
	private maxIndex = 0;
	private readonly events: KeyEvent[] = [];
	private readonly outcomes: UnitOutcome[] = [];
	private readonly errors: KeyError[] = [];
	private currentUnitErrored = false;
	/** A line was re-entered (seek / rewind), so `text` and `log` no longer correspond. */
	private replayBroken = false;
	/** Per line: finished by the user / counted as skipped. Rewinding clears both. */
	private readonly done: boolean[];
	private readonly skipped: boolean[];

	constructor(lines: readonly TimedLine[]) {
		const timed: SyncLine[] = [];
		for (const line of lines) {
			if (line.start === undefined) continue;
			const sync: SyncLine = { text: line.text, start: line.start };
			if (line.original !== undefined) sync.original = line.original;
			timed.push(sync);
		}
		timed.sort((a, b) => a.start - b.start);
		this.lines = timed;
		this.done = timed.map(() => false);
		this.skipped = timed.map(() => false);
		this.session = new TypingSession(this.current);
		this.finished = timed.length === 0;
	}

	get total(): number {
		return this.lines.length;
	}

	get current(): string {
		return this.lines[this.index]?.text ?? '';
	}

	/** Start time of the current line, for the countdown / "seek to this line" affordances. */
	get currentStart(): number {
		return this.lines[this.index]?.start ?? 0;
	}

	/** The current line is fully typed and we are waiting for the song to move on. */
	get lineDone(): boolean {
		void this.tick;
		return this.session.finished;
	}

	/** The video has not reached the current line yet (an intro, or a seek back before it). */
	get pending(): boolean {
		void this.tick;
		return !this.finished && this.lines.length > 0 && this.position < this.currentStart - LEAD_S;
	}

	/** Start time of the line after the current one, or null on the last line. */
	get nextStart(): number | null {
		void this.tick;
		return this.lines[this.index + 1]?.start ?? null;
	}

	/**
	 * The video second the typist is waiting for: the current line's start while it is pending,
	 * the next line's start once the current one is typed, otherwise null (typing is on).
	 */
	get waitingFor(): number | null {
		void this.tick;
		if (this.finished || this.lines.length === 0) return null;
		if (this.pending) return this.currentStart;
		if (this.session.finished) return this.nextStart;
		return null;
	}

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

	/** Elapsed typing time: first key → last key, or → finish() once finished. */
	get durationMs(): number {
		if (this.startedAt === null) return 0;
		return (this.stoppedAt ?? this.lastKeyAt) - this.startedAt;
	}

	/** Index of the line that owns `seconds`: the last one that has already started. */
	lineIndexAt(seconds: number): number {
		let index = 0;
		for (let i = 0; i < this.lines.length; i++) {
			if ((this.lines[i] as SyncLine).start <= seconds) index = i;
			else break;
		}
		return index;
	}

	/**
	 * Playback moved to `seconds`. Moving forward past unfinished lines counts them as skipped;
	 * moving backwards (a rewind) restarts the line the user landed on.
	 */
	timeUpdate(seconds: number): void {
		if (this.finished) return;
		this.position = seconds;
		const target = this.lineIndexAt(seconds);
		if (target === this.index) return;
		if (target > this.index) {
			for (let i = this.index; i < target; i++) {
				if (!this.done[i]) {
					this.skipped[i] = true;
					// A line the song ran away with breaks the streak; a line finished in time does not.
					this.combo = 0;
				}
			}
		} else {
			this.combo = 0; // rewind
		}
		this.jumpTo(target);
	}

	/**
	 * The user seeked the video: re-derive the line and start it over with an empty buffer,
	 * even when the line itself did not change.
	 */
	seek(seconds: number): void {
		if (this.finished) return;
		this.position = seconds;
		this.combo = 0;
		this.jumpTo(this.lineIndexAt(seconds));
	}

	private jumpTo(index: number): void {
		// Going back to a line that was already reached leaves its earlier keys in the log while
		// `text` lists the line once: the server can no longer replay this run.
		if (index <= this.maxIndex) this.replayBroken = true;
		this.commit();
		this.done[index] = false;
		this.skipped[index] = false;
		this.index = index;
		this.maxIndex = Math.max(this.maxIndex, index);
		this.session = new TypingSession(this.current);
		this.currentUnitErrored = false;
		this.skippedLines = this.skipped.filter(Boolean).length;
		this.tick += 1;
	}

	/** Move the current session's key log into the merged log; called before every line change. */
	private commit(): void {
		this.events.push(...this.session.log);
	}

	press(key: string, nowMs: number): PressResult | null {
		// Nothing to type yet: the song has not reached this line (intro / interlude).
		if (this.finished || this.session.finished || this.pending) return null;
		// The clock starts on the first *logged* key; ignored keys (Shift…) must not start it.
		const startedAt = this.startedAt ?? nowMs;
		const t = nowMs - startedAt;

		const before = this.session.log.length;
		const result = this.session.press(key, t);
		if (this.session.log.length === before) return null; // ignored key (modifier etc.)

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
		if (result.finished) {
			this.done[this.index] = true;
			// Nothing left to follow once the last line is typed — show the result immediately.
			if (this.index === this.lines.length - 1) this.finish(nowMs);
		}
		this.tick += 1;
		return result;
	}

	/** End the run (video ended, or the user stopped). An unfinished current line counts as skipped. */
	finish(nowMs: number): void {
		if (this.finished) return;
		if (this.lines.length > 0 && !this.done[this.index]) this.skipped[this.index] = true;
		this.skippedLines = this.skipped.filter(Boolean).length;
		this.commit();
		this.stoppedAt = this.startedAt === null ? null : nowMs;
		this.finished = true;
		this.tick += 1;
	}

	/**
	 * Whether `text` + `log` still reproduce each other, i.e. the server's `replay()` will accept
	 * this run. False as soon as a line was skipped or re-entered, which is why song results stay
	 * local (DECISIONS「歌詞打字」) and why a content run is only submitted when this is true.
	 */
	get replayable(): boolean {
		void this.tick;
		return !this.replayBroken && !this.skipped.some(Boolean);
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

	/** Lines reached so far, joined for scoring; see the class comment about `replay()`. */
	get text(): string {
		return this.lines
			.slice(0, this.maxIndex + 1)
			.map((l) => l.text)
			.join(BOUNDARY);
	}

	/** Full key log, run-relative timestamps. Valid after finish(). */
	get log(): KeyEvent[] {
		return this.finished ? this.events.slice() : [...this.events, ...this.session.log];
	}

	result(): ScoreResult {
		return score(this.log, this.durationMs);
	}
}

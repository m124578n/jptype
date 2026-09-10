import { tokenize } from './tokenize.ts';
import type { KeyEvent, PressResult, Unit } from './types.ts';

/** True for keys the state machine consumes; modifiers, navigation, Backspace etc. are ignored. */
export function isTypingKey(key: string): boolean {
	return [...key].length === 1;
}

/**
 * Per-key state machine (spec §6.4).
 * - `buffer` holds the letters typed so far for the current unit.
 * - A key is accepted iff `buffer + key` is a prefix of one of the unit's spellings.
 * - Wrong keys are logged but never enter the buffer; there is no backspace.
 */
export class TypingSession {
	readonly units: readonly Unit[];
	private index = 0;
	private buffer = '';
	private readonly events: KeyEvent[] = [];

	constructor(text: string) {
		this.units = tokenize(text);
	}

	get finished(): boolean {
		return this.index >= this.units.length;
	}

	get log(): KeyEvent[] {
		return this.events.slice();
	}

	get progress(): { unitIndex: number; typed: string; hint: string } {
		return { unitIndex: this.index, typed: this.buffer, hint: this.hint() };
	}

	/** First spelling of the current unit that is compatible with the buffer ('' when finished). */
	private hint(): string {
		// The buffer is always a prefix of at least one spelling (wrong keys never enter it),
		// so the loop returns for every unfinished session.
		for (const r of this.units[this.index]?.romaji ?? []) {
			if (r.startsWith(this.buffer)) return r;
		}
		return '';
	}

	private result(ok: boolean, unitIndex: number, unitDone: boolean): PressResult {
		return { ok, unitIndex, unitDone, finished: this.finished, hint: this.hint() };
	}

	press(rawKey: string, atMs: number): PressResult {
		const unit = this.units[this.index];
		if (!unit) return this.result(false, this.index, false);
		if (!isTypingKey(rawKey)) return this.result(true, this.index, false);

		const key = rawKey.toLowerCase();
		const candidate = this.buffer + key;
		const unitIndex = this.index;

		const matches = unit.romaji.filter((r) => r.startsWith(candidate));
		if (matches.length === 0) {
			this.events.push({ t: atMs, key, ok: false });
			return this.result(false, unitIndex, false);
		}

		this.events.push({ t: atMs, key, ok: true });
		if (matches.includes(candidate)) {
			this.buffer = '';
			this.index += 1;
			return this.result(true, unitIndex, true);
		}
		this.buffer = candidate;
		return this.result(true, unitIndex, false);
	}
}

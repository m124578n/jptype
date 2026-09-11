/**
 * Tap-to-sync timing for lyric lines (「對時」).
 *
 * Timestamps are produced **by the user in this app**: the YouTube player runs and every tap
 * stamps the current line with the player's `currentTime`. Nothing is fetched from anywhere and
 * no source is assumed to provide timings (see DECISIONS.md). LRC timestamps that came in with a
 * paste are just a starting point; tapping overwrites them.
 *
 * Everything here is pure: `SongLine[]` in, a new `SongLine[]` out, so it is unit-testable
 * without a DOM or a player. Only `start` is ever touched — `original` and `tokens` (M4-1d) ride
 * along untouched, which is what the 2026-09-11 "the kanji vanished after timing" report was.
 */
import type { SongLine } from './songs.ts';

/** LRC resolution: centiseconds. Keeps saved JSON small and comparisons exact enough. */
function roundSeconds(seconds: number): number {
	return Math.round(Math.max(0, seconds) * 100) / 100;
}

function inRange(lines: readonly SongLine[], index: number): boolean {
	return Number.isInteger(index) && index >= 0 && index < lines.length;
}

/** The same line with a new start, or with no start at all when `seconds` is undefined. */
function withStart(line: SongLine, seconds: number | undefined): SongLine {
	const { start: _start, ...rest } = line;
	void _start;
	return seconds === undefined ? rest : { ...rest, start: roundSeconds(seconds) };
}

/**
 * Set `lines[index].start` to `seconds` (clamped at 0, rounded to centiseconds).
 * An out-of-range index or a non-finite time leaves the list untouched.
 */
export function stampLine(lines: readonly SongLine[], index: number, seconds: number): SongLine[] {
	if (!inRange(lines, index) || !Number.isFinite(seconds)) return lines.slice();
	return lines.map((line, i) => (i === index ? withStart(line, seconds) : line));
}

/**
 * Shift an already-stamped line by `delta` seconds (the ±0.5 s nudge buttons).
 * Lines that carry no start yet are left alone — there is nothing to nudge.
 */
export function nudgeLine(lines: readonly SongLine[], index: number, delta: number): SongLine[] {
	if (!inRange(lines, index) || !Number.isFinite(delta)) return lines.slice();
	const start = (lines[index] as SongLine).start;
	if (start === undefined) return lines.slice();
	return lines.map((l, i) => (i === index ? withStart(l, start + delta) : l));
}

/** Drop one line's timing (back to an untimed line). */
export function clearLineTiming(lines: readonly SongLine[], index: number): SongLine[] {
	if (!inRange(lines, index)) return lines.slice();
	return lines.map((line, i) => (i === index ? withStart(line, undefined) : line));
}

/** Drop every timing, e.g. to start the whole song over. */
export function clearAllTimings(lines: readonly SongLine[]): SongLine[] {
	return lines.map((line) => withStart(line, undefined));
}

/** How many lines carry a start time (the progress readout of the timing editor). */
export function timedCount(lines: readonly SongLine[]): number {
	return lines.filter((l) => l.start !== undefined).length;
}

/**
 * First line with no start time, or `lines.length` when everything is stamped — where the
 * timing editor resumes when it is reopened.
 */
export function firstUntimedIndex(lines: readonly SongLine[]): number {
	const index = lines.findIndex((l) => l.start === undefined);
	return index === -1 ? lines.length : index;
}

/** `m:ss.c` for display next to a line; `-` when the line has no timing. */
export function formatTime(seconds: number | undefined): string {
	if (seconds === undefined || !Number.isFinite(seconds)) return '—';
	const total = Math.max(0, seconds);
	const minutes = Math.floor(total / 60);
	const rest = total - minutes * 60;
	return `${minutes}:${rest < 10 ? '0' : ''}${rest.toFixed(2)}`;
}

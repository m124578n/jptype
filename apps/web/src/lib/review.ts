/**
 * Per-line review records for 複習模式 (ROADMAP M4-2, the third mode next to Sync and Free).
 *
 * After every content / song run the page reports, line by line, how many wrong keys it saw.
 * A line whose latest run had at least one error is "missed" and comes back in review mode;
 * typing it cleanly drops it out again. Lines are keyed by a hash of their text, so editing or
 * reordering a content only loses the records of the lines that actually changed.
 *
 * Everything here is local to the browser (own key `jptype:review`, separate from
 * `jptype:results`): a review set is personal and never leaves the device. The pure functions
 * take and return a store so they can be unit-tested without any storage.
 */
import type { LessonResults } from './storage.ts';

const KEY = 'jptype:review';

/** Subjects kept at once; the least recently practised ones are dropped (quota hygiene). */
const MAX_SUBJECTS = 40;
/** Lines kept per subject; clean lines go first, then the least recently practised ones. */
const MAX_LINES = 500;

/** What one line of a finished run looked like. */
export interface LineOutcome {
	text: string;
	/** Wrong keys counted while this line was the current one. */
	errors: number;
}

/** The stored record of one line. */
export interface ReviewLine {
	hash: string;
	/** Errors in the most recent run that included this line; 0 means "no longer missed". */
	errors: number;
	/** Errors across every run that included it. */
	totalErrors: number;
	/** Runs that included it. */
	attempts: number;
	lastAt: number;
}

/** One practised subject: `content:{id}` or `song:{id}`. */
export interface ReviewEntry {
	/** Remembered so the 最近練過 strip can name the subject without a server round trip. */
	title: string;
	lines: ReviewLine[];
	updatedAt: number;
}

export type ReviewStore = Record<string, ReviewEntry>;

/** A line review mode will ask for again, in the content's own order. */
export interface MissedLine {
	text: string;
	/** Position in the subject's current line list. */
	index: number;
	/** Errors in the run that flagged it. */
	errors: number;
}

export interface RecentSubject {
	subject: string;
	kind: 'content' | 'song';
	id: string;
	/** '' when nothing practised it since this release; the caller can fill the name in. */
	title: string;
	best: number;
	attempts: number;
	lastAt: number;
}

export interface RecordOptions {
	/** Kept on the entry when given; '' / undefined leaves the stored title alone. */
	title?: string;
	now?: number;
}

/** FNV-1a (32-bit), hex. Short, stable and synchronous — `crypto.subtle` is async. */
export function hashLine(text: string): string {
	let h = 0x811c9dc5;
	for (let i = 0; i < text.length; i++) {
		h ^= text.charCodeAt(i);
		h = Math.imul(h, 0x01000193);
	}
	return (h >>> 0).toString(16).padStart(8, '0');
}

function isLine(value: unknown): value is ReviewLine {
	if (typeof value !== 'object' || value === null) return false;
	const l = value as Partial<ReviewLine>;
	return (
		typeof l.hash === 'string' &&
		typeof l.errors === 'number' &&
		typeof l.totalErrors === 'number' &&
		typeof l.attempts === 'number' &&
		typeof l.lastAt === 'number'
	);
}

/** Accept only what we wrote; anything else is treated as "no record yet". */
function parseStore(raw: unknown): ReviewStore {
	if (typeof raw !== 'object' || raw === null) return {};
	const out: ReviewStore = {};
	for (const [subject, value] of Object.entries(raw as Record<string, unknown>)) {
		if (typeof value !== 'object' || value === null) continue;
		const entry = value as Partial<ReviewEntry>;
		if (!Array.isArray(entry.lines)) continue;
		out[subject] = {
			title: typeof entry.title === 'string' ? entry.title : '',
			lines: entry.lines.filter(isLine),
			updatedAt: typeof entry.updatedAt === 'number' ? entry.updatedAt : 0
		};
	}
	return out;
}

function pruneLines(lines: readonly ReviewLine[]): ReviewLine[] {
	if (lines.length <= MAX_LINES) return lines.slice();
	// Clean lines carry no information review mode needs, so they are the first to go.
	const ranked = lines
		.map((line, order) => ({ line, order }))
		.sort((a, b) => {
			const clean = Number(a.line.errors === 0) - Number(b.line.errors === 0);
			if (clean !== 0) return clean;
			return b.line.lastAt - a.line.lastAt;
		})
		.slice(0, MAX_LINES)
		.sort((a, b) => a.order - b.order);
	return ranked.map((r) => r.line);
}

function pruneSubjects(store: ReviewStore): ReviewStore {
	const subjects = Object.keys(store);
	if (subjects.length <= MAX_SUBJECTS) return store;
	const keep = subjects
		.sort((a, b) => (store[b]?.updatedAt ?? 0) - (store[a]?.updatedAt ?? 0))
		.slice(0, MAX_SUBJECTS);
	const out: ReviewStore = {};
	for (const subject of keep) out[subject] = store[subject] as ReviewEntry;
	return out;
}

/**
 * Merge one finished run into the store (pure). Lines the run never reached keep their previous
 * record, so stopping a sync run early does not mark the rest of the song as clean.
 */
export function applyOutcomes(
	store: ReviewStore,
	subject: string,
	outcomes: readonly LineOutcome[],
	options: RecordOptions = {}
): ReviewStore {
	const now = options.now ?? Date.now();
	const previous = store[subject];
	const lines = previous ? previous.lines.slice() : [];
	const indexOf = (hash: string) => lines.findIndex((l) => l.hash === hash);

	for (const outcome of outcomes) {
		if (outcome.text === '') continue;
		const hash = hashLine(outcome.text);
		const errors = Math.max(0, Math.trunc(outcome.errors));
		const at = indexOf(hash);
		const prev = at === -1 ? undefined : (lines[at] as ReviewLine);
		const next: ReviewLine = {
			hash,
			errors,
			totalErrors: (prev?.totalErrors ?? 0) + errors,
			attempts: (prev?.attempts ?? 0) + 1,
			lastAt: now
		};
		if (at === -1) lines.push(next);
		else lines[at] = next;
	}

	const title = options.title !== undefined && options.title !== '' ? options.title : '';
	return pruneSubjects({
		...store,
		[subject]: {
			title: title === '' ? (previous?.title ?? '') : title,
			lines: pruneLines(lines),
			updatedAt: now
		}
	});
}

/**
 * The lines review mode should ask for: every line of `texts` whose latest run had an error,
 * in the subject's own order, each text only once (a repeated chorus line is one question).
 */
export function missedLines(
	store: ReviewStore,
	subject: string,
	texts: readonly string[]
): MissedLine[] {
	const entry = store[subject];
	if (!entry) return [];
	const out: MissedLine[] = [];
	const seen: string[] = [];
	for (let index = 0; index < texts.length; index++) {
		const text = texts[index] as string;
		if (text === '') continue;
		const hash = hashLine(text);
		if (seen.includes(hash)) continue;
		const line = entry.lines.find((l) => l.hash === hash);
		if (!line || line.errors <= 0) continue;
		seen.push(hash);
		out.push({ text, index, errors: line.errors });
	}
	return out;
}

/** Errors recorded for one line's latest run (0 when it is not in the review set). */
export function reviewErrorCount(store: ReviewStore, subject: string, text: string): number {
	if (text === '') return 0;
	const hash = hashLine(text);
	return store[subject]?.lines.find((l) => l.hash === hash)?.errors ?? 0;
}

/**
 * 最近練過: content / song results from `jptype:results`, newest first, named from the review
 * store when it knows the title (otherwise '' and the caller can fall back to its own list).
 */
export function recentSubjects(
	store: ReviewStore,
	results: LessonResults,
	limit = 6
): RecentSubject[] {
	const out: RecentSubject[] = [];
	for (const [subject, result] of Object.entries(results)) {
		const colon = subject.indexOf(':');
		const kind = subject.slice(0, colon);
		const id = subject.slice(colon + 1);
		if ((kind !== 'content' && kind !== 'song') || id === '') continue;
		out.push({
			subject,
			kind,
			id,
			title: store[subject]?.title ?? '',
			best: result.best.score,
			attempts: result.attempts,
			lastAt: result.lastAt
		});
	}
	return out.sort((a, b) => b.lastAt - a.lastAt).slice(0, limit);
}

export function loadReview(): ReviewStore {
	try {
		const raw = globalThis.localStorage?.getItem(KEY);
		if (raw === null || raw === undefined) return {};
		return parseStore(JSON.parse(raw));
	} catch {
		return {};
	}
}

export function saveReview(store: ReviewStore): void {
	try {
		globalThis.localStorage?.setItem(KEY, JSON.stringify(store));
	} catch {
		// quota / private mode: silently ignore, exactly like `storage.ts`
	}
}

/** Load → merge one run → save. Returns the new store so the page can re-render from it. */
export function recordLineOutcomes(
	subject: string,
	outcomes: readonly LineOutcome[],
	options: RecordOptions = {}
): ReviewStore {
	const next = applyOutcomes(loadReview(), subject, outcomes, options);
	saveReview(next);
	return next;
}

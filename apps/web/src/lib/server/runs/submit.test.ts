import { describe, expect, it } from 'vitest';
import { TypingSession, type KeyEvent } from '@jptype/engine';
import type { NewRun } from '../db/schema.ts';
import type { RunStore } from './store.ts';
import { parseSubmission, submitRun, textMatchesPool, type SubmitDeps } from './submit.ts';

function record(text: string, keys: string, stepMs = 120): KeyEvent[] {
	const s = new TypingSession(text);
	[...keys].forEach((k, i) => s.press(k, i * stepMs + ((i * 37) % 23)));
	return s.log;
}

function fakeStore(over: Partial<RunStore> = {}) {
	const inserted: NewRun[] = [];
	const kanaCalls: { userId: string; outcomes: readonly { kana: string; error: boolean }[] }[] = [];
	const store: RunStore = {
		insertRun: async (run) => {
			inserted.push(run);
		},
		countRunsSince: async () => 0,
		upsertKanaStats: async (userId, outcomes) => {
			kanaCalls.push({ userId, outcomes });
		},
		hundredthScore: async () => null,
		rankOf: async () => 3,
		top100: async () => [],
		userBest: async () => null,
		...over
	};
	return { store, inserted, kanaCalls };
}

function deps(store: RunStore) {
	const logs: string[] = [];
	const invalidated: string[] = [];
	const d: SubmitDeps = {
		store,
		putLog: async (id) => {
			logs.push(id);
		},
		invalidateLeaderboard: async (mode, week) => {
			invalidated.push(`${mode}|${week}`);
		},
		now: () => Date.parse('2026-09-10T03:00:00Z'),
		newId: () => 'RUN1'
	};
	return { d, logs, invalidated };
}

const HONEST = {
	mode: 'lesson:hira-a',
	text: 'あ\nい\nう',
	log: record('あ\nい\nう', 'aiu'),
	durationMs: 0
};
HONEST.durationMs = (HONEST.log.at(-1)?.t ?? 0) - (HONEST.log[0]?.t ?? 0);

describe('parseSubmission', () => {
	it('accepts a well-formed body and rounds durationMs', () => {
		const r = parseSubmission({ ...HONEST, durationMs: 1234.6 });
		expect(r).toMatchObject({ mode: 'lesson:hira-a', durationMs: 1235 });
	});

	it('rejects malformed bodies with a message', () => {
		expect(parseSubmission(null)).toMatch(/object/);
		expect(parseSubmission({ ...HONEST, mode: 1 })).toMatch(/mode/);
		expect(parseSubmission({ ...HONEST, text: 'x'.repeat(5000) })).toMatch(/text/);
		expect(parseSubmission({ ...HONEST, durationMs: -1 })).toMatch(/duration/);
		expect(parseSubmission({ ...HONEST, log: [] })).toMatch(/log/);
		expect(parseSubmission({ ...HONEST, log: [{ t: 'a', key: 'a', ok: true }] })).toMatch(/event/);
	});

	it('accepts an optional maxCombo within 0..log.length and rejects the rest', () => {
		expect(parseSubmission({ ...HONEST, maxCombo: 3 })).toMatchObject({ maxCombo: 3 });
		expect(parseSubmission({ ...HONEST, maxCombo: 0 })).toMatchObject({ maxCombo: 0 });
		expect(parseSubmission({ ...HONEST, maxCombo: 4 })).toMatch(/maxCombo/);
		expect(parseSubmission({ ...HONEST, maxCombo: -1 })).toMatch(/maxCombo/);
		expect(parseSubmission({ ...HONEST, maxCombo: 1.5 })).toMatch(/maxCombo/);
		expect(parseSubmission({ ...HONEST, maxCombo: '3' })).toMatch(/maxCombo/);
	});
});

describe('submitRun – maxCombo', () => {
	it('recomputes it from the log and ignores whatever the client claimed', async () => {
		const { store, inserted } = fakeStore();
		const { d } = deps(store);
		const wrongThenRight = record(HONEST.text, 'xaiu');
		const sub = {
			...HONEST,
			log: wrongThenRight,
			durationMs: (wrongThenRight.at(-1)?.t ?? 0) - (wrongThenRight[0]?.t ?? 0),
			maxCombo: 0
		};
		const r = await submitRun(null, sub, d);
		if (!r.ok) throw new Error(r.error);
		expect(inserted[0]?.maxCombo).toBe(3);
	});
});

describe('textMatchesPool', () => {
	it('requires every question to be in the pool', () => {
		expect(textMatchesPool('あ\nい', ['あ', 'い', 'う'])).toBe(true);
		expect(textMatchesPool('あ\nか', ['あ', 'い', 'う'])).toBe(false);
		expect(textMatchesPool('あい', ['あ', 'い'])).toBe(false);
	});
});

describe('submitRun', () => {
	it('stores an anonymous run, writes the log, no kana stats and no rank', async () => {
		const { store, inserted, kanaCalls } = fakeStore();
		const { d, logs, invalidated } = deps(store);
		const r = await submitRun(null, HONEST, d);
		expect(r).toMatchObject({ ok: true, body: { runId: 'RUN1' } });
		if (!r.ok) throw new Error(r.error);
		expect(r.body.rank).toBeUndefined();
		expect(r.body.score).toBeGreaterThan(0);
		expect(inserted[0]).toMatchObject({
			id: 'RUN1',
			userId: null,
			mode: 'lesson:hira-a',
			week: '2026-W37',
			flagged: 0,
			correctKeys: 3,
			wrongKeys: 0,
			maxCombo: 3
		});
		expect(logs).toEqual(['RUN1']);
		expect(kanaCalls).toEqual([]);
		expect(invalidated).toEqual([]);
	});

	it('for a logged-in user updates kana stats, invalidates the board and returns a rank', async () => {
		const { store, kanaCalls } = fakeStore();
		const { d, invalidated } = deps(store);
		const r = await submitRun('u1', HONEST, d);
		if (!r.ok) throw new Error(r.error);
		expect(r.body.rank).toBe(3);
		expect(kanaCalls[0]?.outcomes.map((o) => o.kana)).toEqual(['あ', 'い', 'う']);
		expect(invalidated).toEqual(['lesson:hira-a|2026-W37']);
	});

	it('does not invalidate when the score is below the 100th place', async () => {
		const { store } = fakeStore({ hundredthScore: async () => 99_999 });
		const { d, invalidated } = deps(store);
		const r = await submitRun('u1', HONEST, d);
		expect(r.ok).toBe(true);
		expect(invalidated).toEqual([]);
	});

	it('keeps a run under 90 % accuracy off the boards, and says so', async () => {
		// Two wrong keys out of five: 60 % accuracy, an honest but sloppy run.
		const sloppy = { ...HONEST, log: record('あ\nい\nう', 'xaxiu') };
		sloppy.durationMs = (sloppy.log.at(-1)?.t ?? 0) - (sloppy.log[0]?.t ?? 0);
		const { store, inserted, kanaCalls } = fakeStore();
		const { d, invalidated } = deps(store);
		const r = await submitRun('u1', sloppy, d);
		if (!r.ok) throw new Error(r.error);
		expect(r.body.accuracy).toBeCloseTo(0.6);
		expect(r.body.unranked).toBe('accuracy');
		expect(r.body.rank).toBeUndefined();
		expect(inserted[0]).toMatchObject({ flagged: 0, unrankedReason: 'accuracy' });
		expect(kanaCalls).toHaveLength(1); // the mistakes still feed the weak-spot stats
		expect(invalidated).toEqual([]);
	});

	it('ranks a run at exactly 90 % and stores no reason on a clean one', async () => {
		// Nine right, one wrong: exactly the floor, which still counts.
		const border = { ...HONEST, text: 'あ\nい\nう\nえ\nお\nあ\nい\nう\nえ' };
		border.log = record(border.text, 'xaiueoaiue');
		border.durationMs = (border.log.at(-1)?.t ?? 0) - (border.log[0]?.t ?? 0);
		const { store, inserted } = fakeStore();
		const { d } = deps(store);
		const r = await submitRun('u1', border, d);
		if (!r.ok) throw new Error(r.error);
		expect(r.body.unranked).toBeUndefined();
		expect(r.body.rank).toBe(3);
		expect(inserted[0]?.unrankedReason).toBeNull();
	});

	it('flags cheaters silently: stored with flagged=1, no rank, no invalidation', async () => {
		const { store, inserted, kanaCalls } = fakeStore({ countRunsSince: async () => 25 });
		const { d, invalidated } = deps(store);
		const r = await submitRun('u1', HONEST, d);
		if (!r.ok) throw new Error(r.error);
		expect(r.body.rank).toBeUndefined();
		expect(inserted[0]?.flagged).toBe(1);
		expect(kanaCalls).toHaveLength(1); // stats still recorded
		expect(invalidated).toEqual([]);
	});

	it('rejects unknown modes, foreign text and tampered logs', async () => {
		const { store } = fakeStore();
		const { d } = deps(store);
		expect(await submitRun(null, { ...HONEST, mode: 'lesson:nope' }, d)).toMatchObject({
			ok: false,
			error: /mode/
		});
		expect(await submitRun(null, { ...HONEST, text: 'か\nき\nく' }, d)).toMatchObject({
			ok: false,
			error: /text/
		});
		const tampered = HONEST.log.map((e) => ({ ...e, ok: true }));
		tampered.push({ t: 99_999, key: 'x', ok: true });
		expect(await submitRun(null, { ...HONEST, log: tampered }, d)).toMatchObject({
			ok: false,
			error: /replay/
		});
	});

	it('accepts timed runs with a partially typed last question', async () => {
		const text = 'か\nき\nく';
		const log = record(text, 'kakik');
		const durationMs = 60_000; // timer ran out
		const { store } = fakeStore();
		const { d } = deps(store);
		// duration_mismatch fires (span ≪ 60 s) → flagged but still accepted
		const r = await submitRun('u1', { mode: 'timed:allhira:60', text, log, durationMs }, d);
		expect(r.ok).toBe(true);
	});

	it('validates a content run against the pool the deps resolve from D1 (M4-1)', async () => {
		const text = 'あさ\nよる';
		const log = record(text, 'asayoru');
		const durationMs = (log.at(-1)?.t ?? 0) - (log[0]?.t ?? 0);
		const { store, inserted } = fakeStore();
		const { d } = deps(store);
		const withPool = {
			...d,
			poolForMode: async (_mode: string, parsed: { kind: string }) =>
				parsed.kind === 'content' ? ['あさ', 'よる'] : undefined
		};

		const r = await submitRun('u1', { mode: 'content:C1', text, log, durationMs }, withPool);
		expect(r.ok).toBe(true);
		expect(inserted[0]?.mode).toBe('content:C1');

		// A line that is not part of the content is rejected like any other foreign text…
		expect(
			await submitRun('u1', { mode: 'content:C1', text: 'ひる', log, durationMs }, withPool)
		).toMatchObject({ ok: false, error: /text|replay/ });

		// …and a content with no pool (draft / deleted) is simply an unknown mode.
		expect(
			await submitRun(
				'u1',
				{ mode: 'content:C9', text, log, durationMs },
				{ ...d, poolForMode: async () => undefined }
			)
		).toMatchObject({ ok: false, error: /mode/ });
	});
});

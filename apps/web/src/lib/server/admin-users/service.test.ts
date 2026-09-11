import { describe, expect, it } from 'vitest';
import {
	deleteRun,
	getUserDetail,
	parseFlagInput,
	reinstateUser,
	searchUsers,
	setRunFlag,
	type AdminUserDeps
} from './service.ts';
import type { AdminRun, AdminUserStore, AdminUserSummary } from './store.ts';

const NOW = Date.parse('2026-09-11T03:00:00Z');

function user(over: Partial<AdminUserSummary> = {}): AdminUserSummary {
	return {
		id: 'u1',
		name: '太郎',
		email: 'taro@example.com',
		image: null,
		createdAt: NOW - 86_400_000,
		plan: 'free',
		runCount: 0,
		lastRunAt: null,
		strikes: 0,
		suspendedAt: null,
		songCount: 0,
		...over
	};
}

function run(over: Partial<AdminRun> = {}): AdminRun {
	return {
		id: 'R1',
		userId: 'u1',
		mode: 'timed:allhira:60',
		score: 300,
		kpm: 320,
		accuracy: 0.97,
		correctKeys: 320,
		wrongKeys: 10,
		durationMs: 60_000,
		maxCombo: 80,
		week: '2026-W37',
		flagged: false,
		unrankedReason: null,
		createdAt: NOW - 1000,
		...over
	};
}

interface Fake {
	deps: AdminUserDeps;
	users: Map<string, AdminUserSummary>;
	runs: Map<string, AdminRun>;
	notices: { userId: string; kind: string }[];
	invalidated: string[];
	deletedLogs: string[];
}

function fake(seed: { users?: AdminUserSummary[]; runs?: AdminRun[] } = {}): Fake {
	const users = new Map((seed.users ?? []).map((u) => [u.id, u]));
	const runs = new Map((seed.runs ?? []).map((r) => [r.id, r]));
	const notices: { userId: string; kind: string }[] = [];
	const invalidated: string[] = [];
	const deletedLogs: string[] = [];

	const store: AdminUserStore = {
		searchUsers: async (q, limit) =>
			[...users.values()]
				.filter((u) => q === '' || u.email.includes(q) || u.name.includes(q))
				.sort((a, b) => b.createdAt - a.createdAt)
				.slice(0, limit),
		getUser: async (id) => users.get(id),
		recentRuns: async (userId, limit) =>
			[...runs.values()]
				.filter((r) => r.userId === userId)
				.sort((a, b) => b.createdAt - a.createdAt)
				.slice(0, limit),
		getRun: async (id) => runs.get(id),
		setRunFlag: async (id, flagged) => {
			const found = runs.get(id);
			if (found) runs.set(id, { ...found, flagged });
		},
		deleteRun: async (id) => {
			runs.delete(id);
		},
		clearStrikes: async (userId) => {
			const found = users.get(userId);
			if (found) users.set(userId, { ...found, strikes: 0, suspendedAt: null });
		},
		insertNotice: async (row) => {
			notices.push({ userId: row.userId, kind: row.kind });
		}
	};
	let counter = 0;
	return {
		deps: {
			store,
			invalidateLeaderboard: async (mode, week) => {
				invalidated.push(`${mode}|${week}`);
			},
			deleteKeylog: async (runId) => {
				deletedLogs.push(runId);
			},
			now: () => NOW,
			newId: () => `N${++counter}`
		},
		users,
		runs,
		notices,
		invalidated,
		deletedLogs
	};
}

describe('parseFlagInput', () => {
	it('wants a boolean', () => {
		expect(parseFlagInput({ flagged: true })).toEqual({ flagged: true });
		expect(parseFlagInput({ flagged: 'yes' })).toMatch(/boolean/);
		expect(parseFlagInput(null)).toMatch(/object/);
	});
});

describe('users', () => {
	it('searches by e-mail or name, newest first, and trims the query', async () => {
		const f = fake({
			users: [user(), user({ id: 'u2', name: '花子', email: 'hanako@example.com', createdAt: NOW })]
		});
		expect((await searchUsers(' hanako ', f.deps)).map((u) => u.id)).toEqual(['u2']);
		expect((await searchUsers('太郎', f.deps)).map((u) => u.id)).toEqual(['u1']);
		expect((await searchUsers('', f.deps)).map((u) => u.id)).toEqual(['u2', 'u1']);
	});

	it('returns a user with their recent runs, or 404', async () => {
		const f = fake({ users: [user()], runs: [run(), run({ id: 'R2', userId: 'u9' })] });
		const r = await getUserDetail('u1', f.deps);
		expect(r.ok && r.body.runs.map((x) => x.id)).toEqual(['R1']);
		expect(await getUserDetail('nope', f.deps)).toMatchObject({ ok: false, status: 404 });
	});
});

describe('run flags', () => {
	it('flags a ranked run and drops its cached board', async () => {
		const f = fake({ runs: [run()] });
		const r = await setRunFlag('R1', true, f.deps);
		expect(r.ok && r.body.flagged).toBe(true);
		expect(f.runs.get('R1')?.flagged).toBe(true);
		expect(f.invalidated).toEqual(['timed:allhira:60|2026-W37']);
	});

	it('unflags too, and does nothing when the flag is already set that way', async () => {
		const f = fake({ runs: [run({ flagged: true })] });
		await setRunFlag('R1', true, f.deps);
		expect(f.invalidated).toEqual([]);
		await setRunFlag('R1', false, f.deps);
		expect(f.runs.get('R1')?.flagged).toBe(false);
		expect(f.invalidated).toHaveLength(1);
	});

	it('leaves the cache alone for an anonymous run, and 404s an unknown one', async () => {
		const f = fake({ runs: [run({ userId: null })] });
		await setRunFlag('R1', true, f.deps);
		expect(f.invalidated).toEqual([]);
		expect(await setRunFlag('nope', true, f.deps)).toMatchObject({ ok: false, status: 404 });
	});
});

describe('deleteRun', () => {
	it('removes the row and the key log, and drops the board of an unflagged ranked run', async () => {
		const f = fake({ runs: [run()] });
		expect(await deleteRun('R1', f.deps)).toMatchObject({ ok: true });
		expect(f.runs.has('R1')).toBe(false);
		expect(f.deletedLogs).toEqual(['R1']);
		expect(f.invalidated).toHaveLength(1);
	});

	it('does not touch the cache for a flagged run', async () => {
		const f = fake({ runs: [run({ flagged: true })] });
		await deleteRun('R1', f.deps);
		expect(f.invalidated).toEqual([]);
		expect(f.deletedLogs).toEqual(['R1']);
	});

	it('404s an unknown run', async () => {
		expect(await deleteRun('nope', fake().deps)).toMatchObject({ ok: false, status: 404 });
	});
});

describe('reinstateUser', () => {
	it('clears strikes and suspension and leaves a notice', async () => {
		const f = fake({ users: [user({ strikes: 3, suspendedAt: NOW - 5000 })] });
		const r = await reinstateUser('u1', f.deps);
		expect(r.ok && r.body).toEqual({ strikes: 0, suspended: false, notified: true });
		expect(f.users.get('u1')).toMatchObject({ strikes: 0, suspendedAt: null });
		expect(f.notices).toEqual([{ userId: 'u1', kind: 'reinstated' }]);
	});

	it('is a no-op without a record, and 404s an unknown user', async () => {
		const f = fake({ users: [user()] });
		const r = await reinstateUser('u1', f.deps);
		expect(r.ok && r.body.notified).toBe(false);
		expect(f.notices).toEqual([]);
		expect(await reinstateUser('nope', f.deps)).toMatchObject({ ok: false, status: 404 });
	});
});

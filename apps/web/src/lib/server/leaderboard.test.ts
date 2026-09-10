import { describe, expect, it } from 'vitest';
import { cacheKey, getLeaderboard, getMyRank, type KvLike } from './leaderboard.ts';
import type { LeaderboardRow, RunStore } from './runs/store.ts';

const NOW = Date.parse('2026-09-10T03:00:00Z'); // 2026-W37 in Taipei

function row(userId: string, best: number): LeaderboardRow {
	return { userId, name: `user ${userId}`, image: null, best, kpm: best, accuracy: 0.95 };
}

function fakeStore(rows: LeaderboardRow[], over: Partial<RunStore> = {}) {
	const calls: string[] = [];
	const store = {
		top100: async (mode: string, week: string | null) => {
			calls.push(`top100:${mode}:${week}`);
			return rows;
		},
		userBest: async () => 42,
		rankOf: async () => 250,
		insertRun: async () => {},
		countRunsSince: async () => 0,
		upsertKanaStats: async () => {},
		hundredthScore: async () => null,
		...over
	} satisfies RunStore;
	return { store, calls };
}

function fakeKv(): KvLike & { data: Map<string, string>; ttls: number[] } {
	const data = new Map<string, string>();
	const ttls: number[] = [];
	return {
		data,
		ttls,
		get: async (k) => data.get(k) ?? null,
		put: async (k, v, o) => {
			data.set(k, v);
			ttls.push(o?.expirationTtl ?? 0);
		}
	};
}

describe('getLeaderboard', () => {
	it('computes, ranks and caches the weekly board for 60 s', async () => {
		const { store, calls } = fakeStore([row('a', 300), row('b', 200)]);
		const kv = fakeKv();
		const board = await getLeaderboard({ store, kv, now: () => NOW }, 'timed:allhira:60', 'week');
		expect(board?.week).toBe('2026-W37');
		expect(board?.entries.map((e) => [e.rank, e.userId])).toEqual([
			[1, 'a'],
			[2, 'b']
		]);
		expect(kv.data.has(cacheKey('timed:allhira:60', '2026-W37'))).toBe(true);
		expect(kv.ttls).toEqual([60]);

		const again = await getLeaderboard({ store, kv, now: () => NOW }, 'timed:allhira:60', 'week');
		expect(again).toEqual(board);
		expect(calls).toHaveLength(1); // served from cache
	});

	it('uses the all-time key for period=all', async () => {
		const { store, calls } = fakeStore([]);
		const kv = fakeKv();
		const board = await getLeaderboard({ store, kv, now: () => NOW }, 'timed:all:30', 'all');
		expect(board?.week).toBeNull();
		expect(calls).toEqual(['top100:timed:all:30:null']);
		expect(kv.data.has('lb:timed:all:30:all')).toBe(true);
	});

	it('recomputes when the cached value is corrupt', async () => {
		const { store, calls } = fakeStore([row('a', 1)]);
		const kv = fakeKv();
		kv.data.set(cacheKey('timed:allhira:60', '2026-W37'), '{not json');
		const board = await getLeaderboard({ store, kv, now: () => NOW }, 'timed:allhira:60', 'week');
		expect(board?.entries).toHaveLength(1);
		expect(calls).toHaveLength(1);
	});

	it('returns null for unknown modes without touching the store', async () => {
		const { store, calls } = fakeStore([]);
		expect(await getLeaderboard({ store, kv: fakeKv() }, 'timed:n5:60', 'week')).toBeNull();
		expect(calls).toEqual([]);
	});
});

describe('getMyRank', () => {
	it('reads the rank from the list when the user is in it', async () => {
		const { store } = fakeStore([row('a', 300), row('me', 200)]);
		const board = await getLeaderboard(
			{ store, kv: fakeKv(), now: () => NOW },
			'timed:allhira:60',
			'week'
		);
		expect(await getMyRank(store, board!, 'me')).toEqual({ rank: 2, best: 200 });
	});

	it('counts in the store when the user is outside the top 100', async () => {
		const { store } = fakeStore([row('a', 300)]);
		const board = await getLeaderboard(
			{ store, kv: fakeKv(), now: () => NOW },
			'timed:allhira:60',
			'week'
		);
		expect(await getMyRank(store, board!, 'me')).toEqual({ rank: 250, best: 42 });
	});

	it('is null when the user has no ranked run', async () => {
		const { store } = fakeStore([], { userBest: async () => null });
		const board = await getLeaderboard(
			{ store, kv: fakeKv(), now: () => NOW },
			'timed:allhira:60',
			'week'
		);
		expect(await getMyRank(store, board!, 'me')).toBeNull();
	});
});

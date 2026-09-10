import { describe, expect, it } from 'vitest';
import type { KvLike } from './leaderboard.ts';
import type { RunStore } from './runs/store.ts';
import { allTimedModes, deleteOldLogs, snapshotLastWeek, type R2Like } from './scheduled.ts';

const MONDAY_0000_TAIPEI = Date.parse('2026-09-13T16:00:00Z'); // start of 2026-W38

describe('snapshotLastWeek', () => {
	it('freezes the previous ISO week for all 9 timed modes without a TTL', async () => {
		const asked: string[] = [];
		const store = {
			top100: async (mode: string, week: string | null) => {
				asked.push(`${mode}@${week}`);
				return [{ userId: 'u', name: 'U', image: null, best: 10, kpm: 10, accuracy: 1 }];
			}
		} as unknown as RunStore;
		const puts: { key: string; ttl: number | undefined }[] = [];
		const kv: KvLike = {
			get: async () => null,
			put: async (key, _v, o) => {
				puts.push({ key, ttl: o?.expirationTtl });
			}
		};
		const r = await snapshotLastWeek({ store, kv }, MONDAY_0000_TAIPEI);
		expect(r).toEqual({ week: '2026-W37', modes: 9 });
		expect(allTimedModes()).toHaveLength(9);
		expect(asked.every((a) => a.endsWith('@2026-W37'))).toBe(true);
		expect(puts.map((p) => p.key)).toContain('lbsnap:timed:allhira:60:2026-W37');
		expect(puts.every((p) => p.ttl === undefined)).toBe(true);
	});
});

describe('deleteOldLogs', () => {
	it('deletes only objects older than 90 days, paging through the listing', async () => {
		const now = Date.parse('2026-09-14T00:00:00Z');
		const old = new Date(now - 91 * 86_400_000);
		const fresh = new Date(now - 89 * 86_400_000);
		const pages = [
			{
				objects: [
					{ key: 'runs/a.json', uploaded: old },
					{ key: 'runs/b.json', uploaded: fresh }
				],
				truncated: true,
				cursor: 'c1'
			},
			{ objects: [{ key: 'runs/c.json', uploaded: old }], truncated: false }
		];
		const deleted: string[][] = [];
		let calls = 0;
		const r2: R2Like = {
			list: async (o) => {
				calls += 1;
				return o.cursor === 'c1' ? pages[1]! : pages[0]!;
			},
			delete: async (keys) => {
				deleted.push(Array.isArray(keys) ? keys : [keys]);
			}
		};
		expect(await deleteOldLogs(r2, now)).toBe(2);
		expect(deleted).toEqual([['runs/a.json'], ['runs/c.json']]);
		expect(calls).toBe(2);
	});

	it('does nothing when every log is recent', async () => {
		const r2: R2Like = {
			list: async () => ({
				objects: [{ key: 'runs/x.json', uploaded: new Date() }],
				truncated: false
			}),
			delete: async () => {
				throw new Error('must not delete');
			}
		};
		expect(await deleteOldLogs(r2)).toBe(0);
	});
});

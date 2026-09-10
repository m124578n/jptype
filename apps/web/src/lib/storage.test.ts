import { beforeEach, describe, expect, it } from 'vitest';
import {
	DEFAULT_SETTINGS,
	loadKanaStats,
	loadResults,
	loadSettings,
	recordKanaStats,
	recordResult,
	saveSettings,
	weakKana
} from './storage.ts';

class MemoryStorage implements Storage {
	private map = new Map<string, string>();
	get length() {
		return this.map.size;
	}
	clear() {
		this.map.clear();
	}
	getItem(key: string) {
		return this.map.get(key) ?? null;
	}
	key(i: number) {
		return [...this.map.keys()][i] ?? null;
	}
	removeItem(key: string) {
		this.map.delete(key);
	}
	setItem(key: string, value: string) {
		this.map.set(key, value);
	}
}

const result = { kpm: 120, accuracy: 0.9, score: 97, correctKeys: 90, wrongKeys: 10 };

beforeEach(() => {
	globalThis.localStorage = new MemoryStorage();
});

describe('settings', () => {
	it('returns defaults when nothing is stored or storage is corrupted', () => {
		expect(loadSettings()).toEqual(DEFAULT_SETTINGS);
		localStorage.setItem('jptype:settings', '{not json');
		expect(loadSettings()).toEqual(DEFAULT_SETTINGS);
	});

	it('round-trips and fills missing keys with defaults', () => {
		saveSettings({ ...DEFAULT_SETTINGS, sound: false });
		expect(loadSettings().sound).toBe(false);
		localStorage.setItem('jptype:settings', JSON.stringify({ volume: 0.2 }));
		expect(loadSettings()).toEqual({ ...DEFAULT_SETTINGS, volume: 0.2 });
	});
});

describe('results', () => {
	it('records attempts and keeps the best score', () => {
		expect(recordResult('hira-a', result, 1000)).toBe(true);
		expect(recordResult('hira-a', { ...result, score: 50 }, 2000)).toBe(false);
		expect(loadResults()['hira-a']).toEqual({
			best: { score: 97, kpm: 120, accuracy: 0.9 },
			attempts: 2,
			lastAt: 2000
		});
		expect(recordResult('hira-a', { ...result, score: 150 }, 3000)).toBe(true);
		expect(loadResults()['hira-a']?.best.score).toBe(150);
	});
});

describe('kana stats', () => {
	it('accumulates attempts and errors per kana', () => {
		recordKanaStats([
			{ kana: 'し', error: true },
			{ kana: 'し', error: false },
			{ kana: 'か', error: false }
		]);
		recordKanaStats([{ kana: 'し', error: true }]);
		expect(loadKanaStats()).toEqual({
			し: { attempts: 3, errors: 2 },
			か: { attempts: 1, errors: 0 }
		});
	});

	it('weakKana applies the spec §7.3 rule and sorts by error rate', () => {
		expect(
			weakKana({
				し: { attempts: 3, errors: 2 },
				ち: { attempts: 10, errors: 3 },
				か: { attempts: 2, errors: 2 }, // too few attempts
				あ: { attempts: 10, errors: 2 } // exactly 20 % → not weak
			})
		).toEqual(['し', 'ち']);
	});
});

describe('without localStorage', () => {
	it('falls back gracefully', () => {
		// @ts-expect-error simulate an environment without storage
		delete globalThis.localStorage;
		expect(loadSettings()).toEqual(DEFAULT_SETTINGS);
		expect(recordResult('x', result)).toBe(true);
	});
});

import { describe, expect, it } from 'vitest';
import { weekOf } from './week.ts';

const utc = (s: string) => Date.parse(s);

describe('weekOf (Asia/Taipei ISO weeks)', () => {
	it('labels a mid-week instant', () => {
		expect(weekOf(utc('2026-09-10T03:00:00Z'))).toBe('2026-W37'); // Thu 11:00 Taipei
	});

	it('rolls over at Monday 00:00 Taipei = Sunday 16:00 UTC', () => {
		expect(weekOf(utc('2026-09-13T15:59:59Z'))).toBe('2026-W37'); // Sun 23:59:59 Taipei
		expect(weekOf(utc('2026-09-13T16:00:00Z'))).toBe('2026-W38'); // Mon 00:00:00 Taipei
	});

	it('follows ISO year rules around New Year', () => {
		expect(weekOf(utc('2026-01-01T00:00:00Z'))).toBe('2026-W01'); // Thu
		expect(weekOf(utc('2027-01-01T00:00:00Z'))).toBe('2026-W53'); // Fri → still ISO 2026
		expect(weekOf(utc('2024-12-30T00:00:00Z'))).toBe('2025-W01'); // Mon → ISO 2025
	});
});

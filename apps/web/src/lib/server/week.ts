/** Asia/Taipei is UTC+8 all year (no DST). */
const TAIPEI_OFFSET_MS = 8 * 60 * 60 * 1000;

/**
 * ISO week label ('YYYY-Www') of an instant, evaluated in Asia/Taipei (spec §4 `runs.week`).
 * Weeks start Monday 00:00 Taipei = Sunday 16:00 UTC, matching the cron in wrangler.jsonc.
 */
export function weekOf(epochMs: number): string {
	// Shift so that UTC getters read Taipei wall-clock time.
	const d = new Date(epochMs + TAIPEI_OFFSET_MS);
	const day = d.getUTCDay() || 7; // Mon=1 … Sun=7
	// Thursday of the current ISO week decides the ISO year.
	const thursday = new Date(
		Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 4 - day)
	);
	const isoYear = thursday.getUTCFullYear();
	const jan1 = Date.UTC(isoYear, 0, 1);
	const week = Math.ceil(((thursday.getTime() - jan1) / 86_400_000 + 1) / 7);
	return `${isoYear}-W${String(week).padStart(2, '0')}`;
}

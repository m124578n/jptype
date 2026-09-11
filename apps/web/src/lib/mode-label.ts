/**
 * A short zh-TW label for a run's `mode` string (`lesson:hira-a`, `timed:allhira:60`, `weak`,
 * `content:{id}`), shared by `/me` and the admin console. Strings come from Paraglide.
 */
import { m } from '$lib/paraglide/messages';

export function modeLabel(mode: string): string {
	if (mode === 'weak') return m.me_mode_weak();
	const [kind, a, b] = mode.split(':');
	if (kind === 'timed') return `${m.nav_timed()} ${a} ${b}s`;
	if (kind === 'content') return `${m.mode_content()} ${a ?? ''}`;
	return `${m.nav_learn()} ${a ?? ''}`;
}

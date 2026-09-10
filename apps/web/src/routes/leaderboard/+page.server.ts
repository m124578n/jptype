import { error } from '@sveltejs/kit';
import { parseMode } from '@jptype/data';
import type { PageServerLoad } from './$types';
import { d1ContentStore } from '$lib/server/contents/store';
import { createDb } from '$lib/server/db';
import { getLeaderboard, getMyRank, isPeriod } from '$lib/server/leaderboard';
import { d1RunStore } from '$lib/server/runs/store';

const DEFAULT_MODE = 'timed:allhira:60';

/**
 * The timed boards are the default UI; `?mode=content:{id}` shows the per-content board instead
 * (M4-3). `getLeaderboard` already keys by mode string, so nothing else is needed — only the
 * content's title, to name the board.
 */
export const load: PageServerLoad = async ({ url, locals, platform }) => {
	const mode = url.searchParams.get('mode') ?? DEFAULT_MODE;
	const periodParam = url.searchParams.get('period') ?? 'week';
	const period = isPeriod(periodParam) ? periodParam : 'week';
	const parsed = parseMode(mode);
	if (!parsed || (parsed.kind !== 'timed' && parsed.kind !== 'content')) error(404, 'unknown mode');

	const pool = parsed.kind === 'timed' ? parsed.pool : null;
	const seconds = parsed.kind === 'timed' ? parsed.seconds : null;
	const contentId = parsed.kind === 'content' ? parsed.contentId : null;

	const env = platform?.env;
	if (!env) {
		// Prerender / no bindings: render an empty board rather than failing.
		return { mode, period, pool, seconds, contentId, contentTitle: null, board: null, me: null };
	}

	const db = createDb(env.DB);
	const store = d1RunStore(db);
	const content = contentId === null ? undefined : await d1ContentStore(db).getContent(contentId);
	if (contentId !== null && (!content || content.status !== 'published')) {
		error(404, 'unknown mode');
	}

	const board = await getLeaderboard({ store, kv: env.KV }, mode, period);
	const me = board && locals.user ? await getMyRank(store, board, locals.user.id) : null;
	return {
		mode,
		period,
		pool,
		seconds,
		contentId,
		contentTitle: content?.title ?? null,
		board,
		me
	};
};

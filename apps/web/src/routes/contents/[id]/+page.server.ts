import { error } from '@sveltejs/kit';
import { building } from '$app/environment';
import type { PageServerLoad } from './$types';
import { d1ContentStore } from '$lib/server/contents/store';
import { getPublicContent } from '$lib/server/contents/service';
import { createDb } from '$lib/server/db';
import { platformEnv } from '$lib/server/platform';

/** `/contents/[id]` — one published content with its lines; a draft is a 404. */
export const load: PageServerLoad = async (event) => {
	const env = building ? undefined : platformEnv(event);
	if (!env) error(503, 'no bindings');

	const deps = { store: d1ContentStore(createDb(env.DB)) };
	const found = await getPublicContent(event.params.id, deps);
	if (!found.ok) error(found.status, found.error);

	const { content, lines } = found.body;
	return {
		content,
		lines: lines.map((l) => ({
			order: l.order,
			startTime: l.startTime,
			endTime: l.endTime,
			originalText: l.originalText,
			kanaText: l.kanaText,
			romajiText: l.romajiText
		}))
	};
};

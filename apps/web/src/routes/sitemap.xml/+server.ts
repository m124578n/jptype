import { LESSONS } from '@jptype/data';
import type { RequestHandler } from '@sveltejs/kit';
import { listPublicContents, parseListQuery } from '$lib/server/contents/service';
import { d1ContentStore } from '$lib/server/contents/store';
import { createDb } from '$lib/server/db';
import { platformEnv } from '$lib/server/platform';

/** Public, indexable pages: the static sections, every lesson, and published platform content. */
const STATIC_PATHS = [
	'/',
	'/learn',
	'/timed',
	'/listen',
	'/contents',
	'/leaderboard',
	'/terms',
	'/copyright'
];

function escapeXml(value: string): string {
	return value.replace(/[<>&'"]/g, (c) => `&#${c.charCodeAt(0)};`);
}

/**
 * GET /sitemap.xml — built per request (contents change), cached for an hour at the edge.
 * User-provided content is left out on purpose: it lives under /library, which is noindex.
 */
export const GET: RequestHandler = async (event) => {
	const origin = event.url.origin;
	const paths = [...STATIC_PATHS, ...LESSONS.map((lesson) => `/learn/${lesson.id}`)];

	const env = platformEnv(event);
	if (env) {
		const deps = { store: d1ContentStore(createDb(env.DB)) };
		const query = parseListQuery(new URLSearchParams({ source: 'platform' }), 'published');
		// One page of the newest platform content is plenty for a sitemap this size.
		const list = await listPublicContents(query, deps);
		for (const content of list.contents) paths.push(`/contents/${content.id}`);
	}

	const body =
		'<?xml version="1.0" encoding="UTF-8"?>\n' +
		'<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
		paths.map((p) => `  <url><loc>${escapeXml(origin + p)}</loc></url>`).join('\n') +
		'\n</urlset>\n';
	return new Response(body, {
		headers: {
			'content-type': 'application/xml; charset=utf-8',
			'cache-control': 'public, max-age=3600'
		}
	});
};

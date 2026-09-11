/**
 * Per-route SEO text (M4-6). Pages still set their own `<title>`; this map feeds the shared
 * `<meta name="description">`, Open Graph and Twitter tags in the layout, and decides which
 * paths are kept out of search engines. Every string comes from Paraglide.
 */
import { m } from '$lib/paraglide/messages';

export interface SeoText {
	title: string;
	description: string;
}

/** Paths that are personal, administrative or transactional: never indexed. */
const NOINDEX_PREFIXES = ['/admin', '/me', '/login', '/library', '/api'];

export function isNoindex(pathname: string): boolean {
	return NOINDEX_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

/** Title + description for a pathname; unknown paths fall back to the site-wide text. */
export function seoFor(pathname: string): SeoText {
	const site = m.seo_site_name();
	if (pathname === '/') return { title: m.seo_home_title(), description: m.seo_desc_home() };
	const section = (label: string, description: string): SeoText => ({
		title: `${label} · ${site}`,
		description
	});
	if (pathname.startsWith('/learn')) return section(m.learn_title(), m.seo_desc_learn());
	if (pathname.startsWith('/timed')) return section(m.timed_title(), m.seo_desc_timed());
	if (pathname.startsWith('/listen')) return section(m.listen_title(), m.seo_desc_listen());
	if (pathname.startsWith('/contents')) return section(m.contents_title(), m.seo_desc_contents());
	if (pathname.startsWith('/leaderboard')) {
		return section(m.leaderboard_title(), m.seo_desc_leaderboard());
	}
	if (pathname.startsWith('/library')) return section(m.songs_title(), m.seo_desc_library());
	return { title: site, description: m.seo_desc_home() };
}

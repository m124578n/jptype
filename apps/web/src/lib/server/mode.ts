/**
 * Server-side mode resolution (M4-1).
 *
 * `@jptype/data` owns the mode strings, but it cannot know the pool of a `content:{id}` run —
 * those lines live in D1. `submitRun` therefore takes an async `poolForMode` override, and this
 * is the one the API route passes: it answers for content modes and leaves every other mode to
 * the static pools in `@jptype/data`.
 *
 * A draft (or missing) content resolves to `undefined`, so its runs are rejected like any other
 * unknown mode — an unpublished import cannot be farmed for leaderboard scores.
 */
import type { ParsedMode } from '@jptype/data';
import { contentPool, type ContentDeps } from './contents/service.ts';

export type PoolResolver = (
	mode: string,
	parsed: ParsedMode
) => Promise<readonly string[] | undefined>;

export function contentPoolResolver(deps: ContentDeps): PoolResolver {
	return async (_mode, parsed) => {
		if (parsed.kind !== 'content') return undefined; // falls back to the static pools
		return contentPool(parsed.contentId, deps);
	};
}

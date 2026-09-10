import type { PageLoad } from './$types';

/**
 * Like the practice page: the song (and now its timings) lives in localStorage only,
 * so the route just hands the id to the page.
 */
export const load: PageLoad = ({ params }) => ({ id: params.id });

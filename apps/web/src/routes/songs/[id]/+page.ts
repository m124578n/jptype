import type { PageLoad } from './$types';

/**
 * The song itself is read from localStorage on mount (it never leaves the browser);
 * the route only needs to hand the id to the page.
 */
export const load: PageLoad = ({ params }) => ({ id: params.id });

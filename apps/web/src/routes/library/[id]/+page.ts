import type { PageLoad } from './$types';

/**
 * The song is fetched after mount — from the account (signed in), from this browser, or from the
 * public API for a published song — so the route only needs to hand the id to the page.
 */
export const load: PageLoad = ({ params }) => ({ id: params.id });

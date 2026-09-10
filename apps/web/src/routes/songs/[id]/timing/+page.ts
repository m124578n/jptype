import type { PageLoad } from './$types';

/** Like the practice page: the song is loaded client-side, so the route just hands over the id. */
export const load: PageLoad = ({ params }) => ({ id: params.id });

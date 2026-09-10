/** Question selection for a practice run (spec §7.1: 20 random questions, repeats allowed). */

export const QUESTIONS_PER_RUN = 20;

export type Rng = () => number; // [0, 1)

/**
 * One random item, avoiding `previous` when the pool has more than one item.
 * On a collision the next index is used instead of re-drawing, so this never loops
 * (a degenerate rng must not hang the UI or the tests).
 */
export function pickNext(pool: readonly string[], previous: string | undefined, rng: Rng): string {
	const idx = Math.min(pool.length - 1, Math.floor(rng() * pool.length));
	const candidate = pool[idx] as string;
	if (pool.length === 1 || candidate !== previous) return candidate;
	return pool[(idx + 1) % pool.length] as string;
}

/** Random draw with replacement, but never the same question twice in a row when the pool allows. */
export function pickQuestions(
	pool: readonly string[],
	count: number,
	rng: Rng = Math.random
): string[] {
	if (pool.length === 0 || count <= 0) return [];
	const out: string[] = [];
	while (out.length < count) out.push(pickNext(pool, out[out.length - 1], rng));
	return out;
}

/**
 * Pool for "加強練習錯字": every wrong unit, repeated so it dominates, topped up with random
 * units from the lesson pool. Weak units are weighted 3:1 against fillers.
 */
export function weakPool(wrong: readonly string[], lessonPool: readonly string[]): string[] {
	const uniqueWrong = wrong.filter((u, i) => wrong.indexOf(u) === i);
	if (uniqueWrong.length === 0) return [...lessonPool];
	const fillers = lessonPool.filter((u) => !uniqueWrong.includes(u));
	return [...uniqueWrong, ...uniqueWrong, ...uniqueWrong, ...fillers];
}

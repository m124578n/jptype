/** Question selection for a practice run (spec §7.1: 20 random questions, repeats allowed). */

export const QUESTIONS_PER_RUN = 20;

export type Rng = () => number; // [0, 1)

/** Random draw with replacement, but never the same question twice in a row when the pool allows. */
export function pickQuestions(
	pool: readonly string[],
	count: number,
	rng: Rng = Math.random
): string[] {
	if (pool.length === 0 || count <= 0) return [];
	const out: string[] = [];
	while (out.length < count) {
		const candidate = pool[Math.floor(rng() * pool.length)] as string;
		if (pool.length > 1 && out[out.length - 1] === candidate) continue;
		out.push(candidate);
	}
	return out;
}

/**
 * Pool for "加強練習錯字": every wrong unit, repeated so it dominates, topped up with random
 * units from the lesson pool. Weak units are weighted 3:1 against fillers.
 */
export function weakPool(wrong: readonly string[], lessonPool: readonly string[]): string[] {
	const uniqueWrong = [...new Set(wrong)];
	if (uniqueWrong.length === 0) return [...lessonPool];
	const fillers = lessonPool.filter((u) => !uniqueWrong.includes(u));
	return [...uniqueWrong, ...uniqueWrong, ...uniqueWrong, ...fillers];
}

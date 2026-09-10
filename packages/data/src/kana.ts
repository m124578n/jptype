import type { KanaEntry } from './types.ts';

/**
 * Kana ↔ romaji table (spec §5.2). Filled in during M0.
 * Every change here must keep `pnpm validate:data` green.
 */
export const KANA: readonly KanaEntry[] = [];

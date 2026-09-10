import { defineConfig } from 'vitest/config';

export default defineConfig({
	test: {
		include: ['test/**/*.test.ts'],
		expect: { requireAssertions: true },
		coverage: {
			provider: 'v8',
			include: ['src/**/*.ts'],
			reporter: ['text', 'lcov'],
			// Spec §1: engine coverage must stay ≥ 90 %.
			thresholds: { lines: 90, functions: 90, branches: 90, statements: 90 }
		}
	}
});

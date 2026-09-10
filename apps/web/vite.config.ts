import { paraglideVitePlugin } from '@inlang/paraglide-js';
import { defineConfig } from 'vitest/config';
import adapter from '@sveltejs/adapter-cloudflare';
import { sveltekit } from '@sveltejs/kit/vite';
import { viteStaticCopy } from 'vite-plugin-static-copy';

export default defineConfig({
	plugins: [
		sveltekit({
			compilerOptions: {
				// Force runes mode for the project, except for libraries. Can be removed in svelte 6.
				runes: ({ filename }) =>
					filename.split(/[/\\]/).includes('node_modules') ? undefined : true
			},
			// The adapter writes its bundle to the `main` of the config it reads; give it a config whose
			// main is the generated _worker.js so it never overwrites src/worker/index.ts (our real entry).
			adapter: adapter({
				config: 'wrangler.adapter.jsonc',
				platformProxy: { configPath: 'wrangler.jsonc' }
			})
		}),

		paraglideVitePlugin({
			project: './project.inlang',
			outdir: './src/lib/paraglide',
			emitTsDeclarations: true
		}),

		// 漢字→かな runs in the admin's browser (spec §1: no external API at runtime), so kuromoji's
		// IPADIC has to come from our own origin. ~17 MB of .dat.gz is served at /dict/kuromoji/ —
		// copied out of node_modules on dev/build and never committed. The files must be served
		// **as-is**: the loader gunzips them itself.
		viteStaticCopy({
			targets: [{ src: 'node_modules/kuromoji/dict/*.dat.gz', dest: 'dict/kuromoji' }]
		})
	],
	// The tokenizer is imported dynamically from the admin import step; pre-bundling it keeps dev
	// from re-optimizing (and reloading the page) in the middle of an import.
	optimizeDeps: {
		include: ['kuromoji/build/kuromoji.js']
	},
	server: {
		watch: {
			// adapter-cloudflare rm -rf's this on every build; a dev watcher holding it → EBUSY on Windows
			ignored: ['**/.svelte-kit/cloudflare/**', '**/.wrangler/**']
		}
	},
	test: {
		expect: { requireAssertions: true },
		projects: [
			{
				extends: './vite.config.ts',
				test: {
					name: 'server',
					environment: 'node',
					include: ['src/**/*.{test,spec}.{js,ts}'],
					exclude: ['src/**/*.svelte.{test,spec}.{js,ts}']
				}
			}
		]
	}
});

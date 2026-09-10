import { paraglideVitePlugin } from '@inlang/paraglide-js';
import { defineConfig } from 'vitest/config';
import adapter from '@sveltejs/adapter-cloudflare';
import { sveltekit } from '@sveltejs/kit/vite';
import type { Plugin } from 'vite';
import fs from 'node:fs';
import path from 'node:path';

/**
 * Dev only: Vite's static middleware tags `.gz` files with `Content-Encoding: gzip`, so the
 * browser would inflate the kuromoji dictionary before kuromoji inflates it itself (and fail).
 * Serve /dict/kuromoji/*.dat.gz as opaque bytes instead. Production (Workers static assets)
 * already serves them as `application/gzip` without a Content-Encoding header.
 */
function kuromojiDictRaw(): Plugin {
	return {
		name: 'kuromoji-dict-raw',
		apply: 'serve',
		enforce: 'pre',
		configureServer(server) {
			server.middlewares.use((req, res, next) => {
				const url = req.url?.split('?')[0] ?? '';
				if (!url.startsWith('/dict/kuromoji/') || !url.endsWith('.dat.gz')) return next();
				const file = path.join(process.cwd(), 'static', url);
				if (!fs.existsSync(file)) return next();
				res.setHeader('Content-Type', 'application/gzip');
				res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
				fs.createReadStream(file).pipe(res);
			});
		}
	};
}

export default defineConfig({
	plugins: [
		// Must come before sveltekit(): its dev server serves `static/` with sirv, which would win.
		kuromojiDictRaw(),
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
		})

		// 漢字→かな runs in the admin's browser (spec §1: no external API at runtime), so kuromoji's
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

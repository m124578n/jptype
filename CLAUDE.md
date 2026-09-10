# jptype — working agreements for Claude Code

Read `jp-typing-spec.md` first; §1 is a list of hard decisions, do not change them. Product questions go to `DECISIONS.md`.

## Layout

- `apps/web` — SvelteKit 2 + Svelte 5 (runes) on Cloudflare Workers via `@sveltejs/adapter-cloudflare`. Wrangler config: `apps/web/wrangler.jsonc`.
- `packages/engine` — `@jptype/engine`, pure TS, zero deps, coverage gate ≥ 90 %.
- `packages/data` — `@jptype/data`, kana table + lessons + validator (`pnpm validate:data`).
- Workspace packages are consumed as TS source (`exports` → `src/index.ts`); no build step for packages.

## Toolchain

- Node 22 (`.node-version`, managed with fnm), pnpm 12 (`packageManager`), TypeScript 6 strict, Vite 8, Vitest 4.
- Root: `pnpm lint` (prettier + eslint), `pnpm check` (tsc / svelte-check), `pnpm test`, `pnpm test:coverage`, `pnpm build`, `pnpm ci` (all of the above).
- App: `pnpm dev` (Vite + Cloudflare platform proxy), `pnpm preview` (`wrangler dev` on the built worker), `pnpm --filter web db:generate` / `db:migrate:local`.
- Secrets: copy `apps/web/.dev.vars.example` → `apps/web/.dev.vars`. Never commit `.dev.vars`.

## Conventions

- Commits: `feat(engine): …` / `fix(web): …` / `chore(ci): …`. UI copy zh-TW, code/identifiers/commits English.
- All UI strings go through Paraglide messages (`apps/web/messages/zh-TW.json`), never hard-coded.
- Any change to `packages/engine` or `packages/data` ships with tests.
- No external API calls in the Worker runtime except OAuth and Turnstile.
- Relative imports inside packages use explicit `.ts` extensions (Node type-stripping + `rewriteRelativeImportExtensions`).

## Deploy policy

- Never run `wrangler deploy`, create Cloudflare resources, or put secrets from a Claude session. The owner verifies locally first and says when to deploy.
- The GitHub Actions `deploy.yml` (push to `main`) is intentionally left enabled.

## Local dev gotchas (Windows)

- `pnpm dev` (Vite + adapter-cloudflare platform proxy) keeps `apps/web/.svelte-kit/cloudflare` open through workerd; `pnpm build` then fails with `EBUSY` on that folder. Stop the dev server before building (or run them at different times). Kill only the PID that owns the dev port — other side projects on this machine run their own wrangler/vite.
- `wrangler types --check` gives different hashes between Git Bash and PowerShell; `build` regenerates types instead of checking.
- In `vite dev`, editing `wrangler.jsonc` / `.dev.vars` or running `wrangler d1 migrations apply --local` restarts the platform proxy's Miniflare; requests then fail with "Attempted to use poisoned stub" until the dev server is restarted. Never cache binding-derived objects across requests in dev (`getAuth` already skips its cache when `dev`).

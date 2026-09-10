# jptype

給台灣日文初學者的日文打字練習網站（羅馬字輸入 → 假名），全站部署在 Cloudflare。規格見 [`jp-typing-spec.md`](./jp-typing-spec.md)。

## 開發環境

需求：Node 22（建議 [fnm](https://github.com/Schniz/fnm)，會讀 `.node-version`）、pnpm 12（`npm i -g pnpm`）。

```sh
pnpm install
cp apps/web/.dev.vars.example apps/web/.dev.vars
pnpm dev          # http://localhost:5173，D1/KV/R2 由 wrangler 本機模擬
```

常用指令（根目錄）：

| 指令                                 | 說明                                          |
| ------------------------------------ | --------------------------------------------- |
| `pnpm lint` / `pnpm format`          | Prettier + ESLint                             |
| `pnpm check`                         | tsc（packages）+ svelte-check（app）          |
| `pnpm test` / `pnpm test:coverage`   | Vitest；engine 覆蓋率門檻 90 %                |
| `pnpm validate:data`                 | 假名對照表驗證（規格 §5.3）                   |
| `pnpm build`                         | `wrangler types --check` + `vite build`       |
| `pnpm preview`                       | 用 `wrangler dev` 跑 build 出來的 worker      |
| `pnpm ci`                            | 上面全部，等同 GitHub Actions                 |
| `pnpm --filter web db:generate`      | Drizzle 產生 migration 到 `apps/web/drizzle/` |
| `pnpm --filter web db:migrate:local` | 套用 migration 到本機 D1                      |

## 結構

```
apps/web/          SvelteKit + adapter-cloudflare（wrangler.jsonc、drizzle、paraglide）
packages/engine/   @jptype/engine  判定引擎（純 TS）
packages/data/     @jptype/data    假名表、課程、驗證
.github/workflows/ ci.yml（lint/check/test/build）、deploy.yml（wrangler deploy）
```

## 部署

1. 建 Cloudflare 資源並把 ID 填進 `apps/web/wrangler.jsonc`：
   `wrangler d1 create jptype`、`wrangler kv namespace create KV`、`wrangler r2 bucket create jptype`
2. `wrangler secret put` 設定 `BETTER_AUTH_SECRET`、`GOOGLE_CLIENT_ID/SECRET`、`LINE_CHANNEL_ID/SECRET`、`TURNSTILE_SECRET_KEY`
3. GitHub repo secrets：`CLOUDFLARE_API_TOKEN`、`CLOUDFLARE_ACCOUNT_ID`；push `main` 觸發 `deploy.yml`

## 里程碑

M0 引擎與資料 → M1 可練習 → M2 帳號/計時賽/排行榜 → M3 內容擴充（規格 §11）。目前：基礎建設完成，M0 未開始。

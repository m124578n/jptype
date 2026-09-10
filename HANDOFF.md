# HANDOFF — 給下一個 Claude Code session（或任何接手的人）

最後更新：2026-09-10。這份文件講「現在在哪、怎麼跑、還缺什麼」。規格在 `jp-typing-spec.md`，功能狀態在 `ROADMAP.md`，每個技術/產品決策與理由在 `DECISIONS.md`，工作約定在 `CLAUDE.md`。先讀這四份再動手。

## 1. 現況一句話

M0（引擎、假名表）、M1（課程 UI）、M2（登入、送分 API、排行榜、cron、/me）、M3 A/B/C（N5 單字與短句、瀏覽器 TTS 與聽打、歌詞打字）、M4-1（內容模型、後台匯入、Line Editor）、M4-1b（歌詞私有存 D1、時間軸共享、可選公開 + 通知取下、admin）都在 `main`，全部 push 到 https://github.com/m124578n/jptype 。**尚未部署**，也沒建任何 Cloudflare 資源。

## 2. 新機器起手式

```sh
# Node 22（.node-version 會讓 fnm/nvm 自動切）、pnpm 12
pnpm install                      # prepare 會：複製 kuromoji 字典到 apps/web/static/dict、編譯 Paraglide、svelte-kit sync
cp apps/web/.dev.vars.example apps/web/.dev.vars   # 填 BETTER_AUTH_SECRET（任意 32 bytes 隨機字串）；Google 憑證有就填
pnpm --filter web db:migrate:local                 # 套 0000–0003 到本機 D1（.wrangler/state）
pnpm dev                                           # http://localhost:5173（Vite + Cloudflare 綁定模擬）
pnpm run ci                                        # lint → typecheck → 資料驗證 → 測試（含覆蓋率門檻）→ build
pnpm build && pnpm preview                         # 用 wrangler dev 跑 build 出來的 worker（含 cron：/__scheduled?cron=0+16+*+*+0 需 --test-scheduled）
```

- 本機 D1 是空的：排行榜、內容列表、後台都沒資料。要看排行榜可以先在 D1 塞測試列（之前的作法見 git log `feat(web): leaderboard`）。
- 登入要 Google OAuth 憑證才跑得通；沒有時 `/login` 會回 500 `CLIENT_ID_AND_SECRET_REQUIRED`，其他頁面正常。
- Admin = 登入者 email 在 `wrangler.jsonc` 的 `ADMIN_EMAILS`（目前 m23568n@gmail.com，用 Google 登入）。

## 3. 需要 owner 親自提供的東西（沒有這些就做不下去的項目）

| 項目                                                                                                                | 用途                  | 放哪                                                           |
| ------------------------------------------------------------------------------------------------------------------- | --------------------- | -------------------------------------------------------------- |
| Google OAuth Client ID / Secret（redirect URI：`<origin>/api/auth/callback/google`）                                | 登入                  | 本機 `apps/web/.dev.vars`；正式 `wrangler secret put`          |
| Cloudflare 帳號：`wrangler d1 create jptype`、`wrangler kv namespace create KV`、`wrangler r2 bucket create jptype` | 部署                  | 把 ID 填回 `apps/web/wrangler.jsonc`（現在是占位值）           |
| Turnstile widget 的 site key / secret                                                                               | 登入者送分防機器人    | `PUBLIC_TURNSTILE_SITE_KEY` var、`TURNSTILE_SECRET_KEY` secret |
| GitHub secrets `CLOUDFLARE_API_TOKEN`、`CLOUDFLARE_ACCOUNT_ID`                                                      | `deploy.yml` 自動部署 | GitHub repo settings                                           |
| `BETTER_AUTH_SECRET`                                                                                                | session 簽章          | secret                                                         |
| Azure Speech key（可選）                                                                                            | M3 批次 TTS 音檔 → R2 | 之後的 `scripts/tts-batch.ts`                                  |
| LLM API key（可選）                                                                                                 | M4-5 AI 分析與生成    | 之後再定                                                       |

部署規則（owner 定的）：**不要在 Claude session 裡執行 `wrangler deploy` 或建 Cloudflare 資源**，owner 地端驗證完會自己說要部署；GitHub Actions 的自動部署維持開著（目前因缺 secrets 會失敗，正常）。

## 4. 待辦（依優先序）

### 正在由 Opus agent 實作、需要合併驗證的（若本文件更新時已合併，ROADMAP 會標 ✅）

- M4-3：Combo / Max Combo、錯誤分析（最常錯的假名與拼法）、結果頁補 Time / Errors、/me 的今日與本週練習時間、簡單成就。
- M4-2 Review 模式（內容與歌曲只複習錯過的句子）、M4-4 內容探索與首頁改版、課程地圖完成度。

### 明確還沒做

- M4-1 的「User Provided 內容併入統一模型」：目前歌曲用獨立的 `songs` 表，內容用 `contents`；規格希望最終合一。
- M4-5 AI（需要 key）：校對輔助、個人化錯誤建議、生成 N3 段落。
- M3 剩餘：Azure TTS 批次（需要 key）、AI 分級文章（需要 key）、多人競速（Durable Objects，要另開規格）。
- 無提示加成（關閉羅馬字提示 ×1.1）：規格允許不做，待 owner 決定。分數公式是否加 Combo 係數：待 owner 決定（現在是 `kpm × accuracy²`）。
- 尚未在真實瀏覽器驗證過的互動（agent 只做了型別檢查與單元測試）：後台匯入（首次載入 17 MB 字典）、Line Editor、歌曲公開開關與套用共享時間軸、`/admin` 下架與 `/me` 通知、`/listen` 語音、YouTube 同步與對時工具。
- 正式站前：Google Fonts 目前用 `<link>` 載入（可改自架）；`user.plan` 欄位有預留但無付費功能。

## 5. 架構速覽

- `packages/engine`：羅馬字判定引擎（`tokenize` / `TypingSession` / `score` / `replay` / `analyze`），純 TS，覆蓋率門檻 90%。`\n` 是題目分隔符。
- `packages/data`：假名表 141 項、課程 30 課、N5 單字 100、短句 20、計時賽 pool、mode 字串（`lesson:` / `timed:` / `weak` / `content:`）。
- `apps/web`：SvelteKit 2 + Svelte 5 runes，Cloudflare Workers（D1 / KV / R2 / cron）。自訂 worker entry `src/worker/index.ts` 包住 SvelteKit 輸出加 `scheduled`；adapter 讀 `wrangler.adapter.jsonc`。
- 伺服器邏輯一律「純函式 + store 介面 + 假 store 單元測試」（`lib/server/runs`、`songs`、`contents`、`leaderboard`、`me`）。
- 後端重算分數不信前端；anticheat 六條規則；排行榜 KV 快取 60 秒；週一 00:00 台北 cron 快照 + 刪 90 天前 R2 keylog。
- 歌詞：只存使用者自己名下（可自選公開，需勾權利聲明），時間軸共享只存雜湊；通知取下流程在 `/copyright`、`/admin`，三次下架停權。**不要寫任何抓歌詞的程式**，理由與證據見 DECISIONS。

## 6. 已知的坑（大多是 Windows 上碰到的，換機器未必發生）

- `pnpm dev` 跑著時 `pnpm build` 會 EBUSY（Workers 模擬器抓著 `.svelte-kit/cloudflare`），先停 dev。
- 改 `wrangler.jsonc` / `.dev.vars` 或 `d1 migrations apply --local` 後，dev server 會出現 "poisoned stub"，重啟即可。
- drizzle-kit 重建 sqlite 表時會把 `sql\`DESC\`` 索引欄寫壞成 `` `"score" DESC` ``，手動改回 `` `score` DESC ``。
- pnpm 12 Windows 長路徑：`peersSuffixMaxLength: 40` 已設。
- adapter-cloudflare 會把 bundle 寫到它讀到的 wrangler config 的 `main`，所以 adapter 專用 `wrangler.adapter.jsonc`。
- `vite-plugin-static-copy` 在 Windows 會重建來源路徑，改用 `apps/web/scripts/copy-kuromoji-dict.mjs`；dev 另有 middleware 讓 `.gz` 原樣送出。

## 7. 用 agent 分工的作法（省額度）

給 Opus agent 的 prompt 固定包含：要讀的檔案、Node/pnpm 啟用方式、「不要 build / dev / 綁 port」、允許的驗證指令、檔案分區（避免兩個 agent 改同一檔）、訊息 key 前綴、在自己分支 commit 不 push。主 session 只做 review、合併（衝突通常只有 ROADMAP / DECISIONS / `messages/zh-TW.json` / `+layout.svelte`，兩邊都保留即可）、跑 `pnpm run ci`、build 與 `wrangler dev` 冒煙測試、push。

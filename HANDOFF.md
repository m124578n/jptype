# HANDOFF — 給下一個 Claude Code session（或任何接手的人）

最後更新：2026-09-11（M4-1c、M4-4 後台與分析事件、分數規則定案、M4-1d 歌詞貼漢字之後）。這份文件講「現在在哪、怎麼跑、還缺什麼」。規格在 `jp-typing-spec.md`，功能狀態在 `ROADMAP.md`，每個技術/產品決策與理由在 `DECISIONS.md`，工作約定在 `CLAUDE.md`。先讀這四份再動手。

## 1. 現況一句話

M0（引擎、假名表）、M1（課程 UI）、M2（登入、送分 API、排行榜、cron、/me）、M3 A/B/C（N5 單字與短句、瀏覽器 TTS 與聽打、歌詞打字）、M4-1（內容模型、後台匯入、Line Editor）、M4-1b（歌詞私有存 D1、時間軸共享、可選公開 + 通知取下、admin）、M4-1c（`songs` 表併入 `contents`，migration 0005）、M4-4 後台使用者與練習紀錄管理、M4-4 分析事件（migration 0006）都在 `main`，全部 push 到 https://github.com/m124578n/jptype 。**尚未部署**，也沒建任何 Cloudflare 資源。

## 2. 新機器起手式

```sh
# Node 22（.node-version 會讓 fnm/nvm 自動切）、pnpm 12
pnpm install                      # prepare 會：複製 kuromoji 字典到 apps/web/static/dict、編譯 Paraglide、svelte-kit sync
cp apps/web/.dev.vars.example apps/web/.dev.vars   # 填 BETTER_AUTH_SECRET（任意 32 bytes 隨機字串）；Google 憑證有就填
pnpm --filter web db:migrate:local                 # 套 0000–0007 到本機 D1（.wrangler/state）
pnpm dev                                           # http://localhost:5173（Vite + Cloudflare 綁定模擬）
pnpm run ci                                        # lint → typecheck → 資料驗證 → 測試（含覆蓋率門檻）→ build
pnpm build && pnpm preview                         # 用 wrangler dev 跑 build 出來的 worker（含 cron：/__scheduled?cron=0+16+*+*+0 需 --test-scheduled）
```

- 本機 D1 是空的：排行榜、內容列表、後台都沒資料。要看排行榜可以先在 D1 塞測試列（之前的作法見 git log `feat(web): leaderboard`）。
- 登入要 Google OAuth 憑證才跑得通；沒有時 `/login` 會回 500 `CLIENT_ID_AND_SECRET_REQUIRED`，其他頁面正常。**本機繞過**：`cd apps/web && node scripts/dev-login.mjs m23568n@gmail.com` 會在本機 D1 塞使用者與 session 並印出 `document.cookie = …`，貼到瀏覽器 console 就是登入狀態（用 `ADMIN_EMAILS` 的 e-mail 就是 admin）。這樣 `/admin`、`/admin/contents`、`/admin/users`、`/me`、我的內容（`/library`）存 D1 的流程都能在本機看。
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

### 2026-09-11 已合併（logo / SEO、中高階與實用內容）

- 站名定為「ぱちぱち」（app_name；title 仍是「日文打字練習」），logo 重做：鍵帽 + ぱ + 三道敲擊線，規範在 design-system/jptype/MASTER.md「Logo」。

- 首頁 title「日文打字練習」、其餘「段落 · 日文打字練習」；logo 是 teal 鍵帽上一個あ（`Logo.svelte`、`static/icon.svg`、favicon、manifest）；每頁 description / canonical / OG / Twitter（`lib/seo.ts`），`/admin` `/me` `/login` `/library` noindex，`/sitemap.xml`、robots.txt、首頁 JSON-LD。**沒有 PNG 版 og:image 與 apple-touch-icon**（需要字型渲染；owner 之後用任何工具把 `static/icon.svg` 匯出 512×512 與 1200×630 即可）。
- `@jptype/data` 新增 N4–N1 單字各 100、N4–N1 句子各 20、商用書信 30 句、網路用語 60；課程地圖多三組 10 課（共 40 課），計時賽多 `n4` `n3` `n2` `n1` `slang` 題庫（27 個榜）。內容是我寫的，**讀音、翻譯與網路用語的時效請 owner 抽查**。
- 點子池新增「跟 AI 打字聊天並評分」（owner）。

### 2026-09-11 已合併（M4-1e 使用者內容不限歌曲）

- `/songs` 改名 `/library`「我的內容」：類型任選、影片可選、文章自動斷句、可公開；`/contents` 公開列表合併平台與使用者內容（「來源」篩選、使用者內容連到 `/library/[id]`）；`/api/songs/public` 刪除。使用者內容不進榜。細節見 DECISIONS「M4-1e」。驗證：型別、353 測試、API 建純文字新聞內容 → 公開 → `/contents?source=user` 看得到。**瀏覽器未實測。**

### 2026-09-11 已合併（修正讀音）

- 練習頁歌詞條與對時頁每一行的「修正讀音」：逐 token 改假名（`ReadingEditor`、`lib/reading-edit.ts` 有測試），套用到同首歌相同句子，存回帳號或本機；同步模式改完從影片位置接著跑。見 DECISIONS「修正讀音」。**瀏覽器未實測。**

### 2026-09-11 已合併（逐字注音 + 對時掉漢字修正）

- `SongLine.tokens`（kuromoji 斷詞對應，讀音接起來 = text）：localStorage 與 `content_lines.metadata` 都存；`TypingArea` 新 prop `tokens` 用 `<ruby>` 逐字注音。對時頁（`song-timing.ts`）之前會把 `original` 丟掉，已修並加回歸測試。見 DECISIONS「逐字注音」。**瀏覽器未實測 ruby 排版**；owner 之前貼的假名歌沒有原文，要重貼一次才會有漢字。

### 2026-09-11 已合併（歌曲頁設計整理）

- owner：「歌詞字小一點」「UI/UX 跑一遍」。`/songs/[id]` 重排（owner 選上下排）：標題＋模式切換一列；影片與歌詞條合成同一張卡（歌詞條貼在影片下緣，前一句 → 假名縮小＋漢字 → 下一句 → 工具列），卡寬 = min(100%, (100vh − 17rem) × 16/9) 讓整張卡在畫面內；鍵盤在卡下方；公開設定移到最下面縮成一列。只動 markup 與 CSS，邏輯沒改。**瀏覽器未實測（375 / 768 / 1024 / 1440）。**

### 2026-09-11 已合併（同步模式：前奏／間奏、並排版面、漢字顯示）

- owner 實測回報三件事，都改了：倒數改用影片時間對第一句（超過 3 秒「前奏 · 下一句 N 秒後」，3 秒內 3-2-1），還沒唱到的句子按鍵不算（提前 0.5 秒）；寬螢幕影片與歌詞並排、窄螢幕影片限高；有漢字的句子假名在上、漢字在下。`SongSyncRun` 多 `position / pending / waitingFor`（有測試）；`/songs/[id]` 與 `/contents/[id]` 都改。見 DECISIONS「同步模式的前奏與間奏、版面、漢字顯示」。**瀏覽器未實測，請 owner 用同一首歌再試。**

### 2026-09-11 已合併（M4-1d 歌詞貼漢字 + 標點不擋）

- `/songs` 儲存時若有打不出來的字：瀏覽器端 kuromoji 轉假名 + 略過標點 → 「確認讀音」清單逐行可改 → 再存。`lib/songs-kana.ts`（純函式有測試）、`SongLine.original`（localStorage 與 `content_lines.original_text` 都存），練習頁與對時頁顯示原文。細節與沒做的事見 DECISIONS「M4-1d」。
- 驗證：單元測試（假 tokenizer）、型別、API 往返（`original` 進 D1 再讀回）；**瀏覽器裡實際載字典轉換沒有實測**，owner 用 `dev-login.mjs` 登入後貼一段漢字歌詞試一次即可。

### 2026-09-11 已合併（分數規則定案）

- owner 拍板：無提示加成不做、Combo 係數不加、公開歌曲不進榜、**Accuracy ≥ 90% 才進榜**（`runs.unranked_reason`，migration `0007_unranked_reason`；結果頁會明講）。理由在 DECISIONS「分數規則定案」。
- TTS 路線（Azure F0 vs. VOICEVOX）調查完成，**待 owner 決定**，見 DECISIONS「TTS 路線」。

### 2026-09-11 已合併（M4-4 分析事件）

- `content_events_daily`（migration `0006_content_events`，drizzle-kit CLI 直接產，純加表不會問）：view / start / complete 每日次數，不存人。`lib/server/events/`；`POST /api/events`（beacon）；`/contents/[id]` load 計 view、頁面第一個鍵計 start、`finish()` 計 complete；`/admin/contents` 多四欄（近 30 天）。見 DECISIONS「分析事件」。
- 驗證：單元測試、型別、在 dev server 上用假內容跑過（兩次瀏覽、兩次 start、一次 complete → 後台 50%），草稿 / 未知 id 404。

### 2026-09-11 已合併（M4-4 後台使用者管理）

- `/admin/users`（搜尋 + 彙總）與 `/admin/users/[id]`（最近 50 場：標記 / 取消標記、刪除；清除下架紀錄恢復公開權限 → 站內通知）。`lib/server/admin-users/`，純函式 + 假 store 測試。細節與邊界見 DECISIONS「M4-4 後台」。
- 驗證：型別、單元測試、build，並用 `scripts/dev-login.mjs` 造的 admin session 在 `wrangler dev` 上跑完整流程（真的打 D1）；瀏覽器畫面仍沒實測。

### 2026-09-11 已合併（M4-1c）

- `songs` 表刪除：一首歌 = `contents`（`owner_id`、`source_type = 'user_provided'`、status draft/published/removed）+ `content_lines`；對應在 `lib/server/songs/mapping.ts`，D1 store 在 `lib/server/songs/store.ts`。API 與 `/songs` 頁面介面沒變；檢舉 body 的 `songId` 改名 `contentId`（舊名仍收）。平台內容與使用者內容永遠分開列（`ContentFilter.owner`）。理由與細節見 DECISIONS「M4-1c」。
- migration `0005_unify_songs` 手寫（drizzle-kit 的改名提示需要 TTY）；snapshot 用 `apps/web/scripts/gen-migration.mjs` 產生。**本機記得 `pnpm --filter web db:migrate:local`**。
- 驗證：型別檢查、單元測試（新增 mapping 測試、contents 服務的 owner 隔離測試）、build、`wrangler dev` 上用假資料跑過 migration 與 `/api/songs*`、`/api/contents`、`/api/reports` 冒煙；瀏覽器互動一樣沒實測。

### 2026-09-10 已合併（M4-3 與 M4-2/4）

- M4-3：Combo / Max Combo（`runs.max_combo`，migration `0004_achievements`，伺服器從 log 重算）、錯誤分析（最常錯假名與拼法，結果頁前 5）、結果頁 Time / Errors、`/me` 今日與本週練習時間、30 天平均、五個成就（由既有資料推導，無新表）。
- M4-2 Review 模式（內容與歌曲只複習錯過的句子，紀錄在 localStorage `jptype:review`，不送伺服器）、`/contents` 最近練過與空狀態、首頁分類卡與「你的進度」、`/learn` 完成度與「繼續上次」。
- 這輪全部只做了型別檢查、單元測試、build 與路由冒煙；互動流程沒有在瀏覽器實測。

### 明確還沒做

- TTS 批次音檔的路線（Azure F0 或 VOICEVOX）與聲音偏好：待 owner 決定，見 DECISIONS「TTS 路線」；決定後寫 `scripts/tts-batch.ts` + R2 上傳 + 前端「有音檔就播，沒有就用瀏覽器語音」。
- M4-5 AI（需要 key）：校對輔助、個人化錯誤建議、生成 N3 段落。
- M3 剩餘：Azure TTS 批次（需要 key）、AI 分級文章（需要 key）、多人競速（Durable Objects，要另開規格）。
- 尚未在真實瀏覽器驗證過的互動（agent 只做了型別檢查與單元測試；現在有 `scripts/dev-login.mjs` 可以本機登入，owner 可自己點一輪）：`/admin/users` 兩頁、後台匯入（首次載入 17 MB 字典）、Line Editor、歌曲公開開關與套用共享時間軸、`/admin` 下架與 `/me` 通知、`/listen` 語音、YouTube 同步與對時工具。
- 正式站前：Google Fonts 目前用 `<link>` 載入（可改自架）；`user.plan` 欄位有預留但無付費功能。

## 5. 架構速覽

- `packages/engine`：羅馬字判定引擎（`tokenize` / `TypingSession` / `score` / `replay` / `analyze`），純 TS，覆蓋率門檻 90%。`\n` 是題目分隔符。
- `packages/data`：假名表 141 項、課程 40 課、N5 單字 100、短句 20、計時賽 pool、mode 字串（`lesson:` / `timed:` / `weak` / `content:`）。
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
- `pnpm build` 的 EBUSY 不一定是 dev server：preview 用的 `wrangler dev` 被砍掉後 workerd / esbuild 子程序可能還在（要 `taskkill /T` 整棵），而且鎖偶爾會殘留幾秒；手動 `Remove-Item -Recurse .svelte-kitcloudflare` 成功後再 build 就好。
- `pnpm exec wrangler d1 execute --command "<很長的多行 SQL>"` 在 Windows 會 `ERR_PNPM_CLI_EXEC_SPAWN`（命令列太長），改用 `--file`。
- drizzle-kit `generate` 遇到同一張表「刪一欄 + 加一欄」會問是不是改名，這個提示需要 TTY，在 Claude 的 shell 裡跑不了（`drizzle-kit/api` 也一樣）。這種 migration 就手寫 SQL，再用 `apps/web/scripts/gen-migration.mjs <NNNN_name>` 產 snapshot 與 journal（它只呼叫 `generateSQLiteDrizzleJson`，不 diff）。純加欄位的 migration 照舊 `pnpm --filter web db:generate`。
- `vite-plugin-static-copy` 在 Windows 會重建來源路徑，改用 `apps/web/scripts/copy-kuromoji-dict.mjs`；dev 另有 middleware 讓 `.gz` 原樣送出。

## 7. 用 agent 分工的作法（省額度）

給 Opus agent 的 prompt 固定包含：要讀的檔案、Node/pnpm 啟用方式、「不要 build / dev / 綁 port」、允許的驗證指令、檔案分區（避免兩個 agent 改同一檔）、訊息 key 前綴、在自己分支 commit 不 push。主 session 只做 review、合併（衝突通常只有 ROADMAP / DECISIONS / `messages/zh-TW.json` / `+layout.svelte`，兩邊都保留即可）、跑 `pnpm run ci`、build 與 `wrangler dev` 冒煙測試、push。

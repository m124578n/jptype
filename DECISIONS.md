# DECISIONS

規格 §13：不確定的產品/技術決策記在這裡。標 **[待確認]** 的需要 owner 回覆。

## 2026-09-10 基礎建設

### wrangler 設定放在 `apps/web/wrangler.jsonc`，不是根目錄 `wrangler.toml`

規格 §2/§3 寫根目錄 `wrangler.toml`。改放 `apps/web/` 並用 jsonc 的理由：
`sv create` 的 cloudflare 範本、`wrangler types --check`、`wrangler dev`、adapter-cloudflare 的 platform proxy 都以設定檔所在目錄為基準；jsonc 有 `$schema` 與註解。
綁定內容（DB / KV / R2 / vars）與規格 §3 一致。`compatibility_flags` 用 `nodejs_compat`（Better Auth、Drizzle 需要）。

### Cron trigger 先註解，M2 再開

adapter-cloudflare 產生的 `_worker.js` 只有 `fetch` handler。要跑 `scheduled` 需要自訂 worker entry 包住 SvelteKit 輸出（或用 SvelteKit 的 `+server` 搭配 Cloudflare 的 cron → HTTP 觸發）。M2 做排行榜結算時決定。**[待確認]** 兩種做法偏好？

### i18n 用 Paraglide（非 svelte-i18n）

規格允許二選一。Paraglide 編譯期產生訊息函式、tree-shake、不需 runtime 載入 JSON，適合 Workers。locale 用 `zh-TW`。

### 沒有 Python

規格全 TypeScript（`scripts/*.ts` 也是）。若之後批次腳本（TTS、AI 生成）改用 Python，以 `uv` 管理獨立的 `scripts/py/` 專案，不進 pnpm workspace。

### D1 / KV 綁定 ID 為占位值

尚未建立 Cloudflare 資源。`wrangler d1 create jptype`、`wrangler kv namespace create KV`、`wrangler r2 bucket create jptype` 後把真實 ID 填進 `apps/web/wrangler.jsonc`。占位值不影響本機 `wrangler dev` 與 `wrangler types`。

### Better Auth 表與 `runs.userId` FK 留到 M2

Better Auth CLI 產生 `user/session/account/verification` schema 時再加 FK，避免現在手寫後與產生結果衝突。

## 2026-09-10 M0

### `@jptype/engine` 依賴 `@jptype/data`（workspace）

規格 §1 寫「純 TS 零依賴」。引擎需要假名表才能 tokenize，選擇直接依賴 workspace 的 data package，而不是把表複製一份或用參數注入。「零依賴」解讀為零第三方 runtime 依賴；前後端共用時 data 本來就會一起打包。

### ん 的提示順序

規格 §6.3 只說「額外接受單獨 n」。實作上當 bare `n` 合法時把它放在拼法第一位（かんたん 提示 `n`），因為這是 IME 使用者的自然打法；不合法時提示 `nn`。**[待確認]** 若希望提示一律顯示 `nn`，改一行即可。

### っち 的 `tchi` 推廣到所有 ch- 開頭拼法

規格只寫 っち 另加 `tchi`。實作對任何拼法以 `ch` 開頭的下一 unit 都加 `t + 拼法`，所以 っちゃ 也接受 `tcha`、っちぇ 接受 `tche`，與 MS-IME 行為一致。

### ん 後接 ASCII / 符號

規格未定義。實作：下一 unit 為 ASCII 子音字母時允許 bare `n`（如 `んk`），數字、符號、空白、句尾一律不允許。

### `replay(text, log, durationMs?)` 多一個可選參數

規格簽名是 `replay(text, log)`。分數需要時長，預設用最後一個事件的 `t`（事件時間以 session 開始為 0）；後端可傳 request 的 `durationMs` 覆寫。計時賽文字可只打到一半，不視為 invalid；log 在文字打完後仍有按鍵才 invalid。

### 被忽略的按鍵（Shift、Backspace、多字元 key）

`press()` 回傳 `ok: true` 且不寫 log、不改狀態，UI 不會閃紅。`replay` 對這類 key 直接回 invalid，因為誠實的前端不會把它們放進 log。

## 2026-09-10 M1

### 設計系統來源

用 ui-ux-pro-max skill 產生初稿（`design-system/jptype/MASTER.md`），資料庫建議的字型（Baloo 2 / Comic Neue）與配色（教育 teal + amber）和規格 §10「不要遊戲化」衝突，改為 Noto Sans JP + 系統字、中性灰階 + 單一 teal 主色、錯誤紅只用在錯鍵。Google Fonts 以 `<link>` 載入（瀏覽器端，不違反「runtime 不呼叫外部 API」；若要完全自架可改 M2+）。

### 打字音效用 Web Audio 合成

owner 要求打字機「答答答」。不用音檔：帶通噪音 35 ms + 180 Hz 低音當擊鍵聲，錯鍵用 500 Hz 低頻悶響 70 ms，完成一課敲一聲鈴。AudioContext 在第一次按鍵才建立（符合瀏覽器自動播放政策）。預設開、音量 0.6、可關、存 localStorage。**[待確認]** 音色是否符合期待；若要更「機械」可調頻率/時長。

### 練習題 20 題、不連續重複

規格「隨機出 20 題，可重複」。實作允許重複但不連續出同一題（pool > 1 時），避免同一假名連打兩次的無聊感。「加強練習錯字」的題庫 = 錯字 ×3 + 其餘課程假名 ×1。

### 一課的計時與 KPM

`durationMs` = 第一鍵到最後一鍵；題與題之間的切換時間包含在內（沒有「讀題暫停」）。每題一個 `TypingSession`，log 合併後用 engine 的 `score()`。

### 課程頁預先渲染

`/learn/[lessonId]` 用 `prerender = true` + `entries` 列出 28 課，靜態 HTML 由 Workers Static Assets 直接服務；localStorage 讀取放在 `onMount`，SSR 與 hydration 一致。

### 片假名課程的 intro 卡片

卡片主字顯示片假名、副字顯示平假名（平假名課則相反）；資料仍是同一個 `KanaEntry`。

### ESLint svelte 規則採用

`svelte/no-navigation-without-resolve`：所有 `href` 走 `resolve()`（base path 安全）。`svelte/prefer-svelte-reactivity`：衍生值裡不用 `Set`，改陣列去重。

## 2026-09-10 點子：歌詞打字（M3）

owner 提議：貼 YouTube 網址 → 抓歌詞（字幕）→ 存歌詞與網址 → 選歌打字，逐步擴充曲庫。
技術上可行（YouTube 字幕軌、或第三方歌詞 API），但**著作權不因來源是 YouTube 而消失**：把歌詞存進 D1 再顯示給所有使用者打，等同重製與公開傳輸，原規格 §11 M3 也限定「僅公有領域 / 使用者自帶內容」。**[待確認]** 建議三選一或組合：

1. 使用者自帶：貼網址後由使用者自己貼歌詞，只存在該使用者的瀏覽器（localStorage / 自己帳號），不進共用曲庫。
2. 只收公有領域或 CC 授權曲目（童謠、民謠、校歌類），可進共用曲庫。
3. 只存網址與時間軸，不存歌詞文字；打字內容由使用者端即時從 YouTube 字幕取得、不經我們的伺服器（仍有灰色地帶，需再查 YouTube ToS）。

補充（owner 問「直接嵌入 YouTube 也不行嗎」）：**嵌入影片本身可以。** YouTube 官方 iframe 播放器就是給網站嵌入用的，權利由 YouTube 與權利人處理，我們只放播放器、不存影音。有疑慮的只有「歌詞文字」存在我們伺服器並對所有人顯示這一層。建議做法：嵌 YouTube 播放器 + 歌詞由使用者自己貼、只存在自己的瀏覽器或帳號（方案 1）；公有領域 / CC 曲目才進共用曲庫（方案 2）。M3 開規格時以此為基準。

## 2026-09-10 M2 ② 登入

### Better Auth 實例 per-request 建立

Workers 的綁定（D1、secrets）只在 request 時可得，所以 `getAuth(env, origin)` 在 hooks 裡以 env 物件 + origin 為 key 快取實例（WeakMap），不是模組頂層單例。`baseURL` 取自 request origin，本機、preview、正式站不用改設定。

### Auth schema 由 CLI 產生

`pnpm --filter web auth:schema` 用 `auth.cli.ts`（stub，不連 DB）跑 `@better-auth/cli generate` 輸出 `src/lib/server/db/auth-schema.ts`，不手寫。`user.plan` 以 `additionalFields` 預留（規格 §12）。CLI 帶進 `@prisma/client`、`better-sqlite3` 的 build script，已在 workspace 設定明確拒絕。

### drizzle-kit 重建 sqlite 表時把 `sql\`DESC\`` 索引寫壞

`0001_auth.sql` 由 drizzle-kit 產生後，`runs_lb` / `runs_user` 索引被輸出成 `` `"score" DESC` ``（整串當欄位名）。已手動修成 `` `score` DESC ``。之後任何會重建 `runs` 表的 migration 都要檢查這兩行。

### pnpm 12 在 Windows 的長路徑問題

`@better-auth/drizzle-adapter` 的 peer 後綴讓 virtual store 路徑超過 260 字元，junction 變成無效。`pnpm-workspace.yaml` 設 `peersSuffixMaxLength: 40` 把後綴改成短 hash。

### 端到端登入需要 owner 提供的東西 **[待確認]**

- Google Cloud Console → OAuth 2.0 Client（Web）：`GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`，Authorized redirect URI 加 `http://localhost:5180/api/auth/callback/google`（本機）與正式網域的 `/api/auth/callback/google`。
- LINE Developers → LINE Login channel：`LINE_CHANNEL_ID` / `LINE_CHANNEL_SECRET`，Callback URL 同樣加 `/api/auth/callback/line`，開啟 email 權限申請（可選）。
- 填進 `apps/web/.dev.vars`（本機，git 忽略）；正式站用 `wrangler secret put`（部署時再說）。
  沒有憑證時 `/login` 頁可開、`/api/auth/*` 端點正常、DB 寫入正常（verification 表有 state 記錄），按登入會回 500 `CLIENT_ID_AND_SECRET_REQUIRED`，屬預期。

## 2026-09-10 M2 ③ `POST /api/runs`

### 多題一場：`text` 用 `\n` 串起各題

引擎把 `\n` 當「題目分隔符」：不產生 unit、切斷 っ / ん 的上下文，保證 `tokenize(a + '\n' + b)` 等於分開 tokenize 再串接。前端仍是一題一個 `TypingSession`，送出時 `text = questions.join('\n')`，後端用同一份 log 重跑就完全一致。計時賽最後一題打到一半也照送（未完成 unit 不進 kana_stats）。

### 後端重算用 `analyze()` 而不是 `replay()`

`analyze` = `replay` + 每個 unit 首次是否打對（§9.7 kana_stats 需要）。`replay` 保留給只要分數的場合。

### 送分流程拆成純函式 + Store 介面

`submitRun(userId, body, deps)` 不碰 D1 / R2 / KV，透過 `RunStore`、`putLog`、`invalidateLeaderboard` 注入，單元測試用假物件覆蓋六條 anticheat 與各種拒絕情境；`d1RunStore` 是 Drizzle 實作。

### KV 失效條件

規格 §9.8「分數 ≥ 該榜第 100 名才刪」：查該 mode 本週各使用者最佳分的第 100 名（`GROUP BY userId ORDER BY best DESC LIMIT 1 OFFSET 99`），沒有 100 人時一律刪。同時刪週榜與總榜兩個 key。

### 匿名者也送分

規格 §8：未登入可 POST 取得分數但不入榜、不寫 kana_stats。前端課程與計時賽結束都會送；失敗時 UI 保留本機分數，不阻塞。

### Turnstile

伺服器只在「已登入」且 `TURNSTILE_SECRET_KEY` 有設時要求 token；前端用隱形 widget（`getTurnstileToken`）在送出前取 token，site key 由 layout 傳入。本機 `.dev.vars.example` 放的是 Cloudflare 測試 secret（永遠通過）。**[待確認]** 正式站要建 Turnstile widget 拿 site key / secret（部署時再說）。

### 名次

回應的 `rank` = 本週該 mode 中「最佳分 > 此分」的使用者數 + 1，只給未 flagged 的登入者；被 flag 的人拿到分數但沒有名次，不透露原因。

## 2026-09-10 M2 ④ 排行榜

### 只有計時賽進榜

`/leaderboard` 與首頁前 5 只列 `timed:*` 模式（3 pool × 3 秒數 = 9 個榜）。課程模式的成績仍存 D1（給 `/me` 用），但 `/leaderboard?mode=lesson:*` 回 404。

### 排行榜查詢

規格 §4 的 SQL：每人取最佳分，`ORDER BY best DESC, accuracy DESC LIMIT 100`，join `user` 拿名稱與頭像。SQLite 的 bare-column 規則保證 `kpm` / `accuracy` 來自 `max(score)` 那一列。被 flag 的場次不進榜、不算自己名次。

### KV 快取

key `lb:{mode}:{week|all}`，TTL 60 秒，內容含 `computedAt`。`POST /api/runs` 在分數可能進前 100 時刪 key。自己的名次不快取：在前 100 內直接讀清單，否則另外 COUNT。

### 頁面走 server load，不走 API

`/leaderboard` 與首頁在 `+page.server.ts` 直接呼叫 `getLeaderboard`（同一份 KV 快取），省一次 HTTP；`/api/leaderboard` 留給之後的客戶端刷新或外部使用。

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

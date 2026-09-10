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

`/learn/[lessonId]` 用 `prerender = true` + `entries` 列出所有課程（M1 為 28 課，M3 A 後 30 課），靜態 HTML 由 Workers Static Assets 直接服務；localStorage 讀取放在 `onMount`，SSR 與 hydration 一致。

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

## 2026-09-10 M2 ⑤ Cron

### 自訂 worker entry

`wrangler.jsonc` 的 `main` 改為 `src/worker/index.ts`：import build 出來的 `.svelte-kit/cloudflare/_worker.js`（只有 `fetch`），再加上 `scheduled`。`assets.directory` 不變，`.assetsignore` 已排除 `_worker.js`。**必須先 `pnpm build` 再 `wrangler dev` / `deploy`**（`pnpm preview` 已改成 `wrangler dev`）。這解掉先前 DECISIONS 的 [待確認]，不需要 cron → HTTP 的繞路。

### 週榜快照存 KV，不另開 D1 表

`lbsnap:{mode}:{week}` 無 TTL，內容格式同 `/api/leaderboard` 的回應。之後要做「歷史週榜」頁直接讀這些 key；規格沒定義快照表，先不加 schema。

### R2 keylog 90 天清理

列 `runs/` 前綴、以 `uploaded` 判斷、每頁最多 500、批次刪除。D1 的 `runs` 列保留（只有原始按鍵序列刪掉）。

### 本機測 cron

`wrangler dev --test-scheduled` 後 `GET /__scheduled?cron=0+16+*+*+0`。

## 2026-09-10 M2 ⑥ `/me` 與弱項練習

### 新增 `weak` 模式字串

弱項練習的題庫跨所有假名，不屬於任何課程，所以 `POST /api/runs` 多接受 `mode = "weak"`（pool = 全部假名）。不進排行榜（只有 `timed:*` 上榜），但登入者的 kana_stats 會更新。

### 課程頁流程抽成 `LessonFlow` 元件

`/learn/[lessonId]` 與 `/learn/weak` 共用同一套「認識 → 練習 → 結果」；弱項練習用合成的 `Lesson`（intro = 弱項假名卡片、units = 弱項 + 隨機補足到 20）。

### 熱圖的歸戶

kana_stats 的 key 是實際打的 unit（可能是片假名、可能帶 っ 前綴如 `っか`）。熱圖顯示時折算到平假名基底（`ッチ` → `ち`），拗音獨立一格；促音本身不單獨計。

### 連續天數

以台北日期計；今天還沒練不算中斷（連到昨天為止）。近 400 天的場次時間拉回計算，不另存 streak 欄位。

### 未登入的 `/me`

仍可看：用 localStorage 的 kana_stats / results 顯示熱圖與弱項，並提示登入後同步。歷史場次表只有登入者有。

### 補充：adapter-cloudflare 會把 bundle 寫到 wrangler config 的 `main`

`@sveltejs/adapter-cloudflare` 讀到 `main` 就把輸出寫到那個路徑，先前把 `main` 指向 `src/worker/index.ts` 時，`pnpm build` 直接覆蓋了原始碼（commit `da53142` 內的 entry 其實是被覆蓋後的 bundle，沒有 `scheduled`）。修正：adapter 改讀 `wrangler.adapter.jsonc`（`main` = `.svelte-kit/cloudflare/_worker.js`），真正的 `wrangler.jsonc` 保持 `main` = `src/worker/index.ts`；dev 綁定仍由 `platformProxy.configPath: wrangler.jsonc` 提供。兩個檔的 `assets` 必須一致。

## 2026-09-10 M3 B — TTS 與聽打模式

### 發音用瀏覽器 Web Speech API，不用音檔、不用 Azure

規格 §1 明訂「網站 runtime 不呼叫任何外部 AI/TTS API」，而預先用 Azure Speech 批次產生 141 個假名的 mp3 再放 R2，需要金鑰、批次腳本與額外流量，第一版不值得。改用瀏覽器內建的 `speechSynthesis`（`apps/web/src/lib/speech.ts`）：挑一個本機 `ja-JP` 語音直接念，**零網路請求、零 assets**，Worker 完全沒參與。Azure 批次管線延後（要念單字 / 短句，或要保證每台裝置聽起來一樣時再做）。

代價：語音品質與是否存在都看使用者的系統。沒有日文語音時 `speak()` 回 `false`，認識頁的播放鈕直接隱藏（`speechAvailable()` 在 `onMount` 判斷，避免 SSR 與首次 client render 不一致），`/listen` 顯示說明並導回 `/learn`。

### `getVoices()` 的 Chrome 時序

Chrome 第一次呼叫 `getVoices()` 會回空陣列，語音載入完才發 `voiceschanged`。`loadVoices()` 因此在空陣列時等這個事件，最多 1 秒後放棄。單元測試用假的 `window.speechSynthesis` / `SpeechSynthesisUtterance`（vitest 跑在 node）驗證選聲、cancel 順序與這段等待；**實際有沒有聲音只能在瀏覽器手動驗**。

### 聽打模式的出題與揭曉規則

`/listen` 重用計時賽的 `TIMED_POOLS`（平假名全 / 片假名全 / 全部）與 `PracticeRun`，但固定 20 題、不計時。題目不顯示假名（只顯示 ● 遮罩），進題自動念一次，「再聽一次」按鈕或 `Tab` 可重播（`Shift+Tab` 保留給焦點移動，頁面仍可用鍵盤操作）。答對該 unit、或**連續錯兩鍵**時，才把假名以 muted 短暫顯示 1.4 秒；連錯兩鍵同時打開羅馬字提示與螢幕鍵盤的下一鍵高亮，讓人能繼續。

### 聽打成績不送後端

`POST /api/runs` 的 `parseMode()` 只認得 `timed:*` / `lesson:*` / `weak`，沒有 listening 模式，後端也無從重算「聽到什麼」。所以聽打只寫 localStorage：`recordResult('listen:{pool}', result)` + `recordKanaStats()`（弱項統計照樣受惠），不進排行榜。要送分得先在 `packages/data` 定義 mode 字串並補後端驗證。

## 2026-09-10 M3 C 歌詞打字

### 歌詞只存本機 localStorage，伺服器完全不碰

採用先前「歌詞打字」決策的方案 1：歌詞由使用者自己貼上，存在 `jptype:songs`（`apps/web/src/lib/songs.ts`，防禦式讀寫同 `storage.ts`），只留在那一台瀏覽器。後端沒有任何歌詞相關的 API、schema 或 migration；`POST /api/runs` 也不送（歌詞文字不得離開瀏覽器），成績只寫 localStorage 的 `recordResult('song:' + id, result)`，因此歌詞模式不進排行榜。專案任何地方（程式碼、測試、fixture、文件）都不放真實歌曲的歌詞，測試一律用自創的假名字串。

### 影片用官方 `youtube-nocookie` iframe 嵌入

`/songs/[id]` 上方放 `https://www.youtube-nocookie.com/embed/<id>`（16:9 responsive、有 `title`、`allow="encrypted-media; picture-in-picture"`）。我們只存 11 碼影片 ID，不存影音、不抓字幕。`parseYoutubeId` 接受 watch / youtu.be / shorts / embed / live 網址與裸 ID，其他（含非 YouTube 網域、`javascript:`）一律拒絕。

### 只收打得出來的假名，漢字請使用者換成讀音

`validateLines` 用跟 tokenizer 同樣的最長匹配檢查每行：假名表（`findKana`，1–2 字切片）、`SYMBOLS`（ー、。？！）、空白、可見 ASCII 以外的字元都回報「第幾行、哪個字」，儲存前擋下來。漢字刻意不支援（規格 §1 不做 IME 變換），UI 提示使用者貼平假名／片假名讀音。`parseLyrics` 一行一題：全形空白轉半形、trim、丟掉空行。

### `PracticeRun` 多一個 `sequence` 選項

歌詞要照順序打，不是隨機抽題，所以 `RunOptions` 加 `sequence?: readonly string[]`：直接使用給定題目（允許相鄰重複），優先於 `count` / `endless`，pool 不使用。原有課程（`count`）與計時賽（`endless`）行為與測試不變。

## 2026-09-10 M3 A 單字與短句

### 單字/短句放 `.ts` 而不是 `words-n5.json`

規格 §7.1 寫 `words-n5.json`。改成 `packages/data/src/words-n5.ts` / `sentences.ts`：package 以 TS 原始碼被消費（無 build step），寫成 TS 才有型別（`WordEntry` / `SentenceEntry`）與註解，也免掉 `resolveJsonModule` 的 readonly 轉型。內容完全自寫（單字為不受著作權保護的基礎詞彙，短句為原創）。

### `Lesson` 多一個 `hints`

`intro` 維持 `KanaEntry[]`，單字/短句課的 `intro` 是空陣列（認識頁自動略過卡片）。題目的漢字與中文改放 `hints?: Record<string, { kanji?: string; zh: string }>`（key = 出題的 kana），由 `TypingArea` 在假名上方以小字顯示；計時賽 `n5` pool 也用同一份 map。

### 計時賽 pool `n5` 也進排行榜

`TIMED_POOL_IDS` 加入 `n5` 後，排行榜與週一 cron 快照從 9 個榜變成 12 個（3 pool × 3 秒數 → 4 × 3）。`TIMED_POOLS.all` 維持「全部假名」，不含單字。

## 2026-09-10 歌詞打字：owner 要求「貼 YT 網址自動爬歌詞」的查證結果

owner 質疑「導流 YouTube 並附上歌詞」是否真的不行，要求明確證據。查證後結論不變：**嵌入 YouTube 播放器合法；自動抓取並存放、顯示歌詞需要授權，沒有授權就是侵權**。證據：

1. **JASRAC（日本歌曲的權利集中管理）**：網站刊登歌詞屬「公眾送信」，須事先取得 JASRAC 許諾並付費（最低月額 5,000 円），個人或非營利網站也不例外。來源：JASRAC「歌詞・楽譜の配信」、「インターネット上での音楽利用」、骨董通り法律事務所專欄（引用只在明瞭區別、主從關係、註明出處且比例合理時成立，京都大學式辭案約 8% 篇幅；整首刊登不符合）。
2. **台灣智慧財產局**：歌詞是語文著作；在網路上使用他人著作除了重製權還要另外取得公開傳輸的授權。
3. **台灣最大歌詞站「魔鏡歌詞網」能經營 19 年，是因為 2008 年取得台北市音樂著作權代理人協會授權、並向 MÜST 洽談授權**——也就是「歌詞站可以刊登」的前提是它有付費授權，不是歌詞本身沒有著作權。
4. **Spotify / Apple Music 顯示歌詞是向出版商買授權**（透過 Musixmatch / LyricFind），業界沒有「歌詞免費可用」這回事。
5. **marumaru-x.com**：頁面只有「© MARUMARU All Rights Reserved」，看不到任何歌詞授權聲明；它是否有授權無從得知，且就算它有，授權也不會延伸到第三方抓取再散布。
6. **YouTube 嵌入合法**：YouTube 服務條款授予嵌入的再授權（美國 Richardson v. Townsquare Media 判決），只要上傳者允許嵌入。

因此 `/songs` 維持：嵌官方播放器 + 歌詞由使用者自行貼入、只存本機。可再做的合法強化：貼網址自動帶標題（YouTube oEmbed 官方介面）、一鍵開歌詞站搜尋、瀏覽器端漢字→假名轉換。**[待確認]** owner 是否接受此結論。

## 2026-09-10 歌詞打字：「唱到哪打到哪」的可行路線 **[待確認]**

owner 指出：使用者自貼歌詞、還要自己標時間，UX 太差；要做 sing-along 就需要帶時間軸的歌詞。查證後的三條路：

- **A. 授權歌詞 API（含時間軸）**：Musixmatch 開發者 API 免費層只給 30% 歌詞、無同步；完整與同步歌詞要商用授權方案（價格不公開，需洽談）。日本曲目在 Musixmatch 體系由 PetitLyrics 供應、與 JASRAC 協作。這是唯一能做到「貼 YT 網址 → 自動配對 → 帶時間軸歌詞 → 唱到哪打到哪」且合法的路，代價是授權費與商務洽談。
- **B. 公有領域曲庫**：作詞者過世逾 70 年的童謠 / 唱歌 / 民謠，自己標一次時間軸放共用曲庫。免費合法、可 sing-along，曲目偏老。
- **C. 使用者自貼 + 對時工具**：貼歌詞後隨播放器「拍一下」標每行開始時間，本機產生 LRC。合法免費、UX 有摩擦，適合當 A 之前的過渡或補 A 沒收錄的歌。

建議：先做 sing-along 播放器引擎（時間軸資料模型、YouTube IFrame API 同步、逐行打字），歌詞來源做成可插拔；用 B + C 的內容上線，A 由 owner 決定預算後接上。

## 2026-09-10 採納 GPT PRD 的部分內容為 M4

owner 提供一份與 GPT 討論的 PRD（內容平台：歌曲 / 動畫 / 新聞 / JLPT / 小說 / 自由輸入，統一 Content + Line 模型，YouTube 同步，Combo，後台與 Line Editor）。採納與否：

**採納**（寫入 ROADMAP M4）：統一 Content / Line 模型與必填權利 metadata、Manual Import 管線（漢字→假名在瀏覽器端）、YouTube IFrame API 同步與暫停 / Seek 行為、Sync / Typing / Review 三模式、Combo 與錯誤分析、每內容排行榜（Accuracy ≥ 90% 才有效）、內容探索篩選、Admin 與 Line Editor、成就、分析漏斗、AI 只用自有內容。PRD §30 / §31 / §54 明確反對自動抓取歌詞，與本專案既有結論一致。

**不採納**：技術棧（Next.js / Prisma / PostgreSQL / Auth.js）— 現有 SvelteKit + Cloudflare + Better Auth 已完成 M0–M3，不重來；Email 登入（規格 §1 只有 Google / LINE）；「錯誤仍可繼續輸入」— 現行引擎是錯鍵不推進、只計入 accuracy，這是規格 §6.4 的硬性決策，M4 沿用；WPM — 日文用 KPM / CPM。

**待確認**：分數公式是否加入 Combo 係數；Admin 角色如何指定（先用 `user.role` 欄位 + 手動設定）。

## 2026-09-10 歌詞打字同步模式：owner 拍板

owner 決定（此條取代上一條「唱到哪打到哪」的 **[待確認]**，走路線 C）：

**歌曲 = 官方 YouTube 嵌入；歌詞 = 使用者自己找、自己貼；時間軸 = 使用者自己在 App 裡打點。** 三件事都不經伺服器。

### 不推薦、不連結、不特別支援任何歌詞來源

歌詞從哪裡來由使用者決定。程式碼、訊息、測試、文件都不提任何特定歌詞網站，也不會對某個站做 DOM 解析或格式特判。`/songs` 只提供兩個中性的外連（`target="_blank" rel="external noopener noreferrer"`，都只是開新分頁）：

- 「搜尋歌詞」→ `https://www.google.com/search?q=<歌名> 歌詞 ひらがな`（`lyricsSearchUrl()`）
- 「在 YouTube 開啟」→ 該影片的 watch 頁（官方 MV 的說明欄常常就有歌詞）

App 端**不會 fetch 任何歌詞網站**（先前決策的著作權結論不變：嵌播放器可以，自動抓取／存放歌詞不行）。使用者複製什麼、貼什麼，全部只留在他自己的瀏覽器。

### `Song.lines` 改成 `{ text: string; start?: number }`

`start` 是影片內的秒數，有時間的行才進得了同步模式。舊版存成 `string[]` 的歌在 `loadSongs()` 讀取時自動遷移（`toLine`），不需要 migration 也不會掉資料。`hasSync(song)` = 至少兩行有 `start`。`validateLines` 改吃 `SongLine[]`、檢查 `text`，行為不變。

### `parseLyrics` 吃 LRC，但不假設一定拿得到 LRC

支援：`[mm:ss.xx]` / `[mm:ss]` / 舊式 `[mm:ss:xx]`（括號內第三段一律當秒的小數，這是 LRC 的定義）、一行多個時間標籤（該行文字複製到每個時間）、裸前綴 `mm:ss` / `hh:mm:ss`（括號外第三段才是時分秒）、metadata 標籤 `[ti:…]` `[ar:…]` `[offset:…]`（丟掉）、enhanced LRC 的逐字 `<mm:ss.xx>`（去掉）、BOM、全形空白、空行。**全部行都有時間**時依時間排序（多標籤的 LRC 才會照播放順序出來）；只有部分行有時間就維持貼上的順序。

### 對時工具 `/songs/[id]/timing`（tap-to-sync）

因為沒有任何來源保證附時間軸，時間軸就在 App 裡自己做：播放器一直放，使用者對到哪一句就按一次 Space / Enter /「標記這句」，把 `currentTime()` 寫進那一句的 `start` 並跳下一句；每句有 ±0.5 秒微調、「從這句重播」（seek + play）、Backspace 回上一句重打、「全部重來」。純函式放 `lib/song-timing.ts`（`stampLine` / `nudgeLine` / `clearLineTiming` / `clearAllTimings` / `timedCount` / `firstUntimedIndex` / `formatTime`，秒數 clamp 到 0、四捨五入到百分之一秒），元件只負責事件，所以邏輯可以無 DOM 單元測試。貼上的歌詞本來就帶 LRC 時間也沒關係，打點會覆蓋。

### 同步模式不用 `PracticeRun`，自己一個 controller

`PracticeRun` 是「打完才換題」，同步模式是「歌換句就換題」，兩者相反，所以另開 `lib/practice/song-sync.svelte.ts` 的 `SongSyncRun`（runes class）：每行一個 `TypingSession`，`timeUpdate(seconds)` 用「最後一個 `start <= t` 的行」決定目前句；換句時沒打完的行計入 `skippedLines`（結果頁顯示），打完的行顯示 ✓ 等下一句；`seek(seconds)` 重新定位並重開該行的 session（連同清空 buffer、把該行的 skipped 標記還原）；影片 ended 或打完最後一句就結算。時間來源是播放器每 100 ms 的回報，兩次回報差超過 1.5 秒就當成 seek。沒有 `start` 的行不進同步模式（同步模式的每一題都要有時間才排得上去）。

`text` / `log` / `durationMs` / `wrongUnits` / `unitOutcomes` / `result()` 與 `PracticeRun` 同形，但**不保證能過 `replay()`**（跳過與重打的行會讓 text 與 log 對不上）。這沒關係：歌詞成績只寫 `recordResult('song:' + id, result)`，永遠不送後端。`TypingArea` 的 prop 型別因此抽成 `TypingRun` 介面，兩個 run 都實作它。

### `YouTubePlayer.svelte` 與 IFrame API

`https://www.youtube.com/iframe_api` 只載入一次（`lib/youtube.ts` 的 `loadIframeApi()`，串接而不是覆寫 `onYouTubeIframeAPIReady`，失敗會 reject 讓 UI 顯示 fallback），播放器本身仍指向 `host: 'https://www.youtube-nocookie.com'`。對外只有 callback props（`onready` 帶 `getVideoData().title` 與 duration、`onstate`、`ontime` 每 100 ms）與 `bind:controller`（`play` / `pause` / `seekTo` / `currentTime`）。型別放 `lib/youtube-iframe.d.ts`（沒有裝 `@types/youtube`）。SSR 不會跑 `$effect`，`loadIframeApi()` 也會在沒有 `window` 時直接 reject。加歌表單貼好網址就掛一個暫停的播放器，用它拿到的標題預填歌名（使用者改過就不再覆寫）。

### 模式與快捷鍵

`/songs/[id]` 上方兩顆按鈕切「同步模式」／「自由模式」，選擇記在 `jptype:songMode`（沒有時間軸的歌只給自由模式）。同步模式：Space（或「開始」）→ 倒數 3-2-1-START → `play()`；之後 Space 是播放／暫停（除非目前 unit 就是要打空白）、Esc 回 `/songs`、Ctrl+R 重來；播放器暫停時不吃打字鍵。自由模式維持原本的逐行打法，播放器可有可無。

## 2026-09-10 歌曲功能定案（owner）：歌詞私有、時間軸共享、可選公開

1. **歌曲 = YouTube 官方嵌入；歌詞 = 使用者自行取得後貼入，不指定、不連結任何歌詞網站**（只提供以標題開 Google 搜尋、開 YouTube 頁面兩個中性連結）。時間軸沒有現成來源，由 app 內建對時工具（`/songs/[id]/timing`）讓使用者自己標。
2. **歌詞存 D1，預設私有**：只有本人可讀寫，跨裝置同步；性質為個人重製，服務條款載明使用者對自行上傳內容負責。
3. **時間軸共享**：`song_timings` 只存影片 ID、行數、每行 SHA-256 雜湊、start 陣列、建立者、套用次數，不存文字；貼歌詞後雜湊一致才提示套用。
4. **使用者可選擇公開自己的歌詞**（owner 接受並承擔通知取下義務）：公開需勾選權利聲明並記錄同意時間。依著作權法第 90 條之 4～90 條之 12 落實免責條件：`/copyright` 政策頁 + 聯絡信箱（`PUBLIC_CONTACT_EMAIL` var，目前 m23568n@gmail.com）、檢舉表單存 `takedown_requests`、admin 一鍵下架（`status = removed`）並通知上傳者、累計三次下架停權（不得再公開）、所有處理留紀錄。平台不主動精選或推薦公開歌詞（避免被視為平台自身的公開傳輸）。
5. **Admin 判定**：`ADMIN_EMAILS` var（逗號分隔，目前只有 m23568n@gmail.com）比對登入者 email；所有 `/admin` 與 `/api/admin/*` 伺服器端檢查。
6. **登入只留 Google**：LINE 短中期不做（2026-09-10 移除 provider、按鈕、環境變數）。admin 因此一定有 email 可比對。
7. 附帶：公開歌的歌詞在伺服器上，之後可做歌曲排行榜（後端可重算）；私有歌成績只存個人紀錄。

## 2026-09-10 M4-1b 實作：歌詞進 D1、時間軸共享、可選公開與 admin

上一條「歌曲功能定案」的實作。migration `0002_songs` 只新增表，沒有動 `runs` / `kana_stats`，所以不會踩到 drizzle-kit 重建 sqlite 表時產生壞索引欄位的 bug。

### 五張新表

- **`songs`**：`id`(ulid)、`ownerId`→`user.id`(cascade)、`videoId`(11 碼)、`title`、`lines`（JSON `{text,start?}[]`）、`visibility`（`private`｜`public`，預設 private）、`publicConsentAt`、`status`（`active`｜`removed`）、`removedReason`、`createdAt`、`updatedAt`；索引 `(ownerId, updatedAt DESC)` 與 `(visibility, status, updatedAt DESC)`。
- **`song_timings`**：`videoId`、`lineCount`、`lineHashes`（JSON，每行文字的 hex SHA-256）、`starts`（JSON number[]）、`createdBy`（set null）、`useCount`；索引 `videoId`。**沒有任何欄位存歌詞文字。**
- **`takedown_requests`**：`songId`（set null，歌被刪掉仍留紀錄）、`videoId`、`reporterContact`、`claim`、`status`（`open`｜`removed`｜`rejected`）、`adminNote`、`createdAt`、`resolvedAt`。
- **`user_strikes`**：`userId` PK、`strikes`、`suspendedAt`。
- **`notices`**：站內通知（`song_removed` / `suspended`）。Worker 不對外發信，通知只在 `/me` 顯示；`message` 只放資料（歌名、admin 寫的原因），句子本身走 Paraglide。

### 雜湊在哪裡算

`lib/song-hash.ts` 是同構模組（`crypto.subtle.digest('SHA-256')` 在 Worker、瀏覽器、Node 都有）：伺服器用它擋 `POST /api/timings` 的重複，瀏覽器在「貼完歌詞」時用它比對 `GET /api/timings?videoId=` 拿回來的候選。`matchTiming` 要求行數與每一行雜湊全等才算命中（多筆命中時取 `useCount` 高者、再取新者）。所以「找有沒有現成時間軸」這件事**完全不會把歌詞送出去**。

### 三振規則

一次下架（檢舉處理或 admin 直接下架）＝ `songs.status='removed'` ＋ `removedReason` ＋ `visibility` 改回 private ＋ 該 owner `strikes+1` ＋ 一筆 `song_removed` 通知。第三次時寫入 `suspendedAt`、把該 owner **所有** public 歌改回 private、再加一筆 `suspended` 通知；之後 `setVisibility(…, 'public')` 一律 403。第四次以後只累加次數，不重複發停權通知。

### 誰在 client、誰在 server

- **server**：`lib/server/songs/{store,service,route}.ts`。`store.ts` 是介面 + D1 實作，`service.ts` 是純函式（`SongDeps = { store, now?, newId? }`），單元測試用 fake store，跟 `runs/submit.ts` 同一套；`route.ts` 只做 bindings→deps、session→userId、JSON→驗證、`Result`→回應。權限全在 service：非本人的私有歌一律 404（不透露存在）、公開要 `consent:true`、停權擋公開、已下架不能再公開。
- **client**：`lib/songs-api.ts` 是唯一的 fetch 層，並提供 `loadLibrary` / `loadOne` / `saveEntryLines` / `removeEntry` / `importLocalSongs` 門面 —— 登入走 D1、未登入走 localStorage，頁面只看 `LibraryEntry.remote`。`lib/songs.ts` 仍是未登入者的儲存，以及共用的 `parseLyrics` / `validateLines` / `parseYoutubeId`。
- 公開歌任何人（含未登入）都能練；只有 owner 能編輯與對時。首次登入時 `/songs` 會提示把本機歌單一鍵搬到帳號（搬成功的才刪本機那份）。

### Admin

`ADMIN_EMAILS`、`PUBLIC_CONTACT_EMAIL` 放在 `wrangler.jsonc` 的 vars（`wrangler types` 會產生到 `Env`，不需要手動加進 `app.d.ts`）。`lib/server/admin.ts` 的 `isAdmin(user, env)` 做小寫比對。`+layout.server.ts` 只吐一個 `isAdmin` boolean 給 nav 用；`/admin` 的 load 與每一支 `/api/admin/*` 都各自再檢查一次。

## 2026-09-10 M4-1 實作：統一內容模型、瀏覽器端匯入管線、Line Editor

ROADMAP M4-1 / M4-4 Line Editor / M4-3 每內容排行榜的實作。migration `0003_contents` **只新增兩張表**（`contents`、`content_lines`），沒有動 `runs` / `kana_stats` / `songs`，所以不會踩到 drizzle-kit 重建 sqlite 表時寫壞 `` `score` DESC `` 索引的 bug。

### 兩張新表

- **`contents`**：`id`(ulid)、`type`（song｜anime｜news｜novel｜jlpt｜free）、`title`、`description`、`videoId`（可為 null，11 碼 YouTube id）、`jlptLevel`（N5…N1｜unknown）、`difficulty`（easy｜normal｜hard｜expert）、`status`（draft｜published，預設 draft）、權利欄位 `sourceType`（original｜licensed｜public_domain｜user_provided｜other）/ `sourceUrl` / `sourceName` / `license` / `rightsStatus`（cleared｜unknown）、`createdBy`→`user.id`(set null)、`createdAt`、`updatedAt`；索引 `(status, type, updatedAt DESC)`、`(status, jlptLevel)`。
- **`content_lines`**：`id`、`contentId`→`contents.id`(cascade)、`order`、`startTime` / `endTime`（秒，real，可為 null）、`originalText`、`kanaText`、`romajiText`、`metadata`（JSON，可為 null）；`unique(contentId, order)`。

平台本身**不附任何內容**（一行台詞、新聞、歌詞都沒有），全部由 admin 匯入；測試用的日文短句是自己寫的。

### 發布規則

`setContentStatus(id, 'published')` 只有在 `rightsStatus === 'cleared'` **且**至少一句 `kanaText` 打得出來（用 `validateLines` 的同一套判斷：假名 / `SYMBOLS` / 空白 / ASCII，漢字不算）時才成功，否則回 409 `rights not cleared` / `no typeable line`，admin 頁把這兩個字串翻成中文顯示。下架不檢查。已發布的內容若被改成「全部都打不出來」，`setContentLines` 會自動把它退回 draft。草稿對外是 404（不透露存在），也拿不到排行榜。

### 漢字→假名在瀏覽器，字典由自己的網域提供

規格 §1「runtime 不呼叫任何外部 AI/TTS API」，所以讀音分析不走服務，改成 admin 的瀏覽器跑 kuromoji（MeCab IPADIC）。

- 字典（12 個 `.dat.gz`，約 17 MB）**不進 git**：`vite-plugin-static-copy` 在 dev / client build 時從 `node_modules/kuromoji/dict/*.dat.gz` 複製到 `dict/kuromoji/`，線上就是 Workers 的 static assets，路徑 `/dict/kuromoji`（`lib/ja/kana.ts` 的 `DICT_PATH`）。`.gz` 必須原樣送出（loader 自己 gunzip），不要另外加 `Content-Encoding`。
- 匯入時載入的是 `kuromoji/build/kuromoji.js`（browserify 的 UMD bundle），不是 package 的 `main`：`src/` 進入點 `require('path')`，Vite 不會幫 node 內建模組做 polyfill。只在按下「斷句並轉假名」時動態 import，載一次就快取（失敗會清掉 cache 讓使用者重試）；`optimizeDeps.include` 先 pre-bundle，避免 dev 在匯入途中重新優化並重載頁面。
- `toKana(text, tokenizer?)` 可注入 tokenizer，所以單元測試用假 token 覆蓋「reading（片假名）→ 平假名」那一步，不必載字典。**surface 本身就打得出來時保留 surface**（`は` 不會變成讀音 `ワ`、`ハート` 保持片假名）；查不到讀音的未知詞也保留 surface，讓 admin 看見還要修哪裡。

### 斷句與羅馬字

- `segment(text)`：在 `。！？!?` 之後與每個換行切開，終止符號留在句尾（引擎打得出 `。！？`），連續的 `！？` 與右括號跟著同一句，空行與多餘空白丟掉。ASCII 的 `.` **不**當句尾（`1.5`、`U.S.A.`）。
- `toRomaji(kana)`：顯示用的讀音提示，不是引擎接受的拼法（引擎仍由 `@jptype/engine` 決定）。每個假名取 `@jptype/data` 的第一個拼法，另加三條：っ 讓下一個子音加倍（がっこう → gakkou，後面沒有子音就丟掉）、ん 在母音或 y 前是 `n'`（きんようび → kin'youbi）其餘是 `n`（しんぶん → shinbun、こんにちは → konnichiha）、ー 重複前一個母音（コーヒー → koohii）。不是假名的字元走 `SYMBOLS`（、。？！）或原樣保留，admin 可直接改。

### 內容模式 `content:{id}` 與每內容排行榜

- `parseMode` 加 `kind: 'content'`（id 只做形狀檢查，`@jptype/data` 不可能知道 D1 裡有什麼），`poolForMode('content:…')` 回 undefined。
- `submitRun` 多一個可選的 async `poolForMode` dep；`server/mode.ts` 的 `contentPoolResolver` 只回答 content 模式（已發布內容的 `kanaText` 陣列），其他模式 fallback 回 `@jptype/data` 的靜態 pool。草稿 / 不存在的內容沒有 pool → 當成 unknown mode 擋掉，所以未發布的匯入不能用來刷榜。
- 排行榜本來就以 mode 字串為 key，所以每內容一個榜不需要新程式：`/leaderboard?mode=content:{id}`（顯示內容標題，計時賽仍是預設 UI）。
- 同步模式的成績**只有 `replayable` 時才送後端**：跳過或被 seek 重打的句子會讓 `text` 與 `log` 對不上，伺服器的 `replay()` 必然拒絕。`SongSyncRun` 因此多一個 `replayable` getter（有跳過或回到已經走過的句子就是 false），UI 會說明這次只留在本機。逐句模式（`PracticeRun` + `sequence`）一律可送。

### 誰在 client、誰在 server

- **server**：`lib/server/contents/{store,service,route}.ts`。`store.ts` 是介面 + D1 實作（`setLines` 用 D1 batch：一個 delete + 分批 insert，整張表一次換掉），`service.ts` 是純函式（`ContentDeps = { store, now?, newId? }`）加 `parse*` 驗證，用 fake store 單元測試，跟 `runs/submit.ts`、`songs/service.ts` 同一套；`route.ts` 只做 bindings→deps，session / admin / JSON / `Result`→回應的 helper 直接沿用 `songs/route.ts`（不另外寫一份）。
- **client**：`lib/ja/*`（斷句、kuromoji、羅馬字）、`lib/contents-api.ts`（唯一的 fetch 層，永遠 resolve 不 throw，失敗時 Line Editor 的狀態不動，可以直接重試）、`lib/contents.ts` 與 `lib/contents-labels.ts`（同構的型別 / 常數 / 標籤）。
- Admin 判定沿用 `ADMIN_EMAILS`（沒有加 `user.role`）：`/admin/contents*` 的 load 與每一支 `/api/admin/contents/*` 都各自檢查一次。

### 補充（合併 M4-1 時）：kuromoji 字典的服務方式

`vite-plugin-static-copy` 在 Windows 上不論 `structured: false` 或目錄 + `rename` 都會把來源路徑整段重建（`dict/kuromoji/node_modules/kuromoji/dict/…`），字典 404。改為 `apps/web/scripts/copy-kuromoji-dict.mjs` 在 `prepare` / `dev` / `build` 前把 12 個 `.dat.gz` 複製到 `static/dict/kuromoji/`（git 忽略），由 SvelteKit 靜態資源服務。Production（Workers static assets）回 `application/gzip` 且無 `Content-Encoding`；dev 的 sirv 會加 `Content-Encoding: gzip` 讓瀏覽器先解壓、kuromoji 再解壓就失敗，所以 `vite.config.ts` 有一個排在 `sveltekit()` 之前的 dev-only middleware `kuromojiDictRaw` 原樣送出。

## 2026-09-10 M4-3 實作：Combo、錯誤分析、練習時間統計、成就

### Combo = 連續「被接受的按鍵」，不是連續假名

`PracticeRun` 與 `SongSyncRun` 各自維護 `combo` / `maxCombo` / `milestone` / `milestoneAt`（四個 `$state`，共用 `lib/practice/combo.ts` 的 `applyComboKey`）。規則：

- 引擎忽略的鍵（Shift、Backspace…）不進 log，也不進 combo，兩個方向都不算。
- 打完一題 / 一句**不**中斷連段，連段只被錯鍵打斷。
- 同步模式另有兩個中斷點：被歌曲追過去（該句計入 `skippedLines`）與使用者 seek / 倒帶。打完的句子被推進不算中斷。
- 里程碑 10 / 20 / 50 / 100：`milestone` 記最後跨過的門檻、`milestoneAt` 記時間戳（跟 `lastWrongAt` 同一套做法），UI 用它重觸發動畫，不需要 callback 或事件匯流排。
- `TypingArea` 連段 ≥ 5 才顯示（小字、muted），里程碑時閃一下主色 + 500ms 微放大；`prefers-reduced-motion` 關掉。不放彩帶（MASTER.md「不要遊戲化」）。

### 錯誤分析在按鍵當下記錄，不從 log 反推

`lib/practice/errors.ts` 吃 `KeyError[]`（`{ kana, romaji, typed, key }`，每個被拒絕的鍵一筆），由兩個 run 類別在 `press()` 裡記下來——錯鍵不會進 buffer，所以 `press` 之後的 `typed` 就是當下已接受的前綴。
不用 `text` + `log` 重跑的理由：只有 `text` 與 `log` 對得起來的場次才重播得出來，同步模式會跳句、重打，計時賽最後一題打到一半，這些都會讓重播位移。逐鍵記錄每個錯鍵多一個小物件，永遠正確。

拼法的判定（`describeError`，故意寫得很笨以求可重現）：

- `expected` = 引擎當下還在等的拼法，也就是畫面上的提示（第一個與已打前綴相容的拼法）。
- `attempt` = 已接受前綴 + 被拒絕的鍵。`attempt` 若是**任何**假名拼法的前綴（表由 `@jptype/data` 的 `KANA` + `SYMBOLS` 展開），視為使用者在拼另一種羅馬字，整串報出來（ち 期待 `ti`、打成 `tu`）；否則只報那一個鍵（`shi → q`）。
- 會被接受的鍵永遠走不到這裡，所以 `attempt` 不可能是 `expected` 的合法延續。
- 聚合鍵是 `unit|expected|typed`，排序穩定（同次數保持首次出錯順序），各取前 5。

### `runs.max_combo` 一律由伺服器從 log 重算

migration `0004_achievements` 只有 `ALTER TABLE runs ADD max_combo integer`（nullable，舊資料沒有連段），drizzle-kit 這次沒有重建 `runs`，所以 `runs_lb` / `runs_user` 兩條 `DESC` 索引沒有被寫壞（見 M2 ②那條）；本機 `wrangler d1 migrations apply DB --local` 已驗證。
`POST /api/runs` 接受可選的 `maxCombo`（驗證 0..log.length，超出就 400），但**寫進 D1 的值是 `maxComboFromLog(log)`**：log 已經被 `analyze()` 重播驗證過，連段是它的函數，沒有理由相信前端的數字。`lib/practice/combo.ts` 是純 TS，伺服器直接 import，不複製一份。

### 練習時間與 30 天平均：兩邊共用 `lib/stats.ts`

`summarize(samples, now)` 吃 `{ at, durationMs, kpm, accuracy }[]`，回今日 / 本週練習時間與近 30 天平均 Accuracy / KPM。今日與本週都用台北曆（`lib/time.ts`，週的定義跟 `runs.week` 一致）。
`taipeiDate` / `weekOf` 從 `lib/server/*` 搬到 `lib/time.ts`（server 端只留 re-export，既有 import 不用改），因為未登入的 `/me` 也要用同一套定義，而 `$lib/server` 在瀏覽器端不可 import。

- 登入：`UserStore` 多 `runSamples(userId, since)` 與 `achievementTotals(userId)`，`getMyStats` 多回 `summary` 與 `achievements`。
- 未登入：`storage.ts` 多一份滾動紀錄 `jptype:history`（`{ mode, score, kpm, accuracy, durationMs, keys, maxCombo, at }`，上限 200 筆）。`recordResult(mode, result, opts)` 第三個參數改成 `{ now?, durationMs?, maxCombo? }` 物件，舊的兩參數呼叫端照舊能編（那些場次的練習時間記 0，之後補傳即可）。`keys` 與 `maxCombo` 是成就規則要的，規格裡的欄位是它的子集。

### 成就用推導的，不開表

`lib/achievements.ts` 五條規則都是門檻，輸入是 `/me` 本來就有的數字（`totalRuns` / `maxCombo` / `bestKpm` / `perfectRuns`），所以沒有 `user_achievements` 表要同步，也不可能出現徽章跟旁邊的統計對不上。

- First Practice：`totalRuns >= 1`
- Perfect：準確率 100% 且該場 ≥ 20 鍵（太短的場次不算）
- 10 次練習：`totalRuns >= 10`
- CPM > 100：引擎量的是 KPM，所以規則是 `bestKpm >= 100`
- 100 Combo：`maxCombo >= 100`

未登入者從本機的 200 筆滾動紀錄推導（門檻都 ≤ 100，200 筆綽綽有餘）。`/me` 已達成用主色圓底圖示，未達成用虛線框 + muted 圖示，狀態另有 visually-hidden 文字給螢幕閱讀器。

### 沒有動的東西

分數公式維持 §6.5 的 `kpm × accuracy²`，沒有加 Combo 係數；「Accuracy ≥ 90% 才算有效成績」仍未做（兩項都還在 ROADMAP M4-3 待確認）。

# ROADMAP

功能與里程碑的唯一追蹤處。規格本體在 `jp-typing-spec.md`，技術決策在 `DECISIONS.md`。
新想法先記到最下方「點子池」，排入里程碑後再搬上去。

狀態：✅ 完成 · 🔨 進行中 · ⬜ 未開始 · 💡 點子

## M0 — 引擎與資料（不做 UI）

- ✅ `@jptype/data` 假名對照表完整（141 項：清音 / 濁音 / 半濁音 / 拗音 / 外來語音 / 小字）+ 符號表 + `findKana` / `toKatakana`
- ✅ `validate` 腳本：無重複 kana、每項 ≥1 拼法、拼法只含 `[a-z'-]`、片假名雙向一致
- ✅ `@jptype/engine`
  - ✅ `score()`（§6.5）
  - ✅ `tokenize()`：最長匹配、促音合併、ん 規則、ー、空白與英數
  - ✅ `TypingSession`：逐鍵狀態機、hint、錯鍵不吃進 buffer
  - ✅ `replay()`：後端重算、偵測竄改 log
  - ✅ §6.6 全部測試案例（engine 57 tests、data 17 tests）、覆蓋率門檻 90 % 通過
- ✅ CI：lint + typecheck + test + build（`.github/workflows/ci.yml`）

## M1 — 可練習（無帳號）

- ⬜ 部署到 Cloudflare Workers（owner 指示：地端驗證完再部署；`pnpm preview` 地端已可開）
- ✅ 課程定義（`packages/data` lessons）：28 課，あ行…わ行・ん → 平假名綜合 → 濁音・半濁音 → 拗音 → 促音・長音 → 片假名 13 課 → 外來語音
- ✅ `/learn` 課程地圖（完成打勾、每課最佳成績）
- ✅ `/learn/[lessonId]`：認識頁（卡片、標準拼法、鍵盤高亮）→ 練習（20 題）→ 結果頁（KPM、準確率、錯字列表、加強練習）；TTS 播放鈕留 M3
- ✅ `TypingArea` 元件：逐鍵判定、目前 unit 高亮、羅馬字提示（可關）、錯鍵閃紅震動 160ms、`keydown` 全域監聽
- ✅ 打字音效：打字機「答答答」（Web Audio 合成、不用音檔），正確/錯誤音不同，可關閉、記憶設定（owner 2026-09-10）
- ✅ 打字手感（owner 2026-09-10 地端試打：「很好」）：零延遲判定、動畫輕、鍵盤與提示同步（owner 2026-09-10 強調 UX 舒服）
- ✅ 螢幕鍵盤（QWERTY）高亮下一鍵，可收合
- ✅ 練習結果存 localStorage（每課最佳 / 次數、每假名 attempts / errors、設定）
- ✅ 手機提示「建議使用實體鍵盤」（pointer: coarse）
- ✅ 設計系統：`design-system/jptype/MASTER.md`（ui-ux-pro-max 產生後依規格校正）、單一 teal 主色、Noto Sans JP、深色跟系統

## M2 — 帳號、計時賽、排行榜

- ✅ Better Auth + Drizzle/D1 adapter，Google、LINE OAuth；`/login`、header 登入/登出。端到端登入待 owner 提供 Google / LINE 憑證（見 DECISIONS）
- ✅ Better Auth 四張表（CLI 產生）+ `runs.userId` / `kana_stats.userId` FK，migration `0001_auth`
- ✅ `POST /api/runs`：session → Turnstile（有 secret 且已登入才要求）→ text 合法性 → `analyze` 重算 → anticheat → 寫 D1 + R2 → kana_stats upsert → KV 失效（分數 ≥ 第 100 名才刪）→ 回 rank；課程與計時賽結束都會送
- ✅ Anticheat 規則（§9.5 六條，單元測試）
- ✅ 計時賽 `/timed`：pool（平假名全 / 片假名全 / 全部）× 30/60/120 秒，第一鍵起算，時間到自動結算、自動送分、顯示本週名次
- ✅ `GET /api/leaderboard`（KV 快取 60 s、回自己名次）、`/leaderboard` pool × 秒數 × 週榜 / 總榜、首頁本週前 5
- ✅ Cron（週一 00:00 台北）：上週 9 個計時榜前 100 快照到 KV `lbsnap:*`、刪 90 天前 R2 keylog；自訂 worker entry 包住 SvelteKit `_worker.js`
- ✅ `GET /api/me/stats`、`/me`：總場次、連續天數、近 30 天、弱項清單、五十音錯字熱圖（清音 / 濁音 / 拗音）、最近 20 場；未登入顯示本機 localStorage 版本
- ✅ 弱項練習 `/learn/weak`（errors/attempts > 0.2 且 attempts ≥ 3，隨機補足到 20 題；mode `weak` 可送分）
- ⬜ 無提示加成（關閉羅馬字提示 ×1.1）— 規格允許第一版不做，留到 review 後決定

## M3 — 內容擴充（2026-09-10 開工，三塊平行由 Opus agent 實作）

- ✅ A. N5 單字 100 個 + 短句 20 句（`@jptype/data`，原創內容，含漢字與中文）→ 課程 `n5-words`、`sentences`（練習時顯示漢字與中文提示）與計時賽 pool `n5`（排行榜與 cron 因此變 12 個榜）
- ✅ B. 瀏覽器 TTS（`lib/speech.ts`，Web Speech API 本機 ja-JP 語音，零網路零 assets）：認識頁卡片播放鈕 + 聽打模式 `/listen`（計時賽題庫 × 20 題、自動念題、Tab 重播、答對或連錯兩鍵才短暫揭曉；成績只存本機）
- ✅ C. 歌詞打字 `/songs`：嵌 youtube-nocookie 官方播放器（只存 11 字元影片 id）+ 使用者自貼假名歌詞（漢字會被擋下並指出行號），只存 localStorage、不送伺服器、不進榜；`/songs/[id]` 逐行打（前後行淡顯）
- ⬜ Azure Speech 批次音檔 → R2（需要 owner 的 Azure key；瀏覽器 TTS 先頂著）
- ⬜ AI 生成分級文章（離線 + 人工校對，需要 API key）
- ⬜ 多人競速房（Durable Objects，另開規格）

## M4 — 內容平台（2026-09-10 owner 與 GPT 討論的 PRD，採納部分）

定位從「假名打字練習」擴大為「用真實日文內容練打字」：歌曲只是入口，動畫台詞、新聞、JLPT 題、文章、自由輸入都走同一條管線 **內容 → 解析 → 假名 / 羅馬字 → 引擎 → 判定 → 統計**。技術棧不變（SvelteKit + Cloudflare D1/KV/R2，引擎沿用 `@jptype/engine`）。

### M4-1 內容資料模型與匯入（先做，其餘都建立在它上面）

- ⬜ `contents`：id、type（song / anime / news / novel / jlpt / free）、title、description、youtubeVideoId、jlptLevel（N5–N1 / unknown）、difficulty（easy / normal / hard / expert）、status（draft / published）
- ⬜ `content_lines`：order、startTime、endTime（秒，可為空）、originalText、kanaText、romajiText（自動產生，可人工改）、metadata
- ⬜ 權利 metadata 為必填：sourceType、sourceUrl、sourceName、license、rightsStatus（original / licensed / public_domain / user_provided / other）；rightsStatus 不明者不得發布
- ⬜ Manual Import 管線：貼文字 → 斷句 → 漢字→假名（瀏覽器端 kuromoji 字典，不叫外部 API）→ 羅馬字 → 管理員校對 → 發布
- ⬜ 「User Provided」內容只存於該使用者名下，不進公共列表；現有 `/songs` localStorage 版本併入此模型
- ⬜ 之後任何第三方來源都以獨立 Connector 實作，並遵守該來源的使用條款（不做繞過、不做大量抓取）

### M4-2 YouTube 同步播放

- ⬜ YouTube IFrame Player API：play / pause / seek / currentTime / duration / 音量 / 速度
- ⬜ `startTime <= currentTime < endTime` 決定目前句；打完且下一句已開始就自動進下一句，不用按 Next
- ⬜ 影片暫停 → 打字暫停；Seek → 重新定位句子並清空暫存輸入
- ⬜ 三種模式：Sync（跟影片）、Typing（不受時間限制）、Review（只練曾錯的句子）
- ⬜ 倒數 3-2-1 START；鍵盤快捷：Space 播放/暫停、Esc 離開、Ctrl+R 重來

### M4-3 練習 UI 與統計擴充

- ⬜ Combo（連續正確）與 Max Combo；里程碑 10 / 20 / 50 / 100
- ⬜ 錯誤分析：最常錯的假名、最常錯的拼法（如 shi → si）
- ⬜ 結果頁補：Time、Max Combo、Errors、最常錯誤
- ⬜ 每個內容的排行榜，Accuracy ≥ 90% 才算有效成績；分數公式是否加 Combo 係數 **[待確認]**（現行 §6.5 是 kpm × accuracy²）
- ⬜ 個人統計補：今日 / 本週練習時間、平均 Accuracy / CPM
- ⬜ 簡單成就：First Practice、100 Combo、CPM > 100、Perfect、10 次練習

### M4-4 內容探索與後台

- ⬜ 內容列表：搜尋、類型、JLPT、難度篩選；卡片顯示縮圖、標籤、個人最佳
- ⬜ 首頁改版：Hero + 熱門類型 + 你的進度
- ⬜ Admin（`user.plan` 之外新增 `user.role`）：內容 CRUD、發布 / 下架、使用者、練習紀錄
- ⬜ Line Editor：播放器旁逐句設定 start / end、改假名與羅馬字、上移下移刪除
- ⬜ 分析事件：內容瀏覽、開始練習、完成練習（核心指標 = 開始 → 完成的轉換率）

### M4-5 AI（最後做，且只用自有內容）

- ⬜ 漢字 / 讀音 / 難度分析輔助管理員校對
- ⬜ 個人化錯誤建議
- ⬜ 「我想練 N3」→ AI 生成段落 → 假名 / 羅馬字 → 練習（自有生成內容，無版權問題）

## 明確不做（第一版）

かな入力、漢字輸入 / IME 變換、手機觸控打字、廣告 / 付費牆（只留 `user.plan` 欄位）、多語系 UI、即時對戰。

## 點子池

（owner 提出、尚未排程的想法。格式：日期 · 一句話 · 備註）

- 2026-09-10 · 唱到哪打到哪（sing-along 打字）：需要帶時間軸的歌詞，三條路 A 授權 API / B 公有領域曲庫 / C 自貼+對時工具，見 DECISIONS · 等 owner 決定預算
- 2026-09-10 · 歌詞打字：貼 YouTube 網址 → 嘗試抓歌詞 → 存歌詞＋網址 → 提供「選歌打」，慢慢擴充曲庫（owner）· 已用方案 1（使用者自帶、只存本機）實作，見 M3 C 與 DECISIONS.md「M3 C」；共用曲庫（公有領域 / CC）仍未做
- 2026-09-10 · 打字音效可選不同機種（機械鍵盤 / 打字機 / 靜音）· 先做打字機一種
- 2026-09-10 · 若批次腳本改用 Python，用 uv 管 `scripts/py/` 獨立專案 · 目前全 TS，不需要

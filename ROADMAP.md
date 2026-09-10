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

## M3 — 內容擴充（第二階段，另開規格）

- ⬜ N5 單字 100 個（`words-n5.json`，含振假名與中文）、短句 20 句
- ⬜ TTS 音檔批次（Azure Speech ja-JP → R2），認識頁播放鈕
- ⬜ AI 生成分級文章（離線 + 人工校對）
- ⬜ 聽打模式（只聽不看）
- ⬜ 多人競速房（Durable Objects）
- ⬜ 歌詞打字（公有領域 / 使用者自帶）

## 明確不做（第一版）

かな入力、漢字輸入 / IME 變換、手機觸控打字、廣告 / 付費牆（只留 `user.plan` 欄位）、多語系 UI、即時對戰。

## 點子池

（owner 提出、尚未排程的想法。格式：日期 · 一句話 · 備註）

- 2026-09-10 · 歌詞打字：貼 YouTube 網址 → 嘗試抓歌詞 → 存歌詞＋網址 → 提供「選歌打」，慢慢擴充曲庫（owner）· 著作權疑慮見 DECISIONS.md「歌詞打字」，M3 再議
- 2026-09-10 · 打字音效可選不同機種（機械鍵盤 / 打字機 / 靜音）· 先做打字機一種
- 2026-09-10 · 若批次腳本改用 Python，用 uv 管 `scripts/py/` 獨立專案 · 目前全 TS，不需要

# 日文打字練習網站 — 專案規格 v0.1

> 給 Claude Code 的交接文件。工作代號 `jptype`（正式名稱待定）。
> 語言：UI 文案繁中；程式碼、commit、識別字英文。
> 前身：https://github.com/m124578n/japanese_practice（Flask，2024-03）。**不要沿用其程式碼**，只有假名分類的概念和資料表可參考（該資料表有錯誤，見 §5）。

---

## 0. 一句話

給台灣日文初學者的日文打字練習網站：從五十音認識 → 逐鍵打字練習 → 計時賽 → 排行榜。**全部部署在 Cloudflare**。

## 1. 硬性決策（不要改，有疑問先問）

| 項目          | 決策                                                                                                                      |
| ------------- | ------------------------------------------------------------------------------------------------------------------------- |
| 輸入方式      | 只支援羅馬字輸入（romaji → kana），模擬日文 IME 行為。不做かな入力。                                                      |
| 漢字          | 不打漢字。句子/文章階段顯示「漢字＋振假名」，使用者打讀音。                                                               |
| 判定位置      | **判定引擎在瀏覽器**，練習過程零後端請求；一場結束 POST 一次。後端用同一套引擎重算分數，不信任前端分數。                  |
| 平台          | Cloudflare Workers（Static Assets）+ D1 + KV + R2 + Cron Triggers + Turnstile。多人競速（第二階段）才用 Durable Objects。 |
| 前端框架      | SvelteKit + `@sveltejs/adapter-cloudflare`。TypeScript strict。                                                           |
| 登入          | Better Auth，adapter 走 Drizzle + D1。OAuth：Google、LINE。                                                               |
| ORM           | Drizzle ORM，migration 用 `drizzle-kit generate` + `wrangler d1 migrations apply`。                                       |
| 引擎          | 獨立 package `@jptype/engine`，純 TS 零依賴，vitest，覆蓋率 ≥ 90%。                                                       |
| TTS / AI 內容 | 離線批次產生（scripts/），成品放 R2 / D1。**網站 runtime 不呼叫任何外部 AI/TTS API。**                                    |
| i18n          | 第一版只做 zh-TW，但所有 UI 字串走 key（用 `svelte-i18n` 或 paraglide），不寫死。                                         |

## 2. Repo 結構（pnpm monorepo）

```
jptype/
├─ apps/web/                 SvelteKit 應用（前端 + /api routes）
│  ├─ src/routes/
│  │  ├─ (app)/              首頁、課程、練習、計時賽、排行榜、個人頁
│  │  └─ api/                runs, leaderboard, me, auth/[...]
│  ├─ src/lib/server/        db (drizzle), auth, anticheat, leaderboard
│  ├─ src/lib/components/    TypingArea, KanaCard, Keyboard, Leaderboard...
│  └─ drizzle/               migrations
├─ packages/engine/          羅馬字解析器 + 計分（前後端共用）
├─ packages/data/            假名對照表、課程定義（JSON + 型別 + 驗證腳本）
├─ scripts/                  tts-batch.ts、gen-articles.ts、seed.ts
├─ wrangler.toml
├─ pnpm-workspace.yaml
└─ .github/workflows/        ci.yml（lint/test/build）、deploy.yml（wrangler deploy）
```

## 3. Cloudflare 資源

`wrangler.toml` 綁定：

```toml
name = "jptype"
main = ".svelte-kit/cloudflare/_worker.js"
compatibility_date = "2026-09-01"
compatibility_flags = ["nodejs_compat"]

[assets]
directory = ".svelte-kit/cloudflare"

[[d1_databases]]
binding = "DB"
database_name = "jptype"

[[kv_namespaces]]
binding = "KV"

[[r2_buckets]]
binding = "R2"
bucket_name = "jptype"

[triggers]
crons = ["0 16 * * 0"]   # 週一 00:00 台北 = 週日 16:00 UTC：結算週榜

[vars]
PUBLIC_TURNSTILE_SITE_KEY = ""
```

Secrets（`wrangler secret put`）：`BETTER_AUTH_SECRET`、`GOOGLE_CLIENT_ID/SECRET`、`LINE_CHANNEL_ID/SECRET`、`TURNSTILE_SECRET_KEY`。

用途：

- **D1**：users / sessions（Better Auth 表）、runs、kana_stats、lessons、articles
- **KV**：`lb:{mode}:{week|all}` 排行榜前 100 名 JSON，TTL 60s；`me:{userId}:best` 個人最佳
- **R2**：`runs/{runId}.json` 原始按鍵序列；`audio/{kana|wordId}.mp3`
- **Cron**：週榜結算快照、刪除 90 天前的 R2 keylog
- **Turnstile**：註冊、以及登入狀態下的 `POST /api/runs`（隱形模式）

## 4. 資料模型（D1 / Drizzle）

Better Auth 自己產生 `user`、`session`、`account`、`verification` 四張表，不手寫。額外：

```ts
// runs：每場練習/計時賽一筆
runs {
  id: text PK (ulid)
  userId: text FK user.id (nullable：未登入可練習但不入榜)
  mode: text            // 'lesson:hira-a' | 'timed:allhira:60' | ...
  kpm: integer
  accuracy: real        // 0..1
  score: integer
  correctKeys: integer
  wrongKeys: integer
  durationMs: integer
  week: text            // 'YYYY-Www'，以台北時間計
  flagged: integer      // 0/1，anticheat 疑似
  createdAt: integer    // epoch ms
}
index runs_lb (mode, week, score desc)
index runs_user (userId, createdAt desc)

// kana_stats：SRS / 熱圖用
kana_stats {
  userId: text
  kana: text            // 單一 unit，如 'か' 'きゃ' 'っか'
  attempts: integer
  errors: integer
  lastSeenAt: integer
  PK (userId, kana)
}

// lessons：課程定義也放 D1 方便後台改，但第一版可直接從 packages/data 讀
// articles / audio：第二階段
```

排行榜查詢（週榜）：

```sql
SELECT userId, MAX(score) AS best, kpm, accuracy
FROM runs
WHERE mode = ? AND week = ? AND flagged = 0 AND userId IS NOT NULL
GROUP BY userId
ORDER BY best DESC, accuracy DESC
LIMIT 100;
```

總榜去掉 `week = ?`。結果快取到 KV。

## 5. `@jptype/data` — 假名對照表

### 5.1 格式

```ts
export interface KanaEntry {
	kana: string; // 顯示用（平假名）
	kata: string; // 對應片假名
	romaji: string[]; // 所有可接受拼法，第一個是「標準提示」
	group: 'seion' | 'dakuon' | 'handakuon' | 'youon' | 'foreign' | 'small';
	row: string; // 'a','ka','sa'... 用來組課程
}
```

### 5.2 對照表（必須完整實作，這是舊版最大缺漏）

以下依日文 MS-IME / Google 日本語入力共通接受的拼法。**第一個為提示用標準拼法。**

清音

```
あ a    い i    う u  (wu)   え e    お o
か ka (ca)  き ki  く ku (cu, qu)  け ke  こ ko (co)
さ sa   し shi (si, ci)   す su   せ se (ce)   そ so
た ta   ち chi (ti)   つ tsu (tu)   て te   と to
な na   に ni   ぬ nu   ね ne   の no
は ha   ひ hi   ふ fu (hu)   へ he   ほ ho
ま ma   み mi   む mu   め me   も mo
や ya   ゆ yu   よ yo
ら ra   り ri   る ru   れ re   ろ ro
わ wa   を wo   ん → 見 §6.3（不放固定拼法）
```

濁音・半濁音

```
が ga  ぎ gi  ぐ gu  げ ge  ご go
ざ za  じ ji (zi)  ず zu  ぜ ze  ぞ zo
だ da  ぢ di  づ du  で de  ど do
ば ba  び bi  ぶ bu  べ be  ぼ bo
ぱ pa  ぴ pi  ぷ pu  ぺ pe  ぽ po
```

拗音

```
きゃ kya  きゅ kyu  きょ kyo      ぎゃ gya  ぎゅ gyu  ぎょ gyo
しゃ sha (sya)  しゅ shu (syu)  しょ sho (syo)
じゃ ja (jya, zya)  じゅ ju (jyu, zyu)  じょ jo (jyo, zyo)
ちゃ cha (tya, cya)  ちゅ chu (tyu, cyu)  ちょ cho (tyo, cyo)
ぢゃ dya  ぢゅ dyu  ぢょ dyo
にゃ nya  にゅ nyu  にょ nyo      ひゃ hya  ひゅ hyu  ひょ hyo
びゃ bya  びゅ byu  びょ byo      ぴゃ pya  ぴゅ pyu  ぴょ pyo
みゃ mya  みゅ myu  みょ myo      りゃ rya  りゅ ryu  りょ ryo
```

外來語音（主要用於片假名）

```
しぇ she (sye)  じぇ je (jye, zye)  ちぇ che (tye, cye)
てぃ thi (t'i)  でぃ dhi (d'i)  とぅ twu (t'u)  どぅ dwu (d'u)
ふぁ fa  ふぃ fi  ふぇ fe  ふぉ fo  ふゅ fyu
うぃ wi  うぇ we  うぉ who
ゔ vu  ゔぁ va  ゔぃ vi  ゔぇ ve  ゔぉ vo
つぁ tsa  つぃ tsi  つぇ tse  つぉ tso
いぇ ye
```

小字（單獨出現時）

```
ぁ xa (la)  ぃ xi (li)  ぅ xu (lu)  ぇ xe (le)  ぉ xo (lo)
ゃ xya (lya)  ゅ xyu (lyu)  ょ xyo (lyo)
っ xtu (ltu, xtsu, ltsu)   ← 單獨出現時；促音規則見 §6.2
```

符號

```
ー  -          、 ,          。 .          ？ ?          ！ !
```

片假名一律由對應平假名 `kata` 欄位映射，拼法相同。

### 5.3 驗證腳本

`packages/data/scripts/validate.ts`：檢查無重複 kana、每個 entry 至少一個 romaji、所有 romaji 只含 `[a-z'-]`、片假名映射雙向一致。CI 執行。

## 6. `@jptype/engine` — 判定引擎

### 6.1 API

```ts
// 把目標文字切成 unit 序列
export function tokenize(text: string): Unit[];
// Unit = { kana: string; romaji: string[]; }   romaji 已依上下文展開（促音、ん）

export class TypingSession {
	constructor(text: string);
	press(key: string, atMs: number): PressResult;
	// PressResult = { ok: boolean; unitIndex: number; unitDone: boolean; finished: boolean; hint: string }
	get progress(): { unitIndex: number; typed: string; hint: string };
	get log(): KeyEvent[]; // [{ t: number, key: string, ok: boolean }]
}

export function score(log: KeyEvent[], durationMs: number): ScoreResult;
// ScoreResult = { kpm, accuracy, score, correctKeys, wrongKeys }

export function replay(text: string, log: KeyEvent[]): ScoreResult | { invalid: string };
// 後端用：重跑一次驗證 log 與 text 一致
```

### 6.2 tokenize 規則

1. 先用最長匹配把文字切成 kana unit：優先 3 字（ゔぁ 之類不會出現，實際上最長 2 字）→ 2 字（拗音、外來語音）→ 1 字。
2. **促音 っ**：若下一個 unit 存在且其所有拼法以子音開頭，將 っ 併入下一個 unit：
   - 拼法 = `[c + s for s in next.romaji]`（c = s 的第一個字母），例：っか → `kka`；っち → `cchi`, `tti`；っしゃ → `ssha`, `ssya`
   - 額外加入 `xtu/ltu/xtsu/ltsu + s`
   - 特例：っち 另加 `tchi`
   - 若 っ 在句尾或下一個是母音/ん，視為單獨小字（xtu…）
3. **ー**：單獨 unit，拼法 `-`。
4. **ん**：見 6.3。
5. 空白：unit 拼法 ` `。英數與符號：原樣。

### 6.3 ん 規則（模擬 IME）

設下一個 unit 的拼法首字母集合為 N：

- 拼法固定包含：`nn`、`n'`、`xn`
- **若 ん 不在句尾，且 N 中所有字母都不是母音 (a,i,u,e,o) 也不是 n、y**，額外接受單獨 `n`。
- 句尾的 ん只接受 `nn` / `n'` / `xn`。

範例：こんにちは → ん後面是に(ni)，n 開頭 → 只能 `nn`；かんたん → 第一個ん後面是た → 可 `n`；最後的ん → `nn`。

### 6.4 逐鍵狀態機

- 保存 `buffer`（目前 unit 已打的字母）。
- `press(key)`：若 `buffer + key` 是目前 unit 任一拼法的前綴 → ok，`buffer += key`；若剛好等於某拼法 → unit 完成，`buffer = ''`，index++。否則 → 錯誤，buffer 不變（**錯字不吃進去**，使用者重打正確鍵即可）。
- 提示 `hint`：目前 unit 的第一個與 buffer 相容的拼法（例如打了 `s` 後 し 的提示從 `shi` 保持 `shi`；打了 `t` 後 ち 的提示變成 `ti`）。
- 大小寫不敏感；Shift/Ctrl/組合鍵忽略；Backspace 忽略（不允許退格，設計上錯鍵不進 buffer）。
- 「n 歧義」：ん + 下一個 unit 開頭 n 的情況已由 6.3 排除，狀態機不需前瞻。

### 6.5 計分

```
correctKeys = log 中 ok=true 的數量
wrongKeys   = ok=false 的數量
kpm         = correctKeys / (durationMs / 60000)
accuracy    = correctKeys / (correctKeys + wrongKeys)   （無按鍵時為 0）
score       = round(kpm * accuracy ** 2)
```

### 6.6 測試案例（最少要有）

- `tokenize('きょう')` → `[きょ, う]`
- `tokenize('がっこう')` → `[が, っこ(kko, xtuko…), う]`
- `tokenize('こんにちは')` ん只接受 nn/n'/xn
- `tokenize('かんたん')` 第一個ん接受 n
- `tokenize('マッチ')` → っち 接受 cchi/tti/tchi
- `tokenize('コーヒー')` ー 為 `-`
- 完整打 `しんぶん` 用 `shinbunn` 與 `sinbunn` 都成功
- 打錯鍵不推進、不改 buffer
- `replay` 對竄改過的 log（多插入 ok=true）回傳 invalid

## 7. 課程與模式

### 7.1 課程（lesson）

每課 = `{ id, title, units: string[] (出題池), intro: KanaEntry[] (認識頁), mode: 'kana' | 'word' }`。

順序：

1. あ行 → か行 → さ行 → た行 → な行 → は行 → ま行 → や行 → ら行 → わ行・ん
2. 平假名綜合
3. 濁音・半濁音
4. 拗音
5. 促音・長音（用單字出題：がっこう、きって、おかあさん）
6. 片假名（同 1–4 順序）
7. 外來語音（ティ、ファ、ヴ）
8. N5 單字（100 個，含振假名與中文，資料放 packages/data/words-n5.json）
9. 短句（20 句）

每課流程：**認識頁**（卡片：假名、標準拼法、TTS 播放鈕、鍵盤高亮）→ **練習**（隨機出 20 題，可重複）→ **結果頁**（KPM、準確率、錯字列表、「加強練習錯字」按鈕）。

### 7.2 計時賽（timed）

- 選範圍：平假名全 / 片假名全 / 全部 / N5 單字
- 選時間：30 / 60 / 120 秒
- 連續出題直到時間到，結束自動送分（登入者入榜）
- mode 字串：`timed:{pool}:{seconds}`

### 7.3 SRS（簡化）

`kana_stats` 中 `errors/attempts > 0.2 且 attempts >= 3` 的 kana 視為弱項。「弱項練習」模式的出題池 = 弱項 + 隨機補足到 20。不需要完整 SM-2。

## 8. API

所有 API 在 `apps/web/src/routes/api/`，JSON。

| 方法   | 路徑                                      | 說明                                                                                                                         |
| ------ | ----------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `POST` | `/api/runs`                               | body: `{ mode, text, durationMs, log: KeyEvent[], turnstileToken? }`。流程見 §9。回 `{ runId, score, kpm, accuracy, rank? }` |
| `GET`  | `/api/leaderboard?mode=&period=week\|all` | KV 快取；回前 100 + 自己名次（登入時）                                                                                       |
| `GET`  | `/api/me/stats`                           | 最近 runs、kana_stats、streak                                                                                                |
| `*`    | `/api/auth/*`                             | Better Auth handler                                                                                                          |

未登入也可 `POST /api/runs`（userId null）以取得分數，但不入榜、不寫 kana_stats。

## 9. `POST /api/runs` 處理流程

1. 驗 session（可為 null）。
2. 登入者驗 Turnstile token。
3. `text` 必須能由該 `mode` 的出題池生成（timed 模式：每個 unit 屬於 pool；lesson 模式：屬於該課 units）。
4. `replay(text, log)` 重算 → 與前端送的無關，只信重算結果。
5. **Anticheat**（任一命中 → `flagged=1`，仍存但不入榜，回應不透露原因）：
   - kpm > 800
   - 相鄰按鍵間隔中位數 < 40ms
   - 間隔標準差 < 8ms 且按鍵數 > 30（節奏像機器）
   - `log[last].t - log[0].t` 與 `durationMs` 差 > 3000ms
   - timed 模式 `durationMs` 超過設定秒數 +2s
   - 同一 user 5 分鐘內超過 20 場
6. 寫 D1 `runs`；log 原文寫 R2 `runs/{id}.json`。
7. 登入者：upsert `kana_stats`（依 log 中每個 unit 的首次是否答對）。
8. 若未 flagged 且分數 ≥ 該榜第 100 名 → 刪 KV `lb:{mode}:{week}` 與 `lb:{mode}:all`。

## 10. 前端頁面

| 路徑                | 內容                                         |
| ------------------- | -------------------------------------------- |
| `/`                 | 介紹 + 「開始學五十音」+ 今日排行榜前 5      |
| `/learn`            | 課程地圖（完成打勾、每課最佳成績）           |
| `/learn/[lessonId]` | 認識頁 → 練習 → 結果                         |
| `/timed`            | 選 pool/秒數 → 計時賽 → 結果（含名次）       |
| `/leaderboard`      | 切 mode / 週榜 / 總榜                        |
| `/me`               | 統計、錯字熱圖（五十音表著色）、streak、歷史 |
| `/login`            | Google / LINE                                |

TypingArea 元件要求：

- 目標文字大字顯示，目前 unit 高亮，已完成變灰
- 目前 unit 下方顯示羅馬字提示（可在設定關閉；關閉時分數 ×1.1 作為「無提示加成」，第一版可先不做加成）
- 錯鍵時 unit 閃紅 + 輕微震動動畫，不推進
- 螢幕鍵盤（QWERTY）高亮下一個該按的鍵，可收合
- 全程 `keydown` 監聽 document，練習中不需要 input 元素
- 手機：顯示提示「建議使用實體鍵盤」，但不擋

設計：乾淨、大量留白、主色一個、字型 Noto Sans JP + 系統字。**不要**做成遊戲化花俏風。深色模式跟系統。

## 11. 里程碑與驗收

### M0 — 引擎與資料（不做 UI）

- [ ] `packages/data` 對照表完整 + validate 腳本過
- [ ] `packages/engine` 實作 §6，vitest 覆蓋 §6.6 全部案例，覆蓋率 ≥ 90%
- [ ] CI 跑 lint + test

### M1 — 可練習（無帳號）

- [ ] SvelteKit + adapter-cloudflare 部署成功，preview URL 可開
- [ ] `/learn` 課程 1–7 可完整走完（認識 → 練習 → 結果）
- [ ] TypingArea 逐鍵判定、提示、螢幕鍵盤
- [ ] 練習結果存 localStorage（未登入）

### M2 — 帳號、計時賽、排行榜

- [ ] Better Auth + Google + LINE 登入
- [ ] D1 schema + migration
- [ ] `POST /api/runs` 含 replay 驗證與 anticheat
- [ ] 計時賽 + 週榜/總榜 + KV 快取 + Cron 結算
- [ ] `/me` 統計與錯字熱圖、弱項練習

### M3 — 內容擴充（第二階段，另開規格）

- N5 單字、短句、TTS 音檔批次（Azure Speech ja-JP → R2）
- AI 生成分級文章（離線 + 人工校對）
- 聽打模式（只聽不看）
- 多人競速房（Durable Objects）
- 歌詞打字（僅公有領域 / 使用者自帶內容）

**M0 → M1 → M2 依序做，每個里程碑完成後停下來 review 再往下。**

## 12. 非目標（第一版明確不做）

- かな入力
- 漢字輸入 / IME 變換模擬
- 手機觸控鍵盤打字體驗
- 廣告、付費牆（結構上預留 `user.plan` 欄位即可）
- 多語系 UI（只留 key 結構）
- 即時對戰

## 13. 開發約定

- pnpm；Node 22；`pnpm dev` 用 `wrangler dev` 走本機 D1/KV/R2 模擬
- commit 格式：`feat(engine): ...` / `fix(web): ...`
- 引擎與資料任何修改必附測試
- 不在 Worker runtime 呼叫外部 API（除 OAuth、Turnstile）
- 環境變數與 secret 不進 git；`.dev.vars` 範本放 `.dev.vars.example`
- 有不確定的產品決策 → 在 `DECISIONS.md` 記一筆並問，不要自行假設

# jptype — Design System (MASTER)

Generated with ui-ux-pro-max on 2026-09-10, then reconciled with `jp-typing-spec.md` §10.
Spec wins where they conflict. Page overrides go in `pages/<page>.md`.

## Direction

- **Pattern:** Minimal single column, centered. One primary CTA per screen. Lots of whitespace.
- **Style:** Quiet minimalism. Oversized kana as the hero element of the practice screen; everything else recedes.
- **Not:** gamified, playful fonts, badges, confetti, multi-color gradients.
- **Dials:** variance 2 / motion 2 / density 3 (spacious).

## Color (single accent + neutrals)

| Token           | Light      | Dark       | Use                             |
| --------------- | ---------- | ---------- | ------------------------------- |
| `--bg`          | `#FAFAFA`  | `#111113`  | page background                 |
| `--surface`     | `#FFFFFF`  | `#1B1B1F`  | cards, keyboard                 |
| `--fg`          | `#18181B`  | `#E7E7EA`  | body text, kana                 |
| `--fg-muted`    | `#6B6B74`  | `#9A9AA3`  | hints, captions (≥ 4.5:1 on bg) |
| `--border`      | `#E4E4E7`  | `#2C2C32`  | 1px dividers                    |
| `--accent`      | `#0D9488`  | `#2DD4BF`  | current unit, CTA, next key     |
| `--accent-soft` | `#CCFBF1`  | `#134E4A`  | highlight backgrounds           |
| `--on-accent`   | `#FFFFFF`  | `#0B2E2A`  | text on accent                  |
| `--danger`      | `#DC2626`  | `#F87171`  | wrong key flash only            |
| `--danger-soft` | `#FEE2E2`  | `#450A0A`  | wrong key background            |
| `--ring`        | `--accent` | `--accent` | focus ring (2px, offset 2px)    |

Dark mode follows `prefers-color-scheme`; no manual toggle in v1.

## Typography

- Family: `"Noto Sans JP", system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", sans-serif`
  (Google Fonts, `display=swap`, weights 400/500/700; the JP subset loads on demand via unicode-range).
- Base 16px, line-height 1.6. Headings 700, tight tracking (-0.01em) only above 32px.
- Practice kana: `clamp(3rem, 12vw, 6rem)`, weight 500. Romaji hint: monospace-ish via `font-variant-numeric: tabular-nums`, `letter-spacing: 0.08em`, 1.25rem, muted.
- Never below 12px. Captions 14px.

## Spacing (spacious scale)

`--space-1: 4px · 2: 8px · 3: 12px · 4: 16px · 6: 24px · 8: 32px · 12: 48px · 16: 64px · 24: 96px`
Content max-width 720px (reading), 960px for the lesson map. Section gaps 48–96px.

## Radius / elevation

- Radius: 8px (buttons, chips), 12px (cards), 6px (keys). No shadows in light mode beyond a 1px border; dark mode uses surface contrast instead of shadows.

## Motion

- Durations 120–200ms, `ease-out` in / `ease-in` out. `prefers-reduced-motion: reduce` disables the shake and all transitions.
- Wrong key: unit flashes `--danger` + 160ms horizontal shake (±3px). No other decorative motion on the practice screen.
- Page transitions: none. Lists: no stagger.

## Components

- **Buttons:** primary (accent bg, on-accent text), secondary (surface bg, border). Min height 44px. Visible focus ring.
- **KanaCard:** kana (2.5rem) + standard romaji + katakana in muted. Click/focus highlights its keys on the keyboard.
- **TypingArea:** completed units muted, current unit accent, upcoming units fg. Hint under current unit. `aria-live="polite"` status line for progress.
- **Keyboard:** QWERTY rows, next key filled with accent; `aria-hidden` (visual aid only), collapsible via button.
- **Result:** three stats (KPM / 準確率 / 分數) as large numbers, wrong-kana chips, then actions.

## Sound

Typewriter click on accepted keys, duller thud on wrong keys, short bell on finish. Synthesized with Web Audio (no assets). Off by default? No: on by default at 60 % volume, toggle persisted in localStorage, never plays before the first user gesture.

## Icons

Inline SVG (Lucide outlines, 20px, stroke 1.75). No emoji as icons.

## Checklist before shipping a page

- [ ] Text contrast ≥ 4.5:1 in both modes
- [ ] Every interactive element reachable by keyboard with a visible ring
- [ ] Practice screen: typing works without focusing any element
- [ ] `prefers-reduced-motion` honored
- [ ] 375 / 768 / 1024 / 1440 layouts checked, no horizontal scroll
- [ ] All copy via Paraglide messages

## Logo（2026-09-11，站名「ぱちぱち」）

- **Mark**：一顆鍵帽（accent 色的帽面 + 深 28% 的底座，做出按鍵厚度），帽面上一個粗體「ぱ」（on-accent 色，偏左），右上角三道短線是敲鍵聲——ぱちぱち 既是鍵盤聲也是拍手聲。64×64 viewBox，最小可用 16px（favicon 時三道線退成一個小點也還認得出鍵帽）。
- **Wordmark**：「ぱちぱち」Noto Sans JP 700，字距 0.02em，高度為 mark 的 0.7。header 用 mark + wordmark；favicon、manifest、社群縮圖只用 mark。
- **顏色**：只用 `--accent` / `--on-accent`，深淺模式自動對調（`Logo.svelte` 用 CSS 變數；`static/icon.svg` 固定 #0D9488 / #0A6B62 / #FFFFFF）。不做漸層、不加陰影、不加外框。
- **禁止**：把「ぱ」換成別的假名、改成多色、旋轉、加光暈。
- **產生方式**：`pnpm --filter web brand`（`apps/web/scripts/brand.mjs`）。「ぱ」與社群卡的文字用 fontkit 從 Noto Sans CJK JP Bold（SIL OFL，放在 git-ignored 的 `apps/web/.cache/fonts/`）轉成 SVG path，所以 logo 不依賴使用者的字型；PNG 用 resvg 的 WASM 版點陣化。產出：`static/icon.svg`（= `src/lib/assets/favicon.svg`）、`src/lib/assets/logo-glyph.ts`（`Logo.svelte` 用的 path）、`static/icon-192.png`、`static/icon-512.png`、`static/apple-touch-icon.png`（180，淺色底）、`static/og.png`（1200×630：鍵帽 + ぱちぱち + 日文打字練習 + 一條主色線）。改 logo 就改 `brand.mjs` 裡的 `markSvg` 再跑一次。

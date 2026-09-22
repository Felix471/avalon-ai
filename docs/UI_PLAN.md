# UI plan (proposal, not built)

Status: design only. Nothing here is implemented. Review, strike what you do not want, and the remaining items become Phase C tasks. Constraints assumed: keep Next.js 16 + Tailwind v4 + shadcn primitives + zustand; keep the Chinese game UI (an English toggle is listed as an option, not a default); no rewrite, incremental changes on the existing components.

## 1. Landing page

Problem today: `/` is the lobby. A visitor with no context lands on a player-count grid and five checkboxes, in Chinese, and never learns that there is an experiment, a dataset, or a result.

Proposal: `/` becomes a short landing page; the lobby moves to `/play`. Existing `/game` stays.

Structure of `/` (single column, `max-w-3xl`, phone-first):

1. Title + one line in English and Chinese: "Avalon with LLM agents. 五家模型同桌玩阿瓦隆。"
2. Two cards side by side on desktop, stacked on phone:
   - **Play** → `/play`. One sentence: "You take one seat; Claude, GPT, Gemini, DeepSeek and Grok take the others." Button 开始游戏 / Play.
   - **Experiment** → GitHub README anchor `#result`. One sentence with the headline number and a link. No chart on the landing page; keep it text.
3. A 3-step "how a round works" strip (discuss → propose and vote → quest), each step an icon and one line, in Chinese with a short English gloss under it.
4. Footer: name, GitHub link, "UI 中文 / English coming".

Copy is short by design. The page must render fully without JavaScript-dependent state (no zustand read on `/`), so it prerenders static and loads instantly.

Open decision: whether `/play` should keep the "continue unfinished game" banner. Recommendation: yes, unchanged.

## 2. Typography and font stack

Problem: `layout.tsx` loads Geist (Latin only). Every visible string is Chinese and falls back to whatever the OS has, so the app looks different on Windows, macOS, and Android, and Latin digits/labels sit in a different face than the CJK text.

Proposal:
- Keep Geist for Latin, add a CJK face after it. Use `next/font/google` `Noto_Sans_SC` with `subsets: ['latin']` and `display: 'swap'`, weights 400/500/700. Note: Google's `Noto Sans SC` subsetting for CJK is by unicode-range slices, which next/font handles; the full face is not downloaded up front.
- Set `--font-sans` to `var(--font-geist-sans), var(--font-noto-sc), system-ui, "PingFang SC", "Microsoft YaHei", sans-serif`.
- Set `lang="zh-CN"` (already done).
- Line height 1.6 for body text; the current `text-sm` paragraphs are dense for CJK.
- Numeric labels (玩家3, 任务 2/5, 投票 3/5) use `tabular-nums`.

Open decision: self-host Noto Sans SC (adds ~1–4 MB of woff2 slices to the repo via `next/font/local`) vs Google Fonts (external request). Recommendation: `next/font/google`; the build already depends on it for Geist.

## 3. Icons: lucide replaces emoji

Problem: emoji are used as the icon system (👑 🤖 👤 🗡️ 😇 😈 📜 ⚔️ 🎉 💀 🗳️ 🎯 🎭). They render differently per platform, cannot be colored, and read as informal.

Proposal (one-for-one map, all from `lucide-react`, already a dependency):

| Today | Replace with | Where |
|---|---|---|
| 👑 leader | `Crown` (already used in PlayerCircle) | DiscussionPanel header, TeamBuildingPanel |
| 🤖 / 👤 | `Bot` / `User` | every player chip and list |
| 🗡️ assassination | `Swords` | AssassinationPanel, PlayerCircle center |
| 😇 / 😈 team | colored dot: `bg-sky-400` good, `bg-rose-400` evil, or `ShieldCheck` / `Skull` | RoleReveal, GameOverPanel, VisionPanel |
| 📜 log / history | `ScrollText` | GameLog, HistoryPanel |
| ⚔️ quest | `Swords` or `Flag` | QuestPanel, quest phase label |
| 🗳️ vote | `Vote` | VotingPanel |
| 🎯 team building | `Target` (already used) | TeamBuildingPanel |
| 🎭 role reveal | `Drama` | RoleReveal, PlayerCircle center |
| 💬 discussion | `MessageCircle` (already used) | PlayerCircle center |
| 🎉 / 💀 outcome | `Trophy` / `Skull` (already imported in GameOverPanel) | GameOverPanel |
| ⚠️ warnings | `AlertTriangle` (already used) | all inline warnings |
| ✓ / ✗ | `Check` / `X` | vote results, quest results |
| 📢 system event | `Info` | GameLog |
| Role emoji in `ROLES` (🧙 🛡️ ⚔️ 🗡️ 🦹 👤 👻 😈) | keep the `emoji` field for now but add an `icon` field (lucide name) and switch consumers to it; drop `emoji` in a later pass | types.ts |

Rule: icons are 16 px inline with text, 20 px in headers, always `aria-hidden` with the text label next to them. No icon without a label.

## 4. Per-seat error UX

What exists after Phase A: `AISeatError` (seat label, short message, 重试 / 跳过) rendered inside whichever panel is active; system events for skips; HTTP 502/429 mapped to three messages.

Proposal to finish it:

1. **Seat badge on the circle.** When a seat has an error, `PlayerCircle` shows a small red `AlertTriangle` badge on that card (next to the crown position). Needs the error map to live in the store (`seatErrors: Record<number, {message, title}>`) instead of per-panel state, which B7 partly sets up. Clear the badge on retry success or skip.
2. **One error surface, not five.** Move the `AISeatError` render out of each panel into `app/game/page.tsx`, above the phase panel, driven by the store's `seatErrors`. Panels only write errors; the page renders them. Retry/skip handlers stay in the panel that owns the request, exposed via the store as `retrySeat(id)` / `skipSeat(id)` callbacks registered on mount.
3. **Message copy** (Chinese, keep short; English in `title`):
   - 502 provider → `AI 暂时不可用` + provider name
   - 502 unparseable → `AI 返回了无法解析的内容`
   - 429 → `请求过于频繁，请 N 秒后重试` (use `retryAfter` from the server; show a countdown on the 重试 button and disable it until then)
   - network/timeout on the client → `网络错误，请检查连接`
4. **Skip semantics stay as implemented** (REJECT / SUCCESS / empty speech / human takes over). Add a tooltip on 跳过 explaining what the skip does for this phase.
5. **Model-down banner.** If the same provider fails 3 times in one game, show a dismissible banner under the top bar: "Gemini 本局多次不可用，可在设置中换用其他模型" with a link to the settings panel (section 5). Count lives in the store.
6. **Loading state.** Replace the per-panel spinner text with one consistent row: avatar, model name, `Loader2`, and elapsed seconds (`思考中 · 12 s`). Elapsed time matters because calls take 3–20 s and the player otherwise assumes it hung.

## 5. Model settings panel

Goal: per-seat provider, temperature, max_tokens, and full/naive prompt mode, configurable in the lobby and (read-only) visible in the game.

### Data model

Extend `GameConfig` (persisted in the store):

```ts
interface SeatConfig { modelId: string }                // by AI_MODELS id
interface GenerationSettings { temperature?: number; maxTokens: number }  // undefined temperature = provider default
interface GameConfig {
  playerCount: number;
  seats: SeatConfig[];                 // length playerCount - 1 (the human seat is assigned at createGame)
  generation: GenerationSettings;      // global for now; per-seat later if wanted
  promptMode: 'full' | 'naive';
  variantRules: VariantRules;
  // enabledModels stays for backward compatibility with saved configs; derived from seats
}
```

`createGame` takes `seats` in order instead of shuffling `enabledModels`. The human seat index stays random (or becomes a setting: "let me pick my seat").

`Player.aiModel` stays as is (the full `AIModel` object), so nothing downstream changes.

### Request path

- Client posts `{ gameState, playerId, action, recentSpeeches, generation, promptMode }`.
- `route.ts` validates with the zod schema from B6: `promptMode` enum, `generation.temperature` in [0, 1.5] or absent, `generation.maxTokens` integer in [50, 1000], `player.aiModel.model` must match an entry in `AI_MODELS`.
- `callAIProvider(model, prompt, action, { temperature, maxTokens })` — new optional fourth argument threaded into the five provider functions. Anthropic/OpenAI/DeepSeek/xAI: `temperature` and `max_tokens`/`max_completion_tokens`; Google: `generationConfig.temperature` / `maxOutputTokens`.
- `build*Prompt(..., mode)` already accept `mode`; the route passes `promptMode` through.

### Lobby UI

Replace the "AI 模型" checkbox card with a **seat list**:

- One row per AI seat: seat number, a `Select` (shadcn `select.tsx` was deleted in Phase A; re-add it from the shadcn registry) listing the five models with their color dot, and a small "same for all" button at the top that copies row 1's choice down.
- Below the list, a collapsible **高级设置 / Advanced** section:
  - Prompt mode: two radio buttons, 完整策略 (full) / 基础 (naive), with one line explaining that "naive" is the experiment's baseline.
  - Temperature: slider 0–1.5 step 0.1 with a "provider default" checkbox that disables the slider (maps to `undefined`).
  - Max tokens: number input 50–1000, default 300.
- The variant-rules card stays.

### In-game

- The top bar gets a small `Settings` icon that opens a read-only dialog listing the seat→model map, mode, temperature, max tokens. Changing settings mid-game is not supported in this pass (it would invalidate the experiment framing); the dialog says so.

### Effort

Data model + createGame + store migration: 3 h. Route validation + dispatch options: 2 h. Lobby seat list + advanced section: 5 h. In-game read-only dialog: 1 h. Tests for createGame seat order and the zod schema: 2 h. Total ~13 h, all implementable from this spec.

### Risks

- Saved configs in visitors' localStorage have the old shape; the store's `persist` needs a `version` bump and a `migrate` that builds `seats` from `enabledModels`.
- Per-seat temperature would multiply the settings UI; keep generation settings global in this pass.
- Client-chosen `maxTokens` up to 1000 raises per-call cost by up to ~3×; the server-side cap in the zod schema is the only control. If the site is public, keep the cap at 500.

## 6. Order of work (suggested)

1. Icons (section 3) and font stack (section 2): mechanical, low risk, most visible. ~4 h.
2. Error UX consolidation (section 4, items 1–3, 6): depends on B7's store changes. ~5 h.
3. Landing page (section 1): independent. ~4 h.
4. Model settings panel (section 5): largest; do last. ~13 h.

Everything above keeps the current layout grid, the dark slate/amber palette, and the Chinese copy.

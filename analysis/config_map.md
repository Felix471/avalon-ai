# Config naming map

Single source of truth linking repo config labels to paper labels, exact model API strings,
collection dates, prompt mode, and game counts. Model strings and dates are taken from the raw
data itself (`players[].model` and `timestamp` in `data/games.jsonl`, verified across every player
of every game); prompt mode from `scripts/configs.ts`.

| Repo config label | Paper label | Exact model API string(s) | Collection dates (UTC) | Prompt mode | n |
|---|---|---|---|---|---|
| `heterogeneous-full` | Het-full | claude-sonnet-4-6, gpt-5.4-mini, gemini-2.5-flash, deepseek-chat, grok-4-fast-non-reasoning (one player each) | 2026-04-17 19:21 – 04-18 01:22 | full | 20 |
| `homogeneous-gpt4o` | GPT-full | gpt-5.4-mini ×5 | 2026-04-18 01:22 – 01:48 | full | 15 |
| `homogeneous-claude` | Claude-full | claude-sonnet-4-6 ×5 | 2026-04-18 01:58 – 02:59 | full | 15 |
| `heterogeneous-naive` | Het-naive | same 5 as Het-full | 2026-04-18 03:04 – 04:23 | naive | 15 |
| `homogeneous-deepseek` | DeepSeek | deepseek-chat ×5 | 2026-04-19 23:49 – 04-20 00:46 | full | 15 |
| `homogeneous-grok` | Grok | grok-4-fast-non-reasoning ×5 | 2026-04-20 00:49 – 01:12 | full | 15 |
| `homogeneous-gemini` | Gemini | gemini-2.5-flash ×5 | 2026-04-20 02:09 – 05:47 | full | 15 |
| `homogeneous-gpt-naive` | GPT-naive | gpt-5.4-mini ×5 | 2026-04-20 14:26 – 14:50 | naive | 15 |
| `homogeneous-claude-naive` | Claude-naive | claude-sonnet-4-6 ×5 | 2026-04-20 15:00 – 16:19 | naive | 15 |

Total: 140 games, collected in four rounds (cumulative 65 → 95 → 110 → 140):
rows 1–4 (Apr 17–18), rows 5–6 (Apr 19–20), row 7 (Apr 20 early), rows 8–9 (Apr 20 afternoon).

## Label caveats (why this map exists)

- **`homogeneous-gpt4o` does not run GPT-4o.** The label predates commit `ef8305b`
  ("Update LLM model identifiers to April 2026 versions"), which swapped the model strings under
  unchanged config ids. Two Apr-17 pilot games with the original models (gpt-4o, gemini-2.5-pro,
  claude-sonnet-4-20250514, grok-3-latest) were removed from `data/games.jsonl` before release and
  are not part of the 140-game dataset. Use paper label **GPT-full**.
- **"Grok 4" in the UI is `grok-4-fast-non-reasoning`** (`lib/game/types.ts:144-150`) — the fast
  non-reasoning variant, not mainline Grok 4. Papers should cite the exact string.
- `deepseek-chat` is an unpinned provider alias (no version/date suffix); the other strings carry
  no dated snapshot either. Collection dates above bound which server-side versions were live.
- Generation parameters are per-provider, not per-config (`lib/ai/dispatch.ts`): 300 max output
  tokens at provider-default temperature for Anthropic/OpenAI/DeepSeek/xAI
  (`max_completion_tokens` for gpt-5*), but Gemini runs at temperature 0.7 with 4096 max tokens,
  an extra system instruction, and post-hoc truncation to 500 chars.

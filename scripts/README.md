# Batch Runner

Headless batch execution pipeline for AI-only Avalon games.

## Prerequisites

1. Copy `.env.local` with all required API keys:
   ```
   ANTHROPIC_API_KEY=...
   OPENAI_API_KEY=...
   GOOGLE_API_KEY=...
   DEEPSEEK_API_KEY=...
   XAI_API_KEY=...
   ```

2. Install dependencies: `npm install`

## Running Games

```bash
# Run 10 games per config (90 total across all 9 configs)
npm run batch -- --games=10 --configs=all

# Run 1 game for a specific config (smoke test)
npm run batch -- --games=1 --configs=heterogeneous-full

# Run multiple specific configs
npm run batch -- --games=5 --configs=heterogeneous-full,homogeneous-gpt4o
```

### Available configs

Exact model API strings (see `analysis/config_map.md` for paper labels and collection dates).
Because `scripts/configs.ts` references models by `id`, running the batch today uses the current strings from `lib/game/types.ts`, not the ones in the table.
Note: `homogeneous-gpt4o` is a historical label — it runs **gpt-5.4-mini**, not GPT-4o (model
identifiers were updated in commit `ef8305b` without renaming config ids).

| Config | Models (exact API strings) | Prompt mode |
|--------|---------------------------|-------------|
| `heterogeneous-full` | claude-sonnet-4-6, gpt-5.4-mini, gemini-2.5-flash, deepseek-chat, grok-4-fast-non-reasoning | Full strategy prompts |
| `homogeneous-gpt4o` | 5× gpt-5.4-mini | Full strategy prompts |
| `homogeneous-claude` | 5× claude-sonnet-4-6 | Full strategy prompts |
| `heterogeneous-naive` | claude-sonnet-4-6, gpt-5.4-mini, gemini-2.5-flash, deepseek-chat, grok-4-fast-non-reasoning | Naive baseline (no strategy) |
| `homogeneous-deepseek` | 5× deepseek-chat | Full strategy prompts |
| `homogeneous-grok` | 5× grok-4-fast-non-reasoning | Full strategy prompts |
| `homogeneous-gemini` | 5× gemini-2.5-flash | Full strategy prompts |
| `homogeneous-gpt-naive` | 5× gpt-5.4-mini | Naive baseline (no strategy) |
| `homogeneous-claude-naive` | 5× claude-sonnet-4-6 | Naive baseline (no strategy) |

### Output files

- `data/games.jsonl` — One JSON line per completed game
- `data/failures.jsonl` — One JSON line per failed game

## Generating Reports

```bash
npm run metrics
```

Reads `data/games.jsonl` and writes:
- `results/summary.md` — Human-readable metric report
- `results/stats.json` — Machine-readable stats for further analysis

## Concurrency

Games run with concurrency level 2 (`p-limit(2)`). LLM calls within a game are sequential. Rate limits are handled with exponential backoff (max 3 retries, starting at 2s).

## Error Handling

- Provider 429/5xx, timeout, or network failure → exponential backoff, then a neutral decision recorded in `providerFailures`
- Malformed LLM output → validator fallback recorded in `fallbackCounts` (parser fallback counts only)
- Game crash → logged to `data/failures.jsonl`, next game continues
- `data/games.jsonl` was collected before `providerFailures` and the per-decision fallback fields existed, so historical rows do not contain them

## Prompt changes after collection

The team-building prompt now includes the leader's role, vision, game history, and prompt mode; the dataset was collected with a context-free team-building prompt. The web app now runs the same two discussion rounds per proposal as the batch runner.

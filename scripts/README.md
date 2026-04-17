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
# Run 10 games per config (40 total across all 4 configs)
npm run batch -- --games=10 --configs=all

# Run 1 game for a specific config (smoke test)
npm run batch -- --games=1 --configs=heterogeneous-full

# Run multiple specific configs
npm run batch -- --games=5 --configs=heterogeneous-full,homogeneous-gpt4o
```

### Available configs

| Config | Models | Prompt mode |
|--------|--------|-------------|
| `heterogeneous-full` | Claude, GPT-4o, Gemini Pro, DeepSeek, Grok | Full strategy prompts |
| `homogeneous-gpt4o` | 5× GPT-4o | Full strategy prompts |
| `homogeneous-claude` | 5× Claude Sonnet | Full strategy prompts |
| `heterogeneous-naive` | Claude, GPT-4o, Gemini Pro, DeepSeek, Grok | Naive baseline (no strategy) |

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

- LLM 429/503 → exponential backoff, then fallback response
- Malformed LLM output → validator fallback (random vote, default action, canned speech)
- Game crash → logged to `data/failures.jsonl`, next game continues
- Fallback usage tracked in each game's `fallbackCounts` field

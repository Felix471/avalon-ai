# avalon-ai — LLM agents playing Avalon (The Resistance: Avalon)

A study of multi-LLM social deduction, reproducing the setup of Lan et al. (EMNLP 2024) with
April-2026 models: 140 five-player AI-only games across 9 experimental configurations, plus a
playable Next.js web app (human vs 4 AI players) built on the same game engine and prompts.

- Models: claude-sonnet-4-6, gpt-5.4-mini, gemini-2.5-flash, deepseek-chat,
  grok-4-fast-non-reasoning
- Conditions: homogeneous (5× one model) and heterogeneous (one player per model), each with
  **full** strategy prompts or a **naive** baseline (strategy guidance stripped)
- All game dialogue is in Chinese; roles are 5-player standard (Merlin, Percival, Loyal,
  Assassin, Morgana)

See `analysis/config_map.md` for the authoritative config-label → paper-label → model-string map
(including one historical naming caveat: config `homogeneous-gpt4o` runs gpt-5.4-mini).

## Repository layout

| Path | What it is |
|---|---|
| `data/games.jsonl` | **Raw dataset**: 140 games, one JSON object per line (frozen — do not regenerate in place) |
| `scripts/` | Historical collection code: `batch.ts` (headless runner), `configs.ts` (9 configs), `metrics.ts` (report generator). See `scripts/README.md` |
| `results/` | Committed outputs of `npm run metrics` (`summary.md`, `stats.json`) |
| `analysis/` | Post-hoc analysis added after collection: statistics, camouflage metrics, LLM-judge self-rec re-annotation, naming map |
| `audit/` | Independent metrics audit of the above (`METRICS_AUDIT.md`) |
| `lib/game/` | Game engine (state machine, roles, vision) shared by app and batch runner |
| `lib/ai/dispatch.ts` | Provider dispatch layer (Anthropic/OpenAI/Google/DeepSeek/xAI, retry + fallback) |
| `lib/security/` | Prompt templates (full/naive modes) and input/output validators |
| `app/`, `components/` | Next.js web app (play against 4 AI players) |

## Pipeline

```
scripts/configs.ts ──> npm run batch ──> data/games.jsonl ──> npm run metrics ──> results/
                        (batch.ts)         (+ data/failures.jsonl                 (summary.md,
                                              for crashed games)                   stats.json)
                                                └──> analysis/ (stats.py, camouflage.ts,
                                                                 annotate_selfrec.ts)
```

## Data schema (`data/games.jsonl`, one game per line)

```jsonc
{
  "gameId": "1776...-abc12",
  "timestamp": "2026-04-18T01:22:37.101Z",   // game end, UTC
  "config": "homogeneous-gpt4o",              // one of the 9 config labels
  "players": [ { "id": 1, "role": "merlin", "model": "gpt-5.4-mini", "provider": "openai" } ],
  "teamProposals": [ {                        // every proposal, incl. rejected ones
    "questRound": 1, "proposalIndex": 1, "proposedBy": 3, "team": [3, 5],
    "votes": { "1": "approve", ... },         // empty {} = forced 5th-proposal team (no vote)
    "accepted": true
  } ],
  "quests": [ {                               // executed quests only
    "round": 1, "proposedBy": 3, "team": [3, 5],
    "votes": { ... },                         // votes of the accepted proposal
    "actions": { "3": "success", "5": "fail" }, // good players are always "success" by rule
    "result": "fail"
  } ],
  "discussions": [ { "round": 1, "phase": 1, "speakerId": 1, "content": "...", "timestamp": "..." } ],
  "assassination": { "attemptedBy": 4, "target": 1, "merlinId": 1, "correct": true } | null,
  "winner": "good" | "evil",
  "winReason": "three_quests_succeeded" | "three_quests_failed" | "merlin_assassinated" | "five_consecutive_rejects",
  "llmCallCount": 224, "durationMs": 220429,
  "fallbackCounts": { "voting": 0, "quest": 0, "discussion": 0, "teamBuilding": 0, "assassination": 0 }
}
```

Caveats a data user should know: `votes`/`actions` are post-validation values (raw LLM text is
only preserved for `discussions`); forced 5th-proposal teams have empty `votes` and
`accepted: true`; see `audit/METRICS_AUDIT.md` §1.2 for collection-time parsing details.

## Setup

```bash
npm install
cp .env.example .env.local   # fill in the 5 provider API keys
```

## Regenerating results/ (from the frozen dataset)

```bash
npm run metrics              # reads data/games.jsonl -> results/summary.md, results/stats.json
```

Do not re-run `npm run batch` expecting to reproduce `data/games.jsonl` — games are stochastic,
model aliases are provider-side moving targets, and new runs **append** to the dataset. Treat the
committed jsonl as frozen.

## Regenerating analysis/

```bash
python analysis/stats.py                             # per-config rates + Wilson CIs + full-vs-naive z-tests
npx tsx analysis/camouflage.ts                       # sabotage-by-round curves + early-camouflage rates
npx tsx analysis/annotate_selfrec.ts --pilot=50      # LLM-judge self-rec pilot (needs ANTHROPIC_API_KEY)
npx tsx analysis/annotate_selfrec.ts --full          # full re-annotation -> analysis/selfrec_annotations.jsonl
npx tsx analysis/annotate_selfrec.ts --make-sample   # 200-speech blind manual-review sample
```

`stats.py` and `camouflage.ts` are deterministic over the frozen dataset. The self-rec annotator
calls claude-sonnet-4-6 through `lib/ai/dispatch.ts` and caches verdicts by content hash in
`analysis/selfrec_cache.jsonl`, so reruns are idempotent and resumable.

## Playing the game yourself

```bash
npm run dev                  # http://localhost:3000 — human + 4 AI players
```

## License

MIT (see `LICENSE`).

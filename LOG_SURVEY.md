# Experiment Log Survey

Survey date: 2026-08-18  
Repository: `E:\GitHub\avalon-ai`  
Mode: read-only reconnaissance. The only survey-created repository file is this report.

## Executive summary

The canonical corpus is `data/games.jsonl`: 10,055,334 bytes and 140 UTF-8 JSONL records, with one completed five-player game per physical line. It is one aggregate file, not one file or directory per run. A pre-existing, untracked audit artifact, `audit/_removed_games.jsonl`, contains two older pilot records with the same schema, so there are 142 distinct run records physically present if that historical copy is included. `results/summary.md` and `results/stats.json` are derived aggregates. The intended failed-run stream, `data/failures.jsonl`, and the gitignored old-model archive are absent.

All 142 run lines parse and all required keys are present, but the canonical data has a serious semantic logging defect: when an ordered quest team repeats, `quests[].round` and sometimes `quests[].result` are copied from that team's first earlier quest. This affects 144/564 quest records in 95/140 canonical runs; 57 quest results in 40 runs are wrong, and 26 runs' logged quest-result totals contradict their top-level outcome. The recoverable mapping is: use the quest array index plus one as the actual round, derive a five-player quest's result from whether any `actions` value is `"fail"`, and use top-level `winner`/`winReason` as the final outcome.

Pre-existing worktree state was:

```text
 M package-lock.json
?? audit/
```

Neither item was changed by this survey.

# Step 1 — Where logs are written

## 1.1 Primary collection path

The fixed pipeline is:

```text
scripts/configs.ts
    -> npm run batch / scripts/batch.ts
    -> data/games.jsonl
       data/failures.jsonl (only if a run throws)
    -> npm run metrics / scripts/metrics.ts
    -> results/summary.md
       results/stats.json
```

| Artifact | Writing code and code path | Write behavior | Present now |
|---|---|---|---|
| `data/games.jsonl` | `scripts/batch.ts:250-503` runs a game; `:482-501` assembles the final object only after `game_over`; `:514-515` serializes; `:522-525` fixes the path; `:548` writes it | `fs.appendFileSync(file, JSON.stringify(log) + '\n')`. One compact JSON object per completed run; reruns append and do not truncate the old file. | Yes, tracked, 140 records |
| `data/failures.jsonl` | Per-game catch at `scripts/batch.ts:557-566`; fixed path at `:526` | Appends `{timestamp, config, error, gameNumber}` only after a caught run failure. A fatal error outside the task catch goes to stderr only (`:581-583`). | No |
| `results/summary.md` | `scripts/metrics.ts:75-82` reads every game, `:103-314` builds the report, `:315-316` writes it | Overwrites one aggregate Markdown document. | Yes, tracked |
| `results/stats.json` | `scripts/metrics.ts:320-338` | Overwrites one pretty-printed aggregate JSON document. | Yes, tracked |
| `analysis/camouflage.md` | `analysis/camouflage.ts:31-36` reads all games; `:103-104` writes | Overwrites a later, derived Markdown analysis; not a collection log. | Yes, tracked |
| `analysis/selfrec_cache.jsonl` | `analysis/annotate_selfrec.ts:70,105-119` | Appends one `{hash, verdict, quote}` object per newly judged speech. | No |
| `analysis/selfrec_annotations.jsonl` | `analysis/annotate_selfrec.ts:71,374-393` | `--full` overwrites JSONL with one successfully annotated discussion instance per line; speeches with unparsable judge replies are omitted. | No |
| `analysis/review_sample.csv` and `analysis/review_sample_verdicts.csv` | `analysis/annotate_selfrec.ts:328-355` | `--make-sample` overwrites two CSVs. | No |

`scripts/batch.ts` accepts only `--games=N` and `--configs=...` (`:99-128`). There is no output-directory or output-filename flag; paths are resolved relative to the process working directory, expected to be the repository root. Collection concurrency is two games (`:534`), while calls within one game are sequential.

The collection log stores validated/cleaned discussion text. Team-building, voting, quest-action, and assassination responses are reduced to structured values before logging; their raw provider responses are not retained. Full prompts are not fields in the run log.

## 1.2 Other logging-like paths that do not create repository files

- The interactive web game uses Zustand persistence in `lib/game/store.ts:89-90,242-259`, browser `localStorage` key `avalon-game-storage`, retaining `config` and `gameState`. This is browser-profile storage, not a repository path and not the 140-run batch corpus. Its physical disk representation is browser-dependent and was not present to inspect.
- `lib/security/outputValidator.ts:198-218` constructs a suspicious-activity object but only sends it to `console.warn`; its monitoring-service call is a TODO.
- Provider/API errors and batch progress are sent to stdout/stderr. They become files only if an external process redirects or captures them. That is an inference about an external runner, not a project-written artifact.
- No FileHandler, rotating handler, `createWriteStream`, Winston, Pino, Bunyan, or equivalent file logger exists in the searched source.
- `analysis/stats.py` and the pre-existing `audit/recompute.py` open `data/games.jsonl` only for reading.

## 1.3 Ignore rules and missing candidates

The only experiment-data-specific ignore rule is:

```text
.gitignore:51:data/games_old_models_archive.jsonl
```

That archive does not exist. `data/failures.jsonl` is not ignored, does not exist, and has no reachable Git history. The optional self-recognition outputs are also absent and are not ignored. `.env.local` is ignored and absent. Existing ignored `node_modules/`, `.idea/`, build, and debug-log patterns are not experiment logs.

### Commands and truncated output

```powershell
rg -n --hidden -g '!node_modules/**' -g '!.git/**' -g '!LOG_SURVEY.md' 'fs\.(write|append|create|mkdir|rename|copy|rm|unlink|truncate)|write_text|write_bytes|to_csv|to_json|json\.dump|localStorage|sessionStorage|persist\(|FileHandler|RotatingFileHandler|basicConfig' .
```

```text
scripts/metrics.ts:91:    fs.mkdirSync(resultsDir, { recursive: true });
scripts/metrics.ts:316:  fs.writeFileSync(summaryPath, ...)
scripts/metrics.ts:338:  fs.writeFileSync(statsPath, ...)
scripts/batch.ts:510:    fs.mkdirSync(dirPath, { recursive: true });
scripts/batch.ts:515:  fs.appendFileSync(filePath, JSON.stringify(data) + '\n');
lib/game/store.ts:90:  persist(
lib/game/store.ts:121: localStorage.removeItem('avalon-game-storage')
analysis/camouflage.ts:104:fs.writeFileSync(outPath, ...)
analysis/annotate_selfrec.ts:119:fs.appendFileSync(CACHE_PATH, ...)
analysis/annotate_selfrec.ts:345,349,393:fs.writeFileSync(...)
[no file-handler/logger-library matches]
```

```powershell
rg -n --glob '*.py' '\bopen\s*\(' .
```

```text
analysis/stats.py:62: games = [... for l in open('data/games.jsonl', encoding='utf-8')]
audit/recompute.py:28: games = [... for l in open('data/games.jsonl', encoding='utf-8')]
[both omit a write mode and are read-only]
```

```powershell
rg -n --hidden -g '!node_modules/**' -g '!.git/**' -g '!LOG_SURVEY.md' 'FileHandler|RotatingFileHandler|createWriteStream|winston|pino|bunyan|logging\.|basicConfig' .
```

```text
[no matches; rg exit 1]
```

```powershell
rg -n --glob '*.{ts,tsx,js,jsx,py,md,json}' -g '!LOG_SURVEY.md' -- '--(games|configs|output|out|log|logs|result|results|dump|trace|save|record)(=|\b)' .
```

```text
scripts/batch.ts:105:    if (arg.startsWith('--games='))
scripts/batch.ts:111:    if (arg.startsWith('--configs='))
scripts/README.md:22,25,28: examples of those two flags
[no output/log/dump/result path flag]
```

```powershell
$paths=@('data/games.jsonl','data/failures.jsonl','data/games_old_models_archive.jsonl','analysis/selfrec_cache.jsonl','analysis/selfrec_annotations.jsonl','analysis/review_sample.csv','analysis/review_sample_verdicts.csv','results/summary.md','results/stats.json','.env.local')
foreach ($p in $paths) { "$p exists=$(Test-Path -LiteralPath $p)" }
git check-ignore -v data/games_old_models_archive.jsonl .env.local
```

```text
data/games.jsonl exists=True
data/failures.jsonl exists=False
data/games_old_models_archive.jsonl exists=False
analysis/selfrec_cache.jsonl exists=False
analysis/selfrec_annotations.jsonl exists=False
analysis/review_sample.csv exists=False
analysis/review_sample_verdicts.csv exists=False
results/summary.md exists=True
results/stats.json exists=True
.env.local exists=False
.gitignore:51:data/games_old_models_archive.jsonl ...
.gitignore:34:.env* .env.local
```

```powershell
git ls-files --others --exclude-standard -- data results analysis audit
git ls-files --others --ignored --exclude-standard -- data results analysis audit
```

```text
audit/METRICS_AUDIT.md
audit/_fp_samples.txt
audit/_removed_games.jsonl
audit/recompute.py
[second command: no output; no ignored candidate exists in these directories]
```

# Step 2 — Inventory on disk

## 2.1 Candidate directory totals

Filesystem mtimes below are the current checkout's local EDT mtimes. They are not collection timestamps. Because tracked files share checkout-like August mtimes while their embedded data are from April, treating those mtimes as run dates would be wrong.

| Directory | All files | Total bytes | Earliest mtime | Latest mtime | Relevant contents |
|---|---:|---:|---|---|---|
| `data/` | 1 | 10,055,334 | 2026-08-11 19:05:43 -04:00 (`games.jsonl`) | same | Canonical aggregate, 140 runs |
| `results/` | 2 | 9,873 | 2026-08-11 19:05:44 -04:00 | same | `stats.json` 3,112 B; `summary.md` 6,761 B |
| `analysis/` | 5 | 29,791 | 2026-08-11 19:30:51 (`camouflage.ts`) | 2026-08-11 19:33:42 (`config_map.md`) | Three code files, `config_map.md`, and generated `camouflage.md` (1,995 B); no per-run logs |
| `audit/` | 4 | 137,608 | 2026-08-11 19:12:17 (`_removed_games.jsonl`) | 2026-08-11 19:17:36 (`METRICS_AUDIT.md`) | Pre-existing untracked audit material; includes two historical runs |

There are no per-run filenames. Relevant names are fixed aggregate names: `games.jsonl`, `failures.jsonl`, `summary.md`, and `stats.json`. The audit files use a leading underscore but are not generated by the current collection source.

Exact directory members are:

| Directory | Files (bytes) |
|---|---|
| `data/` | `games.jsonl` (10,055,334) |
| `results/` | `stats.json` (3,112), `summary.md` (6,761) |
| `analysis/` | `annotate_selfrec.ts` (16,300), `camouflage.ts` (3,729), `stats.py` (4,869), `camouflage.md` (1,995), `config_map.md` (2,898) |
| `audit/` | `_removed_games.jsonl` (107,129), `_fp_samples.txt` (857), `recompute.py` (5,494), `METRICS_AUDIT.md` (24,128) |

## 2.2 Run counts, size pattern, and dates

| Artifact | Container | Run records | Size | Internal date range | Per-run or aggregate |
|---|---|---:|---:|---|---|
| `data/games.jsonl` | UTF-8 JSONL | 140 | 10,055,334 B | 2026-04-17T19:21:29.395Z through 2026-04-20T16:19:22.248Z | Aggregate file; one line per run |
| `audit/_removed_games.jsonl` | UTF-8 JSONL | 2 | 107,129 B | 2026-04-17T18:22:23.023Z through 2026-04-17T18:35:10.921Z | Historical aggregate copy; one line per run |
| `results/stats.json` | One JSON document | 0 per-run records | 3,112 B | Generated 2026-04-23T03:17:07.073Z, stated in sibling summary | Aggregate by config/model/round |
| `results/summary.md` | Markdown | 0 | 6,761 B | Embedded generation time 2026-04-23T03:17:07.073Z | Human-readable aggregate |
| `analysis/camouflage.md` | Markdown | 0 | 1,995 B | Analysis layer added/generated 2026-08-11 | Derived aggregate |

Canonical JSONL line payloads are variable-length because games have different proposal/discussion counts: 20,843–142,232 UTF-8 bytes per logical record, mean 71,821.8 bytes excluding line terminators.

The 140 canonical records form clear config batches:

| Config | Runs | First completion | Last completion |
|---|---:|---|---|
| `heterogeneous-full` | 20 | 2026-04-17T19:21:29.395Z | 2026-04-18T01:22:30.234Z |
| `homogeneous-gpt4o` | 15 | 2026-04-18T01:22:37.101Z | 2026-04-18T01:48:50.321Z |
| `homogeneous-claude` | 15 | 2026-04-18T01:58:22.655Z | 2026-04-18T02:59:46.721Z |
| `heterogeneous-naive` | 15 | 2026-04-18T03:04:12.426Z | 2026-04-18T04:23:25.746Z |
| `homogeneous-deepseek` | 15 | 2026-04-19T23:49:57.771Z | 2026-04-20T00:46:43.187Z |
| `homogeneous-grok` | 15 | 2026-04-20T00:49:21.310Z | 2026-04-20T01:12:54.644Z |
| `homogeneous-gemini` | 15 | 2026-04-20T02:09:43.211Z | 2026-04-20T05:47:33.542Z |
| `homogeneous-gpt-naive` | 15 | 2026-04-20T14:26:39.068Z | 2026-04-20T14:50:15.195Z |
| `homogeneous-claude-naive` | 15 | 2026-04-20T15:00:31.465Z | 2026-04-20T16:19:22.248Z |

## 2.3 Generations and provenance

There are two generations of the same run schema:

1. The two-run pilot, completed 2026-04-17 18:22–18:35 UTC, was committed in `e59787a`. The current untracked `audit/_removed_games.jsonl` is line-for-line equal to that historical `data/games.jsonl`.
2. Public-release commit `2ff8d58` replaced those two lines with the current 140-run corpus (`+140/-2`), whose internal completion range is 2026-04-17 through 2026-04-20. The derived reports were generated on 2026-04-23.
3. The in-repo analysis layer was added on 2026-08-11 and produced `analysis/camouflage.md`. It is a later analysis generation, not new game collection.

The ignored name `data/games_old_models_archive.jsonl` suggests an intended pilot archive, but that file is absent and was never tracked in reachable history. The audit copy is untracked and was already present before this survey.

### Commands and truncated output

```powershell
foreach ($d in @('data','results','analysis','audit')) {
  $files=@(Get-ChildItem -LiteralPath $d -File -Recurse -Force)
  $sum=($files|Measure-Object Length -Sum).Sum
  $early=$files|Sort-Object LastWriteTime|Select-Object -First 1
  $late=$files|Sort-Object LastWriteTime -Descending|Select-Object -First 1
  "{0}: files={1} bytes={2} earliest={3} ({4}) latest={5} ({6})" -f $d,$files.Count,$sum,$early.LastWriteTime,$early.Name,$late.LastWriteTime,$late.Name
}
```

```text
data: files=1 bytes=10055334 earliest=08/11/2026 19:05:43 (games.jsonl) latest=... (games.jsonl)
results: files=2 bytes=9873 earliest=08/11/2026 19:05:44 (summary.md) latest=... (stats.json)
analysis: files=5 bytes=29791 earliest=08/11/2026 19:30:51 (camouflage.ts) latest=08/11/2026 19:33:42 (config_map.md)
audit: files=4 bytes=137608 earliest=08/11/2026 19:12:17 (_removed_games.jsonl) latest=08/11/2026 19:17:36 (METRICS_AUDIT.md)
```

```powershell
$paths=@('data/games.jsonl','audit/_removed_games.jsonl')
foreach ($path in $paths) {
  $rows=@(); $bad=0; $n=0
  foreach ($line in Get-Content -LiteralPath $path -Encoding UTF8) {
    $n++
    try {
      $g=$line|ConvertFrom-Json -ErrorAction Stop
      $rows += [pscustomobject]@{Line=$n;GameId=$g.gameId;Timestamp=[datetimeoffset]::Parse($g.timestamp);Config=$g.config}
    } catch {$bad++}
  }
  $ordered=@($rows|Sort-Object Timestamp)
  "FILE $path bytes=$((Get-Item $path).Length) lines=$n parsed=$($rows.Count) malformed=$bad"
  "min=$($ordered[0].Timestamp.ToString('o')) line=$($ordered[0].Line) id=$($ordered[0].GameId)"
  "max=$($ordered[-1].Timestamp.ToString('o')) line=$($ordered[-1].Line) id=$($ordered[-1].GameId)"
}
```

```text
FILE data/games.jsonl bytes=10055334 lines=140 parsed=140 malformed=0
min=2026-04-17T19:21:29.3950000+00:00 line=1 id=1776453329940-bvvf9
max=2026-04-20T16:19:22.2480000+00:00 line=140 id=1776701240615-6ius8
FILE audit/_removed_games.jsonl bytes=107129 lines=2 parsed=2 malformed=0
min=2026-04-17T18:22:23.0230000+00:00 line=1 id=1776449648577-6ogw8
max=2026-04-17T18:35:10.9210000+00:00 line=2 id=1776449648607-62swr
```

```powershell
git log --follow --date=iso-strict --format="%h %ad %s" -- data/games.jsonl
git diff --numstat e59787a 2ff8d58 -- data/games.jsonl
$old=@(git show e59787a:data/games.jsonl)
$disk=[IO.File]::ReadAllLines((Resolve-Path 'audit/_removed_games.jsonl'))
for ($i=0; $i -lt $disk.Count; $i++) {"line=$($i+1) equal=$($old[$i].Trim() -eq $disk[$i].Trim())"}
```

```text
2ff8d58 2026-04-23T00:27:59-04:00 Public release: ...
e59787a 2026-04-17T15:05:14-04:00 update
140  2  data/games.jsonl
line=1 equal=True
line=2 equal=True
```

# Step 3 — Format characterization

## 3.1 Container and encoding

- `data/games.jsonl` and `audit/_removed_games.jsonl` are JSON Lines: one complete JSON document per nonempty physical line. Neither file is wrapped in a JSON array.
- One line is one run; one directory is not one run.
- Both are strict UTF-8 without BOM or replacement characters and end with a newline.
- In this checkout, tracked `data/games.jsonl` has CRLF terminators; the untracked audit copy has LF. `scripts/batch.ts` writes `'\n'`, while local `core.autocrlf=true` explains the tracked checkout form. A reader should accept either.
- Embedded line breaks in `discussions[].content` are escaped within the JSON string, so they do not split physical JSONL records.
- Each run contains separate, flat `players`, `teamProposals`, `quests`, and `discussions` arrays. There is no unified event stream and no nesting under round objects. `discussions` is chronological; proposals and quests are separate chronological arrays.

The invariant observed top-level signature is:

```text
{
  gameId:string,
  timestamp:string,
  config:string,
  players:array,
  teamProposals:array,
  quests:array,
  discussions:array,
  assassination:object|null,
  winner:string,
  winReason:string,
  llmCallCount:number,
  durationMs:number,
  fallbackCounts:object
}
```

## 3.2 Five runs spanning the full on-disk date range

These include the absolute oldest record, the oldest canonical record, two intermediate records, and the absolute newest record.

| Artifact and line | Run ID | Completion timestamp | Config | Players / proposals / quests / discussions | Assassination | Outcome |
|---|---|---|---|---:|---|---|
| `audit/_removed_games.jsonl:1` | `1776449648577-6ogw8` | 2026-04-17T18:22:23.023Z | heterogeneous-full | 5 / 4 / 3 / 40 | object | good / three_quests_succeeded |
| `data/games.jsonl:1` | `1776453329940-bvvf9` | 2026-04-17T19:21:29.395Z | heterogeneous-full | 5 / 6 / 4 / 60 | null | evil / three_quests_failed |
| `data/games.jsonl:70` | `1776642987532-fob9d` | 2026-04-20T00:04:02.385Z | homogeneous-deepseek | 5 / 11 / 3 / 90 | object | evil / merlin_assassinated |
| `data/games.jsonl:105` | `1776657985949-oebaf` | 2026-04-20T04:35:55.352Z | homogeneous-gemini | 5 / 14 / 5 / 140 | null | evil / three_quests_failed |
| `data/games.jsonl:140` | `1776701240615-6ius8` | 2026-04-20T16:19:22.248Z | homogeneous-claude-naive | 5 / 11 / 5 / 110 | object | good / three_quests_succeeded |

All five have the signature above. The only top-level type variation is the expected nullable `assassination`.

The following are compact re-serializations of observed nested records. Field names and values are unchanged; only long `content` strings have an inserted `…[truncated]` marker at about 100 characters.

### Oldest: `audit/_removed_games.jsonl:1`

```json
{"questRound":3,"proposalIndex":1,"proposedBy":3,"team":[2,4],"votes":{"1":"reject","2":"approve","3":"approve","4":"reject","5":"reject"},"accepted":false}
{"round":2,"proposedBy":2,"team":[1,2,3],"votes":{"1":"approve","2":"approve","3":"reject","4":"approve","5":"reject"},"actions":{"1":"success","2":"success","3":"success"},"result":"success"}
{"round":3,"phase":1,"speakerId":3,"content":"好了，现在是赛点局了，2比0，我们不能出任何差错。现在最稳妥的思路，就是相信前两轮成功任务的成员，他们是已经验证过的好人。所以我的组队思路会很简单，优先考虑上过之前成功任务的人。我作为队长肯定要上车承…[truncated]","timestamp":"2026-04-17T18:18:05.358Z"}
```

### Oldest canonical: `data/games.jsonl:1`

```json
{"questRound":3,"proposalIndex":2,"proposedBy":5,"team":[1,3],"votes":{"1":"approve","2":"reject","3":"approve","4":"reject","5":"reject"},"accepted":false}
{"round":3,"proposedBy":1,"team":[1,3],"votes":{"1":"approve","2":"approve","3":"approve","4":"reject","5":"reject"},"actions":{"1":"fail","3":"fail"},"result":"fail"}
{"round":3,"phase":1,"speakerId":5,"content":"大家好，我是玩家5，这次我来选队。任务已经1比1了，第3轮不能再出岔子，得尽快推进好人胜利。回想前两轮，玩家1在投票时有点犹豫，感觉像在观察大家的反应，不太果断。玩家3在上轮任务讨论中推了些奇怪的逻辑…[truncated]","timestamp":"2026-04-17T19:18:32.038Z"}
```

### Middle: `data/games.jsonl:70`

This sample shows the intentional empty-vote encoding for a forced fifth proposal.

```json
{"questRound":2,"proposalIndex":5,"proposedBy":1,"team":[2,3,5],"votes":{},"accepted":true}
{"round":2,"proposedBy":1,"team":[2,3,5],"votes":{},"actions":{"2":"success","3":"success","5":"success"},"result":"success"}
{"round":2,"phase":2,"speakerId":5,"content":"作为队长，我提出这个队伍是经过慎重考虑的。连续否决三次后我们必须推进任务，2号和3号在前期的逻辑分析一直比较积极，尤其是2号多次表现出对任务成功的关心。派西维尔的信息确实关键，但当前阶段我们更需要实际…[truncated]","timestamp":"2026-04-19T23:59:40.348Z"}
```

### Later: `data/games.jsonl:105`

The quest excerpt is genuinely contradictory because of the stale-team logging bug described in Step 5.

```json
{"questRound":3,"proposalIndex":1,"proposedBy":2,"team":[1,2],"votes":{"1":"approve","2":"approve","3":"reject","4":"approve","5":"reject"},"accepted":true}
{"round":1,"proposedBy":2,"team":[1,2],"votes":{"1":"approve","2":"approve","3":"reject","4":"approve","5":"reject"},"actions":{"1":"success","2":"fail"},"result":"success"}
{"round":3,"phase":1,"speakerId":2,"content":"好的，我是队长。现在好人两胜，这一轮非常关键，我们必须确保它成功。我提议的队伍是：玩家2（我）、玩家4和玩家1。玩家1在之前的发言中表现得比较稳健，我觉得他值得信任。玩家4之前还没有上过任务，我想给他…[truncated]","timestamp":"2026-04-20T04:20:17.233Z"}
```

### Newest: `data/games.jsonl:140`

```json
{"questRound":4,"proposalIndex":1,"proposedBy":5,"team":[1,3,5],"votes":{"1":"reject","2":"approve","3":"approve","4":"reject","5":"reject"},"accepted":false}
{"round":1,"proposedBy":4,"team":[1,3],"votes":{"1":"approve","2":"approve","3":"approve","4":"reject","5":"reject"},"actions":{"1":"success","3":"success"},"result":"success"}
{"round":4,"phase":2,"speakerId":5,"content":"感谢大家的分析，我来回应一下。\n\n玩家1说他\"确认\"我是坏人，这个说法我需要正面回应——如果我真的是坏人，我作为队长完全可以直接塞进坏人，但我没有这么做，我反而在公开讨论、接受审查。\n\n综合大家意见，…[truncated]","timestamp":"2026-04-20T16:13:17.075Z"}
```

## 3.3 Other artifact formats

- `results/stats.json` is one indented JSON object, not JSONL. It has nine config-name keys plus `extendedMetrics`.
- `results/summary.md` is ordinary Markdown with a generation timestamp, per-config sections, model tables, and extended metrics.
- `analysis/camouflage.md` is ordinary Markdown generated from all 140 games.
- In the pre-existing untracked `audit/` directory, `_fp_samples.txt` is a short plain-text excerpt set, `METRICS_AUDIT.md` is a Markdown audit report, and `recompute.py` is analysis source; none is a run container.
- If created, `data/failures.jsonl` would be one failure object per line, not a partial `GameLog`.
- If created, `analysis/selfrec_annotations.jsonl` would be one speech annotation per line, not one game per line.
- The browser `localStorage` value does not map to any repository file and was not observed, so its actual serialized container cannot be characterized from disk here.

### Commands and truncated output

```powershell
git config --get core.autocrlf
$paths=@('data/games.jsonl','audit/_removed_games.jsonl')
foreach ($p in $paths) {
  $b=[IO.File]::ReadAllBytes((Resolve-Path $p)); $crlf=0; $lf=0
  for ($i=0; $i -lt $b.Length; $i++) {
    if ($b[$i] -eq 10) {$lf++; if ($i -gt 0 -and $b[$i-1] -eq 13) {$crlf++}}
  }
  "$p LF=$lf CRLF=$crlf bareLF=$($lf-$crlf) BOM=$($b.Length-ge3 -and $b[0]-eq239 -and $b[1]-eq187 -and $b[2]-eq191)"
}
```

```text
true
data/games.jsonl LF=140 CRLF=140 bareLF=0 BOM=False
audit/_removed_games.jsonl LF=2 CRLF=0 bareLF=2 BOM=False
```

```powershell
$specs=@(
  [pscustomobject]@{Path='audit/_removed_games.jsonl';Line=1;P=2;Q=1;D=20},
  [pscustomobject]@{Path='data/games.jsonl';Line=1;P=3;Q=2;D=30},
  [pscustomobject]@{Path='data/games.jsonl';Line=70;P=5;Q=1;D=45},
  [pscustomobject]@{Path='data/games.jsonl';Line=105;P=7;Q=2;D=70},
  [pscustomobject]@{Path='data/games.jsonl';Line=140;P=5;Q=2;D=55}
)
foreach ($s in $specs) {
  $g=([IO.File]::ReadAllLines((Resolve-Path $s.Path)))[$s.Line-1]|ConvertFrom-Json
  "RUN $($s.Path):$($s.Line) id=$($g.gameId) timestamp=$($g.timestamp) config=$($g.config)"
  "counts players=$($g.players.Count) proposals=$($g.teamProposals.Count) quests=$($g.quests.Count) discussions=$($g.discussions.Count)"
  $g.teamProposals[$s.P]|ConvertTo-Json -Compress -Depth 5
  $g.quests[$s.Q]|ConvertTo-Json -Compress -Depth 5
  $g.discussions[$s.D]|ConvertTo-Json -Compress -Depth 5
}
```

```text
RUN audit/_removed_games.jsonl:1 id=1776449648577-6ogw8 timestamp=2026-04-17T18:22:23.023Z config=heterogeneous-full
counts players=5 proposals=4 quests=3 discussions=40
{"questRound":3,...,"accepted":false}
{"round":2,...,"result":"success"}
{"round":3,"phase":1,"speakerId":3,"content":"好了，现在是赛点局了，...",...}
...
RUN data/games.jsonl:140 id=1776701240615-6ius8 timestamp=2026-04-20T16:19:22.248Z config=homogeneous-claude-naive
counts players=5 proposals=11 quests=5 discussions=110
```

# Step 4 — Field-by-field mapping

Presence counts in the main table use the canonical 140 records. The two historical pilots have the same key sets and types. “Every” for a nested field means every object of that parent type.

## 4.1 Completed-run schema

| JSON path | JSON type | Presence | Example | Meaning / caveat |
|---|---|---:|---|---|
| `$` | object | 140/140 runs | — | One completed game |
| `$.gameId` | string | 140/140 | `"1776453329940-bvvf9"` | Unique ID: 13-digit epoch-ms game-start prefix plus five random base-36 characters |
| `$.timestamp` | string | 140/140 | `"2026-04-17T19:21:29.395Z"` | Game completion time, ISO-8601 UTC |
| `$.config` | string | 140/140 | `"heterogeneous-full"` | Experimental condition label |
| `$.players` | array | 140/140 | five objects | Run's player metadata |
| `$.players[].id` | integer | 700/700 players | `1` | Player ID, always 1–5 |
| `$.players[].role` | string | 700/700 | `"assassin"` | Actual hidden role/persona: `assassin`, `loyal`, `merlin`, `morgana`, or `percival` |
| `$.players[].model` | string | 700/700 | `"claude-sonnet-4-6"` | Exact provider model identifier |
| `$.players[].provider` | string | 700/700 | `"anthropic"` | `anthropic`, `openai`, `google`, `deepseek`, or `xai` |
| `$.teamProposals` | array | 140/140 | 3–25 objects | All accepted and rejected proposals, chronological |
| `$.teamProposals[].questRound` | integer | 1,807/1,807 proposals | `1` | Reliable quest round, 1–5 |
| `$.teamProposals[].proposalIndex` | integer | 1,807/1,807 | `1` | Proposal attempt 1–5 inside that quest |
| `$.teamProposals[].proposedBy` | integer | 1,807/1,807 | `2` | Leader/player ID |
| `$.teamProposals[].team` | array of integers | 1,807/1,807 | `[1,2]` | Proposed player IDs; length two or three |
| `$.teamProposals[].votes` | object | 1,807/1,807 | `{"1":"reject",...}` | Usually all five votes; `{}` for a forced fifth team |
| `$.teamProposals[].votes.{playerId}` | string | All five keys in 1,624 proposals; absent together in 183 | `"1":"reject"` | `approve` or `reject`; 8,120 total values |
| `$.teamProposals[].accepted` | boolean | 1,807/1,807 | `true` | Majority accepted, or forced fifth team |
| `$.quests` | array | 140/140 | 3–5 objects | Executed quests, appended chronologically |
| `$.quests[].round` | integer | 564/564 quests | `1` | Intended quest round; unreliable when an ordered team repeats |
| `$.quests[].proposedBy` | integer | 564/564 | `2` | Accepted proposal's leader; reliable |
| `$.quests[].team` | array of integers | 564/564 | `[1,2]` | Actual current quest team; reliable |
| `$.quests[].votes` | object | 564/564 | `{"1":"reject",...}` | Accepted proposal votes, or `{}` for a forced team |
| `$.quests[].votes.{playerId}` | string | All five keys in 381 quests; absent together in 183 | `"1":"reject"` | `approve` or `reject`; 1,905 total values |
| `$.quests[].actions` | object | 564/564 | `{"1":"success","2":"success"}` | Current team member actions; reliable |
| `$.quests[].actions.{playerId}` | string | Two or three entries in every quest; 1,412 total | `"1":"success"` | `success` or `fail`. Keys exist only for team members |
| `$.quests[].result` | string | 564/564 | `"success"` | Intended quest outcome; unreliable when a team repeats |
| `$.discussions` | array | 140/140 | 30–200 objects | Flat chronological speech sequence |
| `$.discussions[].round` | integer | 16,240/16,240 speeches | `1` | Quest round 1–5; observed reliable |
| `$.discussions[].phase` | integer | 16,240/16,240 | `1` | Discussion pass 1 or 2 within one voted proposal; resets for each proposal attempt, not just each quest |
| `$.discussions[].speakerId` | integer | 16,240/16,240 | `2` | Speaking player ID; join to `players[].id` |
| `$.discussions[].content` | string | 16,240/16,240 | `"我是忠臣，..."` | Message text; observed length 15–500 characters |
| `$.discussions[].timestamp` | string | 16,240/16,240 | `"2026-04-17T19:15:31.321Z"` | Per-message ISO-8601 UTC timestamp |
| `$.assassination` | object or null | Key in 140/140; object in 49, null in 91 | `null` | Assassination-stage summary |
| `$.assassination.attemptedBy` | integer | 49/49 objects; 49/140 runs | `4` | Assassin player ID |
| `$.assassination.target` | integer | 49/49 | `3` | Chosen target player ID |
| `$.assassination.merlinId` | integer | 49/49 | `5` | Actual Merlin player ID |
| `$.assassination.correct` | boolean | 49/49 | `false` | Whether target equals Merlin |
| `$.winner` | string | 140/140 | `"evil"` | Final winner; 107 evil and 33 good |
| `$.winReason` | string | 140/140 | `"three_quests_failed"` | 91 `three_quests_failed`, 33 `three_quests_succeeded`, 16 `merlin_assassinated`; no observed five-reject result |
| `$.llmCallCount` | integer | 140/140 | `103` | Logical action-level model calls, range 49–331. Retries/tokens are not exposed |
| `$.durationMs` | integer | 140/140 | `359456` | Wall-clock run duration, range 108,731–3,623,068 ms |
| `$.fallbackCounts` | object | 140/140 | `{"voting":0,...}` | Parse/validation fallback counts by action; incomplete for provider fallback |
| `$.fallbackCounts.voting` | integer | 140/140 | `0` | Observed total 0 |
| `$.fallbackCounts.quest` | integer | 140/140 | `0` | Observed total 1 |
| `$.fallbackCounts.discussion` | integer | 140/140 | `0` | Observed total 0 despite 200 exact dispatcher-fallback messages |
| `$.fallbackCounts.teamBuilding` | integer | 140/140 | `0` | Observed total 24 |
| `$.fallbackCounts.assassination` | integer | 140/140 | `0` | Observed total 6 |

Dynamic `votes` and `actions` keys are JSON strings `"1"`–`"5"`, while player IDs elsewhere are JSON numbers.

## 4.2 Direct mapping for the requested concepts

| Concept | Mapping |
|---|---|
| Speaking agent | `$.discussions[].speakerId` |
| Agent role/persona | Join `speakerId` to `$.players[].id` and read `role` |
| Agent model/provider | Same join, then `model` and `provider` |
| Turn/round | Discussion: `discussions[].round`. Proposal: `teamProposals[].questRound` plus `proposalIndex`. Quest: use array index + 1, not the defective `quests[].round` |
| Phase/stage | Only `discussions[].phase`, numeric 1 or 2, meaning a pass within a proposal attempt. No general textual stage/event label is stored |
| Timestamp | Run completion at `$.timestamp`; per-message at `$.discussions[].timestamp`. No proposal/quest/action timestamp |
| Message text | `$.discussions[].content` |
| Tokens/cost | Not present. `llmCallCount` is a logical call count, not token use or cost |
| Final outcome | Inside each run at top-level `winner` and `winReason`; assassination detail in `assassination`. Not in filename or an event record |
| Experimental condition | `$.config`; exact model/provider per player. Prompt mode requires a source-code join to `scripts/configs.ts` |

`scripts/configs.ts:31-77` maps `heterogeneous-naive`, `homogeneous-gpt-naive`, and `homogeneous-claude-naive` to prompt mode `naive`; the other six current labels map to `full`. Prompt mode itself is not stored.

There is no `proposalIndex` on a discussion record. Consequently, `(round, phase, speakerId)` is not unique when a quest has repeated proposal attempts. Observed behavior and the writer agree: each of the 1,624 voted proposals contributes ten consecutive speeches (five speakers in each of two passes), while all 183 forced fifth proposals contribute none. To associate speeches with proposals, group each round's flat discussion stream chronologically into blocks of ten and align those blocks, in order, only with that round's proposals whose `votes` object is nonempty. That association is an inference from order plus the writer; it cannot be made from discussion fields alone.

## 4.3 Other JSON artifacts

### Declared failure record, currently unobservable

If `data/failures.jsonl` is created, source declares these fields:

| JSON path | Type | Meaning |
|---|---|---|
| `$.timestamp` | string | Failure time |
| `$.config` | string | Requested config |
| `$.error` | string | Caught exception message |
| `$.gameNumber` | integer | One-based loop number within that config invocation |

It has no `gameId`, partial events, model assignment, or elapsed duration. Because no file exists, actual error string shapes cannot be characterized. It is an inference that some exception messages could contain provider details; there is no observed failure sample.

### `results/stats.json`

This is a single aggregate object. `{config}` and `{model}` are dynamic object keys. All listed leaves are present for every applicable observed config, model, or round key.

| JSON path | Type | Presence | Example | Meaning |
|---|---|---:|---|---|
| `$` | object | 1/1 document | `{"heterogeneous-full":{...},...,"extendedMetrics":{...}}` | Aggregate root |
| `$.{config}` | object | 9 config keys | `"heterogeneous-full":{...}` | Per-condition aggregate |
| `$.{config}.n` | integer | 9/9 config objects | `20` | Runs in config |
| `$.{config}.goodWinRate` | number | 9/9 | `0.05` | Good wins / `n` |
| `$.{config}.evilWinRate` | number | 9/9 | `0.95` | Evil wins / `n` |
| `$.{config}.avgDurationSec` | number | 9/9 | `722.11505` | Mean `durationMs / 1000` |
| `$.{config}.avgLlmCalls` | number | 9/9 | `208.4` | Mean logical call count |
| `$.{config}.avgQuestsCompleted` | number | 9/9 | `4.45` | Mean quest-array length |
| `$.extendedMetrics` | object | 1/1 document | `{"verbosity":{...},...}` | Root for three derived analyses |
| `$.extendedMetrics.verbosity` | object | 1/1 | `{"claude-sonnet-4-6":{...},...}` | Per-model discussion-length aggregates |
| `$.extendedMetrics.verbosity.{model}` | object | 5 model keys | `"gpt-5.4-mini":{"goodAvg":109,"evilAvg":108}` | One model's role-group means |
| `$.extendedMetrics.verbosity.{model}.goodAvg` | number | 5/5 model objects | `109` | Mean discussion characters for good roles |
| `$.extendedMetrics.verbosity.{model}.evilAvg` | number | 5/5 | `108` | Mean discussion characters for evil roles |
| `$.extendedMetrics.sabotageByRound` | object | 1/1 | `{"1":0.5402,...,"5":0.8667}` | Round-keyed sabotage aggregate |
| `$.extendedMetrics.sabotageByRound.{1..5}` | number | 5/5 round keys | `"1":0.5402` | Sabotage share, but inherits the defective `quests[].round` |
| `$.extendedMetrics.selfRecommendations` | object | 1/1 | `{"heterogeneous-full":5.2,...}` | Per-config regex-count aggregates |
| `$.extendedMetrics.selfRecommendations.{config}` | number | 9/9 config keys | `"heterogeneous-full":5.2` | Regex-count mean per game |

`results/summary.md` presents related values as Markdown rather than JSON fields. Its round-indexed sabotage table also inherits the quest-round defect. `analysis/camouflage.md` groups directly by `q.round` (`analysis/camouflage.ts:49-57`), so its round curve and early-round camouflage results inherit the same defect.

### Declared post-hoc outputs, currently absent

These formats are observable from their writers but have no current on-disk samples:

| Artifact | Record/container fields |
|---|---|
| `analysis/selfrec_cache.jsonl` | One line per cached verdict: `hash` (SHA-256 string), `verdict` (boolean), `quote` (string) |
| `analysis/selfrec_annotations.jsonl` | One line per discussion annotation: `gameId`, `config`, `round`, `speaker`, `model`, `role`, `verdict`, `quote` |
| `analysis/review_sample.csv` | Header: `sample_id,config,gameId,round,speaker,model,role,content,manual_label` |
| `analysis/review_sample_verdicts.csv` | Header: `sample_id,judge_verdict,judge_quote` |

The annotation JSONL is speech-level, not run-level. The cache is content-hash-level and does not include a run ID.

No artifact contains prompt/completion tokens, currency/cost, API request IDs, random seed, temperature, code revision, batch command line, prompt version, full system/user prompts, or raw structured-action replies.

### Commands and truncated output

```powershell
function Get-JType($v) {
  if ($null -eq $v) {'null'} elseif ($v -is [string]) {'string'} elseif ($v -is [bool]) {'boolean'} elseif ($v -is [array]) {'array'} elseif ($v -is [pscustomobject]) {'object'} else {'number'}
}
function Get-Sig($o) {(($o.PSObject.Properties|ForEach-Object {"$($_.Name):$(Get-JType $_.Value)"}) -join ',')}
$games=[IO.File]::ReadAllLines((Resolve-Path 'data/games.jsonl'))|ForEach-Object {$_|ConvertFrom-Json}
"top:"; $games|ForEach-Object {Get-Sig $_}|Group-Object|ForEach-Object {"$($_.Count)x $($_.Name)"}
foreach ($name in @('players','teamProposals','quests','discussions')) {
  "${name}:"; $games.$name|ForEach-Object {Get-Sig $_}|Group-Object|ForEach-Object {"$($_.Count)x $($_.Name)"}
}
"assassination:"; $games.assassination|Where-Object {$_ -ne $null}|ForEach-Object {Get-Sig $_}|Group-Object|ForEach-Object {"$($_.Count)x $($_.Name)"}
"fallbackCounts:"; $games.fallbackCounts|ForEach-Object {Get-Sig $_}|Group-Object|ForEach-Object {"$($_.Count)x $($_.Name)"}
```

```text
top:
91x gameId:string,timestamp:string,config:string,players:array,teamProposals:array,quests:array,discussions:array,assassination:null,winner:string,winReason:string,llmCallCount:number,durationMs:number,fallbackCounts:object
49x gameId:string,timestamp:string,config:string,players:array,teamProposals:array,quests:array,discussions:array,assassination:object,winner:string,winReason:string,llmCallCount:number,durationMs:number,fallbackCounts:object
players:
700x id:number,role:string,model:string,provider:string
teamProposals:
1807x questRound:number,proposalIndex:number,proposedBy:number,team:array,votes:object,accepted:boolean
quests:
564x round:number,proposedBy:number,team:array,votes:object,actions:object,result:string
discussions:
16240x round:number,phase:number,speakerId:number,content:string,timestamp:string
assassination:
49x attemptedBy:number,target:number,merlinId:number,correct:boolean
fallbackCounts:
140x voting:number,quest:number,discussion:number,teamBuilding:number,assassination:number
```

```powershell
$props=@($games|ForEach-Object {$_.teamProposals}|ForEach-Object {$_})
$quests=@($games|ForEach-Object {$_.quests}|ForEach-Object {$_})
"proposalRecords=$($props.Count) emptyProposalVotes=$((@($props|Where-Object {@($_.votes.PSObject.Properties).Count -eq 0})).Count)"
"questRecords=$($quests.Count) emptyQuestVotes=$((@($quests|Where-Object {@($_.votes.PSObject.Properties).Count -eq 0})).Count)"
"proposal vote key counts="+(($props|ForEach-Object {@($_.votes.PSObject.Properties).Count}|Group-Object|Sort-Object Name|ForEach-Object {"$($_.Name):$($_.Count)"}) -join ', ')
"quest vote key counts="+(($quests|ForEach-Object {@($_.votes.PSObject.Properties).Count}|Group-Object|Sort-Object Name|ForEach-Object {"$($_.Name):$($_.Count)"}) -join ', ')
"action key counts="+(($quests|ForEach-Object {@($_.actions.PSObject.Properties).Count}|Group-Object|Sort-Object Name|ForEach-Object {"$($_.Name):$($_.Count)"}) -join ', ')
```

```text
proposalRecords=1807 emptyProposalVotes=183
questRecords=564 emptyQuestVotes=183
proposal vote key counts=0:183, 5:1624
quest vote key counts=0:183, 5:381
action key counts=2:280, 3:284
```

```powershell
$votedTotal=0; $forcedTotal=0; $discussionTotal=0; $groupIssues=0
foreach ($g in $games) { foreach ($round in 1..5) {
  $rp=@($g.teamProposals|Where-Object {$_.questRound -eq $round})
  $voted=@($rp|Where-Object {@($_.votes.PSObject.Properties).Count -gt 0})
  $forced=@($rp|Where-Object {@($_.votes.PSObject.Properties).Count -eq 0})
  $d=@($g.discussions|Where-Object {$_.round -eq $round})
  $votedTotal += $voted.Count; $forcedTotal += $forced.Count; $discussionTotal += $d.Count
  if ($d.Count -ne $voted.Count*10) {$groupIssues++}
  foreach ($phase in 1..2) { foreach ($playerId in 1..5) {
    if (@($d|Where-Object {$_.phase -eq $phase -and $_.speakerId -eq $playerId}).Count -ne $voted.Count) {$groupIssues++}
  }}
}}
"votedProposals=$votedTotal forcedProposals=$forcedTotal discussions=$discussionTotal expectedDiscussions=$($votedTotal*10) groupingIssues=$groupIssues"
```

```text
votedProposals=1624 forcedProposals=183 discussions=16240 expectedDiscussions=16240 groupingIssues=0
```

```powershell
$s=Get-Content -LiteralPath results/stats.json -Raw -Encoding UTF8 | ConvertFrom-Json
$configs=@($s.PSObject.Properties|Where-Object Name -ne 'extendedMetrics')
"configKeys=$($configs.Count) perConfigFieldSets=$((@($configs|ForEach-Object {$_.Value.PSObject.Properties.Name -join ','}|Select-Object -Unique)).Count)"
$e=$s.'heterogeneous-full'
"example heterogeneous-full: n=$($e.n) goodWinRate=$($e.goodWinRate) evilWinRate=$($e.evilWinRate) avgDurationSec=$($e.avgDurationSec) avgLlmCalls=$($e.avgLlmCalls) avgQuestsCompleted=$($e.avgQuestsCompleted)"
"verbosityModels=$(@($s.extendedMetrics.verbosity.PSObject.Properties).Count) example gpt-5.4-mini: goodAvg=$($s.extendedMetrics.verbosity.'gpt-5.4-mini'.goodAvg) evilAvg=$($s.extendedMetrics.verbosity.'gpt-5.4-mini'.evilAvg)"
"sabotageRounds=$(@($s.extendedMetrics.sabotageByRound.PSObject.Properties).Count) values=$((($s.extendedMetrics.sabotageByRound.PSObject.Properties|ForEach-Object {$_.Value}) -join ','))"
"selfRecommendationConfigs=$(@($s.extendedMetrics.selfRecommendations.PSObject.Properties).Count) heterogeneous-full=$($s.extendedMetrics.selfRecommendations.'heterogeneous-full')"
```

```text
configKeys=9 perConfigFieldSets=1
example heterogeneous-full: n=20 goodWinRate=0.05 evilWinRate=0.95 avgDurationSec=722.11505 avgLlmCalls=208.4 avgQuestsCompleted=4.45
verbosityModels=5 example gpt-5.4-mini: goodAvg=109 evilAvg=108
sabotageRounds=5 values=0.5402,0.7184,0.7719,0.8261,0.8667
selfRecommendationConfigs=9 heterogeneous-full=5.2
```

# Step 5 — Inconsistencies and data-quality findings

## 5.1 Format evolution: oldest versus newest

There is no field-level schema evolution across the full observed range. The oldest pilot, oldest canonical run, newest canonical run, both pilot lines, and all 140 canonical lines have identical top-level and nested key sets and JSON types. No field was added, removed, renamed, or retyped. `assassination` being object or null is outcome-dependent variation, not version drift.

Observed differences are value/model generations and normal run cardinalities:

| Property | Oldest on disk, pilot | Oldest canonical | Newest canonical |
|---|---|---|---|
| Timestamp | 2026-04-17T18:22:23.023Z | 2026-04-17T19:21:29.395Z | 2026-04-20T16:19:22.248Z |
| Config | heterogeneous-full | heterogeneous-full | homogeneous-claude-naive |
| Models | Five superseded mixed models | Five current mixed models | `claude-sonnet-4-6` ×5 |
| Proposals / quests / discussions | 4 / 3 / 40 | 6 / 4 / 60 | 11 / 5 / 110 |
| Assassination | object | null | object |
| Outcome | good / succeeded | evil / failed | good / succeeded |
| `llmCallCount` | 68 | 103 | 179 |
| `durationMs` | 494,447 | 359,456 | 721,634 |
| Recorded fallbacks | voting 1, quest 2 | all zero | all zero |

Within the same `heterogeneous-full` label, exact model strings changed:

| Provider | Two pilots | Canonical 20-run batch |
|---|---|---|
| Anthropic | `claude-sonnet-4-20250514` | `claude-sonnet-4-6` |
| OpenAI | `gpt-4o` | `gpt-5.4-mini` |
| Google | `gemini-2.5-pro` | `gemini-2.5-flash` |
| DeepSeek | `deepseek-chat` | `deepseek-chat` |
| xAI | `grok-3-latest` | `grok-4-fast-non-reasoning` |

There is no schema/version field to mark that change. Also, current config name `homogeneous-gpt4o` is stale: all 75 player entries under it say `model:"gpt-5.4-mini"`. A mapper should trust `players[].model` for the exact model and treat `config` as a historical condition label.

All remaining oldest/newest differences are ordinary run values rather than format changes: `gameId`/timestamps, role-to-player assignments, proposal teams/votes/acceptance, quest actions, discussion text/times, assassination IDs/correctness, call count, duration, and fallback counts. Their field names and encodings are unchanged.

### Comparison command and output

```powershell
$old=([IO.File]::ReadAllLines((Resolve-Path 'audit/_removed_games.jsonl')))[0]|ConvertFrom-Json
$new=([IO.File]::ReadAllLines((Resolve-Path 'data/games.jsonl')))[139]|ConvertFrom-Json
"topKeysEqual=$((($old.PSObject.Properties.Name -join ',') -eq ($new.PSObject.Properties.Name -join ',')))"
foreach ($c in @('players','teamProposals','quests','discussions')) {
  "$c keysEqual=$((($old.$c[0].PSObject.Properties.Name -join ',') -eq ($new.$c[0].PSObject.Properties.Name -join ',')))"
}
"old models=$($old.players.model -join '|')"
"new models=$($new.players.model -join '|')"
```

```text
topKeysEqual=True
players keysEqual=True
teamProposals keysEqual=True
quests keysEqual=True
discussions keysEqual=True
old models=claude-sonnet-4-20250514|gpt-4o|gemini-2.5-pro|deepseek-chat|grok-3-latest
new models=claude-sonnet-4-6|claude-sonnet-4-6|claude-sonnet-4-6|claude-sonnet-4-6|claude-sonnet-4-6
```

## 5.2 Malformed, empty, truncated, or error-terminated runs

| Check | Canonical result | Pilot result |
|---|---:|---:|
| Nonempty run records | 140 | 2 |
| JSON parse errors | 0 | 0 |
| Empty/whitespace records | 0 | 0 |
| Duplicate `gameId` values | 0 | 0 |
| Bad `gameId` format | 0 | 0 |
| Invalid run timestamps | 0 | 0 |
| Invalid discussion timestamps | 0 | 0 |
| File-truncated runs | 0 | 0 |
| Missing terminal outcome fields | 0 | 0 |
| Error-terminated records mixed into run stream | 0 observed | 0 observed |
| Semantic bad-round runs | 95 | 0 |
| Semantic bad-result runs | 40 | 0 |

The final newline produces an empty string only if a caller naïvely splits after the terminator; it is not a blank JSONL record. Every canonical record has five distinct players, the expected five-role set, nonempty proposals/quests/discussions, and a terminal winner/reason.

`data/failures.jsonl` is absent and was never committed. Therefore the number of attempted but failed/aborted games is not recoverable. Absence of the file is not proof that no failures ever happened; it proves only that no failure artifact is available in this checkout/history.

Ten canonical games report 31 fallback events: quest 1, team-building 24, assassination 6, voting 0, discussion 0. They all reached terminal outcomes and are not error-terminated.

Four individual discussion messages, rather than whole runs, are visibly truncated at exactly 500 characters. They are covered under sensitivity below.

### Structural-validity command and output

```powershell
foreach ($path in @('data/games.jsonl','audit/_removed_games.jsonl')) {
  $lines=[IO.File]::ReadAllLines((Resolve-Path $path)); $games=@(); $parse=0; $blank=0
  foreach ($line in $lines) {
    if ([string]::IsNullOrWhiteSpace($line)) {$blank++; continue}
    try {$games+=($line|ConvertFrom-Json -ErrorAction Stop)} catch {$parse++}
  }
  $badId=@($games|Where-Object {$_.gameId -notmatch '^\d{13}-[a-z0-9]{5}$'}).Count
  $dup=@($games|Group-Object gameId|Where-Object Count -gt 1).Count
  $badRunTs=0; $badMsgTs=0; $badPlayers=0; $emptyEvents=0; $badTerminal=0
  foreach ($g in $games) {
    try {[void][datetimeoffset]::Parse($g.timestamp)} catch {$badRunTs++}
    foreach ($d in $g.discussions) {try {[void][datetimeoffset]::Parse($d.timestamp)} catch {$badMsgTs++}}
    $roles=@($g.players.role|Sort-Object)
    if ($g.players.Count -ne 5 -or @($g.players.id|Sort-Object -Unique).Count -ne 5 -or ($roles -join ',') -ne 'assassin,loyal,merlin,morgana,percival') {$badPlayers++}
    if ($g.teamProposals.Count -eq 0 -or $g.quests.Count -eq 0 -or $g.discussions.Count -eq 0) {$emptyEvents++}
    if ($g.winner -notin @('good','evil') -or [string]::IsNullOrWhiteSpace($g.winReason)) {$badTerminal++}
  }
  "$path parsed=$($games.Count) parseErrors=$parse blankRecords=$blank duplicateIds=$dup badIdFormat=$badId badRunTs=$badRunTs badMsgTs=$badMsgTs badPlayerSets=$badPlayers emptyEventRuns=$emptyEvents missingTerminal=$badTerminal"
}
```

```text
data/games.jsonl parsed=140 parseErrors=0 blankRecords=0 duplicateIds=0 badIdFormat=0 badRunTs=0 badMsgTs=0 badPlayerSets=0 emptyEventRuns=0 missingTerminal=0
audit/_removed_games.jsonl parsed=2 parseErrors=0 blankRecords=0 duplicateIds=0 badIdFormat=0 badRunTs=0 badMsgTs=0 badPlayerSets=0 emptyEventRuns=0 missingTerminal=0
```

## 5.3 Critical stale quest round/result bug

At `scripts/batch.ts:423-437`, the code resolves the current quest, then locates a “finished” quest by searching only for the same ordered team:

```typescript
const questIndex = teamMemberIds.length > 0
  ? state.quests.findIndex(q => q.team && q.team.join(',') === teamMemberIds.join(','))
  : -1;
const finishedQuest = questIndex >= 0 ? state.quests[questIndex] : resolvedQuest;

questLogs.push({
  round: finishedQuest.questNumber,
  proposedBy: acceptedProposal?.proposedBy || 0,
  team: teamMemberIds,
  votes: questVotesRecord,
  actions: actionsRecord,
  result: finishedQuest.result === 'success' ? 'success' : 'fail',
});
```

`findIndex` returns the first earlier quest with that ordered team. Consequences:

- 144/564 quest records are later repetitions of an ordered team, and exactly those 144 have the wrong `round`.
- They occur in 95/140 runs.
- 57/564 records in 40/140 runs also copy a wrong earlier `result`.
- In 26/140 runs, the stored `quests[].result` totals are impossible for the stated terminal `winner`/`winReason`.
- The array order, current `team`, `proposedBy`, `votes`, and `actions` remain usable. With array index + 1 as the round, all 564 quests link to exactly one accepted proposal for that round.
- Deriving result as “any `fail` action means failure” is valid for these five-player games and makes all 140 run outcomes agree with top-level `winner`/`winReason`.
- The two pilots happen not to repeat an ordered team, so neither shows the bug.

Minimal observed example, canonical line 8 (`1776470168031-kwy8o`):

```json
{
  "actualRoundByArrayIndex": 5,
  "loggedQuest": {
    "round": 4,
    "proposedBy": 1,
    "team": [1,2,3],
    "votes": {"1":"approve","2":"reject","3":"approve","4":"approve","5":"reject"},
    "actions": {"1":"success","2":"success","3":"success"},
    "result": "fail"
  },
  "actionDerivedResult": "success",
  "runOutcome": {"winner":"good","winReason":"three_quests_succeeded"}
}
```

Round 4 used the same ordered `[1,2,3]` team and failed; the later round-5 record copied round 4 and `fail` even though its current actions all succeeded.

Affected derived artifacts:

- `results/stats.json → extendedMetrics.sabotageByRound`
- the round-indexed sabotage table in `results/summary.md`
- all round-indexed and “early round” results in `analysis/camouflage.md`

Those consumers read `q.round` directly. Other aggregate metrics based on top-level outcomes, action totals without round grouping, durations, call counts, or array lengths do not depend on the stale fields.

### Integrity command and output

```powershell
$games=[IO.File]::ReadAllLines((Resolve-Path 'data/games.jsonl'))|ForEach-Object {$_|ConvertFrom-Json}
$badRound=0; $badResult=0; $badRoundRuns=@{}; $badResultRuns=@{}
$repeatedLater=0; $outcomeConflicts=0; $linkMismatch=0
foreach ($g in $games) {
  $seen=@{}
  for ($i=0; $i -lt $g.quests.Count; $i++) {
    $q=$g.quests[$i]; $teamKey=$q.team -join ','
    if ($seen.ContainsKey($teamKey)) {$repeatedLater++} else {$seen[$teamKey]=$true}
    if ($q.round -ne ($i+1)) {$badRound++; $badRoundRuns[$g.gameId]=$true}
    $derived=if (@($q.actions.PSObject.Properties.Value|Where-Object {$_ -eq 'fail'}).Count) {'fail'} else {'success'}
    if ($q.result -ne $derived) {$badResult++; $badResultRuns[$g.gameId]=$true}
    $p=@($g.teamProposals|Where-Object {$_.questRound -eq ($i+1) -and $_.accepted})
    if ($p.Count -ne 1 -or ($p[0].team -join ',') -ne ($q.team -join ',') -or $p[0].proposedBy -ne $q.proposedBy -or ($p[0].votes|ConvertTo-Json -Compress) -ne ($q.votes|ConvertTo-Json -Compress)) {$linkMismatch++}
  }
  $success=@($g.quests|Where-Object {$_.result -eq 'success'}).Count
  $fail=@($g.quests|Where-Object {$_.result -eq 'fail'}).Count
  if (($g.winReason -eq 'three_quests_failed' -and $fail -ne 3) -or ($g.winReason -ne 'three_quests_failed' -and $success -ne 3)) {$outcomeConflicts++}
}
"questRecords=$($games.quests.Count) repeatedLaterTeams=$repeatedLater badRoundRecords=$badRound badRoundRuns=$($badRoundRuns.Count) badResultRecords=$badResult badResultRuns=$($badResultRuns.Count) outcomeConflicts=$outcomeConflicts linkMismatchUsingIndex=$linkMismatch"
```

```text
questRecords=564 repeatedLaterTeams=144 badRoundRecords=144 badRoundRuns=95 badResultRecords=57 badResultRuns=40 outcomeConflicts=26 linkMismatchUsingIndex=0
```

## 5.4 Fallback accounting is incomplete

The five exact discussion fallback literals at `lib/ai/dispatch.ts:223-230` occur verbatim 200 times across six games:

| Canonical line | Config | Exact fallback-literal discussions | Stored `fallbackCounts.discussion` | All stored fallbacks |
|---:|---|---:|---:|---:|
| 26 | homogeneous-gpt4o | 1 | 0 | 0 |
| 91 | homogeneous-grok | 2 | 0 | 0 |
| 96 | homogeneous-gemini | 44 | 0 | 7 |
| 97 | homogeneous-gemini | 60 | 0 | 6 |
| 98 | homogeneous-gemini | 45 | 0 | 6 |
| 99 | homogeneous-gemini | 48 | 0 | 5 |

Exact-string identity plus clustering strongly indicates dispatcher/provider-error fallback text, although an individual model could theoretically emit an identical phrase; that attribution is an inference. The count omission is explained by source behavior: dispatcher fallback discussion text is syntactically valid, and `batch.ts` increments `fallbackCounts.discussion` only when `validateDiscussionOutput` rejects it.

The same observability problem applies more broadly. Provider fallback for voting returns a valid-looking `APPROVE`/`REJECT`, and quest fallback returns `SUCCESS`, so those transport/provider fallbacks cannot be distinguished after the fact. Team-building and assassination return empty strings and are more likely to trigger a counted parser fallback. Thus `fallbackCounts` is best mapped as parser/validation fallback counts, not a complete provider-failure counter.

The union of games with stored fallback counts (10) and games with exact fallback discussion text (6) is 12 unique runs.

### Command and output

```powershell
$fallback=@('我觉得我们需要更多信息才能判断。','这一轮很关键，大家要仔细考虑。','我暂时保留意见，先听听其他人怎么说。','目前的局势还不太明朗，我们要小心决策。','我在观察每个人的反应，希望能找到线索。')
$lines=[IO.File]::ReadAllLines((Resolve-Path 'data/games.jsonl')); $hits=@()
for ($i=0; $i -lt $lines.Count; $i++) {
  $g=$lines[$i]|ConvertFrom-Json
  $n=@($g.discussions|Where-Object {$fallback -contains $_.content}).Count
  if ($n) {
    $total=$g.fallbackCounts.voting+$g.fallbackCounts.quest+$g.fallbackCounts.discussion+$g.fallbackCounts.teamBuilding+$g.fallbackCounts.assassination
    $hits += [pscustomobject]@{Line=$i+1;Matches=$n;DiscussionCounter=$g.fallbackCounts.discussion;AllCounter=$total}
  }
}
"exactFallbackSpeeches=$(($hits|Measure-Object Matches -Sum).Sum)"
$hits
```

```text
exactFallbackSpeeches=200
Line Matches DiscussionCounter AllCounter
26         1                 0          0
91         2                 0          0
96        44                 0          7
97        60                 0          6
98        45                 0          6
99        48                 0          5
```

## 5.5 Other naming and encoding inconsistencies

- Player IDs are numbers in `id`, `speakerId`, `proposedBy`, `team`, and assassination fields, but strings when used as `votes`/`actions` object keys.
- `teamProposals[].votes` and `quests[].votes` alternate between a complete five-key map and `{}`. The empty object is intentional for forced fifth proposals, but there is no explicit `forced` boolean; infer it from empty votes and proposal context.
- `phase` sounds like a game-stage label but is only integer discussion pass 1/2, and it resets on every voted proposal. Because discussions omit `proposalIndex`, the same `(round, phase, speakerId)` tuple can recur.
- Three related round names coexist: `questRound`, `round`, and `phase`. There is no common `turn` or `eventType`.
- `timestamp` at run root means completion time, while the epoch prefix in `gameId` is start time. The file is monotone by completion timestamp, but 19 adjacent `gameId` start-time prefixes regress because two games run concurrently.
- `winner`/`winReason` use strings; `accepted`/`correct` use booleans; votes/actions use string enums.
- A `five_consecutive_rejects` `winReason` branch exists in the writer, but the batch runner hard-codes `fifthVoteRule: 'force_team'` (`scripts/batch.ts:139-143`), making that outcome unreachable in this experiment pipeline. It is not merely absent from this sample.
- Main and pilot JSONL line endings differ (CRLF versus LF) without a schema difference.
- Discussion strings are multilingual and 3,930 contain embedded newlines. A correct JSON parser handles the escaped sequences; line-oriented plain-text splitting inside decoded `content` would not.

## 5.6 Sensitive material and publication review

Observed across both JSONL artifacts:

- API-key-like values: 0
- Bearer tokens/API environment assignments: 0
- Email addresses: 0
- Parsed Windows, `/Users/...`, or `/home/...` absolute paths: 0
- Literal system-prompt/instruction leakage terms searched: 0
- Human names/identities: none; the batch is AI-only
- Full prompt fields: absent

However, four discussion records in three canonical runs should be scrubbed before publishing ordinary dialogue samples:

| Canonical line | Discussion array index (zero-based) | Model context | Observation |
|---:|---:|---|---|
| 13 | 110 | Gemini player in heterogeneous run | Exactly 500 chars; begins unclosed `<thinking>` |
| 60 | 112 | Gemini player in heterogeneous run | Same |
| 60 | 117 | Gemini player in heterogeneous run | Same |
| 104 | 70 | homogeneous Gemini | Same |

All begin like `"<thinking>\nThe user wants me to act as Player ..."`, include internal reasoning/prompt paraphrase, current game state, and hidden role, and end mid-word. There are four opening tags and zero closing tags. `lib/ai/dispatch.ts:137-145` removes only complete thinking-tag pairs and truncates long Google output to at most 500 characters; `validateDiscussionOutput` rejects only lengths greater than 500. The source therefore explains why an unclosed, exactly-500-character trace can pass. Some other Gemini responses may have been cleanly cut at a sentence boundary by the same 500-character logic, but that cannot be identified reliably from disk; this is an inference.

Ordinary logs still disclose exact model/provider identifiers, precise UTC times, run IDs, all generated dialogue, and actual hidden roles. These are experiment metadata, not observed personal data, but should be considered in a publication policy. Render `content` as untrusted text.

### Sensitive scan command and output

```powershell
foreach ($path in @('data/games.jsonl','audit/_removed_games.jsonl')) {
  $text=[IO.File]::ReadAllText((Resolve-Path $path),[Text.Encoding]::UTF8)
  $games=[IO.File]::ReadAllLines((Resolve-Path $path))|ForEach-Object {$_|ConvertFrom-Json}
  "$path api_key_like=$(([regex]::Matches($text,'(?i)(sk-[A-Za-z0-9_-]{16,}|AIza[0-9A-Za-z_-]{20,}|(ANTHROPIC|OPENAI|GOOGLE|DEEPSEEK|XAI)_API_KEY\s*=|Bearer\s+[A-Za-z0-9._-]{10,})')).Count)"
  "email=$(([regex]::Matches($text,'[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}')).Count)"
  "absolute_path_in_parsed_discussion=$((@($games.discussions.content|Where-Object {$_ -match '[A-Za-z]:\\|/(Users|home)/'})).Count)"
  "system_prompt_terms=$(([regex]::Matches($text,'(?i)system prompt|system_prompt|系统提示|my instructions|i was told to')).Count)"
  "unclosed_thinking_discussions=$((@($games.discussions.content|Where-Object {$_ -match '(?i)<thinking>' -and $_ -notmatch '(?i)</thinking>'})).Count)"
}
```

```text
data/games.jsonl api_key_like=0
email=0
absolute_path_in_parsed_discussion=0
system_prompt_terms=0
unclosed_thinking_discussions=4
audit/_removed_games.jsonl api_key_like=0
email=0
absolute_path_in_parsed_discussion=0
system_prompt_terms=0
unclosed_thinking_discussions=0
```

# Step 6 — Direct answers

## 1. Can one run be located and read without loading the others?

Yes, by streaming `data/games.jsonl` and parsing only the matching line. A run is self-contained on one line and `gameId` is unique in all 140 canonical records. There is no per-run file, filename encoding, or index, so locating an unknown `gameId` requires a sequential scan unless an external byte-offset/index is built. Variable-length lines prevent computing an offset from line number alone.

## 2. Is run-level metadata available, and from where?

Partly, inside each run line:

- Config/condition label: `config`
- Exact assigned model and provider: `players[].model` and `provider`
- Actual role/persona: `players[].role`
- Start identity/time: `gameId` prefix; completion time: `timestamp`
- Result: `winner`, `winReason`, and optional `assassination`
- Run duration/logical call count: `durationMs`, `llmCallCount`
- Partial fallback counters: `fallbackCounts`

Prompt mode is not a field but can be joined from `config` to `scripts/configs.ts`. There is no stored seed, temperature, prompt/version hash, code commit, batch command, tokens, cost, request IDs, full prompts, or raw non-discussion model output. `results/` supplies only aggregates, not additional run-level metadata.

## 3. One-paragraph format description

`data/games.jsonl` is a UTF-8 JSONL aggregate with one self-contained completed five-player Avalon game per line; each object contains run/config identifiers, five players' hidden roles and exact model/provider assignments, separate flat chronological arrays for team proposals, executed quests, and timestamped discussion messages, an optional assassination object, and top-level outcome, duration, logical-call, and fallback summaries. Player references are numeric except string-keyed vote/action maps, forced fifth-proposal votes are encoded as `{}`, and discussions lack a proposal index, so their ten-message blocks must be aligned chronologically to voted proposals. No token/cost or prompt/raw structured-action fields are stored. The critical defect is that repeated ordered teams cause `quests[].round` and sometimes `quests[].result` to be copied from an earlier quest, so an importer should use quest array position, action-derived quest results, and top-level `winner`/`winReason`.

## Final worktree verification

```powershell
git status --short
```

```text
 M package-lock.json
?? LOG_SURVEY.md
?? audit/
```

`package-lock.json` and `audit/` were present in the baseline status; `LOG_SURVEY.md` is the only survey-created path.

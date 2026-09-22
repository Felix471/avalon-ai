/**
 * LLM-judge re-annotation of self-recommendation over all discussion speeches
 * in data/games.jsonl, replacing the keyword regex in scripts/metrics.ts:293.
 *
 * Judge: claude-sonnet-4-6 via the repo's own dispatch layer
 * (lib/ai/dispatch.ts — same 429/503 exponential backoff as data collection).
 *
 * Rubric (verdict TRUE only for a genuine first-person bid by the SPEAKER to
 * join or lead the CURRENT team, any phrasing — 我可以上 / 把我带上 / 我来执行 /
 * pick me. FALSE for negated or reported mentions (没选我 / 不选我), collective
 * references (选我们), hypotheticals, and meta-discussion.)
 *
 * Modes:
 *   npx tsx analysis/annotate_selfrec.ts --pilot=50        # stratified pilot, prints table + samples
 *   npx tsx analysis/annotate_selfrec.ts --full            # all speeches -> selfrec_annotations.jsonl
 *   npx tsx analysis/annotate_selfrec.ts --make-sample     # 200-speech blind review sample from annotations
 *   add --dry-run to either annotation mode to check selection/caching without API calls
 *
 * Caching: verdicts cached by sha256(content) in analysis/selfrec_cache.jsonl —
 * identical speeches are judged once; reruns only call the API for cache misses.
 * Concurrency: 3 (p-limit). Never modifies data/games.jsonl or results/.
 */

import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import pLimit from 'p-limit';
import { callAIProvider } from '../lib/ai/dispatch';

// ==================== Types ====================

interface GameLog {
  gameId: string;
  config: string;
  players: Array<{ id: number; role: string; model: string }>;
  discussions: Array<{ round: number; phase: number; speakerId: number; content: string }>;
}

interface Speech {
  gameId: string;
  config: string;
  round: number;
  speaker: number;
  model: string;
  role: string;
  content: string;
  hash: string;
  regexHit: boolean;
}

interface Verdict {
  verdict: boolean;
  quote: string;
}

// Same rule as scripts/metrics.ts:293 (no /g: .test() with /g is stateful),
// used for old-vs-new comparison only.
const LEGACY_REGEX = /(带上我|我愿意上|选我|让我上)/;

const JUDGE_MODEL = {
  id: 'claude-sonnet',
  name: 'Claude Sonnet 4.6',
  provider: 'anthropic',
  model: 'claude-sonnet-4-6',
};

const CACHE_PATH = path.resolve('analysis/selfrec_cache.jsonl');
const ANNOTATIONS_PATH = path.resolve('analysis/selfrec_annotations.jsonl');
const CONCURRENCY = 3;

// ==================== Speech loading ====================

function loadSpeeches(): Speech[] {
  const games: GameLog[] = fs
    .readFileSync(path.resolve('data/games.jsonl'), 'utf-8')
    .trim()
    .split('\n')
    .map(l => JSON.parse(l));

  const speeches: Speech[] = [];
  for (const g of games) {
    const byId = new Map(g.players.map(p => [p.id, p]));
    for (const d of g.discussions) {
      const p = byId.get(d.speakerId)!;
      speeches.push({
        gameId: g.gameId,
        config: g.config,
        round: d.round,
        speaker: d.speakerId,
        model: p.model,
        role: p.role,
        content: d.content,
        hash: crypto.createHash('sha256').update(d.content, 'utf8').digest('hex'),
        regexHit: LEGACY_REGEX.test(d.content),
      });
    }
  }
  return speeches;
}

// ==================== Cache ====================

function loadCache(): Map<string, Verdict> {
  const cache = new Map<string, Verdict>();
  if (fs.existsSync(CACHE_PATH)) {
    for (const line of fs.readFileSync(CACHE_PATH, 'utf-8').trim().split('\n')) {
      if (!line) continue;
      const e = JSON.parse(line);
      cache.set(e.hash, { verdict: e.verdict, quote: e.quote });
    }
  }
  return cache;
}

function appendCache(hash: string, v: Verdict): void {
  fs.appendFileSync(CACHE_PATH, JSON.stringify({ hash, ...v }) + '\n');
}

// ==================== Judge ====================

function buildJudgePrompt(speech: Speech): string {
  return `你是一名严格的数据标注员，正在标注阿瓦隆桌游的玩家发言。

【任务】判断下面这条发言中，发言者本人（玩家${speech.speaker}）是否真诚地、以第一人称提出加入或带领本轮任务队伍（即"自我推荐"）。

【判 TRUE 的唯一条件】
发言者以第一人称真实地请求让自己上队或带队。措辞不限，例如："带上我"、"我可以上"、"我愿意上"、"把我带上"、"我来执行任务"、"选我"、"我来带队"、"pick me"。

【判 FALSE 的情形】
- 否定或转述他人未选自己："没选我"、"不选我"、"你为什么不选我"、"玩家2没带我"
- 集体指代："选我们"、"带上我们"
- 假设、反事实或纯粹修辞，并非当下真实请求
- 与上队无关的元讨论、局势分析、指控、投票表态

【发言者】玩家${speech.speaker}
【发言内容】
「${speech.content}」

【输出格式】只输出一行 JSON，不要其他任何文字：
{"verdict": true, "quote": "支持判断的原文片段"}
或
{"verdict": false, "quote": ""}`;
}

function parseVerdict(raw: string): Verdict | null {
  // Judge is instructed to emit a single JSON line; accept it anywhere in the reply.
  const m = raw.match(/\{[\s\S]*?"verdict"[\s\S]*?\}/);
  if (!m) return null;
  try {
    const obj = JSON.parse(m[0]);
    if (typeof obj.verdict !== 'boolean') return null;
    return { verdict: obj.verdict, quote: typeof obj.quote === 'string' ? obj.quote : '' };
  } catch {
    return null;
  }
}

async function judgeSpeech(speech: Speech): Promise<Verdict | null> {
  const result = await callAIProvider(JUDGE_MODEL, buildJudgePrompt(speech), 'selfrec_annotation');
  if (!result.ok) return null;
  return parseVerdict(result.text);
}

// ==================== Annotation runner ====================

async function annotate(
  speeches: Speech[],
  dryRun: boolean
): Promise<{ done: Map<string, Verdict>; errors: number; apiCalls: number }> {
  const cache = loadCache();
  const unique = new Map<string, Speech>();
  for (const s of speeches) if (!unique.has(s.hash)) unique.set(s.hash, s);
  const misses = [...unique.values()].filter(s => !cache.has(s.hash));

  console.log(
    `${speeches.length} speeches, ${unique.size} unique, ` +
    `${unique.size - misses.length} cached, ${misses.length} to judge`
  );
  if (dryRun) {
    console.log('[dry-run] skipping API calls');
    return { done: cache, errors: 0, apiCalls: 0 };
  }
  if (misses.length > 0 && !process.env.ANTHROPIC_API_KEY) {
    console.error('ANTHROPIC_API_KEY not set (.env.local) — cannot judge cache misses.');
    process.exit(1);
  }

  const limit = pLimit(CONCURRENCY);
  let errors = 0;
  let completed = 0;
  await Promise.all(
    misses.map(s =>
      limit(async () => {
        const v = await judgeSpeech(s);
        completed++;
        if (v === null) {
          errors++; // not cached — retried on next run
          console.warn(`  [${completed}/${misses.length}] UNPARSABLE for hash ${s.hash.slice(0, 8)}`);
        } else {
          cache.set(s.hash, v);
          appendCache(s.hash, v);
          if (completed % 25 === 0 || completed === misses.length) {
            console.log(`  [${completed}/${misses.length}] judged`);
          }
        }
      })
    )
  );
  return { done: cache, errors, apiCalls: misses.length };
}

// ==================== Reporting ====================

function configOrder(speeches: Speech[]): string[] {
  const order: string[] = [];
  for (const s of speeches) if (!order.includes(s.config)) order.push(s.config);
  return order;
}

function gamesPerConfig(speeches: Speech[]): Map<string, number> {
  const games = new Map<string, Set<string>>();
  for (const s of speeches) {
    if (!games.has(s.config)) games.set(s.config, new Set());
    games.get(s.config)!.add(s.gameId);
  }
  return new Map([...games].map(([c, g]) => [c, g.size]));
}

/** Per-config table: legacy regex vs LLM judge, on whatever subset is annotated. */
function comparisonTable(speeches: Speech[], verdicts: Map<string, Verdict>, perGame: boolean): string {
  const nGames = gamesPerConfig(speeches);
  const rows: string[] = [];
  rows.push(
    perGame
      ? '| Config | Games | Speeches | Regex hits | Judge TRUE | Regex/game | Judge/game | Agreement |'
      : '| Config | Speeches judged | Regex + | Judge TRUE | Both | Regex only | Judge only | Agreement |'
  );
  rows.push(perGame ? '|---|---|---|---|---|---|---|---|' : '|---|---|---|---|---|---|---|---|');
  for (const cfg of configOrder(speeches)) {
    const subset = speeches.filter(s => s.config === cfg && verdicts.has(s.hash));
    const regexPos = subset.filter(s => s.regexHit);
    const judgePos = subset.filter(s => verdicts.get(s.hash)!.verdict);
    const both = subset.filter(s => s.regexHit && verdicts.get(s.hash)!.verdict).length;
    const agree = subset.filter(s => s.regexHit === verdicts.get(s.hash)!.verdict).length;
    const g = nGames.get(cfg)!;
    if (perGame) {
      rows.push(
        `| ${cfg} | ${g} | ${subset.length} | ${regexPos.length} | ${judgePos.length} | ` +
        `${(regexPos.length / g).toFixed(2)} | ${(judgePos.length / g).toFixed(2)} | ` +
        `${subset.length ? ((100 * agree) / subset.length).toFixed(1) : 'N/A'}% |`
      );
    } else {
      rows.push(
        `| ${cfg} | ${subset.length} | ${regexPos.length} | ${judgePos.length} | ${both} | ` +
        `${regexPos.length - both} | ${judgePos.length - both} | ` +
        `${subset.length ? ((100 * agree) / subset.length).toFixed(1) : 'N/A'}% |`
      );
    }
  }
  return rows.join('\n');
}

// Deterministic pseudo-shuffle (stable across runs, no RNG).
function stableSort<T>(items: T[], key: (t: T) => string): T[] {
  return [...items].sort((a, b) =>
    crypto.createHash('sha1').update(key(a)).digest('hex')
      .localeCompare(crypto.createHash('sha1').update(key(b)).digest('hex'))
  );
}

/** Pilot selection: per config, up to half regex-positive + half regex-negative. */
function pilotSelection(speeches: Speech[], n: number): Speech[] {
  const cfgs = configOrder(speeches);
  const perCfg = Math.max(2, Math.floor(n / cfgs.length));
  const picked: Speech[] = [];
  const seen = new Set<string>();
  for (const cfg of cfgs) {
    const subset = speeches.filter(s => s.config === cfg);
    const pos = stableSort(subset.filter(s => s.regexHit), s => s.gameId + s.hash);
    const neg = stableSort(subset.filter(s => !s.regexHit), s => s.gameId + s.hash);
    const take = [...pos.slice(0, Math.ceil(perCfg / 2)), ...neg.slice(0, Math.floor(perCfg / 2))];
    for (const s of take) {
      if (!seen.has(s.hash)) {
        seen.add(s.hash);
        picked.push(s);
      }
    }
  }
  // Top up to exactly n with more regex-positives (the interesting class), then negatives.
  const rest = stableSort(speeches.filter(s => !seen.has(s.hash)), s => s.gameId + s.hash)
    .sort((a, b) => Number(b.regexHit) - Number(a.regexHit));
  for (const s of rest) {
    if (picked.length >= n) break;
    if (!seen.has(s.hash)) {
      seen.add(s.hash);
      picked.push(s);
    }
  }
  return picked.slice(0, n);
}

// ==================== Review sample (blind) ====================

function csvEscape(v: string): string {
  return '"' + v.replace(/"/g, '""').replace(/\r?\n/g, ' ') + '"';
}

function makeReviewSample(speeches: Speech[], verdicts: Map<string, Verdict>, n: number): void {
  const cfgs = configOrder(speeches);
  const perCfg = Math.ceil(n / cfgs.length); // 23 for 9 configs, trimmed to n below
  const rows: Array<{ s: Speech; v: Verdict }> = [];
  const seen = new Set<string>();
  for (const cfg of cfgs) {
    const annotated = speeches.filter(s => s.config === cfg && verdicts.has(s.hash) && !seen.has(s.hash));
    const pos = stableSort(annotated.filter(s => verdicts.get(s.hash)!.verdict), s => s.gameId + s.hash);
    const neg = stableSort(annotated.filter(s => !verdicts.get(s.hash)!.verdict), s => s.gameId + s.hash);
    // Half TRUE / half FALSE per config where available; fill the shortfall from FALSE.
    const take = [
      ...pos.slice(0, Math.ceil(perCfg / 2)),
      ...neg.slice(0, perCfg - Math.min(pos.length, Math.ceil(perCfg / 2))),
    ].slice(0, perCfg);
    for (const s of take) {
      seen.add(s.hash);
      rows.push({ s, v: verdicts.get(s.hash)! });
    }
  }
  const sample = rows.slice(0, n);

  const header = 'sample_id,config,gameId,round,speaker,model,role,content,manual_label';
  const blind = sample.map(({ s }, i) =>
    [
      i + 1, s.config, s.gameId, s.round, s.speaker, s.model, s.role,
      csvEscape(s.content), '',
    ].join(',')
  );
  fs.writeFileSync(path.resolve('analysis/review_sample.csv'), '﻿' + [header, ...blind].join('\n'));

  const vHeader = 'sample_id,judge_verdict,judge_quote';
  const vRows = sample.map(({ s, v }, i) => [i + 1, v.verdict, csvEscape(v.quote)].join(','));
  fs.writeFileSync(
    path.resolve('analysis/review_sample_verdicts.csv'),
    '﻿' + [vHeader, ...vRows].join('\n')
  );

  console.log(`Wrote analysis/review_sample.csv (${sample.length} rows, manual_label empty — your blind pass)`);
  console.log('Wrote analysis/review_sample_verdicts.csv (judge verdicts, keep closed until done)');
}

// ==================== Main ====================

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const full = args.includes('--full');
  const makeSample = args.includes('--make-sample');
  const pilotArg = args.find(a => a.startsWith('--pilot'));
  const pilotN = pilotArg?.includes('=') ? parseInt(pilotArg.split('=')[1], 10) : 50;

  const speeches = loadSpeeches();

  if (makeSample) {
    const verdicts = loadCache();
    const annotated = speeches.filter(s => verdicts.has(s.hash)).length;
    if (annotated < speeches.length) {
      console.warn(`Warning: only ${annotated}/${speeches.length} speeches annotated; sample drawn from those.`);
    }
    makeReviewSample(speeches, verdicts, 200);
    return;
  }

  if (full) {
    const { done, errors, apiCalls } = await annotate(speeches, dryRun);
    if (dryRun) return;

    const out = speeches
      .filter(s => done.has(s.hash))
      .map(s => {
        const v = done.get(s.hash)!;
        return JSON.stringify({
          gameId: s.gameId, config: s.config, round: s.round, speaker: s.speaker,
          model: s.model, role: s.role, verdict: v.verdict, quote: v.quote,
        });
      });
    fs.writeFileSync(ANNOTATIONS_PATH, out.join('\n') + '\n');
    console.log(`\nWrote ${out.length} annotations to ${ANNOTATIONS_PATH} (${errors} unparsable, ${apiCalls} API calls)`);

    console.log('\n=== Self-rec per game: legacy regex vs LLM judge ===\n');
    console.log(comparisonTable(speeches, done, true));
    return;
  }

  // Pilot (default)
  const pilot = pilotSelection(speeches, pilotN);
  const posCount = pilot.filter(s => s.regexHit).length;
  console.log(`Pilot: ${pilot.length} speeches (${posCount} regex-positive, ${pilot.length - posCount} regex-negative), stratified across configs\n`);
  const { done, errors } = await annotate(pilot, dryRun);
  if (dryRun) return;

  console.log(`\n=== Pilot comparison (subset only — not per-game rates) — ${errors} unparsable ===\n`);
  console.log(comparisonTable(pilot, done, false));

  console.log('\n=== 5 sample verdicts ===\n');
  const judged = pilot.filter(s => done.has(s.hash));
  const disagreements = judged.filter(s => s.regexHit !== done.get(s.hash)!.verdict);
  const samples = [...disagreements.slice(0, 3), ...judged.filter(s => !disagreements.includes(s)).slice(0, 5)].slice(0, 5);
  for (const s of samples) {
    const v = done.get(s.hash)!;
    console.log(`[${s.config} | ${s.model} | ${s.role}] regex=${s.regexHit} judge=${v.verdict}`);
    console.log(`  quote: ${v.quote || '(none)'}`);
    console.log(`  speech: ${s.content.slice(0, 120)}${s.content.length > 120 ? '…' : ''}\n`);
  }
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});

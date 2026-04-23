/**
 * Metrics extraction and reporting.
 * Reads data/games.jsonl and generates human-readable reports in results/.
 *
 * Usage: npm run metrics
 */

import * as fs from 'fs';
import * as path from 'path';

// ==================== Types ====================

interface GameLog {
  gameId: string;
  timestamp: string;
  config: string;
  players: Array<{ id: number; role: string; model: string; provider: string }>;
  teamProposals: Array<{
    questRound: number;
    proposalIndex: number;
    proposedBy: number;
    team: number[];
    votes: Record<string, 'approve' | 'reject'>;
    accepted: boolean;
  }>;
  quests: Array<{
    round: number;
    proposedBy: number;
    team: number[];
    votes: Record<string, 'approve' | 'reject'>;
    actions: Record<string, 'success' | 'fail'>;
    result: 'success' | 'fail';
  }>;
  discussions: Array<{
    round: number;
    phase: number;
    speakerId: number;
    content: string;
    timestamp: string;
  }>;
  assassination: {
    attemptedBy: number;
    target: number;
    merlinId: number;
    correct: boolean;
  } | null;
  winner: 'good' | 'evil';
  winReason: string;
  llmCallCount: number;
  durationMs: number;
  fallbackCounts: {
    voting: number;
    quest: number;
    discussion: number;
    teamBuilding: number;
    assassination: number;
  };
}

// ==================== Helpers ====================

function pct(n: number, total: number): string {
  if (total === 0) return 'N/A';
  return (n / total * 100).toFixed(1) + '%';
}

function avg(nums: number[]): string {
  if (nums.length === 0) return 'N/A';
  return (nums.reduce((a, b) => a + b, 0) / nums.length).toFixed(1);
}

// ==================== Main ====================

function main() {
  const gamesFile = path.resolve('data/games.jsonl');
  if (!fs.existsSync(gamesFile)) {
    console.error('No data/games.jsonl found. Run `npm run batch` first.');
    process.exit(1);
  }

  const lines = fs.readFileSync(gamesFile, 'utf-8').trim().split('\n').filter(Boolean);
  const games: GameLog[] = lines.map(line => JSON.parse(line));

  if (games.length === 0) {
    console.error('No games found in data/games.jsonl');
    process.exit(1);
  }

  const resultsDir = path.resolve('results');
  if (!fs.existsSync(resultsDir)) {
    fs.mkdirSync(resultsDir, { recursive: true });
  }

  // Group by config
  const byConfig: Record<string, GameLog[]> = {};
  for (const game of games) {
    if (!byConfig[game.config]) byConfig[game.config] = [];
    byConfig[game.config].push(game);
  }

  // ==================== Summary Report ====================
  const summaryLines: string[] = [];
  summaryLines.push('# Avalon AI Batch Results Summary');
  summaryLines.push(`Generated: ${new Date().toISOString()}`);
  summaryLines.push(`Total games: ${games.length}`);
  summaryLines.push('');

  for (const [configName, configGames] of Object.entries(byConfig)) {
    const n = configGames.length;
    const goodWins = configGames.filter(g => g.winner === 'good').length;
    const evilWins = n - goodWins;

    const merlinAssassinations = configGames.filter(g => g.winReason === 'merlin_assassinated').length;
    const threeQuestsFailed = configGames.filter(g => g.winReason === 'three_quests_failed').length;
    const threeQuestsSucceeded = configGames.filter(g => g.winReason === 'three_quests_succeeded').length;
    const fiveRejects = configGames.filter(g => g.winReason === 'five_consecutive_rejects').length;

    const assassinationGames = configGames.filter(g => g.assassination !== null);
    const assassinationSuccesses = assassinationGames.filter(g => g.assassination!.correct).length;

    const avgDuration = avg(configGames.map(g => g.durationMs / 1000));
    const avgLlmCalls = avg(configGames.map(g => g.llmCallCount));
    const avgQuests = avg(configGames.map(g => g.quests.length));

    // Leader approval rate (across ALL proposals)
    const allProposals = configGames.flatMap(g => g.teamProposals);
    const proposalsWithVotes = allProposals.filter(p => Object.keys(p.votes).length > 0);
    const approvedProposals = proposalsWithVotes.filter(p => p.accepted);
    const leaderApprovalRate = pct(approvedProposals.length, proposalsWithVotes.length);

    // Sabotage rate (evil players choosing FAIL on quests)
    const allQuestActions = configGames.flatMap(g =>
      g.quests.flatMap(q =>
        Object.entries(q.actions).map(([pid, action]) => {
          const player = g.players.find(p => p.id === parseInt(pid))!;
          const isEvil = ['assassin', 'morgana', 'mordred', 'oberon', 'minion'].includes(player.role);
          return { isEvil, action };
        })
      )
    );
    const evilActions = allQuestActions.filter(a => a.isEvil);
    const sabotages = evilActions.filter(a => a.action === 'fail').length;
    const sabotageRate = pct(sabotages, evilActions.length);

    // Fallback stats
    const totalFallbacks = configGames.reduce((sum, g) =>
      sum + Object.values(g.fallbackCounts).reduce((a, b) => a + b, 0), 0
    );
    const gamesWithHighFallback = configGames.filter(g =>
      Object.values(g.fallbackCounts).reduce((a, b) => a + b, 0) > 5
    ).length;

    summaryLines.push(`## ${configName} (n=${n})`);
    summaryLines.push('');
    summaryLines.push('### Win Rates');
    summaryLines.push(`- Good wins: ${goodWins}/${n} (${pct(goodWins, n)})`);
    summaryLines.push(`- Evil wins: ${evilWins}/${n} (${pct(evilWins, n)})`);
    summaryLines.push('');
    summaryLines.push('### Win Reasons');
    summaryLines.push(`- Three quests succeeded: ${threeQuestsSucceeded}`);
    summaryLines.push(`- Three quests failed: ${threeQuestsFailed}`);
    summaryLines.push(`- Merlin assassinated: ${merlinAssassinations}`);
    summaryLines.push(`- Five consecutive rejects: ${fiveRejects}`);
    summaryLines.push('');
    summaryLines.push('### Assassination');
    summaryLines.push(`- Assassination attempts: ${assassinationGames.length}`);
    summaryLines.push(`- Successful (killed Merlin): ${assassinationSuccesses} (${pct(assassinationSuccesses, assassinationGames.length)})`);
    summaryLines.push('');
    summaryLines.push('### Game Metrics');
    summaryLines.push(`- Avg duration: ${avgDuration}s`);
    summaryLines.push(`- Avg LLM calls: ${avgLlmCalls}`);
    summaryLines.push(`- Avg quests completed: ${avgQuests}`);
    summaryLines.push(`- Leader approval rate: ${leaderApprovalRate}`);
    summaryLines.push(`- Evil sabotage rate: ${sabotageRate}`);
    summaryLines.push('');
    summaryLines.push('### Data Quality');
    summaryLines.push(`- Total fallbacks: ${totalFallbacks}`);
    summaryLines.push(`- Games with >5 fallbacks: ${gamesWithHighFallback}`);
    summaryLines.push('');
  }

  // ==================== Per-Model Report ====================
  summaryLines.push('## Per-Model Performance');
  summaryLines.push('');

  const modelStats: Record<string, {
    gamesAsGood: number; winsAsGood: number;
    gamesAsEvil: number; winsAsEvil: number;
  }> = {};

  for (const game of games) {
    for (const player of game.players) {
      const key = player.model;
      if (!modelStats[key]) {
        modelStats[key] = { gamesAsGood: 0, winsAsGood: 0, gamesAsEvil: 0, winsAsEvil: 0 };
      }
      const isEvil = ['assassin', 'morgana', 'mordred', 'oberon', 'minion'].includes(player.role);
      const teamWon = (isEvil && game.winner === 'evil') || (!isEvil && game.winner === 'good');

      if (isEvil) {
        modelStats[key].gamesAsEvil++;
        if (teamWon) modelStats[key].winsAsEvil++;
      } else {
        modelStats[key].gamesAsGood++;
        if (teamWon) modelStats[key].winsAsGood++;
      }
    }
  }

  summaryLines.push('| Model | Good Games | Good Win% | Evil Games | Evil Win% |');
  summaryLines.push('|-------|-----------|-----------|-----------|-----------|');
  for (const [model, stats] of Object.entries(modelStats).sort((a, b) => a[0].localeCompare(b[0]))) {
    summaryLines.push(
      `| ${model} | ${stats.gamesAsGood} | ${pct(stats.winsAsGood, stats.gamesAsGood)} | ` +
      `${stats.gamesAsEvil} | ${pct(stats.winsAsEvil, stats.gamesAsEvil)} |`
    );
  }
  summaryLines.push('');

  // ==================== Extended Behavioral Metrics ====================
  summaryLines.push('## Extended Behavioral Metrics');
  summaryLines.push('');

  // --- Metric A: Per-model discussion verbosity (good vs evil) ---
  const EVIL_ROLES = ['assassin', 'morgana', 'mordred', 'oberon', 'minion'];
  const verbosity: Record<string, { goodChars: number[]; evilChars: number[] }> = {};

  for (const game of games) {
    for (const d of game.discussions) {
      const player = game.players.find(p => p.id === d.speakerId);
      if (!player) continue;
      const model = player.model;
      if (!verbosity[model]) verbosity[model] = { goodChars: [], evilChars: [] };
      const isEvil = EVIL_ROLES.includes(player.role);
      if (isEvil) {
        verbosity[model].evilChars.push(d.content.length);
      } else {
        verbosity[model].goodChars.push(d.content.length);
      }
    }
  }

  summaryLines.push('### Discussion Verbosity by Model (Good vs Evil)');
  summaryLines.push('');
  summaryLines.push('| Model | Good Avg Chars | Evil Avg Chars | Ratio (Evil/Good) |');
  summaryLines.push('|-------|---------------|---------------|-------------------|');
  const verbosityStats: Record<string, { goodAvg: number; evilAvg: number }> = {};
  for (const [model, v] of Object.entries(verbosity).sort((a, b) => a[0].localeCompare(b[0]))) {
    const goodAvg = v.goodChars.length > 0 ? v.goodChars.reduce((a, b) => a + b, 0) / v.goodChars.length : 0;
    const evilAvg = v.evilChars.length > 0 ? v.evilChars.reduce((a, b) => a + b, 0) / v.evilChars.length : 0;
    const ratio = goodAvg > 0 ? (evilAvg / goodAvg).toFixed(2) : 'N/A';
    summaryLines.push(`| ${model} | ${goodAvg.toFixed(1)} | ${evilAvg.toFixed(1)} | ${ratio} |`);
    verbosityStats[model] = { goodAvg: parseFloat(goodAvg.toFixed(1)), evilAvg: parseFloat(evilAvg.toFixed(1)) };
  }
  summaryLines.push('');

  // --- Metric B: Per-round evil sabotage timing ---
  const sabotageByRound: Record<number, { evilOnTeam: number; failCount: number }> = {};

  for (const game of games) {
    const evilIds = new Set(game.players.filter(p => EVIL_ROLES.includes(p.role)).map(p => p.id));
    for (const quest of game.quests) {
      const round = quest.round;
      if (!sabotageByRound[round]) sabotageByRound[round] = { evilOnTeam: 0, failCount: 0 };
      for (const [pid, action] of Object.entries(quest.actions)) {
        if (evilIds.has(parseInt(pid))) {
          sabotageByRound[round].evilOnTeam++;
          if (action === 'fail') sabotageByRound[round].failCount++;
        }
      }
    }
  }

  summaryLines.push('### Evil Sabotage Timing by Quest Round');
  summaryLines.push('');
  summaryLines.push('| Quest Round | Evil on Team | Sabotage Count | Sabotage Rate |');
  summaryLines.push('|------------|-------------|---------------|--------------|');
  const sabotageRoundStats: Record<string, number> = {};
  for (let round = 1; round <= 5; round++) {
    const s = sabotageByRound[round];
    if (s && s.evilOnTeam > 0) {
      const rate = s.failCount / s.evilOnTeam;
      summaryLines.push(`| ${round} | ${s.evilOnTeam} | ${s.failCount} | ${pct(s.failCount, s.evilOnTeam)} |`);
      sabotageRoundStats[String(round)] = parseFloat(rate.toFixed(4));
    } else {
      summaryLines.push(`| ${round} | 0 | 0 | N/A |`);
      sabotageRoundStats[String(round)] = 0;
    }
  }
  summaryLines.push('');

  // --- Metric C: Per-config self-recommendation count ---
  const selfRecRegex = /(带上我|我愿意上|选我|让我上)/g;
  const selfRecStats: Record<string, number> = {};

  summaryLines.push('### Self-Recommendation Language by Config');
  summaryLines.push('');
  summaryLines.push('| Config | Games | Total Self-Recs | Mean per Game |');
  summaryLines.push('|--------|-------|----------------|--------------|');
  for (const [configName, configGames] of Object.entries(byConfig)) {
    let totalRecs = 0;
    for (const game of configGames) {
      for (const d of game.discussions) {
        const matches = d.content.match(selfRecRegex);
        if (matches) totalRecs += matches.length;
      }
    }
    const meanPerGame = configGames.length > 0 ? totalRecs / configGames.length : 0;
    summaryLines.push(`| ${configName} | ${configGames.length} | ${totalRecs} | ${meanPerGame.toFixed(1)} |`);
    selfRecStats[configName] = parseFloat(meanPerGame.toFixed(1));
  }
  summaryLines.push('');

  // Write reports
  const summaryPath = path.join(resultsDir, 'summary.md');
  fs.writeFileSync(summaryPath, summaryLines.join('\n'));
  console.log(`Summary written to ${summaryPath}`);

  // Also write raw stats as JSON for programmatic access
  const statsPath = path.join(resultsDir, 'stats.json');
  const statsObj: Record<string, unknown> = {};
  for (const [configName, configGames] of Object.entries(byConfig)) {
    const n = configGames.length;
    statsObj[configName] = {
      n,
      goodWinRate: configGames.filter(g => g.winner === 'good').length / n,
      evilWinRate: configGames.filter(g => g.winner === 'evil').length / n,
      avgDurationSec: configGames.reduce((s, g) => s + g.durationMs, 0) / n / 1000,
      avgLlmCalls: configGames.reduce((s, g) => s + g.llmCallCount, 0) / n,
      avgQuestsCompleted: configGames.reduce((s, g) => s + g.quests.length, 0) / n,
    };
  }
  statsObj['extendedMetrics'] = {
    verbosity: verbosityStats,
    sabotageByRound: sabotageRoundStats,
    selfRecommendations: selfRecStats,
  };
  fs.writeFileSync(statsPath, JSON.stringify(statsObj, null, 2));
  console.log(`Stats written to ${statsPath}`);
}

main();

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
  fs.writeFileSync(statsPath, JSON.stringify(statsObj, null, 2));
  console.log(`Stats written to ${statsPath}`);
}

main();

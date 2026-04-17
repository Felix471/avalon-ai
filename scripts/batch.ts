/**
 * Headless Batch Runner for AI-only Avalon games.
 *
 * Usage:
 *   npm run batch -- --games=10 --configs=all
 *   npm run batch -- --games=1 --configs=heterogeneous-full
 *   npm run batch -- --games=5 --configs=heterogeneous-full,homogeneous-gpt4o
 *
 * Outputs:
 *   data/games.jsonl    — one JSON line per completed game
 *   data/failures.jsonl — one JSON line per failed game
 */

import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import * as fs from 'fs';
import * as path from 'path';
import pLimit from 'p-limit';
import {
  GameState, GameConfig, Player, ROLES, QUEST_SIZES,
  ROLE_CONFIGS, DOUBLE_FAIL_QUESTS, AIModel,
} from '../lib/game/types';
import {
  createGame, getCurrentLeader, addEvent, proposeTeam,
  submitVote, submitQuestAction, attemptAssassination,
  shouldHaveDiscussion, getPlayerVision,
} from '../lib/game/engine';
import {
  buildDiscussionPrompt, buildVotingPrompt,
  buildQuestActionPrompt, buildAssassinationPrompt,
} from '../lib/security/aiPromptTemplate';
import {
  validateDiscussionOutput, validateVotingOutput,
  validateQuestActionOutput,
} from '../lib/security/outputValidator';
import { callAIProvider } from '../lib/ai/dispatch';
import { CONFIGS, ALL_CONFIG_NAMES, BatchConfig, PromptMode } from './configs';

// ==================== Types ====================

interface TeamProposal {
  questRound: number;
  proposalIndex: number;
  proposedBy: number;
  team: number[];
  votes: Record<string, 'approve' | 'reject'>;
  accepted: boolean;
}

interface QuestLog {
  round: number;
  proposedBy: number;
  team: number[];
  votes: Record<string, 'approve' | 'reject'>;
  actions: Record<string, 'success' | 'fail'>;
  result: 'success' | 'fail';
}

interface DiscussionLog {
  round: number;
  phase: number;
  speakerId: number;
  content: string;
  timestamp: string;
}

interface FallbackCounts {
  voting: number;
  quest: number;
  discussion: number;
  teamBuilding: number;
  assassination: number;
}

interface GameLog {
  gameId: string;
  timestamp: string;
  config: string;
  players: Array<{ id: number; role: string; model: string; provider: string }>;
  teamProposals: TeamProposal[];
  quests: QuestLog[];
  discussions: DiscussionLog[];
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
  fallbackCounts: FallbackCounts;
}

// ==================== CLI Parsing ====================

function parseArgs(): { games: number; configNames: string[] } {
  const args = process.argv.slice(2);
  let games = 1;
  let configNames: string[] = ALL_CONFIG_NAMES;

  for (const arg of args) {
    if (arg.startsWith('--games=')) {
      games = parseInt(arg.split('=')[1], 10);
      if (isNaN(games) || games < 1) {
        console.error('Invalid --games value');
        process.exit(1);
      }
    } else if (arg.startsWith('--configs=')) {
      const val = arg.split('=')[1];
      if (val === 'all') {
        configNames = ALL_CONFIG_NAMES;
      } else {
        configNames = val.split(',');
        for (const name of configNames) {
          if (!CONFIGS[name]) {
            console.error(`Unknown config: ${name}. Valid: ${ALL_CONFIG_NAMES.join(', ')}`);
            process.exit(1);
          }
        }
      }
    }
  }

  return { games, configNames };
}

// ==================== Game Setup ====================

function createHeadlessGame(models: AIModel[]): GameState {
  const playerCount = models.length;
  const config: GameConfig = {
    playerCount,
    enabledModels: models.map(m => m.id),
    roles: ROLE_CONFIGS[playerCount],
    questSizes: QUEST_SIZES[playerCount],
    variantRules: {
      assassinAnytime: false,
      discussionMode: 'every_time',
      fifthVoteRule: 'force_team',
    },
  };

  let state = createGame(config);

  // Post-process: make ALL players AI with specific model assignments
  state = {
    ...state,
    players: state.players.map((p, i) => ({
      ...p,
      isHuman: false,
      name: models[i].name,
      aiModel: models[i],
    })),
  };

  return state;
}

// ==================== Team Building Prompt (inline, same as route.ts) ====================

function buildTeamBuildingPrompt(state: GameState, leaderId: number): string {
  const questSizes = QUEST_SIZES[state.playerCount] || [2, 3, 2, 3, 3];
  const requiredSize = questSizes[state.currentQuest - 1];

  return `=== 系统指令 ===
你是阿瓦隆游戏中的队长，需要选择 ${requiredSize} 名队员执行任务。

【重要】必须选择恰好 ${requiredSize} 名玩家，不能多也不能少！

【输出格式要求】
只能输出 ${requiredSize} 个玩家编号，用逗号分隔。
例如：1,3,5

可选的玩家：${state.players.map(p => `玩家${p.id}`).join(', ')}
当前任务：第 ${state.currentQuest} 轮
必须选择：恰好 ${requiredSize} 名队员

请输出你选择的 ${requiredSize} 个队员编号（用逗号分隔）：`;
}

function parseAndValidateTeam(
  response: string,
  state: GameState,
  leaderId: number,
): { team: number[]; wasFallback: boolean } {
  const questSizes = QUEST_SIZES[state.playerCount] || [2, 3, 2, 3, 3];
  const requiredSize = questSizes[state.currentQuest - 1];

  const numbers = response.match(/\d+/g) || [];
  let team = [...new Set(
    numbers.map(n => parseInt(n)).filter(n => n >= 1 && n <= state.playerCount)
  )];

  let wasFallback = false;

  if (team.length !== requiredSize) {
    wasFallback = true;
    if (team.length === 0) team = [leaderId];
    else if (!team.includes(leaderId) && team.length < requiredSize) {
      team.unshift(leaderId);
    }

    const available = state.players.map(p => p.id).filter(id => !team.includes(id));
    const shuffled = available.sort(() => Math.random() - 0.5);
    while (team.length < requiredSize && shuffled.length > 0) {
      team.push(shuffled.shift()!);
    }
    if (team.length > requiredSize) {
      team = team.slice(0, requiredSize);
    }
  }

  return { team, wasFallback };
}

function parseTargetId(
  response: string,
  state: GameState,
): { targetId: number; wasFallback: boolean } {
  const goodPlayers = state.players.filter(p => ROLES[p.role!].team === 'good');
  const match = response.match(/\d+/);
  let targetId = match ? parseInt(match[0]) : -1;
  let wasFallback = false;

  if (!goodPlayers.find(p => p.id === targetId)) {
    targetId = goodPlayers[Math.floor(Math.random() * goodPlayers.length)].id;
    wasFallback = true;
  }

  return { targetId, wasFallback };
}

// ==================== Speaker Order ====================

function getSpeakerOrder(state: GameState): Player[] {
  const n = state.playerCount;
  const order: Player[] = [];
  for (let offset = 0; offset < n; offset++) {
    const idx = (state.currentLeaderIndex + offset) % n;
    order.push(state.players[idx]);
  }
  return order;
}

// ==================== Single Game Runner ====================

async function runGame(config: BatchConfig): Promise<GameLog> {
  const startTime = Date.now();
  let llmCallCount = 0;
  const discussions: DiscussionLog[] = [];
  const teamProposals: TeamProposal[] = [];
  const questLogs: QuestLog[] = [];
  const fallbackCounts: FallbackCounts = {
    voting: 0, quest: 0, discussion: 0, teamBuilding: 0, assassination: 0,
  };
  const proposalIndexPerQuest: Record<number, number> = {};
  let recentSpeeches: Array<{ playerId: number; content: string }> = [];

  const mode: PromptMode = config.promptMode;

  // 1. Create game
  let state = createHeadlessGame(config.models);
  const gameId = `${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

  // 2. Skip role_reveal → discussion
  state = { ...state, phase: 'discussion' as const, discussionRound: 1 };

  // Safety: prevent infinite loops
  let iterations = 0;
  const MAX_ITERATIONS = 500;

  // 3. Game loop
  while (state.phase !== 'game_over') {
    iterations++;
    if (iterations > MAX_ITERATIONS) {
      throw new Error(`Game exceeded ${MAX_ITERATIONS} iterations — likely stuck`);
    }

    switch (state.phase) {
      case 'discussion': {
        // Replicates store.ts:137 nextDiscussionRound logic.
        // Source-of-truth: lib/game/store.ts:137-148
        for (let round = 1; round <= 2; round++) {
          const speakers = getSpeakerOrder(state);
          for (const player of speakers) {
            const prompt = buildDiscussionPrompt(state, player.id, recentSpeeches, mode);
            const response = await callAIProvider(player.aiModel!, prompt, 'discussion');
            const validated = validateDiscussionOutput(response);
            const speech = validated.cleanedOutput;
            if (!validated.isValid) fallbackCounts.discussion++;

            state = addEvent(state, {
              type: 'discussion',
              playerId: player.id,
              playerName: `玩家${player.id}`,
              content: speech,
              metadata: { round: state.currentQuest, discussionRound: round },
            });
            recentSpeeches.push({ playerId: player.id, content: speech });
            discussions.push({
              round: state.currentQuest,
              phase: round,
              speakerId: player.id,
              content: speech,
              timestamp: new Date().toISOString(),
            });
            llmCallCount++;
          }
          if (round === 1) {
            state = { ...state, discussionRound: 2 };
          }
        }
        state = { ...state, phase: 'team_building' as const, hasDiscussedThisQuest: true };
        recentSpeeches = [];
        break;
      }

      case 'team_building': {
        const leader = getCurrentLeader(state);
        const prompt = buildTeamBuildingPrompt(state, leader.id);
        const response = await callAIProvider(leader.aiModel!, prompt, 'team_building');
        const { team, wasFallback } = parseAndValidateTeam(response, state, leader.id);
        if (wasFallback) fallbackCounts.teamBuilding++;
        llmCallCount++;

        const questRound = state.currentQuest;
        proposalIndexPerQuest[questRound] = (proposalIndexPerQuest[questRound] || 0) + 1;

        const proposedBy = leader.id;
        const proposedTeam = [...team];

        state = proposeTeam(state, team);

        // If forced team (5th reject) → transitions directly to 'quest'
        if (state.phase === 'quest') {
          teamProposals.push({
            questRound,
            proposalIndex: proposalIndexPerQuest[questRound],
            proposedBy,
            team: proposedTeam,
            votes: {},
            accepted: true,
          });
        }
        // Otherwise phase is 'team_vote', handled in next iteration
        break;
      }

      case 'team_vote': {
        // Snapshot before votes mutate state
        const snapshotQuestRound = state.currentQuest;
        const snapshotProposedTeam = [...(state.currentProposedTeam || [])];
        const snapshotProposedBy = state.players[state.currentLeaderIndex].id;

        const votesRecord: Record<string, 'approve' | 'reject'> = {};

        for (const player of state.players) {
          const prompt = buildVotingPrompt(state, player.id, state.currentProposedTeam || [], mode);
          const response = await callAIProvider(player.aiModel!, prompt, 'voting');
          const validated = validateVotingOutput(response);
          const approve = validated.vote ?? (Math.random() > 0.5);
          if (validated.vote === null) fallbackCounts.voting++;

          votesRecord[String(player.id)] = approve ? 'approve' : 'reject';
          llmCallCount++;
          state = submitVote(state, player.id, approve);
        }

        const approveCount = Object.values(votesRecord).filter(v => v === 'approve').length;
        const accepted = approveCount > state.playerCount - approveCount;

        teamProposals.push({
          questRound: snapshotQuestRound,
          proposalIndex: proposalIndexPerQuest[snapshotQuestRound] || 1,
          proposedBy: snapshotProposedBy,
          team: snapshotProposedTeam,
          votes: votesRecord,
          accepted,
        });

        // state.phase already set by resolveVote (quest/discussion/team_building/game_over)
        break;
      }

      case 'quest': {
        const quest = state.quests[state.currentQuest - 1];
        const teamMemberIds = quest.team || [];

        // Snapshot for quest log
        const questVotesRecord: Record<string, 'approve' | 'reject'> = {};
        // Find the matching accepted proposal's votes
        const acceptedProposal = teamProposals.find(
          tp => tp.questRound === state.currentQuest && tp.accepted
        );
        if (acceptedProposal) {
          Object.assign(questVotesRecord, acceptedProposal.votes);
        }

        const actionsRecord: Record<string, 'success' | 'fail'> = {};

        for (const playerId of teamMemberIds) {
          const player = state.players.find(p => p.id === playerId)!;
          const isEvil = ROLES[player.role!].team === 'evil';

          if (!isEvil) {
            actionsRecord[String(playerId)] = 'success';
            state = submitQuestAction(state, playerId, true);
          } else {
            const prompt = buildQuestActionPrompt(state, playerId, mode);
            const response = await callAIProvider(player.aiModel!, prompt, 'quest');
            const validated = validateQuestActionOutput(response, isEvil);
            if (!validated.isValid) fallbackCounts.quest++;
            llmCallCount++;

            actionsRecord[String(playerId)] = validated.success ? 'success' : 'fail';
            state = submitQuestAction(state, playerId, validated.success);
          }
        }

        // Quest result determined by resolveQuest (auto-triggered by last submitQuestAction)
        const resolvedQuest = state.quests[state.currentQuest - 1] || state.quests[state.quests.length - 1];
        // After resolveQuest, currentQuest may have incremented. Find the quest we just resolved.
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
        break;
      }

      case 'assassination': {
        const assassin = state.players.find(p => p.role === 'assassin')!;
        const prompt = buildAssassinationPrompt(state, assassin.id, mode);
        const response = await callAIProvider(assassin.aiModel!, prompt, 'assassination');
        const { targetId, wasFallback } = parseTargetId(response, state);
        if (wasFallback) fallbackCounts.assassination++;
        llmCallCount++;

        state = attemptAssassination(state, targetId);
        break;
      }

      default:
        // Unexpected phase — skip to avoid infinite loop
        throw new Error(`Unexpected phase: ${state.phase}`);
    }
  }

  // 4. Build log entry
  const merlin = state.players.find(p => p.role === 'merlin')!;
  let winReason: string;
  if (state.winner === 'evil') {
    if (state.assassinationTarget !== undefined && state.players.find(p => p.id === state.assassinationTarget)?.role === 'merlin') {
      winReason = 'merlin_assassinated';
    } else if (state.evilWins >= 3) {
      winReason = 'three_quests_failed';
    } else {
      winReason = 'five_consecutive_rejects';
    }
  } else {
    winReason = 'three_quests_succeeded';
  }

  const assassinationLog = state.assassinationTarget !== undefined ? {
    attemptedBy: state.players.find(p => p.role === 'assassin')!.id,
    target: state.assassinationTarget,
    merlinId: merlin.id,
    correct: state.players.find(p => p.id === state.assassinationTarget)?.role === 'merlin',
  } : null;

  const log: GameLog = {
    gameId,
    timestamp: new Date().toISOString(),
    config: config.name,
    players: state.players.map(p => ({
      id: p.id,
      role: p.role!,
      model: p.aiModel!.model,
      provider: p.aiModel!.provider,
    })),
    teamProposals,
    quests: questLogs,
    discussions,
    assassination: assassinationLog,
    winner: state.winner!,
    winReason,
    llmCallCount,
    durationMs: Date.now() - startTime,
    fallbackCounts,
  };

  return log;
}

// ==================== File I/O ====================

function ensureDir(dirPath: string): void {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function appendJsonl(filePath: string, data: unknown): void {
  fs.appendFileSync(filePath, JSON.stringify(data) + '\n');
}

// ==================== Main ====================

async function main() {
  const { games, configNames } = parseArgs();
  const dataDir = path.resolve('data');
  ensureDir(dataDir);

  const gamesFile = path.join(dataDir, 'games.jsonl');
  const failuresFile = path.join(dataDir, 'failures.jsonl');

  const totalGames = games * configNames.length;
  console.log(`Starting batch: ${games} games × ${configNames.length} configs = ${totalGames} total games`);
  console.log(`Configs: ${configNames.join(', ')}`);
  console.log(`Output: ${gamesFile}`);
  console.log('');

  const limit = pLimit(2);
  let completed = 0;
  let failed = 0;

  const tasks: Promise<void>[] = [];

  for (const configName of configNames) {
    const config = CONFIGS[configName];
    for (let i = 1; i <= games; i++) {
      tasks.push(
        limit(async () => {
          const label = `[${configName} game ${i}/${games}]`;
          try {
            const log = await runGame(config);
            appendJsonl(gamesFile, log);
            completed++;
            console.log(
              `Game ${completed + failed}/${totalGames} complete, ` +
              `config=${configName}, winner=${log.winner}, ` +
              `duration=${Math.round(log.durationMs / 1000)}s, ` +
              `llmCalls=${log.llmCallCount}, ` +
              `fallbacks=${Object.values(log.fallbackCounts).reduce((a, b) => a + b, 0)}`
            );
          } catch (error) {
            failed++;
            const errMsg = error instanceof Error ? error.message : String(error);
            console.error(`${label} FAILED: ${errMsg}`);
            appendJsonl(failuresFile, {
              timestamp: new Date().toISOString(),
              config: configName,
              error: errMsg,
              gameNumber: i,
            });
          }
        })
      );
    }
  }

  await Promise.all(tasks);

  console.log('');
  console.log(`Batch complete: ${completed} succeeded, ${failed} failed out of ${totalGames}`);
  if (completed > 0) console.log(`Results written to ${gamesFile}`);
  if (failed > 0) console.log(`Failures written to ${failuresFile}`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});

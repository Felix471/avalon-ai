import { getPlayerVision } from '@/lib/game/engine';
import { GameState, ROLES } from '@/lib/game/types';

interface MockAIInput {
  model: { provider: string; model: string; name?: string };
  prompt: string;
  action: string;
  context?: { gameState?: GameState; playerId?: number };
}

const EVIL_ROLES = new Set(['assassin', 'morgana', 'mordred', 'oberon', 'minion']);

function hashString(value: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index++) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

function getSeed(gameState: GameState, playerId: number | undefined, action: string): number {
  return hashString(
    `${gameState.gameId ?? 'nogame'}:${playerId}:${action}:${gameState.events.length}:${gameState.currentQuest}:${gameState.consecutiveRejects}`,
  );
}

function getSeatOrder(gameState: GameState, leaderId: number): number[] {
  const leaderIndex = gameState.players.findIndex(player => player.id === leaderId);
  if (leaderIndex < 0) return gameState.players.map(player => player.id);

  return gameState.players.map((_, offset) => (
    gameState.players[(leaderIndex + offset) % gameState.players.length].id
  ));
}

function buildDiscussion(gameState: GameState, playerId: number, seed: number): string {
  const player = gameState.players.find(candidate => candidate.id === playerId);
  const otherIds = gameState.players
    .map(candidate => candidate.id)
    .filter(candidateId => candidateId !== playerId);
  const targetId = otherIds[seed % Math.max(otherIds.length, 1)] ?? playerId;
  const quest = gameState.currentQuest;

  if (player?.role && EVIL_ROLES.has(player.role)) {
    const templates = [
      `[mock] ${playerId}号：第${quest}轮先看${targetId}号的组队逻辑。`,
      `[mock] ${playerId}号：第${quest}轮我倾向信任${targetId}号，但要看投票。`,
      `[mock] ${playerId}号：第${quest}轮建议让${targetId}号说明判断依据。`,
    ];
    return templates[seed % templates.length];
  }

  const templates = [
    `[mock] ${playerId}号：第${quest}轮我暂时信任${targetId}号。`,
    `[mock] ${playerId}号：第${quest}轮我会重点观察${targetId}号。`,
    `[mock] ${playerId}号：第${quest}轮我对${targetId}号的判断仍存疑。`,
  ];
  return templates[seed % templates.length];
}

function buildVote(gameState: GameState, playerId: number, seed: number): string {
  const team = gameState.currentProposedTeam ?? [];
  if (team.includes(playerId)) return 'APPROVE';

  const player = gameState.players.find(candidate => candidate.id === playerId);
  if (!player?.role) return 'APPROVE';

  const vision = getPlayerVision(gameState, playerId);
  const isEvil = ROLES[player.role].team === 'evil';
  if (!isEvil && team.some(candidateId => vision.knownEvil.includes(candidateId))) {
    return 'REJECT';
  }
  if (isEvil && !team.some(candidateId => vision.teammates.includes(candidateId)) && seed % 2 === 0) {
    return 'REJECT';
  }
  if (gameState.consecutiveRejects >= 3) return 'APPROVE';
  return seed % 3 === 0 ? 'REJECT' : 'APPROVE';
}

function buildTeam(gameState: GameState, playerId: number): string {
  const leader = gameState.players.find(player => player.id === playerId)
    ?? gameState.players[gameState.currentLeaderIndex];
  const leaderId = leader?.id ?? gameState.players[0]?.id;
  if (leaderId === undefined) return '1,2';

  const requiredPlayers = gameState.quests[gameState.currentQuest - 1]?.requiredPlayers ?? 2;
  const vision = getPlayerVision(gameState, leaderId);
  const seatOrder = getSeatOrder(gameState, leaderId);
  const team = [leaderId];
  const leaderIsEvil = Boolean(leader?.role && ROLES[leader.role].team === 'evil');

  if (leaderIsEvil && requiredPlayers >= 3) {
    const teammate = seatOrder.find(id => vision.teammates.includes(id));
    if (teammate !== undefined) team.push(teammate);
  }

  for (const candidateId of seatOrder.slice(1)) {
    if (team.length >= requiredPlayers) break;
    if (!team.includes(candidateId) && !vision.knownEvil.includes(candidateId)) {
      team.push(candidateId);
    }
  }

  for (const candidateId of seatOrder.slice(1)) {
    if (team.length >= requiredPlayers) break;
    if (!team.includes(candidateId)) team.push(candidateId);
  }

  return team.slice(0, requiredPlayers).join(',');
}

function buildAssassination(gameState: GameState, seed: number): string {
  const goodPlayers = gameState.players.filter(
    player => player.role && ROLES[player.role].team === 'good',
  );
  const merlin = goodPlayers.find(player => player.role === 'merlin');
  const nonMerlin = goodPlayers.filter(player => player.role !== 'merlin');

  if (merlin && (seed % 2 === 0 || nonMerlin.length === 0)) return String(merlin.id);
  return String(nonMerlin[seed % Math.max(nonMerlin.length, 1)]?.id ?? goodPlayers[0]?.id ?? 1);
}

export function isMockAIEnabled(): boolean {
  return process.env.MOCK_AI === '1' && !process.env.VERCEL;
}

export function mockAIResponse(input: MockAIInput): string {
  const gameState = input.context?.gameState;
  if (!gameState) {
    if (input.action === 'voting') return 'APPROVE';
    if (input.action === 'quest') return 'SUCCESS';
    if (input.action === 'team_building') return '1,2';
    if (input.action === 'assassination') return '1';
    return '[mock] OK';
  }

  const playerId = input.context?.playerId ?? gameState.players[0]?.id ?? 1;
  const player = gameState.players.find(candidate => candidate.id === playerId);
  const seed = getSeed(gameState, playerId, input.action);

  switch (input.action) {
    case 'discussion':
      return buildDiscussion(gameState, playerId, seed);
    case 'voting':
      return buildVote(gameState, playerId, seed);
    case 'quest':
      return player?.role && ROLES[player.role].team === 'evil' && seed % 3 !== 0
        ? 'FAIL'
        : 'SUCCESS';
    case 'team_building':
      return buildTeam(gameState, playerId);
    case 'assassination':
      return buildAssassination(gameState, seed);
    default:
      return '[mock] OK';
  }
}

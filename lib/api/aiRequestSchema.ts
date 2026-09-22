import { z } from 'zod';

import { AI_MODELS } from '@/lib/game/types';

/**
 * Trust boundary for AI requests. The browser posts the entire game state,
 * including secret roles; the server only guarantees a valid shape and that
 * the requested model is one the server is willing to pay for.
 */

const roleSchema = z.enum([
  'merlin',
  'percival',
  'loyal',
  'assassin',
  'morgana',
  'mordred',
  'oberon',
  'minion',
]);

const providerSchema = z.enum(['openai', 'anthropic', 'google', 'deepseek', 'xai']);

const aiModelSchema = z.strictObject({
  id: z.string(),
  name: z.string(),
  provider: providerSchema,
  model: z.string(),
  color: z.string(),
});

const playerSchema = z.looseObject({
  id: z.number().int().min(1),
  name: z.string(),
  isHuman: z.boolean(),
  role: roleSchema,
  aiModel: aiModelSchema.optional(),
});

const questSchema = z.strictObject({
  questNumber: z.number().int(),
  requiredPlayers: z.number().int().min(2).max(5),
  requiresDoubleFail: z.boolean(),
  team: z.array(z.number().int()).optional(),
  actions: z.record(z.string(), z.boolean()).optional(),
  votes: z.record(z.string(), z.boolean()).optional(),
  result: z.enum(['success', 'fail', 'pending']).optional(),
});

const eventSchema = z.strictObject({
  id: z.string(),
  timestamp: z.number(),
  type: z.enum([
    'discussion',
    'assassination',
    'vote',
    'vote_result',
    'quest_action',
    'quest_result',
    'team_proposal',
    'system',
  ]),
  playerId: z.number().int().optional(),
  playerName: z.string().optional(),
  content: z.string().max(5000),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

const gameStateSchema = z.looseObject({
  playerCount: z.number().int().min(5).max(10),
  phase: z.enum([
    'lobby',
    'role_reveal',
    'discussion',
    'team_building',
    'team_vote',
    'quest',
    'assassination',
    'game_over',
  ]),
  currentQuest: z.number().int().min(1).max(5),
  currentLeaderIndex: z.number().int().min(0),
  consecutiveRejects: z.number().int().min(0).max(5),
  goodWins: z.number().int().min(0).max(3),
  evilWins: z.number().int().min(0).max(3),
  humanPlayerId: z.number().int(),
  variantRules: z.strictObject({
    assassinAnytime: z.boolean(),
    discussionMode: z.enum(['first_only', 'every_time']),
    fifthVoteRule: z.enum(['auto_fail', 'force_team', 'evil_wins']),
  }),
  players: z.array(playerSchema).min(5).max(10),
  quests: z.array(questSchema).length(5),
  events: z.array(eventSchema).max(2000),
  currentProposedTeam: z.array(z.number().int()).optional(),
  currentVotes: z.record(z.string(), z.boolean()).optional(),
  discussionRound: z.number().int().optional(),
  gameId: z.string(),
  hasDiscussedThisQuest: z.boolean(),
  winner: z.enum(['good', 'evil']).optional(),
  assassinationTarget: z.number().int().optional(),
});

export const aiRequestSchema = z.strictObject({
  playerId: z.number().int().positive(),
  action: z.enum(['discussion', 'voting', 'quest', 'team_building', 'assassination']),
  recentSpeeches: z
    .array(
      z.strictObject({
        playerId: z.number().int().positive(),
        content: z.string().max(2000),
      }),
    )
    .max(100)
    .optional(),
  humanInput: z.string().max(500).optional(),
  promptMode: z.enum(['full', 'naive']).optional(),
  generation: z.strictObject({
    temperature: z.number().min(0).max(1.5).optional(),
    maxTokens: z.number().int().min(100).max(1500).optional(),
  }).optional(),
  gameState: gameStateSchema,
}).superRefine((request, context) => {
  const { gameState, playerId } = request;
  const playerIds = new Set<number>();

  for (const [index, player] of gameState.players.entries()) {
    if (playerIds.has(player.id)) {
      context.addIssue({
        code: 'custom',
        path: ['gameState', 'players', index, 'id'],
        message: 'duplicate_player_id',
      });
    }
    playerIds.add(player.id);
  }

  if (!playerIds.has(gameState.humanPlayerId)) {
    context.addIssue({
      code: 'custom',
      path: ['gameState', 'humanPlayerId'],
      message: 'human_player_not_found',
    });
  }

  if (gameState.currentLeaderIndex >= gameState.players.length) {
    context.addIssue({
      code: 'custom',
      path: ['gameState', 'currentLeaderIndex'],
      message: 'leader_index_out_of_range',
    });
  }

  if (gameState.playerCount !== gameState.players.length) {
    context.addIssue({
      code: 'custom',
      path: ['gameState', 'playerCount'],
      message: 'player_count_mismatch',
    });
  }

  const targetPlayer = gameState.players.find((player) => player.id === playerId);
  if (!targetPlayer) {
    context.addIssue({
      code: 'custom',
      path: ['playerId'],
      message: 'player_not_found',
    });
    return;
  }

  if (targetPlayer.isHuman) {
    context.addIssue({
      code: 'custom',
      path: ['playerId'],
      message: 'player_must_be_ai',
    });
  }

  const modelAllowed =
    targetPlayer.aiModel !== undefined &&
    AI_MODELS.some(
      (model) =>
        model.model === targetPlayer.aiModel?.model &&
        model.provider === targetPlayer.aiModel.provider,
    );

  if (!modelAllowed) {
    context.addIssue({
      code: 'custom',
      path: ['gameState', 'players', gameState.players.indexOf(targetPlayer), 'aiModel'],
      message: 'model_not_allowed',
    });
  }
});

export type AIRequest = z.infer<typeof aiRequestSchema>;

export type ParseAIRequestResult =
  | { ok: true; data: AIRequest }
  | { ok: false; error: string; issues: string[] };

export function parseAIRequest(body: unknown): ParseAIRequestResult {
  const result = aiRequestSchema.safeParse(body);
  if (result.success) {
    return { ok: true, data: result.data };
  }

  const issues = result.error.issues.slice(0, 20).map((issue) => {
    const path = issue.path.length > 0 ? issue.path.join('.') : 'request';
    return `${path}: ${issue.message}`;
  });

  return { ok: false, error: 'invalid_request', issues };
}

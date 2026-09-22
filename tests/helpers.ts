import {
  AI_MODELS,
  DOUBLE_FAIL_QUESTS,
  GameState,
  QUEST_SIZES,
  ROLE_CONFIGS,
} from '@/lib/game/types';

export function makeState(overrides: Partial<GameState> = {}): GameState {
  const playerCount = overrides.playerCount ?? 5;
  const roles = ROLE_CONFIGS[playerCount];
  const questSizes = QUEST_SIZES[playerCount];
  const doubleFailQuests = DOUBLE_FAIL_QUESTS[playerCount] ?? [];

  const state: GameState = {
    gameId: 'test-game',
    playerCount,
    phase: 'discussion',
    variantRules: {
      assassinAnytime: false,
      discussionMode: 'every_time',
      fifthVoteRule: 'force_team',
    },
    players: roles.map((role, index) => ({
      id: index + 1,
      name: `Player ${index + 1}`,
      isHuman: index === 0,
      role,
      aiModel: AI_MODELS[index % AI_MODELS.length],
    })),
    humanPlayerId: 1,
    currentLeaderIndex: 0,
    currentQuest: 1,
    quests: questSizes.map((requiredPlayers, index) => ({
      questNumber: index + 1,
      requiredPlayers,
      requiresDoubleFail: doubleFailQuests.includes(index + 1),
      result: 'pending',
    })),
    consecutiveRejects: 0,
    hasDiscussedThisQuest: false,
    goodWins: 0,
    evilWins: 0,
    events: [],
    discussionRound: 1,
  };

  return { ...state, ...overrides };
}

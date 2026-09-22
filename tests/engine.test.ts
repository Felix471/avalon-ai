import { describe, expect, it } from 'vitest';
import {
  attemptAssassination,
  createGame,
  getPlayerVision,
  isForcedTeamBuilding,
  proposeTeam,
  shouldHaveDiscussion,
  submitQuestAction,
  submitVote,
} from '@/lib/game/engine';
import {
  AI_MODELS,
  DEFAULT_GENERATION,
  GameConfig,
  GameState,
  QUEST_SIZES,
  ROLE_CONFIGS,
} from '@/lib/game/types';
import { makeState } from './helpers';

function makeConfig(playerCount: number): GameConfig {
  return {
    playerCount,
    enabledModels: AI_MODELS.map(model => model.id),
    seats: Array.from({ length: playerCount - 1 }, (_, index) => ({
      modelId: AI_MODELS[index % AI_MODELS.length].id,
    })),
    generation: DEFAULT_GENERATION,
    promptMode: 'full',
    quickMode: false,
    roles: ROLE_CONFIGS[playerCount],
    questSizes: QUEST_SIZES[playerCount],
    variantRules: {
      assassinAnytime: false,
      discussionMode: 'every_time',
      fifthVoteRule: 'force_team',
    },
  };
}

function vote(state: GameState, approvals: boolean[]): GameState {
  return approvals.reduce(
    (current, approve, index) => submitVote(current, index + 1, approve),
    state,
  );
}

function questState(
  overrides: Partial<GameState> = {},
  team: number[] = [1, 2],
): GameState {
  const state = makeState({ phase: 'quest', ...overrides });
  return {
    ...state,
    quests: state.quests.map((quest, index) =>
      index === state.currentQuest - 1 ? { ...quest, team, actions: {} } : quest,
    ),
  };
}

function act(state: GameState, actions: Array<[number, boolean]>): GameState {
  return actions.reduce(
    (current, [playerId, success]) => submitQuestAction(current, playerId, success),
    state,
  );
}

describe('createGame', () => {
  it.each([5, 7])('creates a valid %i-player game', (playerCount: number) => {
    const state = createGame(makeConfig(playerCount));

    expect(state.players.map(player => player.role).sort()).toEqual(
      [...ROLE_CONFIGS[playerCount]].sort(),
    );
    expect(state.players.filter(player => player.isHuman)).toHaveLength(1);
    expect(state.quests.map(quest => quest.requiredPlayers)).toEqual(QUEST_SIZES[playerCount]);
    expect(state.quests.map(quest => quest.requiresDoubleFail)).toEqual(
      [false, false, false, playerCount >= 7, false],
    );
  });

  it('assigns explicit seat models in order and enables one discussion round in quick mode', () => {
    const config = makeConfig(5);
    config.seats = [
      { modelId: AI_MODELS[4].id },
      { modelId: AI_MODELS[3].id },
      { modelId: AI_MODELS[2].id },
      { modelId: AI_MODELS[1].id },
    ];
    config.quickMode = true;

    const state = createGame(config);

    expect(
      state.players.filter(player => !player.isHuman).map(player => player.aiModel?.id),
    ).toEqual(config.seats.map(seat => seat.modelId));
    expect(state.discussionRounds).toBe(1);
    expect(state.promptMode).toBe('full');
    expect(state.generation).toEqual(DEFAULT_GENERATION);
  });
});

describe('getPlayerVision', () => {
  it('lets Merlin see evil players except Mordred', () => {
    const base = makeState({ playerCount: 7 });
    const state = {
      ...base,
      players: base.players.map(player =>
        player.id === 7 ? { ...player, role: 'mordred' as const } : player,
      ),
    };

    expect(getPlayerVision(state, 1).knownEvil).toEqual([5, 6]);
  });

  it('lets Percival see only Merlin and Morgana', () => {
    expect(getPlayerVision(makeState(), 2).knownMerlinOrMorgana).toEqual([1, 5]);
  });

  it('lets the Assassin see Morgana but not Oberon', () => {
    const base = makeState({ playerCount: 7 });
    const state = {
      ...base,
      players: base.players.map(player =>
        player.id === 7 ? { ...player, role: 'oberon' as const } : player,
      ),
    };

    expect(getPlayerVision(state, 5).teammates).toContain(6);
    expect(getPlayerVision(state, 5).teammates).not.toContain(7);
  });

  it('gives Loyal Servants and Oberon no teammates', () => {
    const base = makeState({ playerCount: 7 });
    const state = {
      ...base,
      players: base.players.map(player =>
        player.id === 7 ? { ...player, role: 'oberon' as const } : player,
      ),
    };

    expect(getPlayerVision(state, 3)).toEqual({
      knownEvil: [],
      knownMerlinOrMorgana: [],
      teammates: [],
    });
    expect(getPlayerVision(state, 7).teammates).toEqual([]);
  });
});

describe('team proposals and voting', () => {
  it('passes a three-to-two vote and assigns the quest team', () => {
    const proposed = proposeTeam(makeState({ phase: 'team_building' }), [1, 3]);
    const result = vote(proposed, [true, true, true, false, false]);

    expect(result.phase).toBe('quest');
    expect(result.consecutiveRejects).toBe(0);
    expect(result.quests[0].team).toEqual([1, 3]);
  });

  it('rejects a two-to-three vote, advances the leader, and returns to discussion', () => {
    const proposed = proposeTeam(makeState({
      phase: 'team_building',
      currentLeaderIndex: 4,
      consecutiveRejects: 1,
    }), [1, 3]);
    const result = vote(proposed, [true, true, false, false, false]);

    expect(result.phase).toBe('discussion');
    expect(result.currentLeaderIndex).toBe(0);
    expect(result.consecutiveRejects).toBe(2);
    expect(result.currentProposedTeam).toBeUndefined();
  });

  it('treats three reject votes as a rejected proposal', () => {
    const proposed = proposeTeam(makeState({ phase: 'team_building' }), [1, 2]);
    const result = vote(proposed, [false, false, false, true, true]);

    expect(result.phase).toBe('discussion');
    expect(result.consecutiveRejects).toBe(1);
  });

  it('awards evil the game after a fifth rejection under evil_wins', () => {
    const state = makeState({
      phase: 'team_building',
      consecutiveRejects: 4,
      variantRules: {
        assassinAnytime: false,
        discussionMode: 'every_time',
        fifthVoteRule: 'evil_wins',
      },
    });
    const result = vote(proposeTeam(state, [1, 2]), [false, false, false, true, true]);

    expect(result.phase).toBe('game_over');
    expect(result.winner).toBe('evil');
    expect(result.consecutiveRejects).toBe(5);
  });

  it('forces the fifth team without a vote under force_team', () => {
    const result = proposeTeam(makeState({
      phase: 'team_building',
      consecutiveRejects: 4,
    }), [1, 3]);

    expect(result.phase).toBe('quest');
    expect(result.quests[0].team).toEqual([1, 3]);
    expect(result.currentVotes).toBeUndefined();
    expect(result.consecutiveRejects).toBe(0);
    expect(result.events.at(-1)?.content).toContain('强制组队');
  });
});

describe('quest resolution', () => {
  it('waits for every team member before resolving', () => {
    const pending = submitQuestAction(questState(), 1, true);

    expect(pending.quests[0].result).toBe('pending');
    expect(pending.phase).toBe('quest');
  });

  it('fails a normal quest with one fail action', () => {
    const result = act(questState(), [[1, false], [2, true]]);

    expect(result.quests[0].result).toBe('fail');
    expect(result.evilWins).toBe(1);
  });

  it('succeeds a double-fail quest with only one fail action', () => {
    const result = act(
      questState({ playerCount: 7, currentQuest: 4 }, [1, 2, 3, 4]),
      [[1, false], [2, true], [3, true], [4, true]],
    );

    expect(result.quests[3].result).toBe('success');
    expect(result.goodWins).toBe(1);
  });

  it('fails a double-fail quest with two fail actions', () => {
    const result = act(
      questState({ playerCount: 7, currentQuest: 4 }, [1, 2, 3, 4]),
      [[1, false], [2, false], [3, true], [4, true]],
    );

    expect(result.quests[3].result).toBe('fail');
    expect(result.evilWins).toBe(1);
  });

  it('resets round state and advances the leader after a non-final quest', () => {
    const result = act(questState({
      currentLeaderIndex: 2,
      consecutiveRejects: 3,
      hasDiscussedThisQuest: true,
    }), [[1, true], [2, true]]);

    expect(result).toMatchObject({
      currentQuest: 2,
      currentLeaderIndex: 3,
      hasDiscussedThisQuest: false,
      consecutiveRejects: 0,
      phase: 'discussion',
      goodWins: 1,
    });
  });

  it('moves to assassination after the third good win', () => {
    const result = act(questState({ goodWins: 2 }), [[1, true], [2, true]]);

    expect(result.goodWins).toBe(3);
    expect(result.phase).toBe('assassination');
    expect(result.winner).toBeUndefined();
  });

  it('ends the game after the third evil win', () => {
    const result = act(questState({ evilWins: 2 }), [[1, false], [2, true]]);

    expect(result.evilWins).toBe(3);
    expect(result.phase).toBe('game_over');
    expect(result.winner).toBe('evil');
  });
});

describe('attemptAssassination', () => {
  it('awards evil the game when Merlin is targeted', () => {
    const result = attemptAssassination(makeState({ phase: 'assassination' }), 1);

    expect(result).toMatchObject({
      phase: 'game_over',
      winner: 'evil',
      assassinationTarget: 1,
    });
    expect(result.events.at(-1)?.metadata?.success).toBe(true);
  });

  it('awards good the game when a non-Merlin player is targeted', () => {
    const result = attemptAssassination(makeState({ phase: 'assassination' }), 2);

    expect(result).toMatchObject({
      phase: 'game_over',
      winner: 'good',
      assassinationTarget: 2,
    });
    expect(result.events.at(-1)?.metadata?.success).toBe(false);
  });
});

describe('discussion and forced-team rules', () => {
  it('skips discussion and forces team building after four rejections', () => {
    const state = makeState({ consecutiveRejects: 4 });

    expect(shouldHaveDiscussion(state)).toBe(false);
    expect(isForcedTeamBuilding(state)).toBe(true);
  });

  it('uses hasDiscussedThisQuest in first_only mode', () => {
    const variantRules = {
      assassinAnytime: false,
      discussionMode: 'first_only' as const,
      fifthVoteRule: 'force_team' as const,
    };

    expect(shouldHaveDiscussion(makeState({ variantRules }))).toBe(true);
    expect(shouldHaveDiscussion(makeState({ variantRules, hasDiscussedThisQuest: true }))).toBe(false);
  });
});

import {
  GameState, GameConfig, Player, Quest, GameEvent, GamePhase,
  RoleType, Team, AIModel, AI_MODELS, ROLES,
  ROLE_CONFIGS, QUEST_SIZES, DOUBLE_FAIL_QUESTS, VariantRules,
  DISCUSSION_ROUNDS
} from './types';

// ==================== 工具函数 ====================

function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

function generateId(): string {
  return Math.random().toString(36).substring(2, 9);
}

// ==================== 游戏初始化 ====================

export function createGame(config: GameConfig): GameState {
  const {
    playerCount,
    enabledModels,
    variantRules,
    promptMode,
    generation,
    quickMode,
  } = config;

  const availableModels = AI_MODELS.filter(m => enabledModels.includes(m.id));
  const shuffledModels = shuffleArray(availableModels);
  const firstEnabledModel = enabledModels
    .map(id => AI_MODELS.find(model => model.id === id))
    .find((model): model is AIModel => model !== undefined) ?? AI_MODELS[0];
  const hasExplicitSeats = config.seats.length === playerCount - 1;

  const players: Player[] = [];
  const humanPlayerId = Math.floor(Math.random() * playerCount) + 1;

  let modelIndex = 0;
  for (let i = 1; i <= playerCount; i++) {
    if (i === humanPlayerId) {
      players.push({ id: i, name: '你', isHuman: true });
    } else {
      const model = hasExplicitSeats
        ? AI_MODELS.find(candidate => candidate.id === config.seats[modelIndex].modelId)
          ?? firstEnabledModel
        : shuffledModels[modelIndex % shuffledModels.length] ?? firstEnabledModel;
      modelIndex++;
      players.push({ id: i, name: model.name, isHuman: false, aiModel: model });
    }
  }

  const roles = shuffleArray(ROLE_CONFIGS[playerCount]);
  players.forEach((player, index) => {
    player.role = roles[index];
  });

  const questSizes = QUEST_SIZES[playerCount];
  const doubleFails = DOUBLE_FAIL_QUESTS[playerCount] || [];
  const quests: Quest[] = questSizes.map((size, index) => ({
    questNumber: index + 1,
    requiredPlayers: size,
    requiresDoubleFail: doubleFails.includes(index + 1),
    result: 'pending',
  }));

  return {
    gameId: generateId(),
    playerCount,
    phase: 'role_reveal',
    variantRules: variantRules || {
      assassinAnytime: false,
      discussionMode: 'every_time',
      fifthVoteRule: 'force_team',
    },
    players,
    humanPlayerId,
    currentLeaderIndex: Math.floor(Math.random() * playerCount),
    currentQuest: 1,
    quests,
    consecutiveRejects: 0,
    hasDiscussedThisQuest: false,
    goodWins: 0,
    evilWins: 0,
    events: [],
    discussionRound: 1,
    discussionRounds: quickMode ? 1 : DISCUSSION_ROUNDS,
    promptMode,
    generation: { ...generation },
  };
}

// ==================== 视野信息 ====================

export function getPlayerVision(state: GameState, playerId: number): {
  knownEvil: number[];
  knownMerlinOrMorgana: number[];
  teammates: number[];
} {
  const player = state.players.find(p => p.id === playerId)!;
  const role = player.role!;

  const result = {
    knownEvil: [] as number[],
    knownMerlinOrMorgana: [] as number[],
    teammates: [] as number[],
  };

  if (role === 'merlin') {
    result.knownEvil = state.players
      .filter(p => ROLES[p.role!].team === 'evil' && p.role !== 'mordred')
      .map(p => p.id);
  } else if (role === 'percival') {
    result.knownMerlinOrMorgana = state.players
      .filter(p => p.role === 'merlin' || p.role === 'morgana')
      .map(p => p.id);
  } else if (ROLES[role].team === 'evil' && role !== 'oberon') {
    result.teammates = state.players
      .filter(p => ROLES[p.role!].team === 'evil' && p.role !== 'oberon' && p.id !== playerId)
      .map(p => p.id);
  }

  return result;
}

// ==================== 游戏流程控制 ====================

export function getCurrentLeader(state: GameState): Player {
  return state.players[state.currentLeaderIndex];
}

export function advanceLeader(state: GameState): GameState {
  return {
    ...state,
    currentLeaderIndex: (state.currentLeaderIndex + 1) % state.playerCount,
  };
}

export function addEvent(state: GameState, event: Omit<GameEvent, 'id' | 'timestamp'>): GameState {
  const newEvent: GameEvent = {
    ...event,
    id: generateId(),
    timestamp: Date.now(),
  };
  return {
    ...state,
    events: [...state.events, newEvent],
  };
}

// ==================== 阶段转换 ====================

export function transitionTo(state: GameState, phase: GamePhase): GameState {
  return { ...state, phase };
}

export function startDiscussion(state: GameState): GameState {
  return {
    ...state,
    phase: 'discussion',
    discussionRound: 1,
  };
}

export function startTeamBuilding(state: GameState): GameState {
  return {
    ...state,
    phase: 'team_building',
    currentProposedTeam: undefined,
  };
}

/**
 * 判断是否需要进入发言阶段
 */
export function shouldHaveDiscussion(state: GameState): boolean {
  // 第5次组队（force_team模式下）直接跳过发言
  if (state.variantRules.fifthVoteRule === 'force_team' && state.consecutiveRejects >= 4) {
    return false;
  }

  // every_time 模式：每次都发言
  if (state.variantRules.discussionMode === 'every_time') {
    return true;
  }

  // first_only 模式：只有本任务第一次组队才发言
  if (state.variantRules.discussionMode === 'first_only') {
    const result = !state.hasDiscussedThisQuest;
    return result;
  }

  return true;
}

/**
 * 判断是否处于强制组队状态（第5次组队）
 */
export function isForcedTeamBuilding(state: GameState): boolean {
  return state.variantRules.fifthVoteRule === 'force_team' &&
         state.consecutiveRejects >= 4;
}

// ==================== 组队与投票 ====================

export function proposeTeam(state: GameState, teamIds: number[]): GameState {
  const leader = getCurrentLeader(state);
  const teamNames = teamIds.map(id => `玩家${id}`).join(', ');

  const isForcedTeam = state.variantRules.fifthVoteRule === 'force_team' &&
                       state.consecutiveRejects >= 4;

  if (isForcedTeam) {
    const newState = addEvent(state, {
      type: 'team_proposal',
      playerId: leader.id,
      playerName: `玩家${leader.id}`,
      content: `【强制组队】队伍: ${teamNames}`,
      metadata: { team: teamIds, forced: true },
    });

    return {
      ...newState,
      phase: 'quest',
      consecutiveRejects: 0,
      quests: newState.quests.map((q, i) =>
        i === state.currentQuest - 1
          ? { ...q, team: teamIds, actions: {} }
          : q
      ),
    };
  }

  return addEvent({
    ...state,
    phase: 'team_vote',
    currentProposedTeam: teamIds,
    currentVotes: {},
  }, {
    type: 'team_proposal',
    playerId: leader.id,
    playerName: `玩家${leader.id}`,
    content: `提议队伍: ${teamNames}`,
    metadata: { team: teamIds },
  });
}

export function submitVote(state: GameState, playerId: number, approve: boolean): GameState {
  const player = state.players.find(p => p.id === playerId)!;
  const newVotes = { ...state.currentVotes, [playerId]: approve };

  const updatedState = addEvent({
    ...state,
    currentVotes: newVotes,
  }, {
    type: 'vote',
    playerId,
    playerName: `玩家${playerId}`,
    content: approve ? '同意' : '反对',
    metadata: { approve },
  });

  // 检查是否所有人都投票了
  if (Object.keys(newVotes).length === state.playerCount) {
    return resolveVote(updatedState);
  }

  return updatedState;
}

function resolveVote(state: GameState): GameState {
  const votes = state.currentVotes!;
  const approveCount = Object.values(votes).filter(v => v).length;
  const rejectCount = Object.values(votes).filter(v => !v).length;
  const passed = approveCount > rejectCount;

  const updatedState = addEvent(state, {
    type: 'vote_result',
    content: `投票结果: ${approveCount}票同意, ${rejectCount}票反对 - ${passed ? '通过' : '否决'}`,
    metadata: { approveCount, rejectCount, passed },
  });

  if (passed) {
    return {
      ...updatedState,
      phase: 'quest',
      consecutiveRejects: 0,
      quests: updatedState.quests.map((q, i) =>
        i === state.currentQuest - 1
          ? { ...q, team: state.currentProposedTeam, actions: {} }
          : q
      ),
    };
  } else {
    // 投票否决
    const newConsecutiveRejects = state.consecutiveRejects + 1;

    // 检查是否使用 evil_wins 规则且连续否决5次
    if (state.variantRules.fifthVoteRule === 'evil_wins' && newConsecutiveRejects >= 5) {
      return {
        ...updatedState,
        phase: 'game_over',
        winner: 'evil',
        consecutiveRejects: newConsecutiveRejects,
      };
    }

    // 换下一位队长
    const advancedState = advanceLeader(updatedState);

    const nextState = {
      ...advancedState,
      consecutiveRejects: newConsecutiveRejects,
      currentProposedTeam: undefined,
      currentVotes: undefined,
    };

    // 判断下一阶段
    const shouldDiscuss = shouldHaveDiscussion(nextState);
    const nextPhase = shouldDiscuss ? 'discussion' : 'team_building';

    return { ...nextState, phase: nextPhase };
  }
}

// ==================== 任务执行 ====================

export function submitQuestAction(state: GameState, playerId: number, success: boolean): GameState {
  const quest = state.quests[state.currentQuest - 1];
  const newActions = { ...quest.actions, [playerId]: success };

  const updatedState = {
    ...state,
    quests: state.quests.map((q, i) =>
      i === state.currentQuest - 1
        ? { ...q, actions: newActions }
        : q
    ),
  };

  // 检查是否所有队员都行动了
  if (Object.keys(newActions).length === quest.team!.length) {
    return resolveQuest(updatedState);
  }

  return updatedState;
}

function resolveQuest(state: GameState): GameState {
  const quest = state.quests[state.currentQuest - 1];
  const actions = quest.actions!;
  const failCount = Object.values(actions).filter(a => !a).length;
  const failsRequired = quest.requiresDoubleFail ? 2 : 1;
  const questSuccess = failCount < failsRequired;

  const updatedQuests = state.quests.map((q, i) =>
    i === state.currentQuest - 1
      ? { ...q, result: questSuccess ? 'success' as const : 'fail' as const }
      : q
  );

  const newGoodWins = state.goodWins + (questSuccess ? 1 : 0);
  const newEvilWins = state.evilWins + (questSuccess ? 0 : 1);

  const updatedState = addEvent({
    ...state,
    quests: updatedQuests,
    goodWins: newGoodWins,
    evilWins: newEvilWins,
  }, {
    type: 'quest_result',
    content: `任务${state.currentQuest}${questSuccess ? '成功' : '失败'}！(${failCount}张失败票)`,
    metadata: { success: questSuccess, failCount },
  });

  // 检查游戏是否结束
  if (newGoodWins >= 3) {
    return { ...updatedState, phase: 'assassination' };
  } else if (newEvilWins >= 3) {
    return { ...updatedState, phase: 'game_over', winner: 'evil' };
  }

  // 继续下一轮 - 重要：重置状态
  return advanceLeader({
    ...updatedState,
    currentQuest: state.currentQuest + 1,
    phase: 'discussion',
    discussionRound: 1,
    hasDiscussedThisQuest: false,  // 新任务重置
    consecutiveRejects: 0,          // 新任务重置
    currentProposedTeam: undefined,
    currentVotes: undefined,
  });
}

// ==================== 刺杀阶段 ====================

export function attemptAssassination(state: GameState, targetId: number): GameState {
  const assassin = state.players.find(p => p.role === 'assassin')!;
  const target = state.players.find(p => p.id === targetId)!;
  const isMerlin = target.role === 'merlin';

  const updatedState = addEvent(state, {
    type: 'assassination',
    playerId: assassin.id,
    playerName: `玩家${assassin.id}`,
    content: `刺杀 玩家${target.id}`,
    metadata: { targetId, success: isMerlin },
  });

  return {
    ...updatedState,
    phase: 'game_over',
    winner: isMerlin ? 'evil' : 'good',
    assassinationTarget: targetId,
  };
}

// ==================== 辅助查询函数 ====================

export function getQuestTeamMembers(state: GameState): Player[] {
  const quest = state.quests[state.currentQuest - 1];
  if (!quest.team) return [];
  return quest.team.map(id => state.players.find(p => p.id === id)!);
}

export function isPlayerOnCurrentTeam(state: GameState, playerId: number): boolean {
  const quest = state.quests[state.currentQuest - 1];
  return quest.team?.includes(playerId) ?? false;
}

export function hasPlayerVoted(state: GameState, playerId: number): boolean {
  return state.currentVotes?.[playerId] !== undefined;
}

export function hasPlayerActed(state: GameState, playerId: number): boolean {
  const quest = state.quests[state.currentQuest - 1];
  return quest.actions?.[playerId] !== undefined;
}

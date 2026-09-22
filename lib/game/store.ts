import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { useSyncExternalStore } from 'react';
import {
  GameState, GameConfig, GamePhase, AI_MODELS, VariantRules
} from './types';
import {
  createGame, proposeTeam, submitVote, submitQuestAction,
  attemptAssassination, addEvent, transitionTo,
  shouldHaveDiscussion
} from './engine';

export interface PhaseProgress {
  key: string;
  discussion: {
    step: number;
    speeches: Array<{ step: number; playerId: number; content: string }>;
  };
  teamBuilding: {
    humanOverride: boolean;
    selectedPlayers: number[];
  };
  assassination: {
    humanOverride: boolean;
  };
}

export function getPhaseKey(gameState: GameState | null): string {
  return gameState
    ? `${gameState.phase}:${gameState.currentQuest}:${gameState.consecutiveRejects}`
    : 'lobby:0:0';
}

function createPhaseProgress(gameState: GameState | null): PhaseProgress {
  return {
    key: getPhaseKey(gameState),
    discussion: { step: 0, speeches: [] },
    teamBuilding: { humanOverride: false, selectedPlayers: [] },
    assassination: { humanOverride: false },
  };
}

interface GameStore {
  // 游戏配置（大厅阶段）
  config: GameConfig;
  updateConfig: (updates: Partial<GameConfig>) => void;

  // 游戏状态
  gameState: GameState | null;

  phaseProgress: PhaseProgress;
  getPhaseKey: () => string;
  ensurePhaseProgress: () => PhaseProgress;
  setDiscussionProgress: (
    step: number,
    speeches: PhaseProgress['discussion']['speeches']
  ) => void;
  appendDiscussionSpeech: (step: number, playerId: number, content: string) => void;
  setTeamBuildingProgress: (updates: Partial<PhaseProgress['teamBuilding']>) => void;
  setAssassinationProgress: (updates: Partial<PhaseProgress['assassination']>) => void;

  // 游戏操作
  startGame: () => void;
  resetGame: () => void;
  clearSavedGame: () => void; // 清除存档

  // 阶段转换
  setPhase: (phase: GamePhase) => void;
  nextDiscussionRound: () => void;
  goToTeamBuilding: () => void;

  // 玩家操作
  addDiscussion: (playerId: number, content: string) => void;
  addSystemEvent: (content: string) => void;
  proposeTeam: (teamIds: number[]) => void;

  // 同时亮票相关
  pendingVotes: Record<number, boolean>;
  addPendingVote: (playerId: number, approve: boolean) => void;
  revealAllVotes: () => void;

  // 任务行动
  pendingQuestActions: Record<number, boolean>;
  addPendingQuestAction: (playerId: number, success: boolean) => void;
  revealAllQuestActions: () => void;

  questAction: (playerId: number, success: boolean) => void;
  assassinate: (targetId: number) => void;

  // AI操作
  setAIResponse: (playerId: number, content: string) => void;
  pendingAIPlayers: number[];
  setPendingAI: (playerIds: number[]) => void;
}

const defaultVariantRules: VariantRules = {
  assassinAnytime: false,
  discussionMode: 'every_time',
  fifthVoteRule: 'force_team',
};

const defaultConfig: GameConfig = {
  playerCount: 10,
  enabledModels: AI_MODELS.map(m => m.id),
  roles: [],
  questSizes: [],
  variantRules: defaultVariantRules,
};

// ============ Hydration 状态管理 ============
let hasHydrated = false;
const hydrationListeners = new Set<() => void>();

export const getHasHydrated = () => hasHydrated;
export const onHydrationComplete = (callback: () => void) => {
  if (hasHydrated) {
    callback();
  } else {
    hydrationListeners.add(callback);
  }
  return () => hydrationListeners.delete(callback);
};

const setHydrated = () => {
  hasHydrated = true;
  hydrationListeners.forEach(cb => cb());
  hydrationListeners.clear();
};

// ============ Store 定义 ============
export const useGameStore = create<GameStore>()(
  persist(
    (set, get) => ({
      config: defaultConfig,
      gameState: null,
      phaseProgress: createPhaseProgress(null),
      pendingAIPlayers: [],
      pendingVotes: {},
      pendingQuestActions: {},

      getPhaseKey: () => getPhaseKey(get().gameState),

      ensurePhaseProgress: () => {
        const state = get();
        const key = getPhaseKey(state.gameState);
        if (state.phaseProgress.key === key) return state.phaseProgress;

        const phaseProgress = createPhaseProgress(state.gameState);
        set({ phaseProgress });
        return phaseProgress;
      },

      setDiscussionProgress: (step, speeches) => {
        const phaseProgress = get().ensurePhaseProgress();
        set({
          phaseProgress: {
            ...phaseProgress,
            discussion: { step, speeches },
          },
        });
      },

      appendDiscussionSpeech: (step, playerId, content) => {
        const phaseProgress = get().ensurePhaseProgress();
        if (
          step < phaseProgress.discussion.step
          || phaseProgress.discussion.speeches.some(speech => speech.step === step)
        ) {
          return;
        }

        set({
          phaseProgress: {
            ...phaseProgress,
            discussion: {
              step: step + 1,
              speeches: [
                ...phaseProgress.discussion.speeches,
                { step, playerId, content },
              ],
            },
          },
        });
      },

      setTeamBuildingProgress: (updates) => {
        const phaseProgress = get().ensurePhaseProgress();
        set({
          phaseProgress: {
            ...phaseProgress,
            teamBuilding: { ...phaseProgress.teamBuilding, ...updates },
          },
        });
      },

      setAssassinationProgress: (updates) => {
        const phaseProgress = get().ensurePhaseProgress();
        set({
          phaseProgress: {
            ...phaseProgress,
            assassination: { ...phaseProgress.assassination, ...updates },
          },
        });
      },

      updateConfig: (updates) => set(state => ({
        config: { ...state.config, ...updates }
      })),

      startGame: () => {
        const { config } = get();
        const gameState = createGame(config);
        set({
          gameState,
          phaseProgress: createPhaseProgress(gameState),
          pendingVotes: {},
          pendingQuestActions: {},
        });
      },

      // 重置游戏状态，但保留部分配置（通常用于"再来一局"）
      resetGame: () => set({
        gameState: null,
        phaseProgress: createPhaseProgress(null),
        // config: defaultConfig, // 这里可以选择是否重置配置，通常玩家希望保留配置
        pendingAIPlayers: [],
        pendingVotes: {},
        pendingQuestActions: {},
      }),

      // 彻底清除存档并重置所有状态
      clearSavedGame: () => {
        // 1. 清除 LocalStorage
        if (typeof window !== 'undefined') {
          localStorage.removeItem('avalon-game-storage');
        }
        // 2. 重置内存状态为默认值
        set({
          config: defaultConfig,
          gameState: null,
          phaseProgress: createPhaseProgress(null),
          pendingAIPlayers: [],
          pendingVotes: {},
          pendingQuestActions: {},
        });
      },

      setPhase: (phase) => set(state => ({
        gameState: state.gameState ? transitionTo(state.gameState, phase) : null
      })),

      nextDiscussionRound: () => set(state => {
        if (!state.gameState) return state;
        const currentRound = state.gameState.discussionRound || 1;
        if (currentRound >= 2) {
          // 发言结束，标记本任务已发言，进入组队
          return {
            gameState: {
              ...state.gameState,
              phase: 'team_building',
              hasDiscussedThisQuest: true,
            }
          };
        }
        return {
          gameState: { ...state.gameState, discussionRound: currentRound + 1 }
        };
      }),

      goToTeamBuilding: () => set(state => ({
        gameState: state.gameState
          ? {
              ...state.gameState,
              phase: 'team_building',
              hasDiscussedThisQuest: true,
            }
          : null
      })),

      addDiscussion: (playerId, content) => set(state => {
        if (!state.gameState) return state;
        // const player = state.gameState.players.find(p => p.id === playerId);
        return {
          gameState: addEvent(state.gameState, {
            type: 'discussion',
            playerId,
            playerName: `玩家${playerId}`,
            content,
            metadata: { round: state.gameState.discussionRound },
          })
        };
      }),

      addSystemEvent: (content) => set(state => ({
        gameState: state.gameState
          ? addEvent(state.gameState, { type: 'system', content })
          : null,
      })),

      proposeTeam: (teamIds) => set(state => ({
        gameState: state.gameState ? proposeTeam(state.gameState, teamIds) : null,
        pendingVotes: {},
      })),

      addPendingVote: (playerId, approve) => set(state => ({
        pendingVotes: { ...state.pendingVotes, [playerId]: approve }
      })),

      revealAllVotes: () => set(state => {
        if (!state.gameState) return state;

        let newState = state.gameState;
        const votes = state.pendingVotes;

        for (const [playerIdStr, approve] of Object.entries(votes)) {
          const playerId = parseInt(playerIdStr);
          newState = submitVote(newState, playerId, approve);
        }

        return {
          gameState: newState,
          pendingVotes: {},
        };
      }),

      addPendingQuestAction: (playerId, success) => set(state => ({
        pendingQuestActions: { ...state.pendingQuestActions, [playerId]: success }
      })),

      revealAllQuestActions: () => set(state => {
        if (!state.gameState) return state;

        let newState = state.gameState;
        const actions = state.pendingQuestActions;

        for (const [playerIdStr, success] of Object.entries(actions)) {
          const playerId = parseInt(playerIdStr);
          newState = submitQuestAction(newState, playerId, success);
        }

        return {
          gameState: newState,
          pendingQuestActions: {},
        };
      }),

      questAction: (playerId, success) => set(state => ({
        gameState: state.gameState ? submitQuestAction(state.gameState, playerId, success) : null
      })),

      assassinate: (targetId) => set(state => ({
        gameState: state.gameState ? attemptAssassination(state.gameState, targetId) : null
      })),

      setAIResponse: (playerId, content) => {
        const { addDiscussion, pendingAIPlayers } = get();
        addDiscussion(playerId, content);
        set({ pendingAIPlayers: pendingAIPlayers.filter(id => id !== playerId) });
      },

      setPendingAI: (playerIds) => set({ pendingAIPlayers: playerIds }),
    }),
    {
      name: 'avalon-game-storage', // 存储 Key
      storage: createJSONStorage(() => {
        if (typeof window === 'undefined') {
          // SSR 环境返回空实现
          return {
            getItem: () => null,
            setItem: () => {},
            removeItem: () => {},
          };
        }
        return localStorage;
      }),
      // Persist durable game data without serializing store actions.
      version: 2,
      partialize: (state) => ({
        config: state.config,
        gameState: state.gameState,
        phaseProgress: state.phaseProgress,
        pendingVotes: state.pendingVotes,
      }),
      migrate: (persistedState, version) => {
        const state = persistedState as Partial<GameStore>;
        if (version < 2) {
          return {
            ...state,
            phaseProgress: createPhaseProgress(state.gameState ?? null),
            pendingVotes: {},
          };
        }
        return state;
      },
      onRehydrateStorage: () => {
        return () => {
          setHydrated();
        };
      },
    }
  )
);

// ============ React Hook：等待 Hydration ============
export function useHydration() {
  return useSyncExternalStore(
    onHydrationComplete,
    getHasHydrated,
    () => false
  );
}

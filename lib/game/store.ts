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

interface GameStore {
  // 游戏配置（大厅阶段）
  config: GameConfig;
  updateConfig: (updates: Partial<GameConfig>) => void;

  // 游戏状态
  gameState: GameState | null;

  // 游戏操作
  startGame: () => void;
  resetGame: () => void;
  clearSavedGame: () => void; // [新增] 清除存档

  // 阶段转换
  setPhase: (phase: GamePhase) => void;
  nextDiscussionRound: () => void;
  goToTeamBuilding: () => void;

  // 玩家操作
  addDiscussion: (playerId: number, content: string) => void;
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
      pendingAIPlayers: [],
      pendingVotes: {},
      pendingQuestActions: {},

      updateConfig: (updates) => set(state => ({
        config: { ...state.config, ...updates }
      })),

      startGame: () => {
        const { config } = get();
        const gameState = createGame(config);
        set({ gameState, pendingVotes: {}, pendingQuestActions: {} });
      },

      // 重置游戏状态，但保留部分配置（通常用于"再来一局"）
      resetGame: () => set({
        gameState: null,
        // config: defaultConfig, // 这里可以选择是否重置配置，通常玩家希望保留配置
        pendingAIPlayers: [],
        pendingVotes: {},
        pendingQuestActions: {},
      }),

      // [新增] 彻底清除存档并重置所有状态
      clearSavedGame: () => {
        // 1. 清除 LocalStorage
        if (typeof window !== 'undefined') {
          localStorage.removeItem('avalon-game-storage');
        }
        // 2. 重置内存状态为默认值
        set({
          config: defaultConfig,
          gameState: null,
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
      // 只持久化 config 和 gameState，忽略 pending 状态和函数
      partialize: (state) => ({
        config: state.config,
        gameState: state.gameState,
      }),
      onRehydrateStorage: () => {
        console.log('[Zustand] Hydration 开始...');
        return (state, error) => {
          if (error) {
            console.error('[Zustand] Hydration 错误:', error);
          } else {
            console.log('[Zustand] Hydration 完成');
          }
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

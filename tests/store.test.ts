import { beforeEach, describe, expect, it } from 'vitest';
import {
  getPhaseKey,
  PhaseProgress,
  useGameStore,
} from '@/lib/game/store';
import { AI_MODELS, GameConfig, GameState } from '@/lib/game/types';

describe('game store phase progress persistence', () => {
  beforeEach(() => {
    useGameStore.getState().clearSavedGame();
  });

  it('starts with fresh progress and no pending votes', () => {
    useGameStore.getState().startGame();

    const progress = useGameStore.getState().ensurePhaseProgress();
    const state = useGameStore.getState();

    expect(progress.key).toBe(getPhaseKey(state.gameState));
    expect(progress.discussion.step).toBe(0);
    expect(state.pendingVotes).toEqual({});
  });

  it('uses five players as the default lobby configuration', () => {
    expect(useGameStore.getState().config.playerCount).toBe(5);
  });

  it('appends speeches and advances the discussion step', () => {
    useGameStore.getState().startGame();
    useGameStore.getState().appendDiscussionSpeech(0, 2, 'hi');

    expect(useGameStore.getState().phaseProgress.discussion).toEqual({
      step: 1,
      speeches: [{ step: 0, playerId: 2, content: 'hi' }],
    });

    useGameStore.getState().appendDiscussionSpeech(1, 3, 'hello');

    expect(useGameStore.getState().phaseProgress.discussion.step).toBe(2);
    expect(useGameStore.getState().phaseProgress.discussion.speeches).toHaveLength(2);
  });

  it('resets discussion progress when the phase key changes', () => {
    useGameStore.getState().startGame();
    useGameStore.getState().appendDiscussionSpeech(0, 2, 'hi');
    useGameStore.getState().setPhase('team_building');

    const progress = useGameStore.getState().ensurePhaseProgress();

    expect(progress.key).toBe(getPhaseKey(useGameStore.getState().gameState));
    expect(progress.discussion).toEqual({ step: 0, speeches: [] });
  });

  it('partializes phase progress and votes without functions', () => {
    const partialize = useGameStore.persist.getOptions().partialize;
    expect(partialize).toBeDefined();
    const persisted = partialize!(useGameStore.getState()) as Record<string, unknown>;

    expect(persisted).toHaveProperty('phaseProgress');
    expect(persisted).toHaveProperty('pendingVotes');
    expect(persisted).not.toHaveProperty('seatStatus');
    expect(Object.values(persisted)).not.toContainEqual(expect.any(Function));
  });

  it('counts provider failures except rate limits', () => {
    const { setSeatStatus } = useGameStore.getState();

    setSeatStatus(2, {
      state: 'error',
      message: 'AI 暂时不可用',
      title: 'provider failure',
      provider: 'openai',
      kind: 'provider',
    });
    setSeatStatus(3, {
      state: 'error',
      message: '请求过于频繁，请 12 秒后重试',
      title: 'rate limited',
      provider: 'openai',
      kind: 'rate_limited',
    });

    expect(useGameStore.getState().providerFailureCounts).toEqual({ openai: 1 });
  });

  it('resets transient seat statuses', () => {
    const store = useGameStore.getState();
    store.setSeatStatus(2, {
      state: 'error',
      message: 'AI 暂时不可用',
      title: 'provider failure',
      provider: 'google',
      kind: 'provider',
    });
    useGameStore.getState().resetSeatStatuses();

    expect(useGameStore.getState().seatStatus).toEqual({});
  });

  it('migrates version 1 state with fresh progress and votes', async () => {
    useGameStore.getState().startGame();
    const { config, gameState } = useGameStore.getState();
    const migrate = useGameStore.persist.getOptions().migrate;

    expect(migrate).toBeDefined();
    const migrated = await migrate!({ config, gameState }, 1) as {
      config: GameConfig;
      gameState: GameState | null;
      phaseProgress: PhaseProgress;
      pendingVotes: Record<number, boolean>;
    };

    expect(migrated.config).toMatchObject(config);
    expect(migrated.gameState).toMatchObject(gameState!);
    expect(migrated.phaseProgress).toEqual({
      key: getPhaseKey(gameState),
      discussion: { step: 0, speeches: [] },
      teamBuilding: { humanOverride: false, selectedPlayers: [] },
      assassination: { humanOverride: false },
    });
    expect(migrated.pendingVotes).toEqual({});
  });

  it('preserves saved player-count choices while filling missing migration defaults', async () => {
    const migrate = useGameStore.persist.getOptions().migrate;
    expect(migrate).toBeDefined();

    const savedConfig = { ...useGameStore.getState().config, playerCount: 8 };
    const migrated = await migrate!({ config: savedConfig }, 2) as { config: GameConfig };
    const missingPlayerCount = await migrate!({ config: {} }, 2) as {
      config: Partial<GameConfig>;
    };

    expect(migrated.config.playerCount).toBe(8);
    expect(missingPlayerCount.config.playerCount).toBe(5);
  });

  it('migrates a version 3 config from enabledModels to one AI seat per non-human player', async () => {
    const migrate = useGameStore.persist.getOptions().migrate;
    expect(migrate).toBeDefined();
    const savedConfig = {
      playerCount: 7,
      enabledModels: [AI_MODELS[1].id, AI_MODELS[3].id],
      roles: [],
      questSizes: [],
      variantRules: useGameStore.getState().config.variantRules,
    };

    const migrated = await migrate!({ config: savedConfig }, 3) as { config: GameConfig };

    expect(migrated.config.seats).toHaveLength(savedConfig.playerCount - 1);
    expect(migrated.config.seats.map(seat => seat.modelId)).toEqual([
      AI_MODELS[1].id,
      AI_MODELS[3].id,
      AI_MODELS[1].id,
      AI_MODELS[3].id,
      AI_MODELS[1].id,
      AI_MODELS[3].id,
    ]);
    expect(migrated.config).toMatchObject({
      promptMode: 'full',
      quickMode: false,
      generation: {},
    });
  });

  it('sets every AI seat to the same model', () => {
    useGameStore.getState().setAllSeats(AI_MODELS[1].id);

    const config = useGameStore.getState().config;
    expect(config.seats.every(seat => seat.modelId === AI_MODELS[1].id)).toBe(true);
    expect(config.enabledModels).toEqual([AI_MODELS[1].id]);
  });
});

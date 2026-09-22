import { beforeEach, describe, expect, it } from 'vitest';
import {
  getPhaseKey,
  PhaseProgress,
  useGameStore,
} from '@/lib/game/store';
import { GameConfig, GameState } from '@/lib/game/types';

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
    expect(Object.values(persisted)).not.toContainEqual(expect.any(Function));
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

    expect(migrated.config).toBe(config);
    expect(migrated.gameState).toBe(gameState);
    expect(migrated.phaseProgress).toEqual({
      key: getPhaseKey(gameState),
      discussion: { step: 0, speeches: [] },
      teamBuilding: { humanOverride: false, selectedPlayers: [] },
      assassination: { humanOverride: false },
    });
    expect(migrated.pendingVotes).toEqual({});
  });
});

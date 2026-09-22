import { afterEach, describe, expect, it } from 'vitest';
import { isMockAIEnabled, mockAIResponse } from '@/lib/ai/mockProvider';
import { ROLES } from '@/lib/game/types';
import { makeState } from './helpers';

const originalEnv = { ...process.env };
const model = { provider: 'openai', model: 'test-model' };

afterEach(() => {
  process.env = { ...originalEnv };
});

describe('mock AI enablement', () => {
  it('is enabled only when MOCK_AI is set outside Vercel', () => {
    process.env.MOCK_AI = '1';
    delete process.env.VERCEL;
    expect(isMockAIEnabled()).toBe(true);

    process.env.VERCEL = '1';
    expect(isMockAIEnabled()).toBe(false);

    delete process.env.MOCK_AI;
    delete process.env.VERCEL;
    expect(isMockAIEnabled()).toBe(false);
  });
});

describe('mock AI responses', () => {
  it('is deterministic and responds to event-count changes', () => {
    const comparisons = Array.from({ length: 5 }, (_, index) => {
      const state = makeState({ gameId: `game-${index}` });
      const input = {
        model,
        prompt: 'prompt',
        action: 'discussion',
        context: { gameState: state, playerId: 1 },
      };
      expect(mockAIResponse(input)).toBe(mockAIResponse(input));

      const changedState = {
        ...state,
        events: [...state.events, {
          id: `event-${index}`,
          timestamp: index,
          type: 'system' as const,
          content: 'event',
        }],
      };
      return [mockAIResponse(input), mockAIResponse({
        ...input,
        context: { ...input.context, gameState: changedState },
      })];
    });

    expect(comparisons.some(([before, after]) => before !== after)).toBe(true);
  });

  it('follows quest and voting role rules', () => {
    const base = makeState({ currentProposedTeam: [1, 3] });
    expect(mockAIResponse({
      model,
      prompt: '',
      action: 'quest',
      context: { gameState: base, playerId: 1 },
    })).toBe('SUCCESS');

    const evilResults = Array.from({ length: 10 }, (_, index) => mockAIResponse({
      model,
      prompt: '',
      action: 'quest',
      context: { gameState: { ...base, gameId: `evil-${index}` }, playerId: 4 },
    }));
    expect(evilResults).toContain('FAIL');
    expect(evilResults).toContain('SUCCESS');

    expect(mockAIResponse({
      model,
      prompt: '',
      action: 'voting',
      context: { gameState: base, playerId: 3 },
    })).toBe('APPROVE');

    const merlinRejectsEvil = makeState({ currentProposedTeam: [4, 5] });
    expect(mockAIResponse({
      model,
      prompt: '',
      action: 'voting',
      context: { gameState: merlinRejectsEvil, playerId: 1 },
    })).toBe('REJECT');
  });

  it('builds a valid team with the leader first', () => {
    const state = makeState({ currentLeaderIndex: 0 });
    const requiredPlayers = state.quests[state.currentQuest - 1].requiredPlayers;
    const text = mockAIResponse({
      model,
      prompt: '',
      action: 'team_building',
      context: { gameState: state, playerId: 1 },
    });
    const ids = text.split(',').map(Number);

    expect(ids).toHaveLength(requiredPlayers);
    expect(new Set(ids).size).toBe(requiredPlayers);
    expect(ids[0]).toBe(1);
    expect(ids.every(id => state.players.some(player => player.id === id))).toBe(true);
  });

  it('selects a good assassination target', () => {
    const state = makeState();
    const targetId = Number(mockAIResponse({
      model,
      prompt: '',
      action: 'assassination',
      context: { gameState: state, playerId: 4 },
    }));
    const target = state.players.find(player => player.id === targetId);

    expect(target?.role && ROLES[target.role].team).toBe('good');
  });

  it('returns a short, visibly mocked discussion line', () => {
    const text = mockAIResponse({
      model,
      prompt: '',
      action: 'discussion',
      context: { gameState: makeState(), playerId: 1 },
    });

    expect(text.startsWith('[mock] ')).toBe(true);
    expect(text.length).toBeLessThanOrEqual(80);
  });
});

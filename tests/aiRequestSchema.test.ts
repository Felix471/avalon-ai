import { describe, expect, it } from 'vitest';

import { parseAIRequest } from '@/lib/api/aiRequestSchema';
import { AI_MODELS } from '@/lib/game/types';
import { makeState } from './helpers';

function makeRequest() {
  return {
    playerId: 2,
    action: 'discussion' as const,
    gameState: makeState(),
  };
}

function expectInvalid(body: unknown, expectedIssue?: string) {
  const result = parseAIRequest(body);
  expect(result.ok).toBe(false);
  if (!result.ok && expectedIssue) {
    expect(result.issues.some((issue) => issue.includes(expectedIssue))).toBe(true);
  }
}

describe('parseAIRequest', () => {
  it('accepts a valid request built from makeState', () => {
    expect(parseAIRequest(makeRequest()).ok).toBe(true);
  });

  it('rejects a missing playerId', () => {
    expectInvalid({ action: 'discussion', gameState: makeState() }, 'playerId');
  });

  it('rejects an unknown action', () => {
    expectInvalid({ ...makeRequest(), action: 'unknown' }, 'action');
  });

  it('rejects a playerId that is not in players', () => {
    expectInvalid({ ...makeRequest(), playerId: 99 }, 'player_not_found');
  });

  it('rejects a human player as the AI target', () => {
    expectInvalid({ ...makeRequest(), playerId: 1 }, 'player_must_be_ai');
  });

  it('rejects a model string outside the allowlist', () => {
    const request = makeRequest();
    request.gameState.players[1].aiModel = {
      ...request.gameState.players[1].aiModel!,
      model: 'gpt-4o',
    };

    expectInvalid(request, 'model_not_allowed');
  });

  it('rejects an allowlisted model paired with the wrong provider', () => {
    const request = makeRequest();
    const allowedModel = AI_MODELS[0];
    const wrongProvider = allowedModel.provider === 'openai' ? 'anthropic' : 'openai';
    request.gameState.players[1].aiModel = { ...allowedModel, provider: wrongProvider };

    expectInvalid(request, 'model_not_allowed');
  });

  it('rejects a player count below five', () => {
    expectInvalid(
      { ...makeRequest(), gameState: { ...makeState(), playerCount: 4 } },
      'playerCount',
    );
  });

  it('rejects more than 2000 events', () => {
    const event = {
      id: 'event',
      timestamp: 0,
      type: 'system' as const,
      content: 'event',
    };
    const request = makeRequest();
    request.gameState.events = Array.from({ length: 2001 }, (_, index) => ({
      ...event,
      id: `event-${index}`,
    }));

    expectInvalid(request, 'events');
  });

  it('rejects recent speech content longer than 2000 characters', () => {
    expectInvalid(
      {
        ...makeRequest(),
        recentSpeeches: [{ playerId: 1, content: 'x'.repeat(2001) }],
      },
      'recentSpeeches',
    );
  });

  it('rejects an unknown prompt mode', () => {
    expectInvalid({ ...makeRequest(), promptMode: 'weird' }, 'promptMode');
  });

  it.each([1.6, -0.1])('rejects generation temperature %s', (temperature) => {
    expectInvalid({
      ...makeRequest(),
      generation: { temperature, maxTokens: 300 },
    }, 'generation.temperature');
  });

  it.each([99, 1501])('rejects generation maxTokens %s', (maxTokens) => {
    expectInvalid({
      ...makeRequest(),
      generation: { maxTokens },
    }, 'generation.maxTokens');
  });

  it('accepts generation without maxTokens (per-action default)', () => {
    expect(parseAIRequest({ ...makeRequest(), generation: { temperature: 0.5 } }).ok).toBe(true);
  });

  it.each([100, 1500])('accepts generation maxTokens boundary %s', (maxTokens) => {
    expect(parseAIRequest({
      ...makeRequest(),
      generation: { maxTokens },
    }).ok).toBe(true);
  });

  it('accepts an omitted generation object', () => {
    expect(parseAIRequest(makeRequest()).ok).toBe(true);
  });

  it('tolerates extra gameState fields because the client state object is loose', () => {
    const request = makeRequest();
    const body = {
      ...request,
      gameState: { ...request.gameState, clientOnlyState: true },
    };

    const result = parseAIRequest(body);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.gameState.clientOnlyState).toBe(true);
    }
  });
});

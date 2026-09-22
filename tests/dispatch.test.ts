import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { callAIProvider } from '@/lib/ai/dispatch';
import {
  anthropicPlainText,
  anthropicThinkingOnlyMaxTokens,
  anthropicThinkingThenText,
  googleThoughtPartThenText,
  googleWithThoughtSignature,
} from './fixtures/votingResponses';

const originalEnv = { ...process.env };

function response(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function openAIResponse(content = 'OK'): Response {
  return response({ choices: [{ message: { content } }] });
}

function model(provider = 'openai', name = 'gpt-5.4-mini') {
  return { provider, model: name };
}

beforeEach(() => {
  vi.useFakeTimers();
  delete process.env.MOCK_AI;
  delete process.env.VERCEL;
  process.env.OPENAI_API_KEY = 'test';
  process.env.ANTHROPIC_API_KEY = 'test';
  process.env.GOOGLE_API_KEY = 'test';
  process.env.DEEPSEEK_API_KEY = 'test';
  process.env.XAI_API_KEY = 'test';
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  process.env = { ...originalEnv };
});

describe('callAIProvider', () => {
  it('uses the mock provider without calling fetch', async () => {
    process.env.MOCK_AI = '1';
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    await expect(callAIProvider(model(), 'prompt', 'voting')).resolves.toEqual({
      ok: true,
      text: 'APPROVE',
      latencyMs: 5,
      attempts: 1,
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('does not use the mock provider when VERCEL is set', async () => {
    process.env.MOCK_AI = '1';
    process.env.VERCEL = '1';
    const fetchMock = vi.fn().mockResolvedValue(openAIResponse());
    vi.stubGlobal('fetch', fetchMock);

    await expect(callAIProvider(model(), 'prompt', 'voting')).resolves.toMatchObject({
      ok: true,
      text: 'OK',
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('returns a successful OpenAI response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(openAIResponse()));

    await expect(callAIProvider(model(), 'prompt', 'discussion')).resolves.toMatchObject({
      ok: true,
      text: 'OK',
      attempts: 1,
    });
  });

  it('retries a 429 response and succeeds on the second attempt', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(response({}, 429))
      .mockResolvedValueOnce(openAIResponse());
    vi.stubGlobal('fetch', fetchMock);

    const resultPromise = callAIProvider(model(), 'prompt', 'voting');
    await vi.advanceTimersByTimeAsync(2_000);
    const result = await resultPromise;

    expect(result).toMatchObject({ ok: true, text: 'OK', attempts: 2 });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('retries four 500 responses and returns the final HTTP error', async () => {
    // A Response body can only be read once, so build a fresh one per attempt.
    const fetchMock = vi.fn().mockImplementation(async () => response({}, 500));
    vi.stubGlobal('fetch', fetchMock);

    const resultPromise = callAIProvider(model(), 'prompt', 'voting');
    await vi.advanceTimersByTimeAsync(14_000);

    await expect(resultPromise).resolves.toMatchObject({
      ok: false,
      error: 'http_500',
      status: 500,
      attempts: 4,
    });
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it.each([400, 401])('does not retry HTTP %i', async (status: number) => {
    const fetchMock = vi.fn().mockResolvedValue(response({}, status));
    vi.stubGlobal('fetch', fetchMock);

    await expect(callAIProvider(model(), 'prompt', 'voting')).resolves.toMatchObject({
      ok: false,
      error: `http_${status}`,
      status,
      attempts: 1,
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('returns missing_api_key without calling fetch', async () => {
    delete process.env.OPENAI_API_KEY;
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    await expect(callAIProvider(model(), 'prompt', 'voting')).resolves.toMatchObject({
      ok: false,
      error: 'missing_api_key',
      attempts: 1,
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('returns unknown_provider without calling fetch', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    await expect(callAIProvider(model('unknown'), 'prompt', 'voting')).resolves.toMatchObject({
      ok: false,
      error: 'unknown_provider',
      attempts: 1,
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('returns empty_response without retrying', async () => {
    const fetchMock = vi.fn().mockResolvedValue(openAIResponse(''));
    vi.stubGlobal('fetch', fetchMock);

    await expect(callAIProvider(model(), 'prompt', 'voting')).resolves.toMatchObject({
      ok: false,
      error: 'empty_response',
      attempts: 1,
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('times out and retries all four attempts', async () => {
    const fetchMock = vi.fn((_input: RequestInfo | URL, init?: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => {
          const error = new Error('aborted');
          error.name = 'AbortError';
          reject(error);
        }, { once: true });
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const resultPromise = callAIProvider(model(), 'prompt', 'voting');
    for (const retryDelay of [2_000, 4_000, 8_000]) {
      await vi.advanceTimersByTimeAsync(30_000);
      await vi.advanceTimersByTimeAsync(retryDelay);
    }
    await vi.advanceTimersByTimeAsync(30_000);

    await expect(resultPromise).resolves.toMatchObject({
      ok: false,
      error: 'timeout',
      attempts: 4,
    });
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it('retries network errors and reports network_error after four attempts', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new TypeError('network unavailable'));
    vi.stubGlobal('fetch', fetchMock);

    const resultPromise = callAIProvider(model(), 'prompt', 'voting');
    await vi.advanceTimersByTimeAsync(14_000);

    await expect(resultPromise).resolves.toMatchObject({
      ok: false,
      error: 'network_error',
      attempts: 4,
    });
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it('parses the Anthropic response shape', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response({ content: [{ type: 'text', text: 'hi' }], stop_reason: 'end_turn' })));

    await expect(callAIProvider(model('anthropic', 'claude-test'), 'prompt', 'discussion'))
      .resolves.toMatchObject({ ok: true, text: 'hi', attempts: 1 });
  });

  describe('captured voting responses (2026-09-22)', () => {
    it('reads a plain Anthropic text block', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response(anthropicPlainText)));
      await expect(callAIProvider(model('anthropic', 'claude-sonnet-5'), 'prompt', 'voting'))
        .resolves.toMatchObject({ ok: true, text: 'APPROVE' });
    });

    it('concatenates text blocks when a thinking block comes first', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response(anthropicThinkingThenText)));
      await expect(callAIProvider(model('anthropic', 'claude-sonnet-5'), 'prompt', 'voting'))
        .resolves.toMatchObject({ ok: true, text: 'REJECT' });
    });

    it('reports the stop_reason and does not retry when Anthropic returns no text', async () => {
      const fetchMock = vi.fn().mockResolvedValue(response(anthropicThinkingOnlyMaxTokens));
      vi.stubGlobal('fetch', fetchMock);
      await expect(callAIProvider(model('anthropic', 'claude-sonnet-5'), 'prompt', 'voting'))
        .resolves.toMatchObject({ ok: false, error: 'empty_response:max_tokens', attempts: 1 });
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('sends thinking disabled to Anthropic', async () => {
      const fetchMock = vi.fn().mockResolvedValue(response(anthropicPlainText));
      vi.stubGlobal('fetch', fetchMock);
      await callAIProvider(model('anthropic', 'claude-sonnet-5'), 'prompt', 'voting');
      const body = JSON.parse(String(fetchMock.mock.calls[0][1]?.body));
      expect(body.thinking).toEqual({ type: 'disabled' });
    });

    it('reads a Google text part that carries a thoughtSignature', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response(googleWithThoughtSignature)));
      await expect(callAIProvider(model('google', 'gemini-3.8-flash'), 'prompt', 'voting'))
        .resolves.toMatchObject({ ok: true, text: 'APPROVE' });
    });

    it('ignores Google thought parts and leaves verdict text unscrubbed', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response(googleThoughtPartThenText)));
      await expect(callAIProvider(model('google', 'gemini-3.8-flash'), 'prompt', 'voting'))
        .resolves.toMatchObject({ ok: true, text: 'REJECT' });
    });

    it('still scrubs analysis lines from Google discussion text only', async () => {
      const body = { candidates: [{ content: { parts: [{ text: '分析：先看队长。\n我暂时信任3号。' }] }, finishReason: 'STOP' }] };
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response(body)));
      await expect(callAIProvider(model('google', 'gemini-3.8-flash'), 'prompt', 'discussion'))
        .resolves.toMatchObject({ ok: true, text: '我暂时信任3号。' });
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response(body)));
      await expect(callAIProvider(model('google', 'gemini-3.8-flash'), 'prompt', 'voting'))
        .resolves.toMatchObject({ ok: true, text: '分析：先看队长。\n我暂时信任3号。' });
    });

    it('reports the Google finishReason when no text part is returned', async () => {
      const fetchMock = vi.fn().mockResolvedValue(response({ candidates: [{ content: { parts: [{ text: 'x', thought: true }] }, finishReason: 'MAX_TOKENS' }] }));
      vi.stubGlobal('fetch', fetchMock);
      await expect(callAIProvider(model('google', 'gemini-3.8-flash'), 'prompt', 'voting'))
        .resolves.toMatchObject({ ok: false, error: 'empty_response:MAX_TOKENS', attempts: 1 });
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });
  });

  describe('per-action output caps and Google thinking config', () => {
    function googleBody(fetchMock: ReturnType<typeof vi.fn>) {
      return JSON.parse(String(fetchMock.mock.calls[0][1]?.body));
    }

    it.each(['voting', 'quest', 'assassination'])('Google %s: thinkingBudget 0 and 300 tokens', async (action: string) => {
      const fetchMock = vi.fn().mockResolvedValue(response({ candidates: [{ content: { parts: [{ text: 'APPROVE' }] } }] }));
      vi.stubGlobal('fetch', fetchMock);
      await callAIProvider(model('google', 'gemini-3.8-flash'), 'prompt', action);
      const body = googleBody(fetchMock);
      expect(body.generationConfig.thinkingConfig).toEqual({ thinkingBudget: 0 });
      expect(body.generationConfig.maxOutputTokens).toBe(300);
    });

    it.each(['discussion', 'team_building'])('Google %s: thinkingLevel low', async (action: string) => {
      const fetchMock = vi.fn().mockResolvedValue(response({ candidates: [{ content: { parts: [{ text: 'ok' }] } }] }));
      vi.stubGlobal('fetch', fetchMock);
      await callAIProvider(model('google', 'gemini-3.8-flash'), 'prompt', action);
      const body = googleBody(fetchMock);
      expect(body.generationConfig.thinkingConfig).toEqual({ thinkingLevel: 'low' });
      expect(body.generationConfig.maxOutputTokens).toBe(action === 'discussion' ? 600 : 300);
    });

    it('defaults to 600 tokens for discussion and 300 for verdicts on every provider', async () => {
      const cases: Array<[string, string, (body: Record<string, unknown>) => number]> = [
        ['anthropic', 'claude-sonnet-5', body => body.max_tokens as number],
        ['openai', 'gpt-5.4-mini', body => body.max_completion_tokens as number],
        ['deepseek', 'deepseek-flash', body => body.max_tokens as number],
        ['xai', 'grok-4.3', body => body.max_tokens as number],
      ];
      for (const [provider, name, read] of cases) {
        for (const [action, expected] of [['discussion', 600], ['voting', 300], ['quest', 300]] as const) {
          const fetchMock = vi.fn().mockResolvedValue(provider === 'anthropic'
            ? response({ content: [{ type: 'text', text: 'ok' }], stop_reason: 'end_turn' })
            : openAIResponse('ok'));
          vi.stubGlobal('fetch', fetchMock);
          await callAIProvider(model(provider, name), 'prompt', action);
          expect(read(JSON.parse(String(fetchMock.mock.calls[0][1]?.body)))).toBe(expected);
        }
      }
    });

    it('an explicit maxTokens overrides the per-action default for every action', async () => {
      for (const action of ['discussion', 'voting']) {
        const fetchMock = vi.fn().mockResolvedValue(openAIResponse('ok'));
        vi.stubGlobal('fetch', fetchMock);
        await callAIProvider(model(), 'prompt', action, { generation: { maxTokens: 450 } });
        expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body)).max_completion_tokens).toBe(450);
      }
    });
  });

  it('parses the Google response shape', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response({
      candidates: [{ content: { parts: [{ text: 'hi' }] } }],
    })));

    await expect(callAIProvider(model('google', 'gemini-test'), 'prompt', 'discussion'))
      .resolves.toMatchObject({ ok: true, text: 'hi', attempts: 1 });
  });

  it('does not retry a Google safety block', async () => {
    const fetchMock = vi.fn().mockResolvedValue(response({
      candidates: [{ finishReason: 'SAFETY' }],
    }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(callAIProvider(model('google', 'gemini-test'), 'prompt', 'discussion'))
      .resolves.toMatchObject({ ok: false, error: 'safety_block', attempts: 1 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('sends provider-specific request options', async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL, _init?: RequestInit) => {
      void _init;
      const url = String(input);
      return Promise.resolve(url.includes('googleapis.com')
        ? response({ candidates: [{ content: { parts: [{ text: 'OK' }] } }] })
        : openAIResponse());
    });
    vi.stubGlobal('fetch', fetchMock);

    await callAIProvider(model('xai', 'grok-4.3'), 'prompt', 'discussion');
    await callAIProvider(model('deepseek', 'deepseek-flash'), 'prompt', 'discussion');
    await callAIProvider(model('google', 'gemini-test'), 'prompt', 'discussion');
    await callAIProvider(model('openai', 'gpt-5.4-mini'), 'prompt', 'discussion');

    const bodies = fetchMock.mock.calls.map((call: [RequestInfo | URL, RequestInit?]) => {
      const init = call[1] as RequestInit;
      return JSON.parse(String(init.body)) as Record<string, unknown>;
    });
    expect(bodies[0]).toMatchObject({ reasoning_effort: 'none' });
    expect(bodies[1]).toMatchObject({ thinking: { type: 'disabled' } });
    expect(bodies[2]).toMatchObject({
      generationConfig: { thinkingConfig: { thinkingLevel: 'low' } },
    });
    expect(bodies[3]).toMatchObject({ max_completion_tokens: 600 });
    expect(bodies[3]).not.toHaveProperty('max_tokens');
  });

  it('threads explicit generation settings into OpenAI and Google bodies', async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      void init;
      return Promise.resolve(
        String(input).includes('googleapis.com')
          ? response({ candidates: [{ content: { parts: [{ text: 'OK' }] } }] })
          : openAIResponse(),
      );
    });
    vi.stubGlobal('fetch', fetchMock);
    const context = { generation: { temperature: 0.3, maxTokens: 500 } };

    await callAIProvider(model('openai', 'gpt-5.4-mini'), 'prompt', 'discussion', context);
    await callAIProvider(model('google', 'gemini-test'), 'prompt', 'discussion', context);

    const openAIBody = JSON.parse(String(fetchMock.mock.calls[0][1]?.body));
    const googleBody = JSON.parse(String(fetchMock.mock.calls[1][1]?.body));
    expect(openAIBody).toMatchObject({ max_completion_tokens: 500, temperature: 0.3 });
    expect(googleBody.generationConfig).toMatchObject({
      maxOutputTokens: 500,
      temperature: 0.3,
    });
  });

  it('omits temperature when OpenAI uses the provider default', async () => {
    const fetchMock = vi.fn().mockResolvedValue(openAIResponse());
    vi.stubGlobal('fetch', fetchMock);

    await callAIProvider(model('openai', 'gpt-5.4-mini'), 'prompt', 'discussion', {
      generation: { maxTokens: 500 },
    });

    const body = JSON.parse(String(fetchMock.mock.calls[0][1]?.body));
    expect(body).toMatchObject({ max_completion_tokens: 500 });
    expect(body).not.toHaveProperty('temperature');
  });
});

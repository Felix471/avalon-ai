import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { callAIProvider } from '@/lib/ai/dispatch';

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
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response({ content: [{ text: 'hi' }] })));

    await expect(callAIProvider(model('anthropic', 'claude-test'), 'prompt', 'discussion'))
      .resolves.toMatchObject({ ok: true, text: 'hi', attempts: 1 });
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
    expect(bodies[3]).toMatchObject({ max_completion_tokens: 300 });
    expect(bodies[3]).not.toHaveProperty('max_tokens');
  });
});

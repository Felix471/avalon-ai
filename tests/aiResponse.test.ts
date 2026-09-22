import { describe, expect, it } from 'vitest';
import { AIRequestError, describeAIError } from '@/components/Game/aiResponse';

describe('describeAIError', () => {
  it('describes rate limits with the server retry delay', () => {
    const result = describeAIError(new AIRequestError(
      'rate limited',
      429,
      { retryAfter: 12 },
    ));

    expect(result.kind).toBe('rate_limited');
    expect(result.message).toContain('12');
  });

  it('describes unparseable 502 responses', () => {
    const result = describeAIError(new AIRequestError(
      'unparseable response',
      502,
      { error: 'unparseable' },
    ));

    expect(result.kind).toBe('unparseable');
  });

  it('describes other 502 responses as provider failures', () => {
    const result = describeAIError(new AIRequestError(
      'provider failure',
      502,
      { error: 'upstream' },
    ));

    expect(result.kind).toBe('provider');
  });

  it('describes TypeError fetch failures as network errors', () => {
    const result = describeAIError(new TypeError('Failed to fetch'));

    expect(result.kind).toBe('network');
  });
});

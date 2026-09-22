export type AIResponseBody = Record<string, unknown>;

export class AIRequestError extends Error {
  constructor(
    message: string,
    readonly status?: number,
    readonly body?: AIResponseBody,
    readonly latencyMs?: number,
  ) {
    super(message);
  }
}

export interface DescribedAIError {
  message: string;
  title: string;
  kind: 'provider' | 'unparseable' | 'rate_limited' | 'network';
  provider?: string;
  model?: string;
  retryAfterSeconds?: number;
  latencyMs?: number;
}

export function describeAIError(error: unknown): DescribedAIError {
  if (error instanceof AIRequestError) {
    const serverError = error.body?.error;
    const provider = error.body?.provider === undefined ? undefined : String(error.body.provider);
    const model = error.body?.model === undefined ? undefined : String(error.body.model);
    const details = [serverError, provider, model].filter(value => value !== undefined).map(String).join(' / ');
    const retryAfter = Number(error.body?.retryAfter);
    const retryAfterSeconds = Number.isFinite(retryAfter) && retryAfter > 0
      ? Math.ceil(retryAfter)
      : 10;

    if (error.status === 429) {
      return {
        message: `请求过于频繁，请 ${retryAfterSeconds} 秒后重试`,
        title: details || error.message,
        kind: 'rate_limited',
        provider,
        model,
        retryAfterSeconds,
        latencyMs: error.latencyMs,
      };
    }

    if (error.status === 502 && serverError === 'unparseable') {
      return {
        message: 'AI 返回了无法解析的内容',
        title: details || error.message,
        kind: 'unparseable',
        provider,
        model,
        latencyMs: error.latencyMs,
      };
    }

    return {
      message: 'AI 暂时不可用',
      title: details || error.message,
      kind: 'provider',
      provider,
      model,
      latencyMs: error.latencyMs,
    };
  }

  if (error instanceof TypeError) {
    return {
      message: '网络错误，请检查连接',
      title: error.message,
      kind: 'network',
    };
  }

  return {
    message: 'AI 暂时不可用',
    title: error instanceof Error ? error.message : String(error),
    kind: 'provider',
  };
}

export function readLatency(response: Response): number | undefined {
  const rawLatency = response.headers.get('x-avalon-latency-ms');
  if (rawLatency === null) return undefined;

  const latencyMs = Number(rawLatency);
  return Number.isFinite(latencyMs) && latencyMs >= 0 ? latencyMs : undefined;
}

const isResponseBody = (value: unknown): value is AIResponseBody => (
  typeof value === 'object' && value !== null && !Array.isArray(value)
);

export async function readAIResponse(response: Response): Promise<AIResponseBody> {
  let body: unknown;
  const latencyMs = readLatency(response);

  try {
    body = await response.json();
  } catch {
    if (!response.ok) {
      throw new AIRequestError(
        `AI request failed with HTTP ${response.status}`,
        response.status,
        undefined,
        latencyMs,
      );
    }

    throw new Error('AI response body is not valid JSON');
  }

  if (!response.ok) {
    const serverError = isResponseBody(body) && 'error' in body
      ? `: ${String(body.error)}`
      : '';
    throw new AIRequestError(
      `AI request failed with HTTP ${response.status}${serverError}`,
      response.status,
      isResponseBody(body) ? body : undefined,
      latencyMs,
    );
  }

  if (!isResponseBody(body)) {
    throw new Error('AI response body must be a JSON object');
  }

  return body;
}

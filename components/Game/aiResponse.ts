export type AIResponseBody = Record<string, unknown>;

export class AIRequestError extends Error {
  constructor(
    message: string,
    readonly status?: number,
    readonly body?: AIResponseBody,
  ) {
    super(message);
  }
}

export function describeAIError(error: unknown): { message: string; title: string } {
  if (error instanceof AIRequestError) {
    const serverError = error.body?.error;
    const provider = error.body?.provider;
    const model = error.body?.model;
    const details = [serverError, provider, model].filter(value => value !== undefined).map(String).join(' / ');

    return {
      message: error.status === 429
        ? '请求过于频繁，请稍候再试'
        : error.status === 502 && serverError === 'unparseable'
          ? 'AI 返回了无法解析的内容'
          : 'AI 暂时不可用',
      title: details || error.message,
    };
  }

  return {
    message: 'AI 暂时不可用',
    title: error instanceof Error ? error.message : String(error),
  };
}

const isResponseBody = (value: unknown): value is AIResponseBody => (
  typeof value === 'object' && value !== null && !Array.isArray(value)
);

export async function readAIResponse(response: Response): Promise<AIResponseBody> {
  let body: unknown;

  try {
    body = await response.json();
  } catch {
    if (!response.ok) {
      throw new AIRequestError(`AI request failed with HTTP ${response.status}`, response.status);
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
    );
  }

  if (!isResponseBody(body)) {
    throw new Error('AI response body must be a JSON object');
  }

  return body;
}

export type AIResponseBody = Record<string, unknown>;

const isResponseBody = (value: unknown): value is AIResponseBody => (
  typeof value === 'object' && value !== null && !Array.isArray(value)
);

export async function readAIResponse(response: Response): Promise<AIResponseBody> {
  let body: unknown;

  try {
    body = await response.json();
  } catch {
    if (!response.ok) {
      throw new Error(`AI request failed with HTTP ${response.status}`);
    }

    throw new Error('AI response body is not valid JSON');
  }

  if (!response.ok) {
    const serverError = isResponseBody(body) && 'error' in body
      ? `: ${String(body.error)}`
      : '';
    throw new Error(`AI request failed with HTTP ${response.status}${serverError}`);
  }

  if (!isResponseBody(body)) {
    throw new Error('AI response body must be a JSON object');
  }

  return body;
}

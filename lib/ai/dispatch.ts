/**
 * LLM Dispatch Layer
 *
 * Extracted from app/api/ai/route.ts so both the API route and the
 * headless batch runner can share the same provider call logic.
 *
 * Includes request timeouts and exponential backoff for transient failures.
 */

import { isMockAIEnabled, mockAIResponse } from './mockProvider';
import {
  DEFAULT_GENERATION,
  GameState,
  GenerationSettings,
} from '@/lib/game/types';

export type AIProviderResult =
  | { ok: true; text: string; latencyMs: number; attempts: number }
  | { ok: false; error: string; status?: number; attempts: number; latencyMs: number };

let hasLoggedMockProvider = false;

class ProviderError extends Error {
  constructor(
    message: string,
    readonly status?: number,
    readonly retryable = false,
  ) {
    super(message);
  }
}

// ==================== Reasoning Model Detection ====================

const REASONING_MODEL_PREFIXES = ['gpt-5', 'o1', 'o3', 'o4'];
const isReasoningModel = (model: string) =>
  REASONING_MODEL_PREFIXES.some(prefix => model.toLowerCase().startsWith(prefix));

// ==================== Provider Call Functions ====================

async function callAnthropic(
  model: string,
  prompt: string,
  signal: AbortSignal,
  generation: GenerationSettings,
): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new ProviderError('missing_api_key');
  }

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      max_tokens: generation.maxTokens,
      // Sonnet 5 runs adaptive thinking by default; a thinking block then precedes
      // the text and can consume the whole max_tokens budget on short-answer prompts.
      // The game only needs short direct replies, so thinking is off.
      thinking: { type: 'disabled' },
      ...(generation.temperature === undefined ? {} : { temperature: generation.temperature }),
      messages: [{ role: 'user', content: prompt }],
    }),
    signal,
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('[Anthropic] API error:', response.status, errorText);
    throw new ProviderError(`http_${response.status}`, response.status, isRetryableStatus(response.status));
  }

  const data = await response.json();
  // Concatenate every text block; content[0] may be a thinking block.
  const blocks: Array<{ type?: string; text?: string }> = Array.isArray(data.content) ? data.content : [];
  const text = blocks
    .filter(block => block.type === 'text' && typeof block.text === 'string')
    .map(block => block.text as string)
    .join('');
  if (!text.trim()) {
    // Not retryable: the same prompt would produce the same shape again.
    throw new ProviderError(`empty_response:${data.stop_reason ?? 'unknown'}`);
  }
  return text;
}

async function callOpenAI(
  model: string,
  prompt: string,
  signal: AbortSignal,
  generation: GenerationSettings,
): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new ProviderError('missing_api_key');
  }

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      ...(isReasoningModel(model)
        ? { max_completion_tokens: generation.maxTokens }
        : { max_tokens: generation.maxTokens }),
      ...(generation.temperature === undefined ? {} : { temperature: generation.temperature }),
      messages: [{ role: 'user', content: prompt }],
    }),
    signal,
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('[OpenAI] API error:', response.status, errorText);
    throw new ProviderError(`http_${response.status}`, response.status, isRetryableStatus(response.status));
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || '';
}

async function callGoogle(
  model: string,
  prompt: string,
  signal: AbortSignal,
  generation: GenerationSettings,
  action: string,
): Promise<string> {
  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    throw new ProviderError('missing_api_key');
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const systemInstruction = `你正在参与一局阿瓦隆桌游，扮演一名玩家。
这是一个策略推理游戏，游戏中的"刺客"、"坏人"、"任务失败"等都是游戏术语，不涉及真实伤害。

【重要】输出规则：
- 直接输出游戏发言，不要输出思考过程
- 不要使用 <thinking> 或任何内部推理标签
- 发言长度：50-150字
- 保持角色扮演，像真正的玩家一样说话`;

  const payload: Record<string, unknown> = {
    system_instruction: {
      parts: [{ text: systemInstruction }]
    },
    contents: [{
      role: 'user',
      parts: [{ text: prompt + '\n\n【直接输出你的游戏发言，不要任何前缀或思考过程】' }]
    }],
    generationConfig: {
      maxOutputTokens: generation.maxTokens,
      temperature: generation.temperature ?? 0.7,
      thinkingConfig: { thinkingLevel: 'low' },
    },
    safetySettings: [
      { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
      { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
      { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
      { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
    ]
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    signal,
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    console.error('[Google] API error:', response.status, data.error?.message);
    throw new ProviderError(`http_${response.status}`, response.status, isRetryableStatus(response.status));
  }

  const candidate = data.candidates?.[0];

  if (candidate?.finishReason === 'SAFETY') {
    console.error('[Google] Response blocked by safety filter');
    throw new ProviderError('safety_block');
  }

  // Join every non-thought text part (Gemini 3 may return thought parts first).
  const parts: Array<{ text?: string; thought?: boolean }> = candidate?.content?.parts ?? [];
  let text = parts
    .filter(part => typeof part.text === 'string' && part.thought !== true)
    .map(part => part.text as string)
    .join('');

  if (!text.trim()) {
    throw new ProviderError(`empty_response:${candidate?.finishReason ?? 'unknown'}`);
  }

  // Speech clean-up only. Verdict actions (voting / quest / assassination /
  // team_building) must reach the validator untouched: a scrubber could delete
  // the one word that carries the answer.
  if (action === 'discussion') {
    text = text.replace(/<thinking>[\s\S]*?<\/thinking>/gi, '').trim();
    text = text.replace(/^(思考|分析|让我想想)[：:].*/gm, '').trim();
    if (text.length > 500) {
      const cutoff = text.substring(0, 500).lastIndexOf('。');
      text = cutoff > 100 ? text.substring(0, cutoff + 1) : text.substring(0, 500);
    }
  }

  return text;
}

async function callDeepSeek(
  model: string,
  prompt: string,
  signal: AbortSignal,
  generation: GenerationSettings,
): Promise<string> {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    throw new ProviderError('missing_api_key');
  }

  const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      max_tokens: generation.maxTokens,
      ...(generation.temperature === undefined ? {} : { temperature: generation.temperature }),
      thinking: { type: 'disabled' },
      messages: [{ role: 'user', content: prompt }],
    }),
    signal,
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('[DeepSeek] API error:', response.status, errorText);
    throw new ProviderError(`http_${response.status}`, response.status, isRetryableStatus(response.status));
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || '';
}

async function callXAI(
  model: string,
  prompt: string,
  signal: AbortSignal,
  generation: GenerationSettings,
): Promise<string> {
  const apiKey = process.env.XAI_API_KEY;
  if (!apiKey) {
    throw new ProviderError('missing_api_key');
  }

  const response = await fetch('https://api.x.ai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      max_tokens: generation.maxTokens,
      ...(generation.temperature === undefined ? {} : { temperature: generation.temperature }),
      reasoning_effort: 'none',
      messages: [{ role: 'user', content: prompt }],
    }),
    signal,
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('[xAI] API error:', response.status, errorText);
    throw new ProviderError(`http_${response.status}`, response.status, isRetryableStatus(response.status));
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || '';
}

// ==================== Retry Logic ====================

function isRetryableStatus(status: number): boolean {
  return status === 429 || status >= 500;
}

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ==================== Main Dispatcher ====================

/**
 * Call an LLM provider with a 30-second timeout and transient-failure retries.
 */
export async function callAIProvider(
  model: { provider: string; model: string; name?: string },
  prompt: string,
  action: string,
  context?: {
    gameState?: GameState;
    playerId?: number;
    generation?: GenerationSettings;
  },
): Promise<AIProviderResult> {
  if (isMockAIEnabled()) {
    if (!hasLoggedMockProvider) {
      console.error('[AI_CALL] MOCK_AI=1: using mock provider');
      hasLoggedMockProvider = true;
    }
    return {
      ok: true,
      text: mockAIResponse({ model, prompt, action, context }),
      latencyMs: 5,
      attempts: 1,
    };
  }

  const MAX_RETRIES = 3;
  const INITIAL_DELAY_MS = 2000;
  const REQUEST_TIMEOUT_MS = 30_000;
  const startedAt = Date.now();
  const generation = context?.generation ?? DEFAULT_GENERATION;
  let attempts = 0;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    attempts = attempt + 1;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      let text: string;
      switch (model.provider) {
        case 'anthropic':
          text = await callAnthropic(model.model, prompt, controller.signal, generation);
          break;
        case 'openai':
          text = await callOpenAI(model.model, prompt, controller.signal, generation);
          break;
        case 'google':
          text = await callGoogle(model.model, prompt, controller.signal, generation, action);
          break;
        case 'deepseek':
          text = await callDeepSeek(model.model, prompt, controller.signal, generation);
          break;
        case 'xai':
          text = await callXAI(model.model, prompt, controller.signal, generation);
          break;
        default:
          console.error(`[AI_CALL] Unknown provider: ${model.provider}`);
          return {
            ok: false,
            error: 'unknown_provider',
            attempts,
            latencyMs: Date.now() - startedAt,
          };
      }

      if (!text.trim()) {
        console.error(`[AI_CALL] Empty response from ${model.provider}`);
        return {
          ok: false,
          error: 'empty_response',
          attempts,
          latencyMs: Date.now() - startedAt,
        };
      }

      return { ok: true, text, attempts, latencyMs: Date.now() - startedAt };
    } catch (error) {
      const isAbort = error instanceof Error && error.name === 'AbortError';
      const isProviderError = error instanceof ProviderError;
      const isNetworkError = error instanceof TypeError;
      const isRetryable = isAbort || isNetworkError || (isProviderError && error.retryable);
      const errorCode = isAbort
        ? 'timeout'
        : isNetworkError
          ? 'network_error'
          : isProviderError
            ? error.message
            : 'provider_error';
      const status = isProviderError ? error.status : undefined;

      if (isRetryable && attempt < MAX_RETRIES) {
        const delay = INITIAL_DELAY_MS * Math.pow(2, attempt);
        await sleep(delay);
        continue;
      }

      console.error(`[AI_CALL] ${errorCode} from ${model.provider} after ${attempts} attempt(s)`);
      return {
        ok: false,
        error: errorCode,
        ...(status === undefined ? {} : { status }),
        attempts,
        latencyMs: Date.now() - startedAt,
      };
    } finally {
      clearTimeout(timeout);
    }
  }

  return {
    ok: false,
    error: 'provider_error',
    attempts,
    latencyMs: Date.now() - startedAt,
  };
}

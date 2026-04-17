/**
 * LLM Dispatch Layer
 *
 * Extracted from app/api/ai/route.ts so both the API route and the
 * headless batch runner can share the same provider call logic.
 *
 * Includes exponential backoff for 429/503 responses (max 3 retries,
 * initial delay 2 seconds).
 */

// ==================== Provider Call Functions ====================

async function callAnthropic(model: string, prompt: string): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error('Anthropic API key not configured (ANTHROPIC_API_KEY)');
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
      max_tokens: 300,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('[Anthropic] API error:', response.status, errorText);
    throw new ApiError(`Anthropic API error: ${response.status}`, response.status);
  }

  const data = await response.json();
  return data.content?.[0]?.text || '';
}

async function callOpenAI(model: string, prompt: string): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OpenAI API key not configured (OPENAI_API_KEY)');
  }

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      max_tokens: 300,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('[OpenAI] API error:', response.status, errorText);
    throw new ApiError(`OpenAI API error: ${response.status}`, response.status);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || '';
}

async function callGoogle(model: string, prompt: string): Promise<string> {
  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    throw new Error('Google API key not configured (GOOGLE_API_KEY)');
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
      maxOutputTokens: 4096,
      temperature: 0.7,
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
  });

  const data = await response.json();

  if (!response.ok) {
    console.error('[Google] API error:', response.status, data.error?.message);
    throw new ApiError(`Google API error: ${response.status}`, response.status);
  }

  const candidate = data.candidates?.[0];

  if (candidate?.finishReason === 'SAFETY') {
    console.warn('[Google] Blocked by Safety Filter');
    throw new Error('Response blocked by safety filter');
  }

  let text = candidate?.content?.parts?.[0]?.text || '';

  // Clean thinking chain tags
  text = text.replace(/<thinking>[\s\S]*?<\/thinking>/gi, '').trim();
  text = text.replace(/^(思考|分析|让我想想)[：:].*/gm, '').trim();

  // Truncate if too long
  if (text.length > 500) {
    const cutoff = text.substring(0, 500).lastIndexOf('。');
    text = cutoff > 100 ? text.substring(0, cutoff + 1) : text.substring(0, 500);
  }

  return text;
}

async function callDeepSeek(model: string, prompt: string): Promise<string> {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    throw new Error('DeepSeek API key not configured (DEEPSEEK_API_KEY)');
  }

  const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      max_tokens: 300,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('[DeepSeek] API error:', response.status, errorText);
    throw new ApiError(`DeepSeek API error: ${response.status}`, response.status);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || '';
}

async function callXAI(model: string, prompt: string): Promise<string> {
  const apiKey = process.env.XAI_API_KEY;
  if (!apiKey) {
    throw new Error('xAI API key not configured (XAI_API_KEY)');
  }

  const response = await fetch('https://api.x.ai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      max_tokens: 300,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('[xAI] API error:', response.status, errorText);
    throw new ApiError(`xAI API error: ${response.status}`, response.status);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || '';
}

// ==================== Error Types ====================

class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

// ==================== Fallback Responses ====================

export function generateFallbackResponse(action: string): string {
  switch (action) {
    case 'discussion': {
      const fallbackSpeeches = [
        '我觉得我们需要更多信息才能判断。',
        '这一轮很关键，大家要仔细考虑。',
        '我暂时保留意见，先听听其他人怎么说。',
        '目前的局势还不太明朗，我们要小心决策。',
        '我在观察每个人的反应，希望能找到线索。',
      ];
      return fallbackSpeeches[Math.floor(Math.random() * fallbackSpeeches.length)];
    }
    case 'voting':
      return Math.random() > 0.5 ? 'APPROVE' : 'REJECT';
    case 'quest':
      return 'SUCCESS';
    case 'team_building':
      return '';
    case 'assassination':
      return '';
    default:
      return '我需要再观察一下局势。';
  }
}

// ==================== Retry Logic ====================

function isRetryableStatus(status: number): boolean {
  return status === 429 || status === 503;
}

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ==================== Main Dispatcher ====================

/**
 * Call an LLM provider with exponential backoff for 429/503 errors.
 * Max 3 retries, initial delay 2 seconds.
 * Falls back to generateFallbackResponse on exhaustion.
 */
export async function callAIProvider(
  model: { provider: string; model: string; name?: string },
  prompt: string,
  action: string
): Promise<string> {
  const MAX_RETRIES = 3;
  const INITIAL_DELAY_MS = 2000;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      switch (model.provider) {
        case 'anthropic':
          return await callAnthropic(model.model, prompt);
        case 'openai':
          return await callOpenAI(model.model, prompt);
        case 'google':
          return await callGoogle(model.model, prompt);
        case 'deepseek':
          return await callDeepSeek(model.model, prompt);
        case 'xai':
          return await callXAI(model.model, prompt);
        default:
          console.warn(`[AI_CALL] Unknown provider: ${model.provider}, using fallback`);
          return generateFallbackResponse(action);
      }
    } catch (error) {
      const isRetryable = error instanceof ApiError && isRetryableStatus(error.status);

      if (isRetryable && attempt < MAX_RETRIES) {
        const delay = INITIAL_DELAY_MS * Math.pow(2, attempt);
        console.warn(`[AI_CALL] ${error.status} from ${model.provider}, retry ${attempt + 1}/${MAX_RETRIES} in ${delay}ms`);
        await sleep(delay);
        continue;
      }

      console.error(`[AI_CALL] Error from ${model.provider} (attempt ${attempt + 1}):`, error instanceof Error ? error.message : error);
      return generateFallbackResponse(action);
    }
  }

  // Should not reach here, but just in case
  return generateFallbackResponse(action);
}

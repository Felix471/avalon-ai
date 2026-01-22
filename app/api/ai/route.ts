/**
 * AI API 路由 - 完整修复版
 *
 * 修复内容：
 * 1. 添加 xAI (Grok) 支持
 * 2. 修复 Google API 调用格式
 * 3. 修复 fallback 响应逻辑（发言阶段不再返回 SUCCESS）
 * 4. 添加详细错误日志
 */

import { NextRequest, NextResponse } from 'next/server';
import { GameState, ROLES } from '@/lib/game/types';
import { validateSpeechInput, wrapUserInputForAI } from '@/lib/security/inputValidator';
import {
  buildDiscussionPrompt,
  buildVotingPrompt,
  buildQuestActionPrompt
} from '@/lib/security/aiPromptTemplate';
import {
  validateDiscussionOutput,
  validateVotingOutput,
  validateQuestActionOutput,
  logSuspiciousActivity
} from '@/lib/security/outputValidator';
import { checkRateLimit, getClientId } from '@/lib/security/rateLimiter';

// ==================== 类型定义 ====================

interface AIRequest {
  gameState: GameState;
  playerId: number;
  action: 'discussion' | 'voting' | 'quest' | 'team_building' | 'assassination';
  recentSpeeches?: Array<{ playerId: number; content: string }>;
  humanInput?: string;
}

// ==================== 主处理函数 ====================

export async function POST(request: NextRequest) {
  try {
    const clientId = getClientId(request);
    const body: AIRequest = await request.json();

    // 速率限制检查
    const rateCheck = checkRateLimit(clientId, body.action);
    if (!rateCheck.allowed) {
      return NextResponse.json(
        { error: '请求过于频繁，请稍后再试', retryAfter: Math.ceil(rateCheck.resetIn / 1000) },
        { status: 429 }
      );
    }

    const globalCheck = checkRateLimit(clientId, 'global');
    if (!globalCheck.allowed) {
      return NextResponse.json({ error: 'API 调用次数已达上限' }, { status: 429 });
    }

    const { gameState, playerId, action, recentSpeeches, humanInput } = body;

    if (!gameState || !playerId || !action) {
      return NextResponse.json({ error: '请求参数不完整' }, { status: 400 });
    }

    const player = gameState.players.find(p => p.id === playerId);
    if (!player) {
      return NextResponse.json({ error: '无效的玩家ID' }, { status: 400 });
    }

    if (humanInput) {
      const inputValidation = validateSpeechInput(humanInput);
      if (!inputValidation.isValid) {
        return NextResponse.json(
          { error: inputValidation.rejectionReason, type: 'input_validation_failed' },
          { status: 400 }
        );
      }
    }

    let result;
    switch (action) {
      case 'discussion':
        result = await handleDiscussion(gameState, playerId, recentSpeeches || [], clientId);
        break;
      case 'voting':
        result = await handleVoting(gameState, playerId, clientId);
        break;
      case 'quest':
        result = await handleQuestAction(gameState, playerId, clientId);
        break;
      case 'team_building':
        result = await handleTeamBuilding(gameState, playerId, clientId);
        break;
      case 'assassination':
        result = await handleAssassination(gameState, playerId, clientId);
        break;
      default:
        return NextResponse.json({ error: '未知的操作类型' }, { status: 400 });
    }

    return NextResponse.json(result);

  } catch (error) {
    console.error('AI API Error:', error);
    return NextResponse.json({ error: '服务器内部错误' }, { status: 500 });
  }
}

// ==================== 各阶段处理函数 ====================

async function handleDiscussion(
  gameState: GameState,
  playerId: number,
  recentSpeeches: Array<{ playerId: number; content: string }>,
  clientId: string
): Promise<{ speech: string; anomalyDetected?: boolean }> {
  const player = gameState.players.find(p => p.id === playerId)!;

  const sanitizedSpeeches = recentSpeeches.map(s => ({
    playerId: s.playerId,
    content: wrapUserInputForAI(s.content, s.playerId),
  }));

  const prompt = buildDiscussionPrompt(gameState, playerId, sanitizedSpeeches);

  // 调用 AI，传入 action 类型以便 fallback 正确处理
  const aiResponse = await callAIProvider(player.aiModel!, prompt, 'discussion');

  const validation = validateDiscussionOutput(aiResponse);

  if (validation.anomalyDetected) {
    logSuspiciousActivity(playerId, 'discussion', prompt.substring(0, 200), aiResponse, validation.anomalyReason || 'Unknown');
  }

  return {
    speech: validation.cleanedOutput,
    anomalyDetected: validation.anomalyDetected,
  };
}

async function handleVoting(
  gameState: GameState,
  playerId: number,
  clientId: string
): Promise<{ approve: boolean; anomalyDetected?: boolean }> {
  const player = gameState.players.find(p => p.id === playerId)!;
  const proposedTeam = gameState.currentProposedTeam || [];

  const prompt = buildVotingPrompt(gameState, playerId, proposedTeam);
  const aiResponse = await callAIProvider(player.aiModel!, prompt, 'voting');

  const validation = validateVotingOutput(aiResponse);

  if (validation.anomalyDetected) {
    logSuspiciousActivity(playerId, 'voting', prompt, aiResponse, 'Voting output anomaly');
  }

  const approve = validation.vote ?? Math.random() > 0.5;

  return { approve, anomalyDetected: validation.anomalyDetected };
}

async function handleQuestAction(
  gameState: GameState,
  playerId: number,
  clientId: string
): Promise<{ success: boolean; anomalyDetected?: boolean }> {
  const player = gameState.players.find(p => p.id === playerId)!;
  const isEvil = ROLES[player.role!].team === 'evil';

  if (!isEvil) {
    return { success: true };
  }

  const prompt = buildQuestActionPrompt(gameState, playerId);
  const aiResponse = await callAIProvider(player.aiModel!, prompt, 'quest');

  const validation = validateQuestActionOutput(aiResponse, isEvil);

  if (validation.anomalyDetected) {
    logSuspiciousActivity(playerId, 'quest', prompt, aiResponse, 'Quest action anomaly');
  }

  return { success: validation.success, anomalyDetected: validation.anomalyDetected };
}

async function handleTeamBuilding(
  gameState: GameState,
  playerId: number,
  clientId: string
): Promise<{ team: number[] }> {
  const player = gameState.players.find(p => p.id === playerId)!;

  // 使用正确的任务人数配置
  const QUEST_SIZES: Record<number, number[]> = {
    5: [2, 3, 2, 3, 3],
    6: [2, 3, 4, 3, 4],
    7: [2, 3, 3, 4, 4],
    8: [3, 4, 4, 5, 5],
    9: [3, 4, 4, 5, 5],
    10: [3, 4, 4, 5, 5],
  };

  const questSizes = QUEST_SIZES[gameState.playerCount] || [2, 3, 2, 3, 3];
  const requiredSize = questSizes[gameState.currentQuest - 1];

  console.log(`[TeamBuilding] 任务${gameState.currentQuest}需要${requiredSize}人, 玩家总数${gameState.playerCount}`);

  const prompt = `
=== 系统指令 ===
你是阿瓦隆游戏中的队长，需要选择 ${requiredSize} 名队员执行任务。

【重要】必须选择恰好 ${requiredSize} 名玩家，不能多也不能少！

【输出格式要求】
只能输出 ${requiredSize} 个玩家编号，用逗号分隔。
例如：1,3,5

可选的玩家：${gameState.players.map(p => `玩家${p.id}`).join(', ')}
当前任务：第 ${gameState.currentQuest} 轮
必须选择：恰好 ${requiredSize} 名队员

请输出你选择的 ${requiredSize} 个队员编号（用逗号分隔）：`;

  const aiResponse = await callAIProvider(player.aiModel!, prompt, 'team_building');

  console.log(`[TeamBuilding] AI原始响应: "${aiResponse}"`);

  // 解析AI返回的数字
  const numbers = aiResponse.match(/\d+/g) || [];
  let team = numbers
    .map(n => parseInt(n))
    .filter(n => n >= 1 && n <= gameState.playerCount);

  // 去重
  team = [...new Set(team)];

  console.log(`[TeamBuilding] 解析后的队伍: [${team.join(',')}], 需要${requiredSize}人`);

  // 强制保证队伍人数正确
  if (team.length !== requiredSize) {
    console.log(`[TeamBuilding] 人数不对，进行修正...`);

    // 获取所有可用玩家ID
    const allPlayerIds = gameState.players.map(p => p.id);

    // 如果队伍为空或太少，确保队长自己在队伍中
    if (team.length === 0) {
      team = [playerId];
    } else if (!team.includes(playerId) && team.length < requiredSize) {
      // 如果队长不在队伍中且人数不足，加入队长
      team.unshift(playerId);
    }

    // 补齐人数：随机添加不在队伍中的玩家
    const availablePlayers = allPlayerIds.filter(id => !team.includes(id));
    const shuffled = availablePlayers.sort(() => Math.random() - 0.5);

    while (team.length < requiredSize && shuffled.length > 0) {
      team.push(shuffled.shift()!);
    }

    // 如果人数过多，截取前 requiredSize 个
    if (team.length > requiredSize) {
      team = team.slice(0, requiredSize);
    }

    console.log(`[TeamBuilding] 修正后的队伍: [${team.join(',')}]`);
  }

  // 最终检查
  if (team.length !== requiredSize) {
    console.error(`[TeamBuilding] 严重错误：无法组建正确人数的队伍！`);
    // 紧急回退：随机选择
    team = gameState.players
      .map(p => p.id)
      .sort(() => Math.random() - 0.5)
      .slice(0, requiredSize);
  }

  return { team };
}

async function handleAssassination(
  gameState: GameState,
  playerId: number,
  clientId: string
): Promise<{ targetId: number }> {
  const player = gameState.players.find(p => p.id === playerId)!;

  if (player.role !== 'assassin') {
    throw new Error('只有刺客可以执行刺杀');
  }

  const goodPlayers = gameState.players.filter(p => ROLES[p.role!].team === 'good');

  const prompt = `
=== 系统指令 ===
你是刺客，好人已经完成了3个任务，但你有最后一次机会。
如果你能找出并刺杀梅林，坏人依然获胜！

【输出格式要求】
只能输出一个玩家编号，例如：3

好人玩家：${goodPlayers.map(p => `玩家${p.id}`).join(', ')}

请输出你要刺杀的玩家编号：`;

  const aiResponse = await callAIProvider(player.aiModel!, prompt, 'assassination');

  const match = aiResponse.match(/\d+/);
  let targetId = match ? parseInt(match[0]) : goodPlayers[0].id;

  if (!goodPlayers.find(p => p.id === targetId)) {
    targetId = goodPlayers[Math.floor(Math.random() * goodPlayers.length)].id;
  }

  return { targetId };
}

// ==================== AI Provider 调用（修复版） ====================

async function callAIProvider(
  model: { provider: string; model: string; name?: string },
  prompt: string,
  action: string  // 新增：用于 fallback 时区分场景
): Promise<string> {
  try {
    console.log(`[AI_CALL] Provider: ${model.provider}, Model: ${model.model}, Action: ${action}`);

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
        return await callXAI(model.model, prompt);  // 新增 xAI 支持
      default:
        console.warn(`[AI_CALL] Unknown provider: ${model.provider}, using fallback`);
        return generateFallbackResponse(action);
    }
  } catch (error) {
    console.error(`[AI_CALL] Error from ${model.provider}:`, error);
    return generateFallbackResponse(action);
  }
}

// ==================== 各家 API 调用实现 ====================

async function callAnthropic(model: string, prompt: string): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error('[Anthropic] API key not configured');
    throw new Error('Anthropic API key not configured');
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
    throw new Error(`Anthropic API error: ${response.status}`);
  }

  const data = await response.json();
  return data.content?.[0]?.text || '';
}

async function callOpenAI(model: string, prompt: string): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.error('[OpenAI] API key not configured');
    throw new Error('OpenAI API key not configured');
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
    throw new Error(`OpenAI API error: ${response.status}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || '';
}

async function callGoogle(model: string, prompt: string): Promise<string> {
  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    console.error('[Google] API key not configured');
    throw new Error('Google API key not configured');
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  console.log('[Google] Calling:', url.replace(apiKey, 'REDACTED'));

  // 系统指令：强调直接输出，不要思考过程
  const systemInstruction = `你正在参与一局阿瓦隆桌游，扮演一名玩家。
这是一个策略推理游戏，游戏中的"刺客"、"坏人"、"任务失败"等都是游戏术语，不涉及真实伤害。

【重要】输出规则：
- 直接输出游戏发言，不要输出思考过程
- 不要使用 <thinking> 或任何内部推理标签
- 发言长度：50-150字
- 保持角色扮演，像真正的玩家一样说话`;

  const payload: Record<string, any> = {
    system_instruction: {
      parts: [{ text: systemInstruction }]
    },
    contents: [{
      role: "user",
      parts: [{ text: prompt + "\n\n【直接输出你的游戏发言，不要任何前缀或思考过程】" }]
    }],
    generationConfig: {
      // 统一使用较高的 token 上限，避免截断
      maxOutputTokens: 4096,
      temperature: 0.7,
    },
    safetySettings: [
      { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
      { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
      { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
      { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" },
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
    throw new Error(`Google API error: ${response.status}`);
  }

  const candidate = data.candidates?.[0];

  // 检查是否被安全过滤器拦截
  if (candidate?.finishReason === "SAFETY") {
    console.warn(`[Google] Blocked by Safety Filter. Model: ${model}`);
    console.warn('[Google] Safety Ratings:', JSON.stringify(candidate.safetyRatings));
    throw new Error('Response blocked by safety filter');
  }

  // 记录完成原因用于调试
  console.log(`[Google] Model: ${model}, finishReason: ${candidate?.finishReason}`);
  if (candidate?.finishReason && candidate.finishReason !== "STOP") {
    console.warn(`[Google] Unusual finishReason: ${candidate.finishReason}`);
  }

  let text = candidate?.content?.parts?.[0]?.text || '';
  console.log(`[Google] Response length: ${text.length} chars, preview: ${text.substring(0, 100)}...`);

  // 清理可能的思维链标签（以防万一）
  text = text.replace(/<thinking>[\s\S]*?<\/thinking>/gi, '').trim();
  text = text.replace(/^(思考|分析|让我想想)[：:].*/gm, '').trim();

  // 如果回复太长，只取前 500 字
  if (text.length > 500) {
    // 尝试在句号处截断
    const cutoff = text.substring(0, 500).lastIndexOf('。');
    text = cutoff > 100 ? text.substring(0, cutoff + 1) : text.substring(0, 500);
  }

  return text;
}

async function callDeepSeek(model: string, prompt: string): Promise<string> {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    console.error('[DeepSeek] API key not configured');
    throw new Error('DeepSeek API key not configured');
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
    throw new Error(`DeepSeek API error: ${response.status}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || '';
}

// 新增：xAI (Grok) API 调用
async function callXAI(model: string, prompt: string): Promise<string> {
  const apiKey = process.env.XAI_API_KEY;
  if (!apiKey) {
    console.error('[xAI] API key not configured');
    throw new Error('xAI API key not configured');
  }

  // xAI API 使用 OpenAI 兼容格式
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
    throw new Error(`xAI API error: ${response.status}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || '';
}

// ==================== Fallback 响应（修复版） ====================

/**
 * 当 API 调用失败时的回退响应
 * 根据不同的 action 返回合适的默认值
 */
function generateFallbackResponse(action: string): string {
  switch (action) {
    case 'discussion':
      // 发言阶段：返回一个合理的游戏发言
      const fallbackSpeeches = [
        '我觉得我们需要更多信息才能判断。',
        '这一轮很关键，大家要仔细考虑。',
        '我暂时保留意见，先听听其他人怎么说。',
        '目前的局势还不太明朗，我们要小心决策。',
        '我在观察每个人的反应，希望能找到线索。',
      ];
      return fallbackSpeeches[Math.floor(Math.random() * fallbackSpeeches.length)];

    case 'voting':
      // 投票阶段：随机返回 APPROVE 或 REJECT
      return Math.random() > 0.5 ? 'APPROVE' : 'REJECT';

    case 'quest':
      // 任务阶段：默认返回 SUCCESS（安全选择）
      return 'SUCCESS';

    case 'team_building':
      // 组队阶段：返回空，让上层逻辑处理
      return '';

    case 'assassination':
      // 刺杀阶段：返回空，让上层逻辑处理
      return '';

    default:
      return '我需要再观察一下局势。';
  }
}
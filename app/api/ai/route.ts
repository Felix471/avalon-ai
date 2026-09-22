// API route for validated AI actions in the web game.

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
import { AIProviderResult, callAIProvider } from '@/lib/ai/dispatch';

// ==================== 类型定义 ====================

interface AIRequest {
  gameState: GameState;
  playerId: number;
  action: 'discussion' | 'voting' | 'quest' | 'team_building' | 'assassination';
  recentSpeeches?: Array<{ playerId: number; content: string }>;
  humanInput?: string;
}

type AIModelRef = { provider: string; model: string };

function providerFailureResponse(model: AIModelRef, result: Extract<AIProviderResult, { ok: false }>) {
  return NextResponse.json(
    {
      error: result.error,
      provider: model.provider,
      model: model.model,
      ...(result.status === undefined ? {} : { status: result.status }),
      attempts: result.attempts,
    },
    { status: 502 },
  );
}

function unparseableResponse(model: AIModelRef, raw: string, reason?: string) {
  return NextResponse.json(
    {
      error: 'unparseable',
      provider: model.provider,
      model: model.model,
      ...(reason ? { reason } : {}),
      raw: raw.slice(0, 500),
    },
    { status: 502 },
  );
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
      return NextResponse.json(
        { error: 'API 调用次数已达上限', retryAfter: Math.ceil(globalCheck.resetIn / 1000) },
        { status: 429 },
      );
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

    switch (action) {
      case 'discussion':
        return await handleDiscussion(gameState, playerId, recentSpeeches || []);
      case 'voting':
        return await handleVoting(gameState, playerId);
      case 'quest':
        return await handleQuestAction(gameState, playerId);
      case 'team_building':
        return await handleTeamBuilding(gameState, playerId);
      case 'assassination':
        return await handleAssassination(gameState, playerId);
      default:
        return NextResponse.json({ error: '未知的操作类型' }, { status: 400 });
    }

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
) {
  const player = gameState.players.find(p => p.id === playerId)!;

  const sanitizedSpeeches = recentSpeeches.map(s => ({
    playerId: s.playerId,
    content: wrapUserInputForAI(s.content, s.playerId),
  }));

  const prompt = buildDiscussionPrompt(gameState, playerId, sanitizedSpeeches);

  const aiResult = await callAIProvider(player.aiModel!, prompt, 'discussion');
  if (!aiResult.ok) return providerFailureResponse(player.aiModel!, aiResult);
  const aiResponse = aiResult.text;

  const validation = validateDiscussionOutput(aiResponse);

  if (validation.anomalyDetected) {
    logSuspiciousActivity(playerId, 'discussion', prompt.substring(0, 200), aiResponse, validation.anomalyReason || 'Unknown');

    const normalizedLength = aiResponse.replace('[AVALON_VALID]', '').trim().length;
    if (normalizedLength <= 500) {
      return unparseableResponse(player.aiModel!, aiResponse, validation.anomalyReason);
    }
  }

  return NextResponse.json({
    speech: validation.cleanedOutput,
    anomalyDetected: validation.anomalyDetected,
  });
}

async function handleVoting(
  gameState: GameState,
  playerId: number,
) {
  const player = gameState.players.find(p => p.id === playerId)!;
  const proposedTeam = gameState.currentProposedTeam || [];

  const prompt = buildVotingPrompt(gameState, playerId, proposedTeam);
  const aiResult = await callAIProvider(player.aiModel!, prompt, 'voting');
  if (!aiResult.ok) return providerFailureResponse(player.aiModel!, aiResult);
  const aiResponse = aiResult.text;

  const validation = validateVotingOutput(aiResponse);

  if (validation.anomalyDetected) {
    logSuspiciousActivity(playerId, 'voting', prompt, aiResponse, 'Voting output anomaly');
  }

  if (validation.vote === null) {
    return unparseableResponse(player.aiModel!, aiResponse);
  }

  return NextResponse.json({ approve: validation.vote, anomalyDetected: validation.anomalyDetected });
}

async function handleQuestAction(
  gameState: GameState,
  playerId: number,
) {
  const player = gameState.players.find(p => p.id === playerId)!;
  const isEvil = ROLES[player.role!].team === 'evil';

  if (!isEvil) {
    return NextResponse.json({ success: true });
  }

  const prompt = buildQuestActionPrompt(gameState, playerId);
  const aiResult = await callAIProvider(player.aiModel!, prompt, 'quest');
  if (!aiResult.ok) return providerFailureResponse(player.aiModel!, aiResult);
  const aiResponse = aiResult.text;

  const validation = validateQuestActionOutput(aiResponse, isEvil);

  if (validation.anomalyDetected) {
    logSuspiciousActivity(playerId, 'quest', prompt, aiResponse, 'Quest action anomaly');
  }

  if (!validation.isValid) {
    return unparseableResponse(player.aiModel!, aiResponse);
  }

  return NextResponse.json({ success: validation.success, anomalyDetected: validation.anomalyDetected });
}

async function handleTeamBuilding(
  gameState: GameState,
  playerId: number,
) {
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

  const aiResult = await callAIProvider(player.aiModel!, prompt, 'team_building');
  if (!aiResult.ok) return providerFailureResponse(player.aiModel!, aiResult);
  const aiResponse = aiResult.text;

  // 解析AI返回的数字
  const numbers = aiResponse.match(/\d+/g) || [];
  let team = numbers
    .map(n => parseInt(n))
    .filter(n => n >= 1 && n <= gameState.playerCount);

  // 去重
  team = [...new Set(team)];

  if (team.length !== requiredSize) {
    return unparseableResponse(player.aiModel!, aiResponse);
  }

  return NextResponse.json({ team });
}

async function handleAssassination(
  gameState: GameState,
  playerId: number,
) {
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

  const aiResult = await callAIProvider(player.aiModel!, prompt, 'assassination');
  if (!aiResult.ok) return providerFailureResponse(player.aiModel!, aiResult);
  const aiResponse = aiResult.text;

  const match = aiResponse.match(/\d+/);
  const targetId = match ? parseInt(match[0]) : -1;

  if (!goodPlayers.find(p => p.id === targetId)) {
    return unparseableResponse(player.aiModel!, aiResponse);
  }

  return NextResponse.json({ targetId });
}

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
import { callAIProvider, generateFallbackResponse } from '@/lib/ai/dispatch';

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

// callAIProvider and generateFallbackResponse are imported from @/lib/ai/dispatch
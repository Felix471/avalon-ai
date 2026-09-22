// API route for validated AI actions in the web game.

import { NextRequest, NextResponse } from 'next/server';
import { parseAIRequest, type AIRequest } from '@/lib/api/aiRequestSchema';
import {
  DEFAULT_GENERATION,
  GameState,
  GenerationSettings,
  ROLES,
} from '@/lib/game/types';
import { parseTargetSelection, parseTeamSelection } from '@/lib/game/parsers';
import { validateSpeechInput, wrapUserInputForAI } from '@/lib/security/inputValidator';
import {
  buildDiscussionPrompt,
  buildVotingPrompt,
  buildQuestActionPrompt,
  buildTeamBuildingPrompt,
  buildAssassinationPrompt,
} from '@/lib/security/aiPromptTemplate';
import {
  validateDiscussionOutput,
  validateVotingOutput,
  validateQuestActionOutput,
  logSuspiciousActivity
} from '@/lib/security/outputValidator';
import { checkRateLimit, getClientId } from '@/lib/security/rateLimiter';
import { AIProviderResult, callAIProvider } from '@/lib/ai/dispatch';
import { isMockAIEnabled } from '@/lib/ai/mockProvider';

// ==================== 类型定义 ====================

type AIModelRef = { provider: string; model: string };

function markMockResponse(response: NextResponse) {
  response.headers.set('x-avalon-mock-ai', isMockAIEnabled() ? '1' : '0');
  return response;
}

// Set AI_DEBUG=1 to log the raw model text and the parsed verdict for every call.
function debugRaw(action: string, model: AIModelRef, text: string, parsed?: unknown) {
  if (process.env.AI_DEBUG !== '1') return;
  const preview = text.replace(/\s+/g, ' ').slice(0, 200);
  console.error(`[AI_RAW] ${action} ${model.provider}/${model.model}: ${JSON.stringify(preview)}${parsed === undefined ? '' : ` -> ${JSON.stringify(parsed)}`}`);
}

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
    let rawBody: unknown;
    try {
      rawBody = await request.json();
    } catch {
      return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
    }

    const parsedRequest = parseAIRequest(rawBody);
    if (!parsedRequest.ok) {
      return NextResponse.json(
        { error: 'invalid_request', issues: parsedRequest.issues },
        { status: 400 },
      );
    }

    const body: AIRequest = parsedRequest.data;

    // 速率限制检查
    // Mock games run quickly and do not consume provider quota.
    if (!isMockAIEnabled()) {
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
    }

    const { playerId, action, recentSpeeches, humanInput } = body;
    // Zod validates the serialized shape; this cast bridges JSON record keys to GameState's numeric keys.
    const gameState = body.gameState as unknown as GameState;
    const promptMode = body.promptMode ?? gameState.promptMode ?? 'full';
    const generation = body.generation ?? gameState.generation ?? DEFAULT_GENERATION;

    if (humanInput) {
      const inputValidation = validateSpeechInput(humanInput);
      if (!inputValidation.isValid) {
        return NextResponse.json(
          { error: inputValidation.rejectionReason, type: 'input_validation_failed' },
          { status: 400 }
        );
      }
    }

    let response: NextResponse;
    switch (action) {
      case 'discussion':
        response = await handleDiscussion(
          gameState,
          playerId,
          recentSpeeches || [],
          promptMode,
          generation,
        );
        break;
      case 'voting':
        response = await handleVoting(gameState, playerId, promptMode, generation);
        break;
      case 'quest':
        response = await handleQuestAction(gameState, playerId, promptMode, generation);
        break;
      case 'team_building':
        response = await handleTeamBuilding(gameState, playerId, promptMode, generation);
        break;
      case 'assassination':
        response = await handleAssassination(gameState, playerId, promptMode, generation);
        break;
      default:
        return NextResponse.json({ error: '未知的操作类型' }, { status: 400 });
    }

    return markMockResponse(response);

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
  mode: 'full' | 'naive',
  generation: GenerationSettings,
) {
  const player = gameState.players.find(p => p.id === playerId)!;

  const sanitizedSpeeches = recentSpeeches.map(s => ({
    playerId: s.playerId,
    content: wrapUserInputForAI(s.content, s.playerId),
  }));

  const prompt = buildDiscussionPrompt(gameState, playerId, sanitizedSpeeches, mode);

  const aiResult = await callAIProvider(player.aiModel!, prompt, 'discussion', {
    gameState,
    playerId,
    generation,
  });
  if (!aiResult.ok) return providerFailureResponse(player.aiModel!, aiResult);
  const aiResponse = aiResult.text;

  const validation = validateDiscussionOutput(aiResponse);
  debugRaw('discussion', player.aiModel!, aiResponse, { anomaly: validation.anomalyDetected });

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
  mode: 'full' | 'naive',
  generation: GenerationSettings,
) {
  const player = gameState.players.find(p => p.id === playerId)!;
  const proposedTeam = gameState.currentProposedTeam || [];

  const prompt = buildVotingPrompt(gameState, playerId, proposedTeam, mode);
  const aiResult = await callAIProvider(player.aiModel!, prompt, 'voting', {
    gameState,
    playerId,
    generation,
  });
  if (!aiResult.ok) return providerFailureResponse(player.aiModel!, aiResult);
  const aiResponse = aiResult.text;

  const validation = validateVotingOutput(aiResponse);
  debugRaw('voting', player.aiModel!, aiResponse, validation);

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
  mode: 'full' | 'naive',
  generation: GenerationSettings,
) {
  const player = gameState.players.find(p => p.id === playerId)!;
  const isEvil = ROLES[player.role!].team === 'evil';

  if (!isEvil) {
    return NextResponse.json({ success: true });
  }

  const prompt = buildQuestActionPrompt(gameState, playerId, mode);
  const aiResult = await callAIProvider(player.aiModel!, prompt, 'quest', {
    gameState,
    playerId,
    generation,
  });
  if (!aiResult.ok) return providerFailureResponse(player.aiModel!, aiResult);
  const aiResponse = aiResult.text;

  const validation = validateQuestActionOutput(aiResponse, isEvil);
  debugRaw('quest', player.aiModel!, aiResponse, validation);

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
  mode: 'full' | 'naive',
  generation: GenerationSettings,
) {
  const player = gameState.players.find(p => p.id === playerId)!;
  const requiredSize = gameState.quests[gameState.currentQuest - 1].requiredPlayers;
  const prompt = buildTeamBuildingPrompt(gameState, playerId, mode);

  const aiResult = await callAIProvider(player.aiModel!, prompt, 'team_building', {
    gameState,
    playerId,
    generation,
  });
  if (!aiResult.ok) return providerFailureResponse(player.aiModel!, aiResult);
  const aiResponse = aiResult.text;

  // First run of requiredSize distinct valid ids wins; trailing explanations are ignored.
  const team = parseTeamSelection(
    aiResponse,
    gameState.players.map(p => p.id),
    requiredSize,
  );
  debugRaw('team_building', player.aiModel!, aiResponse, team);

  if (!team) {
    return unparseableResponse(player.aiModel!, aiResponse);
  }

  return NextResponse.json({ team });
}

async function handleAssassination(
  gameState: GameState,
  playerId: number,
  mode: 'full' | 'naive',
  generation: GenerationSettings,
) {
  const player = gameState.players.find(p => p.id === playerId)!;

  if (player.role !== 'assassin') {
    throw new Error('只有刺客可以执行刺杀');
  }

  const goodPlayers = gameState.players.filter(p => ROLES[p.role!].team === 'good');
  const prompt = buildAssassinationPrompt(gameState, playerId, mode);

  const aiResult = await callAIProvider(player.aiModel!, prompt, 'assassination', {
    gameState,
    playerId,
    generation,
  });
  if (!aiResult.ok) return providerFailureResponse(player.aiModel!, aiResult);
  const aiResponse = aiResult.text;

  const targetId = parseTargetSelection(aiResponse, goodPlayers.map(p => p.id));
  debugRaw('assassination', player.aiModel!, aiResponse, targetId);

  if (targetId === null) {
    return unparseableResponse(player.aiModel!, aiResponse);
  }

  return NextResponse.json({ targetId });
}

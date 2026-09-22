'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { getPhaseKey, useGameStore } from '@/lib/game/store';
import { getCurrentLeader } from '@/lib/game/engine';
import { DISCUSSION_ROUNDS } from '@/lib/game/types';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  AlertTriangle,
  Bot,
  Check,
  Crown,
  Info,
  Loader2,
  MessageCircle,
  Mic,
  Send,
  User,
} from 'lucide-react';
import {
  validateSpeechInput,
  quickSuspicionCheck,
  MAX_SPEECH_LENGTH
} from '@/lib/security/inputValidator';
import AISeatError from './AISeatError';
import { describeAIError, readAIResponse } from './aiResponse';
import { panelClass, panelHeadingClass } from './ui';

// ==================== 安全输入组件（内联） ====================

interface SecureSpeechInputProps {
  onSubmit: (content: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

function SecureSpeechInput({
  onSubmit,
  disabled = false,
  placeholder = '输入你的发言...'
}: SecureSpeechInputProps) {
  const [input, setInput] = useState('');
  const [warning, setWarning] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // 实时检查输入
  const handleInputChange = useCallback((value: string) => {
    setInput(value);
    setError(null);

    // 快速可疑检查（不阻塞输入，只是警告）
    if (quickSuspicionCheck(value)) {
      setWarning('检测到可疑内容，可能无法发送');
    } else if (value.length > MAX_SPEECH_LENGTH * 0.8) {
      setWarning(`接近字数限制 (${value.length}/${MAX_SPEECH_LENGTH})`);
    } else {
      setWarning(null);
    }
  }, []);

  // 提交时完整验证
  const handleSubmit = useCallback(() => {
    const validation = validateSpeechInput(input);

    if (!validation.isValid) {
      setError(validation.rejectionReason || '输入无效');
      return;
    }

    // 清空输入并提交
    setInput('');
    setWarning(null);
    setError(null);
    onSubmit(validation.sanitizedInput);
  }, [input, onSubmit]);

  // 快捷键提交
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  }, [handleSubmit]);

  const charCount = input.length;
  const isOverLimit = charCount > MAX_SPEECH_LENGTH;

  return (
    <div className="space-y-2">
      {/* 输入框 */}
      <div className="relative">
        <Textarea
          value={input}
          onChange={(e) => handleInputChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          className={`
            min-h-[100px] pr-16 resize-none bg-slate-800 border-slate-600 text-white
            placeholder:text-slate-500
            ${isOverLimit ? 'border-red-500 focus:ring-red-500' : ''}
            ${warning && !isOverLimit ? 'border-yellow-500 focus:ring-yellow-500' : ''}
          `}
        />

        {/* 字数统计 */}
        <div className={`
          absolute bottom-2 right-2 text-xs
          ${isOverLimit ? 'text-red-400' : 'text-slate-500'}
        `}>
          {charCount}/{MAX_SPEECH_LENGTH}
        </div>
      </div>

      {/* 警告信息 */}
      {warning && !error && (
        <div className="flex items-center gap-2 text-yellow-400 text-sm">
          <AlertTriangle aria-hidden="true" className="size-4 shrink-0" />
          <span>{warning}</span>
        </div>
      )}

      {/* 错误信息 */}
      {error && (
        <div className="flex items-center gap-2 text-red-400 text-sm bg-red-900/20 px-3 py-2 rounded">
          <AlertTriangle aria-hidden="true" className="size-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* 提交按钮和提示 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1 text-slate-500 text-xs">
          <Info aria-hidden="true" className="size-4" />
          <span>按 Enter 发送，Shift+Enter 换行</span>
        </div>

        <Button
          onClick={handleSubmit}
          disabled={disabled || isOverLimit || input.trim().length === 0}
          size="sm"
          className="gap-2"
        >
          <Send aria-hidden="true" className="size-4" />
          发言
        </Button>
      </div>
    </div>
  );
}

// ==================== 主组件 ====================

export default function DiscussionPanel() {
  const {
    gameState,
    phaseProgress,
    ensurePhaseProgress,
    appendDiscussionSpeech,
    addDiscussion,
    addSystemEvent,
    nextDiscussionRound,
    goToTeamBuilding,
  } = useGameStore();
  const [isProcessingAI, setIsProcessingAI] = useState(false);
  const [seatErrors, setSeatErrors] = useState<Record<number, string>>({});
  const [seatErrorTitles, setSeatErrorTitles] = useState<Record<number, string>>({});
  const requestedStepRef = useRef<number | null>(null);

  // 重置状态（当进入新的发言阶段时）
  const phaseKey = getPhaseKey(gameState);
  const currentSpeakerIndex = phaseProgress.discussion.step;
  const speeches = phaseProgress.discussion.speeches;
  const progressIsCurrent = phaseProgress.key === phaseKey;

  useEffect(() => {
    ensurePhaseProgress();
    setSeatErrors({});
    setSeatErrorTitles({});
    requestedStepRef.current = null;
  }, [phaseKey, ensurePhaseProgress]);

  const players = gameState?.players ?? [];
  const humanPlayerId = gameState?.humanPlayerId ?? -1;
  const currentLeaderIndex = gameState?.currentLeaderIndex ?? 0;
  const consecutiveRejects = gameState?.consecutiveRejects ?? 0;
  const currentQuest = gameState?.currentQuest ?? 0;
  const leader = gameState ? getCurrentLeader(gameState) : null;

  // 发言顺序：从队长开始，顺时针
  const speakingOrder = [
    ...players.slice(currentLeaderIndex),
    ...players.slice(0, currentLeaderIndex)
  ];

  const discussionRounds = gameState?.discussionRounds ?? DISCUSSION_ROUNDS;
  const totalSpeakingSteps = discussionRounds * players.length;
  const currentSpeaker = speakingOrder[currentSpeakerIndex % players.length];
  const isHumanTurn = currentSpeaker?.id === humanPlayerId;
  const allSpoken = currentSpeakerIndex >= totalSpeakingSteps;

  // 收集之前的发言（用于给 AI 上下文）
  const getRecentSpeeches = (): Array<{ playerId: number; content: string }> => {
    return speeches
      .filter(speech => speech.step < currentSpeakerIndex)
      .map(({ playerId, content }) => ({ playerId, content }));
  };

  const completeSpeakingStep = (stepIndex: number, playerId: number, content: string) => {
    appendDiscussionSpeech(stepIndex, playerId, content);
    if (stepIndex + 1 === players.length) {
      nextDiscussionRound();
    }
    requestedStepRef.current = null;
  };

  const requestAISpeech = async (playerId: number, stepIndex: number) => {
    if (!gameState) return;

    requestedStepRef.current = stepIndex;
    setIsProcessingAI(true);
    setSeatErrors(prev => {
      const next = { ...prev };
      delete next[stepIndex];
      return next;
    });

    try {
      const response = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gameState,
          playerId,
          action: 'discussion',
          recentSpeeches: getRecentSpeeches(),
          promptMode: gameState.promptMode,
          generation: gameState.generation,
        }),
      });

      const isMockResponse = response.headers.get('x-avalon-mock-ai') === '1';

      const data = await readAIResponse(response);
      if (typeof data.speech !== 'string') {
        throw new Error('AI discussion response must include speech as a string');
      }
      const speech = data.speech;

      if (!isMockResponse) {
        await new Promise(resolve => setTimeout(resolve, 800 + Math.random() * 400));
      }
      addDiscussion(playerId, speech);
      completeSpeakingStep(stepIndex, playerId, speech);
    } catch (error) {
      const described = describeAIError(error);
      setSeatErrors(prev => ({ ...prev, [stepIndex]: described.message }));
      setSeatErrorTitles(prev => ({ ...prev, [stepIndex]: described.title }));
    } finally {
      setIsProcessingAI(false);
    }
  };

  // AI 自动发言
  useEffect(() => {
    if (!gameState) return;
    if (!progressIsCurrent) return;
    if (allSpoken || isHumanTurn || isProcessingAI) return;
    if (!currentSpeaker) return;
    if (requestedStepRef.current === currentSpeakerIndex) return;

    requestedStepRef.current = currentSpeakerIndex;

    // 延迟一下开始，避免过于突兀
    const timer = setTimeout(
      () => requestAISpeech(currentSpeaker.id, currentSpeakerIndex),
      500
    );
    return () => clearTimeout(timer);
  }, [currentSpeakerIndex, isHumanTurn, allSpoken, isProcessingAI, progressIsCurrent]);

  if (!gameState || !leader) return null;

  // 人类发言提交
  const handleHumanSpeech = (content: string) => {
    // content 已经被 SecureSpeechInput 验证和清理过了
    addDiscussion(humanPlayerId, content);
    completeSpeakingStep(currentSpeakerIndex, humanPlayerId, content);
  };

  // 跳过发言
  const handleSkipSpeech = () => {
    const skipMessage = '[选择沉默]';
    addDiscussion(humanPlayerId, skipMessage);
    completeSpeakingStep(currentSpeakerIndex, humanPlayerId, skipMessage);
  };

  const handleRetryAISpeech = (playerId: number) => {
    requestedStepRef.current = null;
    void requestAISpeech(playerId, currentSpeakerIndex);
  };

  const handleSkipAISpeech = (playerId: number) => {
    const player = players.find(candidate => candidate.id === playerId);
    const modelName = player?.aiModel?.name || 'AI';
    setSeatErrors(prev => {
      const next = { ...prev };
      delete next[currentSpeakerIndex];
      return next;
    });
    addDiscussion(playerId, '');
    addSystemEvent(`玩家${playerId}（${modelName}）的发言已跳过（AI 不可用）`);
    completeSpeakingStep(currentSpeakerIndex, playerId, '');
  };

  // 结束发言阶段
  const handleEndDiscussion = () => {
    goToTeamBuilding();
  };

  return (
    <div className="flex flex-col gap-4">
      {/* 标题 */}
      <div className="flex items-center justify-between">
        <h2 className={`${panelHeadingClass} text-xl`}>
          <MessageCircle aria-hidden="true" className="size-5" />
          发言讨论
        </h2>
        <div className="text-sm text-slate-400 tabular-nums">
          任务 {currentQuest} · 第 {consecutiveRejects + 1} 次组队
        </div>
      </div>

      {/* 当前队长提示 */}
      <div className="p-3 bg-amber-900/30 rounded-lg border border-amber-700">
        <span className="inline-flex items-center gap-1 text-amber-400">
          <Crown aria-hidden="true" className="size-4" />
          队长：
        </span>
        <span className="text-white ml-2">
          玩家{leader.id} {leader.id === humanPlayerId ? '(你)' : `(${leader.aiModel?.name || 'AI'})`}
        </span>
      </div>

      {/* 发言记录 */}
      <div className="min-h-0 max-h-[45vh] flex-1 space-y-3 overflow-y-auto">
        {Array.from({ length: Math.min(currentSpeakerIndex, totalSpeakingSteps) }, (_, index) => {
          const player = speakingOrder[index % players.length];
          const speech = speeches.find(entry => entry.step === index)?.content;
          const isHuman = player.id === humanPlayerId;
          const round = Math.floor(index / players.length) + 1;

          return (
            <div key={index} className="space-y-3">
              {index % players.length === 0 && (
                <div className="text-xs text-slate-500">第 {round} 轮</div>
              )}
              <div
                className={`
                  p-3 rounded-lg
                  ${isHuman
                    ? 'bg-blue-900/30 border border-blue-700'
                    : 'bg-slate-700/50'
                  }
                `}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className="flex items-center gap-1 text-sm font-medium">
                    {isHuman ? (
                      <User aria-hidden="true" className="size-4" />
                    ) : (
                      <Bot aria-hidden="true" className="size-4" />
                    )}
                    玩家{player.id}
                  </span>
                  {!isHuman && (
                    <span className="text-xs text-slate-500">
                      ({player.aiModel?.name})
                    </span>
                  )}
                </div>
                <p className="text-slate-300 text-sm">{speech || '...'}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* 当前发言者指示 / 输入框 */}
      {!allSpoken && (
        <div className={panelClass}>
          {isHumanTurn ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2 font-medium text-amber-400">
                <Mic aria-hidden="true" className="size-4" />
                轮到你发言了！
              </div>

              <SecureSpeechInput
                onSubmit={handleHumanSpeech}
                disabled={false}
                placeholder="说点什么来影响其他玩家的判断..."
              />

              <Button
                data-testid="discussion-skip"
                variant="ghost"
                size="sm"
                onClick={handleSkipSpeech}
                className="text-slate-500 hover:text-slate-300"
              >
                跳过发言（保持沉默）
              </Button>
            </div>
          ) : currentSpeaker && seatErrors[currentSpeakerIndex] ? (
            <div title={seatErrorTitles[currentSpeakerIndex]}>
              <AISeatError
                playerId={currentSpeaker.id}
                modelName={currentSpeaker.aiModel?.name}
                message={seatErrors[currentSpeakerIndex]}
                onRetry={() => handleRetryAISpeech(currentSpeaker.id)}
                onSkip={() => handleSkipAISpeech(currentSpeaker.id)}
              />
            </div>
          ) : (
            <div className="flex items-center gap-3 text-slate-400">
              <Loader2 aria-hidden="true" className="size-5 animate-spin" />
              <span>
                玩家{currentSpeaker?.id} ({currentSpeaker?.aiModel?.name || 'AI'}) 正在发言...
              </span>
            </div>
          )}
        </div>
      )}

      {/* 发言进度 */}
      <div className="flex items-center gap-2">
        <span className="text-sm text-slate-500">发言进度:</span>
        <div className="flex gap-1">
          {Array.from({ length: totalSpeakingSteps }, (_, i) => {
            const player = speakingOrder[i % players.length];
            return (
              <div
                key={i}
                className={`
                  w-6 h-6 rounded-full flex items-center justify-center text-xs
                  ${i < currentSpeakerIndex
                    ? 'bg-green-600 text-white'
                    : i === currentSpeakerIndex
                      ? 'bg-amber-500 text-white animate-pulse'
                      : 'bg-slate-700 text-slate-500'
                  }
                `}
                title={`玩家${player.id}`}
              >
                {player.id}
              </div>
            );
          })}
        </div>
      </div>

      {/* 否决次数提示 */}
      {consecutiveRejects > 0 && (
        <div className="flex items-center justify-center gap-1 text-center text-sm text-yellow-400 tabular-nums">
          <AlertTriangle aria-hidden="true" className="size-4" />
          连续否决: {consecutiveRejects}/5
        </div>
      )}

      {/* 发言结束，进入组队 */}
      {allSpoken && (
        <div className="text-center space-y-3">
          <p className="flex items-center justify-center gap-1 text-green-400">
            <Check aria-hidden="true" className="size-4" />
            所有玩家发言完毕
          </p>
          <Button data-testid="discussion-end" onClick={handleEndDiscussion} className="w-full">
            进入组队阶段 →
          </Button>
        </div>
      )}
    </div>
  );
}

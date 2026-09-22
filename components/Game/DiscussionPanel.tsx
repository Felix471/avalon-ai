'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useGameStore } from '@/lib/game/store';
import { getCurrentLeader } from '@/lib/game/engine';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, AlertTriangle, Send, Info, MessageCircle } from 'lucide-react';
import {
  validateSpeechInput,
  quickSuspicionCheck,
  MAX_SPEECH_LENGTH
} from '@/lib/security/inputValidator';
import AISeatError from './AISeatError';
import { describeAIError, readAIResponse } from './aiResponse';

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
      setWarning('⚠️ 检测到可疑内容，可能无法发送');
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
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          <span>{warning}</span>
        </div>
      )}

      {/* 错误信息 */}
      {error && (
        <div className="flex items-center gap-2 text-red-400 text-sm bg-red-900/20 px-3 py-2 rounded">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* 提交按钮和提示 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1 text-slate-500 text-xs">
          <Info className="w-3 h-3" />
          <span>按 Enter 发送，Shift+Enter 换行</span>
        </div>

        <Button
          onClick={handleSubmit}
          disabled={disabled || isOverLimit || input.trim().length === 0}
          size="sm"
          className="gap-2"
        >
          <Send className="w-4 h-4" />
          发言
        </Button>
      </div>
    </div>
  );
}

// ==================== 主组件 ====================

export default function DiscussionPanel() {
  const { gameState, addDiscussion, addSystemEvent, goToTeamBuilding } = useGameStore();
  const [hasHumanSpoken, setHasHumanSpoken] = useState(false);
  const [isProcessingAI, setIsProcessingAI] = useState(false);
  const [currentSpeakerIndex, setCurrentSpeakerIndex] = useState(0);
  const [aiResponses, setAiResponses] = useState<Map<number, string>>(new Map());
  const [seatErrors, setSeatErrors] = useState<Record<number, string>>({});
  const [seatErrorTitles, setSeatErrorTitles] = useState<Record<number, string>>({});
  const requestedSpeakerRef = useRef<number | null>(null);

  // 重置状态（当进入新的发言阶段时）
  useEffect(() => {
    if (!gameState) return;

    setHasHumanSpoken(false);
    setCurrentSpeakerIndex(0);
    setAiResponses(new Map());
    setSeatErrors({});
    setSeatErrorTitles({});
    requestedSpeakerRef.current = null;
  }, [gameState?.currentQuest, gameState?.consecutiveRejects]);

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

  // 当前应该发言的玩家
  const currentSpeaker = speakingOrder[currentSpeakerIndex];
  const isHumanTurn = currentSpeaker?.id === humanPlayerId;
  const allSpoken = currentSpeakerIndex >= players.length;

  // 收集之前的发言（用于给 AI 上下文）
  const getRecentSpeeches = (): Array<{ playerId: number; content: string }> => {
    const speeches: Array<{ playerId: number; content: string }> = [];
    for (let i = 0; i < currentSpeakerIndex; i++) {
      const speaker = speakingOrder[i];
      const content = aiResponses.get(speaker.id);
      if (content) {
        speeches.push({ playerId: speaker.id, content });
      }
    }
    return speeches;
  };

  const requestAISpeech = async (playerId: number) => {
    if (!gameState) return;

    requestedSpeakerRef.current = playerId;
    setIsProcessingAI(true);
    setSeatErrors(prev => {
      const next = { ...prev };
      delete next[playerId];
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
        }),
      });

      const data = await readAIResponse(response);
      if (typeof data.speech !== 'string') {
        throw new Error('AI discussion response must include speech as a string');
      }
      const speech = data.speech;

      setAiResponses(prev => new Map(prev).set(playerId, speech));
      addDiscussion(playerId, speech);

      await new Promise(resolve => setTimeout(resolve, 800 + Math.random() * 400));
      setCurrentSpeakerIndex(prev => prev + 1);
    } catch (error) {
      console.error('AI 发言错误:', error);
      const described = describeAIError(error);
      setSeatErrors(prev => ({ ...prev, [playerId]: described.message }));
      setSeatErrorTitles(prev => ({ ...prev, [playerId]: described.title }));
    } finally {
      setIsProcessingAI(false);
    }
  };

  // AI 自动发言
  useEffect(() => {
    if (!gameState) return;
    if (allSpoken || isHumanTurn || isProcessingAI) return;
    if (!currentSpeaker) return;
    if (requestedSpeakerRef.current === currentSpeaker.id) return;

    requestedSpeakerRef.current = currentSpeaker.id;

    // 延迟一下开始，避免过于突兀
    const timer = setTimeout(() => requestAISpeech(currentSpeaker.id), 500);
    return () => clearTimeout(timer);
  }, [currentSpeakerIndex, isHumanTurn, allSpoken, isProcessingAI]);

  if (!gameState || !leader) return null;

  // 人类发言提交
  const handleHumanSpeech = (content: string) => {
    // content 已经被 SecureSpeechInput 验证和清理过了
    setAiResponses(prev => new Map(prev).set(humanPlayerId, content));
    addDiscussion(humanPlayerId, content);
    setHasHumanSpoken(true);
    setCurrentSpeakerIndex(prev => prev + 1);
  };

  // 跳过发言
  const handleSkipSpeech = () => {
    const skipMessage = '[选择沉默]';
    setAiResponses(prev => new Map(prev).set(humanPlayerId, skipMessage));
    addDiscussion(humanPlayerId, skipMessage);
    setHasHumanSpoken(true);
    setCurrentSpeakerIndex(prev => prev + 1);
  };

  const handleRetryAISpeech = (playerId: number) => {
    requestedSpeakerRef.current = null;
    void requestAISpeech(playerId);
  };

  const handleSkipAISpeech = (playerId: number) => {
    const player = players.find(candidate => candidate.id === playerId);
    const modelName = player?.aiModel?.name || 'AI';
    setSeatErrors(prev => {
      const next = { ...prev };
      delete next[playerId];
      return next;
    });
    setAiResponses(prev => new Map(prev).set(playerId, ''));
    addDiscussion(playerId, '');
    addSystemEvent(`玩家${playerId}（${modelName}）的发言已跳过（AI 不可用）`);
    requestedSpeakerRef.current = null;
    setCurrentSpeakerIndex(prev => prev + 1);
  };

  // 结束发言阶段
  const handleEndDiscussion = () => {
    goToTeamBuilding();
  };

  return (
    <div className="space-y-4">
      {/* 标题 */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          <MessageCircle className="w-5 h-5" />
          发言讨论
        </h2>
        <div className="text-sm text-slate-400">
          任务 {currentQuest} · 第 {consecutiveRejects + 1} 次组队
        </div>
      </div>

      {/* 当前队长提示 */}
      <div className="p-3 bg-amber-900/30 rounded-lg border border-amber-700">
        <span className="text-amber-400">👑 队长：</span>
        <span className="text-white ml-2">
          玩家{leader.id} {leader.id === humanPlayerId ? '(你)' : `(${leader.aiModel?.name || 'AI'})`}
        </span>
      </div>

      {/* 发言记录 */}
      <div className="space-y-3 max-h-[300px] overflow-y-auto">
        {speakingOrder.slice(0, currentSpeakerIndex).map((player, index) => {
          const speech = aiResponses.get(player.id);
          const isHuman = player.id === humanPlayerId;

          return (
            <div
              key={player.id}
              className={`
                p-3 rounded-lg
                ${isHuman 
                  ? 'bg-blue-900/30 border border-blue-700' 
                  : 'bg-slate-700/50'
                }
              `}
            >
              <div className="flex items-center gap-2 mb-1">
                <span className="text-sm font-medium">
                  {isHuman ? '👤' : '🤖'} 玩家{player.id}
                </span>
                {!isHuman && (
                  <span className="text-xs text-slate-500">
                    ({player.aiModel?.name})
                  </span>
                )}
              </div>
              <p className="text-slate-300 text-sm">{speech || '...'}</p>
            </div>
          );
        })}
      </div>

      {/* 当前发言者指示 / 输入框 */}
      {!allSpoken && (
        <div className="p-4 bg-slate-800/50 rounded-lg border border-slate-600">
          {isHumanTurn && !hasHumanSpoken ? (
            <div className="space-y-3">
              <div className="text-amber-400 font-medium">
                🎤 轮到你发言了！
              </div>

              <SecureSpeechInput
                onSubmit={handleHumanSpeech}
                disabled={false}
                placeholder="说点什么来影响其他玩家的判断..."
              />

              <Button
                variant="ghost"
                size="sm"
                onClick={handleSkipSpeech}
                className="text-slate-500 hover:text-slate-300"
              >
                跳过发言（保持沉默）
              </Button>
            </div>
          ) : currentSpeaker && seatErrors[currentSpeaker.id] ? (
            <div title={seatErrorTitles[currentSpeaker.id]}>
              <AISeatError
                playerId={currentSpeaker.id}
                modelName={currentSpeaker.aiModel?.name}
                message={seatErrors[currentSpeaker.id]}
                onRetry={() => handleRetryAISpeech(currentSpeaker.id)}
                onSkip={() => handleSkipAISpeech(currentSpeaker.id)}
              />
            </div>
          ) : (
            <div className="flex items-center gap-3 text-slate-400">
              <Loader2 className="w-5 h-5 animate-spin" />
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
          {speakingOrder.map((player, i) => (
            <div
              key={player.id}
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
          ))}
        </div>
      </div>

      {/* 否决次数提示 */}
      {consecutiveRejects > 0 && (
        <div className="text-center text-yellow-400 text-sm">
          ⚠️ 连续否决: {consecutiveRejects}/5
        </div>
      )}

      {/* 发言结束，进入组队 */}
      {allSpoken && (
        <div className="text-center space-y-3">
          <p className="text-green-400">✓ 所有玩家发言完毕</p>
          <Button onClick={handleEndDiscussion} className="w-full">
            进入组队阶段 →
          </Button>
        </div>
      )}
    </div>
  );
}

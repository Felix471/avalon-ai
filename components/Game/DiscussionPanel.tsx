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
import AISeatStatus from './AISeatStatus';
import { describeAIError, readAIResponse, readLatency } from './aiResponse';
import { panelClass, panelHeadingClass } from './ui';
import { useT } from '@/lib/i18n';

// Inline validated speech input

interface SecureSpeechInputProps {
  onSubmit: (content: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

function SecureSpeechInput({
  onSubmit,
  disabled = false,
  placeholder,
}: SecureSpeechInputProps) {
  const t = useT();
  const [input, setInput] = useState('');
  const [warning, setWarning] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleInputChange = useCallback((value: string) => {
    setInput(value);
    setError(null);

    if (quickSuspicionCheck(value)) {
      setWarning(t('discussion.suspicious'));
    } else if (value.length > MAX_SPEECH_LENGTH * 0.8) {
      setWarning(t('discussion.nearLimit', { count: value.length, max: MAX_SPEECH_LENGTH }));
    } else {
      setWarning(null);
    }
  }, [t]);

  const handleSubmit = useCallback(() => {
    const validation = validateSpeechInput(input);

    if (!validation.isValid) {
      setError(t('discussion.invalid'));
      return;
    }

    setInput('');
    setWarning(null);
    setError(null);
    onSubmit(validation.sanitizedInput);
  }, [input, onSubmit, t]);

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
      <div className="relative">
        <Textarea
          value={input}
          onChange={(e) => handleInputChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder ?? t('discussion.inputPlaceholder')}
          disabled={disabled}
          className={`
            min-h-[100px] pr-16 resize-none bg-slate-800 border-slate-600 text-white
            placeholder:text-slate-500
            ${isOverLimit ? 'border-red-500 focus:ring-red-500' : ''}
            ${warning && !isOverLimit ? 'border-yellow-500 focus:ring-yellow-500' : ''}
          `}
        />

        <div className={`
          absolute bottom-2 right-2 text-xs
          ${isOverLimit ? 'text-red-400' : 'text-slate-500'}
        `}>
          {charCount}/{MAX_SPEECH_LENGTH}
        </div>
      </div>

      {warning && !error && (
        <div className="flex items-center gap-2 text-yellow-400 text-sm">
          <AlertTriangle aria-hidden="true" className="size-4 shrink-0" />
          <span>{warning}</span>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 text-red-400 text-sm bg-red-900/20 px-3 py-2 rounded">
          <AlertTriangle aria-hidden="true" className="size-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1 text-slate-500 text-xs">
          <Info aria-hidden="true" className="size-4" />
          <span>{t('discussion.shortcut')}</span>
        </div>

        <Button
          onClick={handleSubmit}
          disabled={disabled || isOverLimit || input.trim().length === 0}
          size="sm"
          className="gap-2"
        >
          <Send aria-hidden="true" className="size-4" />
          {t('discussion.speak')}
        </Button>
      </div>
    </div>
  );
}

// Discussion panel

export default function DiscussionPanel() {
  const t = useT();
  const {
    gameState,
    phaseProgress,
    ensurePhaseProgress,
    appendDiscussionSpeech,
    addDiscussion,
    addSystemEvent,
    nextDiscussionRound,
    goToTeamBuilding,
    setSeatStatus,
    clearSeatStatus,
  } = useGameStore();
  const [isProcessingAI, setIsProcessingAI] = useState(false);
  const requestedStepRef = useRef<number | null>(null);

  const phaseKey = getPhaseKey(gameState);
  const currentSpeakerIndex = phaseProgress.discussion.step;
  const speeches = phaseProgress.discussion.speeches;
  const progressIsCurrent = phaseProgress.key === phaseKey;

  useEffect(() => {
    ensurePhaseProgress();
    requestedStepRef.current = null;
  }, [phaseKey, ensurePhaseProgress]);

  const players = gameState?.players ?? [];
  const humanPlayerId = gameState?.humanPlayerId ?? -1;
  const currentLeaderIndex = gameState?.currentLeaderIndex ?? 0;
  const consecutiveRejects = gameState?.consecutiveRejects ?? 0;
  const currentQuest = gameState?.currentQuest ?? 0;
  const leader = gameState ? getCurrentLeader(gameState) : null;

  const speakingOrder = [
    ...players.slice(currentLeaderIndex),
    ...players.slice(0, currentLeaderIndex)
  ];

  const discussionRounds = gameState?.discussionRounds ?? DISCUSSION_ROUNDS;
  const totalSpeakingSteps = discussionRounds * players.length;
  const currentSpeaker = speakingOrder[currentSpeakerIndex % players.length];
  const isHumanTurn = currentSpeaker?.id === humanPlayerId;
  const allSpoken = currentSpeakerIndex >= totalSpeakingSteps;

  const getRecentSpeeches = (): Array<{ playerId: number; content: string }> => {
    return speeches
      .filter(speech => speech.step < currentSpeakerIndex)
      .map(({ playerId, content }) => ({ playerId, content }));
  };

  const completeSpeakingStep = (stepIndex: number, playerId: number, content: string) => {
    appendDiscussionSpeech(stepIndex, playerId, content);
    clearSeatStatus(playerId);
    if (stepIndex + 1 === players.length) {
      nextDiscussionRound();
    }
    requestedStepRef.current = null;
  };

  const requestAISpeech = async (playerId: number, stepIndex: number) => {
    if (!gameState) return;

    requestedStepRef.current = stepIndex;
    setIsProcessingAI(true);
    const player = players.find(candidate => candidate.id === playerId);
    const provider = player?.aiModel?.provider;
    const modelName = player?.aiModel?.name;
    setSeatStatus(playerId, {
      state: 'thinking',
      startedAt: Date.now(),
      provider,
      modelName,
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
      const latencyMs = readLatency(response);

      const data = await readAIResponse(response);
      if (typeof data.speech !== 'string') {
        throw new Error('AI discussion response must include speech as a string');
      }
      const speech = data.speech;

      if (!isMockResponse) {
        await new Promise(resolve => setTimeout(resolve, 800 + Math.random() * 400));
      }
      setSeatStatus(playerId, { state: 'done', latencyMs, provider, modelName });
      addDiscussion(playerId, speech);
      completeSpeakingStep(stepIndex, playerId, speech);
    } catch (error) {
      const described = describeAIError(error);
      setSeatStatus(playerId, {
        state: 'error',
        message: described.message,
        messageKey: described.messageKey,
        params: described.params,
        title: described.title,
        kind: described.kind,
        provider: described.provider ?? provider,
        modelName: described.model ?? modelName,
        latencyMs: described.latencyMs,
        retryAfterUntil: described.retryAfterSeconds === undefined
          ? undefined
          : Date.now() + described.retryAfterSeconds * 1000,
      });
    } finally {
      setIsProcessingAI(false);
    }
  };

  useEffect(() => {
    if (!gameState) return;
    if (!progressIsCurrent) return;
    if (allSpoken || isHumanTurn || isProcessingAI) return;
    if (!currentSpeaker) return;
    if (requestedStepRef.current === currentSpeakerIndex) return;

    requestedStepRef.current = currentSpeakerIndex;

    const timer = setTimeout(
      () => requestAISpeech(currentSpeaker.id, currentSpeakerIndex),
      500
    );
    return () => clearTimeout(timer);
  }, [currentSpeakerIndex, isHumanTurn, allSpoken, isProcessingAI, progressIsCurrent]);

  if (!gameState || !leader) return null;

  const handleHumanSpeech = (content: string) => {
    addDiscussion(humanPlayerId, content);
    completeSpeakingStep(currentSpeakerIndex, humanPlayerId, content);
  };

  const handleSkipSpeech = () => {
    const skipMessage = t('discussion.silent');
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
    setSeatStatus(playerId, { state: 'skipped', modelName });
    addDiscussion(playerId, '');
    addSystemEvent(`玩家${playerId}（${modelName}）的发言已跳过（AI 不可用）`);
    completeSpeakingStep(currentSpeakerIndex, playerId, '');
  };

  const handleEndDiscussion = () => {
    goToTeamBuilding();
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className={`${panelHeadingClass} text-xl`}>
          <MessageCircle aria-hidden="true" className="size-5" />
          {t('discussion.title')}
        </h2>
        <div className="text-sm text-slate-400 tabular-nums">
          {t('discussion.context', { quest: currentQuest, proposal: consecutiveRejects + 1 })}
        </div>
      </div>

      <div className="p-3 bg-amber-900/30 rounded-lg border border-amber-700">
        <span className="inline-flex items-center gap-1 text-amber-400">
          <Crown aria-hidden="true" className="size-4" />
          {t('discussion.leader')}
        </span>
        <span className="text-white ml-2">
          {t('player.label', { id: leader.id })} {leader.id === humanPlayerId ? `(${t('player.you')})` : `(${leader.aiModel?.name || t('common.ai')})`}
        </span>
      </div>

      <div className="min-h-0 max-h-[45vh] flex-1 space-y-3 overflow-y-auto">
        {Array.from({ length: Math.min(currentSpeakerIndex, totalSpeakingSteps) }, (_, index) => {
          const player = speakingOrder[index % players.length];
          const speech = speeches.find(entry => entry.step === index)?.content;
          const isHuman = player.id === humanPlayerId;
          const round = Math.floor(index / players.length) + 1;

          return (
            <div key={index} className="space-y-3">
              {index % players.length === 0 && (
                <div className="text-xs text-slate-500">{t('discussion.round', { round })}</div>
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
                    {t('player.label', { id: player.id })}
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

      {!allSpoken && (
        <div className={panelClass}>
          {isHumanTurn ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2 font-medium text-amber-400">
                <Mic aria-hidden="true" className="size-4" />
                {t('discussion.yourTurn')}
              </div>

              <SecureSpeechInput
                onSubmit={handleHumanSpeech}
                disabled={false}
                placeholder={t('discussion.persuadePlaceholder')}
              />

              <Button
                data-testid="discussion-skip"
                variant="ghost"
                size="sm"
                onClick={handleSkipSpeech}
                className="text-slate-500 hover:text-slate-300"
              >
                {t('discussion.skip')}
              </Button>
            </div>
          ) : currentSpeaker ? (
            <AISeatStatus
              playerId={currentSpeaker.id}
              onRetry={() => handleRetryAISpeech(currentSpeaker.id)}
              onSkip={() => handleSkipAISpeech(currentSpeaker.id)}
              skipHint={t('discussion.skipHint')}
            />
          ) : (
            null
          )}
        </div>
      )}

      <div className="flex items-center gap-2">
        <span className="text-sm text-slate-500">{t('discussion.progress')}</span>
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
                title={t('player.label', { id: player.id })}
              >
                {player.id}
              </div>
            );
          })}
        </div>
      </div>

      {consecutiveRejects > 0 && (
        <div className="flex items-center justify-center gap-1 text-center text-sm text-yellow-400 tabular-nums">
          <AlertTriangle aria-hidden="true" className="size-4" />
          {t('discussion.rejects', { count: consecutiveRejects })}
        </div>
      )}

      {allSpoken && (
        <div className="text-center space-y-3">
          <p className="flex items-center justify-center gap-1 text-green-400">
            <Check aria-hidden="true" className="size-4" />
            {t('discussion.complete')}
          </p>
          <Button data-testid="discussion-end" onClick={handleEndDiscussion} className="w-full">
            {t('discussion.toTeamBuilding')}
          </Button>
        </div>
      )}
    </div>
  );
}

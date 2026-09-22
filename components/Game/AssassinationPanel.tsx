'use client';

import { useState, useEffect } from 'react';
import { getPhaseKey, useGameStore } from '@/lib/game/store';
import { ROLES } from '@/lib/game/types';
import { Button } from '@/components/ui/button';
import { Bot, Swords, Target, User } from 'lucide-react';
import AISeatStatus from './AISeatStatus';
import { describeAIError, readAIResponse, readLatency } from './aiResponse';
import { panelHeadingClass } from './ui';

export default function AssassinationPanel() {
  const {
    gameState,
    phaseProgress,
    ensurePhaseProgress,
    setAssassinationProgress,
    assassinate,
    addSystemEvent,
    seatStatus,
    setSeatStatus,
  } = useGameStore();
  const [selectedTarget, setSelectedTarget] = useState<number | null>(null);
  const [isAIAssassinating, setIsAIAssassinating] = useState(false);

  const players = gameState?.players ?? [];
  const humanPlayerId = gameState?.humanPlayerId ?? -1;
  const assassin = players.find(p => p.role === 'assassin');
  const isHumanAssassin = assassin?.id === humanPlayerId;
  const goodPlayers = players.filter(p => p.role && ROLES[p.role].team === 'good');
  const phaseKey = getPhaseKey(gameState);
  const progressIsCurrent = phaseProgress.key === phaseKey;
  const { humanOverride } = phaseProgress.assassination;

  useEffect(() => {
    ensurePhaseProgress();
  }, [phaseKey, ensurePhaseProgress]);

  const requestAITarget = async (playerId: number) => {
    if (!gameState) return;

    setIsAIAssassinating(true);
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
          action: 'assassination',
          promptMode: gameState.promptMode,
          generation: gameState.generation,
        }),
      });

      const isMockResponse = response.headers.get('x-avalon-mock-ai') === '1';
      const latencyMs = readLatency(response);

      const data = await readAIResponse(response);
      if (
        typeof data.targetId !== 'number'
        || !Number.isInteger(data.targetId)
        || !goodPlayers.some(player => player.id === data.targetId)
      ) {
        throw new Error('AI assassination response must target a good player');
      }

      if (!isMockResponse) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
      setSeatStatus(playerId, { state: 'done', latencyMs, provider, modelName });
      assassinate(data.targetId);
    } catch (error) {
      const described = describeAIError(error);
      setSeatStatus(playerId, {
        state: 'error',
        message: described.message,
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
      setIsAIAssassinating(false);
    }
  };

  // AI刺客选择
  useEffect(() => {
    if (!gameState || !assassin || !progressIsCurrent || isHumanAssassin || humanOverride || seatStatus[assassin.id]?.state === 'error') return;

    const timer = setTimeout(() => requestAITarget(assassin.id), 1500);
    return () => clearTimeout(timer);
  }, [isHumanAssassin, assassin?.id, progressIsCurrent]);

  if (!gameState || !assassin) return null;

  const handleAssassinate = () => {
    if (selectedTarget) {
      assassinate(selectedTarget);
    }
  };

  const handleSkipAITarget = () => {
    if (!assassin) return;
    const modelName = assassin.aiModel?.name || 'AI';
    setSeatStatus(assassin.id, { state: 'skipped', modelName });
    setAssassinationProgress({ humanOverride: true });
    addSystemEvent(`刺客（${modelName}）不可用，由你代为选择刺杀目标`);
  };

  // AI刺客正在选择
  if (!isHumanAssassin && !humanOverride) {
    return (
      <div className="text-center space-y-4">
        <h2 className={`${panelHeadingClass} justify-center text-xl text-rose-400`}>
          <Swords aria-hidden="true" className="size-5" />
          刺杀阶段
        </h2>
        <div className="py-8">
          <p className="text-slate-300">
            好人完成了 3 个任务！
          </p>
          <p className="text-slate-300 mt-2">
            但刺客 <span className="text-rose-400">{assassin.name}</span> 有最后一次机会...
          </p>
          {(isAIAssassinating || seatStatus[assassin.id]?.state === 'error') && (
            <div className="mt-4 text-left">
              <AISeatStatus
                playerId={assassin.id}
                onRetry={() => void requestAITarget(assassin.id)}
                onSkip={handleSkipAITarget}
                skipLabel="由你选择"
                skipHint="由你选择目标"
              />
            </div>
          )}
        </div>
      </div>
    );
  }

  // 人类刺客选择
  return (
    <div className="space-y-4">
      <h2 className={`${panelHeadingClass} text-xl text-rose-400`}>
        <Swords aria-hidden="true" className="size-5" />
        你是刺客！
      </h2>

      <div className="rounded-lg border border-rose-800 bg-rose-900/20 p-4">
        <p className="text-slate-300 text-sm">
          好人完成了 3 个任务，但你有最后一次机会！
        </p>
        <p className="mt-2 text-sm text-rose-300">
          如果你能正确刺杀梅林，邪恶阵营将逆转获胜！
        </p>
      </div>

      <div className="space-y-2">
        <div className="text-slate-400 text-sm">选择你认为是梅林的玩家:</div>
        {goodPlayers.map(player => (
          <button
            key={player.id}
            data-testid={`assassinate-${player.id}`}
            onClick={() => setSelectedTarget(player.id)}
            className={`
              w-full flex items-center gap-3 p-3 rounded-lg transition-all text-left
              ${selectedTarget === player.id
                ? 'bg-rose-500/30 border-2 border-rose-500'
                : 'bg-slate-700/50 hover:bg-slate-700 border-2 border-transparent'
              }
            `}
          >
            <Target aria-hidden="true" className={`size-5 ${selectedTarget === player.id ? 'text-rose-400' : 'text-slate-500'}`} />
            {player.id === humanPlayerId ? (
              <User aria-hidden="true" className="size-4" />
            ) : (
              <Bot aria-hidden="true" className="size-4" />
            )}
            <div className="flex flex-col">
              <span className="text-white font-medium">
                {player.id === humanPlayerId ? '你' : `玩家${player.id}`}
              </span>
              <span className="text-xs text-slate-400">
                {player.id === humanPlayerId ? '人类玩家' : player.aiModel?.name || 'AI'}
              </span>
            </div>
          </button>
        ))}
      </div>

      <Button
        data-testid="assassinate-confirm"
        onClick={handleAssassinate}
        disabled={!selectedTarget}
        className="w-full bg-rose-600 hover:bg-rose-700 disabled:opacity-50"
      >
        <Target aria-hidden="true" className="mr-2 size-4" />
        确认刺杀
      </Button>
    </div>
  );
}

'use client';

import { useState, useEffect } from 'react';
import { getPhaseKey, useGameStore } from '@/lib/game/store';
import { ROLES } from '@/lib/game/types';
import { Button } from '@/components/ui/button';
import { Loader2, Target } from 'lucide-react';
import AISeatError from './AISeatError';
import { describeAIError, readAIResponse } from './aiResponse';

export default function AssassinationPanel() {
  const {
    gameState,
    phaseProgress,
    ensurePhaseProgress,
    setAssassinationProgress,
    assassinate,
    addSystemEvent,
  } = useGameStore();
  const [selectedTarget, setSelectedTarget] = useState<number | null>(null);
  const [isAIAssassinating, setIsAIAssassinating] = useState(false);
  const [seatErrors, setSeatErrors] = useState<Record<number, string>>({});
  const [seatErrorTitles, setSeatErrorTitles] = useState<Record<number, string>>({});

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
    setSeatErrors({});
    setSeatErrorTitles({});
  }, [phaseKey, ensurePhaseProgress]);

  const requestAITarget = async (playerId: number) => {
    if (!gameState) return;

    setIsAIAssassinating(true);
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
          action: 'assassination',
        }),
      });

      const data = await readAIResponse(response);
      if (
        typeof data.targetId !== 'number'
        || !Number.isInteger(data.targetId)
        || !goodPlayers.some(player => player.id === data.targetId)
      ) {
        throw new Error('AI assassination response must target a good player');
      }

      await new Promise(resolve => setTimeout(resolve, 2000));
      assassinate(data.targetId);
    } catch (error) {
      const described = describeAIError(error);
      setSeatErrors(prev => ({ ...prev, [playerId]: described.message }));
      setSeatErrorTitles(prev => ({ ...prev, [playerId]: described.title }));
    } finally {
      setIsAIAssassinating(false);
    }
  };

  // AI刺客选择
  useEffect(() => {
    if (!gameState || !assassin || !progressIsCurrent || isHumanAssassin || humanOverride || seatErrors[assassin.id]) return;

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
    setSeatErrors({});
    setAssassinationProgress({ humanOverride: true });
    addSystemEvent(`刺客（${modelName}）不可用，由你代为选择刺杀目标`);
  };

  // AI刺客正在选择
  if (!isHumanAssassin && !humanOverride) {
    return (
      <div className="text-center space-y-4">
        <h2 className="text-xl font-bold text-red-400">🗡️ 刺杀阶段</h2>
        <div className="py-8">
          <div className="text-6xl mb-4">⚔️</div>
          <p className="text-slate-300">
            好人完成了 3 个任务！
          </p>
          <p className="text-slate-300 mt-2">
            但刺客 <span className="text-red-400">{assassin.name}</span> 有最后一次机会...
          </p>
          {seatErrors[assassin.id] ? (
            <div className="mt-4 text-left" title={seatErrorTitles[assassin.id]}>
              <AISeatError
                playerId={assassin.id}
                modelName={assassin.aiModel?.name}
                message={seatErrors[assassin.id]}
                onRetry={() => void requestAITarget(assassin.id)}
                onSkip={handleSkipAITarget}
                skipLabel="由你选择"
              />
            </div>
          ) : isAIAssassinating && (
            <div className="mt-4">
              <Loader2 className="w-8 h-8 animate-spin text-red-400 mx-auto mb-2" />
              <p className="text-slate-400">正在选择刺杀目标...</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  // 人类刺客选择
  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold text-red-400">🗡️ 你是刺客！</h2>

      <div className="p-4 bg-red-900/20 rounded-lg border border-red-800">
        <p className="text-slate-300 text-sm">
          好人完成了 3 个任务，但你有最后一次机会！
        </p>
        <p className="text-red-300 text-sm mt-2">
          如果你能正确刺杀梅林，邪恶阵营将逆转获胜！
        </p>
      </div>

      <div className="space-y-2">
        <div className="text-slate-400 text-sm">选择你认为是梅林的玩家:</div>
        {goodPlayers.map(player => (
          <button
            key={player.id}
            onClick={() => setSelectedTarget(player.id)}
            className={`
              w-full flex items-center gap-3 p-3 rounded-lg transition-all text-left
              ${selectedTarget === player.id
                ? 'bg-red-500/30 border-2 border-red-500'
                : 'bg-slate-700/50 hover:bg-slate-700 border-2 border-transparent'
              }
            `}
          >
            <Target className={`w-5 h-5 ${selectedTarget === player.id ? 'text-red-400' : 'text-slate-500'}`} />
            <span className="text-xl">{player.id === humanPlayerId ? '👤' : '🤖'}</span>
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
        onClick={handleAssassinate}
        disabled={!selectedTarget}
        className="w-full bg-red-600 hover:bg-red-700 disabled:opacity-50"
      >
        <Target className="w-4 h-4 mr-2" />
        确认刺杀
      </Button>
    </div>
  );
}

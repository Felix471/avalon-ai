'use client';

import { useState, useEffect } from 'react';
import { useGameStore } from '@/lib/game/store';
import { isPlayerOnCurrentTeam, hasPlayerActed, getQuestTeamMembers } from '@/lib/game/engine';
import { ROLES } from '@/lib/game/types';
import { Button } from '@/components/ui/button';
import { Loader2, CheckCircle, XCircle } from 'lucide-react';
import AISeatError from './AISeatError';
import { describeAIError, readAIResponse } from './aiResponse';

export default function QuestPanel() {
  const { gameState, questAction, addSystemEvent } = useGameStore();
  const [seatErrors, setSeatErrors] = useState<Record<number, string>>({});
  const [seatErrorTitles, setSeatErrorTitles] = useState<Record<number, string>>({});
  const [isProcessingAI, setIsProcessingAI] = useState(false);
  const [retryVersion, setRetryVersion] = useState(0);

  const humanPlayerId = gameState?.humanPlayerId ?? -1;
  const currentQuest = gameState?.currentQuest ?? 0;
  const quest = gameState?.quests[currentQuest - 1];
  const teamMembers = gameState ? getQuestTeamMembers(gameState) : [];
  const humanOnTeam = gameState ? isPlayerOnCurrentTeam(gameState, humanPlayerId) : false;
  const humanHasActed = gameState ? hasPlayerActed(gameState, humanPlayerId) : false;
  const humanPlayer = gameState?.players.find(p => p.id === humanPlayerId);
  const humanIsEvil = humanPlayer?.role ? ROLES[humanPlayer.role].team === 'evil' : false;

  const requestAIQuestAction = async (playerId: number) => {
    if (!gameState) return false;

    setIsProcessingAI(true);
    setSeatErrors(prev => {
      const next = { ...prev };
      delete next[playerId];
      return next;
    });

    try {
      const member = gameState.players.find(player => player.id === playerId);
      if (!member?.role) {
        throw new Error(`Quest player ${playerId} does not have a valid role`);
      }

      const isEvil = ROLES[member.role].team === 'evil';
      let success = true;

      if (isEvil) {
        const response = await fetch('/api/ai', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            gameState,
            playerId,
            action: 'quest',
          }),
        });

        const data = await readAIResponse(response);
        if (typeof data.success !== 'boolean') {
          throw new Error('AI quest response must include success as a boolean');
        }
        success = data.success;
      }

      await new Promise(resolve => setTimeout(resolve, 500 + Math.random() * 500));
      questAction(playerId, success);
      return true;
    } catch (error) {
      const described = describeAIError(error);
      setSeatErrors(prev => ({ ...prev, [playerId]: described.message }));
      setSeatErrorTitles(prev => ({ ...prev, [playerId]: described.title }));
      return false;
    } finally {
      setIsProcessingAI(false);
    }
  };

  // AI执行任务
  useEffect(() => {
    if (!gameState || isProcessingAI) return;

    const submitAIActions = async () => {
      for (const member of teamMembers) {
        if (member.isHuman) continue;
        if (hasPlayerActed(gameState, member.id)) continue;
        if (seatErrors[member.id]) break;

        const succeeded = await requestAIQuestAction(member.id);
        if (!succeeded) break;
      }
    };

    const timer = setTimeout(submitAIActions, 800);
    return () => clearTimeout(timer);
  }, [teamMembers.length, gameState?.phase, retryVersion]);

  if (!gameState || !quest || !humanPlayer) return null;

  const handleAction = (success: boolean) => {
    questAction(humanPlayerId, success);
  };

  const handleRetryAIQuestAction = async (playerId: number) => {
    if (await requestAIQuestAction(playerId)) {
      setRetryVersion(version => version + 1);
    }
  };

  const handleSkipAIQuestAction = (playerId: number) => {
    const player = teamMembers.find(candidate => candidate.id === playerId);
    const modelName = player?.aiModel?.name || 'AI';
    setSeatErrors(prev => {
      const next = { ...prev };
      delete next[playerId];
      return next;
    });
    questAction(playerId, true);
    addSystemEvent(`玩家${playerId}（${modelName}）任务行动已跳过，按成功计`);
    setRetryVersion(version => version + 1);
  };

  // 统计已行动人数
  const actedCount = Object.keys(quest.actions || {}).length;

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold text-white">⚔️ 执行任务 {currentQuest}</h2>

      {/* 任务队员 */}
      <div className="p-4 bg-slate-700/50 rounded-lg">
        <div className="text-slate-400 text-sm mb-2">任务队伍:</div>
        <div className="flex flex-wrap gap-2">
          {teamMembers.map(player => {
            const acted = quest.actions?.[player.id] !== undefined;
            return (
              <span
                key={player.id}
                className={`
                  px-3 py-1 rounded-full text-sm font-medium flex items-center gap-1
                  ${acted 
                    ? 'bg-green-900/50 text-green-300' 
                    : 'bg-slate-600 text-white'
                  }
                `}
              >
                {player.id === humanPlayerId ? '👤' : '🤖'} {player.name}
                {acted && <CheckCircle className="w-3 h-3" />}
              </span>
            );
          })}
        </div>
      </div>

      {/* 人类行动 */}
      {humanOnTeam && !humanHasActed ? (
        <div className="space-y-3">
          <p className="text-slate-300 text-sm">
            你被选中执行任务。选择你的行动：
          </p>

          {humanIsEvil ? (
            // 坏人可以选择
            <div className="space-y-2">
              <Button
                onClick={() => handleAction(true)}
                className="w-full bg-blue-600 hover:bg-blue-700"
              >
                <CheckCircle className="w-4 h-4 mr-2" />
                任务成功（伪装好人）
              </Button>
              <Button
                onClick={() => handleAction(false)}
                className="w-full bg-red-600 hover:bg-red-700"
              >
                <XCircle className="w-4 h-4 mr-2" />
                任务失败（破坏任务）
              </Button>
              <p className="text-slate-500 text-xs text-center">
                ⚠️ 选择失败可能会暴露你的身份
              </p>
            </div>
          ) : (
            // 好人只能成功
            <div className="space-y-2">
              <Button
                onClick={() => handleAction(true)}
                className="w-full bg-blue-600 hover:bg-blue-700"
              >
                <CheckCircle className="w-4 h-4 mr-2" />
                任务成功
              </Button>
              <p className="text-slate-500 text-xs text-center">
                作为好人，你必须让任务成功
              </p>
            </div>
          )}
        </div>
      ) : humanOnTeam && humanHasActed ? (
        <div className="text-center py-2">
          <p className="text-green-400">✓ 你已完成行动</p>
        </div>
      ) : (
        <div className="text-center py-4 text-slate-400">
          你不在本次任务队伍中，等待结果...
        </div>
      )}

      {Object.keys(seatErrors).map(playerIdText => {
        const playerId = Number(playerIdText);
        const player = teamMembers.find(candidate => candidate.id === playerId);
        return (
          <div key={playerId} title={seatErrorTitles[playerId]}>
            <AISeatError
              playerId={playerId}
              modelName={player?.aiModel?.name}
              message={seatErrors[playerId]}
              onRetry={() => void handleRetryAIQuestAction(playerId)}
              onSkip={() => handleSkipAIQuestAction(playerId)}
            />
          </div>
        );
      })}

      {/* 进度 */}
      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-slate-400">行动进度</span>
          <span className="text-slate-300">{actedCount} / {teamMembers.length}</span>
        </div>
        <div className="w-full bg-slate-700 rounded-full h-2">
          <div
            className="bg-amber-500 h-2 rounded-full transition-all"
            style={{ width: `${(actedCount / teamMembers.length) * 100}%` }}
          />
        </div>
      </div>

      {quest.requiresDoubleFail && (
        <div className="text-center text-yellow-400 text-sm">
          ⚠️ 本任务需要 2 张失败票才会失败
        </div>
      )}

      {actedCount > 0 && actedCount < teamMembers.length && (
        <div className="text-center text-slate-400 text-sm">
          <Loader2 className="w-4 h-4 animate-spin inline mr-2" />
          等待其他队员行动...
        </div>
      )}
    </div>
  );
}

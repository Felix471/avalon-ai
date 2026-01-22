'use client';

import { useState, useEffect } from 'react';
import { useGameStore } from '@/lib/game/store';
import { isPlayerOnCurrentTeam, hasPlayerActed, getQuestTeamMembers } from '@/lib/game/engine';
import { ROLES } from '@/lib/game/types';
import { Button } from '@/components/ui/button';
import { Loader2, CheckCircle, XCircle } from 'lucide-react';

export default function QuestPanel() {
  const { gameState, questAction } = useGameStore();
  const [aiActionsSubmitted, setAiActionsSubmitted] = useState<Set<number>>(new Set());

  if (!gameState) return null;

  const { humanPlayerId, quests, currentQuest } = gameState;
  const quest = quests[currentQuest - 1];
  const teamMembers = getQuestTeamMembers(gameState);
  const humanOnTeam = isPlayerOnCurrentTeam(gameState, humanPlayerId);
  const humanHasActed = hasPlayerActed(gameState, humanPlayerId);
  const humanPlayer = gameState.players.find(p => p.id === humanPlayerId)!;
  const humanIsEvil = ROLES[humanPlayer.role!].team === 'evil';

  // AI执行任务
  useEffect(() => {
    const submitAIActions = async () => {
      for (const member of teamMembers) {
        if (member.isHuman) continue;
        if (aiActionsSubmitted.has(member.id)) continue;
        if (hasPlayerActed(gameState, member.id)) continue;

        try {
          const response = await fetch('/api/ai', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              gameState,
              playerId: member.id,
              action: 'quest',
            }),
          });

          const data = await response.json();
          const isEvil = ROLES[member.role!].team === 'evil';
          // 好人必须成功，坏人根据AI决定
          const success = isEvil ? (data.success ?? true) : true;

          await new Promise(resolve => setTimeout(resolve, 500 + Math.random() * 500));
          questAction(member.id, success);
          setAiActionsSubmitted(prev => new Set([...prev, member.id]));
        } catch (error) {
          console.error('AI Quest Error:', error);
          questAction(member.id, true); // fallback: 成功
          setAiActionsSubmitted(prev => new Set([...prev, member.id]));
        }
      }
    };

    const timer = setTimeout(submitAIActions, 800);
    return () => clearTimeout(timer);
  }, [teamMembers.length, gameState?.phase]);

  const handleAction = (success: boolean) => {
    questAction(humanPlayerId, success);
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
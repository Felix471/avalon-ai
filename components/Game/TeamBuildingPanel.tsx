'use client';

import { useState, useEffect } from 'react';
import { useGameStore } from '@/lib/game/store';
import { getCurrentLeader, isForcedTeamBuilding } from '@/lib/game/engine';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2 } from 'lucide-react';

export default function TeamBuildingPanel() {
  const { gameState, proposeTeam } = useGameStore();
  const [selectedPlayers, setSelectedPlayers] = useState<number[]>([]);
  const [isAISelecting, setIsAISelecting] = useState(false);

  if (!gameState) return null;

  const { players, humanPlayerId, currentQuest, consecutiveRejects } = gameState;
  const leader = getCurrentLeader(gameState);
  const quest = gameState.quests[currentQuest - 1];
  const requiredSize = quest.requiredPlayers;
  const isHumanLeader = leader.id === humanPlayerId;
  const isForced = isForcedTeamBuilding(gameState);

  // AI队长自动选队
  useEffect(() => {
    if (isHumanLeader || isAISelecting) return;

    const aiSelectTeam = async () => {
      setIsAISelecting(true);
      try {
        const response = await fetch('/api/ai', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            gameState,
            playerId: leader.id,
            action: 'team_building',
            requiredSize,
          }),
        });
        const data = await response.json();
        const team = data.team as number[];

        // 延迟一下再提交，让用户能看到
        await new Promise(resolve => setTimeout(resolve, 1000));
        proposeTeam(team);
      } catch (error) {
        console.error('AI Team Building Error:', error);
        // Fallback: 随机选
        const shuffled = [...players].sort(() => Math.random() - 0.5);
        const team = shuffled.slice(0, requiredSize).map(p => p.id);
        proposeTeam(team);
      } finally {
        setIsAISelecting(false);
      }
    };

    aiSelectTeam();
  }, [isHumanLeader, leader.id]);

  const togglePlayer = (playerId: number) => {
    if (selectedPlayers.includes(playerId)) {
      setSelectedPlayers(prev => prev.filter(id => id !== playerId));
    } else if (selectedPlayers.length < requiredSize) {
      setSelectedPlayers(prev => [...prev, playerId]);
    }
  };

  const handleSubmit = () => {
    if (selectedPlayers.length === requiredSize) {
      proposeTeam(selectedPlayers);
    }
  };

  // AI队长界面
  if (!isHumanLeader) {
    return (
      <div className="space-y-4">
        <h2 className="text-xl font-bold text-white">🎯 组建队伍</h2>

        {isForced && (
          <div className="p-3 bg-red-900/30 border border-red-500 rounded-lg">
            <p className="text-red-300 font-bold">⚠️ 强制发车！</p>
            <p className="text-slate-400 text-sm">第5次组队，队长直接指定队伍执行任务</p>
          </div>
        )}

        <div className="p-4 bg-slate-700/50 rounded-lg">
          <div className="flex items-center gap-3">
            <Loader2 className="w-6 h-6 animate-spin text-amber-400" />
            <div>
              <p className="text-white font-medium">玩家{leader.id} 正在选择队伍...</p>
              <p className="text-slate-400 text-sm">{leader.aiModel?.name || 'AI'}</p>
            </div>
          </div>
        </div>

        <div className="text-slate-400 text-sm text-center">
          需要选择 {requiredSize} 人执行任务
        </div>
      </div>
    );
  }

  // 人类队长界面
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-white">🎯 组建队伍</h2>
        <div className="text-xs text-slate-400 bg-slate-700/50 px-2 py-1 rounded">
          第{consecutiveRejects + 1}次组队
        </div>
      </div>

      {isForced && (
        <div className="p-3 bg-red-900/30 border border-red-500 rounded-lg">
          <p className="text-red-300 font-bold">⚠️ 强制发车！</p>
          <p className="text-slate-400 text-sm">第5次组队，你可以直接指定队伍执行任务，无需投票</p>
        </div>
      )}

      <div className="p-3 bg-amber-500/20 border border-amber-500/50 rounded-lg">
        <p className="text-amber-300">
          👑 你是本轮队长！选择 <span className="font-bold">{requiredSize}</span> 名队员
        </p>
      </div>

      {/* 玩家选择列表 */}
      <div className="grid grid-cols-2 gap-2">
        {players.map(player => {
          const isHuman = player.id === humanPlayerId;
          const isSelected = selectedPlayers.includes(player.id);
          const isDisabled = !isSelected && selectedPlayers.length >= requiredSize;

          return (
            <label
              key={player.id}
              className={`
                flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-all text-sm
                ${isSelected 
                  ? 'bg-amber-500/30 border-2 border-amber-500' 
                  : isDisabled
                    ? 'bg-slate-800/50 opacity-50 cursor-not-allowed border-2 border-transparent'
                    : 'bg-slate-700/50 hover:bg-slate-700 border-2 border-transparent'
                }
              `}
            >
              <Checkbox
                checked={isSelected}
                onCheckedChange={() => !isDisabled && togglePlayer(player.id)}
                disabled={isDisabled}
                className="border-slate-500"
              />
              <span className={`font-medium ${isHuman ? 'text-amber-300' : 'text-white'}`}>
                {isHuman ? '👤' : '🤖'} 玩家{player.id}
              </span>
            </label>
          );
        })}
      </div>

      {/* 已选计数 */}
      <div className="text-center text-slate-400 text-sm">
        已选择 {selectedPlayers.length} / {requiredSize}
      </div>

      <Button
        onClick={handleSubmit}
        disabled={selectedPlayers.length !== requiredSize}
        className="w-full bg-amber-500 hover:bg-amber-600 disabled:opacity-50"
      >
        {isForced ? '确认队伍，直接执行任务' : '确认队伍，开始投票'}
      </Button>
    </div>
  );
}
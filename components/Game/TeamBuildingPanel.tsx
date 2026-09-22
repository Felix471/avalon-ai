'use client';

import { useState, useEffect } from 'react';
import { getPhaseKey, useGameStore } from '@/lib/game/store';
import { getCurrentLeader, isForcedTeamBuilding } from '@/lib/game/engine';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { AlertTriangle, Bot, Crown, Loader2, Target, User } from 'lucide-react';
import AISeatError from './AISeatError';
import { describeAIError, readAIResponse } from './aiResponse';
import { panelClass, panelHeadingClass } from './ui';

export default function TeamBuildingPanel() {
  const {
    gameState,
    phaseProgress,
    ensurePhaseProgress,
    setTeamBuildingProgress,
    proposeTeam,
    addSystemEvent,
  } = useGameStore();
  const [isAISelecting, setIsAISelecting] = useState(false);
  const [seatErrors, setSeatErrors] = useState<Record<number, string>>({});
  const [seatErrorTitles, setSeatErrorTitles] = useState<Record<number, string>>({});

  const players = gameState?.players ?? [];
  const humanPlayerId = gameState?.humanPlayerId ?? -1;
  const currentQuest = gameState?.currentQuest ?? 0;
  const consecutiveRejects = gameState?.consecutiveRejects ?? 0;
  const leader = gameState ? getCurrentLeader(gameState) : null;
  const quest = gameState?.quests[currentQuest - 1];
  const requiredSize = quest?.requiredPlayers ?? 0;
  const isHumanLeader = leader?.id === humanPlayerId;
  const isForced = gameState ? isForcedTeamBuilding(gameState) : false;
  const phaseKey = getPhaseKey(gameState);
  const progressIsCurrent = phaseProgress.key === phaseKey;
  const { humanOverride, selectedPlayers } = phaseProgress.teamBuilding;

  useEffect(() => {
    ensurePhaseProgress();
    setSeatErrors({});
    setSeatErrorTitles({});
  }, [phaseKey, ensurePhaseProgress]);

  const requestAITeam = async (playerId: number) => {
    if (!gameState) return;

    setIsAISelecting(true);
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
          action: 'team_building',
          promptMode: gameState.promptMode,
          generation: gameState.generation,
        }),
      });
      const isMockResponse = response.headers.get('x-avalon-mock-ai') === '1';
      const data = await readAIResponse(response);
      const validPlayerIds = new Set(players.map(player => player.id));
      const team = data.team;

      if (
        !Array.isArray(team)
        || team.length !== requiredSize
        || !team.every(id => Number.isInteger(id) && validPlayerIds.has(id))
        || new Set(team).size !== team.length
      ) {
        throw new Error(`AI team response must contain ${requiredSize} unique valid player ids`);
      }

      if (!isMockResponse) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      proposeTeam(team);
    } catch (error) {
      const described = describeAIError(error);
      setSeatErrors(prev => ({ ...prev, [playerId]: described.message }));
      setSeatErrorTitles(prev => ({ ...prev, [playerId]: described.title }));
    } finally {
      setIsAISelecting(false);
    }
  };

  // AI队长自动选队
  useEffect(() => {
    if (!gameState || !leader || !progressIsCurrent || isHumanLeader || humanOverride || isAISelecting || seatErrors[leader.id]) return;

    requestAITeam(leader.id);
  }, [isHumanLeader, leader?.id, progressIsCurrent]);

  if (!gameState || !leader || !quest) return null;

  const togglePlayer = (playerId: number) => {
    if (selectedPlayers.includes(playerId)) {
      setTeamBuildingProgress({
        selectedPlayers: selectedPlayers.filter(id => id !== playerId),
      });
    } else if (selectedPlayers.length < requiredSize) {
      setTeamBuildingProgress({ selectedPlayers: [...selectedPlayers, playerId] });
    }
  };

  const handleSubmit = () => {
    if (selectedPlayers.length === requiredSize) {
      proposeTeam(selectedPlayers);
    }
  };

  const handleSkipAITeam = () => {
    if (!leader) return;
    const modelName = leader.aiModel?.name || 'AI';
    setSeatErrors({});
    setTeamBuildingProgress({ humanOverride: true });
    addSystemEvent(`队长 玩家${leader.id}（${modelName}）不可用，由你代为组队`);
  };

  // AI队长界面
  if (!isHumanLeader && !humanOverride) {
    return (
      <div className="space-y-4">
        <h2 className={`${panelHeadingClass} text-xl`}>
          <Target aria-hidden="true" className="size-5" />
          组建队伍
        </h2>

        {isForced && (
          <div className="p-3 bg-red-900/30 border border-red-500 rounded-lg">
            <p className="flex items-center gap-1 font-bold text-rose-300">
              <AlertTriangle aria-hidden="true" className="size-4" />
              强制发车！
            </p>
            <p className="text-slate-400 text-sm">第5次组队，队长直接指定队伍执行任务</p>
          </div>
        )}

        {seatErrors[leader.id] ? (
          <div title={seatErrorTitles[leader.id]}>
            <AISeatError
              playerId={leader.id}
              modelName={leader.aiModel?.name}
              message={seatErrors[leader.id]}
              onRetry={() => void requestAITeam(leader.id)}
              onSkip={handleSkipAITeam}
              skipLabel="由你组队"
            />
          </div>
        ) : (
          <div className={panelClass}>
            <div className="flex items-center gap-3">
              <Loader2 aria-hidden="true" className="size-5 animate-spin text-amber-400" />
              <div>
                <p className="text-white font-medium">玩家{leader.id} 正在选择队伍...</p>
                <p className="text-slate-400 text-sm">{leader.aiModel?.name || 'AI'}</p>
              </div>
            </div>
          </div>
        )}

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
        <h2 className={`${panelHeadingClass} text-xl`}>
          <Target aria-hidden="true" className="size-5" />
          组建队伍
        </h2>
        <div className="rounded bg-slate-700/50 px-2 py-1 text-xs text-slate-400 tabular-nums">
          第{consecutiveRejects + 1}次组队
        </div>
      </div>

      {isForced && (
        <div className="p-3 bg-red-900/30 border border-red-500 rounded-lg">
          <p className="flex items-center gap-1 font-bold text-rose-300">
            <AlertTriangle aria-hidden="true" className="size-4" />
            强制发车！
          </p>
          <p className="text-slate-400 text-sm">第5次组队，你可以直接指定队伍执行任务，无需投票</p>
        </div>
      )}

      <div className="p-3 bg-amber-500/20 border border-amber-500/50 rounded-lg">
        <p className="flex items-center gap-1 text-amber-300">
          <Crown aria-hidden="true" className="size-4" />
          <span>你是本轮队长！选择 <span className="font-bold tabular-nums">{requiredSize}</span> 名队员</span>
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
              data-testid={`team-pick-${player.id}`}
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
              <span className={`flex items-center gap-1 font-medium ${isHuman ? 'text-amber-300' : 'text-white'}`}>
                {isHuman ? (
                  <User aria-hidden="true" className="size-4" />
                ) : (
                  <Bot aria-hidden="true" className="size-4" />
                )}
                玩家{player.id}
              </span>
            </label>
          );
        })}
      </div>

      {/* 已选计数 */}
      <div className="text-center text-sm text-slate-400 tabular-nums">
        已选择 {selectedPlayers.length} / {requiredSize}
      </div>

      <Button
        data-testid="team-confirm"
        onClick={handleSubmit}
        disabled={selectedPlayers.length !== requiredSize}
        className="w-full bg-amber-500 hover:bg-amber-600 disabled:opacity-50"
      >
        {isForced ? '确认队伍，直接执行任务' : '确认队伍，开始投票'}
      </Button>
    </div>
  );
}

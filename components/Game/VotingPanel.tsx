'use client';

import { useState, useEffect } from 'react';
import { useGameStore } from '@/lib/game/store';
import { Button } from '@/components/ui/button';
import { Loader2, ThumbsUp, ThumbsDown, Eye, EyeOff } from 'lucide-react';
import { readAIResponse } from './aiResponse';

export default function VotingPanel() {
  const {
    gameState,
    pendingVotes,
    addPendingVote,
    revealAllVotes
  } = useGameStore();

  const [hasHumanVoted, setHasHumanVoted] = useState(false);
  const [isRevealing, setIsRevealing] = useState(false);
  const [aiVotesStarted, setAiVotesStarted] = useState(false);

  const players = gameState?.players ?? [];
  const humanPlayerId = gameState?.humanPlayerId ?? -1;
  const currentProposedTeam = gameState?.currentProposedTeam;
  const currentVotes = gameState?.currentVotes;
  const consecutiveRejects = gameState?.consecutiveRejects ?? 0;
  const currentQuest = gameState?.currentQuest ?? 0;
  const teamPlayers = currentProposedTeam?.map(id => players.find(p => p.id === id)!) || [];

  // 人类玩家是否在本次提议的队伍中
  const humanIsOnTeam = currentProposedTeam?.includes(humanPlayerId) || false;

  // 检查所有人是否都已投票
  const allVotesCollected = Object.keys(pendingVotes).length === players.length;

  // 如果已经有 currentVotes，说明已经 reveal 了
  const votesRevealed = Boolean(currentVotes && Object.keys(currentVotes).length > 0);

  const requestAIVote = async (playerId: number) => {
    if (!gameState) return;

    try {
      const response = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gameState,
          playerId,
          action: 'voting',
        }),
      });

      const data = await readAIResponse(response);
      if (typeof data.approve !== 'boolean') {
        throw new Error('AI voting response must include approve as a boolean');
      }

      addPendingVote(playerId, data.approve);
      await new Promise(resolve => setTimeout(resolve, 200 + Math.random() * 300));
    } catch (error) {
      console.error('AI Vote Error:', error);
    }
  };

  // AI投票逻辑
  useEffect(() => {
    if (!gameState || !hasHumanVoted || aiVotesStarted || allVotesCollected) return;

    setAiVotesStarted(true);

    const collectAIVotes = async () => {
      for (const player of players) {
        if (player.isHuman) continue;
        if (pendingVotes[player.id] !== undefined) continue;

        await requestAIVote(player.id);
      }
    };

    collectAIVotes();
  }, [hasHumanVoted, aiVotesStarted, allVotesCollected]);

  // 所有票收集完毕，自动 reveal
  useEffect(() => {
    if (!gameState) return;

    if (allVotesCollected && !votesRevealed && !isRevealing) {
      setIsRevealing(true);
      setTimeout(() => {
        revealAllVotes();
      }, 1000);
    }
  }, [allVotesCollected, votesRevealed, isRevealing]);

  if (!gameState) return null;

  const handleVote = (approve: boolean) => {
    addPendingVote(humanPlayerId, approve);
    setHasHumanVoted(true);
  };

  // 统计投票结果
  const getVoteStats = () => {
    const votes = votesRevealed ? currentVotes : pendingVotes;
    const voteEntries = Object.entries(votes || {});
    const approveCount = voteEntries.filter(([, v]) => v).length;
    const rejectCount = voteEntries.filter(([, v]) => !v).length;
    return { approveCount, rejectCount, total: voteEntries.length };
  };

  const { approveCount, rejectCount, total } = getVoteStats();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-white">🗳️ 队伍投票</h2>
        <div className="text-xs text-slate-400 bg-slate-700/50 px-2 py-1 rounded">
          任务{currentQuest} · 第{consecutiveRejects + 1}次投票
        </div>
      </div>

      {/* 提议的队伍 */}
      <div className="p-3 bg-slate-700/50 rounded-lg">
        <div className="text-slate-400 text-xs mb-2">提议的队伍:</div>
        <div className="flex flex-wrap gap-2">
          {teamPlayers.map(player => {
            const isHuman = player.id === humanPlayerId;
            return (
              <span
                key={player.id}
                className={`
                  px-2 py-1 rounded-full text-sm font-medium
                  ${isHuman 
                    ? 'bg-amber-500/30 text-amber-300 border border-amber-500' 
                    : 'bg-slate-600 text-white'
                  }
                `}
              >
                {isHuman ? '👤' : '🤖'} 玩家{player.id}
              </span>
            );
          })}
        </div>

        {humanIsOnTeam && (
          <p className="text-amber-400 text-xs mt-2">
            ⚠️ 你在这个队伍中，但你仍然可以自由投票
          </p>
        )}
      </div>

      {/* 人类投票 */}
      {!hasHumanVoted ? (
        <div className="space-y-3">
          <p className="text-slate-300 text-sm">
            你同意这个队伍执行任务吗？
          </p>
          <div className="flex gap-3">
            <Button
              onClick={() => handleVote(true)}
              className="flex-1 bg-green-600 hover:bg-green-700"
            >
              <ThumbsUp className="w-4 h-4 mr-2" />
              同意
            </Button>
            <Button
              onClick={() => handleVote(false)}
              className="flex-1 bg-red-600 hover:bg-red-700"
            >
              <ThumbsDown className="w-4 h-4 mr-2" />
              反对
            </Button>
          </div>
        </div>
      ) : !votesRevealed ? (
        <div className="text-center py-2 space-y-2">
          <p className="text-green-400">✓ 你已投票</p>
          <p className="text-slate-400 text-sm">等待其他玩家投票...</p>
        </div>
      ) : null}

      {/* 投票状态列表 */}
      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-slate-400">投票进度</span>
          <span className="text-slate-300">{total} / {players.length}</span>
        </div>

        <div className="grid grid-cols-2 gap-2">
          {players.map(player => {
            const isHuman = player.id === humanPlayerId;
            const hasPendingVote = pendingVotes[player.id] !== undefined;
            const revealedVote = currentVotes?.[player.id];

            return (
              <div
                key={player.id}
                className={`
                  flex items-center gap-2 p-2 rounded-lg text-xs
                  ${votesRevealed 
                    ? revealedVote 
                      ? 'bg-green-900/30 border border-green-700'
                      : 'bg-red-900/30 border border-red-700'
                    : hasPendingVote
                      ? 'bg-slate-700/50 border border-slate-600'
                      : 'bg-slate-800/50'
                  }
                `}
              >
                <span>{isHuman ? '👤' : '🤖'}</span>
                <span className={`truncate ${isHuman ? 'text-amber-300' : 'text-white'}`}>
                  玩家{player.id}
                </span>

                {votesRevealed ? (
                  revealedVote ? (
                    <ThumbsUp className="w-3 h-3 text-green-400 ml-auto" />
                  ) : (
                    <ThumbsDown className="w-3 h-3 text-red-400 ml-auto" />
                  )
                ) : hasPendingVote ? (
                  <EyeOff className="w-3 h-3 text-slate-400 ml-auto" />
                ) : (
                  <Loader2 className="w-3 h-3 animate-spin text-slate-500 ml-auto" />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* 亮票动画 */}
      {isRevealing && !votesRevealed && (
        <div className="text-center py-4 animate-pulse">
          <Eye className="w-8 h-8 text-amber-400 mx-auto mb-2" />
          <p className="text-amber-400 font-bold">亮票中...</p>
        </div>
      )}

      {/* 投票结果 */}
      {votesRevealed && (
        <div className="p-4 bg-slate-700/30 rounded-lg text-center">
          <div className="flex justify-center gap-8 text-lg font-bold mb-2">
            <span className="text-green-400">👍 {approveCount}</span>
            <span className="text-red-400">👎 {rejectCount}</span>
          </div>
          <p className={`text-sm ${approveCount > rejectCount ? 'text-green-400' : 'text-red-400'}`}>
            {approveCount > rejectCount
              ? '✓ 投票通过！准备执行任务'
              : '✗ 投票否决！换下一位队长'}
          </p>
        </div>
      )}
    </div>
  );
}

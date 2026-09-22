'use client';

import { useState, useEffect } from 'react';
import { useGameStore } from '@/lib/game/store';
import { Button } from '@/components/ui/button';
import { AlertTriangle, Bot, Check, Eye, EyeOff, Loader2, ThumbsDown, ThumbsUp, User, Vote, X } from 'lucide-react';
import AISeatError from './AISeatError';
import { describeAIError, readAIResponse } from './aiResponse';
import { chipClass, panelHeadingClass } from './ui';

export default function VotingPanel() {
  const {
    gameState,
    pendingVotes,
    addPendingVote,
    addSystemEvent,
    revealAllVotes
  } = useGameStore();

  const [isRevealing, setIsRevealing] = useState(false);
  const [aiVotesStarted, setAiVotesStarted] = useState(false);
  const [seatErrors, setSeatErrors] = useState<Record<number, string>>({});
  const [seatErrorTitles, setSeatErrorTitles] = useState<Record<number, string>>({});

  const players = gameState?.players ?? [];
  const humanPlayerId = gameState?.humanPlayerId ?? -1;
  const hasHumanVoted = pendingVotes[humanPlayerId] !== undefined;
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
    if (!gameState) return false;

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
          action: 'voting',
          promptMode: gameState.promptMode,
          generation: gameState.generation,
        }),
      });

      const isMockResponse = response.headers.get('x-avalon-mock-ai') === '1';

      const data = await readAIResponse(response);
      if (typeof data.approve !== 'boolean') {
        throw new Error('AI voting response must include approve as a boolean');
      }

      addPendingVote(playerId, data.approve);
      if (!isMockResponse) {
        await new Promise(resolve => setTimeout(resolve, 200 + Math.random() * 300));
      }
      return true;
    } catch (error) {
      const described = describeAIError(error);
      setSeatErrors(prev => ({ ...prev, [playerId]: described.message }));
      setSeatErrorTitles(prev => ({ ...prev, [playerId]: described.title }));
      return false;
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

        const succeeded = await requestAIVote(player.id);
        if (!succeeded) break;
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
  };

  const handleRetryAIVote = async (playerId: number) => {
    if (await requestAIVote(playerId)) {
      setAiVotesStarted(false);
    }
  };

  const handleSkipAIVote = (playerId: number) => {
    const player = players.find(candidate => candidate.id === playerId);
    const modelName = player?.aiModel?.name || 'AI';
    setSeatErrors(prev => {
      const next = { ...prev };
      delete next[playerId];
      return next;
    });
    addPendingVote(playerId, false);
    addSystemEvent(`玩家${playerId}（${modelName}）投票已跳过，按反对计`);
    setAiVotesStarted(false);
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
        <h2 className={`${panelHeadingClass} text-xl`}>
          <Vote aria-hidden="true" className="size-5" />
          队伍投票
        </h2>
        <div className="rounded bg-slate-700/50 px-2 py-1 text-xs text-slate-400 tabular-nums">
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
                  ${chipClass} py-1 text-sm font-medium
                  ${isHuman 
                    ? 'bg-amber-500/30 text-amber-300 border border-amber-500' 
                    : 'bg-slate-600 text-white'
                  }
                `}
              >
                {isHuman ? (
                  <User aria-hidden="true" className="size-4" />
                ) : (
                  <Bot aria-hidden="true" className="size-4" />
                )}
                玩家{player.id}
              </span>
            );
          })}
        </div>

        {humanIsOnTeam && (
          <p className="mt-2 flex items-center gap-1 text-xs text-amber-400">
            <AlertTriangle aria-hidden="true" className="size-4" />
            你在这个队伍中，但你仍然可以自由投票
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
              data-testid="vote-approve"
              onClick={() => handleVote(true)}
              className="flex-1 bg-green-600 hover:bg-green-700"
            >
              <ThumbsUp aria-hidden="true" className="mr-2 size-4" />
              同意
            </Button>
            <Button
              data-testid="vote-reject"
              onClick={() => handleVote(false)}
              className="flex-1 bg-red-600 hover:bg-red-700"
            >
              <ThumbsDown aria-hidden="true" className="mr-2 size-4" />
              反对
            </Button>
          </div>
        </div>
      ) : !votesRevealed ? (
        <div className="text-center py-2 space-y-2">
          <p className="flex items-center justify-center gap-1 text-green-400">
            <Check aria-hidden="true" className="size-4" />
            你已投票
          </p>
          <p className="text-slate-400 text-sm">等待其他玩家投票...</p>
        </div>
      ) : null}

      {/* 投票状态列表 */}
      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-slate-400">投票进度</span>
          <span className="text-slate-300 tabular-nums">{total} / {players.length}</span>
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
                {isHuman ? (
                  <User aria-hidden="true" className="size-4" />
                ) : (
                  <Bot aria-hidden="true" className="size-4" />
                )}
                <span className={`truncate ${isHuman ? 'text-amber-300' : 'text-white'}`}>
                  玩家{player.id}
                </span>

                {votesRevealed ? (
                  revealedVote ? (
                    <ThumbsUp aria-hidden="true" className="ml-auto size-4 text-green-400" />
                  ) : (
                    <ThumbsDown aria-hidden="true" className="ml-auto size-4 text-rose-400" />
                  )
                ) : hasPendingVote ? (
                  <EyeOff aria-hidden="true" className="ml-auto size-4 text-slate-400" />
                ) : (
                  <Loader2 aria-hidden="true" className="ml-auto size-4 animate-spin text-slate-500" />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {Object.keys(seatErrors).map(playerIdText => {
        const playerId = Number(playerIdText);
        const player = players.find(candidate => candidate.id === playerId);
        return (
          <div key={playerId} title={seatErrorTitles[playerId]}>
            <AISeatError
              playerId={playerId}
              modelName={player?.aiModel?.name}
              message={seatErrors[playerId]}
              onRetry={() => void handleRetryAIVote(playerId)}
              onSkip={() => handleSkipAIVote(playerId)}
            />
          </div>
        );
      })}

      {/* 亮票动画 */}
      {isRevealing && !votesRevealed && (
        <div className="text-center py-4 animate-pulse">
          <Eye aria-hidden="true" className="mx-auto mb-2 size-5 text-amber-400" />
          <p className="text-amber-400 font-bold">亮票中...</p>
        </div>
      )}

      {/* 投票结果 */}
      {votesRevealed && (
        <div className="p-4 bg-slate-700/30 rounded-lg text-center">
          <div className="mb-2 flex justify-center gap-8 text-lg font-bold tabular-nums">
            <span className="flex items-center gap-1 text-green-400">
              <ThumbsUp aria-hidden="true" className="size-4" />
              {approveCount}
            </span>
            <span className="flex items-center gap-1 text-rose-400">
              <ThumbsDown aria-hidden="true" className="size-4" />
              {rejectCount}
            </span>
          </div>
          <p className={`flex items-center justify-center gap-1 text-sm ${approveCount > rejectCount ? 'text-green-400' : 'text-rose-400'}`}>
            {approveCount > rejectCount ? (
              <><Check aria-hidden="true" className="size-4" />投票通过！准备执行任务</>
            ) : (
              <><X aria-hidden="true" className="size-4" />投票否决！换下一位队长</>
            )}
          </p>
        </div>
      )}
    </div>
  );
}

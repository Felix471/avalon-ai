'use client';

import { useState } from 'react';
import { useGameStore } from '@/lib/game/store';
import { Check, ChevronDown, ChevronUp, ScrollText, ThumbsDown, ThumbsUp, X } from 'lucide-react';
import { chipClass, panelClass, panelHeadingClass, subtleTextClass } from './ui';

export default function HistoryPanel() {
  const { gameState } = useGameStore();
  const [expandedQuest, setExpandedQuest] = useState<number | null>(null);

  if (!gameState) return null;

  // 从事件中提取所有投票历史
  // 每个 team_proposal 事件后面会有对应的投票事件
  const voteHistory: Array<{
    questNumber: number;
    voteRound: number;
    leaderId: number;
    team: number[];
    votes: Record<number, boolean>;
    passed: boolean;
  }> = [];

  const currentQuestVoteCount: Record<number, number> = {};

  gameState.events.forEach((event, index) => {
    if (event.type === 'team_proposal') {
      const questNum = gameState.events.slice(0, index).filter(e => e.type === 'quest_result').length + 1;
      currentQuestVoteCount[questNum] = (currentQuestVoteCount[questNum] || 0) + 1;

      // 找到这次提议对应的投票结果
      const team = Array.isArray(event.metadata?.team) ? (event.metadata.team as number[]) : [];
      const leaderId = event.playerId || 0;

      // 查找后续的投票事件，直到下一个 team_proposal 或 quest_result
      const votesForThisProposal: Record<number, boolean> = {};
      let voteResultFound = false;

      for (let i = index + 1; i < gameState.events.length; i++) {
        const nextEvent = gameState.events[i];
        if (nextEvent.type === 'team_proposal' || nextEvent.type === 'quest_result') {
          break;
        }
        if (nextEvent.type === 'vote' && nextEvent.playerId !== undefined) {
          votesForThisProposal[nextEvent.playerId] = nextEvent.content === '同意';
          voteResultFound = true;
        }
      }

      // 只有当有投票记录时才添加
      if (voteResultFound || Object.keys(votesForThisProposal).length > 0) {
        const approveCount = Object.values(votesForThisProposal).filter(v => v).length;
        const totalVotes = Object.keys(votesForThisProposal).length;

        voteHistory.push({
          questNumber: questNum,
          voteRound: currentQuestVoteCount[questNum],
          leaderId,
          team,
          votes: votesForThisProposal,
          passed: approveCount > totalVotes / 2,
        });
      }
    }
  });

  // 按任务分组
  const groupedByQuest: Record<number, typeof voteHistory> = {};
  voteHistory.forEach(vote => {
    if (!groupedByQuest[vote.questNumber]) {
      groupedByQuest[vote.questNumber] = [];
    }
    groupedByQuest[vote.questNumber].push(vote);
  });

  // 获取任务结果
  const getQuestResult = (questNum: number) => {
    const quest = gameState.quests[questNum - 1];
    return quest?.result;
  };

  const toggleQuest = (questNum: number) => {
    setExpandedQuest(expandedQuest === questNum ? null : questNum);
  };

  if (Object.keys(groupedByQuest).length === 0) {
    return (
      <div className={panelClass}>
        <h3 className={panelHeadingClass}>
          <ScrollText aria-hidden="true" className="size-5" />
          历史记录
        </h3>
        <p className={`${subtleTextClass} mt-2 text-slate-500`}>暂无投票历史</p>
      </div>
    );
  }

  return (
    <div className={`${panelClass} max-h-[45vh] overflow-y-auto`}>
      <h3 className={`${panelHeadingClass} mb-3`}>
        <ScrollText aria-hidden="true" className="size-5" />
        历史记录
      </h3>

      <div className="space-y-3">
        {Object.entries(groupedByQuest).map(([questNumStr, votes]) => {
          const questNum = parseInt(questNumStr);
          const questResult = getQuestResult(questNum);
          const isExpanded = expandedQuest === questNum;

          return (
            <div key={questNum} className="border border-slate-600 rounded-lg overflow-hidden">
              {/* 任务标题栏 */}
              <button
                onClick={() => toggleQuest(questNum)}
                className="w-full px-3 py-2 bg-slate-700/50 flex items-center justify-between hover:bg-slate-700 transition-colors"
              >
                <div className="flex items-center gap-2 tabular-nums">
                  <span className="font-medium text-white">任务 {questNum}</span>
                  {questResult && (
                    <span className={`${chipClass} rounded ${
                      questResult === 'success' 
                        ? 'bg-sky-500/30 text-sky-300'
                        : 'bg-rose-500/30 text-rose-300'
                    }`}>
                      {questResult === 'success' ? (
                        <><Check aria-hidden="true" className="size-4" />成功</>
                      ) : (
                        <><X aria-hidden="true" className="size-4" />失败</>
                      )}
                    </span>
                  )}
                  <span className="text-slate-400 text-xs">
                    ({votes.length}次投票)
                  </span>
                </div>
                {isExpanded ? (
                  <ChevronUp aria-hidden="true" className="size-4 text-slate-400" />
                ) : (
                  <ChevronDown aria-hidden="true" className="size-4 text-slate-400" />
                )}
              </button>

              {/* 展开的投票详情 */}
              {isExpanded && (
                <div className="p-2 space-y-2 bg-slate-800/30">
                  {votes.map((vote, idx) => (
                    <div
                      key={idx}
                      className={`p-2 rounded border ${
                        vote.passed 
                          ? 'border-green-700/50 bg-green-900/20' 
                          : 'border-red-700/50 bg-red-900/20'
                      }`}
                    >
                      {/* 投票轮次标题 */}
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs text-slate-400 tabular-nums">
                          第{vote.voteRound}次投票 · 队长: 玩家{vote.leaderId}
                        </span>
                        <span className={`text-xs ${vote.passed ? 'text-green-400' : 'text-red-400'}`}>
                          {vote.passed ? '通过' : '否决'}
                        </span>
                      </div>

                      {/* 提议的队伍 */}
                      <div className="mb-2 text-xs text-slate-300 tabular-nums">
                        队伍: {vote.team.map(id => `P${id}`).join(', ')}
                      </div>

                      {/* 票型展示 */}
                      <div className="flex flex-wrap gap-1">
                        {gameState.players.map(player => {
                          const playerVote = vote.votes[player.id];
                          if (playerVote === undefined) return null;

                          return (
                            <span
                              key={player.id}
                              className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs ${
                                playerVote
                                  ? 'bg-green-900/50 text-green-300'
                                  : 'bg-red-900/50 text-red-300'
                              }`}
                            >
                              P{player.id}
                              {playerVote ? (
                              <ThumbsUp aria-hidden="true" className="size-3" />
                            ) : (
                                <ThumbsDown aria-hidden="true" className="size-3" />
                              )}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

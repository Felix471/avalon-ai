'use client';

import { Check, Crown, User, Vote, X } from 'lucide-react';
import { buildProposalHistory } from '@/lib/game/history';
import { useGameStore } from '@/lib/game/store';
import { panelClass, panelHeadingClass, subtleTextClass } from './ui';

export default function VoteMatrix() {
  const { gameState } = useGameStore();

  if (!gameState) return null;

  const proposals = buildProposalHistory(gameState);
  const questGroups = proposals.reduce<Array<{ questNumber: number; count: number }>>(
    (groups, proposal) => {
      const lastGroup = groups.at(-1);
      if (lastGroup?.questNumber === proposal.questNumber) {
        lastGroup.count += 1;
      } else {
        groups.push({ questNumber: proposal.questNumber, count: 1 });
      }
      return groups;
    },
    [],
  );

  return (
    <div data-testid="vote-matrix" className={panelClass}>
      <h3 className={`${panelHeadingClass} mb-3`}>
        <Vote aria-hidden="true" className="size-5" />
        投票矩阵
      </h3>

      {proposals.length === 0 ? (
        <p className={`${subtleTextClass} text-slate-500`}>暂无投票历史</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-max min-w-full border-separate border-spacing-0 text-xs tabular-nums">
            <thead>
              <tr className="text-slate-300">
                <th rowSpan={2} className="sticky left-0 z-10 bg-slate-800 px-2 py-1 text-left font-medium">
                  玩家
                </th>
                {questGroups.map(group => (
                  <th
                    key={group.questNumber}
                    colSpan={group.count}
                    className="border-b border-slate-700 px-1 py-1 text-center font-medium"
                  >
                    任务 {group.questNumber}
                  </th>
                ))}
              </tr>
              <tr>
                {proposals.map(proposal => (
                  <th
                    key={proposal.eventIndex}
                    className={`min-w-12 px-1 py-1 text-center font-normal ${
                      proposal.passed ? 'text-slate-300' : 'text-slate-500'
                    }`}
                    title={`第 ${proposal.proposalIndex} 次组队，队长玩家${proposal.leaderId}`}
                  >
                    <span className="block">{proposal.forced ? '强制' : `第 ${proposal.proposalIndex} 次`}</span>
                    <span className="inline-flex items-center gap-0.5">
                      <Crown aria-hidden="true" className="size-3" />
                      {proposal.leaderId}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {gameState.players.map(player => (
                <tr key={player.id}>
                  <th className="sticky left-0 z-10 whitespace-nowrap bg-slate-800 px-2 py-1 text-left font-normal text-slate-300">
                    <span className="inline-flex items-center gap-1">
                      {player.isHuman && <User aria-hidden="true" className="size-3 text-amber-300" />}
                      <span>玩家{player.id}</span>
                      <span className="max-w-24 truncate text-[10px] text-slate-500">
                        {player.isHuman ? '人类' : player.aiModel?.name ?? 'AI'}
                      </span>
                    </span>
                  </th>
                  {proposals.map(proposal => {
                    const playerVote = proposal.votes[player.id];
                    const onTeam = proposal.team.includes(player.id);
                    const voteLabel = playerVote === undefined ? '无投票' : playerVote ? '同意' : '反对';

                    return (
                      <td
                        key={proposal.eventIndex}
                        data-testid="vote-cell"
                        data-vote={playerVote === undefined ? 'none' : playerVote ? 'approve' : 'reject'}
                        aria-label={`玩家${player.id}：${voteLabel}`}
                        className={`size-6 min-w-6 p-0 text-center ${onTeam ? 'bg-slate-700/60' : ''}`}
                      >
                        <span className="inline-flex size-6 items-center justify-center">
                          {playerVote === true ? (
                            <Check aria-hidden="true" className="size-4 text-sky-400" />
                          ) : playerVote === false ? (
                            <X aria-hidden="true" className="size-4 text-rose-400" />
                          ) : (
                            <span className="text-slate-500">—</span>
                          )}
                        </span>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

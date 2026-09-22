'use client';

import { useState } from 'react';
import { Bot, Check, ChevronDown, Info, MessageCircle, User, X } from 'lucide-react';
import { buildQuestSections, type ProposalRecord } from '@/lib/game/history';
import { useGameStore } from '@/lib/game/store';
import type { GameEvent, Player } from '@/lib/game/types';
import { chipClass, panelClass, panelHeadingClass } from './ui';

function Speaker({ event, players }: { event: GameEvent; players: Player[] }) {
  const player = players.find(candidate => candidate.id === event.playerId);
  const isHuman = player?.isHuman === true;
  const SpeakerIcon = isHuman ? User : Bot;

  return (
    <div className="flex items-start gap-2 text-xs">
      <SpeakerIcon
        aria-hidden="true"
        className={`mt-0.5 size-4 shrink-0 ${isHuman ? 'text-amber-300' : 'text-slate-400'}`}
      />
      <div className="min-w-0">
        <div className="flex flex-wrap items-baseline gap-x-2">
          <span className="font-medium text-slate-200">玩家{event.playerId ?? '?'}</span>
          <span className="text-[10px] text-slate-500">
            {isHuman ? '人类玩家' : player?.aiModel?.name ?? 'AI'}
          </span>
        </div>
        <p className="whitespace-pre-wrap break-words text-slate-300">
          {event.content || '（跳过）'}
        </p>
      </div>
    </div>
  );
}

function SystemEvent({ event }: { event: GameEvent }) {
  return (
    <div className="flex items-start gap-2 text-xs text-slate-400">
      <Info aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
      <span>{event.content}</span>
    </div>
  );
}

function ProposalBlock({
  proposal,
  precedingEvents,
  players,
}: {
  proposal: ProposalRecord;
  precedingEvents: GameEvent[];
  players: Player[];
}) {
  const approveCount = Object.values(proposal.votes).filter(Boolean).length;
  const rejectCount = Object.keys(proposal.votes).length - approveCount;
  const status = proposal.forced ? '强制' : proposal.passed ? '投票通过' : '投票否决';
  const statusClass = proposal.forced
    ? 'text-amber-300'
    : proposal.passed
      ? 'text-sky-300'
      : 'text-rose-300';

  return (
    <div className="space-y-2 border-l border-slate-700 pl-3">
      <div className="text-xs text-slate-300 tabular-nums">
        <span className="font-medium text-white">
          第 {proposal.proposalIndex} 次组队 · 队长 玩家{proposal.leaderId} · 队伍{' '}
          {proposal.team.map(playerId => `玩家${playerId}`).join('、')}
        </span>
        <span className={`ml-2 ${statusClass}`}>{status}</span>
      </div>

      {precedingEvents.filter(event => event.type === 'discussion').map(event => (
        <Speaker key={event.id} event={event} players={players} />
      ))}

      <div className="text-xs text-slate-400 tabular-nums">
        {approveCount} 同意 · {rejectCount} 反对
      </div>

      {precedingEvents.filter(event => event.type === 'system').map(event => (
        <SystemEvent key={event.id} event={event} />
      ))}
    </div>
  );
}

export default function Transcript() {
  const { gameState } = useGameStore();
  const [openQuests, setOpenQuests] = useState<Record<number, boolean>>({});

  if (!gameState) return null;

  const sections = buildQuestSections(gameState);
  const previousQuestResultIndices = new Map<number, number>();
  let completedQuests = 0;
  gameState.events.forEach((event, index) => {
    if (event.type === 'quest_result') {
      completedQuests += 1;
      previousQuestResultIndices.set(completedQuests + 1, index);
    }
  });

  return (
    <div data-testid="transcript" className={panelClass}>
      <h3 className={`${panelHeadingClass} mb-3`}>
        <MessageCircle aria-hidden="true" className="size-5" />
        对局实录
      </h3>

      <div className="space-y-2">
        {sections.map(section => {
          const isOpen = openQuests[section.questNumber] ?? section.questNumber === gameState.currentQuest;
          const sectionStart = (previousQuestResultIndices.get(section.questNumber) ?? -1) + 1;
          let previousBoundary = sectionStart;

          return (
            <details
              key={section.questNumber}
              open={isOpen}
              onToggle={event => {
                const open = event.currentTarget.open;
                setOpenQuests(current =>
                  current[section.questNumber] === open
                    ? current
                    : { ...current, [section.questNumber]: open },
                );
              }}
              className="overflow-hidden rounded-lg border border-slate-700 bg-slate-900/20"
            >
              <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-3 py-2 text-sm text-white">
                <span className="font-medium tabular-nums">任务 {section.questNumber}</span>
                <span className="flex items-center gap-2">
                  {section.result ? (
                    <span
                      className={`${chipClass} ${
                        section.result === 'success'
                          ? 'bg-sky-500/20 text-sky-300'
                          : 'bg-rose-500/20 text-rose-300'
                      }`}
                    >
                      {section.result === 'success' ? (
                        <Check aria-hidden="true" className="size-3" />
                      ) : (
                        <X aria-hidden="true" className="size-3" />
                      )}
                      {section.failCount ?? 0} 失败
                    </span>
                  ) : (
                    <span className="text-xs text-amber-300">进行中</span>
                  )}
                  <ChevronDown aria-hidden="true" className="size-4 text-slate-500" />
                </span>
              </summary>

              <div className="space-y-4 border-t border-slate-700 p-3">
                {section.proposals.map(proposal => {
                  const precedingEvents = gameState.events.slice(previousBoundary, proposal.eventIndex);
                  previousBoundary = proposal.eventIndex + 1;
                  return (
                    <ProposalBlock
                      key={proposal.eventIndex}
                      proposal={proposal}
                      precedingEvents={precedingEvents}
                      players={gameState.players}
                    />
                  );
                })}

                {section.questNumber === gameState.currentQuest && !section.result && (() => {
                  const ongoingDiscussion = gameState.events
                    .slice(previousBoundary)
                    .filter(event => event.type === 'discussion');
                  if (ongoingDiscussion.length === 0) return null;

                  return (
                    <div className="space-y-2 border-l border-amber-500/40 pl-3">
                      <div className="text-xs font-medium text-amber-300">本轮讨论</div>
                      {ongoingDiscussion.map(event => (
                        <Speaker key={event.id} event={event} players={gameState.players} />
                      ))}
                    </div>
                  );
                })()}
              </div>
            </details>
          );
        })}
      </div>
    </div>
  );
}

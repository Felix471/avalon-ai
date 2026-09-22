'use client';

import { useEffect, useRef } from 'react';
import { useGameStore } from '@/lib/game/store';
import { Flag, Info, MessageCircle, ScrollText, Skull, Swords, Users, Vote } from 'lucide-react';
import { panelClass, panelHeadingClass, subtleTextClass } from './ui';
import { useLocale, useT } from '@/lib/i18n';
import { translateGameEvent } from '@/lib/i18n/gameEvents';

const eventIcons: Record<string, typeof Info> = {
  discussion: MessageCircle,
  vote: Vote,
  quest_action: Swords,
  quest_result: Flag,
  assassination: Skull,
  team_proposal: Users,
  system: Info,
};

export default function GameLog() {
  const t = useT();
  const { locale } = useLocale();
  const { gameState } = useGameStore();
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [gameState?.events.length]);

  if (!gameState) return null;

  return (
    <div className={panelClass}>
      <h3 className={`${panelHeadingClass} mb-3`}>
        <ScrollText aria-hidden="true" className="size-5" />
        {t('log.title')}
      </h3>

      <div
        ref={scrollRef}
        className="max-h-[40vh] min-h-32 space-y-2 overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-slate-600"
      >
        {gameState.events.length === 0 ? (
          <div className={`${subtleTextClass} py-4 text-center text-slate-500`}>
            {t('log.empty')}
          </div>
        ) : (
          gameState.events.map((event, index) => {
            const EventIcon = eventIcons[event.type] || Info;
            const questNumber = gameState.events
              .slice(0, index + 1)
              .filter(candidate => candidate.type === 'quest_result').length;
            return (
              <div key={event.id} className="flex items-start gap-1.5 text-sm">
                <EventIcon aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-slate-400" />
                <span>
                  {event.playerId !== undefined && (
                    <span className="font-medium text-amber-400">
                      {t('player.label', { id: event.playerId })}:{' '}
                    </span>
                  )}
                  <span className="text-slate-300">
                    {translateGameEvent(event, locale, questNumber)}
                  </span>
                </span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

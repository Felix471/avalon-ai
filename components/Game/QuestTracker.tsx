'use client';

import { useGameStore } from '@/lib/game/store';
import { QUEST_SIZES, DOUBLE_FAIL_QUESTS } from '@/lib/game/types';
import { useT } from '@/lib/i18n';

export default function QuestTracker() {
  const t = useT();
  const { gameState } = useGameStore();

  if (!gameState) return null;

  const { quests, currentQuest, playerCount } = gameState;
  const questSizes = QUEST_SIZES[playerCount] || [2, 3, 2, 3, 3];
  const doubleFailQuests = DOUBLE_FAIL_QUESTS[playerCount] || [];

  return (
    <div data-testid="quest-tracker" className="flex items-center gap-1">
      {quests.map((quest, index) => {
        const questNumber = index + 1;
        const isCurrent = questNumber === currentQuest;
        const requiredPlayers = questSizes[index];
        const needsDoubleFail = doubleFailQuests.includes(questNumber);
        const isResolved = quest.result === 'success' || quest.result === 'fail';
        const failCount = isResolved
          ? Object.values(quest.actions ?? {}).filter(action => !action).length
          : undefined;

        let bgColor = 'bg-slate-700';
        let borderColor = 'border-slate-600';
        let textColor = 'text-slate-400';

        if (quest.result === 'success') {
          bgColor = 'bg-sky-600';
          borderColor = 'border-sky-400';
          textColor = 'text-white';
        } else if (quest.result === 'fail') {
          bgColor = 'bg-rose-600';
          borderColor = 'border-rose-400';
          textColor = 'text-white';
        } else if (isCurrent) {
          bgColor = 'bg-amber-600';
          borderColor = 'border-amber-400';
          textColor = 'text-white';
        }

        return (
          <div
            key={questNumber}
            data-quest-result={quest.result}
            data-fail-count={failCount}
            className={`
              relative flex flex-col items-center justify-center
              h-12 w-10 rounded-lg border-2 text-[11px] tabular-nums transition-all sm:h-14 sm:w-12 sm:text-xs
              ${bgColor} ${borderColor}
              ${isCurrent ? 'ring-2 ring-amber-400 ring-offset-2 ring-offset-slate-900' : ''}
            `}
            title={t('tracker.title', {
              quest: questNumber,
              count: requiredPlayers,
              doubleFail: needsDoubleFail ? t('tracker.doubleFailSuffix') : '',
            })}
          >
            <span className={`font-bold ${textColor}`}>
              {questNumber}
            </span>

            <span className={`font-bold ${textColor}`}>
              {t('tracker.people', { count: requiredPlayers })}
            </span>

            {isResolved && (
              <span className={`text-[10px] leading-none ${textColor}`}>
                {t('tracker.failures', { count: failCount ?? 0 })}
              </span>
            )}

            {needsDoubleFail && (
              <span
                className="absolute -top-1 -right-1 w-4 h-4 bg-orange-500 rounded-full text-[10px] font-bold text-white flex items-center justify-center"
                title={t('tracker.doubleFailTitle')}
              >
                2
              </span>
            )}

            {isCurrent && (
              <span aria-hidden="true" className="absolute -bottom-1 left-1/2 size-1.5 -translate-x-1/2 rounded-full bg-amber-400" />
            )}
          </div>
        );
      })}
    </div>
  );
}

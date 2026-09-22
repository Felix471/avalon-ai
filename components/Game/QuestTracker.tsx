'use client';

import { useGameStore } from '@/lib/game/store';
import { QUEST_SIZES, DOUBLE_FAIL_QUESTS } from '@/lib/game/types';

export default function QuestTracker() {
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

        // 确定任务状态的颜色
        let bgColor = 'bg-slate-700';        // 未进行
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
            title={`任务${questNumber}: 需要${requiredPlayers}人${needsDoubleFail ? '（需2张失败票）' : ''}`}
          >
            {/* 任务编号 */}
            <span className={`font-bold ${textColor}`}>
              {questNumber}
            </span>

            {/* 需要的人数 */}
            <span className={`font-bold ${textColor}`}>
              {requiredPlayers}人
            </span>

            {isResolved && (
              <span className={`text-[10px] leading-none ${textColor}`}>
                {failCount} 失败
              </span>
            )}

            {/* 双失败标记 */}
            {needsDoubleFail && (
              <span
                className="absolute -top-1 -right-1 w-4 h-4 bg-orange-500 rounded-full text-[10px] font-bold text-white flex items-center justify-center"
                title="需要2张失败票才会失败"
              >
                2
              </span>
            )}

            {/* 当前任务指示器 */}
            {isCurrent && (
              <span aria-hidden="true" className="absolute -bottom-1 left-1/2 size-1.5 -translate-x-1/2 rounded-full bg-amber-400" />
            )}
          </div>
        );
      })}
    </div>
  );
}

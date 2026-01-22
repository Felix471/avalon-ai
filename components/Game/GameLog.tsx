'use client';

import { useEffect, useRef } from 'react';
import { useGameStore } from '@/lib/game/store';

export default function GameLog() {
  const { gameState } = useGameStore();
  const scrollRef = useRef<HTMLDivElement>(null);

  // 自动滚动到底部
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [gameState?.events.length]);

  if (!gameState) return null;

  const getEventIcon = (type: string) => {
    switch (type) {
      case 'discussion': return '💬';
      case 'vote': return '🗳️';
      case 'quest_action': return '⚔️';
      case 'quest_result': return '📊';
      case 'assassination': return '🗡️';
      case 'team_proposal': return '👥';
      case 'system': return '📢';
      default: return '•';
    }
  };

  return (
    <div className="bg-slate-800/50 rounded-xl border border-slate-700 p-4">
      <h3 className="text-white font-bold mb-3 flex items-center gap-2">
        📜 游戏记录
      </h3>

      <div
        ref={scrollRef}
        className="h-48 overflow-y-auto space-y-2 pr-2 scrollbar-thin scrollbar-thumb-slate-600"
      >
        {gameState.events.length === 0 ? (
          <div className="text-slate-500 text-sm text-center py-4">
            游戏事件将显示在这里...
          </div>
        ) : (
          gameState.events.map((event) => (
            <div key={event.id} className="text-sm">
              <span className="mr-1">{getEventIcon(event.type)}</span>
              {event.playerName && (
                <span className="text-amber-400 font-medium">{event.playerName}: </span>
              )}
              <span className="text-slate-300">{event.content}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}